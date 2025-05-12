import type { QueryBuilderParams } from './QueryBuilderParams';
import type { BaseDbDiscriminator } from './base';
import type { DbConfig } from './db-helper';
import { runQueryResult } from './query-result';

export async function paginateQueryResult<S extends BaseDbDiscriminator>(
  params: QueryBuilderParams<S>,
  data: {
    queryRunner: {
      query: DbConfig<S, any>['query'];
    };
    throwsIfEmpty?: boolean | (() => Error);
    limit: number;
    currentData: any[];
  }
) {
  const res = await runQueryResult(
    {
      ...params,
      limit: data.limit,
    },
    data
  );

  if (res.result.length < data.limit) {
    return {
      ...res,
      result: [...data.currentData, ...res.result],
    };
  }

  return paginateQueryResult(params, {
    ...data,
    currentData: [...data.currentData, ...res.result],
  });
}
