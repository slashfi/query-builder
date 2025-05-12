import type { BaseDbDiscriminator } from '../base';
import type { IntrospectionResult } from '../introspection/schema-diff';
import type { MigrationConstraints } from './types';

/**
 * Extract constraints from introspection result.
 * These constraints represent what needs to be true about the schema
 * for the migration to be safely applied.
 */
export function extractConstraints<S extends BaseDbDiscriminator>(
  result: IntrospectionResult<S>
): MigrationConstraints {
  const constraints: MigrationConstraints = {};

  // For each modified table, extract constraints
  for (const table of result.diff.modifiedTables) {
    constraints[table.name] = {
      must_exist: true,
      columns: {},
      indexes: {},
    };

    // For modified columns, we need to ensure they exist with current types
    for (const column of table.modifiedColumns) {
      const dbType = column.type?.db;
      const dbNullable = column.nullable?.db;
      if (dbType) {
        constraints[table.name].columns[column.name] = {
          type: dbType,
          nullable: dbNullable ?? false,
        };
      }
    }

    // For extra columns that will be dropped, ensure they exist
    for (const column of table.extraColumns) {
      const dbType = column.type?.db;
      const dbNullable = column.nullable?.db;
      if (dbType) {
        constraints[table.name].columns[column.name] = {
          type: dbType,
          nullable: dbNullable ?? false,
        };
      }
    }

    // Get the table's schema from the result
    const tableSchema = result.schemas.find(
      (schema) => schema.Table.tableName === table.name
    )?.Table;

    // Only add index constraints if not in additive mode
    if (tableSchema?.introspection?.indexSyncMode !== 'additive') {
      // For modified indexes, ensure they exist in current form
      for (const index of table.modifiedIndexes) {
        constraints[table.name].indexes[index.name] = {
          must_exist: true,
        };
      }

      // For extra indexes that will be dropped, ensure they exist
      for (const index of table.extraIndexes) {
        constraints[table.name].indexes[index.name] = {
          must_exist: true,
        };
      }
    }

    // If primary key is being modified, ensure current one exists
    const dbPrimaryKey = table.primaryKeyDiff?.db;
    if (dbPrimaryKey) {
      // Add constraint for each primary key column
      for (const column of dbPrimaryKey) {
        constraints[table.name].columns[column] = {
          type: 'unknown', // We don't have type info here
          nullable: false, // PK columns are never nullable
        };
      }
    }
  }

  return constraints;
}
