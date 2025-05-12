import type { Chalk } from 'chalk';
import path from 'node:path';
import pg from 'pg';
import type { BaseDbDiscriminator } from '../base';
import { generateMigrations } from '../ddl/generate-migrations';
import { loadConfig } from './config';
import { introspectSchema } from './introspect-schema';
import { loadSchemas } from './load-schemas';
import {
  type IntrospectionResult,
  diffSchemas,
  formatDiff,
} from './schema-diff';

export async function introspect<S extends BaseDbDiscriminator>(
  configPath?: string,
  chalk?: Chalk,
  entityFilter?: string[]
): Promise<IntrospectionResult<S>> {
  // If no config path provided, look for qb.config.ts in current directory
  const resolvedConfigPath =
    configPath || path.resolve(process.cwd(), 'qb.config.ts');

  // Load the configuration
  const config = await loadConfig(resolvedConfigPath);

  if (!config) {
    throw new Error(
      `Could not find or load config file at ${resolvedConfigPath}`
    );
  }

  const postgressql = new pg.Client({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ...(config.database.ssl ? { ssl: config.database.ssl } : {}),
  });

  try {
    await postgressql.connect();
    // Load and optionally filter schemas
    const schemas = await (async () => {
      const allSchemas = await loadSchemas<S>(config);

      if (!entityFilter?.length) {
        return allSchemas;
      }

      const filteredSchemas = allSchemas.filter((schema) =>
        entityFilter.includes(schema.Table.tableName)
      );

      if (!filteredSchemas.length) {
        throw new Error('No matching entities found for the provided filter');
      }

      return filteredSchemas;
    })();

    // Introspect database schema
    const dbSchema = await introspectSchema(
      config.database.schema ?? 'public',
      async (query) => {
        return (
          await postgressql.query(query.getQuery(), query.getParameters())
        ).rows;
      },
      schemas
    );

    // Compare schemas and format differences
    const diff = diffSchemas(schemas, dbSchema);
    const diffOutput = formatDiff(diff, chalk);

    // Generate migrations
    const migrations = generateMigrations(diff, schemas);

    // Return all results
    return {
      config,
      schemas,
      dbSchema,
      diff,
      diffOutput,
      migrations,
    };
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    await postgressql.end();
  }
}

// Only run if called directly
if (require.main === module) {
  introspect().catch((error) => {
    console.error('Error during introspection:', error);
    process.exit(1);
  });
}
