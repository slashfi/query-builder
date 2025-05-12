import { getAstNodeRepository } from '../ast-node-repository';
import type { ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';
import {
  type DataTypeJson,
  type DataTypeVarchar,
  type MakeDataTypeNullable,
  createDataTypeVarchar,
  makeDataTypeNullable,
} from '../data-type';
import { sql } from '../sql-string';

export interface ExpressionJsonPropertyAccess<
  Expr extends ExpressionBase<DataTypeJson>,
  Properties extends string[],
  FinalAccessToString extends boolean,
> extends ExpressionBase<MakeDataTypeNullable<DataTypeJson | DataTypeVarchar>> {
  variant: 'json_property_access_expression';
  type: 'json_property_access';
  isAggregate: false;
  columnReferences: Expr['columnReferences'];
  inferredAliases: [];
  properties: Properties;
  baseExpr: Expr;
  /**
   * If true, the access will be converted to a string.
   */
  isFinalAccessToString: FinalAccessToString;
}

export const expressionJsonPropertyAccess = createAstNode<
  ExpressionJsonPropertyAccess<ExpressionBase<any>, string[], boolean>
>()({
  class: 'expression',
  variant: 'json_property_access_expression',
  type: 'json_property_access',
  create: <
    Expr extends ExpressionBase<DataTypeJson>,
    Properties extends string[],
    FinalAccessToString extends boolean,
  >(
    expr: Expr,
    properties: Properties,
    isFinalAccessToString: FinalAccessToString
  ) => {
    return {
      class: 'expression',
      variant: 'json_property_access_expression',
      type: 'json_property_access',
      columnReferences: expr.columnReferences,
      dataType: isFinalAccessToString
        ? createDataTypeVarchar({ isNullable: true })
        : makeDataTypeNullable(expr.dataType),
      isAggregate: false,
      inferredAliases: [],
      properties,
      isFinalAccessToString,
      baseExpr: expr,
    };
  },
  writeSql: (node, parent) => {
    return sql`${getAstNodeRepository(node.baseExpr).writeSql(
      node.baseExpr,
      parent
    )}${sql.join(
      node.properties.map((prop, index) =>
        index === node.properties.length - 1 && node.isFinalAccessToString
          ? sql`->>${sql.p(prop)}`
          : sql`->${sql.p(prop)}`
      ),
      ''
    )}`;
  },
});
