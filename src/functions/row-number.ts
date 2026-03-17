/*
  fns.rowNumber().over({
    partitionBy: _.productApplicationEvent.entityId,
    orderBy: _.productApplicationEvent.timestamp.desc(),
  })
*/

import type { GenericAny } from '../core-utils';
import type { BaseDbDiscriminator } from '../Base';
import type { OrderByList } from '../clauses/ClauseForOrderBy';
import type { ExpressionBuilder } from '../ExpressionBuilder';
import { createExpressionBuilder } from '../expression-builder';
import {
  type ExpressionRowNumber,
  expressionRowNumber,
} from '../expressions/ExpressionRowNumber';

export const rowNumber: RowNumber = (options) => {
  const b = createExpressionBuilder(
    expressionRowNumber.create({
      ...(options.partitionBy && {
        partitionByExpr: options.partitionBy._expression,
      }),
    })
  );

  return b as GenericAny;
};

export type RowNumber = <
  Builder extends ExpressionBuilder<GenericAny, S>,
  O extends OrderByList,
  S extends BaseDbDiscriminator,
>(options: {
  partitionBy?: Builder;
  orderBy?: O;
}) => Builder extends ExpressionBuilder<infer J, S>
  ? ExpressionBuilder<ExpressionRowNumber<J, O>, S>
  : never;
