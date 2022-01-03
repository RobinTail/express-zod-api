export const getTSConfigBase = () => {
  const nodeVersion = process.versions.node.split(".").shift();
  return nodeVersion === "17" ? "16" : nodeVersion; // @todo remove this when @tsconfig/node17 will be released
};
