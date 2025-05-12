import { getNodeName } from './ast-node-repository';
import type { BaseDbDiscriminator, ClauseBase, ExpressionBase } from './base';
import { clauseFromExpression } from './clauses/clause-from-expression';
import type { ConditionParams } from './conditional-params';
import { constantForArray } from './constants/constant-for-array';
import { constantForBoolean } from './constants/constant-for-boolean';
import { constantForFloat } from './constants/constant-for-float';
import { constantForInteger } from './constants/constant-for-integer';
import { constantForJson } from './constants/constant-for-json';
import { constantForTimestamp } from './constants/constant-for-timestamp';
import { constantForVarchar } from './constants/constant-for-varchar';
import { expressionBracket } from './expressions/expression-bracket';
import { expressionColumn } from './expressions/expression-column';
import { expressionIf } from './expressions/expression-if';
import { expressionLeftRightBinary } from './expressions/expression-left-right-binary';
import { expressionRightUnaryBinary } from './expressions/expression-right-unary-binary';
import { expressionSelectColumns } from './expressions/expression-select-columns';
import {
  type BinaryComparatorOptions,
  type OperatorBinaryComparator,
  operatorBinaryComparator,
} from './operators/operator-binary-comparator';
import { operatorBinaryLogical } from './operators/operator-binary-logical';
import { operatorUnaryIs } from './operators/operator-unary-is';
import type { QueryBuilderParams } from './query-builder-params';

export type TypeNarrowResult<T = any> = {
  passed: boolean;
  context: any;
  items: T[];
};

export function applyTypeNarrow<S extends BaseDbDiscriminator>(
  result: any[],
  params: QueryBuilderParams<S>,
  conditions: ConditionParams
): TypeNarrowResult {
  if (typeof conditions.length === 'number') {
    if (conditions.length !== result.length) {
      return {
        passed: false,
        context: {
          reason: `LENGTH_ASSERTION_FAILED: expected length of ${conditions.length} but instead received ${result.length}`,
          expectedLength: conditions.length,
          length: result.length,
        },
        items: result,
      };
    }
  }
  const res = conditions.filter
    ? applyTypeNarrowingOnClause(result, params, conditions.filter)
    : undefined;

  if (res && !res.passed) {
    return res;
  }

  return {
    passed: true,
    context: undefined,
    items: result,
  };
}

function applyTypeNarrowingOnClause<S extends BaseDbDiscriminator>(
  result: any[],
  params: QueryBuilderParams<S>,
  clause: ClauseBase<any>
): TypeNarrowResult {
  if (clauseFromExpression.isNode(clause)) {
    return applyTypeNarrowingOnExpression(result, params, clause.expr);
  }

  return {
    passed: false,
    context: {
      reason: `${getNodeName(clause)} is not narrowable`,
    },
    items: result,
  };
}

function applyTypeNarrowingOnExpression<S extends BaseDbDiscriminator>(
  result: any[],
  params: QueryBuilderParams<S>,
  expression: ExpressionBase<any>
): TypeNarrowResult {
  if (expressionLeftRightBinary.isNode(expression)) {
    const operator = expression.operator;

    if (operatorBinaryLogical.isNode(operator)) {
      const leftPassed = applyTypeNarrowingOnExpression(
        result,
        params,
        expression.leftExpr
      );
      const rightPassed = applyTypeNarrowingOnExpression(
        result,
        params,
        expression.rightExpr
      );
      switch (operator.value) {
        case 'AND': {
          return {
            passed: leftPassed.passed && rightPassed.passed,
            context:
              leftPassed.passed && rightPassed.passed
                ? undefined
                : (leftPassed.context ?? rightPassed.context),
            items: result,
          };
        }
        case 'OR': {
          return {
            passed: leftPassed.passed || rightPassed.passed,
            context:
              leftPassed.passed || rightPassed.passed
                ? undefined
                : (leftPassed.context ?? rightPassed.context),
            items: result,
          };
        }
        default:
          return {
            passed: false,
            context: {
              reason: `${getNodeName(expression)} with type "${
                expression.type
              }" is not supported for type narrowing`,
              expressionType: expression.type,
            },
            items: result,
          };
      }
    } else if (operatorBinaryComparator.isNode(operator)) {
      const leftEvalRes = evaluateExpression(
        result,
        params,
        expression.leftExpr
      );
      const rightEvalRes = evaluateExpression(
        result,
        params,
        expression.leftExpr
      );
      if (!leftEvalRes) {
        return {
          passed: false,
          context: {
            reason: `Could not evaluate LH expression for ${getNodeName(
              expression.leftExpr
            )}`,
            leftExpr: expression.leftExpr,
          },
          items: result,
        };
      }
      if (!rightEvalRes) {
        return {
          passed: false,
          context: {
            reason: `Could not evaluate RH expression for ${getNodeName(
              expression.leftExpr
            )}`,
            rightExpr: expression.rightExpr,
          },
          items: result,
        };
      }

      if (leftEvalRes.length !== rightEvalRes.length) {
        throw new Error(
          'LH expression length does not match RH expression length'
        );
      }

      const evaluations = leftEvalRes.map((left, index) => {
        return compareEvaluatedExpressions(
          left,
          rightEvalRes[index],
          expression.operator as OperatorBinaryComparator<BinaryComparatorOptions>
        );
      });

      const badEvaluation = evaluations.find((val) => !val.passed);

      if (badEvaluation) {
        return {
          passed: false,
          context: {
            reason: `Not all values match ${getNodeName(expression)}`,
            expression,
            evalationContext: badEvaluation.context,
          },
          items: result,
        };
      }

      return {
        passed: true,
        context: undefined,
        items: result,
      };
    }

    return {
      passed: false,
      context: {
        reason: `${getNodeName(expression)} with operator ${getNodeName(
          expression.operator
        )} is not supported for type narrowing.`,
        operator: expression.operator,
      },
      items: result,
    };
  } else if (expressionRightUnaryBinary.isNode(expression)) {
    const leftExpr = expression.leftExpr;
    if (
      expressionColumn.isNode(leftExpr) &&
      operatorUnaryIs.isNode(expression.rightUnaryOperator)
    ) {
      const selectItemsMatching = params.select
        .map((val) => {
          if (expressionSelectColumns.isNode(val.expression)) {
            if (val.expression.alias === leftExpr.tableAlias) {
              const allResults = result.map((row) => {
                switch (expression.rightUnaryOperator.value) {
                  case 'IS NULL': {
                    const passed =
                      typeof row[leftExpr.tableAlias][leftExpr.value] ===
                        'undefined' ||
                      row[leftExpr.tableAlias][leftExpr.value] === null;
                    return {
                      passed,
                      context: passed
                        ? undefined
                        : {
                            reason: `${getNodeName(
                              expression
                            )} IS NULL for column ${leftExpr.tableAlias}.${
                              leftExpr.value
                            } did not pass. Expected NULL but received ${
                              row[leftExpr.tableAlias][leftExpr.value]
                            }`,
                          },
                    };
                  }
                  case 'IS NOT NULL': {
                    const passed =
                      typeof row[leftExpr.tableAlias][leftExpr.value] !==
                        'undefined' &&
                      row[leftExpr.tableAlias][leftExpr.value] !== null;
                    return {
                      passed,
                      context: passed
                        ? undefined
                        : {
                            reason: `${getNodeName(
                              expression
                            )} IS NOT NULL for column ${leftExpr.tableAlias}.${
                              leftExpr.value
                            } did not pass. Expected NOT NULL but instead the value was NULL.`,
                          },
                    };
                  }
                  default:
                    return {
                      passed: false,
                      context: {
                        reason: `${getNodeName(expression)} with value "${
                          expression.rightUnaryOperator.value
                        }" is not supported`,
                      },
                    };
                }
              });

              const failed = allResults.find((result) => !result.passed);

              if (failed) {
                return failed;
              }

              return {
                passed: true,
                context: undefined,
                items: result,
              };
            }
          }
        })
        .filter((val) => !!val);

      const failed = selectItemsMatching.find((value) => !value.passed);

      if (failed) {
        return { ...failed, items: result };
      }

      return {
        passed: true,
        context: undefined,
        items: result,
      };
    }
  } else if (expressionIf.isNode(expression)) {
    const firstResult = applyTypeNarrowingOnExpression(
      result,
      params,
      expression.conditionExpr
    );

    if (firstResult.passed) {
      return applyTypeNarrowingOnExpression(
        result,
        params,
        expression.trueExpr
      );
    } else {
      return applyTypeNarrowingOnExpression(
        result,
        params,
        expression.falseExpr
      );
    }
  } else if (expressionBracket.isNode(expression)) {
    return applyTypeNarrowingOnExpression(result, params, expression.expr);
  }

  return {
    passed: false,
    context: {
      reason: `${getNodeName(expression)} is not narrowable`,
      expression,
    },
    items: result,
  };
}

function evaluateExpression<S extends BaseDbDiscriminator>(
  result: any[],
  params: QueryBuilderParams<S>,
  expr: ExpressionBase<any>
) {
  if (expressionColumn.isNode(expr)) {
    const items = params.select
      .map((val) => {
        if (expressionColumn.isNode(val.expression)) {
          if (
            expr.tableAlias === val.expression.tableAlias &&
            expr.value === val.expression.value
          ) {
            const key = val.alias ?? val.expression.inferredAliases[0];
            return result.map((row) => row[key]);
          }
        } else if (expressionSelectColumns.isNode(val.expression)) {
          if (
            expr.tableAlias === val.expression.alias &&
            val.expression.keys.includes(expr.value)
          ) {
            return result.map((row) => row[expr.tableAlias][expr.value]);
          }
        }
      })
      .filter((val) => !!val);

    if (!items.length) {
      return;
    }

    return items[0];
  } else if (constantForVarchar.isNode(expr)) {
    return result.map(() => expr.value);
  } else if (constantForInteger.isNode(expr)) {
    return result.map(() => expr.value);
  } else if (constantForFloat.isNode(expr)) {
    return result.map(() => expr.value);
  } else if (constantForBoolean.isNode(expr)) {
    return result.map(() => expr.value);
  } else if (constantForJson.isNode(expr)) {
    return result.map(() => expr.value);
  } else if (constantForArray.isNode(expr)) {
    return result.map(() => expr.value);
  } else if (constantForTimestamp.isNode(expr)) {
    return result.map(() => expr.value);
  }
}

// SELECT SUM(a.id)
//

function compareEvaluatedExpressions(
  value1: any,
  value2: any,
  comparator: OperatorBinaryComparator<BinaryComparatorOptions>
) {
  if (typeof value1 !== typeof value2) {
    return {
      passed: false,
      context: {
        reason: `Can't compare expressions with different types`,
        comparison: [value1, value2, comparator],
      },
    };
  }

  if (typeof value1 === 'number' && typeof value2 === 'number') {
    return {
      passed: comparatorsForTypes().number[comparator.value](value1, value2),
    };
  } else if (typeof value1 === 'string' && typeof value2 === 'string') {
    return {
      passed: comparatorsForTypes().string[comparator.value](value1, value2),
    };
  } else if (
    typeof value1 === 'object' &&
    value2 === 'object' &&
    value1 &&
    value2 &&
    value1 instanceof Date &&
    value2 instanceof Date
  ) {
    return {
      passed: comparatorsForTypes().timestamp[comparator.value](value1, value2),
    };
  } else if (typeof value1 === 'boolean' && typeof value2 === 'boolean') {
    return {
      passed: comparatorsForTypes().boolean[comparator.value](value1, value2),
    };
  }

  return {
    passed: false,
    context: {
      reason: 'Cannot compare values',
      comparison: [value1, value2, comparator],
    },
  };
}

type Comparators<T> = {
  [Key in BinaryComparatorOptions]: (value1: T, value2: T) => boolean;
};

function comparatorsForTypes() {
  return {
    number: {
      '=': (val1, val2) => val1 === val2,
      '!=': (val1, val2) => val1 !== val2,
      '<': (val1, val2) => val1 < val2,
      '<=': (val1, val2) => val1 <= val2,
      '>': (val1, val2) => val1 > val2,
      '>=': (val1, val2) => val1 >= val2,
    } satisfies Comparators<number>,
    string: {
      '=': (val1, val2) => val1 === val2,
      '!=': (val1, val2) => val1 !== val2,
      '<': (val1, val2) => val1 < val2,
      '<=': (val1, val2) => val1 <= val2,
      '>': (val1, val2) => val1 > val2,
      '>=': (val1, val2) => val1 >= val2,
    } satisfies Comparators<string>,
    timestamp: {
      '=': (val1, val2) => val1 === val2,
      '!=': (val1, val2) => val1 !== val2,
      '<': (val1, val2) => val1 < val2,
      '<=': (val1, val2) => val1 <= val2,
      '>': (val1, val2) => val1 > val2,
      '>=': (val1, val2) => val1 >= val2,
    } satisfies Comparators<Date>,
    boolean: {
      '=': (val1, val2) => val1 === val2,
      '!=': (val1, val2) => val1 !== val2,
      '<': (val1, val2) => val1 < val2,
      '<=': (val1, val2) => val1 <= val2,
      '>': (val1, val2) => val1 > val2,
      '>=': (val1, val2) => val1 >= val2,
    } satisfies Comparators<boolean>,
  };
}
