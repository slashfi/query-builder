import { command, option, positional, run, string } from 'cmd-ts';
import fs from 'node:fs';
import path from 'node:path';
import type { Config } from './swc.types';

run(
  command({
    name: 'build',
    args: {
      output: option({
        long: 'output',
        type: string,
        short: 'o',
        defaultValue: () => '.swcrc',
      }),
      file: positional({ type: string, displayName: 'file' }),
    },
    handler: async ({ output, file }) => {
      const fileData: Config = await import(path.resolve(file)).then(
        (data) => data.default
      );

      fs.writeFileSync(output, JSON.stringify(mergeExtends(fileData), null, 2));
    },
  }),
  process.argv.slice(2)
);

function mergeExtends(config: Config): Config {
  if (!config.extends) {
    return config;
  }

  const { extends: extensions, ...baseConfig } = config;

  const resolvedExtensions = extensions.map((extension) =>
    mergeExtends(extension)
  );

  const base = resolvedExtensions[resolvedExtensions.length - 1];

  const rest = [...resolvedExtensions.slice(0, -1).reverse(), baseConfig];

  const res = rest.reduce((acc, curr) => {
    const jscParser = acc.jsc?.parser || curr.jsc?.parser;
    return {
      ...acc,
      ...curr,
      jsc: {
        ...acc.jsc,
        ...curr.jsc,
        experimental: {
          ...acc.jsc?.experimental,
          ...curr.jsc?.experimental,
          plugins: [
            ...(acc.jsc?.experimental?.plugins ?? []),
            ...(curr.jsc?.experimental?.plugins ?? []),
          ],
        },
        parser: {
          ...acc.jsc?.parser,
          ...curr.jsc?.parser,
        } as NonNullable<typeof jscParser>,
        transform: {
          ...acc.jsc?.transform,
          ...curr.jsc?.transform,
          react: {
            ...acc.jsc?.transform?.react,
            ...curr.jsc?.transform?.react,
          },
        },
      },
    };
  }, base);

  return recursivelyDropEmptyObjects(res) ?? {};
}

function recursivelyDropEmptyObjects(config: Config): Config | undefined {
  if (!Object.keys(config).length) {
    return;
  }
  const res = Object.fromEntries(
    Object.entries(config)
      .map(([key, value]) => {
        if (value === undefined) {
          return;
        }

        if (Array.isArray(value)) {
          if (!value.length) {
            return;
          }
          return [key, value];
        }

        if (typeof value === 'object') {
          const finalValue = recursivelyDropEmptyObjects(value);

          if (finalValue === undefined) {
            return;
          }

          return [key, finalValue];
        }

        return [key, value];
      })
      .filter((x) => !!x)
  );

  if (!Object.keys(res).length) {
    return;
  }

  return res;
}
