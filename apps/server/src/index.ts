import { createApp } from './app';
import { cancelBots } from './botRunner';
import { loadConfig } from './config';

const config = loadConfig();
const { httpServer, manager } = createApp(config);

httpServer.listen(config.port, () => {
  console.log(`shengji server listening on :${config.port}`);
});

// 定期清理闲置房间，并同步取消其机器人定时器
setInterval(() => {
  for (const code of manager.sweepIdle(config.roomTtlMinutes)) cancelBots(code);
}, 60_000).unref();
