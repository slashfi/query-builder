import { type Static, Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';

const ConfigSchema = Type.Object({
  database: Type.Object({
    schema: Type.Optional(
      Type.String({ description: 'The schema to introspect.' })
    ),
    host: Type.String({ description: 'The host to connect to.' }),
    port: Type.Number({ description: 'The port to connect to.' }),
    user: Type.String({ description: 'The user to connect as.' }),
    password: Type.String({
      description: 'The password to use for the connection.',
    }),
    database: Type.String({ description: 'The database to connect to.' }),
    ssl: Type.Optional(
      Type.Union([
        Type.Boolean({ description: 'Whether to use SSL for the connection.' }),
        Type.Object(
          {},
          { additionalProperties: true, description: 'Additional SSL options.' }
        ),
      ])
    ),
    options: Type.Optional(Type.Record(Type.String(), Type.Any())),
  }),
  tsconfig: Type.Optional(
    Type.String({ description: 'The path to the tsconfig.json file.' })
  ),
  patterns: Type.Array(
    Type.String({
      description: 'The patterns to match for tables to introspect.',
    })
  ),
  ignoreTables: Type.Optional(
    Type.Array(Type.String({ description: 'The tables to ignore.' }))
  ),
  migrationsDir: Type.String({
    description: 'The directory to store migrations in.',
  }),
  // Optional features configuration
  features: Type.Optional(
    Type.Object({
      useTransactions: Type.Optional(
        Type.Boolean({
          description:
            'Whether to use database transactions for the migrations.',
        })
      ),
      generateRollback: Type.Optional(
        Type.Boolean({
          description: 'Whether to generate rollback migrations.',
        })
      ),
      debug: Type.Optional(
        Type.Boolean({ description: 'Whether to enable debug mode.' })
      ),
      anthropicMigrationNaming: Type.Optional(
        Type.Object({
          apiKey: Type.String({
            description: 'The API key to use for the Anthropic API.',
          }),
          model: Type.Optional(
            Type.String({ default: 'claude-3-5-haiku-latest' })
          ),
        })
      ),
    })
  ),
  codegen: Type.Optional(
    Type.Object({
      outDir: Type.Optional(
        Type.String({
          default: 'generated',
          description: 'The directory to store generated files in.',
        })
      ),
      moduleAugmentation: Type.Optional(
        Type.Object({
          module: Type.Optional(
            Type.String({
              default: '@slashfi/query-builder',
              description: 'The module to augment.',
            })
          ),
          augmentTableBase: Type.Optional(
            Type.Boolean({
              default: true,
              description: 'Whether to augment TableBase with __indexMetadata.',
            })
          ),
        })
      ),
      fileNames: Type.Optional(
        Type.Object({
          types: Type.Optional(
            Type.String({
              default: 'types.d.ts',
              description: 'The name of the generated types file.',
            })
          ),
          indexMetadata: Type.Optional(
            Type.String({
              default: 'index-metadata.d.ts',
              description: 'The name of the generated index metadata file.',
            })
          ),
        })
      ),
    })
  ),
});

// Create a type from the schema
export type Config = Static<typeof ConfigSchema>;

export function createConfig(config: Config): Config {
  return config;
}

// Compile the schema validator
const ConfigCheck = TypeCompiler.Compile(ConfigSchema);

export async function loadConfig(configPath: string): Promise<Config> {
  // Dynamically import the config file
  const configModule = await import(configPath);
  const config = configModule.default;

  // Validate the configuration
  if (!ConfigCheck.Check(config)) {
    const errors = [...ConfigCheck.Errors(config)];
    throw new Error(
      `Invalid configuration:\n${errors.map((e) => `- ${e.message} at ${e.path}`).join('\n')}`
    );
  }

  return config;
}
