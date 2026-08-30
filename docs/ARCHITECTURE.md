# MarkFlow Architecture

This document records the product and engineering boundaries that should remain stable as MarkFlow grows. It is intentionally more structural than `README.md` or `FEATURES.md`.

## Product direction

MarkFlow is a **local-first knowledge workspace built around ordinary files**.

Markdown is the primary authoring format. Excalidraw, Mermaid, images, PDFs, Wiki links, backlinks, search, and command navigation extend the same workspace instead of creating separate data silos.

The main invariant is:

> The file on disk is the source of truth; editor state is an interactive working copy.

A MarkFlow workspace should remain readable by other tools without an export step.

## Current architecture

```text
Browser / future desktop shell
        |
        v
+----------------------------------+
| Next.js application shell        |
| WorkspacePage                    |
| Toolbar / Sidebar / Backlinks    |
| Search / Quick Open              |
+----------------+-----------------+
                 |
                 v
+----------------------------------+
| Zustand editor store             |
| active file / file tree          |
| content / per-file history       |
| dirty state / preferences        |
+----------+-----------------------+
           |
     +-----+-------------------------+
     |                               |
     v                               v
+--------------------------+   +---------------------------+
| Editor layer             |   | Persistence runtime       |
| TyporaEditor wrapper     |   | debounced autosave        |
| TyporaEditorCore         |   | switch/visibility flush   |
| MarkdownRenderer         |   | unload protection         |
| markdown-blocks parser   |   +-------------+-------------+
| Excalidraw               |                 |
+------------+-------------+                 v
             |                    +-------------------------+
             |                    | Workspace / FS layer    |
             |                    | workspace-loader        |
             |                    | workspace-persistence   |
             |                    | file-system             |
             |                    | file-operations         |
             |                    +------------+------------+
             |                                 |
             +---------------------------------+
                                               v
                                      Local workspace files
```

## Application shell boundary

`src/app/page.tsx` is intentionally a thin route entry.

The main workspace UI lives in:

```text
src/components/workspace/WorkspacePage.tsx
```

`WorkspacePage` coordinates:

- editor / preview selection;
- sidebar and backlinks layout;
- focus mode;
- WYSIWYG / Source Mode selection;
- workspace-opening hook integration;
- document-level status information.

It should not absorb filesystem traversal or Markdown parsing again.

## Core state invariants

### 1. One path identifies one workspace node

`FileNode.path` is the canonical workspace identity.

Renaming a folder therefore requires updating every descendant path. The UI must not retain a stale `currentFile` object after rename/delete.

### 2. Editor history belongs to one document

Undo/redo is file-scoped.

Switching from A.md to B.md must never allow B.md to undo A.md content.

The store updates content consistently across:

- top-level editor content;
- `currentFile`;
- corresponding file-tree node;
- dirty state.

### 3. Dirty means memory is newer than known disk state

```text
isModified = true
```

means the in-memory snapshot differs from the last confirmed disk snapshot.

A save can clear dirty only if the snapshot that completed writing is still the newest snapshot. This prevents the following race:

```text
write snapshot A
  user types snapshot B
write A finishes
  -> must NOT mark B clean
```

### 4. File-tree mutations and disk mutations must agree

For a real local workspace, create/delete/rename should not report success until the expected tree state appears after the disk operation.

Filesystem primitives live in `src/lib/file-system.ts`.

UI-facing structured operation results live in `src/lib/file-operations.ts`:

```text
success
invalid_name
already_exists
parent_not_found
not_found
unchanged
io_error
```

This layer currently waits for the store/file tree to reach the expected postcondition, allowing Sidebar UI to avoid obvious false-success messages.

A future cleanup should move the same typed result contract closer to the underlying store/filesystem action instead of relying on observation after fire-and-forget store methods.

## Persistence lifecycle

For text documents:

```text
edit
  -> update current document + tree node
  -> mark dirty
  -> debounce
  -> write a captured snapshot
  -> compare written snapshot with latest state
  -> clear dirty only if they still match
```

Additional rules:

- switching documents attempts to flush the previous dirty local file;
- document visibility changes attempt to flush the active file;
- before unload, the entire workspace tree is inspected for dirty files;
- manual save remains available but uses the same snapshot semantics.

This logic belongs in `PersistenceRuntime`, not in individual editor components.

## Workspace lifecycle

Workspace responsibilities are deliberately split:

```text
useWorkspaceDirectory
        |
        +--> workspace-loader
        |      directory traversal / FileNode creation
        |
        +--> workspace-persistence
               IndexedDB directory handle / last file
```

The loader skips obvious generated/internal directories such as:

- `.git`
- `node_modules`
- `.next`

Directory restoration must not call `requestPermission()` during passive startup. Browsers commonly require that permission requests originate from a user gesture. Startup therefore queries existing permission and asks the user to reopen the directory if authorization was lost.

## File-system semantics

`src/lib/file-system.ts` is the current browser File System Access API adapter.

It owns:

- nested directory traversal;
- name validation;
- creation at the correct parent path;
- recursive deletion;
- duplicate detection;
- file rename;
- directory rename and descendant handle rebinding.

The browser API does not expose a sufficiently portable native rename primitive. MarkFlow therefore uses conservative copy-then-delete semantics. The original entry must remain intact if copying fails.

This browser-specific layer should eventually implement a generic workspace adapter rather than being referenced directly by future desktop code.

## Markdown editor boundary

The editor is now split into focused layers instead of one large `TyporaEditor.tsx`.

```text
Markdown source
      |
      v
markdown-blocks.ts
semantic block partition
      |
      +----------------------+
      |                      |
      v                      v
TyporaEditorCore       MarkdownRenderer
interaction            rendered Markdown
keyboard/selection     GFM/KaTeX/code/Mermaid
      |                      |
      +----------+-----------+
                 |
                 v
          TyporaEditor wrapper
          WYSIWYG / Source Mode
```

### TyporaEditor wrapper

`TyporaEditor.tsx` chooses between:

- block-level WYSIWYG;
- full-document Source Code Mode.

Both receive the same `content` and `onChange`; there is no second document model.

### TyporaEditorCore

Owns:

- active-block editing;
- block-to-block keyboard movement;
- paragraph creation;
- list/task/quote continuation;
- slash menu integration;
- source selection/caret behavior;
- complex-block live preview.

It must not perform workspace persistence.

### markdown-blocks.ts

Owns Markdown source partitioning into editable semantic ranges.

Parser behavior should stay deterministic because editor range updates depend on source line identity.

### MarkdownRenderer

Owns rendered output and rendering-specific interactions:

- react-markdown / GFM;
- math / KaTeX;
- syntax highlighting;
- Mermaid;
- Wiki Link rendering;
- task checkbox interaction;
- relative local image resolution hooks;
- rendered code/Mermaid copy actions.

## WYSIWYG model and its current limit

The current editor is a **block-level mixed editor**, not a complete inline rich-text engine.

```text
inactive block -> rendered DOM
active block   -> Markdown source textarea
```

This provides strong Markdown fidelity with relatively simple state semantics, but it has a known boundary: inline meta syntax such as `**`, `[]()`, and `$...$` is exposed at block granularity rather than only around the focused inline token.

Before replacing this design with ProseMirror/Lexical/contenteditable, any proposal must preserve:

1. Markdown files as the only durable source;
2. predictable source serialization;
3. Wiki Link syntax;
4. Mermaid/math blocks;
5. local relative image paths;
6. current undo/autosave semantics.

A future inline editing model should preferably be driven by source-position-aware Markdown AST information rather than regex-only DOM editing.

## Source Code Mode

Source Mode is an explicit view, not a fallback triggered by formatting actions.

```text
same content
   /    \
WYSIWYG  Source Mode
   \    /
undo / dirty / autosave
```

Mode switching should preserve the user’s document position as closely as possible. The current implementation preserves normalized scroll progress; a future improvement can map exact source positions between rendered and source views.

## Wiki-link model

Wiki-link parsing and resolution live in `src/lib/wiki-links.ts`.

Supported forms:

```text
[[Note]]
[[Note.md]]
[[folder/Note]]
[[Note|display text]]
```

Resolution is deterministic:

1. explicit workspace-relative path;
2. exact filename or filename without extension;
3. source-note directory preference for duplicate names;
4. deterministic fallback candidate.

Backlinks are derived from Markdown source rather than stored as independent graph data.

### Rename refactoring

Renaming a Markdown note can rewrite Wiki Links that actually resolved to the renamed target before the operation.

This intentionally avoids naive global replacement in duplicate-name workspaces.

The rename runtime should execute only when a rename occurs; normal typing must not cause whole-workspace rename scans.

## Search and navigation

MarkFlow currently has two related navigation surfaces:

### Full-text Search

Derived from the in-memory workspace tree and used for content matching/navigation.

### Quick Open / Command Palette

`Ctrl/Cmd + P` combines:

- filename/path lookup;
- recency ranking;
- file opening;
- selected workspace/editor commands.

Recent-file state is browser-local metadata, not part of the workspace content model.

Future navigation features should continue using the same file-opening semantics rather than introducing independent selection models.

## Mermaid security boundary

MarkFlow can open Markdown from arbitrary local folders, so Mermaid content should be treated as untrusted document input.

The renderer uses a strict Mermaid security level and size/edge limits. New Mermaid features should not silently relax this boundary to enable HTML or callbacks.

## Desktop application boundary

Desktop packaging should not fork the editor.

Preferred direction:

```text
                   WorkspaceAdapter
                  /                \
Browser FS Access API          Tauri filesystem
         |                          |
         +------------+-------------+
                      |
            store / editor / search
```

Shared across browser and desktop:

- React UI;
- Markdown block model;
- renderer;
- Zustand state semantics;
- Wiki Link logic;
- search/navigation;
- persistence lifecycle concepts.

Desktop-only concerns:

- native filesystem adapter;
- windows/menus;
- updater;
- OS integration;
- file watching if available.

## Testing priorities

The project now has CI lint + production build validation, but regression-sensitive editor logic needs focused automated tests.

Highest-value targets:

1. `file-system.ts` path/create/delete/rename semantics;
2. `file-operations.ts` result/postcondition behavior;
3. `wiki-links.ts` duplicate-name resolution and rename rewriting;
4. `markdown-blocks.ts` ranges for paragraphs/lists/code/math/tables;
5. editor keyboard transitions (Enter, list continuation, Backspace merge);
6. save snapshot race behavior.

## Current engineering roadmap

Already completed items should not remain in the roadmap. The current priorities are:

1. **Precise table editing** — map a rendered table cell to its source cell/range.
2. **Line-break semantics** — align WYSIWYG `Shift+Enter` hard-line-break behavior with the intended Markdown representation.
3. **Source/render position mapping** — move from scroll-ratio preservation toward source-position-aware WYSIWYG/Source Mode transitions.
4. **Workspace Refresh** — rescan and diff external filesystem changes without overwriting local dirty edits.
5. **Typed CRUD at the action boundary** — replace fire-and-forget store CRUD with promises returning typed operation results directly.
6. **Automated tests** — cover parser, path mutation, Wiki Link resolution, keyboard transitions, and persistence races.
7. **Inline syntax focus model** — evaluate source-position-aware inline marker reveal/hide while retaining Markdown as the only durable model.
8. **WorkspaceAdapter + Tauri** — add the abstraction first, then desktop packaging/local storage integration.
9. **Dependency cleanup** — reconcile lockfile/dependency drift and React-19/Excalidraw peer ranges independently of editor feature PRs.

## CI / dependency note

GitHub Actions currently validates:

- dependency installation;
- ESLint / React Compiler rules;
- production Next.js build.

The repository still has dependency compatibility debt around some packages (notably Excalidraw peer ranges against React 19), so CI uses a compatibility install path. Dependency cleanup should remain a dedicated change rather than being mixed with filesystem/editor correctness work.
