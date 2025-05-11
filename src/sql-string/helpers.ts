import type { SqlString } from '.';

// Alphanumeric + _ + - (case-insensitive)
const VALID_IDENTIFIER_REGEX = /^[a-z0-9_-]+$/i;

export function escapeIdentifier(value: string) {
  // Redundant check in-case we get a non-string value
  if (typeof value !== 'string') {
    throw new Error(`Expected type string, got ${typeof value}`);
  }

  if (!VALID_IDENTIFIER_REGEX.test(value)) {
    throw new Error(`${value} is not a valid identifier`);
  }

  return `"${value}"`;
}

export function rawIdentifier(value: string) {
  // Redundant check in-case we get a non-string value
  if (typeof value !== 'string') {
    throw new Error(`Expected type string, got ${typeof value}`);
  }

  if (!VALID_IDENTIFIER_REGEX.test(value)) {
    throw new Error(`${value} is not a valid raw identifier`);
  }

  return value;
}

export const isArray = Array.isArray as <T extends readonly any[]>(
  obj: unknown
) => obj is T;

/**
 * Converts a SqlString object into a string with parameters injected.
 * This is useful for displaying queries in a readable format, but should NOT be used
 * for actual query execution as it bypasses proper parameter binding.
 */
export function injectParameters(sql: SqlString): string {
  const query = sql.getQuery();
  const params = sql.getParameters();

  return query.replace(/\$(\d+)/g, (_, index) => {
    const param = params[Number.parseInt(index) - 1];
    if (param === undefined) {
      throw new Error(`Parameter $${index} not found`);
    }

    // Format the parameter based on its type
    if (typeof param === 'string') {
      return `'${param.replace(/'/g, "''")}'`; // Escape single quotes
    } else if (param instanceof Date) {
      return `'${param.toISOString()}'`;
    } else {
      return String(param);
    }
  });
}
