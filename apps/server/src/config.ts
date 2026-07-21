export type ServerConfig = {
  port: number;
  roomTtlMinutes: number;
  corsOrigin: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3001),
    roomTtlMinutes: Number(env.ROOM_TTL_MINUTES ?? 60),
    corsOrigin: env.CORS_ORIGIN ?? '*',
  };
}
