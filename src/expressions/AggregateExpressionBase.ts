import type { ColumnReference, DataTypeBase, ExpressionBase } from '../Base';

export interface AggregateExpressionBase<DataType extends DataTypeBase>
  extends ExpressionBase<DataType> {
  variant: 'aggregate_expression';
  isAggregate: true;
}

export type AggregateColumnReferences<
  T extends ReadonlyArray<ColumnReference>,
> = {
  [Key in keyof T]: T[Key] extends readonly [infer U, boolean]
    ? [U, true]
    : never;
};
