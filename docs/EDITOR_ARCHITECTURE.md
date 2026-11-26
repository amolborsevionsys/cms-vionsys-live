# Vionsys CMS: Editor Canvas Architecture

This document describes the design and flow of the editor canvas, which is the main centerpiece of this CMS.

## Main Workspace Flow

```mermaid
graph LR
    UserContent["User Writing Content"]
    EditorJS["Editor.js Engine"]
    LocalState["Controlled Local React State"]
    AutosaveTimer["Autosave Loop (30s)"]
    ExitBlur["Tab Blur Listener"]
    PrismaDB["MongoDB (Prisma)"]

    UserContent --> EditorJS
    EditorJS -- "onChange → editorJsToHtml()" --> LocalState
    LocalState --> AutosaveTimer
    LocalState --> ExitBlur
    AutosaveTimer -- "PUT request if changed" --> PrismaDB
    ExitBlur -- "PUT request if changed" --> PrismaDB
```

---

## Editor Components Structure

Located inside `src/components/cms/editor/`:
- **ContentEditorShell**: The orchestrator page wrapper. Maintains forms state, autosave timers, preview redirects, and publish validation triggers.
- **RichTextEditor**: Loads Editor.js on the client only (dynamic imports) with the header, list, table, quote, code, raw, image, and underline tools. It adds a custom-blocks dropdown and connects to the Media Library Picker modal. Blocks are converted to HTML and text by `src/lib/editorjs-parser.ts`.
- **ContentIntelligenceBar**: The bottom statistics bar calculating word counts, reading time, keyword density, and checking semantic heading structures.

---

## Custom Block Injector Architecture

Writers can inject complex modular layouts (like FAQs, Stats, CTAs, and Testimonials) without coding.
1. **Insertion**: The dropdown inserts these as Editor.js **Raw HTML** blocks containing pre-styled snippets with distinct classes (e.g. `<div class="stats-block">...</div>`).
2. **Output**: The database stores three forms of editor output:
   - `contentJson`: The complete Editor.js `OutputData` object, used to restore the editor.
   - `contentHtml`: HTML generated in the browser, then sanitised on the server with an allow-list (`src/lib/sanitize-html.ts`) before it is stored for frontend presentation.
   - `contentText`: Plain text, used for search and the content metrics.

---

## Autosave & Version History

- **Autosave triggers**:
  - Periodically every 30 seconds if changes are detected.
  - Instantly on window `blur` or browser tab navigation focus change.
- **Debouncing**: Changes are captured in memory first and saved to the database in debounced intervals rather than on every keystroke.
- **Version Control**: The server retains the last 20 content states per document. Re-saving creates a new audit trail history entry, purging older states past the 20-version ceiling.
