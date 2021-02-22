import {ConfigType, createLogger} from '../src';

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
      expect(logger).toMatchSnapshot();
    });

    test('Should create warn logger', () => {
      const configMock = {
        logger: {
          level: 'warn',
          color: false
        }
      };
      const logger = createLogger(configMock as ConfigType);
      expect(logger).toMatchSnapshot();
    });

    test('Should create debug logger', () => {
      const configMock = {
        logger: {
          level: 'debug',
          color: false
        }
      };
      const logger = createLogger(configMock as ConfigType);
      expect(logger).toMatchSnapshot();
    });
  });

  test('Should create debug logger with colors', () => {
    const configMock = {
      logger: {
        level: 'debug',
        color: true
      }
    };
    const logger = createLogger(configMock as ConfigType);
    expect(logger).toMatchSnapshot();
  });
});
