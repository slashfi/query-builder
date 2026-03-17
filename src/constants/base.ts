import type { DataTypeBase, ExpressionBase } from '../Base';

export interface ConstantBase<DataType extends DataTypeBase>
  extends ExpressionBase<DataType> {
  variant: 'constant_expression';
  isAggregate: false;
  columnReferences: [];
}
