import { getAstNodeRepository } from '../../ast-node-repository';
import type { SqlString } from '../../sql-string';
import { sql } from '../../sql-string';
import { injectParameters } from '../../sql-string/helpers';
import type { DdlIndexDefinition, StorageParameters } from './types';

function serializeStorageParameters(params: StorageParameters): SqlString {
  return sql.join(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === 'string') {
        return sql.__dangerouslyConstructRawSql(`${key} = '${value}'`);
      }
      return sql.__dangerouslyConstructRawSql(`${key} = ${value}`);
    }),
    ', '
  );
}

export function createIndex(definition: DdlIndexDefinition): SqlString {
  const parts: SqlString[] = [sql`CREATE`];

  if (definition.unique) {
    parts.push(sql`UNIQUE`);
  }

  parts.push(sql`INDEX`);

  if (definition.concurrently) {
    parts.push(sql`CONCURRENTLY`);
  }

  if (definition.ifNotExists) {
    parts.push(sql`IF NOT EXISTS`);
  }

  if (definition.name) {
    parts.push(sql.indexName(definition.name));
  }

  parts.push(
    sql`ON ${sql.table({ schema: definition.schema, name: definition.table })}`
  );

  if (definition.method) {
    parts.push(
      sql`USING ${sql.__dangerouslyConstructRawSql(definition.method)}`
    );
  }

  // Expression list with optional ASC/DESC
  const expressionDefs = definition.expressions.map((expr, i) => {
    if (definition.ascending && definition.ascending[i] === false) {
      return sql`${expr} DESC`;
    }
    return expr;
  });

  parts.push(sql`(${sql.join(expressionDefs, ', ')})`);

  // Include columns
  if (definition.storingColumns?.length) {
    parts.push(
      sql`STORING (${sql.join(
        definition.storingColumns.map((col) => sql.column({ name: col })),
        ', '
      )})`
    );
  }

  // Nulls not distinct
  if (definition.nullsNotDistinct) {
    parts.push(sql`NULLS NOT DISTINCT`);
  }

  // With clause
  if (definition.withClause) {
    parts.push(
      sql`WITH (${serializeStorageParameters(definition.withClause)})`
    );
  }

  // Storage parameters
  if (definition.storageParameters) {
    parts.push(
      sql`WITH (${serializeStorageParameters(definition.storageParameters)})`
    );
  }

  // Where clause
  if (definition.whereClause) {
    const whereClauseSql = getAstNodeRepository(
      definition.whereClause._expression
    ).writeSql(definition.whereClause._expression, undefined);

    parts.push(sql`WHERE ${sql([injectParameters(whereClauseSql)])}`);
  }

  return sql.join(parts, ' ');
}
