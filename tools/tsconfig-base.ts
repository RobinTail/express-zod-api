export const getTSConfigBase = () => {
  return process.versions.node.split(".").shift();
};
