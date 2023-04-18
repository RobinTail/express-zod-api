import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  transform: {
    "^.+\\.ts$": "@swc/jest",
  },
  testEnvironment: "node",
  verbose: true,
  forceExit: true,
  collectCoverage: true,
  collectCoverageFrom: ["src/**"],
  coverageReporters: ["json-summary", "text", "html", "lcov"],
  testTimeout: 10000,
};

export default config;
