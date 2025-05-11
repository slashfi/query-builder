import type { BaseDbDiscriminator } from '../Base';
import {
  type QueryBuilderParams,
  type SetQbParams,
  updateQueryBuilderParams,
} from '../QueryBuilderParams';
import type { AssertSqlQueryBuilder } from '../query-builder-asserter';
import { createSqlQueryBuilder } from './SqlQueryBuilder';

export function createSqlQueryBuilderLimit<S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>
): SqlQueryBuilderLimit<any, S> {
  return (value) => {
    return createSqlQueryBuilder(
      updateQueryBuilderParams(params, {
        limit: value,
      })
    );
  };
}

export type SqlQueryBuilderLimit<
  Params extends QueryBuilderParams<S>,
  S extends BaseDbDiscriminator,
> = <Value extends number>(
  value: Value
) => AssertSqlQueryBuilder<SetQbParams<Params, { limit: Value }, S>, S>;
