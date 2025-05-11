import { type IsAny, assertUnreachable } from '@/core-utils';
import type { ColumnReference, ExpressionBase } from '../Base';
import {
  type DataTypeBoolean,
  type DataTypeFloat,
  type DataTypeInteger,
  type DataTypeNull,
  type DataTypeTimestamp,
  type DataTypeUnion,
  type DataTypeVarchar,
  type MakeDataTypeNullable,
  makeDataTypeNullable,
} from '../DataType';
import { getAstNodeRepository } from '../ast-node-repository';
import { createAstNode } from '../createAstNode';
import type {
  AggregateColumnReferences,
  AggregateExpressionBase,
} from '../expressions/AggregateExpressionBase';
import { type SqlString, sql } from '../sql-string';

export type ValidDataTypesForAggregateDataDistribution =
  | DataTypeFloat
  | DataTypeInteger
  | DataTypeVarchar
  | DataTypeTimestamp
  | DataTypeBoolean
  | DataTypeUnion<[DataTypeFloat, DataTypeNull]>
  | DataTypeUnion<[DataTypeInteger, DataTypeNull]>
  | DataTypeUnion<[DataTypeVarchar, DataTypeNull]>
  | DataTypeUnion<[DataTypeTimestamp, DataTypeNull]>
  | DataTypeUnion<[DataTypeBoolean, DataTypeNull]>;

type Options = 'min' | 'max' | 'avg';

export interface ExpressionAggregateDataDistribution<
  Expr extends ExpressionBase<ValidDataTypesForAggregateDataDistribution>,
  Value extends Options,
> extends AggregateExpressionBase<MakeDataTypeNullable<Expr['dataType']>> {
  type: 'data_distribution_function';
  expr: Expr;
  columnReferences: IsAny<Expr> extends true
    ? ReadonlyArray<ColumnReference>
    : Expr['columnReferences'] extends infer U extends
          ReadonlyArray<ColumnReference>
      ? AggregateColumnReferences<U>
      : [];
  inferredAliases: [Value];
  value: Value;
}

export const expressionDataDistributionFn = createAstNode<
  ExpressionAggregateDataDistribution<ExpressionBase<any>, Options>
>()({
  class: 'expression',
  variant: 'aggregate_expression',
  type: 'data_distribution_function',
  create: <
    Expr extends ExpressionBase<ValidDataTypesForAggregateDataDistribution>,
    Option extends Options,
  >(
    expr: Expr,
    option: Option
  ): ExpressionAggregateDataDistribution<Expr, Option> => {
    return {
      class: 'expression',
      variant: 'aggregate_expression',
      type: 'data_distribution_function',
      columnReferences: [...expr.columnReferences].map(([column]) => [
        column,
        true,
      ]) as any,
      dataType: makeDataTypeNullable(expr.dataType) as MakeDataTypeNullable<
        Expr['dataType']
      >,
      expr: expr,
      inferredAliases: [option],
      isAggregate: true,
      value: option,
    };
  },
  writeSql: (node) => {
    const nodeSql = getAstNodeRepository(node.expr).writeSql(node.expr, node);

    const aggregationSql: SqlString = (() => {
      switch (node.value) {
        case 'min':
          return sql`MIN`;
        case 'max':
          return sql`MAX`;
        case 'avg':
          return sql`AVG`;
        default:
          throw assertUnreachable(node.value);
      }
    })();

    return sql`${aggregationSql}(${nodeSql})`;
  },
});
