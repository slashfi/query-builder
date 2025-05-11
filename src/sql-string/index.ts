import { assertUnreachable } from '@/core-utils';
import { escapeIdentifier, isArray, rawIdentifier } from './helpers';

const parameterSymbol = Symbol('?');

export type PrimitiveSqlParameter = string | number | boolean | Date;

type SqlParameter = SqlString | PrimitiveSqlParameter;

type SqlQueryPart = string | typeof parameterSymbol;

type SqlDatabase = 'cockroachdb' | 'snowflake';

export interface SqlString {
  getRawQueryParts(): SqlQueryPart[];
  getQuery(params?: { database: SqlDatabase }): string;
  getParameters(): PrimitiveSqlParameter[];
  append(...parts: SqlString[]): SqlString;
}

function getParameterized({
  database,
  index,
}: { database: SqlDatabase; index: number }) {
  switch (database) {
    case 'cockroachdb':
      return `$${index}`;
    case 'snowflake':
      return '?';
    default:
      assertUnreachable(database);
  }
}

function internalSqlConstructor(
  strings: ReadonlyArray<string>,
  parameters: ReadonlyArray<SqlParameter | ReadonlyArray<SqlParameter>>
): SqlString {
  const res = strings.map<{
    queryParts: SqlQueryPart[];
    parameters: PrimitiveSqlParameter[];
  }>((currStr, i) => {
    if (i === strings.length - 1) {
      return {
        queryParts: [currStr],
        parameters: [],
      };
    }
    const partParameters = parameters[i];

    // if it's an array, map to (?,?,?)
    // else just use those params
    const normalizedPartParameters = isArray(partParameters)
      ? internalSqlConstructor(
          partParameters.length > 0
            ? ['(', ...Array(partParameters.length - 1).fill(','), ')']
            : ['()'],
          partParameters
        )
      : partParameters;

    if (
      typeof normalizedPartParameters === 'object' &&
      'getQuery' in normalizedPartParameters
    ) {
      return {
        queryParts: [currStr, ...normalizedPartParameters.getRawQueryParts()],
        parameters: normalizedPartParameters.getParameters(),
      };
    }
    return {
      queryParts: [currStr, parameterSymbol],
      parameters: [normalizedPartParameters],
    };
  });

  const queryParts = res.flatMap((val) => val.queryParts);
  const finalParameters = res.flatMap((val) => val.parameters);

  return {
    getRawQueryParts: () => queryParts,
    getQuery: ({ database } = { database: 'cockroachdb' }) => {
      let startIndex = 1;

      return queryParts.reduce<string>((acc, part) => {
        if (part === parameterSymbol) {
          return acc + getParameterized({ database, index: startIndex++ });
        }

        return acc + part;
      }, '');
    },
    getParameters: () => finalParameters,
    append(...parts) {
      if (!this) {
        throw new Error('append must be called with a this context');
      }

      return sqlHelpers.join([this, ...parts], '');
    },
  };
}

function sqlConstructor(
  strings: ReadonlyArray<string>,
  ...parameters: ReadonlyArray<SqlString | ReadonlyArray<SqlString>>
): SqlString {
  return internalSqlConstructor(strings, parameters);
}

/**
 * Certain things like columns and tables can't be parameterized and shouldn't be anyways.
 * We don't export this because this is the only place dynamic SQL can be constructed.
 */
function unsafeSqlConstructor(
  strings: ReadonlyArray<string>,
  ...parameters: string[]
): SqlString {
  const result = strings
    .map((str, i) => (i < parameters.length ? str + parameters[i] : str))
    .join('');

  return internalSqlConstructor([result], []);
}

type PrimitiveSqlConstructor = (
  value: PrimitiveSqlParameter | ReadonlyArray<PrimitiveSqlParameter>
) => SqlString;

const primitiveSqlConstructor: PrimitiveSqlConstructor = (value) => {
  return internalSqlConstructor(['', ''], [value]);
};

export interface SqlStringHelpers {
  // General SqlString utilities
  join: (parts: SqlString[], separator: string) => SqlString;
  and: (parts: SqlString[]) => SqlString;
  or: (parts: SqlString[]) => SqlString;

  // Custom constructors
  /**
   * This constructor is technically unsafe, so none of the arguments should be dynamic.
   */
  column: ({
    table,
    name,
    alias,
  }: {
    table?: string | undefined;
    name: string;
    alias?: string | undefined;
  }) => SqlString;
  /**
   * This constructor is technically unsafe, so none of the arguments should be dynamic.
   */
  table: ({
    schema,
    name,
    index,
    alias,
  }: {
    schema?: string | undefined;
    name: string;
    index?: string | undefined;
    alias?: string | undefined;
  }) => SqlString;

  /**
   * Constructs an index name. This constructor is technically unsafe, so none of the arguments should be dynamic.
   */
  indexName: (name: string) => SqlString;

  /**
   * Constructs an escaped identifier. Should almost never be used, but we have
   * some edge cases where we need to form dynamic SQL on values that are guaranteed
   * safe and will be regex-validated anyways.
   */
  escapeIdentifier: (value: string) => SqlString;
  /**
   * Constructs a raw identifier. Should almost never be used, but we have
   * some edge cases where we need to form dynamic SQL on values that are guaranteed
   * safe and will be regex-validated anyways.
   */
  rawIdentifier: (value: string) => SqlString;

  /**
   * Dangerously constructs raw SQL. Input is **NOT** validated, do NOT pass in
   * anything that may be remotely dangerous.
   */
  __dangerouslyConstructRawSql: (value: string) => SqlString;

  /**
   * Explicitly specify primitive parameters, so TS throws an error when template strings
   * are embedded with a primitive string that's a subquery.
   */
  primitive: PrimitiveSqlConstructor;
  /**
   * Explicitly specify primitive parameters, so TS throws an error when template strings
   * are embedded with a primitive string that's a subquery.
   */
  p: PrimitiveSqlConstructor;

  /**
   * Wraps the SqlString input with parentheses.
   */
  parens: (value: SqlString) => SqlString;
  /**
   * Wraps the SqlString input with parentheses.
   */
  parentheses: (value: SqlString) => SqlString;

  /**
   * Applies no escaping or parameterization to the inputted number. This is useful when
   * applying a number value to the LIMIT or OFFSET clause for Snowflake, as they do not
   * accept bind variables for those clauses. This will throw if the input is not a number.
   */
  rawNumber: (value: number) => SqlString;
}

const sqlHelpers: SqlStringHelpers = {
  join: (parts, separator) => {
    if (parts.length === 0) {
      return internalSqlConstructor([''], []);
    }

    return internalSqlConstructor(
      ['', ...Array(parts.length - 1).fill(separator), ''],
      parts
    );
  },
  and: (parts) => sqlHelpers.join(parts, ' AND '),
  or: (parts) => sqlHelpers.join(parts, ' OR '),
  column: ({ table, name, alias }) => {
    let column = table
      ? unsafeSqlConstructor`${escapeIdentifier(table)}.${escapeIdentifier(
          name
        )}`
      : unsafeSqlConstructor`${escapeIdentifier(name)}`;

    if (alias) {
      column = column.append(
        unsafeSqlConstructor` AS ${escapeIdentifier(alias)}`
      );
    }

    return column;
  },
  table: ({ schema, name, index, alias }) => {
    const table = schema
      ? unsafeSqlConstructor`${escapeIdentifier(schema)}.${escapeIdentifier(
          name
        )}`
      : unsafeSqlConstructor`${escapeIdentifier(name)}`;

    if (index) {
      return table.append(
        unsafeSqlConstructor`@${escapeIdentifier(index)}${
          alias ? ` AS ${escapeIdentifier(alias)}` : ''
        }`
      );
    }

    if (alias) {
      return table.append(unsafeSqlConstructor` AS ${escapeIdentifier(alias)}`);
    }

    return table;
  },
  indexName: (name) => unsafeSqlConstructor`${escapeIdentifier(name)}`,
  escapeIdentifier: (value: string) =>
    unsafeSqlConstructor`${escapeIdentifier(value)}`,
  rawIdentifier: (value: string) =>
    unsafeSqlConstructor`${rawIdentifier(value)}`,
  __dangerouslyConstructRawSql: (value: string) =>
    unsafeSqlConstructor`${value}`,
  parens: (value) => internalSqlConstructor(['(', ')'], [value]),
  parentheses: (value) => internalSqlConstructor(['(', ')'], [value]),
  primitive: primitiveSqlConstructor,
  p: primitiveSqlConstructor,
  rawNumber: (value: number) => {
    if (typeof value !== 'number') {
      throw new Error('rawNumber must be called with a number');
    }

    return unsafeSqlConstructor`${value.toString()}`;
  },
};

export const sql = Object.assign(sqlConstructor, sqlHelpers);
