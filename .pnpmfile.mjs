/**
 * Babel v8 changed their engines in rc5 from 24.0.0 to 24.11.0
 * @todo remove this hack in next major
 */
export function readPackage(pkg, context) {
  // Target the specific breaking version of babel types
  if (pkg.name === "@babel/types" && pkg.version.startsWith("8.0.0")) {
    pkg.engines = {
      ...pkg.engines,
      node: ">=24.0.0", // Force compatibility
    };
    context.log(`Patched ${pkg.name}@${pkg.version}.`);
  }
  return pkg;
}

export const hooks = { readPackage };
