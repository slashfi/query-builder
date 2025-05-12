import type { BaseDbDiscriminator } from './base';
import { createExpressionBuilder } from './expression-builder';
import type {
  CompositeSelectionBuilder,
  ExpressionBuilder,
} from './expression-builder-type';
import {
  type ExpressionColumn,
  expressionColumn,
} from './expressions/expression-column';
import { expressionSelectColumns } from './expressions/expression-select-columns';
import type {
  GetEntityFromTargetList,
  TargetBase,
  TargetList,
} from './from-builder';

export type TableSelector<
  List extends TargetList<S>,
  S extends BaseDbDiscriminator,
> = {
  [Alias in List[number]['alias']]: CompositeSelectionBuilder<
    GetEntityFromTargetList<List, Alias, S>,
    S
  >;
};

export function createTableSelector<
  Entities extends TargetList<S>,
  S extends BaseDbDiscriminator,
>(entities: Entities): TableSelector<Entities, S> {
  const values = entities.map(
    (entity): [string, CompositeSelectionBuilder<TargetBase<S>, S>] => {
      const alias = entity.alias;

      const res = entities.find((entity) => entity.alias === alias);
      if (!res) {
        throw new Error();
      }

      const expressionBuilders = Object.fromEntries(
        Object.entries(entity.table.columnSchema).map(([, value]) => {
          const baseExprBuilder = createExpressionBuilder(
            expressionColumn.create(res, value.columnName)
          );

          return [value.columnName, baseExprBuilder];
        })
      );

      return [
        alias,
        {
          ...expressionBuilders,
          $columns: (
            params:
              | '*'
              | Record<
                  string,
                  ExpressionBuilder<ExpressionColumn<any, string, S>, S>
                >
          ) => {
            if (typeof params === 'string') {
              return createExpressionBuilder(
                expressionSelectColumns.create(
                  entity,
                  Object.keys(entity.table.columnSchema)
                )
              );
            }

            return createExpressionBuilder(
              expressionSelectColumns.create(entity, Object.keys(params))
            );
          },
        } as CompositeSelectionBuilder<TargetBase<S>, S>,
      ];
    }
  );

  return Object.fromEntries(values) as unknown as TableSelector<Entities, S>;
}
