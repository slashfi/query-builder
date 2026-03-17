import { resolve } from 'node:path';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { generateIndexTypes } from './src/ddl/codegen/ast-generator';
import type { BaseDbDiscriminator, TableBase } from './src/Base';
import type { EntityTarget } from './src/EntityTarget';

/**
 * Generates index types for examples before running tests.
 * This runs as a vitest globalSetup so path aliases are resolved.
 */
export async function setup() {
  const examplesDir = resolve(__dirname, 'examples');

  // Find all .schema.ts files in examples/
  const allFiles = await readdir(examplesDir);
  const schemaFiles = allFiles
    .filter((f) => f.endsWith('.schema.ts'))
    .map((f) => resolve(examplesDir, f));

  const schemas: EntityTarget<
    TableBase<BaseDbDiscriminator>,
    BaseDbDiscriminator
  >[] = [];

  for (const file of schemaFiles) {
    try {
      const mod = await import(file);
      for (const key of Object.keys(mod)) {
        const val = mod[key];
        if (val?.Table?.tableName) {
          schemas.push(val);
        }
      }
    } catch {
      // Skip files that can't be loaded
    }
  }

  if (schemas.length) {
    const types = generateIndexTypes(schemas);
    const outDir = resolve(examplesDir, 'generated');
    await mkdir(outDir, { recursive: true });
    await writeFile(resolve(outDir, 'types.ts'), types, 'utf8');
  }
}
