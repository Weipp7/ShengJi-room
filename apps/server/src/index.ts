import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const { httpServer, manager } = createApp(config);

httpServer.listen(config.port, () => {
  console.log(`shengji server listening on :${config.port}`);
});

// 定期清理闲置房间
setInterval(() => manager.sweepIdle(config.roomTtlMinutes), 60_000).unref();
