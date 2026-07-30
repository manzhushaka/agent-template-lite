# Agent Template Lite 开发与协作指南

本文件适用于仓库根目录及全部子目录。参与本项目的开发者和编码 Agent 在修改代码前都应先阅读并遵守本指南；子目录中的 `AGENTS.md` 可以补充更具体的规则，但不得放宽本文件的架构、安全和验证要求。

## 回复约定

- 回答问题前，需要先说问候语：`你好，我是 manzhushaka，正在为您构建 agent-lite 。`
- 问候语后需要加一个卖萌小猫的颜文字，例如：`ฅ^•ﻌ•^ฅ`。
- 如果用户没有指定 superpower，不要擅自使用相关 skill。
- 先确认用户是要求分析、修改还是发布。仅要求分析时保持只读；仅在用户明确要求时提交、推送或发布。
- 不确定的仓库事实必须通过代码、配置或测试确认，不要凭经验猜测。

## 项目定位

Agent Template Lite 是用于构建独立业务 Agent Demo 的脚手架，不是多租户平台。每个基于模板生成的项目都应拥有独立的业务代码、品牌、数据库、Agent 和 Git 历史，并能脱离模板仓库继续演进。

## 目录与职责

- `apps/chat`：面向最终用户的 Next.js Chat 和 AgentOS BFF，负责对话、结构化卡片、会话及人工确认。
- `apps/console`：Next.js 控制台和业务 API 所有者，负责 Drizzle/MySQL、演示中心、知识元数据、认证和审计。
- `packages/shared`：Chat、Console 和 AgentOS 共用的稳定协议类型。禁止放置仅供单个页面使用的临时类型。
- `services/agentos`：Agno AgentOS、真实模型、Tools、Session/Trace 和 LanceDB 知识检索。
- `docs`：架构边界和业务扩展文档。
- `scripts`：安装、启动、停止、状态检查和模板占位符检查脚本。
- `skills/manzhushaka-agent-template-builder`：从业务调研、命名到施工验证的配套 Skill 源码。

## 架构边界

- Console 是控制台和业务状态的所有者，不承载面向最终用户的核心交互流程。演示业务数据通过演示中心 CRUD 维护。
- Chat 不直接连接数据库，不保存 `INTERNAL_API_TOKEN`，也不绕过 AgentOS 执行业务动作。
- AgentOS 通过携带内部 Token 的 Console API 调用业务服务，不直接写 Console 业务表。
- 订单、报名、退款、提交等有后果的 Tool 必须使用 Agno 原生人工确认，并在 Console 服务端实现事务、幂等和审计。
- 模型 API 是运行前置条件，不提供自动切换的伪模型演示模式。Mock 只允许用于自动化测试。
- MySQL 保存业务数据和知识元数据；LanceDB 保存可重建的向量与切片；两者通过稳定文档 ID 和版本关联。
- 新增跨运行时数据时，先定义稳定合同，再实现生产者和消费者。不得用 Markdown 文本替代应当结构化传递的数据。

## 开发流程

1. 阅读本文件及与改动相关的 `docs/ARCHITECTURE.md`、`docs/EXTENDING.md`。
2. 检查当前工作树，识别并保留用户已有的未提交改动。
3. 从最小可验证范围入手，明确数据所有者、调用方向、失败行为和安全边界。
4. 修改稳定合同后，同步更新全部生产者、消费者、测试和文档。
5. 先运行受影响模块的定向测试，再执行仓库级质量检查。
6. 检查最终差异，确保没有密钥、缓存、构建产物和无关格式化变更。

## 编码规范

### 通用规范

- 保持改动聚焦，优先沿用现有模块、命名和抽象，不为单次需求增加无意义的通用层。
- 函数和模块保持单一职责；业务规则放在领域服务中，Route Handler、页面组件和 Tool 只负责边界适配与编排。
- 使用清晰完整的业务名称，避免 `data`、`item`、`temp`、`handle` 等脱离上下文后含义不明的命名。
- 显式处理输入校验、空结果、超时、重复请求和下游失败，不吞异常，不用成功响应掩盖失败。
- 日志不得输出密码、Token、Cookie、数据库连接串、模型请求密钥或完整敏感业务数据。
- 不提交 `.env`、运行日志、缓存、虚拟环境、`.next`、测试产物和本地数据库文件。
- 默认使用 ASCII 标点和英文代码标识符；用户界面文案、业务说明和 `EXTENSION:` 注释可以使用中文。

### TypeScript、Next.js 与 React

- 保持 TypeScript 严格类型；禁止用 `any`、非空断言或无校验的类型断言绕过真实类型问题。
- 外部输入必须在边界处校验；API 请求、表单、环境变量和模型 Tool Result 优先使用项目现有的 Zod/结构化校验方式。
- Server Component 优先；只有浏览器状态、事件或 Web API 确有需要时才使用 `"use client"`。
- 页面和 Route Handler 不直接堆叠业务规则。可复用业务逻辑放入 `src/lib` 或领域服务，数据库访问集中在 Console。
- React 组件保持职责清晰；复杂页面拆分为领域组件，不把页面私有类型放入 `packages/shared`。
- 共享联合类型扩展后必须同步处理所有分支，避免通过宽泛的默认分支静默忽略新类型。
- 保持现有导入风格、ESLint 和格式；不要为了个人偏好批量重排无关文件。

### Python 与 AgentOS

- 遵循 Python 3.11、Ruff 和 100 字符行宽要求；公共类、Tool 及边界方法提供简洁 docstring。
- 函数参数和返回值必须有清晰类型；外部响应先校验再转换为内部结构。
- Tool 保持薄层：参数解释和 Agent 编排属于 AgentOS，业务校验、事务和状态机属于 Console。
- 只读 Tool 可以直接执行；写 Tool 必须使用 `@tool(requires_confirmation=True)`，并携带稳定幂等键。
- 外部动作超时后返回未知状态并提供查询路径，不得自动盲目重试可能已经成功的动作。
- Tool 返回稳定的 `ToolResultEnvelope` 和结构化卡片数据，不把可渲染字段拼进自由文本。

### API、数据库与安全

- Console internal API 必须统一校验 `x-internal-token`；浏览器可访问的代码和响应中不得出现内部 Token。
- 所有写操作必须校验权限和输入。有后果的写操作还必须具备幂等、事务和审计记录。
- 数据库结构通过 Drizzle schema 和迁移文件演进。修改 schema 后运行 `pnpm db:generate` 并审查生成 SQL。
- 金额使用定点数或最小货币单位，禁止使用浮点数；时间字段明确时区，跨服务传输使用稳定格式。
- 迁移应兼容已有数据，破坏性结构变更必须给出迁移、回滚和数据校验方案。
- 知识文档正文、来源、版本和发布状态以 MySQL 为事实源；LanceDB 内容必须可以从 MySQL 重建。

### UI 与可访问性

- 沿用现有设计系统和组件，不在同一页面引入互相冲突的视觉语言。
- 交互元素使用正确的语义标签，支持键盘操作、可见焦点和明确的加载、空、错误、禁用状态。
- 新增卡片至少验证 1440px、991px 和 390px 视口，确保长文本、按钮和动态内容不溢出或重叠。
- 图标按钮提供可访问名称或 tooltip；颜色不能作为表达状态的唯一方式。

## 扩展点注释

新增扩展点时使用 `EXTENSION:` 中文注释，说明改动位置、调用方向和必须同步的合同。注释应解释设计原因和扩展方式，不逐行复述代码。例如：

```ts
// EXTENSION: 新增卡片类型时，同时更新 shared 联合类型、AgentOS 返回结构和 Chat 渲染注册表。
```

## 测试规范

- 修复缺陷时增加能复现问题的回归测试；新功能覆盖正常路径、非法输入、空结果和关键失败路径。
- API 或 Tool 变更应验证鉴权、合同结构、幂等行为和下游失败映射。
- 不依赖真实模型返回做确定性单元测试；模型和外部服务在测试中使用边界 Mock。
- 不通过删除断言、跳过测试或降低类型约束来让检查通过。
- 涉及 UI 的改动除自动化检查外，还要验证目标视口和关键交互。

## 本地使用指南

首次安装：

```bash
./scripts/setup.sh
# 编辑 .env，配置 MySQL、独立随机密钥和真实 MODEL_API_KEY
pnpm db:migrate
pnpm db:seed
pnpm dev
```

开发模式会同时启动 Chat、Console 和 AgentOS。默认访问地址：

- Chat：`http://127.0.0.1:3000`
- Console：`http://127.0.0.1:3001`
- AgentOS 健康检查：`http://127.0.0.1:8000/api/health`

生产方式本地运行：

```bash
pnpm build
pnpm start
pnpm status
pnpm stop
```

## 验证与交付

定向验证通过后，执行完整检查：

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm check:placeholders
pnpm eval
pnpm e2e
git diff --check
```

交付前还要确认：

- `git status --short` 只包含预期文件。
- 新增配置同步到 `.env.example`，但不包含真实秘密。
- 共享合同、数据库迁移、测试和使用文档保持同步。
- 不声称未运行的检查已经通过；若因环境限制无法验证，应明确说明。
- 仅在用户明确要求时执行提交、推送、打标签或发布。
