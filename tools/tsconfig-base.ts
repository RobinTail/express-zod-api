export const getTSConfigBase = () => {
  const nodeVersion = process.versions.node.split(".").shift();
  return nodeVersion === "17" ? "16" : nodeVersion;
};
