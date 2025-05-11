import type { AstNode } from './Base';
import { clauseForGroupByList } from './clauses/ClauseForGroupBy';
import { clauseForOrderByList } from './clauses/ClauseForOrderBy';
import { clauseForSelectListItem } from './clauses/ClauseForSelectListItem';
import { clauseFromExpression } from './clauses/ClauseFromExpression';
import { constantForArray } from './constants/ConstantForArray';
import { constantForBoolean } from './constants/ConstantForBoolean';
import { constantForFloat } from './constants/ConstantForFloat';
import { constantForInteger } from './constants/ConstantForInteger';
import { constantForJson } from './constants/ConstantForJson';
import { constantForTimestamp } from './constants/ConstantForTimestamp';
import { constantForVarchar } from './constants/ConstantForVarchar';
import { expressionBracket } from './expressions/ExpressionBracket';
import { expressionCast } from './expressions/ExpressionCast';
import { expressionColumn } from './expressions/ExpressionColumn';
import { expressionCount } from './expressions/ExpressionFnCount';
import { expressionDataDistributionFn } from './expressions/ExpressionFnDataDistribution';
import { expressionNullFallback } from './expressions/ExpressionFnNullFallback';
import { expressionSum } from './expressions/ExpressionFnSum';
import { expressionIf } from './expressions/ExpressionIf';
import { expressionJsonPropertyAccess } from './expressions/ExpressionJsonPropertyAccess';
import { expressionLeftRightBinary } from './expressions/ExpressionLeftRightBinary';
import { expressionNull } from './expressions/ExpressionNull';
import { expressionRightUnaryBinary } from './expressions/ExpressionRightUnaryBinary';
import { expressionSelectColumns } from './expressions/ExpressionSelectColumns';
import { expressionSubqueryBinary } from './expressions/ExpressionSubqueryBinary';
import { expressionTuple } from './expressions/ExpressionTuple';
import { operatorBinaryComparator } from './operators/OperatorBinaryComparator';
import { operatorBinaryLogical } from './operators/OperatorBinaryLogical';
import { operatorBinarySimilarity } from './operators/OperatorBinarySimilarity';
import { operatorLogicalAnd } from './operators/OperatorLogicalAnd';
import { operatorLogicalOr } from './operators/OperatorLogicalOr';
import { operatorUnaryIs } from './operators/OperatorUnaryIs';
import type { SqlString } from './sql-string';
import { tableNodeForValues } from './values-builder';

export interface AstNodeRepository<Node extends AstNode> {
  class: Node['class'];
  variant: Node['variant'];
  type: Node['type'];
  create: (...params: any[]) => Node;
  writeSql: (val: Node, parent: Node | undefined) => SqlString;
  isNode: (val: AstNode) => val is Node;
}

export function getAstNodeRepository(node: AstNode): AstNodeRepository<any> {
  const nodes = [
    clauseForSelectListItem,
    clauseFromExpression,
    clauseForGroupByList,
    clauseForOrderByList,
    expressionColumn,
    expressionLeftRightBinary,
    expressionRightUnaryBinary,
    expressionSelectColumns,
    expressionSubqueryBinary,
    expressionTuple,
    expressionDataDistributionFn,
    expressionSum,
    expressionCount,
    expressionIf,
    expressionNullFallback,
    expressionBracket,
    expressionNull,
    expressionCast,
    expressionJsonPropertyAccess,
    operatorBinaryComparator,
    operatorBinarySimilarity,
    operatorBinaryLogical,
    operatorLogicalAnd,
    operatorLogicalOr,
    operatorUnaryIs,
    constantForArray,
    constantForBoolean,
    constantForFloat,
    constantForInteger,
    constantForJson,
    constantForTimestamp,
    constantForVarchar,
    tableNodeForValues,
  ];

  const repo = nodes.find(
    (val) =>
      val.class === node.class &&
      val.variant === node.variant &&
      val.type === node.type
  );

  if (!repo) {
    throw new Error(`Couldn't find repository for node`);
  }

  return repo;
}

export function getNodeName(astNode: AstNode) {
  return `${astNode.class}.${astNode.variant}.${astNode.type}`;
}
