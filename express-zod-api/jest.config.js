const base = require("../jest.config.base");

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  collectCoverage: true,
  collectCoverageFrom: ["src/*"],
  coverageReporters: ["json-summary", "text", "html", "lcov"],
};
