import {createLogger, LoggerConfig} from '../../src';

describe('Logger', () => {
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
    });

    test('Should create debug logger', () => {
      const loggerConfig: LoggerConfig = {
        level: 'debug',
        color: false
      };
      const logger = createLogger(loggerConfig);
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeTruthy();
      expect(logger.isVerboseEnabled()).toBeTruthy();
      expect(logger.isDebugEnabled()).toBeTruthy();
      expect(logger.isSillyEnabled()).toBeFalsy();
    });
  });
});
