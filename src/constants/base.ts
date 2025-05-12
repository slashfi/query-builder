import type { DataTypeBase, ExpressionBase } from '../base';

export interface ConstantBase<DataType extends DataTypeBase>
  extends ExpressionBase<DataType> {
  variant: 'constant_expression';
  isAggregate: false;
  columnReferences: [];
}
