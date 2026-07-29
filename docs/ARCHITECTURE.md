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

## 关键合同

- `ToolResultEnvelope`：Python Tool 与 TypeScript Chat 之间的结构化返回。
- `DemoCard`：Chat 可以渲染的业务卡片联合类型。
- `KnowledgeStore`：LanceDB 与未来 Qdrant 实现的替换边界。
- Console internal API：AgentOS 与业务状态机的唯一写入边界。

## 不做什么

- 不做多租户、可视化低代码平台或动态加载任意业务插件。
- 不在 AgentOS 复制订单、库存、支付等业务状态机。
- 不在浏览器暴露模型 Key、内部 Token 或数据库连接信息。
- 不提供无真实模型的运行时伪回答模式；Mock 只用于自动化测试。
