import { createApp } from './app';
import { cancelBots } from './botRunner';
import { loadConfig } from './config';
import { botDelayFromEnv, seededRngFromEnv } from './testHooks';

const config = loadConfig();
const { httpServer, manager, detachRoomSockets } = createApp(config, {
  botDelayMs: botDelayFromEnv(),
  rng: seededRngFromEnv(),
});

httpServer.listen(config.port, () => {
  console.log(`shengji server listening on :${config.port}`);
});

// 定期清理闲置房间：取消机器人定时器，并让残留连接退出频道（房间码可能复用）
setInterval(() => {
  for (const code of manager.sweepIdle(config.roomTtlMinutes)) {
    cancelBots(code);
    detachRoomSockets(code);
  }
}, 60_000).unref();
