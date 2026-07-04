/**
 * Babel v8 changed their engines compatibility in rc5 from 24.0.0 to 24.11.0 with no good reason
 * @todo remove this hack in next major
 */
function readPackage(pkg, ctx) {
  if (!pkg.name) return pkg;
  // Target the specific breaking version of babel types
  if (
    (pkg.name.startsWith("@babel/") && pkg.version.startsWith("8.")) ||
    (pkg.name === "ast-kit" && pkg.version.startsWith("3.")) || // uses babel 8
    pkg.name === "rolldown-plugin-dts" || // uses ast-kit
    pkg.name === "tsdown" // uses rolldown-plugin-dts
  ) {
    pkg.engines = {
      ...pkg.engines,
      node: "^22.18.0 || >=24.0.0", // Force compatibility
    };
    ctx.log(`Patched ${pkg.name}@${pkg.version}.`);
  }
  return pkg;
}

export const hooks = { readPackage };
