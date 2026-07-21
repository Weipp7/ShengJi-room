# 升级（Shengji）在线对战

四人两副牌「升级」（打百分/拖拉机）在线游戏 MVP：房主创建房间生成房间码邀请好友，昵称即玩、可选房间密码，人数不足可用机器人补位。

## 技术栈

- **Monorepo**：pnpm workspace（`apps/web`、`apps/server`、`packages/{shared,game,bot}`）
- **前端**：React 18 + Vite + TypeScript
- **后端**：Node.js + Express + Socket.IO（内存房间状态，无数据库）
- **测试**：vitest

## 本地开发

```bash
pnpm install      # 安装依赖
pnpm dev          # 同时启动 server (:3001) 和 web (:5173)
pnpm test         # 全量单元/集成测试
pnpm typecheck    # 全 workspace 类型检查
pnpm build        # 生产构建（web 静态产物 + server 单文件 bundle）
```

开发时浏览器访问 `http://localhost:5173`，web 通过 `VITE_SERVER_URL`（默认同源，dev 下由 vite 代理外的 socket.ts 显式指向 `:3001`）连接服务端。

## 环境变量（server）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | HTTP/WebSocket 监听端口 |
| `CORS_ORIGIN` | `*` | Socket.IO 允许的跨域来源；生产同源部署可收紧 |
| `ROOM_TTL_MINUTES` | `60` | 闲置房间回收时间（分钟） |

web 构建期变量：`VITE_SERVER_URL`（可选，缺省时与页面同源连接，适配单容器部署）。

## Docker 部署

单容器同时提供静态页面与 WebSocket 服务：

```bash
pnpm build                       # 或直接交给 docker 多阶段构建
docker build -t shengji .
docker run --rm -p 3001:3001 shengji
```

浏览器访问 `http://localhost:3001` 即可创建房间开局；健康检查：`curl localhost:3001/healthz` → `{"ok":true}`。

也可不经 Docker 直接运行生产产物：

```bash
pnpm build
NODE_ENV=production node apps/server/dist/index.js
```

## 游戏规则要点

- 4 人固定两队（0/2 对 1/3），两副牌 108 张，每人 25 张、底牌 8 张
- 亮主叫主（支持无主叫法按强度覆盖）、庄家埋 8 张底牌
- 出牌支持单张 / 对子 / 拖拉机，强制跟牌校验（跟花色、有对跟对、有拖拉机跟拖拉机）
- 闲家抓分 ≥80 上台；末墩闲家赢时扣底 `2^(每人出牌张数)` 倍
- 级牌打过 A 循环回 2；庄家队内轮转

## 第一版限制

- 房间状态保存在内存中，**服务重启后所有房间清空**
- 无账号体系：玩家身份由浏览器 `localStorage` 中的 playerId 标识，换设备/清缓存视为新玩家
- 单实例部署（内存状态不支持水平扩展）
