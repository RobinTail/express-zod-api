import {ConfigType, createLogger} from '../../src';

describe('Logger', () => {
  describe('createLogger()', () => {
    test('Should create silent logger', () => {
      const configMock = {
        logger: {
          level: 'silent',
          color: false
        }
      };
      const logger = createLogger(configMock as ConfigType);
      expect(logger.silent).toBeTruthy();
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeFalsy();
      expect(logger.isVerboseEnabled()).toBeFalsy();
      expect(logger.isDebugEnabled()).toBeFalsy();
      expect(logger.isSillyEnabled()).toBeFalsy();
    });

    test('Should create warn logger', () => {
      const configMock = {
        logger: {
          level: 'warn',
          color: false
        }
      };
      const logger = createLogger(configMock as ConfigType);
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeFalsy();
      expect(logger.isVerboseEnabled()).toBeFalsy();
      expect(logger.isDebugEnabled()).toBeFalsy();
      expect(logger.isSillyEnabled()).toBeFalsy();
    });

    test('Should create debug logger', () => {
      const configMock = {
        logger: {
          level: 'debug',
          color: false
        }
      };
      const logger = createLogger(configMock as ConfigType);
      expect(logger.isErrorEnabled()).toBeTruthy();
      expect(logger.isWarnEnabled()).toBeTruthy();
      expect(logger.isInfoEnabled()).toBeTruthy();
      expect(logger.isVerboseEnabled()).toBeTruthy();
      expect(logger.isDebugEnabled()).toBeTruthy();
      expect(logger.isSillyEnabled()).toBeFalsy();
    });
  });
});
