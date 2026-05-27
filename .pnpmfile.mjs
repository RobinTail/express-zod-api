/**
 * Babel v8 changed their engines compatibility in rc5 from 24.0.0 to 24.11.0 with no good reason
 * @todo remove this hack in next major
 */
function readPackage(pkg, ctx) {
  // Target the specific breaking version of babel types
  if (
    pkg.name &&
    pkg.name.startsWith("@babel/") &&
    pkg.version.startsWith("8.0.0")
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
