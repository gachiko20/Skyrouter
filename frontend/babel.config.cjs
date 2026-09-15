// Solo lo usa Jest (Vite no pasa por Babel en dev/build). Se mantiene
// separado con extensión .cjs para no chocar con "type": "module" del
// package.json del frontend.
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};
