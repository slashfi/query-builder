import type {
  BaseDbDiscriminator,
  ClauseBase,
  DataTypeBase,
  ExpressionBase,
} from '../Base';
import type { QueryBuilderParams } from '../QueryBuilderParams';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';

export type GroupByClauseTarget =
  | [tableAlias: string, columnAlias: string]
  | string;

export interface ClauseForGroupByList<Value extends GroupByClauseTarget>
  extends ClauseBase<DataTypeBase> {
  variant: 'group_by_clause';
  /**
   * Either an alias of the column or the index of the select clause
   */
  targetInList: Value;
}

export const clauseForGroupByList = createAstNode<
  ClauseForGroupByList<GroupByClauseTarget>
>()({
  class: 'clause',
  variant: 'group_by_clause',
  type: 'group_by_clause',
  create: <
    Value extends [tableAlias: string, column: string] | string,
    S extends BaseDbDiscriminator,
  >(
    params: QueryBuilderParams<S>,
    value: Value
  ): ClauseForGroupByList<Value> => {
    const dataType = (() => {
      if (typeof value !== 'string') {
        const entity = params.entities.find(
          (entity) => entity.alias === value[0]
        );
        if (!entity) {
          throw new Error('No entity found for alias');
        }

        const columnData = entity.table.columnSchema[value[1]];
        if (!columnData) {
          throw new Error(`No column found '${value[1]}' in table ${value[0]}`);
        }

        return columnData.dataType;
      }
      const finalDataType = params.select
        .map((selection) => {
          if (Array.isArray(selection)) {
            if (value === selection[1]) {
              return selection[0]._expression.dataType;
            }
          } else {
            if (
              (
                selection.expression as ExpressionBase<DataTypeBase>
              ).inferredAliases?.some((alias) => alias === value)
            ) {
              return selection.expression.dataType;
            }
          }
        })
        .find((val) => !!val);

      if (!finalDataType) {
        throw new Error(
          `No matching alias in selection array for alias ${value}`
        );
      }

      return finalDataType;
    })();
    return {
      class: 'clause',
      variant: 'group_by_clause',
      type: 'group_by_clause',
      targetInList: value,
      dataType: dataType,
    };
  },
  writeSql: (node) =>
    typeof node.targetInList === 'string'
      ? sql.column({ name: node.targetInList })
      : sql.column({ table: node.targetInList[0], name: node.targetInList[1] }),
});
