import type { QueryBuilderParams } from './QueryBuilderParams';
import type { ExpressionBuilder } from './expression-builder-type';
import { type TableSelector, createTableSelector } from './table-selector';
import { createValuesBuilder } from './values-builder';

import type { BaseDbDiscriminator } from './base';
import { createDb, createDbDiscriminator } from './db-helper';
import * as fns from './functions';

const defaultDiscriminator = createDbDiscriminator('default');
export {
  createDb,
  createDbDiscriminator,
  defaultDiscriminator,
  type BaseDbDiscriminator,
};

export type { GenericQueryBuilderParams } from './QueryBuilderParams';
export * from './from-builder';
export * from './insert-builder';
export type { RowOutputForQuery, SelectQueryBuilder } from './query-builder';
export {
  transformRawResultToQuery,
  transformSqlToParsedResult,
} from './query-result';
export * from './table-from-schema-builder';
export { fns };

// Export types needed for table schemas
export type { TableBase } from './base';
export type { ExpressionBuilder } from './expression-builder-type';

/**
 * You can import this method to make formatting chained expressions nicer
 */
export function expr<
  T extends ExpressionBuilder<any, S>,
  S extends BaseDbDiscriminator,
>(clause: T): T {
  return clause;
}

export function selector<
  T extends { _debug(): QueryBuilderParams<S> },
  S extends BaseDbDiscriminator,
>(value: T): TableSelector<ReturnType<T['_debug']>['entities'], S> {
  return createTableSelector(value._debug().entities);
}

export { getAstNodeRepository } from './ast-node-repository';
export * from './constants';

export const fromValues = createValuesBuilder({
  values: undefined,
  dataTypeConstraints: {},
  discriminator: defaultDiscriminator,
}).withDataTypes;

export {
  createDataTypeArray,
  createDataTypeBoolean,
  createDataTypeFloat,
  createDataTypeInteger,
  createDataTypeJson,
  createDataTypeTimestamp,
  createDataTypeVarchar,
} from './data-type';

export type { __queryBuilderIndexes } from './ddl/codegen/index-metadata';
