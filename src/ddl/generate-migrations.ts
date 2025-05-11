import type { BaseDbDiscriminator, DataTypeBase, TableBase } from '../Base';
import {
  createDataTypeArray,
  createDataTypeBoolean,
  createDataTypeFloat,
  createDataTypeInteger,
  createDataTypeJson,
  createDataTypeTimestamp,
  createDataTypeVarchar,
  makeDataTypeNullable,
} from '../DataType';
import type { EntityTarget } from '../EntityTarget';
import type { SchemaDiff, TableDiff } from '../introspection/schema-diff';
import { formatDiff } from '../introspection/schema-diff';
import type { SqlString } from '../sql-string';
import { sql } from '../sql-string';
import {
  shouldIntrospectColumns,
  shouldIntrospectIndexes,
} from '../table-from-schema-builder';
import { alterTableWithDownMigration } from './table/alter-table';
import { createIndex } from './table/create-index';
import { createTableWithDownMigration } from './table/create-table';
import type {
  AddColumnAction,
  AlterColumnAction,
  AlterPrimaryKeyAction,
  AlterTableAction,
  DropColumnAction,
  PrimaryKeyConstraint,
  TableDefinition,
} from './table/types';

function generateCreateTableStatement<S extends BaseDbDiscriminator>(
  tableName: string,
  schemaTable: TableBase<S>
): TableDefinition {
  return {
    name: tableName,
    schema: schemaTable.schema,
    columns: Object.entries(schemaTable.columnSchema).map(([name, col]) => ({
      name,
      dataType: col.dataType,
      constraints: [],
      default: col.default,
    })),
    constraints: [
      {
        type: 'PRIMARY KEY',
        name: undefined,
        columns: schemaTable.primaryKey,
      } satisfies PrimaryKeyConstraint,
    ],
    ifNotExists: false,
    temporary: undefined,
    onCommit: undefined,
    storageParameters: undefined,
    locality: undefined,
    partition: undefined,
  };
}

function createDataType(
  type: string,
  opts?: { isNullable: boolean; baseType?: string | undefined }
): DataTypeBase {
  // Map database types to our predefined types
  const normalizedType = type.toLowerCase();

  const base = (() => {
    switch (normalizedType) {
      case 'varchar':
      case 'text':
      case 'character varying':
        return createDataTypeVarchar();
      case 'int':
      case 'integer':
      case 'int4':
      case 'bigint':
      case 'int8':
        return createDataTypeInteger();
      case 'float':
      case 'float8':
      case 'double precision':
        return createDataTypeFloat();
      case 'boolean':
      case 'bool':
        return createDataTypeBoolean();
      case 'json':
      case 'jsonb':
        return createDataTypeJson();
      case 'timestamp':
      case 'timestamptz':
      case 'timestamp with time zone':
      case 'timestamp without time zone':
        return createDataTypeTimestamp();
      case 'array': {
        const baseType = opts?.baseType;
        if (!baseType) {
          throw new Error(`Array type ${type} has no base type`);
        }
        return createDataTypeArray(createDataType(baseType, opts));
      }
      default:
        throw new Error(`Unknown data type: ${type}`);
    }
  })();

  if (opts?.isNullable) {
    return makeDataTypeNullable(base);
  }

  return base;
}

function generateAlterTableActions<S extends BaseDbDiscriminator>(
  tableDiff: TableDiff,
  schemaTable: TableBase<S>
): AlterTableAction[][] {
  const actionGroups: AlterTableAction[][] = [];

  // Check if we should enforce or warn about column changes
  const enforceColumns = shouldIntrospectColumns(schemaTable);
  const warnColumns = schemaTable.introspection?.columns === 'warn';

  // Drop extra columns (each in its own group)
  for (const col of tableDiff.extraColumns) {
    if (enforceColumns) {
      const action: DropColumnAction = {
        type: 'DROP COLUMN',
        name: col.name,
        cascade: true,
        previousState: {
          dataType: createDataType(col.type?.db ?? 'unknown', {
            isNullable: col.nullable?.db ?? false,
            baseType: col.baseType?.db,
          }),
          constraints: [],
        },
      };
      actionGroups.push([action]);
    } else if (warnColumns) {
      const diff: SchemaDiff = {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: tableDiff.name,
            missingColumns: [],
            extraColumns: [col],
            modifiedColumns: [],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
          },
        ],
      };
      console.warn(formatDiff(diff));
    }
  }

  // Add missing columns (each in its own group)
  for (const col of tableDiff.missingColumns) {
    if (col.type?.schema) {
      if (enforceColumns) {
        const action: AddColumnAction = {
          type: 'ADD COLUMN',
          name: col.name,
          columnDefinition: {
            name: col.name,
            dataType: createDataType(col.type?.schema, {
              isNullable: col.nullable?.schema ?? false,
              baseType: col.baseType?.schema,
            }),
            constraints: [],
            default: col.default?.schema,
          },
        };
        actionGroups.push([action]);
      } else if (warnColumns) {
        const diff: SchemaDiff = {
          missingTables: [],
          extraTables: [],
          modifiedTables: [
            {
              name: tableDiff.name,
              missingColumns: [col],
              extraColumns: [],
              modifiedColumns: [],
              missingIndexes: [],
              extraIndexes: [],
              modifiedIndexes: [],
            },
          ],
        };
        console.warn(formatDiff(diff));
      }
    }
  }

  // Modify columns (each modification in its own group)
  for (const col of tableDiff.modifiedColumns) {
    // Handle type changes
    if (
      col.type?.schema &&
      col.type.db &&
      col.type.schema.toLowerCase() !== col.type.db.toLowerCase()
    ) {
      if (enforceColumns) {
        const action: AlterColumnAction = {
          type: 'ALTER COLUMN',
          name: col.name,
          alterColumnAction: {
            type: 'SET DATA TYPE',
            value: col.type?.schema,
          },
          previousState: {
            dataType: col.type.db,
            nullable:
              typeof col.nullable?.db === 'boolean' ? col.nullable.db : false,
          },
        };
        actionGroups.push([action]);
      } else if (warnColumns) {
        const diff: SchemaDiff = {
          missingTables: [],
          extraTables: [],
          modifiedTables: [
            {
              name: tableDiff.name,
              missingColumns: [],
              extraColumns: [],
              modifiedColumns: [col],
              missingIndexes: [],
              extraIndexes: [],
              modifiedIndexes: [],
            },
          ],
        };
        console.warn(formatDiff(diff));
      }
    }

    // Handle nullability changes
    if (
      typeof col.nullable?.schema === 'boolean' &&
      col.nullable?.schema !== col.nullable?.db
    ) {
      if (enforceColumns) {
        const action: AlterColumnAction = {
          type: 'ALTER COLUMN',
          name: col.name,
          alterColumnAction: {
            type: col.nullable?.schema ? 'DROP NOT NULL' : 'SET NOT NULL',
            value: undefined,
          },
          previousState: {
            dataType: col.type?.db ?? '',
            nullable:
              typeof col.nullable.db === 'boolean' ? col.nullable.db : false,
          },
        };
        actionGroups.push([action]);
      } else if (warnColumns) {
        const diff: SchemaDiff = {
          missingTables: [],
          extraTables: [],
          modifiedTables: [
            {
              name: tableDiff.name,
              missingColumns: [],
              extraColumns: [],
              modifiedColumns: [col],
              missingIndexes: [],
              extraIndexes: [],
              modifiedIndexes: [],
            },
          ],
        };
        console.warn(formatDiff(diff));
      }
    }
  }

  // Handle primary key changes
  if (tableDiff.primaryKeyDiff) {
    if (tableDiff.primaryKeyDiff.schema) {
      const action: AlterPrimaryKeyAction = {
        type: 'ALTER PRIMARY KEY',
        columns: tableDiff.primaryKeyDiff.schema,
        keepOldPrimaryKey: true, // Use ALTER PRIMARY KEY to keep old PK as secondary index
        previousState: tableDiff.primaryKeyDiff.db
          ? { columns: tableDiff.primaryKeyDiff.db }
          : undefined,
      };
      actionGroups.push([action]);
    }
  }

  return actionGroups;
}

export function generateMigrations<S extends BaseDbDiscriminator>(
  diff: SchemaDiff,
  schemas: EntityTarget<TableBase<S>, S>[]
): { up: SqlString[]; down: SqlString[] } {
  const upStatements: SqlString[] = [];
  const downStatements: SqlString[] = [];

  // Create missing tables
  for (const tableName of diff.missingTables) {
    const schemaTable = schemas.find((s) => s.Table.tableName === tableName);
    if (schemaTable) {
      // Generate CREATE TABLE with down migration
      const { up, down } = createTableWithDownMigration(
        generateCreateTableStatement(tableName, schemaTable.Table)
      );
      upStatements.push(up);
      downStatements.unshift(down);

      // Create any indexes defined in the schema (only in up migration)
      if (schemaTable.Table.indexes) {
        for (const indexDef of Object.values(schemaTable.Table.indexes)) {
          if (shouldIntrospectIndexes(schemaTable.Table)) {
            upStatements.push(createIndex(indexDef));
          } else if (schemaTable.Table.introspection?.indexes === 'warn') {
            const diff: SchemaDiff = {
              missingTables: [],
              extraTables: [],
              modifiedTables: [
                {
                  name: tableName,
                  missingColumns: [],
                  extraColumns: [],
                  modifiedColumns: [],
                  missingIndexes: [indexDef],
                  extraIndexes: [],
                  modifiedIndexes: [],
                },
              ],
            };
            console.warn(formatDiff(diff));
          }
        }
      }
    }
  }

  // Modify existing tables
  for (const tableDiff of diff.modifiedTables) {
    const schemaTable = schemas.find(
      (s) => s.Table.tableName === tableDiff.name
    );
    if (!schemaTable) continue;

    const actionGroups = generateAlterTableActions(
      tableDiff,
      schemaTable.Table
    );

    // Generate separate statements for each action group
    for (const actions of actionGroups) {
      const migrations = alterTableWithDownMigration({
        name: tableDiff.name,
        schema: schemaTable.Table.schema,
        actions,
      });

      // Add all up migrations in order
      upStatements.push(...migrations.map((m) => m.up));

      // Add all down migrations in reverse order
      downStatements.unshift(...migrations.map((m) => m.down).reverse());
    }

    // Create missing indexes and drop extra indexes
    if (
      tableDiff.missingIndexes.length > 0 ||
      tableDiff.extraIndexes.length > 0 ||
      tableDiff.modifiedIndexes.length > 0
    ) {
      if (shouldIntrospectIndexes(schemaTable.Table)) {
        // Add new indexes
        for (const idx of tableDiff.missingIndexes) {
          // Up: Create index
          upStatements.push(createIndex(idx));
          // Down: Drop index
          downStatements.unshift(
            sql`DROP INDEX ${sql.table({
              name: schemaTable.Table.tableName,
              schema: schemaTable.Table.schema,
            })}@${sql.column({
              name: idx.name,
            })}`
          );
        }

        // Drop extra indexes if in full sync mode
        if (schemaTable.Table.introspection?.indexSyncMode !== 'additive') {
          for (const idx of tableDiff.extraIndexes) {
            // Up: Drop index
            upStatements.push(
              sql`DROP INDEX ${sql.table({
                name: schemaTable.Table.tableName,
                schema: schemaTable.Table.schema,
              })}@${sql.table({
                name: idx.name,
              })}`
            );
            // Down: Create index (we don't have full index definition, so can only recreate basic index)
            const expressions = idx.dbExpressions?.join(', ') ?? '';
            downStatements.unshift(
              sql`CREATE${
                idx.dbUnique ? sql` UNIQUE ` : sql``
              } INDEX ${sql.indexName(idx.name)} ON ${sql.table({
                schema: schemaTable.Table.schema,
                name: tableDiff.name,
              })} (${sql([expressions])})`
            );
          }
        }
      } else if (schemaTable.Table.introspection?.indexes === 'warn') {
        const diff: SchemaDiff = {
          missingTables: [],
          extraTables: [],
          modifiedTables: [
            {
              name: tableDiff.name,
              missingColumns: [],
              extraColumns: [],
              modifiedColumns: [],
              missingIndexes: tableDiff.missingIndexes,
              extraIndexes: tableDiff.extraIndexes,
              modifiedIndexes: tableDiff.modifiedIndexes,
            },
          ],
        };
        console.warn(formatDiff(diff));
      }
    }
  }

  return { up: upStatements, down: downStatements };
}
