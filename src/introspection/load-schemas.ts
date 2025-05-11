import path from 'node:path';
import { glob } from 'glob';
import type { BaseDbDiscriminator, TableBase } from '../Base';
import type { EntityTarget } from '../EntityTarget';
import type { Config } from './config';

// Types
type SchemaModule<S extends BaseDbDiscriminator> = {
  default: TableBase<S> | TableBase<S>[];
};

type SchemaError = {
  message: string;
  file?: string;
  error: unknown;
};

const filterIgnoredTables = <S extends BaseDbDiscriminator>(
  tables: EntityTarget<TableBase<S>, S>[],
  ignoredTables: string[]
): EntityTarget<TableBase<S>, S>[] =>
  tables.filter((table) => !ignoredTables.includes(table.Table.tableName));

const normalizeSchemaExport = <S extends BaseDbDiscriminator>(
  schemaExport: EntityTarget<TableBase<S>, S> | EntityTarget<TableBase<S>, S>[]
): EntityTarget<TableBase<S>, S>[] =>
  Array.isArray(schemaExport) ? schemaExport : [schemaExport];

async function importSchema<S extends BaseDbDiscriminator>(file: string) {
  try {
    const module = (await import(path.resolve(file))) as SchemaModule<S>;
    const res = Object.values(module).filter((val) => {
      return typeof val === 'function' && 'Table' in val;
    });
    return normalizeSchemaExport<S>(res);
  } catch (error) {
    throw {
      message: 'Failed to load schema file',
      file,
      error,
    } as SchemaError;
  }
}

// Main loader function
export async function loadSchemas<S extends BaseDbDiscriminator>(
  config: Config
): Promise<EntityTarget<TableBase<S>, S>[]> {
  try {
    // Find schema files
    const patterns = config.patterns;
    const files = patterns.flatMap((pattern) =>
      glob.sync(pattern, { ignore: ['node_modules/**'] })
    );

    // Import all schema files
    const moduleResults = await Promise.all(
      files.map(async (file) => importSchema<S>(file))
    );

    // Combine and filter schemas
    const allTables = moduleResults.flat();
    return filterIgnoredTables<S>(allTables, config.ignoreTables ?? []);
  } catch (error) {
    if ((error as SchemaError).file) {
      throw error;
    }
    throw {
      message: 'Failed to load schemas',
      error,
    } as SchemaError;
  }
}
