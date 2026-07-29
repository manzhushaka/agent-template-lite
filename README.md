# Agent Template Lite

Agent Template Lite 是一个用于构建独立业务 Agent Demo 的 Next.js 全栈 + Agno 脚手架。它提供最终用户 Chat、运营 Console、AgentOS、业务 Tools、人工确认、知识库和审计的完整基线。

它不是多租户平台。每个从模板生成的项目都拥有独立的代码、数据库、品牌、Agent 和 Git 历史，可以脱离模板仓库继续开发和部署。

作者：**manzhushaka** · 个人站：[https://manzhushaka.cn](https://manzhushaka.cn)

## 核心能力

- 面向最终用户的流式 Chat、结构化业务卡片、会话和 Tool 人工确认。
- 面向运营人员的 Console、演示业务数据 CRUD、知识管理和审计。
- 基于 Agno AgentOS 的真实模型调用、Tools、Session、Trace 和知识检索。
- MySQL 业务事实源与 LanceDB 向量索引分离，知识索引可以安全重建。
- 有后果的 Tool 使用 Agno 原生确认，并由 Console 提供事务和幂等保证。
- 配套项目构建 Skill，用于完成业务访谈、命名确认和模板改造。

## 产品预览

### Chat 业务对话

面向最终用户的业务工作台，支持会话管理、结构化业务卡片和有后果操作前的人工确认。

![Agent Template Lite Chat 业务对话](docs/images/chat-home.png)

### Console 管理控制台

面向运营和演示维护人员的控制台，提供验证码登录，集中管理演示数据、知识索引、智能体状态和审计记录。

![Agent Template Lite Console 管理控制台](docs/images/console-login.png)

### H5 移动端

Chat 与 Console 均提供适配移动端的响应式界面，可在手机浏览器中完成业务对话和控制台登录。

| Chat H5 | Console H5 |
| --- | --- |
| <img src="docs/images/chat-h5.png" alt="Agent Template Lite Chat H5 界面" width="360" /> | <img src="docs/images/console-login-h5.png" alt="Agent Template Lite Console H5 登录界面" width="360" /> |

## 运行架构

```text
Browser
  -> Next.js Chat /agent-api BFF
  -> Agno AgentOS /v1 Agent Runs
  -> confirmed Tools
  -> Next.js Console internal API
  -> Drizzle + MySQL

Console knowledge CRUD -> MySQL metadata -> AgentOS reindex -> LanceDB vectors
```

| 服务 | 默认地址 | 职责 |
| --- | --- | --- |
| Chat | `http://127.0.0.1:3000` | 对话、结构化卡片、会话与人工确认 |
| Console | `http://127.0.0.1:3001` | 控制台、演示数据、知识元数据和审计 |
| AgentOS | `http://127.0.0.1:8000` | 真实模型、Agno Session/Trace、Tools 和知识检索 |

## 技术栈

- Node.js 20+、pnpm 10、TypeScript、Next.js
- Python 3.11+、uv、Agno AgentOS
- MySQL 8、Drizzle ORM
- LanceDB、FastEmbed `BAAI/bge-small-zh-v1.5`
- OpenAI-compatible 模型 API

## 项目结构

```text
apps/
  chat/                         最终用户 Chat 和 AgentOS BFF
  console/                      控制台、业务 API、Drizzle/MySQL
packages/
  shared/                       跨运行时稳定协议类型
services/
  agentos/                      Agno Agent、Tools 和 LanceDB 检索
docs/
  ARCHITECTURE.md               架构边界与数据所有权
  EXTENDING.md                  新增 Tool、卡片、CRUD 和知识源指南
scripts/                        安装、运行、状态和模板检查脚本
skills/
  manzhushaka-agent-template-builder/
                                 配套业务项目构建 Skill
```

## 环境要求

开始前请安装：

- Node.js 20 或更高版本
- pnpm 10
- Python 3.11、3.12 或 3.13
- `uv`
- MySQL 8
- 一个可用的 OpenAI-compatible 模型 API

可先检查本机版本：

```bash
node --version
pnpm --version
python3 --version
uv --version
mysql --version
```

## 快速开始

1. 安装 Node.js 和 Python 依赖，并生成本地 `.env`：

```bash
./scripts/setup.sh
```

2. 编辑 `.env`，至少完成以下配置：

```dotenv
MYSQL_URL=mysql://agent_demo:your-password@127.0.0.1:3306/agent_demo
AGENT_DATABASE_URL=mysql+pymysql://agent_demo:your-password@127.0.0.1:3306/agent_demo

AUTH_SECRET=至少32位随机字符串
INTERNAL_API_TOKEN=另一段独立随机字符串
ADMIN_INITIAL_PASSWORD=首次登录使用的强密码

MODEL_NAME=your-model-name
MODEL_BASE_URL=https://your-provider.example/v1
MODEL_API_KEY=your-real-api-key
```

`AUTH_SECRET` 和 `INTERNAL_API_TOKEN` 必须使用不同的随机值。不要把 `.env` 提交到 Git，也不要把真实密钥写回 `.env.example`。

3. 创建 `.env` 中指定的 MySQL 数据库和账号，然后初始化结构与演示数据：

```bash
pnpm db:migrate
pnpm db:seed
```

4. 启动开发环境：

```bash
pnpm dev
```

该命令会同时启动 Chat、Console 和 AgentOS。默认管理员用户名为 `admin`，初始密码来自 `.env` 的 `ADMIN_INITIAL_PASSWORD`；首次登录后应立即修改。

## 日常开发

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 同时启动三个运行时的开发服务 |
| `pnpm test` | 运行 Chat、Console 和 AgentOS 测试 |
| `pnpm typecheck` | 检查 TypeScript 类型 |
| `pnpm lint` | 运行 Next.js ESLint 和 Python Ruff |
| `pnpm build` | 构建 shared、Chat 和 Console |
| `pnpm db:generate` | 根据 Drizzle schema 生成迁移 |
| `pnpm db:migrate` | 执行数据库迁移 |
| `pnpm db:seed` | 写入初始账号和演示数据 |
| `pnpm check:placeholders` | 检查模板业务占位内容 |

数据库 schema 变更后，推荐按以下顺序操作：

```bash
pnpm db:generate
# 审查 apps/console/drizzle 中新生成的 SQL
pnpm db:migrate
pnpm test
```

## 后台运行

完成环境配置和数据库初始化后，可以使用项目脚本以后台方式运行：

```bash
pnpm build
pnpm start
pnpm status
```

日志默认写入 `var/logs/app.log`：

```bash
tail -f var/logs/app.log
```

停止服务：

```bash
pnpm stop
```

`pnpm start` 会检查必要环境变量、构建产物以及三个服务的健康状态。端口可以通过 `.env` 中的 `CHAT_PORT`、`CONSOLE_PORT` 和 `AGENTOS_PORT` 调整。

## 示例业务闭环

1. 用户在 Chat 描述需求。
2. Agent 调用 `search_products` 查询 MySQL 中的在售数据。
3. Chat 根据共享 Tool Result 合同展示商品卡片。
4. 用户选择商品后，Agent 调用 `prepare_order` 生成十分钟报价。
5. Agent 调用受 `requires_confirmation=True` 保护的 `confirm_order` 并暂停。
6. 用户在 Chat 确认后，AgentOS 继续 Run，Console 在事务内锁定库存并幂等创建订单。

这只是用于证明完整链路的中性样例，不应原样保留到生成项目。业务范围确认后，由 `manzhushaka-agent-template-builder` Skill 替换领域、品牌、数据表、Tools、卡片和 Console 演示资源。

## 知识库

- MySQL 是文档正文、来源、发布状态、版本和索引状态的事实源。
- LanceDB 保存从已发布文档重建的向量和切片，可以安全删除并重新生成。
- FastEmbed 默认使用 `BAAI/bge-small-zh-v1.5`，无需额外 Embedding API。
- 新增 PDF、网页或其他知识来源时，应先把可审计正文和来源写入 MySQL，再触发向量重建。

## 扩展业务

扩展业务前先阅读：

- [架构边界](docs/ARCHITECTURE.md)
- [扩展业务指南](docs/EXTENDING.md)
- [开发与协作指南](AGENTS.md)

常见扩展顺序为：

1. 在 `packages/shared` 定义跨运行时稳定合同。
2. 在 Console 定义 Drizzle schema、领域服务和 internal API。
3. 在 AgentOS 增加 Console client、Tool 和 Agent 指令。
4. 在 Chat 注册结构化卡片渲染器。
5. 补齐正常路径、非法输入、空结果、鉴权、幂等和下游失败测试。

源码中的 `EXTENSION:` 注释标记了模板项目常用的扩展位置，可以使用以下命令定位：

```bash
rg -n "EXTENSION:" apps packages services
```

## 验证

提交改动前运行完整检查：

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm check:placeholders
git diff --check
```

涉及界面时还应验证 1440px、991px 和 390px 视口，确认长文本、按钮、加载状态和错误状态不会溢出或重叠。

## 常见问题

### `pnpm dev` 启动后模型请求失败

确认 `.env` 中的 `MODEL_NAME`、`MODEL_BASE_URL` 和 `MODEL_API_KEY` 均为真实可用值。本项目不提供运行时伪模型回退。

### Chat 能打开，但业务 Tool 调用失败

依次检查 Console 的 `/api/health`、AgentOS 的 `/api/health`，并确认 Chat、Console 和 AgentOS 使用相同的 `INTERNAL_API_TOKEN` 配置来源。

### 数据库连接失败

确认 MySQL 已启动、数据库和账号已创建，并检查 `MYSQL_URL` 与 `AGENT_DATABASE_URL` 指向同一个数据库。前者供 TypeScript/Drizzle 使用，后者供 Python/AgentOS 使用。

### 修改知识后检索不到新内容

先确认文档已发布且 MySQL 中索引状态正确，再触发 AgentOS 重建。LanceDB 是可重建索引，不是知识正文的事实源。

## 配套 Skill

Skill 源码位于 `skills/manzhushaka-agent-template-builder/`，随模板仓库交付，不需要安装到全局 Skill 目录。它会从模板创建独立项目，完成业务访谈、同类产品研究、能力建议和中英文命名确认，再开始业务改造。

Skill 不会在业务范围和名称确认前修改业务代码，也不会自动添加远程仓库或推送代码。只有用户明确要求时，才执行提交、推送、打标签或发布。
