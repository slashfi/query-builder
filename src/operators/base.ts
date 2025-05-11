import type { DataTypeBase, OperatorBase } from '../Base';

export interface OperatorBinaryBase extends OperatorBase {
  class: 'operator';
  variant: 'binary_operator';
  value: string;
  supportedDataTypes: ReadonlyArray<DataTypeBase>;
}

export interface OperatorUnaryBase extends OperatorBase {
  class: 'operator';
  variant: 'unary_operator';
  value: string;
  supportedDataTypes: ReadonlyArray<DataTypeBase>;
}

export interface OperatorLogicalBase {
  class: 'operator';
  variant: 'logical_operator';
  type: string;
  value: string;
}
