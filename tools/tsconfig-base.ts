export const getTSConfigBase = () => {
  const majorVersion = process.versions.node.split(".").shift();
  return majorVersion === "19" ? "18" : majorVersion; // @todo remove when @tsconfig/node19 released
};
