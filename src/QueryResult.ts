import type { AnyOf, Expand, Not } from '@/core-utils';
import type { BaseDbDiscriminator, DataTypeBase } from './Base';
import {
  type DataTypes,
  getNonNullableDataType,
  isDataTypeNullable,
  makeDataTypeNullable,
} from './DataType';
import type { SelectQueryBuilderShape } from './QueryBuilder';
import type { QueryBuilderParams } from './QueryBuilderParams';
import type {
  SelectItemWithType,
  SelectionResult,
  TypeNarrowSelectionFromBooleanExpression,
} from './Selection';
import type { DbConfig } from './db-helper';
import { isJoinTypeNullable } from './expressions/ExpressionColumn';
import { expressionSelectColumns } from './expressions/ExpressionSelectColumns';
import { managerLocalStorage } from './run-in-transaction';
import { sql } from './sql-string';
import { applyTypeNarrow } from './type-narrower';
import { writeSql } from './writeSql';

export async function runQueryResult<S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>,
  data: {
    queryRunner: {
      query: DbConfig<S, any>['query'];
    };
    throwsIfEmpty?: boolean | (() => Error);
  }
) {
  const stack =
    new Error().stack
      ?.split('\n')
      .slice(1)
      .map((line) => `-- ${line}`)
      .concat('')
      .join('\n') ?? '';

  const query = sql`${sql.__dangerouslyConstructRawSql(stack)} ${writeSql(params)}`;

  const res = await data.queryRunner.query(
    params.queryName ?? '',
    query,
    managerLocalStorage.getStore()?.manager
  );
  if (data?.throwsIfEmpty) {
    if (!res.length) {
      if (typeof data.throwsIfEmpty === 'boolean') {
        throw new Error('Not found');
      }

      throw data.throwsIfEmpty();
    }
  }

  const final = transformRawResultToQuery(params, res);

  const typeNarrowing = (() => {
    if (params.conditions) {
      return applyTypeNarrow(final, params, params.conditions);
    }
  })();

  return { result: final, sql: query, typeNarrowResult: typeNarrowing };
}

export function transformSqlToParsedResult<
  T extends SelectQueryBuilderShape<QueryBuilderParams<S>, S>,
  S extends BaseDbDiscriminator,
>(
  value: T,
  result: any[]
): T extends SelectQueryBuilderShape<infer U extends QueryBuilderParams<S>, S>
  ? QueryResult<U, { applyTypeNarrowing: false; throwsIfEmpty: false }, S>
  : never {
  return transformRawResultToQuery(value._debug(), result) as any;
}

export function transformRawResultToQuery<S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>,
  result: any[]
) {
  const aliases = params.select.reduce(
    (acc, selectItem) => {
      const aliases = selectItem.alias
        ? [selectItem.alias]
        : (selectItem.expression.inferredAliases ?? []);

      return {
        ...acc,
        ...aliases.reduce((acc, alias) => {
          return {
            ...acc,
            [alias]: (() => {
              if (expressionSelectColumns.isNode(selectItem.expression)) {
                const selectColumnsExpr = selectItem.expression;
                const columnName = alias.slice(
                  `${selectItem.expression.alias}_`.length
                );

                const columnReference =
                  selectItem.expression.table.columnSchema[columnName];

                if (columnReference) {
                  const join = params.entities.find(
                    (entity) => entity.alias === selectColumnsExpr.alias
                  )?.join;

                  const shouldMakeNullable = isJoinTypeNullable(join);
                  return {
                    dataType: shouldMakeNullable
                      ? makeDataTypeNullable(columnReference.dataType)
                      : columnReference.dataType,
                    toPath: `${selectItem.expression.alias}.${columnReference.columnName}`,
                  };
                }
              }

              return {
                dataType: selectItem.expression.dataType,
              };
            })(),
          };
        }, {}),
      };
    },
    {} as {
      [Key in string]: {
        dataType: DataTypeBase;
        toPath?: string;
      };
    }
  );

  const final = result.map((item) => {
    return Object.entries(item).reduce((acc, [key, item]) => {
      if (aliases[key]) {
        const dataType = aliases[key].dataType as DataTypes;

        const data = transformColumnForDataType(item, dataType);
        // check alias type matches
        if (aliases[key].toPath) {
          if (data === undefined) {
            return acc;
          }
          const components = aliases[key].toPath?.split('.') ?? [];
          let head: any = acc;
          for (let i = 0; i < components.length; ++i) {
            const component = components[i];
            if (i === components.length - 1) {
              head[component] = data;
            } else {
              if (!head[component]) {
                head[component] = {};
              }
              head = head[component];
            }
          }
          return acc;
        } else {
          return {
            ...acc,
            [key]: data,
          };
        }
      }

      return {
        ...acc,
        [key]: item,
      };
    }, {});
  });

  return final;
}

export type QueryResult<
  Params extends QueryBuilderParams<S>,
  Options extends {
    applyTypeNarrowing: boolean;
    throwsIfEmpty: boolean;
  },
  S extends BaseDbDiscriminator,
> = AnyOf<
  [
    undefined extends Params['conditions']
      ? true
      : undefined extends NonNullable<Params['conditions']>['filter']
        ? true
        : false,
    Not<Options['applyTypeNarrowing']>,
  ]
> extends true
  ? ResultWithoutConditions<
      Params,
      {
        throwsIfEmpty: Options['throwsIfEmpty'];
      },
      S
    >
  : UnrollResult<
      TypeNarrowSelectionFromBooleanExpression<
        SelectionResult<Params['select'], S>,
        NonNullable<NonNullable<Params['conditions']>['filter']>['expr'],
        SelectionResult<Params['select'], S>,
        S
      >
    >[];

/**
 * Transforms a column value from the SQL server to the data type expected by the schema
 * if the types are mismatching
 */
export function transformColumnForDataType(
  columnData: any,
  dataType: DataTypes
) {
  if (columnData === null && !isDataTypeNullable(dataType)) {
    throw new Error('Item returned NULL on a non-nullable column');
  }

  if (columnData === null) {
    return undefined;
  }

  const finalDataType = getNonNullableDataType(dataType) as Exclude<
    DataTypes,
    { type: 'union' }
  >;

  switch (finalDataType.type) {
    case 'int':
      if (typeof columnData === 'string') {
        return Number(columnData);
      }
      if (typeof columnData !== 'number') {
        throw new Error(
          `Data returned from SQL server did not match data type: "${dataType.type}"`
        );
      }

      return columnData;
    case 'float':
      if (typeof columnData === 'string') {
        return Number(columnData);
      }

      if (typeof columnData !== 'number') {
        throw new Error(
          `Data returned from SQL server did not match data type: "${dataType.type}"`
        );
      }
      return columnData;
  }

  return columnData;
}

export type BaseResult<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = Expand<UnrollResult<SelectionResult<Params['select'], S>>>;

type ResultWithoutConditions<
  Params extends QueryBuilderParams<S>,
  Options extends {
    throwsIfEmpty: boolean;
  },
  S extends BaseDbDiscriminator,
> = Params['limit'] extends 1
  ? Options['throwsIfEmpty'] extends true
    ? [BaseResult<Params, S>]
    : [BaseResult<Params, S> | undefined]
  : BaseResult<Params, S>[];

type UnrollResult<Data extends ReadonlyArray<SelectItemWithType>> =
  Data extends [
    infer U extends SelectItemWithType,
    ...infer J extends ReadonlyArray<SelectItemWithType>,
  ]
    ? U['typeDefinition'] & UnrollResult<J>
    : {};
