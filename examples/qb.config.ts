import type { Config } from '@slashfi/query-builder/introspection/config';

export default {
  database: {
    host: 'localhost',
    port: 26257,
    schema: 'public',
    user: 'root',
    password: '',
    ssl: false,
    database: 'querybuilder',
  },

  patterns: ['./**/*.schema.ts'],
  migrationsDir: 'migrations',

  codegen: {
    outDir: 'generated',
    fileNames: {
      types: 'types.ts',
    },
  },
} satisfies Config;
