import { typecheckUnreachable } from '@/core-utils';
import type { DataTypeBase } from '../base';
import {
  type allDataTypes,
  getNonNullableDataType,
  isDataTypeNullable,
} from '../data-type';
import { type SqlString, sql } from '../sql-string';

/**
 * Gets the SQL for a column expression for a given data type.
 */
interface ColumnExpressionOptions {
  defaultValue: SqlString | undefined;
  /**
   * Defaults to true
   */
  includeNotNullSuffix?: boolean;
}

export function getSqlForColumnExpressionForDataType(
  dataType: DataTypeBase,
  options: ColumnExpressionOptions
): SqlString {
  const isNullable = isDataTypeNullable(dataType);

  const baseDataType = getNonNullableDataType(
    dataType
  ) as (typeof allDataTypes)[number];

  const includeNotNullSuffix = options.includeNotNullSuffix ?? true;
  const notNullSuffix =
    isNullable || !includeNotNullSuffix ? sql`` : sql` NOT NULL`;

  const baseType = (function getBaseType(
    dataType: (typeof allDataTypes)[number]
  ): SqlString {
    switch (dataType.type) {
      case 'varchar':
        return sql`VARCHAR`;
      case 'boolean':
        return sql`BOOLEAN`;
      case 'int':
        return sql`INT`;
      case 'float':
        return sql`FLOAT`;
      case 'timestamp':
        return sql`TIMESTAMP`;
      case 'array':
        return sql`${getBaseType(dataType.primitiveDataType)}[]`;
      case 'json':
        return sql`JSONB`;
      case 'union':
        throw new Error('Datatype not support: union');
      default:
        typecheckUnreachable(dataType);
        throw new Error(`Datatype not supported: ${dataType}`);
    }
  })(baseDataType);

  const defaultClause = options?.defaultValue
    ? sql` DEFAULT ${options.defaultValue}`
    : sql``;

  return sql`${baseType}${notNullSuffix}${defaultClause}`;
}
