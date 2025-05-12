import { getAstNodeRepository } from '../ast-node-repository';
import type { DataTypeBase, ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';
import { type DataTypeTuple, createDataTypeTuple } from '../data-type';
import { sql } from '../sql-string';
import type { Flat } from '../util';

export interface ExpressionTuple<
  Tuple extends ReadonlyArray<ExpressionBase<any>>,
> extends ExpressionBase<DataTypeTuple<ExpressionTupleToDataTypeTuple<Tuple>>> {
  isNullable: false;
  variant: 'tuple';
  type: 'tuple';
  values: Tuple;
  isAggregate: false;
  columnReferences: Flat<{
    [Key in keyof Tuple]: Tuple[Key] extends ExpressionBase<any>
      ? Tuple[Key]['columnReferences']
      : never;
  }>;
}

export const expressionTuple = createAstNode<
  ExpressionTuple<ReadonlyArray<ExpressionBase<any>>>
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
      columnReferences: data.flatMap((value) => value.columnReferences) as any,
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
  T extends ReadonlyArray<ExpressionBase<any>>,
> = {
  [Key in keyof T]: T[Key] extends ExpressionBase<
    infer DataType extends DataTypeBase
  >
    ? DataType
    : never;
};
