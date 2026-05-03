# Obsidian MCP 直连设计

日期：2026-05-04

## 目标

在本机建立一个轻量 MCP 服务，让 Codex 可以直接对 `D:\GIT\reading` 这个 Obsidian Vault 做稳定的文件级读写，而不依赖 Obsidian 界面或第三方云同步。

本阶段只解决“直连可用”，不追求一步做到 Obsidian UI 命令联动。

## 范围

本次实现包含：

- 启动一个本地 Node.js MCP server
- 将 `D:\GIT\reading` 作为受控根目录
- 提供最常用的 Vault 操作
- 将服务注册到当前 Codex 环境可发现的位置
- 提供基础启动说明与验证步骤

本次不包含：

- Obsidian 内部命令调用
- Obsidian 插件开发
- 跨 Vault 支持
- 富文本、Canvas、附件元数据的复杂编辑

## 推荐方案

采用文件级 MCP 服务：

`Codex <-> 本地 MCP Server <-> D:\GIT\reading`

原因：

- 最稳，不依赖 Obsidian 是否开着
- 与当前读书笔记工作流最贴合
- 出问题时容易排查，本质就是本地文件系统和少量接口
- 后续如果需要，可在此基础上叠加 Obsidian 插件桥接

## 能力设计

第一版提供以下能力：

1. `vault_list`
列出指定目录下的文件和子目录，默认从 Vault 根开始。

2. `vault_read`
读取指定 Markdown 文件内容。

3. `vault_write`
覆盖写入指定 Markdown 文件。

4. `vault_append`
向指定 Markdown 文件末尾追加内容。

5. `vault_search`
按文件名或全文关键字搜索。

6. `vault_create_note`
按路径创建新笔记，自动补齐父目录。

## 约束与安全边界

- 服务只允许访问 `D:\GIT\reading`
- 所有路径都必须解析为 Vault 内部路径
- 默认只处理文本文件，优先支持 `.md`
- 禁止访问 `.git`、`.obsidian/workspace.json` 之外的敏感位置以外的系统路径
- 对 `.obsidian` 目录默认只读，避免误写本地工作区配置

说明：

`.obsidian` 中的界面状态与插件文件是本机环境数据，不应该因为读书笔记操作被意外覆盖。第一版里将其作为保护区更稳妥。

## 目录结构建议

建议在仓库下新增：

- `tools/obsidian-mcp/package.json`
- `tools/obsidian-mcp/src/server.js`
- `tools/obsidian-mcp/README.md`

这样做的好处是：

- 与内容型笔记分离
- 便于后续维护、升级和单独运行
- 不污染 Vault 主目录结构

## Codex 接入方式

服务完成后，需要让 Codex 桌面端能发现这个 MCP server。预计会采用本机 MCP 配置方式注册一个本地命令，例如：

- 启动命令指向 `node D:\GIT\reading\tools\obsidian-mcp\src\server.js`

具体配置位置要根据当前 Codex 桌面端 MCP 配置习惯确认，但实现上会优先做成“命令可直接启动”，保证接入层简单。

## 验证标准

完成后至少验证以下场景：

1. 能列出 `D:\GIT\reading` 根目录内容
2. 能读取现有笔记
3. 能新建一篇测试笔记
4. 能向测试笔记追加内容
5. 能搜索到测试笔记中的关键字
6. 路径越界访问被拒绝

## 后续扩展

如果第一版稳定，第二阶段再考虑：

- 调用 Obsidian 命令
- 打开指定笔记
- 使用模板创建读书笔记
- 概念卡/索引页专用写入接口

## 实施顺序

1. 建立 `tools/obsidian-mcp` 项目骨架
2. 实现本地文件操作与路径保护
3. 按 MCP 协议暴露工具
4. 本机运行并做命令行验证
5. 注册到 Codex 的 MCP 配置
6. 在当前线程里实际试读、试写 Vault

## 成功定义

成功不是“代码写出来”，而是：

- Codex 在这个线程中能够直接发现并调用该 MCP 服务
- 能对 `D:\GIT\reading` 内的 Markdown 笔记完成安全读写
- 不会误碰你的 `.obsidian` 本地工作区状态文件
