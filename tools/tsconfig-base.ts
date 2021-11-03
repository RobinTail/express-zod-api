export const getTSConfigBase = () => {
  const nodeVersion = process.versions.node.split(".").shift();
  return nodeVersion === "15" ? "14" : nodeVersion;
};
