import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

export const VAULT_ROOT = "D:\\GIT\\reading";
export const PROTECTED_PREFIXES = [".git"];
export const READ_ONLY_PREFIXES = [".obsidian"];

export function normalizeVaultPath(input = "") {
  return input
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
}

export function resolveVaultPath(input = "") {
  const normalizedPath = normalizeVaultPath(input);
  const absolutePath = path.resolve(VAULT_ROOT, normalizedPath);
  const relativeFromRoot = path.relative(VAULT_ROOT, absolutePath);

  if (
    relativeFromRoot.startsWith("..") ||
    path.isAbsolute(relativeFromRoot)
  ) {
    throw new Error(`Path escapes vault root: ${input}`);
  }

  return {
    absolutePath,
    relativePath: relativeFromRoot.replaceAll("\\", "/"),
  };
}

export function isWritablePath(relativePath = "") {
  const normalized = normalizeVaultPath(relativePath);
  const topLevel = normalized.split("/")[0] ?? "";

  if (PROTECTED_PREFIXES.includes(topLevel)) {
    return false;
  }

  if (READ_ONLY_PREFIXES.includes(topLevel)) {
    return false;
  }

  return true;
}

export function assertAllowedPath(relativePath = "", mode = "read") {
  const normalized = normalizeVaultPath(relativePath);
  const topLevel = normalized.split("/")[0] ?? "";

  if (PROTECTED_PREFIXES.includes(topLevel)) {
    throw new Error(`Access denied for protected path: ${relativePath}`);
  }

  if (mode !== "read" && !isWritablePath(normalized)) {
    throw new Error(`Write denied for read-only path: ${relativePath}`);
  }
}

export async function readTextFile(vaultPath) {
  const { absolutePath, relativePath } = resolveVaultPath(vaultPath);
  assertAllowedPath(relativePath, "read");
  return fs.readFile(absolutePath, "utf8");
}

export async function writeTextFile(vaultPath, content) {
  const { absolutePath, relativePath } = resolveVaultPath(vaultPath);
  assertAllowedPath(relativePath, "write");
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

export async function appendTextFile(vaultPath, content) {
  const { absolutePath, relativePath } = resolveVaultPath(vaultPath);
  assertAllowedPath(relativePath, "write");
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.appendFile(absolutePath, content, "utf8");
}

export async function listVaultDirectory(vaultPath = "") {
  const { absolutePath, relativePath } = resolveVaultPath(vaultPath);
  assertAllowedPath(relativePath, "read");
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });

  return entries
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export async function searchMarkdownFiles(query, currentDir = "") {
  const matches = [];
  const entries = await listVaultDirectory(currentDir);

  for (const entry of entries) {
    const nextPath = [normalizeVaultPath(currentDir), entry.name]
      .filter(Boolean)
      .join("/");

    if (entry.type === "directory") {
      if (nextPath.startsWith(".git")) {
        continue;
      }
      matches.push(...(await searchMarkdownFiles(query, nextPath)));
      continue;
    }

    if (!nextPath.endsWith(".md")) {
      continue;
    }

    const text = await readTextFile(nextPath);
    if (nextPath.includes(query) || text.includes(query)) {
      matches.push(nextPath);
    }
  }

  return matches;
}

function ensureMarkdownPath(vaultPath) {
  if (!normalizeVaultPath(vaultPath).endsWith(".md")) {
    throw new Error("Only .md files are supported for note creation");
  }
}

export function createMcpServer() {
  const server = new McpServer({
    name: "obsidian-reading",
    version: "0.1.0",
  });

  server.registerTool(
    "vault_list",
    {
      description: "List files and directories under the Obsidian vault",
      inputSchema: {
        dir: z.string().default(""),
      },
    },
    async ({ dir = "" }) => {
      const items = await listVaultDirectory(dir);
      const { relativePath } = resolveVaultPath(dir);

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

  server.registerTool(
    "vault_read",
    {
      description: "Read a markdown note from the Obsidian vault",
      inputSchema: {
        path: z.string(),
      },
    },
    async ({ path: vaultPath }) => {
      const content = await readTextFile(vaultPath);
      return {
        content: [{ type: "text", text: content }],
      };
    }
  );

  server.registerTool(
    "vault_write",
    {
      description: "Overwrite a markdown note in the Obsidian vault",
      inputSchema: {
        path: z.string(),
        content: z.string(),
      },
    },
    async ({ path: vaultPath, content }) => {
      await writeTextFile(vaultPath, content);
      return {
        content: [{ type: "text", text: `Wrote ${normalizeVaultPath(vaultPath)}` }],
      };
    }
  );

  server.registerTool(
    "vault_append",
    {
      description: "Append text to a markdown note in the Obsidian vault",
      inputSchema: {
        path: z.string(),
        content: z.string(),
      },
    },
    async ({ path: vaultPath, content }) => {
      await appendTextFile(vaultPath, content);
      return {
        content: [{ type: "text", text: `Appended ${normalizeVaultPath(vaultPath)}` }],
      };
    }
  );

  server.registerTool(
    "vault_search",
    {
      description: "Search markdown notes by path or full text",
      inputSchema: {
        query: z.string(),
      },
    },
    async ({ query }) => {
      const matches = await searchMarkdownFiles(query);
      return {
        content: [{ type: "text", text: JSON.stringify(matches, null, 2) }],
      };
    }
  );

  server.registerTool(
    "vault_create_note",
    {
      description: "Create a new markdown note in the Obsidian vault",
      inputSchema: {
        path: z.string(),
        content: z.string().default(""),
      },
    },
    async ({ path: vaultPath, content = "" }) => {
      ensureMarkdownPath(vaultPath);
      await writeTextFile(vaultPath, content);
      return {
        content: [{ type: "text", text: `Created ${normalizeVaultPath(vaultPath)}` }],
      };
    }
  );

  return server;
}

export async function startServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  startServer().catch((error) => {
    console.error("Obsidian MCP server error:", error);
    process.exit(1);
  });
}
