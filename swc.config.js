/** @type import('./swc.types').Config */
module.exports = {
  sourceMaps: 'inline',
  module: {
    type: 'commonjs',
    importInterop: 'swc',
    strictMode: true,
  },
  jsc: {
    loose: true,
    externalHelpers: false,
    target: 'es2018',
    parser: {
      syntax: 'typescript',
      tsx: true,
      decorators: false,
      dynamicImport: true,
    },
    keepClassNames: true,
  },
};
