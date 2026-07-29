# 扩展业务指南

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

1. 在 `packages/shared/src/index.ts` 增加卡片接口并加入 `DemoCard` 联合类型。
2. Python Tool 在 `cards` 中返回该类型，不把结构化数据塞进 Markdown。
3. 在 Chat 新建独立卡片组件并注册渲染器。
4. 验证 1440px、991px 和 390px 视口，确保最长文字和按钮不重叠。

## 新增演示中心 CRUD

简单表格型资源可以仿照 `demoResourceSpecs.products`：定义字段、Zod 校验、Drizzle 服务、Route Handler 和抽屉表单。涉及状态流转、批量动作或跨表事务时，创建独立页面和领域服务，不要把复杂业务塞进资源定义。

## 新增知识来源

Console 的 `knowledge_document` 是事实源。导入 PDF、网页或其他文件时，先解析成正文并记录来源、版本和发布状态，再调用 AgentOS 重建 LanceDB。不要把仅存在于 LanceDB 的向量当成可审计知识。

## 注释规范

- TypeScript 对公共合同和非显然事务使用 JSDoc。
- Python 公共类、Tool 和边界方法使用 docstring。
- 用 `EXTENSION:` 标记需要生成项目开发者关注的扩展位置。
- 注释说明为什么、在哪里扩展、必须同步什么，不复述语法。
