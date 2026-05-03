# Obsidian MCP

Local MCP server for the `D:\GIT\reading` Obsidian vault.

## Commands

- `npm install`
- `npm run test`
- `npm run check`
- `npm start`

## Supported tools

- `vault_list`
- `vault_read`
- `vault_write`
- `vault_append`
- `vault_search`
- `vault_create_note`

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
