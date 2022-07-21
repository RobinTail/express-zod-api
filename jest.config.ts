import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  testEnvironment: "node",
  verbose: true,
  forceExit: true,
  collectCoverage: true,
  collectCoverageFrom: ["src/**"],
  coverageReporters: ["json-summary", "text", "html", "lcov"],
  testTimeout: 10000,

  // ts-jest ESM support:
  preset: "ts-jest/presets/default-esm",
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};

export default config;
