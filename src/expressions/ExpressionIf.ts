import type { DataTypeBase, ExpressionBase } from '../Base';
import {
  type DataTypeBoolean,
  type MergeDataTypesIntoUnion,
  createDataTypeUnion,
} from '../DataType';
import { getAstNodeRepository } from '../ast-node-repository';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';

export interface ExpressionIf<
  ConditionExpr extends ExpressionBase<DataTypeBoolean>,
  TrueExpr extends ExpressionBase<DataTypeBase>,
  FalseExpr extends ExpressionBase<TrueExpr['dataType']>,
> extends ExpressionBase<
    MergeDataTypesIntoUnion<TrueExpr['dataType'], FalseExpr['dataType']>
  > {
  type: 'if';
  variant: 'scalar_function_expression';
  conditionExpr: ConditionExpr;
  trueExpr: TrueExpr;
  falseExpr: FalseExpr;
  columnReferences: [
    ...TrueExpr['columnReferences'],
    ...FalseExpr['columnReferences'],
  ];
  inferredAliases: ['if'];
}

export const expressionIf = createAstNode<
  ExpressionIf<
    ExpressionBase<DataTypeBoolean>,
    ExpressionBase<DataTypeBase>,
    ExpressionBase<DataTypeBase>
  >
>()({
  class: 'expression',
  variant: 'scalar_function_expression',
  type: 'if',
  create: <
    OutputDataType extends DataTypeBase,
    ConditionExpr extends ExpressionBase<DataTypeBoolean>,
    TrueExpr extends ExpressionBase<OutputDataType>,
    FalseExpr extends ExpressionBase<OutputDataType>,
  >(
    conditionExpr: ConditionExpr,
    trueExpr: TrueExpr,
    falseExpr: FalseExpr
  ) => {
    return {
      class: 'expression',
      variant: 'scalar_function_expression',
      type: 'if',
      columnReferences: [
        ...trueExpr.columnReferences,
        ...falseExpr.columnReferences,
      ],
      dataType: createDataTypeUnion([trueExpr.dataType, falseExpr.dataType]),
      conditionExpr,
      trueExpr,
      falseExpr,
      inferredAliases: ['if'],
      isAggregate: false,
    };
  },
  writeSql: (node) => {
    const conditionExprSql = getAstNodeRepository(node.conditionExpr).writeSql(
      node.conditionExpr,
      node
    );
    const trueExprSql = getAstNodeRepository(node.trueExpr).writeSql(
      node.trueExpr,
      node
    );
    const falseExprSql = getAstNodeRepository(node.falseExpr).writeSql(
      node.falseExpr,
      node
    );
    return sql`IF(${conditionExprSql}, ${trueExprSql}, ${falseExprSql})`;
  },
});
