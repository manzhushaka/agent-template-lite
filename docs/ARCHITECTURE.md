# 架构边界

## 三个运行时

### Chat

Chat 是最终用户体验和 AgentOS 的 BFF。它只理解 Agno Run 事件、共享 Tool Result 合同和卡片注册表，不直接连接数据库，也不保存内部 Token。新增业务卡片时先扩展 `packages/shared` 合同，再增加独立渲染组件。

### Console

Console 是控制面和业务 API 所有者。登录、演示数据 CRUD、知识元数据、审计、事务与幂等都在这里完成。AgentOS 使用 `x-internal-token` 调用内部 API，不能直接操作业务表。

### AgentOS

AgentOS 负责真实模型、Session、Trace、Prompt、知识检索和 Tool 编排。只读 Tool 可直接执行；订单、报名、退款、提交工单等有后果的 Tool 必须使用 Agno 原生人工确认。

## 数据所有权

| 数据 | 所有者 | 存储 |
| --- | --- | --- |
| 控制台账号、演示业务、审计 | Console | MySQL |
| 知识元数据和正文 | Console | MySQL |
| 知识向量和切片 | AgentOS | LanceDB |
| Agent Session、Memory、Metrics、Eval | AgentOS | MySQL |
| Chat 访客会话归属与标题 | Console | MySQL |
| 知识版本与索引任务 | Console | MySQL |

## 关键合同

- `ToolResultEnvelope`：Python Tool 与 TypeScript Chat 之间的结构化返回。
- `DemoCard`：Chat 可以渲染的业务卡片联合类型。
- `KnowledgeStore`：LanceDB 与未来 Qdrant 实现的替换边界。
- Console internal API：AgentOS 与业务状态机的唯一写入边界。

## Chat 访客边界

Chat 默认使用服务端签名的 HttpOnly 访客 Cookie，不把访客标识交给浏览器脚本管理。Console 维护访客与 Session 的归属；Chat BFF 在读取历史、发起 Run、继续确认、重命名和删除前都必须校验归属，并将可信 `user_id` 注入 AgentOS 请求。单机版本在 BFF 对模型 Run 做进程内限流；多节点部署时应将同一接口替换为共享限流存储。

## 知识导入与索引

Console 在边界解析 PDF、HTML、Markdown、纯文本或公开网页，保存正文、来源哈希和不可变版本快照。保存请求只创建持久化索引任务；任务执行后全量重建 LanceDB，失败原因写回 MySQL 并允许人工重试。网页导入必须拒绝本机、内网、非 HTTP 协议和超限响应。

## 可观测性

Session、Run、Token、Tool 和 Trace 继续以 AgentOS MySQL 表为事实源。Console 只通过受内部 Token 保护的汇总 API 展示脱敏指标，不复制完整 Prompt、模型响应、访客标识或推理内容。

应用日志与业务审计、Agent 运行指标保持分离。开发和生产启动脚本把 Chat、Console、AgentOS 的标准输出汇总到 `var/logs/app.log`，Console 的登录态 API 仅有界读取文件尾部并在返回浏览器前再次脱敏。日志页面不直连其他运行时、不保存第二份日志数据，也不提供浏览器下载任意服务器文件的能力。

## 不做什么

- 不做多租户、可视化低代码平台或动态加载任意业务插件。
- 不在 AgentOS 复制订单、库存、支付等业务状态机。
- 不在浏览器暴露模型 Key、内部 Token 或数据库连接信息。
- 不提供无真实模型的运行时伪回答模式；Mock 只用于自动化测试。
