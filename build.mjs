import path from 'node:path';

const useRspack = process.env.RSPACK === '1';
const showApi = process.env.SHOW === '1';
const { default: bundler } = useRspack
  ? await import('@rspack/core')
  : await import('webpack');

class WalkParentsPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('WalkParentsPlugin', (compilation) => {
      compilation.hooks.processAssets.tap('WalkParentsPlugin', () => {
        for (const group of compilation.chunkGroups) {
          const label = group.name ?? '(async)';
          if (showApi) {
            console.log(label, {
              parentsIterable: typeof group.parentsIterable,
              childrenIterable: typeof group.childrenIterable,
              getParents: typeof group.getParents,
            });
            continue;
          }
          const parents = [...group.parentsIterable].map((p) => p.name ?? '(unnamed)');
          console.log(`${label} <- [${parents.join(', ')}]`);
        }
      });
    });
  }
}

const compiler = bundler({
  mode: 'development',
  devtool: false,
  context: import.meta.dirname,
  entry: { main: './src/index.js' },
  output: { path: path.join(import.meta.dirname, 'dist', useRspack ? 'rspack' : 'webpack') },
  plugins: [new WalkParentsPlugin()],
});

compiler.run((err, stats) => {
  if (err) throw err;
  if (stats.hasErrors()) {
    console.error(stats.toString({ all: false, errors: true }));
    process.exitCode = 1;
  }
  compiler.close(() => {});
});
