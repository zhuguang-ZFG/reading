# Obsidian MCP Direct Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Node.js MCP server that safely exposes `D:\GIT\reading` as a read/write Obsidian Vault for Codex.

**Architecture:** A small Node.js service under `tools/obsidian-mcp` will use the official MCP SDK over stdio and expose six Vault tools: list, read, write, append, search, and create-note. The server will enforce a single-root path sandbox, default to Markdown-oriented text operations, and keep `.obsidian` effectively protected by treating it as read-only.

**Tech Stack:** Node.js 24, npm, `@modelcontextprotocol/sdk`, built-in `fs/promises`, built-in `path`

---

## File Structure

- Create: `D:\GIT\reading\tools\obsidian-mcp\package.json`
- Create: `D:\GIT\reading\tools\obsidian-mcp\src\server.js`
- Create: `D:\GIT\reading\tools\obsidian-mcp\README.md`
- Create: `D:\GIT\reading\docs\superpowers\plans\2026-05-04-obsidian-mcp-direct-implementation-plan.md`
- Potentially inspect during execution:
  - `D:\GIT\reading\docs\superpowers\specs\2026-05-04-obsidian-mcp-direct-design.md`
  - Codex local MCP config location once discovered

## Task 1: Scaffold the MCP project

**Files:**
- Create: `D:\GIT\reading\tools\obsidian-mcp\package.json`
- Create: `D:\GIT\reading\tools\obsidian-mcp\README.md`

- [ ] **Step 1: Write the initial `package.json`**

```json
{
  "name": "obsidian-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Local MCP server for the D:\\GIT\\reading Obsidian vault",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "check": "node --check src/server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0"
  }
}
```

- [ ] **Step 2: Write the initial `README.md`**

```md
# Obsidian MCP

Local MCP server for the `D:\GIT\reading` Obsidian vault.

## Commands

- `npm install`
- `npm run check`
- `npm start`

## Supported tools

- `vault_list`
- `vault_read`
- `vault_write`
- `vault_append`
- `vault_search`
- `vault_create_note`
```

- [ ] **Step 3: Run install to fetch dependencies**

Run: `npm install`

Workdir: `D:\GIT\reading\tools\obsidian-mcp`

Expected: install completes with `@modelcontextprotocol/sdk` in `node_modules`

- [ ] **Step 4: Verify the scaffolded package is valid**

Run: `npm pkg get name version type scripts dependencies`

Workdir: `D:\GIT\reading\tools\obsidian-mcp`

Expected: JSON output showing `obsidian-mcp`, version `0.1.0`, `type` = `module`, and the `@modelcontextprotocol/sdk` dependency

- [ ] **Step 5: Commit**

```bash
git add tools/obsidian-mcp/package.json tools/obsidian-mcp/README.md
git commit -m "新增 Obsidian MCP 项目骨架"
```

## Task 2: Build path guards and filesystem helpers

**Files:**
- Modify: `D:\GIT\reading\tools\obsidian-mcp\src\server.js`
- Test: `D:\GIT\reading\tools\obsidian-mcp\src\server.js` via `node --check`

- [ ] **Step 1: Write the helper layer with root-path protection**

```js
import { promises as fs } from "node:fs";
import path from "node:path";

const VAULT_ROOT = "D:\\GIT\\reading";
const PROTECTED_PREFIXES = [".git"];
const READ_ONLY_PREFIXES = [".obsidian"];

function normalizeVaultPath(input = "") {
  return input.replaceAll("/", path.sep).replace(/^\\+/, "").replace(/^\.\//, "");
}

function resolveVaultPath(input = "") {
  const relativePath = normalizeVaultPath(input);
  const absolutePath = path.resolve(VAULT_ROOT, relativePath);
  const relativeFromRoot = path.relative(VAULT_ROOT, absolutePath);

  if (
    relativeFromRoot.startsWith("..") ||
    path.isAbsolute(relativeFromRoot)
  ) {
    throw new Error(`Path escapes vault root: ${input}`);
  }

  return {
    absolutePath,
    relativePath: relativeFromRoot === "" ? "" : relativeFromRoot.replaceAll("\\", "/"),
  };
}

function assertAllowedPath(relativePath, mode = "read") {
  const topLevel = relativePath.split("/")[0] ?? "";

  if (PROTECTED_PREFIXES.includes(topLevel)) {
    throw new Error(`Access denied for protected path: ${relativePath}`);
  }

  if (mode !== "read" && READ_ONLY_PREFIXES.includes(topLevel)) {
    throw new Error(`Write denied for read-only path: ${relativePath}`);
  }
}
```

- [ ] **Step 2: Add text-file helpers for read, write, append, mkdir, and stat**

```js
async function readTextFile(vaultPath) {
  const { absolutePath, relativePath } = resolveVaultPath(vaultPath);
  assertAllowedPath(relativePath, "read");
  return fs.readFile(absolutePath, "utf8");
}

async function writeTextFile(vaultPath, content) {
  const { absolutePath, relativePath } = resolveVaultPath(vaultPath);
  assertAllowedPath(relativePath, "write");
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

async function appendTextFile(vaultPath, content) {
  const { absolutePath, relativePath } = resolveVaultPath(vaultPath);
  assertAllowedPath(relativePath, "write");
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.appendFile(absolutePath, content, "utf8");
}
```

- [ ] **Step 3: Run syntax check**

Run: `node --check src/server.js`

Workdir: `D:\GIT\reading\tools\obsidian-mcp`

Expected: no output, exit code `0`

- [ ] **Step 4: Smoke-test path escaping logic with Node inline**

Run: `@' import("./src/server.js").then(() => console.log("loaded")) '@ | node --input-type=module -`

Workdir: `D:\GIT\reading\tools\obsidian-mcp`

Expected: `loaded`

- [ ] **Step 5: Commit**

```bash
git add tools/obsidian-mcp/src/server.js
git commit -m "实现 Vault 路径保护与文件辅助函数"
```

## Task 3: Implement MCP tools and stdio server

**Files:**
- Modify: `D:\GIT\reading\tools\obsidian-mcp\src\server.js`

- [ ] **Step 1: Create the MCP server skeleton**

```js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "obsidian-vault-mcp",
  version: "0.1.0",
});
```

- [ ] **Step 2: Register the `vault_list` and `vault_read` tools**

```js
server.tool(
  "vault_list",
  {
    dir: z.string().optional().default(""),
  },
  async ({ dir }) => {
    const { absolutePath, relativePath } = resolveVaultPath(dir);
    assertAllowedPath(relativePath, "read");
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    const items = entries
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ dir: relativePath, items }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "vault_read",
  {
    path: z.string(),
  },
  async ({ path: vaultPath }) => {
    const content = await readTextFile(vaultPath);
    return {
      content: [{ type: "text", text: content }],
    };
  }
);
```

- [ ] **Step 3: Register the write tools**

```js
server.tool(
  "vault_write",
  {
    path: z.string(),
    content: z.string(),
  },
  async ({ path: vaultPath, content }) => {
    await writeTextFile(vaultPath, content);
    return {
      content: [{ type: "text", text: `Wrote ${vaultPath}` }],
    };
  }
);

server.tool(
  "vault_append",
  {
    path: z.string(),
    content: z.string(),
  },
  async ({ path: vaultPath, content }) => {
    await appendTextFile(vaultPath, content);
    return {
      content: [{ type: "text", text: `Appended ${vaultPath}` }],
    };
  }
);

server.tool(
  "vault_create_note",
  {
    path: z.string(),
    content: z.string().optional().default(""),
  },
  async ({ path: vaultPath, content }) => {
    if (!vaultPath.endsWith(".md")) {
      throw new Error("vault_create_note requires a .md path");
    }
    await writeTextFile(vaultPath, content);
    return {
      content: [{ type: "text", text: `Created ${vaultPath}` }],
    };
  }
);
```

- [ ] **Step 4: Register the search tool and stdio startup**

```js
async function searchVault(query) {
  const results = [];

  async function walk(currentDir = "") {
    const { absolutePath, relativePath } = resolveVaultPath(currentDir);
    assertAllowedPath(relativePath, "read");
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });

    for (const entry of entries) {
      const nextRelative = [relativePath, entry.name].filter(Boolean).join("/");
      if (entry.isDirectory()) {
        if (nextRelative.startsWith(".git")) continue;
        await walk(nextRelative);
        continue;
      }

      if (!entry.name.endsWith(".md")) continue;
      const text = await readTextFile(nextRelative);
      if (nextRelative.includes(query) || text.includes(query)) {
        results.push(nextRelative);
      }
    }
  }

  await walk("");
  return results;
}

server.tool(
  "vault_search",
  {
    query: z.string(),
  },
  async ({ query }) => {
    const matches = await searchVault(query);
    return {
      content: [{ type: "text", text: JSON.stringify(matches, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 5: Run syntax and startup checks**

Run: `npm run check`

Workdir: `D:\GIT\reading\tools\obsidian-mcp`

Expected: no output, exit code `0`

Run: `node src/server.js`

Workdir: `D:\GIT\reading\tools\obsidian-mcp`

Expected: process starts and waits on stdio without crashing

- [ ] **Step 6: Commit**

```bash
git add tools/obsidian-mcp/src/server.js tools/obsidian-mcp/package.json
git commit -m "实现 Obsidian Vault MCP 工具集"
```

## Task 4: Add operator documentation and manual verification steps

**Files:**
- Modify: `D:\GIT\reading\tools\obsidian-mcp\README.md`

- [ ] **Step 1: Expand the README with setup and safety notes**

```md
## Safety rules

- Root is locked to `D:\GIT\reading`
- `.git` is blocked
- `.obsidian` is read-only
- Write operations are intended for Markdown notes

## Manual verification

1. Start the server with `npm start`
2. Verify Codex MCP registration points to `node D:\GIT\reading\tools\obsidian-mcp\src\server.js`
3. Call `vault_list`
4. Call `vault_create_note`
5. Call `vault_append`
6. Call `vault_read`
7. Call `vault_search`
```

- [ ] **Step 2: Run a quick README sanity check**

Run: `Get-Content README.md`

Workdir: `D:\GIT\reading\tools\obsidian-mcp`

Expected: README shows command list, safety rules, and manual verification steps

- [ ] **Step 3: Commit**

```bash
git add tools/obsidian-mcp/README.md
git commit -m "补充 Obsidian MCP 使用说明"
```

## Task 5: Register the server in Codex MCP config and verify end-to-end

**Files:**
- Modify: Codex local MCP config file once discovered
- Create during test: a temporary markdown note inside `D:\GIT\reading`

- [ ] **Step 1: Discover the active Codex MCP config location**

Run: `Get-ChildItem -Force "$env:USERPROFILE\\.codex" -Recurse | Where-Object { $_.Name -match 'mcp|config' }`

Expected: identify the desktop MCP config file or directory used by this machine

- [ ] **Step 2: Add a local server entry pointing at the new Node command**

```json
{
  "mcpServers": {
    "obsidian-reading": {
      "command": "node",
      "args": [
        "D:\\GIT\\reading\\tools\\obsidian-mcp\\src\\server.js"
      ]
    }
  }
}
```

- [ ] **Step 3: Reload or restart the Codex desktop session if needed**

Run: follow the discovered Codex config workflow so the new MCP server is reloaded

Expected: the new MCP server appears in available MCP resources/tools

- [ ] **Step 4: Verify the design acceptance criteria with a temporary note**

Manual MCP checks:

```text
vault_list(dir="")
vault_create_note(path="99_TESTS/obsidian-mcp-smoke.md", content="# smoke\n")
vault_append(path="99_TESTS/obsidian-mcp-smoke.md", content="hello vault\n")
vault_read(path="99_TESTS/obsidian-mcp-smoke.md")
vault_search(query="hello vault")
```

Expected:

- listing returns root items
- note creation succeeds
- append succeeds
- read shows both lines
- search returns `99_TESTS/obsidian-mcp-smoke.md`

- [ ] **Step 5: Verify path-escape rejection**

Manual MCP check:

```text
vault_read(path="../secret.txt")
```

Expected: tool returns an error like `Path escapes vault root`

- [ ] **Step 6: Commit**

```bash
git add tools/obsidian-mcp README.md
git commit -m "接入 Codex MCP 并完成端到端验证"
```

## Self-Review

- Spec coverage check:
  - local Node.js MCP server: covered by Tasks 1 and 3
  - controlled root directory: covered by Task 2
  - common Vault operations: covered by Task 3
  - Codex registration: covered by Task 5
  - startup and verification guidance: covered by Task 4 and Task 5
- Placeholder scan:
  - no `TODO`, `TBD`, or “similar to above” placeholders remain
- Type consistency:
  - all tool names match the approved spec: `vault_list`, `vault_read`, `vault_write`, `vault_append`, `vault_search`, `vault_create_note`
