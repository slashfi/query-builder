import { filterUndefined, type GenericAny } from '@/core-utils';
import type {
  BaseDbDiscriminator,
  DataTypeBase,
  ExpressionBase,
  TableBase,
  TableColumnBase,
} from './Base';
import { clauseForGroupByList } from './clauses/ClauseForGroupBy';
import { clauseForOrderByList } from './clauses/ClauseForOrderBy';
import {
  type ClauseForSelectListItem,
  clauseForSelectListItem,
} from './clauses/ClauseForSelectListItem';
import { clauseFromExpression } from './clauses/ClauseFromExpression';
import type { DbConfig } from './db-helper';
import type { CompiledIndexConfigBase } from './ddl/index-config';
import type { EntityTarget, GenericEntityTarget } from './EntityTarget';
import { expressionLeftRightBinary } from './expressions/ExpressionLeftRightBinary';
import {
  type ExpressionSelectColumns,
  expressionSelectColumns,
} from './expressions/ExpressionSelectColumns';
import {
  extendTargetList,
  type TargetJoinType,
  type TargetList,
} from './FromBuilder';
import { operatorBinaryLogical } from './operators/OperatorBinaryLogical';
import { paginateQueryResult } from './paginate';
import type { ResultAssertBuilder, SelectQueryBuilder } from './QueryBuilder';
import {
  type QueryBuilderParams,
  updateQueryBuilderParams,
} from './QueryBuilderParams';
import { runQueryResult } from './QueryResult';
import type { ColumnsSelectList } from './sql-query-builder/group-by-list-builder';
import { qbSelectListToSelectClause } from './sql-query-builder/select-list-builder';
import type { TableSelector } from './table-selector';
import { createTableSelector } from './table-selector';
import { writeSql } from './writeSql';

function isIndexConfig<S extends BaseDbDiscriminator>(
  target: GenericEntityTarget<S> | CompiledIndexConfigBase<S>
): target is CompiledIndexConfigBase<S> {
  return 'friendlyIndexName' in target;
}

export function createFrom<
  S extends BaseDbDiscriminator = BaseDbDiscriminator,
>(queryRunner: { query: DbConfig<S, GenericAny>['query']; discriminator: S }) {
  function from<Target extends GenericEntityTarget<S>, Alias extends string>(
    _entity: Target,
    _alias: Alias,
    _index?: string
  ): SelectQueryBuilder<
    {
      whereClause: undefined;
      entities: [{ table: Target['Table']; alias: Alias; isUsingAlias: true }];
      groupByClause: [];
      select: [
        ClauseForSelectListItem<
          ExpressionSelectColumns<
            {
              table: Target['Table'];
              alias: Alias;
              isUsingAlias: true;
            },
            keyof Target['Table']['columnSchema'],
            S
          >,
          Alias
        >,
      ];
      isExplicitSelect: false;
      conditions: undefined;
      orderBy: undefined;
      queryName: undefined;
    },
    S
  >;

  function from<Target extends GenericEntityTarget<S>>(
    _entity: Target
  ): SelectQueryBuilder<
    {
      whereClause: undefined;
      entities: [
        {
          table: Target['Table'];
          alias: Target['Table']['defaultAlias'];
          isUsingAlias: true;
        },
      ];
      groupByClause: [];
      select: [
        ClauseForSelectListItem<
          ExpressionSelectColumns<
            {
              table: Target['Table'];
              alias: Target['Table']['defaultAlias'];
              isUsingAlias: true;
            },
            keyof Target['Table']['columnSchema'],
            S
          >,
          Target['Table']['defaultAlias']
        >,
      ];
      isExplicitSelect: false;
      conditions: undefined;
      orderBy: undefined;
      queryName: undefined;
    },
    S
  >;

  function from(
    entityOrConfig: GenericEntityTarget<S> | CompiledIndexConfigBase<S>,
    alias?: string,
    index?: string
  ): ReturnType<typeof baseFrom> {
    if (isIndexConfig<S>(entityOrConfig)) {
      return baseFrom(
        entityOrConfig,
        alias ?? entityOrConfig.Table.defaultAlias,
        entityOrConfig.index.name
      );
    }
    return baseFrom(entityOrConfig, alias, index);
  }

  function baseFrom(
    baseTarget: GenericEntityTarget<S>,
    alias?: string,
    index?: string,
    _context: QueryBuilderParams<S> | undefined = undefined
  ): SelectQueryBuilder<GenericAny, S> {
    const params = ((): QueryBuilderParams<S> => {
      if (!_context) {
        const entities: TargetList<S> = [
          {
            alias: alias ?? baseTarget.Table.defaultAlias,
            customIndex: index,
            table: baseTarget.Table,
            isUsingAlias: true,
          },
        ];
        const selector = createTableSelector(entities);
        return {
          entities,
          groupByClause: [],
          select: entities.map((entity) =>
            clauseForSelectListItem.create(
              selector[entity.alias].$columns('*')._expression
            )
          ),
          whereClause: undefined,
          isExplicitSelect: false,
          conditions: undefined,
          orderBy: undefined,
          queryName: undefined,
        };
      }
      return _context;
    })();

    // We construct the error here to ensure that the stack trace is correct later on
    const notFoundErrorWithCorrectStack = new Error('Not found');

    const builder: SelectQueryBuilder<GenericAny, S> = {
      // biome-ignore lint/suspicious/noThenProperty: We want this to thenable
      then: (resolve, reject) => {
        const isSimpleSelection = (() => {
          if (params.select.length > 1) {
            return false;
          }
          const selectExpression = params.select[0].expression;

          if (expressionSelectColumns.isNode(selectExpression)) {
            return (
              selectExpression.table.tableName === baseTarget.Table.tableName
            );
          }
          return false;
        })();
        const shouldReturnAliasDirectly =
          params.entities.length === 1 && isSimpleSelection;
        return builder
          .query({
            ...(params.throwsIfEmpty && {
              throwsIfEmpty: params.throwsIfEmpty,
            }),
          })
          .then((item) =>
            resolve?.(
              shouldReturnAliasDirectly
                ? (item.result.map(
                    (item) =>
                      item?.[params.entities[0].alias as keyof typeof item]
                  ) as GenericAny[])
                : (item.result as GenericAny[])
            )
          )
          .catch(reject) as GenericAny;
      },
      _debug: () => params,
      setQueryName: (queryName) => {
        return baseFrom(
          baseTarget,
          alias,
          index,
          updateQueryBuilderParams(params, {
            queryName,
          })
        );
      },
      asTable: (alias) =>
        asTarget({ _debug: () => params }, alias, queryRunner.discriminator),
      leftJoin: (nextTarget, options) => {
        const customIndex = isIndexConfig<S>(nextTarget)
          ? nextTarget.index.name
          : (options.index ?? undefined);
        const alias = options.alias ?? nextTarget.Table.defaultAlias;

        const tableSelector: TableSelector<GenericAny, S> = createTableSelector(
          extendTargetList(params.entities, {
            alias,
            customIndex,
            table: nextTarget.Table,
            join: {
              type: 'left',
              on: {} as ExpressionBase<GenericAny>,
              joinHint: options.joinHint,
            },
            isUsingAlias: true,
          })
        );

        const join: TargetJoinType = {
          on: options.on(tableSelector)._expression,
          type: 'left',
          joinHint: options.joinHint,
        };

        const newEntities = extendTargetList(params.entities ?? [], {
          customIndex,
          table: nextTarget.Table,
          alias,
          join,
          isUsingAlias: true,
        });

        return baseFrom(baseTarget, alias, index, {
          ...params,
          entities: newEntities,
          ...(!params.isExplicitSelect && {
            select: [
              ...params.select,
              clauseForSelectListItem.create(
                tableSelector[alias].$columns('*')._expression
              ),
            ],
          }),
        });
      },
      innerJoin: (nextTarget, options) => {
        const customIndex = isIndexConfig<S>(nextTarget)
          ? nextTarget.index.name
          : (options.index ?? undefined);
        const alias = options.alias ?? nextTarget.Table.defaultAlias;

        const tableSelector: TableSelector<GenericAny, S> = createTableSelector(
          extendTargetList(params.entities, {
            alias,
            customIndex,
            table: nextTarget.Table,
            join: {
              type: 'inner',
              on: {} as ExpressionBase<GenericAny>,
              joinHint: options.joinHint,
            },
            isUsingAlias: true,
          })
        );

        const join: TargetJoinType = {
          on: options.on(tableSelector)._expression,
          type: 'inner',
          joinHint: options.joinHint,
        };

        const newEntities = extendTargetList(params.entities ?? [], {
          customIndex,
          table: nextTarget.Table,
          alias,
          join,
          isUsingAlias: true,
        });

        return baseFrom(baseTarget, alias, index, {
          ...params,
          entities: newEntities,
          ...(!params.isExplicitSelect && {
            select: [
              ...params.select,
              clauseForSelectListItem.create(
                tableSelector[alias].$columns('*')._expression
              ),
            ],
          }),
        });
      },
      rightJoin: (nextTarget, options) => {
        const customIndex = isIndexConfig<S>(nextTarget)
          ? nextTarget.index.name
          : (options.index ?? undefined);
        const alias = options.alias ?? nextTarget.Table.defaultAlias;

        const tableSelector: TableSelector<GenericAny, S> = createTableSelector(
          extendTargetList(params.entities, {
            alias,
            customIndex,
            table: nextTarget.Table,
            join: {
              type: 'right',
              on: {} as ExpressionBase<GenericAny>,
              joinHint: options.joinHint,
            },
            isUsingAlias: true,
          })
        );

        const join: TargetJoinType = {
          on: options.on(tableSelector)._expression,
          type: 'right',
          joinHint: options.joinHint,
        };

        const newEntities = extendTargetList(params.entities ?? [], {
          customIndex,
          table: nextTarget.Table,
          alias,
          join,
          isUsingAlias: true,
        });

        return baseFrom(baseTarget, alias, index, {
          ...params,
          entities: newEntities,
          ...(!params.isExplicitSelect && {
            select: [
              ...params.select,
              clauseForSelectListItem.create(
                tableSelector[alias].$columns('*')._expression
              ),
            ],
          }),
        });
      },
      select: (fn) => {
        const res = fn(createTableSelector(params.entities));

        const select = qbSelectListToSelectClause(res);
        return baseFrom(
          baseTarget,
          alias,
          index,
          updateQueryBuilderParams(params, {
            select,
            isExplicitSelect: true,
          })
        );
      },
      where: (fn) => {
        const { _expression: expression } = fn(
          createTableSelector(params.entities)
        );
        const res = updateQueryBuilderParams(params, {
          whereClause: clauseFromExpression.create(expression),
        });

        return baseFrom(baseTarget, alias, index, res);
      },
      groupBy: (fn) => {
        const clauses = fn(createTableSelector(params.entities)).map(
          (expression) => {
            if (typeof expression === 'string') {
              return clauseForGroupByList.create(params, expression);
            } else {
              return clauseForGroupByList.create(params, [
                expression._expression.tableAlias,
                expression._expression.value,
              ]);
            }
          }
        );

        return baseFrom(
          baseTarget,
          alias,
          index,
          updateQueryBuilderParams(params, {
            groupByClause: clauses,
          })
        );
      },
      offset: (value) => {
        const newParams = updateQueryBuilderParams(params, {
          offset: value,
        });

        return baseFrom(baseTarget, alias, index, newParams);
      },
      limit: (value) => {
        const newParams = updateQueryBuilderParams(params, {
          limit: value,
        });

        return baseFrom(baseTarget, alias, index, newParams);
      },
      forUpdate: (opts) => {
        const newParams = updateQueryBuilderParams(params, {
          forUpdate: 'update' as const,
          ...(opts?.skipLocked && { skipLocked: true }),
        });

        return baseFrom(baseTarget, alias, index, newParams);
      },
      orderBy: (fn) => {
        const res = fn(createTableSelector(params.entities));
        const newParams = updateQueryBuilderParams(params, {
          orderBy: clauseForOrderByList.create(
            res.map((item) =>
              '_expression' in item
                ? { expression: item._expression, direction: 'asc' }
                : item
            )
          ),
        });

        return baseFrom(baseTarget, alias, index, newParams);
      },
      throwsIfEmpty: (err) => {
        const newParams = updateQueryBuilderParams(params, {
          throwsIfEmpty: err ?? true,
        });

        return baseFrom(baseTarget, alias, index, newParams);
      },
      async query(options) {
        const data = {
          queryRunner,
          ...(options?.throwsIfEmpty && {
            throwsIfEmpty: options.throwsIfEmpty,
          }),
        };

        if (options?.paginate) {
          return await paginateQueryResult(params, {
            ...data,
            limit: options.paginate.limit,
            currentData: [],
          });
        }

        const res = await runQueryResult(
          params,
          data,
          notFoundErrorWithCorrectStack
        );

        return res as GenericAny;
      },
      async queryAndNarrow() {
        const res = await runQueryResult(
          params,
          {
            queryRunner,
          },
          notFoundErrorWithCorrectStack
        );

        if (res.typeNarrowResult && !res.typeNarrowResult.passed) {
          throw new Error('Error while applying type narrowing');
        }

        return res;
      },
      assertResultsCondition: (fn) => {
        const res = fn(createResultAsserterBuilder(params));

        return baseFrom(
          baseTarget,
          alias,
          index,
          updateQueryBuilderParams(params, { conditions: res._getAst() })
        );
      },
      addTypeNarrower: (fn) => {
        const clauseBuilder = fn(createTableSelector(params.entities));
        return baseFrom(
          baseTarget,
          alias,
          index,
          updateQueryBuilderParams(params, {
            conditions: params.conditions
              ? {
                  ...params.conditions,
                  filter: params.conditions.filter
                    ? clauseFromExpression.create(
                        expressionLeftRightBinary.create({
                          leftExpr: params.conditions.filter.expr,
                          operator: operatorBinaryLogical.create('AND'),
                          rightExpr: clauseBuilder._expression,
                        })
                      )
                    : clauseFromExpression.create(clauseBuilder._expression),
                }
              : {
                  length: undefined,
                  filter: clauseFromExpression.create(
                    clauseBuilder._expression
                  ),
                },
          })
        );
      },
      getSqlString: () => {
        return writeSql(params);
      },
    };

    return builder;
  }

  return from;
}

function createResultAsserterBuilder<S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>
): ResultAssertBuilder<GenericAny, S> {
  return {
    _getAst() {
      return params.conditions;
    },
    length(value) {
      return createResultAsserterBuilder(
        updateQueryBuilderParams(params, {
          conditions: params.conditions
            ? {
                ...params.conditions,
                length: value,
              }
            : {
                length: value,
                filter: undefined,
              },
        })
      );
    },
  };
}

export type SelectBuilderToTable<
  Builder extends { _debug(): QueryBuilderParams<S> },
  Alias extends string,
  S extends BaseDbDiscriminator,
> = BuildTable<
  {
    type: 'table';
    class: 'table';
    columnSchema: Builder extends {
      _debug(): infer U extends QueryBuilderParams<S>;
    }
      ? ColumnsSelectList<U['select']> extends infer ColumnDataTypes extends {
          [Key in string]: DataTypeBase;
        }
        ? {
            [Key in Extract<keyof ColumnDataTypes, string>]: BuildColumn<{
              class: 'table_column';
              columnName: Key;
              dataType: ColumnDataTypes[Key];
              type: 'column';
              variant: 'column';
            }>;
          }
        : { u: ColumnsSelectList<U['select']> }
      : {};
    tableName: Alias;
    schema: string;
    variant: 'table';
    subquery: QueryBuilderParams<S>;
    defaultAlias: Alias;
    primaryKey: [];
    indexes: undefined;
    _internalIndexes: undefined;
    _databaseType: S;
  },
  S
>;

export type BuildTable<
  T extends TableBase<S>,
  S extends BaseDbDiscriminator,
> = T;
export type BuildColumn<T extends TableColumnBase> = T;

export function asTarget<
  Builder extends { _debug(): QueryBuilderParams<S> },
  Alias extends string,
  S extends BaseDbDiscriminator,
>(
  builder: Builder,
  alias: Alias,
  databaseType: S
): EntityTarget<SelectBuilderToTable<Builder, Alias, S>, S> {
  const params = builder._debug();
  const columns = params.select.reduce(
    (acc, selectItem) => {
      const aliases = selectItem.alias
        ? [selectItem.alias]
        : filterUndefined([...(selectItem.expression.inferredAliases ?? [])]);

      if (!aliases.length) {
        return acc;
      }

      return aliases.reduce((sacc, alias) => {
        return {
          ...sacc,
          [alias]: {
            class: 'table_column',
            columnName: alias,
            dataType: selectItem.expression.dataType,
            type: 'column',
            variant: 'column',
          } satisfies TableColumnBase,
        };
      }, acc);
    },
    {} as { [Key in string]: TableColumnBase }
  );
  return {
    Table: {
      class: 'table',
      columnSchema: columns as GenericAny,
      subquery: params,
      tableName: alias,
      schema: 'public',
      type: 'table',
      variant: 'table',
      defaultAlias: alias,
      primaryKey: [],
      indexes: undefined,
      _internalIndexes: undefined,
      _databaseType: databaseType,
    },
  };
}
