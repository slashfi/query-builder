import type { BaseDbDiscriminator, TableBase } from '../Base';
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
      is_hidden = 'YES' as hidden
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
}

export interface FastIndexPart {
  expression: string;
  direction: 'ASC' | 'DESC';
  position: number;
  storing: boolean;
}

export interface FastIndex {
  name: string;
  unique: boolean;
  parts: FastIndexPart[];
  includeColumns: string[];
  partial?: string; // WHERE condition for partial indexes
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

      const parts = exprMatch[1].split(',').map((part, position) => {
        const trimmed = part.trim();
        const direction = trimmed.endsWith('DESC')
          ? ('DESC' as const)
          : ('ASC' as const);
        const expression = trimmed.replace(/ (ASC|DESC)$/i, '').trim();

        return {
          expression,
          direction,
          position,
          storing: false,
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
  tableRows: any[],
  columnRows: any[] | null,
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
  executeQuery: (query: SqlString) => Promise<any[]>,
  schemas: EntityTarget<TableBase<S>, S>[]
): Promise<FastSchema> => {
  // Check what needs to be introspected
  const needsColumns = schemas.some((schema) =>
    shouldIntrospectColumns(schema.Table)
  );

  // Build list of queries to execute
  const queryPromises: Promise<any[]>[] = [
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
