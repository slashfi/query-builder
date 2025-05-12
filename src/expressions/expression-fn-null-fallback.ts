import { assertUnreachable } from '@/core-utils';
import { getAstNodeRepository } from '../ast-node-repository';
import type { ColumnReference, DataTypeBase, ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';
import { type SqlString, sql } from '../sql-string';
import type {
  AggregateColumnReferences,
  AggregateExpressionBase,
} from './aggregate-expression-base';

type Options = 'ifnull' | 'coalesce';

export interface ExpressionAggregateNullFallback<
  Expr extends ExpressionBase<DataTypeBase>,
  Type extends Options,
  FallbackValues extends ReadonlyArray<ExpressionBase<DataTypeBase>>,
> extends AggregateExpressionBase<Expr['dataType']> {
  type: 'null_fallback';
  expr: Expr;
  columnReferences: Expr['columnReferences'] extends infer U extends
    ReadonlyArray<ColumnReference>
    ? AggregateColumnReferences<U>
    : [];
  inferredAliases: [Type];
  value: Type;
  fallbackValues: FallbackValues;
}

export const expressionNullFallback = createAstNode<
  ExpressionAggregateNullFallback<
    ExpressionBase<DataTypeBase>,
    Options,
    ReadonlyArray<ExpressionBase<any>>
  >
>()({
  class: 'expression',
  variant: 'aggregate_expression',
  type: 'null_fallback',
  create: <
    Expr extends ExpressionBase<DataTypeBase>,
    Option extends Options,
    FallbackValues extends ReadonlyArray<ExpressionBase<DataTypeBase>>,
  >(
    expr: Expr,
    option: Option,
    fallbackValues: FallbackValues
  ) => {
    return {
      class: 'expression',
      variant: 'aggregate_expression',
      type: 'null_fallback',
      columnReferences: [...expr.columnReferences].map(([column]) => [
        column,
        true,
      ]),
      dataType: expr.dataType,
      expr: expr,
      inferredAliases: [option],
      isAggregate: true,
      fallbackValues,
      value: option,
    };
  },
  writeSql: (node) => {
    const nodeSql = getAstNodeRepository(node.expr).writeSql(node.expr, node);
    const fallbackValuesSql = node.fallbackValues.map((fallback) =>
      getAstNodeRepository(fallback).writeSql(fallback, node)
    );

    const nullFallbackSql: SqlString = (() => {
      switch (node.value) {
        case 'ifnull':
          return sql`IFNULL`;
        case 'coalesce':
          return sql`COALESCE`;
        default:
          throw assertUnreachable(node.value);
      }
    })();

    return sql`${nullFallbackSql}(${sql.join(
      [nodeSql, ...fallbackValuesSql],
      ', '
    )})`;
  },
});
