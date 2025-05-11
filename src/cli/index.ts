#!/usr/bin/env node

// Register swc-node for fast TypeScript compilation
require('@swc-node/register');

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  array,
  binary,
  command,
  multioption,
  option,
  run,
  string,
  subcommands,
} from 'cmd-ts';
import { generateIndexTypes } from '../ddl/codegen/ast-generator';
import { loadConfig } from '../introspection/config';
import { introspect } from '../introspection/introspect';
import { loadSchemas } from '../introspection/load-schemas';
import { extractConstraints } from '../migrations/extract-constraints';
import { createTypeORMMigrationFormatter } from '../migrations/formatters';
import { generateMigrationName } from '../migrations/generate-name';
import type { MigrationDefinition } from '../migrations/types';

const chalk = require('chalk');

const DEFAULT_CONFIG_PATH = 'qb.config.ts';

interface GenerateOptions {
  config: string;
  name: string;
  filter: string[];
}

const generateCommand = command({
  name: 'generate',
  description: 'Generate schema migrations based on introspection',
  args: {
    config: option({
      type: string,
      long: 'config',
      short: 'c',
      description: 'Path to config file',
      defaultValue: () => DEFAULT_CONFIG_PATH,
    }),
    name: option({
      type: string,
      long: 'name',
      short: 'n',
      description:
        'Migration name (required if Anthropic naming is not enabled)',
      defaultValue: () => '',
    }),
    filter: multioption({
      type: array(string),
      long: 'filter',
      short: 'f',
      description: 'List of entities to include in migration',
      defaultValue: () => [],
    }),
  },
  handler: async (options: GenerateOptions) => {
    try {
      const configPath = resolve(process.cwd(), options.config);
      console.log(chalk.blue('Loading config from:'), configPath);

      console.log('Running introspection...');
      if (options.filter.length) {
        console.log(
          chalk.blue('Filtering entities:'),
          options.filter.join(', ')
        );
      }
      const result = await introspect(configPath, chalk, options.filter);

      if (
        result.diff.modifiedTables.length > 0 ||
        result.diff.missingTables.length > 0
      ) {
        console.log('\nSchema differences found:');
        console.log(result.diffOutput);

        if (result.migrations.up.length > 0) {
          // Generate timestamp in the format YYYYMMDDHHMMSS

          // Extract constraints from introspection result
          const constraints = extractConstraints(result);

          // Validate name requirement
          if (
            !options.name &&
            !result.config.features?.anthropicMigrationNaming
          ) {
            throw new Error(
              'Migration name is required when Anthropic naming is not enabled. Use --name (-n) option.'
            );
          }

          // Generate migration name
          const name = await generateMigrationName({
            diff: result.diff,
            config: result.config,
            timestamp: Date.now().toString(),
            name: options.name,
          });

          // Create migration definition using up and down migrations from result
          const migrationDefinition: MigrationDefinition = {
            name: name.className,
            constraints,
            up: result.migrations.up,
            down: result.migrations.down,
            tables: result.diff.modifiedTables.map((table) => table.name),
          };

          // Format using TypeORM formatter
          const formatter = createTypeORMMigrationFormatter();
          const migrationContent = formatter.format(migrationDefinition);

          // Write migration file to configured directory
          const migrationPath = resolve(
            process.cwd(),
            result.config.migrationsDir,
            name.fileName
          );

          // Ensure migrations directory exists
          await mkdir(result.config.migrationsDir, { recursive: true });

          // Write migration file
          await writeFile(migrationPath, migrationContent, 'utf8');

          console.log(chalk.green('\nGenerated migration:'));
          console.log(chalk.blue('Path:'), migrationPath);
        } else {
          console.log(chalk.green('No migrations needed to be generated.'));
        }
      } else {
        console.log(chalk.green('Up to date, no migrations needed.'));
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red('\nError:'), error.message);
        if (error.stack) {
          console.error('\nStack trace:');
          console.error(error.stack);
        }
      } else {
        console.error(chalk.red('\nUnexpected error:'), error);
      }
      process.exit(1);
    }
  },
});

const codegenCommand = command({
  name: 'codegen',
  description: 'Generate code from schema definitions',
  args: {
    config: option({
      type: string,
      long: 'config',
      short: 'c',
      description: 'Path to config file',
      defaultValue: () => DEFAULT_CONFIG_PATH,
    }),
  },
  handler: async (options: { config: string }) => {
    try {
      const configPath = resolve(process.cwd(), options.config);
      console.log(chalk.blue('Loading config from:'), configPath);

      // Load config and schemas
      const config = await loadConfig(configPath);
      if (!config) {
        throw new Error(`Could not find or load config file at ${configPath}`);
      }

      console.log('Loading schemas...');
      const schemas = await loadSchemas(config);

      // Get codegen config
      const codegenConfig = config.codegen ?? {};
      const outDir = codegenConfig.outDir ?? '.';
      const typesFile = codegenConfig.fileNames?.types ?? 'types.ts';

      // Generate types
      const types = generateIndexTypes(schemas);

      // Ensure output directory exists
      await mkdir(resolve(process.cwd(), outDir), { recursive: true });

      // Write types file
      const outputPath = resolve(process.cwd(), outDir, typesFile);
      await writeFile(outputPath, types, 'utf8');

      console.log(chalk.green('\nGenerated type definitions:'));
      console.log(chalk.blue('Path:'), outputPath);
      console.log(chalk.gray(`Generated types for ${schemas.length} tables`));
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red('\nError:'), error.message);
        if (error.stack) {
          console.error('\nStack trace:');
          console.error(error.stack);
        }
      } else {
        console.error(chalk.red('\nUnexpected error:'), error);
      }
      process.exit(1);
    }
  },
});

const cli = binary(
  subcommands({
    name: 'qb',
    description:
      'Query Builder CLI tool for schema introspection and migration generation',
    version: '1.0.0',
    cmds: {
      generate: generateCommand,
      codegen: codegenCommand,
    },
  })
);

async function main() {
  try {
    await run(cli, process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red('CLI Error:'), error.message);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(chalk.red('Unexpected CLI error:'), error);
    }
    process.exit(1);
  }
}

main();
