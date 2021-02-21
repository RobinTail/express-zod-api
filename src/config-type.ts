export interface ConfigType {
  server: {
    listen: number | string;
    cors: boolean;
  },
  logger: {
    level: 'silent' | 'warn' | 'debug';
    color: boolean;
  }
}
