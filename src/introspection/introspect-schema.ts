import type { GenericAny } from '../core-utils';
import type { BaseDbDiscriminator, TableBase } from '../Base';
import {
  type OperatorClass,
  operatorClassPatterns,
} from '../ddl/index-builder/index-definition';
import type { EntityTarget } from '../EntityTarget';
import { type SqlString, sql } from '../sql-string';
import {
  shouldIntrospectColumns,
  shouldIntrospectIndexes,
} from '../table-from-schema-builder';

export const queries = {
  tables: (schemaName: string): SqlString => sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = ${sql.p(schemaName)} 
    AND table_type = 'BASE TABLE'
  `,

  // Get all columns
  columns: (schemaName: string): SqlString => sql`
    SELECT 
      table_name,
      column_name as name,
      data_type as type,
      udt_name as udt,
      is_nullable = 'YES' as nullable,
      column_default as "defaultValue",
      ordinal_position,
      is_hidden = 'YES' as hidden,
      generation_expression as "computedExpression"
    FROM information_schema.columns
    WHERE table_schema = ${sql.p(schemaName)}
    ORDER BY table_name, ordinal_position
  `,

  // Get CREATE TABLE statements for tables with index introspection
  showCreateTable: (schemaName: string, tableName: string): SqlString => sql`
    SHOW CREATE TABLE ${sql.table({ schema: schemaName, name: tableName })}
  `,
};

// Types remain mostly the same, but simplified for faster processing
export interface FastColumn {
  name: string;
  type: string;
  udt: string;
  nullable: boolean;
  defaultValue: string | null;
  ordinalPosition: number;
  hidden: boolean;
  computedExpression: string | null; // Generated column expression from database
}

export interface FastIndexPart {
  expression: string;
  direction: 'ASC' | 'DESC';
  position: number;
  storing: boolean;
  operatorClass?: string | undefined;
}

export interface FastIndex {
  name: string;
  unique: boolean;
  parts: FastIndexPart[];
  includeColumns: string[];
  partial?: string; // WHERE condition for partial indexes
  operatorClass?: string | undefined; // Operator class for trigram indexes (e.g., gin_trgm_ops)
}

export interface FastTable {
  name: string;
  columns: FastColumn[];
  indexes: FastIndex[];
  createStatement?: string; // Store the full CREATE TABLE statement
}

export interface FastSchema {
  tables: FastTable[];
}

// Helper functions to process results
const groupBy = <T, K extends keyof T>(
  list: T[],
  getKey: (item: T) => K
): Record<K, T[]> =>
  list.reduce(
    (acc, item) => {
      const key = getKey(item);
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );

// Parse CREATE TABLE statement to extract index information
export function parseCreateTableStatement(createStatement: string): {
  indexes: FastIndex[];
} {
  const indexes: FastIndex[] = [];

  // Split statement into lines and find index definitions
  const lines = createStatement.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Match index definitions
    if (
      trimmedLine.startsWith('INDEX') ||
      trimmedLine.startsWith('UNIQUE INDEX') ||
      trimmedLine.startsWith('CREATE INDEX') ||
      trimmedLine.startsWith('CREATE UNIQUE INDEX')
    ) {
      const isUnique = trimmedLine.includes('UNIQUE');

      // Extract index name
      const nameMatch = trimmedLine.match(/INDEX\s+([^\s(]+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/[",]/g, '');

      // Extract expressions
      const exprMatch = trimmedLine.match(/\((.*?)\)/);
      if (!exprMatch) continue;

      let indexOperatorClass: OperatorClass | undefined;

      const parts = exprMatch[1].split(',').map((part, position) => {
        let trimmed = part.trim();

        // Parse in reverse order of generation: "col opclass DESC"
        const direction = trimmed.endsWith('DESC')
          ? ('DESC' as const)
          : ('ASC' as const);
        trimmed = trimmed.replace(/ (ASC|DESC)$/i, '').trim();

        const partOperatorClass = (() => {
          for (const opClass of operatorClassPatterns) {
            if (trimmed.endsWith(` ${opClass}`)) {
              indexOperatorClass = opClass;
              trimmed = trimmed.slice(0, -opClass.length - 1).trim();
              return opClass;
            }
          }
          return undefined;
        })();

        // Strip quotes from column names for consistent comparison
        // CockroachDB keeps quotes for camelCase columns but drops them for lowercase
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          trimmed = trimmed.slice(1, -1);
        }

        return {
          expression: trimmed,
          direction,
          position,
          storing: false,
          operatorClass: partOperatorClass,
        };
      });

      // Extract WHERE clause for partial indexes
      const whereMatch = trimmedLine.match(/WHERE\s+(.+?)(\)|$)/);

      // Extract STORING clause
      const storingMatch = trimmedLine.match(/STORING\s*\((.*?)\)/);
      const includeColumns = storingMatch
        ? storingMatch[1]
            .split(',')
            .map((col) => col.trim().replace(/[",]/g, ''))
        : [];

      const index: FastIndex = {
        name,
        unique: isUnique,
        parts,
        includeColumns,
        operatorClass: indexOperatorClass,
      };

      // Only add partial if it exists
      if (whereMatch) {
        index.partial = whereMatch[1].trim();
      }

      indexes.push(index);
    }
  }

  return { indexes };
}

// Process the results from parallel queries
export const processSchemaResults = (
  tableRows: GenericAny[],
  columnRows: GenericAny[] | null,
  createTableResults: Map<string, string>
): FastSchema => {
  // Group columns by table
  const columnsByTable = columnRows
    ? groupBy(columnRows, (row) => row.table_name)
    : {};

  // Build the schema
  const tables = tableRows.map((tableRow): FastTable => {
    const tableName = tableRow.table_name;
    const createStatement = createTableResults.get(tableName);

    return {
      name: tableName,
      columns: (columnsByTable[tableName] || []) as FastColumn[],
      indexes: createStatement
        ? parseCreateTableStatement(createStatement).indexes
        : [],
      ...(createStatement && { createStatement }),
    };
  });

  return { tables };
};

// Main introspection function
export const introspectSchema = async <S extends BaseDbDiscriminator>(
  schemaName: string,
  executeQuery: (query: SqlString) => Promise<GenericAny[]>,
  schemas: EntityTarget<TableBase<S>, S>[]
): Promise<FastSchema> => {
  // Check what needs to be introspected
  const needsColumns = schemas.some((schema) =>
    shouldIntrospectColumns(schema.Table)
  );

  // Build list of queries to execute
  const queryPromises: Promise<GenericAny[]>[] = [
    executeQuery(queries.tables(schemaName)),
  ];

  if (needsColumns) {
    queryPromises.push(executeQuery(queries.columns(schemaName)));
  } else {
    queryPromises.push(Promise.resolve([]));
  }

  // Execute queries in parallel
  const [tableRows, columnRows] = await Promise.all(queryPromises);

  // Create a map of tables that need index introspection
  const tablesNeedingIntrospection = new Set(
    schemas
      .filter((schema) => shouldIntrospectIndexes(schema.Table))
      .map((schema) => schema.Table.tableName)
  );

  // Get CREATE TABLE statements only for tables with index introspection enabled
  const createTableResults = new Map<string, string>();

  for (const tableRow of tableRows) {
    const tableName = tableRow.table_name;

    if (tablesNeedingIntrospection.has(tableName)) {
      try {
        const result = await executeQuery(
          queries.showCreateTable(schemaName, tableName)
        );
        if (result[0]?.create_statement) {
          createTableResults.set(tableName, result[0].create_statement);
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: override
        console.warn(
          `Failed to get CREATE TABLE statement for ${tableName}:`,
          error
        );
      }
    }
  }

  return processSchemaResults(
    tableRows,
    needsColumns ? columnRows : null,
    createTableResults
  );
};
