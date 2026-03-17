import { assertUnreachable, filterUndefined } from '@/core-utils';
import { getAstNodeRepository } from './ast-node-repository';
import type { BaseDbDiscriminator, TableBase } from './Base';
import type { QueryBuilderParams } from './QueryBuilderParams';
import { type SqlString, sql } from './sql-string';

export function writeSql<S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>,
  indentation = 0
): SqlString {
  const baseEntity = params.entities.find((entity) => !entity.join);

  if (!baseEntity) {
    throw new Error(`Couldn't find a base entity`);
  }

  const selectListStr: SqlString = (() => {
    const itemForEachItem = params.select.map((select) =>
      getAstNodeRepository(select).writeSql(select, undefined)
    );

    return sql`SELECT ${sql.join(itemForEachItem, ', ')}`;
  })();

  function writeTableSql<S extends BaseDbDiscriminator>(
    tableBase: TableBase<S>
  ): SqlString {
    if (tableBase.subquery) {
      return sql`( ${writeSql(tableBase.subquery)} )`;
    }

    if (tableBase.valuesTable) {
      return sql`(${getAstNodeRepository(tableBase.valuesTable).writeSql(
        tableBase.valuesTable,
        undefined
      )})`;
    }

    return sql.table({
      schema: tableBase.schema,
      name: tableBase.tableName,
    });
  }

  const joins: SqlString[] = params.entities
    .filter((val) => val.join)
    .map((val) => {
      if (!val.join) {
        throw new Error('Join clause missing join property');
      }

      if (!('on' in val.join)) {
        throw new Error('Join clause missing on property');
      }

      const joinType: SqlString = (() => {
        switch (val.join.type) {
          case 'left':
            return sql`LEFT`;
          case 'right':
            return sql`RIGHT`;
          case 'inner':
            return sql`INNER`;
          default:
            return assertUnreachable(val.join);
        }
      })();

      const joinHint: SqlString = val.join.joinHint
        ? sql` `.append(
            (() => {
              switch (val.join.joinHint) {
                case 'LOOKUP':
                  return sql`LOOKUP`;
                case 'MERGE':
                  return sql`MERGE`;
                case 'HASH':
                  return sql`HASH`;
                default:
                  return assertUnreachable(val.join.joinHint);
              }
            })()
          )
        : sql``;

      return sql`\n${createIndent(
        indentation + 1
      )}${joinType}${joinHint} JOIN ${writeTableSql(val.table)}${
        val.customIndex ? sql`@${sql.escapeIdentifier(val.customIndex)}` : sql``
      } AS ${sql.escapeIdentifier(val.alias)} ON ${getAstNodeRepository(
        val.join.on
      ).writeSql(val.join.on, undefined)}`;
    });

  const fromStatement: SqlString = sql`FROM ${writeTableSql(baseEntity.table)}${
    baseEntity.customIndex
      ? sql`@${sql.escapeIdentifier(baseEntity.customIndex)}`
      : sql``
  } ${baseEntity.alias ? sql` AS ${sql.escapeIdentifier(baseEntity.alias)}` : sql``} ${sql.join(joins, '')}`;

  const whereClauseStr: SqlString | undefined = (() => {
    if (params.whereClause) {
      return sql`WHERE ${getAstNodeRepository(params.whereClause).writeSql(
        params.whereClause,
        undefined
      )}`;
    }

    return undefined;
  })();

  const groupByClause: SqlString | undefined = (() => {
    if (params.groupByClause.length) {
      const values = params.groupByClause.map((clause) =>
        getAstNodeRepository(clause).writeSql(clause, undefined)
      );

      return sql`GROUP BY ${sql.join(values, ', ')}`;
    }

    return undefined;
  })();

  const orderByClause: SqlString | undefined = (() => {
    if (params.orderBy) {
      return getAstNodeRepository(params.orderBy).writeSql(
        params.orderBy,
        undefined
      );
    }

    return undefined;
  })();

  const limitClause: SqlString | undefined = (() => {
    if ('limit' in params) {
      return sql`LIMIT ${sql.p(params.limit)}`;
    }

    return undefined;
  })();

  const offsetClause: SqlString | undefined = (() => {
    if ('offset' in params) {
      return sql`OFFSET ${sql.p(params.offset)}`;
    }

    return undefined;
  })();

  const forUpdateClause: SqlString | undefined = (() => {
    if ('forUpdate' in params && params.forUpdate) {
      if (params.forUpdate === 'share') {
        return 'skipLocked' in params && params.skipLocked
          ? sql`FOR SHARE SKIP LOCKED`
          : sql`FOR SHARE`;
      }
      return 'skipLocked' in params && params.skipLocked
        ? sql`FOR UPDATE SKIP LOCKED`
        : sql`FOR UPDATE`;
    }
    return undefined;
  })();

  const sqlParts = filterUndefined([
    selectListStr,
    fromStatement,
    whereClauseStr,
    groupByClause,
    orderByClause,
    offsetClause,
    limitClause,
    forUpdateClause,
  ]);

  return sql.join(sqlParts, ' ');
}

function createIndent(value: number) {
  const indentParts = [...new Array(value)].map(() => sql`  `);

  return sql.join(indentParts, '');
}
