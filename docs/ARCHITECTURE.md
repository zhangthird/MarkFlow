# MarkFlow Architecture

This document records the engineering boundaries that should remain stable as MarkFlow grows. `README.md` is the project entry; `FEATURES.md` describes user-visible behavior; this file describes state ownership, persistence, editor boundaries, testing, and future adapters.

## Product direction

MarkFlow is a **local-first knowledge workspace built around ordinary files**.

The main invariant is:

> The file on disk is the source of truth; editor state is an interactive working copy.

Markdown, Excalidraw, Mermaid, images, PDFs, Wiki Links, backlinks, search, and command navigation belong to one workspace rather than separate application databases.

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
| Editor layer             |   | PersistenceRuntime        |
| TyporaEditor wrapper     |   | debounced autosave        |
| TyporaEditorCore         |   | switch/visibility flush   |
| markdown-blocks parser   |   | unload protection         |
| MarkdownRenderer         |   +-------------+-------------+
| Excalidraw               |                 |
+------------+-------------+                 v
             |                    +-------------------------+
             |                    | Workspace / FS layer    |
             |                    | workspace-loader        |
             |                    | workspace-persistence   |
             |                    | workspace-refresh       |
             |                    | file-system             |
             |                    | file-operations         |
             |                    +------------+------------+
             |                                 |
             +---------------------------------+
                                               v
                                      Local workspace files
```

## Application shell

`src/app/page.tsx` stays a thin route entry.

`src/components/workspace/WorkspacePage.tsx` coordinates:

- editor / preview selection;
- Sidebar / Backlinks layout;
- focus mode;
- WYSIWYG / Source Mode choice;
- workspace-opening hook integration;
- document status / counters.

It should not absorb filesystem traversal or Markdown parsing.

## Core state invariants

### One path identifies one workspace node

`FileNode.path` is the canonical workspace identity.

Folder rename must update descendant paths, and current UI state must not retain stale nodes after rename/delete.

### Undo/redo belongs to one document

History is file-scoped. A document switch must never allow edits from the previous document to undo in the next document.

Content mutations keep these views coherent:

- top-level editor `content`;
- `currentFile` content;
- matching file-tree node;
- dirty state.

### Dirty means memory is newer than the confirmed disk snapshot

```text
isModified = true
```

A save may clear dirty only when the snapshot that finished writing is still the latest content.

```text
write snapshot A
user produces snapshot B
write A finishes
→ B must remain dirty
```

### Disk and file-tree mutations must agree

For an opened local workspace, UI success should represent a real postcondition, not merely that an async operation was started.

Filesystem primitives belong in `src/lib/file-system.ts`.

The current UI-facing operation adapter in `src/lib/file-operations.ts` exposes:

```text
success
invalid_name
already_exists
parent_not_found
not_found
unchanged
io_error
```

It waits for expected file-tree state before reporting success. A future cleanup should move this typed result contract directly onto the store/filesystem action boundary instead of observing fire-and-forget actions from outside.

## Persistence lifecycle

Text documents follow:

```text
edit
  → update working copy + tree node
  → mark dirty
  → debounce
  → write captured snapshot
  → compare with latest state
  → clear dirty only if still current
```

Additional rules:

- switching documents attempts to flush the previous dirty local file;
- visibility changes attempt to flush the active file;
- before unload, the whole workspace tree is checked for dirty files;
- manual save uses the same snapshot semantics.

This belongs in `PersistenceRuntime`, not in editor components.

## Workspace lifecycle

```text
useWorkspaceDirectory
        |
        +--> workspace-loader
        |      directory traversal / FileNode creation
        |
        +--> workspace-persistence
        |      IndexedDB directory handle / last file
        |
        +--> workspace-refresh
               explicit clean-state disk rescan
```

The loader skips generated/internal directories such as `.git`, `node_modules`, and `.next`.

Passive startup only queries existing File System Access permission. It does not call `requestPermission()` without a user gesture.

### Workspace Refresh safety boundary

`src/lib/workspace-refresh.ts` owns explicit disk refresh semantics.

The current model intentionally refuses to refresh whenever any file in the loaded tree has `isModified = true`.

```text
refresh requested
      |
      v
collect dirty paths
  |           |
 dirty       clean
  |           |
 cancel      rescan disk
              |
              v
      replace clean snapshot
      restore current path
      reset history/search
```

This policy exists because MarkFlow does not yet retain a base/local/disk triple for three-way conflict resolution. Silently replacing or heuristically merging a dirty working copy would violate the local-first safety invariant.

A future external-change feature may add filesystem watch and explicit diff/conflict UI, but it should preserve the rule that unresolved local edits are never discarded implicitly.

## Filesystem semantics

`src/lib/file-system.ts` owns browser File System Access API operations:

- nested directory traversal;
- filename validation;
- create at the correct parent path;
- recursive delete;
- duplicate detection;
- file/directory rename;
- descendant handle rebinding.

Because browsers do not expose a sufficiently portable native rename primitive, current rename uses conservative copy-then-delete. Copy failure must leave the original entry intact.

Browser-specific filesystem code should remain behind a small boundary so a future desktop shell can replace it without forking the editor.

## Markdown editor boundary

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

### TyporaEditor

`TyporaEditor.tsx` chooses between block-level WYSIWYG and full-document Source Mode. Both operate on the same `content` and `onChange`; there is no second durable document model.

### TyporaEditorCore

Owns:

- active-block editing;
- paragraph creation;
- Enter / Shift+Enter semantics;
- list/task/quote continuation;
- block-to-block keyboard movement;
- source selection / caret behavior;
- rendered-table-cell → source-cell mapping;
- Slash Menu integration;
- complex-block live Preview.

It must not perform workspace persistence.

### markdown-blocks.ts

Owns deterministic source partitioning into semantic editable ranges. Parser stability matters because edit range updates depend on source line identity.

### MarkdownRenderer

Owns rendering and rendering-specific interactions:

- react-markdown / GFM;
- KaTeX;
- syntax highlighting;
- Mermaid;
- Wiki Link rendering;
- task checkbox interaction;
- table cell click routing;
- local relative-image hooks;
- code / Mermaid Copy actions.

## WYSIWYG model and its limit

The editor is a **block-level mixed editor**:

```text
inactive block → rendered DOM
active block   → Markdown source textarea
```

This retains predictable Markdown serialization and local-file fidelity, but inline meta syntax such as `**`, `[]()`, and `$...$` is still exposed at block granularity rather than only around the focused inline token.

Table cells intentionally have a more precise mapping than generic blocks: rendered row/cell coordinates are mapped back to source ranges while skipping the GFM divider row and ignoring escaped/code-span pipes.

Any future inline editing model must preserve:

1. Markdown files as the only durable content model;
2. deterministic source serialization;
3. Wiki Link syntax;
4. Mermaid/math blocks;
5. relative local image paths;
6. current undo/autosave semantics.

A source-position-aware Markdown AST is preferable to regex-only DOM mutation for that future step.

## Source Mode

Source Mode is an explicit view, not a fallback triggered by formatting actions.

```text
same content
   /    \
WYSIWYG  Source Mode
   \    /
undo / dirty / autosave
```

Current switching preserves normalized scroll progress. Exact source-position / selection mapping remains a future improvement.

## Wiki Link model

Parsing and resolution live in `src/lib/wiki-links.ts`.

Supported forms:

```text
[[Note]]
[[Note.md]]
[[folder/Note]]
[[Note|display text]]
```

Resolution is deterministic:

1. explicit workspace-relative path;
2. exact filename / filename without extension;
3. same-directory preference for duplicate names;
4. deterministic fallback.

Backlinks are derived from Markdown source.

Rename refactoring rewrites only links that actually resolved to the renamed file before the rename. Normal typing must not trigger whole-workspace rename scans.

## Search and navigation

Full-text Search is derived from the loaded in-memory workspace tree.

Quick Open (`Ctrl/Cmd+P`) combines filename/path matching, recent-file ranking, file opening, and selected commands, including explicit Workspace Refresh. These surfaces should continue using the same canonical file-opening and workspace-operation semantics.

## Mermaid security

Markdown may come from arbitrary local folders. Mermaid therefore remains untrusted document input.

The renderer uses a strict security level plus text/edge limits. New features should not silently relax this boundary to enable arbitrary callbacks or embedded HTML.

## Regression testing

The repository now has a first dependency-free regression layer using Node 24's built-in `node:test`.

```text
CI
→ install
→ lint
→ core tests
→ production build
```

Current `tests/core-semantics.test.mjs` directly exercises existing TypeScript source and covers:

- semantic Markdown block grouping;
- paragraph/list/table/fenced-code ranges;
- Wiki Link extraction and alias metadata;
- duplicate-name resolution with same-directory preference;
- rename rewriting only for links that resolve to the renamed note;
- workspace path helper semantics;
- filename validation.

This intentionally starts with pure logic that can run without a DOM or browser filesystem mock.

Next testing priorities:

1. table source mapping edge cases;
2. editor keyboard transitions including hard breaks and block merge;
3. autosave snapshot races;
4. workspace refresh dirty/scan edge cases;
5. filesystem create/rename/delete with deterministic mock handles;
6. browser integration for File System Access and mode switching.

## Desktop boundary

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

Shared code should include React UI, Markdown parsing/rendering, Zustand state semantics, Wiki Link logic, search/navigation, and persistence concepts.

Desktop-only concerns include native filesystem access, windows/menus, updater, OS integration, and filesystem watching.

## Current engineering roadmap

Completed features should not remain listed as future work. The current priorities are:

1. **Source/render position mapping** — replace scroll-ratio-only WYSIWYG/Source transitions with source-position-aware restoration.
2. **Typed CRUD at the action boundary** — make the underlying actions return structured results directly.
3. **Test expansion** — keyboard, table mapping, persistence races, workspace refresh, mock filesystem, and browser integration.
4. **External-change conflict UX** — extend explicit Workspace Refresh toward diff/conflict handling without overwriting dirty edits.
5. **Inline syntax focus model** — reveal/hide Markdown markers around focused inline tokens while retaining Markdown as the only durable model.
6. **WorkspaceAdapter + Tauri** — stabilize the adapter before adding a desktop shell.
7. **Dependency cleanup** — reconcile lockfile drift and React 19 / Excalidraw peer ranges separately from feature changes.

## CI / dependency note

GitHub Actions currently validates dependency installation, ESLint / React Compiler rules, core semantic tests, and a production Next.js build.

The repository still has dependency compatibility debt, notably Excalidraw peer ranges against React 19 and existing lockfile drift. CI intentionally uses a compatibility install path until that cleanup is handled as its own change.
