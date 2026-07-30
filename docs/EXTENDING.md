# 扩展业务指南

开始新增业务能力前，可以运行 `pnpm demo:add-feature -- --name <feature> --type query|action`。生成清单的状态默认为 `SCAFFOLDED`，只有合同、Console、AgentOS、Chat、测试和黄金场景全部完成后才能改为 `IMPLEMENTED`。

## 新增一个查询 Tool

1. 在 `apps/console/src/db/schema.ts` 定义业务表，并运行 `pnpm db:generate`。
2. 在 Console `src/lib` 新建业务服务，集中校验与查询规则。
3. 在 `apps/console/src/app/api/internal/agent` 暴露带 `internalAuthorized` 的只读接口。
4. 在 `services/agentos/app/console_client.py` 增加类型清晰的方法。
5. 在 `services/agentos/app/tools.py` 增加 Tool，并返回 `ToolResultEnvelope`。
6. 在 `services/agentos/app/agent.py` 补充何时调用该 Tool 的指令。
7. 覆盖成功、非法参数、空结果和下游失败测试。

## 新增一个有后果的 Tool

在上述步骤之外，必须：

1. 先提供无副作用的准备或试算 Tool。
2. 写 Tool 使用 `@tool(requires_confirmation=True)`。
3. Console 服务实现幂等键、事务和审计。
4. 超时后设计查询状态，不直接盲目重试外部操作。
5. Chat 确认面板展示用户真正需要核对的数据。

## 新增卡片

1. 在 `packages/shared/src/contracts.ts` 增加 Zod 卡片 Schema 并加入 `DemoCardSchema` 联合类型，同时更新 Python Pydantic 合同和共享样例。
2. Python Tool 在 `cards` 中返回该类型，不把结构化数据塞进 Markdown。
3. 在 Chat 新建独立卡片组件并注册到 `components/cards/CardRenderer.tsx`。
4. 验证 1440px、991px 和 390px 视口，确保最长文字和按钮不重叠。

## 新增演示中心 CRUD

简单表格型资源可以仿照 `demoResourceSpecs.products`：定义字段、Zod 校验、Drizzle 服务、Route Handler 和抽屉表单。涉及状态流转、批量动作或跨表事务时，创建独立页面和领域服务，不要把复杂业务塞进资源定义。

## 新增知识来源

Console 的 `knowledge_document` 是事实源。新增来源类型时：

1. 在 `knowledge-import.ts` 的边界校验中增加 MIME、体积和安全规则。
2. 解析为可审计正文，保存来源 URI、SHA-256、文件元数据和不可变版本快照。
3. 创建 `knowledge_index_job`，不要让上传请求或浏览器同步等待 Embedding。
4. 由 `knowledge-worker.ts` 自动消费任务并重建 LanceDB，保留失败原因、崩溃恢复与显式重试路径。
5. 在知识页验证来源、版本、任务状态和切片预览。

不得把仅存在于 LanceDB 的向量当成可审计知识，也不得允许网页导入访问本机或内网地址。

## 扩展可观测指标

AgentOS 的 `observability.py` 只从 Agno Session、Run 和 Trace 读取汇总值。新增指标时优先使用已有结构化字段，不解析自然语言，不向 Console 返回完整 Prompt、响应、Tool 参数或原始访客 ID。Console 页面负责筛选和展示，不建立第二份运行事实表。

## 输出应用日志

Chat 和 Console 使用 Node.js 标准日志方法，AgentOS 使用 Python `logging`。运行时输出统一写入标准输出，由 `pnpm dev` 或 `pnpm start` 汇总到 `var/logs/app.log`，并在 Console 的“在线日志”页面查看。日志消息应包含可定位的动作和稳定业务 ID，不得包含密码、Token、Cookie、数据库连接串、完整模型请求或敏感业务正文。新增级别或运行时时，需要同步日志解析合同、页面筛选项和测试。

## 扩展 Chat 身份

匿名访客由 Chat 签名 Cookie 标识，Session 归属由 Console `chat_session` 保存。接入正式用户体系时，用稳定用户 ID 替换访客 ID，但继续保持以下调用方向：浏览器 -> Chat BFF -> Console 归属校验 -> AgentOS。任何 Session 历史、Run、确认继续、重命名和删除接口都必须校验所有权。

## 注释规范

- TypeScript 对公共合同和非显然事务使用 JSDoc。
- Python 公共类、Tool 和边界方法使用 docstring。
- 用 `EXTENSION:` 标记需要生成项目开发者关注的扩展位置。
- 注释说明为什么、在哪里扩展、必须同步什么，不复述语法。
