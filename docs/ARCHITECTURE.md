# MarkFlow Architecture

This document records the product and engineering boundaries that should remain stable as MarkFlow grows.

## Product direction

MarkFlow is a local-first knowledge workspace built around ordinary files. Markdown is the primary authoring format, while Excalidraw, Mermaid, images, PDFs, Wiki links, and search extend the same workspace instead of creating separate data silos.

The main design principle is:

> The file on disk is the source of truth; the editor state is an interactive working copy of that file.

This keeps a MarkFlow workspace portable and avoids locking user knowledge into an application-specific database.

## Current architecture

```text
Browser / future desktop shell
        |
        v
+-------------------------+
| App shell (Next.js)     |
| Toolbar / Sidebar       |
| Search / Backlinks      |
+------------+------------+
             |
             v
+-------------------------+
| Zustand editor store    |
| active file             |
| file tree               |
| editor history          |
| dirty state             |
+------------+------------+
             |
       +-----+-----+
       |           |
       v           v
+-------------+ +------------------+
| Editors     | | Persistence      |
| Markdown    | | autosave runtime |
| Excalidraw  | | save / restore   |
+-------------+ +---------+--------+
                         |
                         v
                +-------------------+
                | File-system layer |
                | nested CRUD       |
                | handles / paths   |
                +---------+---------+
                          |
                          v
                Local workspace files
```

## Core state invariants

The following invariants should be preserved when adding features.

### 1. One path identifies one workspace node

`FileNode.path` is the canonical identity inside an opened workspace. Renaming a folder therefore requires updating every descendant path.

The UI must not keep a stale `currentFile` object after a rename or deletion.

### 2. Editor history belongs to a document

Undo/redo history must never be shared across two files. Switching files starts or restores a history scope for the new document rather than applying the previous document's edits.

### 3. Dirty state represents disk divergence

`isModified = true` means the in-memory snapshot is newer than the known disk snapshot.

A save may clear the dirty flag only when the snapshot that finished writing is still the latest snapshot. This matters because writing to disk is asynchronous and the user may continue typing while a previous write is in progress.

### 4. File-tree and disk mutations should agree

For an opened local directory, create/delete/rename operations should update the in-memory file tree only after the corresponding disk operation succeeds.

The file-system logic belongs in `src/lib/file-system.ts`, not inside UI components.

## Persistence lifecycle

For text documents the intended lifecycle is:

```text
edit
  -> update current document and file tree
  -> mark dirty
  -> debounce
  -> write snapshot to disk
  -> compare written snapshot with latest state
  -> clear dirty only if they still match
```

When switching documents, MarkFlow attempts to flush the previous dirty local file immediately. When the page becomes hidden it also attempts to flush the active file.

Before page unload, the whole workspace tree is inspected for dirty files. This is intentionally broader than checking only the active document because a previous file can remain dirty after a failed save.

## File-system semantics

`src/lib/file-system.ts` is the browser File System Access API adapter.

It currently owns:

- nested directory traversal;
- safe file/folder creation;
- recursive deletion;
- filename validation;
- duplicate detection;
- file rename;
- directory rename and handle rebinding.

The browser API does not provide a broadly portable native rename primitive. MarkFlow therefore implements rename conservatively as copy-then-delete. A failed copy should not remove the original entry.

## Markdown editor boundary

`TyporaEditor` should remain responsible for the interactive block-editing experience, not workspace persistence.

As the editor grows, its internal responsibilities should be separated into four conceptual layers:

```text
Markdown source
    |
    v
block parser
    |
    v
block renderer
    |
    v
editing controller
    |
    v
keyboard / selection controller
```

This separation will make tables, code blocks, math, Mermaid, slash commands, drag-and-drop, and future block plugins easier to evolve independently.

## Wiki-link model

Wiki-link parsing and resolution live in `src/lib/wiki-links.ts`.

Supported forms are:

```text
[[Note]]
[[Note.md]]
[[folder/Note]]
[[Note|display text]]
```

Resolution order is deliberately deterministic:

1. explicit workspace-relative path;
2. exact filename or filename without extension;
3. when duplicate names exist, a note in the source note's directory;
4. otherwise the first deterministic candidate.

Backlinks should be derived from source Markdown rather than stored as independent application data. This keeps the knowledge graph reconstructable from ordinary files.

## Search direction

The current search index is derived from the in-memory workspace tree. Near-term improvements should preserve a single navigation model for:

- filename search;
- content search;
- Wiki-link targets;
- backlinks;
- commands.

A future command palette can combine these result types without changing how files are opened.

## Desktop application boundary

Desktop packaging should not fork the editor implementation. The preferred design is an adapter boundary:

```text
                Workspace API
              /               \
Browser File System API    Desktop filesystem API
          |                        |
          +----------+-------------+
                     |
                editor/store
```

The Next.js/React editor, Zustand state model, Markdown rendering, search, and Wiki-link logic should remain shared. Only filesystem, window, native-menu, update, and OS-integration capabilities should differ between browser and desktop shells.

Tauri is a good fit for this direction because MarkFlow is already web-based and does not require moving the editor UI to a native toolkit. The important prerequisite is to keep filesystem calls behind a small adapter instead of spreading browser-specific APIs throughout components.

## Recommended next engineering steps

1. Introduce a `WorkspaceAdapter` interface and make the current File System Access implementation its browser adapter.
2. Move file CRUD result/error handling to typed operation results that UI components can surface with toasts.
3. Split `TyporaEditor` parsing/rendering/keyboard behavior into focused modules.
4. Add note-rename refactoring so renaming a Markdown file can optionally update Wiki-link references.
5. Build a unified command palette over filenames, content search, backlinks, and commands.
6. Add a Tauri adapter and packaging workflow after the workspace adapter is stable.
7. Add focused tests for path mutation, Wiki-link resolution, and Markdown block parsing before larger editor refactors.

## Dependency maintenance note

The repository currently has some dependency drift: `package-lock.json` is slightly behind `package.json`, and Excalidraw 0.18 brings older React peer ranges while MarkFlow runs React 19. CI currently uses a compatibility install so lint and production build validation can still run.

Dependency cleanup should be handled as a separate change so editor-state and filesystem correctness changes remain reviewable.
