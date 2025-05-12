import type { Chalk } from 'chalk';
import type {
  BaseDbDiscriminator,
  DataTypeBase,
  TableBase,
  TableColumnBase,
} from '../base';
import {
  type DataTypeArray,
  createDataTypeArray,
  createDataTypeBoolean,
  createDataTypeFloat,
  createDataTypeInteger,
  createDataTypeJson,
  createDataTypeTimestamp,
  createDataTypeVarchar,
  getNonNullableDataType,
  isDataTypeNullable,
} from '../data-type';
import type { DdlIndexDefinition } from '../ddl/table';
import type { EntityTarget } from '../entity-target';
import { type SqlString, sql } from '../sql-string';
import { injectParameters } from '../sql-string/helpers';
import type { TableIntrospectOptions } from '../table-from-schema-builder';
import type { Config } from './config';
import {
  type FastColumn,
  type FastIndex,
  type FastSchema,
  type FastTable,
  parseCreateTableStatement,
} from './introspect-schema';

interface ConvertDbTypeOptions {
  isNullable: boolean;
  defaultValue?: string | undefined;
  baseType?: string | undefined;
}

// Convert database type to our internal DataType
export function convertDbTypeToDataType(
  dbType: string,
  options: ConvertDbTypeOptions
): DataTypeBase {
  // Normalize the type name to lowercase for comparison
  const normalizedType = dbType.toLowerCase();

  // Convert database types to our internal DataTypes
  const baseType = (() => {
    switch (normalizedType) {
      case 'character varying':
      case 'varchar':
      case 'text':
        return createDataTypeVarchar({ isNullable: options.isNullable });

      case 'boolean':
        return createDataTypeBoolean({ isNullable: options.isNullable });

      case 'int':
      case 'integer':
      case 'bigint':
      case 'smallint':
        return createDataTypeInteger({ isNullable: options.isNullable });

      case 'float':
      case 'double precision':
        return createDataTypeFloat({ isNullable: options.isNullable });

      case 'timestamp':
      case 'timestamp without time zone':
        return createDataTypeTimestamp({ isNullable: options.isNullable });

      case 'json':
      case 'jsonb':
        return createDataTypeJson({ isNullable: options.isNullable });

      case 'array': {
        const baseType = options.baseType;
        if (!baseType) {
          throw new Error(`Array type ${normalizedType} has no base type`);
        }
        return createDataTypeArray(
          convertDbTypeToDataType(baseType, { isNullable: false }),
          { isNullable: options.isNullable }
        );
      }

      default:
        throw new Error(`Unknown data type: ${normalizedType}`);
    }
  })();

  return baseType;
}

export interface DiffOptions {
  /**
   * Controls how index modifications are handled
   */
  indexModifications?: {
    /**
     * If true, allows modifications to existing indexes instead of throwing errors.
     * By default, modifications to existing indexes will throw errors to enforce
     * creating new indexes and dropping old ones.
     */
    allowModifications?: boolean;
  };
}

export interface ColumnDiff {
  name: string;
  type?: {
    schema?: string;
    db?: string;
  };
  nullable?: {
    schema?: boolean;
    db?: boolean;
  };
  baseType?: {
    schema?: string;
    db?: string;
  };
  default?:
    | {
        schema?: SqlString | undefined;
        db?: SqlString | undefined;
      }
    | undefined;
}

export interface IndexDiff {
  name: string;
  schemaExpressions?: string[];
  dbExpressions?: string[];
  schemaUnique?: boolean;
  dbUnique?: boolean;
}

export interface TableDiff {
  name: string;
  missingColumns: ColumnDiff[];
  extraColumns: ColumnDiff[];
  modifiedColumns: ColumnDiff[];
  missingIndexes: DdlIndexDefinition[];
  extraIndexes: IndexDiff[];
  modifiedIndexes: IndexDiff[];
  primaryKeyDiff?: {
    schema?: string[];
    db?: string[];
  };
}

export interface SchemaDiff {
  missingTables: string[];
  extraTables: string[];
  modifiedTables: TableDiff[];
}

function compareDataTypes(
  schemaDataType: DataTypeBase,
  dbDataType: DataTypeBase
): Pick<ColumnDiff, 'type' | 'nullable'> | undefined {
  const schemaNullable = isDataTypeNullable(schemaDataType);
  const dbNullable = isDataTypeNullable(dbDataType);
  const schemaType = getNonNullableDataType(schemaDataType);
  const dbType = getNonNullableDataType(dbDataType);

  if (schemaType.type !== dbType.type || schemaNullable !== dbNullable) {
    return {
      ...(schemaType.type !== dbType.type && {
        type: {
          schema: schemaType.type,
          db: dbType.type,
        },
      }),
      ...(schemaNullable !== dbNullable && {
        nullable: {
          schema: schemaNullable,
          db: dbNullable,
        },
      }),
    };
  }
}

export interface IntrospectionResult<S extends BaseDbDiscriminator> {
  config: Config;
  schemas: EntityTarget<TableBase<S>, S>[];
  dbSchema: FastSchema;
  diff: SchemaDiff;
  diffOutput: string;
  migrations: {
    up: SqlString[];
    down: SqlString[];
  };
}

function compareColumns(
  schemaColumn: TableColumnBase,
  dbColumn: FastColumn
): ColumnDiff | undefined {
  // Convert database type to our internal DataType
  const dbDataType = convertDbTypeToDataType(dbColumn.type, {
    isNullable: dbColumn.nullable,
    defaultValue: dbColumn.defaultValue ?? undefined,
    baseType: (() => {
      if (!dbColumn.udt) {
        return undefined;
      }

      // CockroachDb UDTs are prefixed with an underscore
      // UDT for varchar[] is "_varchar"
      return dbColumn.udt.startsWith('_')
        ? dbColumn.udt.slice(1)
        : dbColumn.udt;
    })(),
  });

  // Check if we're dealing with array types
  const schemaType = getNonNullableDataType(schemaColumn.dataType);
  const dbType = getNonNullableDataType(dbDataType);
  const isSchemaArray = schemaType.type.toUpperCase() === 'ARRAY';
  const isDbArray = dbType.type.toUpperCase() === 'ARRAY';

  // Get baseType for arrays
  const schemaBaseType = isSchemaArray
    ? (schemaType as DataTypeArray).primitiveDataType.type
    : undefined;
  const dbBaseType =
    dbColumn.udt && isDbArray
      ? dbColumn.udt.startsWith('_')
        ? dbColumn.udt.slice(1)
        : dbColumn.udt
      : undefined;

  // Compare types and nullability
  const typeDifferences = compareDataTypes(schemaColumn.dataType, dbDataType);

  // Compare default values
  const defaultDifference =
    (schemaColumn.default !== undefined || dbColumn.defaultValue !== null) &&
    (!schemaColumn.default ||
      !dbColumn.defaultValue ||
      schemaColumn.default.getQuery() !== dbColumn.defaultValue)
      ? {
          default: {
            schema: schemaColumn.default,
            db: dbColumn.defaultValue
              ? sql([dbColumn.defaultValue])
              : undefined,
          },
        }
      : undefined;

  // Add baseType difference for array types
  const baseTypeDifference =
    (isSchemaArray || isDbArray) && schemaBaseType !== dbBaseType
      ? {
          baseType: {
            ...(schemaBaseType && { schema: schemaBaseType }),
            ...(dbBaseType && { db: dbBaseType }),
          },
        }
      : undefined;

  if (typeDifferences || defaultDifference || baseTypeDifference) {
    return {
      name: schemaColumn.columnName,
      ...typeDifferences,
      ...defaultDifference,
      ...baseTypeDifference,
    };
  }
}

function shouldIgnoreColumn(
  columnName: string,
  options: TableIntrospectOptions | undefined
): boolean {
  if (!options) {
    return true;
  }

  if (!options.columns) {
    return true;
  }

  if (options.columns === 'ignore') {
    return true;
  }

  if (!options?.ignoreColumns?.length) {
    return false;
  }
  return options.ignoreColumns.some((pattern) => pattern.test(columnName));
}

function getIndexExpressions(index: DdlIndexDefinition): string[] {
  return index.expressions
    .map((expr) => {
      const res = expr.getQuery();
      // below is a cockroach specific hack to handle index expressions that are just column names that are all lowercase
      // SHOW CREATE TABLE in cockroach drops the quotes around column names that are all lowercase AND if it is not a keyword (timestamp)
      // For now, we can continue updating the keywords list as needed.

      const trimmed = res.trim();
      const isSingleColumnExpression = trimmed.split(' ').length === 1;

      if (
        isSingleColumnExpression &&
        trimmed.startsWith('"') &&
        trimmed.endsWith('"')
      ) {
        const columnPart = trimmed.slice(1, -1);

        const keywords = ['timestamp', 'interval', 'time'];

        if (
          columnPart.toLowerCase() === columnPart &&
          !keywords.includes(columnPart)
        ) {
          return columnPart;
        }
      }

      return res;
    })
    .filter((expr): expr is string => typeof expr === 'string');
}

function shouldIgnoreIndex(
  indexName: string,
  options: TableIntrospectOptions | undefined
): boolean {
  if (!options) {
    return true;
  }
  if (options.indexes === 'ignore') {
    return true;
  }
  if (!options?.ignoreIndexes?.length) {
    return false;
  }
  return options.ignoreIndexes.some((pattern) => pattern.test(indexName));
}

function compareIndexes(
  schemaIndex: DdlIndexDefinition,
  dbIndex: FastIndex,
  createTableIndexes?: FastIndex[],
  options: DiffOptions = {}
): IndexDiff | null {
  const differences: Partial<IndexDiff> = {
    name: dbIndex.name,
  };

  let hasDiff = false;

  const schemaExpressions = getIndexExpressions(schemaIndex);

  // First try to find matching index in CREATE TABLE statement
  const createTableIndex = createTableIndexes?.find(
    (idx: FastIndex) => idx.name === dbIndex.name
  );
  const dbExpressions = createTableIndex
    ? createTableIndex.parts.map(
        (part: { expression: string }) => part.expression
      )
    : dbIndex.parts.map((part: { expression: string }) => part.expression);

  if (JSON.stringify(schemaExpressions) !== JSON.stringify(dbExpressions)) {
    console.log('DIFF', schemaExpressions, dbExpressions);
    if (!options.indexModifications?.allowModifications) {
      throw new Error(
        `Index "${schemaIndex.name}" has been modified. The expressions have changed from [${dbExpressions.join(
          ', '
        )}] to [${schemaExpressions.join(
          ', '
        )}]. Please create a new index with the desired expressions and drop the old one.`
      );
    }
    differences.schemaExpressions = schemaExpressions;
    differences.dbExpressions = dbExpressions;
    hasDiff = true;
  }

  const schemaUnique = schemaIndex.unique;
  const dbUnique = createTableIndex?.unique ?? dbIndex.unique;
  if (schemaUnique !== dbUnique) {
    if (!options.indexModifications?.allowModifications) {
      throw new Error(
        `Index "${schemaIndex.name}" has been modified. The uniqueness constraint has changed from ${dbUnique} to ${schemaUnique}. Please create a new index with the desired uniqueness constraint and drop the old one.`
      );
    }
    differences.schemaUnique = schemaUnique;
    differences.dbUnique = dbUnique;
    hasDiff = true;
  }

  return hasDiff ? (differences as IndexDiff) : null;
}

function getPrimaryKeyColumns(createTableStatement: string): string[] {
  const primaryKey = createTableStatement.match(/PRIMARY KEY \((.*)\)/i)?.[1];
  if (!primaryKey) {
    return [];
  }
  return primaryKey.split(',').map((col) => {
    // Remove quotes if present and trim whitespace
    const cleanCol = col.trim().replace(/^"(.*)"$/, '$1');
    // Remove ASC/DESC modifiers if present
    return cleanCol.split(/\s+/)[0];
  });
}

function comparePrimaryKeys(
  schemaColumns: string[],
  dbPrimaryKey: string[]
): boolean {
  // If there's no primary key in the database but we expect one
  if (!dbPrimaryKey && schemaColumns.length > 0) {
    return false;
  }

  // If there's a primary key in the database but we don't expect one
  if (dbPrimaryKey && schemaColumns.length === 0) {
    return false;
  }

  // If neither has a primary key
  if (!dbPrimaryKey && schemaColumns.length === 0) {
    return true;
  }

  // At this point we know dbPrimaryKey is defined
  if (!dbPrimaryKey) {
    return false;
  }

  // Compare the columns, ignoring order
  const schemaSet = new Set(schemaColumns);
  const dbSet = new Set(dbPrimaryKey);

  if (schemaSet.size !== dbSet.size) {
    return false;
  }

  for (const col of schemaSet) {
    if (!dbSet.has(col)) {
      return false;
    }
  }

  return true;
}

function compareTable<S extends BaseDbDiscriminator>(
  schemaTable: TableBase<S>,
  dbTable: FastTable,
  options: DiffOptions = {}
): TableDiff {
  const diff: TableDiff = {
    name: schemaTable.tableName,
    missingColumns: [],
    extraColumns: [],
    modifiedColumns: [],
    missingIndexes: [],
    extraIndexes: [],
    modifiedIndexes: [],
  };

  // Parse CREATE TABLE statement for index information if available
  const createTableIndexes = dbTable.createStatement
    ? parseCreateTableStatement(dbTable.createStatement).indexes
    : undefined;

  // Compare columns
  const schemaColumns = schemaTable.columnSchema;
  const dbColumns = new Map(dbTable.columns.map((col) => [col.name, col]));

  // Find missing and modified columns
  for (const [name, schemaCol] of Object.entries(schemaColumns)) {
    if (shouldIgnoreColumn(name, schemaTable.introspection)) {
      continue;
    }
    const dbCol = dbColumns.get(name);
    if (!dbCol) {
      diff.missingColumns.push({
        name,
        type: {
          schema: getNonNullableDataType(schemaCol.dataType).type.toUpperCase(),
        },
        nullable: {
          schema: isDataTypeNullable(schemaCol.dataType),
        },
        default: {
          schema: schemaCol.default,
        },
        ...(getNonNullableDataType(schemaCol.dataType).type.toLowerCase() ===
          'array' && {
          baseType: {
            schema: (
              getNonNullableDataType(schemaCol.dataType) as DataTypeArray
            ).primitiveDataType.type,
          },
        }),
      });
    } else {
      const columnDiff = compareColumns(schemaCol, dbCol);
      if (columnDiff) {
        diff.modifiedColumns.push(columnDiff);
      }
    }
  }

  // Find extra columns
  for (const [name, dbCol] of dbColumns) {
    if (!schemaColumns[name]) {
      diff.extraColumns.push({
        name,
        type: {
          db: dbCol.type,
        },
        nullable: {
          db: dbCol.nullable,
        },
        ...(dbCol.type.toUpperCase() === 'ARRAY' &&
          dbCol.udt && {
            baseType: {
              db: (() => {
                let baseType = dbCol.udt.startsWith('_')
                  ? dbCol.udt.slice(1)
                  : dbCol.udt;

                // CockroachDB uses json for arrays rather than jsonb
                if (baseType === 'jsonb') {
                  baseType = 'json';
                }

                return baseType;
              })(),
            },
          }),
      });
    }
  }

  // Compare indexes
  const schemaIndexes = schemaTable.indexes || {};
  const dbIndexes = new Map(dbTable.indexes.map((idx) => [idx.name, idx]));

  // Find missing and modified indexes
  for (const schemaIdx of Object.values(schemaIndexes)) {
    // Skip ignored indexes
    if (shouldIgnoreIndex(schemaIdx.name, schemaTable.introspection)) {
      continue;
    }

    const dbIdx = dbIndexes.get(schemaIdx.name);
    if (!dbIdx) {
      diff.missingIndexes.push(schemaIdx);
    } else {
      const indexDiff = compareIndexes(
        schemaIdx,
        dbIdx,
        createTableIndexes,
        options
      );
      if (indexDiff) {
        diff.modifiedIndexes.push(indexDiff);
      }
    }
  }

  // Find extra indexes only if not in additive mode
  if (schemaTable.introspection?.indexSyncMode !== 'additive') {
    for (const [name, dbIdx] of dbIndexes) {
      // Skip ignored indexes
      if (shouldIgnoreIndex(name, schemaTable.introspection)) {
        continue;
      }

      // Check if there's a schema index with this name
      const hasMatchingIndex = Object.values(schemaIndexes).some(
        (schemaIdx) => schemaIdx.name === name
      );

      if (!hasMatchingIndex) {
        // Try to get index information from CREATE TABLE statement first
        const createTableIndex = createTableIndexes?.find(
          (idx: FastIndex) => idx.name === name
        );
        diff.extraIndexes.push({
          name,
          dbExpressions: createTableIndex
            ? createTableIndex.parts.map(
                (part: { expression: string }) => part.expression
              )
            : dbIdx.parts.map(
                (part: { expression: string }) => part.expression
              ),
          dbUnique: createTableIndex?.unique ?? dbIdx.unique,
        });
      }
    }
  }

  // Compare primary keys based on columns rather than names
  const schemaPK = schemaTable.primaryKey;
  const dbPKColumns = dbTable.createStatement
    ? getPrimaryKeyColumns(dbTable.createStatement)
    : [];

  if (!comparePrimaryKeys(schemaPK, dbPKColumns)) {
    diff.primaryKeyDiff = {
      schema: schemaPK,
      db: dbPKColumns,
    };
  }

  return diff;
}

export function diffSchemas<S extends BaseDbDiscriminator>(
  schemas: EntityTarget<TableBase<S>, S>[],
  dbSchema: FastSchema,
  options: DiffOptions = {}
): SchemaDiff {
  const diff: SchemaDiff = {
    missingTables: [],
    extraTables: [],
    modifiedTables: [],
  };

  // Create maps for easier lookup
  const schemaTables = new Map(
    schemas.map((table) => [table.Table.tableName, table.Table])
  );
  const dbTables = new Map(dbSchema.tables.map((table) => [table.name, table]));

  // Find missing and modified tables
  for (const [name, schemaTable] of schemaTables) {
    const dbTable = dbTables.get(name);
    if (!schemaTable.introspection) {
      continue;
    }
    if (!dbTable) {
      diff.missingTables.push(name);
    } else {
      const tableDiff = compareTable(schemaTable, dbTable, options);
      if (
        tableDiff.missingColumns.length ||
        tableDiff.extraColumns.length ||
        tableDiff.modifiedColumns.length ||
        tableDiff.missingIndexes.length ||
        tableDiff.extraIndexes.length ||
        tableDiff.modifiedIndexes.length ||
        tableDiff.primaryKeyDiff
      ) {
        diff.modifiedTables.push(tableDiff);
      }
    }
  }

  // Find extra tables
  for (const name of dbTables.keys()) {
    if (!schemaTables.has(name)) {
      diff.extraTables.push(name);
    }
  }

  return diff;
}

export function formatDiff(diff: SchemaDiff, chalk?: Chalk): string {
  const lines: string[] = [];

  const format = {
    // Only color the actual changes, not the headers or descriptions
    header: (text: string) => text,
    missing: (text: string) => (chalk ? chalk.red(text) : text),
    extra: (text: string) => (chalk ? chalk.yellow(text) : text),
    modified: (text: string) => (chalk ? chalk.magenta(text) : text),
    detail: (text: string) => text,
    arrow: () => (chalk ? chalk.cyan('->') : '->'),
  };

  if (diff.missingTables.length) {
    lines.push(
      format.header('Missing Tables (in schema but not in database):')
    );
    diff.missingTables.forEach((table) =>
      lines.push(format.missing(`  - ${table}`))
    );
    lines.push('');
  }

  if (diff.extraTables.length) {
    lines.push(format.header('Extra Tables (in database but not in schema):'));
    const displayTables = diff.extraTables.slice(0, 5);
    displayTables.forEach((table) => lines.push(format.extra(`  - ${table}`)));
    if (diff.extraTables.length > 5) {
      const remaining = diff.extraTables.length - 5;
      lines.push(format.detail(`  (+ ${remaining} more)`));
    }
    lines.push('');
  }

  if (diff.modifiedTables.length) {
    lines.push(format.header('Modified Tables:'));
    diff.modifiedTables.forEach((table) => {
      lines.push(format.modified(`  ${table.name}:`));

      if (table.missingColumns.length) {
        lines.push(format.header('    Missing Columns:'));
        table.missingColumns.forEach((col) => {
          const typeInfo =
            col.type?.schema +
            (col.type?.schema?.toUpperCase() === 'ARRAY' && col.baseType?.schema
              ? `(${col.baseType.schema})`
              : '');
          lines.push(format.missing(`      - ${col.name} (${typeInfo})`));
        });
      }

      if (table.extraColumns.length) {
        lines.push(format.header('    Extra Columns:'));
        table.extraColumns.forEach((col) => {
          const typeInfo =
            col.type?.db +
            (col.type?.db?.toUpperCase() === 'ARRAY' && col.baseType?.db
              ? `(${col.baseType.db})`
              : '') +
            (col.nullable?.db ? ', nullable' : '');
          lines.push(format.extra(`      - ${col.name} (${typeInfo})`));
        });
      }

      if (table.modifiedColumns.length) {
        lines.push(format.header('    Modified Columns:'));
        table.modifiedColumns.forEach((col) => {
          lines.push(format.modified(`      - ${col.name}:`));
          if (col.type?.schema !== col.type?.db) {
            const schemaTypeInfo =
              col.type?.schema +
              (col.type?.schema?.toUpperCase() === 'ARRAY' &&
              col.baseType?.schema
                ? `(${col.baseType.schema})`
                : '');
            const dbTypeInfo =
              col.type?.db +
              (col.type?.db?.toUpperCase() === 'ARRAY' && col.baseType?.db
                ? `(${col.baseType.db})`
                : '');
            lines.push(
              `        Type: ${schemaTypeInfo} ${format.arrow()} ${dbTypeInfo}`
            );
          } else if (
            col.baseType?.schema !== col.baseType?.db &&
            (col.type?.schema?.toUpperCase() === 'ARRAY' ||
              col.type?.db?.toUpperCase() === 'ARRAY')
          ) {
            lines.push(
              `        BaseType: ${col.baseType?.schema} ${format.arrow()} ${col.baseType?.db}`
            );
          }
          if (col.nullable?.schema !== col.nullable?.db) {
            lines.push(
              `        Nullable: ${col.nullable?.schema} ${format.arrow()} ${col.nullable?.db}`
            );
          }
        });
      }

      if (table.primaryKeyDiff) {
        lines.push(format.header('    Primary Key Changed:'));
        const schemaCols = table.primaryKeyDiff.schema?.join(', ') || 'none';
        const dbCols = table.primaryKeyDiff.db?.join(', ') || 'none';
        lines.push(
          `      Schema: [${schemaCols}] ${format.arrow()} Database: [${dbCols}]`
        );
      }

      if (table.missingIndexes.length) {
        lines.push(format.header('    Missing Indexes:'));
        table.missingIndexes.forEach((idx) => {
          lines.push(
            format.missing(
              `      - ${idx.name} (${idx.expressions.map((val) => injectParameters(val))?.join(', ')})`
            )
          );
        });
      }

      if (table.extraIndexes.length) {
        lines.push(format.header('    Extra Indexes:'));
        table.extraIndexes.forEach((idx) => {
          lines.push(
            format.extra(
              `      - ${idx.name} (${idx.dbExpressions?.join(', ')}${idx.dbUnique ? ', unique' : ''})`
            )
          );
        });
      }

      if (table.modifiedIndexes.length) {
        lines.push(format.header('    Modified Indexes:'));
        table.modifiedIndexes.forEach((idx) => {
          lines.push(format.modified(`      - ${idx.name}:`));
          if (idx.schemaExpressions && idx.dbExpressions) {
            lines.push(
              `        Expressions: [${idx.schemaExpressions.join(', ')}] ${format.arrow()} [${idx.dbExpressions.join(', ')}]`
            );
          }
          if (idx.schemaUnique !== idx.dbUnique) {
            lines.push(
              `        Unique: ${idx.schemaUnique} ${format.arrow()} ${idx.dbUnique}`
            );
          }
        });
      }

      lines.push('');
    });
  }

  return lines.join('\n');
}
