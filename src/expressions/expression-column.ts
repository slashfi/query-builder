import { type AnyOf, type IsAny, assertUnreachable } from '@/core-utils';
import type { TargetBase, TargetJoinType } from 'src/from-builder';
import type {
  BaseDbDiscriminator,
  DataTypeBase,
  ExpressionBase,
} from '../base';
import { createAstNode } from '../create-ast-node';
import { type MakeDataTypeNullable, makeDataTypeNullable } from '../data-type';
import { sql } from '../sql-string';

export interface ExpressionColumn<
  Base extends TargetBase<S>,
  ColumnName extends string,
  S extends BaseDbDiscriminator,
> extends ExpressionBase<
    IsAny<Base> extends true
      ? DataTypeBase
      : AnyOf<[IsJoinTypeNullable<Base['join']>]> extends true
        ? MakeDataTypeNullable<
            Base['table']['columnSchema'][ColumnName]['dataType']
          >
        : Base['table']['columnSchema'][ColumnName]['dataType']
  > {
  variant: 'column_expression';
  type: 'column';
  tableAlias: Base['alias'];
  isUsingAlias: boolean;
  value: ColumnName;
  columnReferences: readonly [[ExpressionColumn<Base, ColumnName, S>, false]];
  inferredAliases: [`${Base['alias']}_${ColumnName}`];
}

export const expressionColumn = createAstNode<
  ExpressionColumn<TargetBase<BaseDbDiscriminator>, string, BaseDbDiscriminator>
>()({
  class: 'expression',
  variant: 'column_expression',
  type: 'column',
  create: <
    Base extends TargetBase<S>,
    ColumnName extends string,
    S extends BaseDbDiscriminator,
  >(
    base: Base,
    columnName: ColumnName
  ): ExpressionColumn<Base, ColumnName, S> => {
    const column = base.table.columnSchema[columnName];

    if (!column) {
      throw new Error('Column not found');
    }
    const shouldForceNullable = isJoinTypeNullable(base.join);

    const columnReference = {
      class: 'expression',
      variant: 'column_expression',
      type: 'column',
      tableAlias: base.alias,
      isAggregate: false,
      isUsingAlias: base.isUsingAlias,
      value: columnName,
      dataType: shouldForceNullable
        ? makeDataTypeNullable(column.dataType)
        : column.dataType,
      inferredAliases: [`${base.alias}_${columnName}`],
    } as Omit<
      ExpressionColumn<Base, ColumnName, S>,
      'columnReferences'
    > as ExpressionColumn<Base, ColumnName, S>;

    return {
      ...columnReference,
      columnReferences: [[columnReference, false]],
    } as ExpressionColumn<Base, ColumnName, S>;
  },
  writeSql: (node) => {
    return sql.column({
      table: node.isUsingAlias ? node.tableAlias : undefined,
      name: node.value,
    });
  },
});

export function isJoinTypeNullable(joinType: TargetJoinType | undefined) {
  if (!joinType) {
    return false;
  }
  switch (joinType.type) {
    case 'left':
      return true;
    case 'right':
    case 'insert':
      return false;
    default:
      throw assertUnreachable(joinType);
  }
}

export type IsJoinTypeNullable<JoinType extends TargetJoinType | undefined> =
  JoinType extends TargetJoinType
    ? JoinType['type'] extends 'left'
      ? true
      : false
    : false;
