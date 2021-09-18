import type {Config} from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  forceExit: true,
  collectCoverage: true,
  collectCoverageFrom: ['src/**'],
  coverageReporters: ['json-summary', 'text', 'lcov'],
  testTimeout: 10000,
};

export default config;
