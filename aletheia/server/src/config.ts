export interface Config {
  tinyfishApiKey: string | null;
  port: number;
  dataDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    tinyfishApiKey: env["TINYFISH_API_KEY"]?.trim() || null,
    port: Number(env["PORT"] ?? 3000),
    dataDir: env["DATA_DIR"]?.trim() || "./data",
  };
}
