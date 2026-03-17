import { assertUnreachable, type GenericAny } from '@/core-utils';
import { getAstNodeRepository } from '../ast-node-repository';
import type { AstNode, DataTypeBase } from '../Base';
import { createAstNode } from '../createAstNode';
import {
  createDataTypeArray,
  type DataTypeArray,
  type DataTypes,
} from '../DataType';
import { type SqlString, sql } from '../sql-string';
import type { ConstantBase } from './base';

export interface ConstantForArray<Value extends DataTypeBase = DataTypeBase>
  extends ConstantBase<DataTypeArray<DataTypeBase>> {
  type: 'array';
  value: Value['narrowedType'];
  inferredAliases: [];
}

export const constantForArray = createAstNode<ConstantForArray<GenericAny>>()({
  class: 'expression',
  variant: 'constant_expression',
  type: 'array',
  create: <Constant extends ConstantBase<DataTypeBase>>(
    type: Constant extends ConstantBase<infer DataType> ? DataType : never,
    value: Constant[]
  ): ConstantForArray<
    DataTypeArray<
      DataTypeBase & {
        type: Constant;
        value: Constant extends ConstantBase<infer DataType>
          ? DataType['type']
          : never;
      }
    >
  > => {
    return {
      class: 'expression',
      variant: 'constant_expression',
      columnReferences: [] as GenericAny,
      dataType: createDataTypeArray(type, {
        isNullable: false,
      }),
      inferredAliases: [],
      isAggregate: false,
      type: 'array',
      value,
    };
  },
  writeSql: (node) => {
    const primitiveType = node.dataType.primitiveDataType
      .type as DataTypes['type'];

    const baseElementSqlType: SqlString = (() => {
      switch (primitiveType) {
        case 'varchar':
          return sql`VARCHAR[]`;
        case 'int':
          return sql`INT[]`;
        case 'boolean':
          return sql`BOOLEAN[]`;
        case 'array':
          return sql`ARRAY[]`;
        case 'float':
          return sql`FLOAT[]`;
        case 'json':
          return sql`JSONB[]`;
        case 'timestamp':
          return sql`TIMESTAMP[]`;
        case 'decimal':
          return sql`DECIMAL[]`;
        case 'tuple':
        case 'tabular_columns':
        case 'union':
          throw new Error(
            `Type ${primitiveType} is not supported for array types`
          );
        default:
          return assertUnreachable(primitiveType);
      }
    })();

    const values: AstNode[] = node.value;

    const valuesSql = values.map((value) =>
      getAstNodeRepository(value).writeSql(value, undefined)
    );

    return sql`ARRAY[${sql.join(valuesSql, ',')}]::${baseElementSqlType}`;
  },
});
