/**
 * Babel v8 changed their engines compatibility in rc5 from 24.0.0 to 24.11.0 with no good reason
 * Babel usage was removed from tsdown 0.22.4 tree, but its engine restrictions remained
 * @todo remove this hack in next major
 */
function readPackage(pkg, ctx) {
  if (!pkg.name) return pkg;
  if (["rolldown-plugin-dts", "tsdown"].includes(pkg.name)) {
    pkg.engines = {
      ...pkg.engines,
      node: "^22.18.0 || >=24.0.0", // Force compatibility
    };
    ctx.log(`Patched ${pkg.name}@${pkg.version}.`);
  }
  return pkg;
}

export const hooks = { readPackage };
