# ITER-009 Release Hardening

## 功能名称

发布、部署和回滚证据规范化。

## 优先级

P2。

## 当前状态

Backlog。

## 背景

README 说明当前为单实例内存房间状态，Docker 支持基本部署。长期试玩需要明确服务启动、日志、健康检查、回滚、环境变量和已知限制，避免测试环境/生产环境行为不一致。

## 需要解决的问题

- `pnpm dev` 默认 3001/5173，而 review 常用 3101/5174，容易混淆。
- 房间内存状态重启清空，需要更明显提示。
- 回滚文档目前按专题存在于 `docs/game-iteration/rollback.md`，缺少长期规范。
- 没有统一 release checklist。

## 用户可感知收益

试玩和部署入口更稳定；出问题时能快速确认版本、日志和回滚路径。

## 涉及模块 / 文件

- `README.md`
- `Dockerfile`
- `apps/server/src/config.ts`
- `docs/iteration/*`
- 可能新增 `docs/deploy.md` 或 release checklist。

## 实现思路

1. 统一开发/试玩命令说明：默认端口与 review 端口都写清楚。
2. 增加 release checklist：test/typecheck/build/E2E/healthz/rollback。
3. 明确内存房间限制、HTTPS/WSS、CORS、单实例。
4. 为每个 ITER 完成项要求“回滚步骤”小节。

## 验收标准

- README 或 deploy 文档能让用户一次拉起正确服务。
- 有明确健康检查和停服务方式。
- 有 release checklist。
- 每个已完成 ITER 都能指向回滚方式。

## 测试方式

- 文档命令 dry run：`pnpm test`、`pnpm build`、`curl /healthz`。
- Docker 构建如环境允许：`docker build -t shengji .`。

## 风险和回滚方式

- 风险：文档命令与实际 package scripts 漂移。
- 回滚：回退 README/deploy 文档变更，不影响运行代码。

## 依赖

ITER-000。

## 执行记录

未开始。
