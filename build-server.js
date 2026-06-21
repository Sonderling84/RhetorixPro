const { build } = require('esbuild');

build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'server-compiled.js',
  external: ['vite'],
  define: {
    'import.meta.url': 'undefined',
  },
}).then(() => {
  console.log('[Build] server-compiled.js erstellt');
}).catch((err) => {
  console.error('[Build] Fehler:', err);
  process.exit(1);
});
