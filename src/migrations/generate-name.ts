import type { Config } from '../introspection/config';
import type { SchemaDiff } from '../introspection/schema-diff';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: {
      migration_name: string;
    };
  }>;
  id: string;
  model: string;
  role: 'assistant';
}

interface GenerateMigrationNameOptions {
  diff: SchemaDiff;
  config: Config;
  timestamp: string;
  name?: string;
}

/**
 * Generate a descriptive name for a migration based on schema changes.
 * If name is provided, uses that.
 * Otherwise if Anthropic API is configured, uses it to generate a semantic name.
 * Finally falls back to timestamp-based naming.
 */
export async function generateMigrationName(
  options: GenerateMigrationNameOptions
): Promise<{
  className: string;
  fileName: string;
}> {
  const { diff, config, timestamp, name } = options;

  // If name is provided, use it
  if (name) {
    return {
      className: `${timestamp}${name}`,
      fileName: `${timestamp}-${name}.ts`,
    };
  }

  // If Anthropic naming is not enabled and no name provided, use timestamp
  if (!config.features?.anthropicMigrationNaming) {
    throw new Error(
      'Anthropic naming is not enabled and no name was provided. Please provide a name or enable it in your config.'
    );
  }

  console.log('Generating migration name...');

  const { apiKey, model = 'claude-3-5-haiku-latest' } =
    config.features.anthropicMigrationNaming;

  // Format the schema changes into a clear description
  const changes: string[] = [];

  if (diff.missingTables.length > 0) {
    changes.push(`Adding tables: ${diff.missingTables.join(', ')}`);
  }
  // we skip extra tables because they are not relevant to the migration

  // Describe modifications for each table
  for (const table of diff.modifiedTables) {
    const tableChanges: string[] = [];

    // Column changes
    if (table.missingColumns.length > 0) {
      tableChanges.push(
        `adding columns: ${table.missingColumns
          .map((col) => `${col.name} (${col.type?.schema})`)
          .join(', ')}`
      );
    }
    if (table.extraColumns.length > 0) {
      tableChanges.push(
        `dropping columns: ${table.extraColumns
          .map((col) => col.name)
          .join(', ')}`
      );
    }
    if (table.modifiedColumns.length > 0) {
      tableChanges.push(
        `modifying columns: ${table.modifiedColumns
          .map(
            (col) =>
              `${col.name} (${col.type?.db} -> ${col.type?.schema}${
                col.nullable?.schema !== undefined
                  ? `, nullable: ${col.nullable.schema}`
                  : ''
              })`
          )
          .join(', ')}`
      );
    }

    // Index changes
    if (table.missingIndexes.length > 0) {
      tableChanges.push(
        `adding indexes: ${table.missingIndexes
          .map((idx) => idx.name)
          .join(', ')}`
      );
    }
    if (table.extraIndexes.length > 0) {
      tableChanges.push(
        `dropping indexes: ${table.extraIndexes
          .map((idx) => idx.name)
          .join(', ')}`
      );
    }
    if (table.modifiedIndexes.length > 0) {
      tableChanges.push(
        `modifying indexes: ${table.modifiedIndexes
          .map((idx) => idx.name)
          .join(', ')}`
      );
    }

    // Primary key changes
    if (table.primaryKeyDiff) {
      const oldPk = table.primaryKeyDiff.db?.join(', ') || 'none';
      const newPk = table.primaryKeyDiff.schema?.join(', ') || 'none';
      tableChanges.push(`changing primary key from (${oldPk}) to (${newPk})`);
    }

    if (tableChanges.length > 0) {
      changes.push(`In table ${table.name}: ${tableChanges.join('; ')}`);
    }
  }

  // Create the prompt for Claude
  const prompt = `Given these database schema changes:
${changes.join('\n')}

Generate a brief, descriptive name for this migration in PascalCase format. The name should be concise but meaningful, focusing on the main changes. Use common abbreviations like Add, Remove, Modify, Update, etc. Examples: AddUserEmailColumn, UpdateProductIndexes, ModifyCustomerPrimaryKey.

Name:`;

  // Call Anthropic API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 100,
      messages: [
        { role: 'user', content: prompt },
      ] satisfies AnthropicMessage[],
      tools: [
        {
          name: 'generate_migration_name',
          description:
            'Generate a brief, descriptive name for a database migration',
          input_schema: {
            type: 'object',
            properties: {
              migration_name: {
                type: 'string',
                description:
                  'The migration name in PascalCase format, using common abbreviations like Add, Remove, Modify, Update',
                pattern: '^[A-Z][a-zA-Z0-9]*$',
              },
            },
            required: ['migration_name'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'generate_migration_name' },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to generate migration name using Anthropic API: ${await response.text()}`
    );
  }

  const result = (await response.json()) as AnthropicResponse;
  let generatedName: string;

  const toolUse = result.content.find(
    (c) => c.type === 'tool_use' && c.name === 'generate_migration_name'
  );
  if (toolUse?.input?.migration_name) {
    generatedName = toolUse.input.migration_name;
  } else {
    const textContent = result.content.find((c) => c.type === 'text');
    generatedName = textContent?.text?.trim() ?? '';
    if (!generatedName || !/^[A-Z][a-zA-Z0-9]*$/.test(generatedName)) {
      throw new Error(
        `Generated name did not match PascalCase format: ${generatedName}`
      );
    }
  }

  return {
    className: `${generatedName}${timestamp}`,
    fileName: `${timestamp}-${generatedName}.ts`,
  };
}
