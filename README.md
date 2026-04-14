# Gemini Chat Viewer & Handoff Tool

A set of lightweight, local-first tools for viewing and sharing [Gemini CLI](https://github.com/google/gemini-cli) conversation exports.

## ⬡ Gemini Chat Viewer (`gemini-viewer.html`)

A beautiful, single-file web interface to visualize your Gemini CLI chat history.

### Features
- **Local-First:** Your data never leaves your browser. No network requests are made.
- **Rich Visualization:** Clean, IDE-inspired UI for reading conversations, tool calls, and model thoughts.
- **Context Awareness:** Automatically identifies and collapses `session_context` and `editor_context` blocks.
- **Tool Call Inspection:** Expandable blocks for function calls and their results.
- **Handoff Support:** Integrated support for `.handoff.json` bundles, including a dedicated tab for `GEMINI.md` files.

### Usage
1. Export a chat from Gemini CLI: `/chat share my-chat.json`
2. Open `gemini-viewer.html` in any modern web browser.
3. Drag and drop your `.json` file or paste the JSON content directly.

---

## 📦 Gemini Handoff (`gemini-viewer.js`)

A Node.js utility to bundle a conversation export with its surrounding project context (`GEMINI.md` files) for a seamless handoff to another developer.

### Features
- **Project Discovery:** Automatically extracts workspace paths from the chat's `session_context`.
- **Context Bundling:** Scans workspaces for `GEMINI.md` files and includes them in the bundle.
- **Custom Notes:** Attach a handoff note to explain the current state or next steps.

### Usage
```bash
# Basic bundle
node gemini-viewer.js my-chat.json

# Bundle with a custom note
node gemini-viewer.js my-chat.json --note "Fixing the auth bug, see GEMINI.md for details"

# Specify output path
node gemini-viewer.js my-chat.json --out team-handoff.json
```

### Options
- `--note "..."`: Optional message for the recipient.
- `--out <path>`: Custom output filename (defaults to `<input>.handoff.json`).

---

## Authors
- **Mohamed Aly**
