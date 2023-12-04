/** @type {import('jest').Config} */
module.exports = {
  transform: {
    "^.+\\.ts$": "@swc/jest",
  },
  testEnvironment: "node",
  verbose: true,
  testTimeout: 10000,
};
