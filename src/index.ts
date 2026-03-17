import type { GenericAny } from '@/core-utils';
import type { BaseDbDiscriminator } from './Base';
import { createDb, createDbDiscriminator, type Db } from './db-helper';
import type { ExpressionBuilder } from './ExpressionBuilder';
import * as fns from './functions';
import type { QueryBuilderParams } from './QueryBuilderParams';
import { createTableSelector, type TableSelector } from './table-selector';
import { createValuesBuilder } from './values-builder';

const defaultDiscriminator = createDbDiscriminator('default');
export {
  createDb,
  createDbDiscriminator,
  defaultDiscriminator,
  type BaseDbDiscriminator,
  type Db,
};

export * from './from-builder';
export * from './InsertBuilder';
export type { RowOutputForQuery, SelectQueryBuilder } from './QueryBuilder';
export type { GenericQueryBuilderParams } from './QueryBuilderParams';
export {
  transformRawResultToQuery,
  transformSqlToParsedResult,
} from './QueryResult';
export * from './table-from-schema-builder';
export { fns };

// Export types needed for table schemas
export type { TableBase } from './Base';
export type { ExpressionBuilder } from './ExpressionBuilder';

/**
 * You can import this method to make formatting chained expressions nicer
 */
export function expr<
  T extends ExpressionBuilder<GenericAny, S>,
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
export { operatorBinaryJsonbContains } from './operators/OperatorBinaryJsonbContains';

export const fromValues = createValuesBuilder({
  values: undefined,
  dataTypeConstraints: {},
  discriminator: defaultDiscriminator,
}).withDataTypes;

export {
  createDataTypeArray,
  createDataTypeBoolean,
  createDataTypeDecimal,
  createDataTypeFloat,
  createDataTypeInteger,
  createDataTypeJson,
  createDataTypeTimestamp,
  createDataTypeVarchar,
  type PrimitiveDataTypeName,
} from './DataType';

export type { __queryBuilderIndexes } from './ddl/codegen/index-metadata';
