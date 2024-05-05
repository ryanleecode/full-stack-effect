#!/usr/bin/env -S pnpm tsx
import 'zx/globals';
import cpy from 'cpy';
import { glob } from 'glob';
import fs from 'node:fs/promises';

async function updateAndCopyPackageJson() {
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'));

  const entries = await glob('src/**/index.ts');

  pkg.exports = entries.reduce<
    Record<
      string,
      {
        import: {
          types?: string;
          default: string;
        };
        require: {
          types: string;
          default: string;
        };
        default: string;
        types: string;
      }
    >
  >((acc, rawEntry) => {
    const entry = rawEntry.match(/src\/(.*)\.ts/)![1]!;
    const exportsEntry =
      entry === 'index' ? '.' : './' + entry.replace(/\/index$/, '');
    const importEntry = `./dist/${entry}.js`;
    const requireEntry = `./dist/${entry}.cjs`;
    acc[exportsEntry] = {
      import: {
        types: `./dist/${entry}.d.ts`,
        default: importEntry,
      },
      require: {
        types: `./dist/${entry}.d.cts`,
        default: requireEntry,
      },
      types: `./dist/${entry}.d.ts`,
      default: importEntry,
    };
    return acc;
  }, {});

  await fs.writeFile('package.json', JSON.stringify(pkg, null, 2));
}

await fs.rm('dist.new', { recursive: true, force: true });

await Promise.all([
  (async () => {
    await $`tsup`;
  })(),
  (async () => {
    await $`tsc -p tsconfig.dts.json`;
    await cpy('dist-dts/**/*.d.ts', 'dist.new', {
      rename: (basename) => basename.replace(/\.d\.ts$/, '.d.cts'),
    });
    await cpy('dist-dts/**/*.d.ts', 'dist.new', {
      rename: (basename) => basename.replace(/\.d\.ts$/, '.d.ts'),
    });
  })(),
]);

await $`scripts/fix-imports.ts`;

await updateAndCopyPackageJson();
await fs.rm('dist', { recursive: true, force: true });
await fs.rename('dist.new', 'dist');
