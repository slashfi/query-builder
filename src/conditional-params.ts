import { type Expand, type IsAny, compareTypes } from '@/core-utils';
import type { ExpressionBase } from './base';
import type { ClauseFromExpression } from './clauses/clause-from-expression';
import type { DataTypeBoolean } from './data-type';

export interface ConditionParams {
  length: number | undefined;
  filter: ClauseFromExpression<ExpressionBase<DataTypeBoolean>> | undefined;
}

export type SetConditionParams<
  Params extends ConditionParams | undefined,
  Update extends Partial<ConditionParams>,
> = IsAny<Params> extends true
  ? Params
  : Omit<ParamsWithFallback<Params>, keyof Update> &
        Update extends infer U extends ConditionParams
    ? Expand<U>
    : never;

type ParamsWithFallback<Params extends ConditionParams | undefined> =
  undefined extends Params
    ? {
        length: undefined;
        filter: undefined;
      }
    : Params;

compareTypes<{
  a: ParamsWithFallback<undefined>;
  b: ConditionParams;
}>()
  .expect('a')
  .toExtend('b');
