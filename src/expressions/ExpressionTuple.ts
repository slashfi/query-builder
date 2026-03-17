import type { GenericAny } from '@/core-utils';
import { getAstNodeRepository } from '../ast-node-repository';
import type { DataTypeBase, ExpressionBase } from '../Base';
import { createAstNode } from '../createAstNode';
import { createDataTypeTuple, type DataTypeTuple } from '../DataType';
import { sql } from '../sql-string';
import type { Flat } from '../util';

export interface ExpressionTuple<
  Tuple extends ReadonlyArray<ExpressionBase<GenericAny>>,
> extends ExpressionBase<DataTypeTuple<ExpressionTupleToDataTypeTuple<Tuple>>> {
  isNullable: false;
  variant: 'tuple';
  type: 'tuple';
  values: Tuple;
  isAggregate: false;
  columnReferences: Flat<{
    [Key in keyof Tuple]: Tuple[Key] extends ExpressionBase<GenericAny>
      ? Tuple[Key]['columnReferences']
      : never;
  }>;
}

export const expressionTuple = createAstNode<
  ExpressionTuple<ReadonlyArray<ExpressionBase<GenericAny>>>
>()({
  class: 'expression',
  variant: 'tuple',
  type: 'tuple',
  create: <T extends ReadonlyArray<ExpressionBase<DataTypeBase>>>(
    data: T
  ): ExpressionTuple<T> => {
    return {
      class: 'expression',
      variant: 'tuple',
      type: 'tuple',
      values: data,
      isNullable: false,
      isAggregate: false,
      columnReferences: data.flatMap(
        (value) => value.columnReferences
      ) as GenericAny,
      dataType: createDataTypeTuple(
        data.map((value) => value.dataType)
      ) as DataTypeTuple<ExpressionTupleToDataTypeTuple<T>>,
    };
  },
  writeSql: (data) => {
    return sql`(${sql.join(
      data.values.map((value) =>
        getAstNodeRepository(value).writeSql(value, undefined)
      ),
      ', '
    )})`;
  },
});

type ExpressionTupleToDataTypeTuple<
  T extends ReadonlyArray<ExpressionBase<GenericAny>>,
> = {
  [Key in keyof T]: T[Key] extends ExpressionBase<
    infer DataType extends DataTypeBase
  >
    ? DataType
    : never;
};
