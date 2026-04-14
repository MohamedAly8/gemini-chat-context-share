#!/usr/bin/env node
/**
 * gemini-handoff.js
 *
 * Bundles a Gemini CLI conversation export + all GEMINI.md files
 * found in the session's workspace into a single .handoff.json file.
 *
 * Usage:
 *   node gemini-handoff.js <conversation-export.json> [options]
 *
 * Options:
 *   --note "..."     Add a handoff note for your colleague (optional)
 *   --out  <path>    Output file path (default: <input-basename>.handoff.json)
 *
 * Examples:
 *   node gemini-handoff.js my-chat.json
 *   node gemini-handoff.js my-chat.json --note "Handing off auth work, see PROJ-123"
 *   node gemini-handoff.js my-chat.json --out /tmp/sprint-handoff.json
 */

const fs   = require('fs');
const path = require('path');

// ── Arg parsing ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node gemini-handoff.js <conversation.json> [--note "..."] [--out <path>]

Bundles your Gemini CLI conversation export and all GEMINI.md files
found in the session workspace into a single shareable .handoff.json.

Options:
  --note "..."   Optional handoff note for your colleague
  --out <path>   Output path (default: <input-name>.handoff.json)
  --help         Show this help
`);
  process.exit(0);
}

const inputFile = args[0];

let handoffNote = '';
let outputFile  = null;

for (let i = 1; i < args.length; i++) {
  if (args[i] === '--note' && args[i + 1]) {
    handoffNote = args[++i];
  } else if (args[i] === '--out' && args[i + 1]) {
    outputFile = args[++i];
  }
}

// ── Load conversation ─────────────────────────────────────────────────────────

if (!fs.existsSync(inputFile)) {
  console.error(`Error: file not found: ${inputFile}`);
  process.exit(1);
}

let conversation;
try {
  const raw = fs.readFileSync(inputFile, 'utf8');
  const parsed = JSON.parse(raw);
  conversation = Array.isArray(parsed)
    ? parsed
    : (parsed.messages || parsed.conversation || parsed.history || parsed);
} catch (e) {
  console.error(`Error: could not parse ${inputFile} as JSON.\n${e.message}`);
  process.exit(1);
}

console.log(`✓ Loaded conversation — ${conversation.length} turns`);

// ── Extract workspace paths from session_context ──────────────────────────────

function extractWorkspacePaths(conversation) {
  const paths = [];
  for (const msg of conversation) {
    if (msg.role !== 'user') continue;
    for (const part of msg.parts || []) {
      if (typeof part.text !== 'string') continue;
      // Match the Workspace Directories block in session_context
      const workspaceMatches = part.text.matchAll(/^\s*-\s+(.+?)\s*$/gm);
      for (const m of workspaceMatches) {
        const candidate = m[1].trim();
        // Only accept absolute paths
        if (candidate.startsWith('/') || candidate.match(/^[A-Z]:\\/)) {
          paths.push(candidate);
        }
      }
    }
  }
  return [...new Set(paths)];
}

const workspacePaths = extractWorkspacePaths(conversation);

if (workspacePaths.length > 0) {
  console.log(`✓ Found ${workspacePaths.length} workspace path(s):`);
  workspacePaths.forEach(p => console.log(`    ${p}`));
} else {
  console.log('  No workspace paths found in session context — skipping GEMINI.md discovery');
}

// ── Find all GEMINI.md files ──────────────────────────────────────────────────

function findGeminiMdFiles(rootPath) {
  const found = [];
  if (!fs.existsSync(rootPath)) return found;

  function walk(dir, depth) {
    if (depth > 6) return; // don't recurse too deep
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.gemini') continue;
      if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.name === 'GEMINI.md') {
        found.push(fullPath);
      }
    }
  }

  walk(rootPath, 0);
  return found;
}

const geminiMdPaths = [];
for (const wsPath of workspacePaths) {
  const found = findGeminiMdFiles(wsPath);
  geminiMdPaths.push(...found);
}

// Also check for a project-level GEMINI.md next to the input file
const inputDir = path.dirname(path.resolve(inputFile));
const siblingGeminiMd = path.join(inputDir, 'GEMINI.md');
if (fs.existsSync(siblingGeminiMd) && !geminiMdPaths.includes(siblingGeminiMd)) {
  geminiMdPaths.push(siblingGeminiMd);
}

const uniqueGeminiMdPaths = [...new Set(geminiMdPaths)];

// ── Read GEMINI.md contents ───────────────────────────────────────────────────

const geminiFiles = [];
for (const filePath of uniqueGeminiMdPaths) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    geminiFiles.push({ path: filePath, content });
    console.log(`✓ Included ${filePath}`);
  } catch (e) {
    console.warn(`  Could not read ${filePath}: ${e.message}`);
  }
}

if (geminiFiles.length === 0) {
  console.log('  No GEMINI.md files found — bundle will contain conversation only');
}

// ── Build bundle ──────────────────────────────────────────────────────────────

const bundle = {
  type:        'gemini-handoff',
  version:     1,
  exportedAt:  new Date().toISOString(),
  handoffNote: handoffNote || null,
  conversation,
  geminiFiles,
};

// ── Write output ──────────────────────────────────────────────────────────────

if (!outputFile) {
  const base = path.basename(inputFile, path.extname(inputFile));
  outputFile = path.join(path.dirname(inputFile), `${base}.handoff.json`);
}

fs.writeFileSync(outputFile, JSON.stringify(bundle, null, 2), 'utf8');

const sizeKb = (fs.statSync(outputFile).size / 1024).toFixed(1);

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Handoff bundle created
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  File:          ${outputFile}
  Size:          ${sizeKb} KB
  Turns:         ${conversation.length}
  GEMINI.md:     ${geminiFiles.length} file(s)
  Handoff note:  ${handoffNote ? `"${handoffNote.slice(0, 60)}${handoffNote.length > 60 ? '…' : ''}"` : '(none)'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Share ${path.basename(outputFile)} with your colleague.
They can open it in gemini-viewer.html.
`);