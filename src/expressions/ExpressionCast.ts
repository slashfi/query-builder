import type { DataTypeBase, ExpressionBase } from '../Base';
import { getNonNullableDataType } from '../DataType';
import { getAstNodeRepository } from '../ast-node-repository';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';

export interface ExpressionCast<
  Expr extends ExpressionBase<DataTypeBase>,
  ToDataType extends DataTypeBase,
> extends ExpressionBase<ToDataType> {
  variant: 'scalar_function_expression';
  type: 'cast';
  isAggregate: false;
  baseExpr: Expr;
  toDataType: ToDataType;
  columnReferences: Expr['columnReferences'];
  inferredAliases: [];
}

export const expressionCast = createAstNode<
  ExpressionCast<ExpressionBase<DataTypeBase>, DataTypeBase>
>()({
  class: 'expression',
  variant: 'scalar_function_expression',
  type: 'cast',
  create: <
    Expr extends ExpressionBase<DataTypeBase>,
    ToDataType extends DataTypeBase,
  >(
    expr: Expr,
    toDataType: ToDataType
  ) => {
    return {
      class: 'expression',
      variant: 'scalar_function_expression',
      type: 'cast',
      columnReferences: expr.columnReferences,
      dataType: toDataType,
      isAggregate: false,
      inferredAliases: [],
      baseExpr: expr,
      toDataType,
    };
  },
  writeSql: (node) => {
    return sql`CAST(${getAstNodeRepository(node.baseExpr).writeSql(
      node.baseExpr,
      node
    )} AS ${sql.rawIdentifier(getNonNullableDataType(node.toDataType).type)})`;
  },
});
