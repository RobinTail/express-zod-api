interface Config {
  logger: {
    level: 'silent' | 'warn' | 'debug',
    color: boolean
  }
}

export const config: Config = {
  logger: {
    level: 'debug',
    color: true
  }
};
