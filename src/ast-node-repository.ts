import type { AstNode } from './base';
import { clauseForGroupByList } from './clauses/clause-for-group-by';
import { clauseForOrderByList } from './clauses/clause-for-order-by';
import { clauseFromExpression } from './clauses/clause-from-expression';
import { clauseForSelectListItem } from './clauses/clausefor-select-list-item';
import { constantForArray } from './constants/constant-for-array';
import { constantForBoolean } from './constants/constant-for-boolean';
import { constantForFloat } from './constants/constant-for-float';
import { constantForInteger } from './constants/constant-for-integer';
import { constantForJson } from './constants/constant-for-json';
import { constantForTimestamp } from './constants/constant-for-timestamp';
import { constantForVarchar } from './constants/constant-for-varchar';
import { expressionBracket } from './expressions/expression-bracket';
import { expressionCast } from './expressions/expression-cast';
import { expressionColumn } from './expressions/expression-column';
import { expressionCount } from './expressions/expression-fn-count';
import { expressionDataDistributionFn } from './expressions/expression-fn-data-distribution';
import { expressionNullFallback } from './expressions/expression-fn-null-fallback';
import { expressionSum } from './expressions/expression-fn-sum';
import { expressionIf } from './expressions/expression-if';
import { expressionJsonPropertyAccess } from './expressions/expression-json-property-access';
import { expressionLeftRightBinary } from './expressions/expression-left-right-binary';
import { expressionNull } from './expressions/expression-null';
import { expressionRightUnaryBinary } from './expressions/expression-right-unary-binary';
import { expressionSelectColumns } from './expressions/expression-select-columns';
import { expressionSubqueryBinary } from './expressions/expression-subquery-binary';
import { expressionTuple } from './expressions/expression-tuple';
import { operatorBinaryComparator } from './operators/operator-binary-comparator';
import { operatorBinaryLogical } from './operators/operator-binary-logical';
import { operatorBinarySimilarity } from './operators/operator-binary-similarity';
import { operatorLogicalAnd } from './operators/operator-logical-and';
import { operatorLogicalOr } from './operators/operator-logical-or';
import { operatorUnaryIs } from './operators/operator-unary-is';
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
