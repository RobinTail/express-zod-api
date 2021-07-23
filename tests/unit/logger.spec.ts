import {createLogger, LoggerConfig} from '../../src';
import Transport from 'winston-transport';
import {SPLAT} from 'triple-beam';
import {delay} from '../helpers';

describe('Logger', () => {
  let log: any[] = [];

  const createTransport = (level: string) => {
    return new Transport({
      level,
      log: (info) => log.push(info),
      logv: (info) => log.push(info)
    });
  };

  beforeEach(() => {
    log = [];
  });

  describe('createLogger()', () => {
    test('Should create silent logger', () => {
      const loggerConfig: LoggerConfig = {
        level: 'silent',
        color: false
      };
      const logger = createLogger(loggerConfig);
      expect(logger.silent).toBeTruthy();
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeFalsy();
      expect(logger.isVerboseEnabled()).toBeFalsy();
      expect(logger.isDebugEnabled()).toBeFalsy();
      expect(logger.isSillyEnabled()).toBeFalsy();
    });

    test('Should create warn logger', () => {
      const loggerConfig: LoggerConfig = {
        level: 'warn',
        color: false
      };
      const logger = createLogger(loggerConfig);
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeFalsy();
      expect(logger.isVerboseEnabled()).toBeFalsy();
      expect(logger.isDebugEnabled()).toBeFalsy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.add(createTransport(loggerConfig.level));
      logger.warn('testing warn message', {withMeta: true});
      expect(log).toHaveLength(1);
      expect(log[0]).toHaveProperty('level');
      expect(log[0]).toHaveProperty('message');
      expect(log[0].message).toBe('testing warn message');
      expect(log[0][SPLAT]).toEqual([{withMeta: true}]);
    });

    test('Should create debug logger', () => {
      const loggerConfig: LoggerConfig = {
        level: 'debug',
        color: true
      };
      const logger = createLogger(loggerConfig);
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeTruthy();
      expect(logger.isVerboseEnabled()).toBeTruthy();
      expect(logger.isDebugEnabled()).toBeTruthy();
      expect(logger.isSillyEnabled()).toBeFalsy();
      logger.add(createTransport(loggerConfig.level));
      logger.debug('testing debug message', {withColorful: 'output'});
      expect(log).toHaveLength(1);
      expect(log[0]).toHaveProperty('level');
      expect(log[0]).toHaveProperty('message');
      expect(log[0].message).toBe('testing debug message');
      expect(log[0][SPLAT]).toEqual([{withColorful: 'output'}]);
    });

    test('Should manage profiling', async () => {
      const loggerConfig: LoggerConfig = {
        level: 'debug',
        color: true
      };
      const logger = createLogger(loggerConfig);
      logger.add(createTransport(loggerConfig.level));
      logger.profile('long-test');
      await delay(500);
      logger.profile('long-test');
      expect(log).toHaveLength(1);
      expect(log[0]).toHaveProperty('level');
      expect(log[0]).toHaveProperty('message');
      expect(log[0].message).toBe('long-test');
    });
  });
});
