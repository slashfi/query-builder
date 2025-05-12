import { assertUnreachable } from '@/core-utils';
import { getAstNodeRepository } from '../ast-node-repository';
import type { BaseDbDiscriminator, ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';
import { type DataTypeBoolean, createDataTypeBoolean } from '../data-type';
import { dataTypeToConstant } from '../expression-builder';
import type { DataTypeFromExpression } from '../expression-builder-type';
import type { QueryBuilderParams } from '../query-builder-params';
import { type SqlString, sql } from '../sql-string';
import { writeSql } from '../write-sql';

type SubqueryComparator = 'IN' | 'NOT IN' | 'EXISTS' | 'ALL' | 'SOME' | 'ANY';

function getSubqueryComparatorSql(comparator: SubqueryComparator): SqlString {
  switch (comparator) {
    case 'IN':
      return sql`IN`;
    case 'NOT IN':
      return sql`NOT IN`;
    case 'EXISTS':
      return sql`EXISTS`;
    case 'ALL':
      return sql`ALL`;
    case 'SOME':
      return sql`SOME`;
    case 'ANY':
      return sql`ANY`;
    default:
      throw assertUnreachable(comparator);
  }
}

export interface ExpressionSubqueryBinary<
  LeftExpr extends ExpressionBase<any>,
  Comparator extends SubqueryComparator,
  Qb extends
    | { _debug(): QueryBuilderParams<S> }
    | ReadonlyArray<
        | DataTypeFromExpression<LeftExpr>['narrowedTypes']
        | DataTypeFromExpression<LeftExpr>['baseExpression']
      >,
  S extends BaseDbDiscriminator,
> extends ExpressionBase<DataTypeBoolean<boolean>> {
  comparator: Comparator;
  table: Qb;
  isAggregate: false;
  inferredAliases: [];
  variant: 'binary_expression';
  type: 'subquery_comparator';
  leftExpr: LeftExpr;
  columnReferences: LeftExpr['columnReferences'];
}

export const expressionSubqueryBinary = createAstNode<
  ExpressionSubqueryBinary<
    ExpressionBase<any>,
    SubqueryComparator,
    { _debug(): QueryBuilderParams<BaseDbDiscriminator> } | ReadonlyArray<any>,
    BaseDbDiscriminator
  >
>()({
  class: 'expression',
  variant: 'binary_expression',
  type: 'subquery_comparator',
  create: <
    LeftExpr extends ExpressionBase<any>,
    Comparator extends 'IN' | 'NOT IN',
    Qb extends
      | { _debug(): QueryBuilderParams<S> }
      | ReadonlyArray<
          | DataTypeFromExpression<LeftExpr>['narrowedTypes']
          | DataTypeFromExpression<LeftExpr>['baseExpression']
        >,
    S extends BaseDbDiscriminator,
  >(options: {
    leftExpr: LeftExpr;
    comparator: Comparator;
    qb: Qb;
  }): ExpressionSubqueryBinary<LeftExpr, Comparator, Qb, S> => {
    return {
      class: 'expression',
      variant: 'binary_expression',
      type: 'subquery_comparator',
      columnReferences: [...options.leftExpr.columnReferences],
      comparator: options.comparator,
      dataType: createDataTypeBoolean({ isNullable: false }),
      isAggregate: false,
      leftExpr: options.leftExpr,
      table: options.qb,
      inferredAliases: [],
    };
  },
  writeSql: (node) => {
    const leftExprSql = getAstNodeRepository(node.leftExpr).writeSql(
      node.leftExpr,
      node
    );

    const comparatorSql = getSubqueryComparatorSql(node.comparator);

    if (Array.isArray(node.table)) {
      const items = node.table.map((val) => {
        const constNode = dataTypeToConstant(node.leftExpr.dataType, val);

        return getAstNodeRepository(constNode).writeSql(constNode, node);
      });
      return sql`${leftExprSql} ${comparatorSql} (${sql.join(items, ', ')})`;
    }

    if (!('_debug' in node.table)) {
      throw new Error('Invalid subquery');
    }

    return sql`${leftExprSql} ${comparatorSql} (${writeSql(node.table._debug())})`;
  },
});
