export interface ConfigType {
  server: {
    listen: number | string;
  },
  logger: {
    level: 'silent' | 'warn' | 'debug';
    color: boolean;
  }
}
