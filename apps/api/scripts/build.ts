import pkg from '../package.json';

const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@sports-center/'));

const result = await Bun.build({
  entrypoints: ['src/app.ts'],
  outdir: 'dist',
  target: 'node',
  format: 'esm',
  sourcemap: 'linked',
  external,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
