import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

import {
  VAULT_ROOT,
  normalizeVaultPath,
  resolveVaultPath,
  isWritablePath,
  readTextFile,
  writeTextFile,
  appendTextFile,
  listVaultDirectory,
  searchMarkdownFiles,
} from "../src/server.js";

const TEST_DIR = "99_TESTS/obsidian-mcp-unit";

async function cleanupTestDir() {
  await fs.rm(`${VAULT_ROOT}\\99_TESTS\\obsidian-mcp-unit`, {
    recursive: true,
    force: true,
  });
}

test("normalizeVaultPath removes leading relative markers and normalizes separators", () => {
  assert.equal(
    normalizeVaultPath("./01_INDEX\\test.md"),
    "01_INDEX/test.md"
  );
});

test("resolveVaultPath rejects paths that escape the vault root", () => {
  assert.throws(
    () => resolveVaultPath("../secret.txt"),
    /Path escapes vault root/
  );
});

test("isWritablePath blocks writes into .obsidian", () => {
  assert.equal(isWritablePath(".obsidian/workspace.json"), false);
  assert.equal(isWritablePath("01_INDEX/index.md"), true);
});

test("writeTextFile, appendTextFile, and readTextFile work together for markdown notes", async (t) => {
  await cleanupTestDir();
  t.after(cleanupTestDir);

  const targetPath = `${TEST_DIR}/smoke.md`;

  await writeTextFile(targetPath, "# title\n");
  await appendTextFile(targetPath, "hello vault\n");

  const content = await readTextFile(targetPath);

  assert.equal(content, "# title\nhello vault\n");
});

test("listVaultDirectory returns created markdown files", async (t) => {
  await cleanupTestDir();
  t.after(cleanupTestDir);

  await writeTextFile(`${TEST_DIR}/a.md`, "a\n");
  await writeTextFile(`${TEST_DIR}/b.md`, "b\n");

  const items = await listVaultDirectory(TEST_DIR);

  assert.deepEqual(
    items.map((item) => item.name),
    ["a.md", "b.md"]
  );
});

test("searchMarkdownFiles finds content inside markdown notes", async (t) => {
  await cleanupTestDir();
  t.after(cleanupTestDir);

  await writeTextFile(`${TEST_DIR}/search.md`, "needle phrase\n");
  await writeTextFile(`${TEST_DIR}/other.md`, "haystack\n");

  const matches = await searchMarkdownFiles("needle phrase");

  assert.deepEqual(matches, [`${TEST_DIR}/search.md`]);
});

test("writeTextFile rejects writes into .obsidian", async () => {
  await assert.rejects(
    () => writeTextFile(".obsidian/blocked.md", "nope"),
    /Write denied/
  );
});
