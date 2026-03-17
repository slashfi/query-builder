import {
  type AnyOf,
  compareTypes,
  type Expand,
  type GenericAny,
  type IsAny,
} from '@/core-utils';
import type { DataTypeBase, ExpressionBase, TableColumnBase } from './Base';
import {
  allDataTypes,
  createDataTypeArray,
  createDataTypeDecimal,
  createDataTypeNull,
  createDataTypeUnion,
  type DataTypeArray,
  type DataTypeBoolean,
  type DataTypeDecimal,
  type DataTypeFloat,
  type DataTypeInteger,
  type DataTypeJson,
  type DataTypeNull,
  type DataTypeTimestamp,
  type DataTypeUnion,
  type DataTypeVarchar,
  type IsDataTypeNullable,
  isDataTypeNullable,
  isNullDataType,
  isUnionDataType,
  type MakeDataTypeNullable,
} from './DataType';
import type { ExpressionBuilderShape } from './ExpressionBuilder';
import { type SqlString, sql } from './sql-string';
import { injectParameters } from './sql-string/helpers';

function createColumnWithOptions<
  Type extends GenericAny,
  DataType extends DataTypeBase,
  IsOptionalForInsert extends boolean,
>(
  type:
    | 'boolean'
    | 'varchar'
    | 'json'
    | 'float'
    | 'int'
    | 'timestamp'
    | 'array'
    | 'decimal',
  columnName: string,
  options?: ColumnOptions<Type, DataType, IsOptionalForInsert> & {
    mode?: 'string' | 'bigint';
  }
) {
  // Special handling for decimal with mode
  if (type === 'decimal' && options?.mode) {
    const dataType =
      options.mode === 'bigint'
        ? createDataTypeDecimal({ isNullable: false, mode: 'bigint' })
        : createDataTypeDecimal({ isNullable: false, mode: 'string' });

    const base = createTableColumnBuilder(type, columnName, {
      class: 'table_column',
      variant: 'column',
      type: 'column',
      columnName,
      dataType,
      isOptionalForInsert: false,
    });

    return options?.isNullable ? (base.isNullable() as GenericAny) : base;
  }

  const base = createTableColumnBuilder(type, columnName);
  return options?.isNullable ? (base.isNullable() as GenericAny) : base;
}

export function createTableColumnInferrer(
  columnName: string
): TableColumnBuilderInferrer<GenericAny, GenericAny> {
  return {
    varchar: (...options) =>
      createColumnWithOptions('varchar', columnName, options[0]),
    boolean: (...options) =>
      createColumnWithOptions('boolean', columnName, options[0]),
    float: (...options) =>
      createColumnWithOptions('float', columnName, options[0]),
    int: (...options) => createColumnWithOptions('int', columnName, options[0]),
    timestamp: (...options) =>
      createColumnWithOptions('timestamp', columnName, options[0]),
    json: (...options) =>
      createColumnWithOptions('json', columnName, options[0]),
    decimal: (...options) =>
      createColumnWithOptions('decimal', columnName, options[0]),
    array: (...options) => {
      const base = createTableColumnBuilder('array', columnName);
      if (!options[0]?.baseType) {
        throw new Error('baseType is required for array type');
      }
      const subType = allDataTypes.find(
        (base) => base.type === options[0]?.baseType
      );

      if (!subType) {
        throw new Error('Invalid base type');
      }
      return options[0]?.isNullable
        ? (base.isNullable().setBaseType({
            base: subType,
          }) as GenericAny)
        : base.setBaseType({ base: subType });
    },
  };
}

export function createTableColumnBuilder(
  type: ColumnDataTypes[number]['type'],
  columnName: string,
  base: TableColumnBase = {
    class: 'table_column',
    variant: 'column',
    type: 'column',
    columnName,
    dataType: {
      class: 'data_type',
      baseExpression: {} as GenericAny,
      constExpression: {} as GenericAny,
      narrowedType: {} as GenericAny,
      type,
    },
    isOptionalForInsert: false,
  }
): TableColumnBuilder<GenericAny> {
  return {
    isNullable: () => {
      return createTableColumnBuilder(type, columnName, {
        ...base,
        dataType: createDataTypeUnion([base.dataType, createDataTypeNull()]),
      });
    },
    default: (defaultValue, options) => {
      const sqlValue =
        defaultValue instanceof Object && 'getQuery' in defaultValue
          ? sql([injectParameters(defaultValue)])
          : sql([injectParameters(sql.p(defaultValue))]);
      return createTableColumnBuilder(type, columnName, {
        ...base,
        dataType: base.dataType,
        default: sqlValue,
        isOptionalForInsert: options?.isOptionalForInsert ?? false,
      });
    },
    computed: (expression) => {
      return createTableColumnBuilder(type, columnName, {
        ...base,
        computedExpression: expression,
        isOptionalForInsert: true,
      });
    },
    getColumn() {
      return base;
    },
    setBaseType(options) {
      if (isUnionDataType(base.dataType)) {
        const nonNullDataType = base.dataType.values.find(
          (val) => !isNullDataType(val)
        );
        if (nonNullDataType?.type !== 'array') {
          throw new Error('Cannot set base type on non-array');
        }

        return createTableColumnBuilder('array', columnName, {
          ...base,
          dataType: createDataTypeArray(options.base, {
            isNullable: isDataTypeNullable(base.dataType),
          }),
        });
      }

      if (base.dataType.type !== 'array') {
        throw new Error('Cannot set base type on non-array');
      }
      return createTableColumnBuilder('array', columnName, {
        ...base,
        dataType: createDataTypeArray(options.base, {
          isNullable: isDataTypeNullable(base.dataType),
        }),
      });
    },
  };
}

type SetTableColumn<
  Column extends TableColumnBase,
  New extends Partial<TableColumnBase>,
> = IsAny<Column> extends true
  ? Column
  : Omit<Column, keyof New> & New extends infer U extends TableColumnBase
    ? Expand<U>
    : never;

type ColumnOptions<
  Type,
  DataType extends DataTypeBase,
  IsOptionalForInsert extends boolean,
> = Type extends GenericAny
  ? {
      isNullable?: boolean;
      default?:
        | SqlString
        | ExpressionBuilderShape<ExpressionBase<DataType>>
        | GenericAny;
      isOptionalForInsert?: IsOptionalForInsert;
    }
  : undefined extends Type
    ? { isNullable: true }
    : {
        default?:
          | SqlString
          | ExpressionBuilderShape<ExpressionBase<DataType>>
          | Type;
        isOptionalForInsert?: IsOptionalForInsert;
      };

export type TableColumnBuilderInferrer<
  Type extends GenericAny,
  ColumnName extends string,
> = {
  [Key in PossibleDataTypesForTypescriptType<
    NonNullable<Type>,
    ColumnDataTypes
  >[number]['type']]: Extract<
    PossibleDataTypesForTypescriptType<
      NonNullable<Type>,
      ColumnDataTypes
    >[number],
    { type: Key }
  > extends infer DataType extends DataTypeBase
    ? <
        BaseType extends Exclude<
          (typeof allDataTypes)[number]['type'],
          'array'
        > = never,
      >(
        ...options: AnyOf<
          [undefined extends Type ? true : false, IsAny<Type>]
        > extends true
          ? [
              { isNullable: true } & (DataType['type'] extends 'array'
                ? { baseType: BaseType }
                : DataType['type'] extends 'decimal'
                  ? NonNullable<Type> extends bigint
                    ? { mode: 'bigint' }
                    : { mode?: 'string' }
                  : {}),
            ]
          : DataType['type'] extends 'array'
            ? [{ baseType: BaseType }]
            : DataType['type'] extends 'decimal'
              ? NonNullable<Type> extends bigint
                ? [{ mode: 'bigint' }]
                : [{ mode?: 'string' }?]
              : []
      ) => TableColumnBuilder<{
        class: 'table_column';
        type: 'column';
        columnName: ColumnName;
        dataType: Type | undefined extends Type
          ? DataTypeUnion<
              [
                GetDataTypesForTs<DataType, NonNullable<Type>, BaseType>,
                DataTypeNull,
              ]
            >
          : GetDataTypesForTs<DataType, NonNullable<Type>, BaseType>;
        variant: 'column';
      }>
    : never;
};

export type TableColumnBuilder<Column extends TableColumnBase> = {
  isNullable: IsDataTypeNullable<Column['dataType']> extends true
    ? never
    : () => TableColumnBuilder<
        SetTableColumn<
          Column,
          {
            dataType: IsDataTypeNullable<Column['dataType']> extends true
              ? Column['dataType']
              : MakeDataTypeNullable<Column['dataType']>;
          }
        >
      >;
  default: <const IsOptional extends boolean = false>(
    defaultValue: SqlString | Column['dataType']['narrowedType'],
    options?: {
      isOptionalForInsert?: IsOptional;
    }
  ) => TableColumnBuilder<
    SetTableColumn<
      Column,
      {
        dataType: Column['dataType'];
        isOptionalForInsert: IsOptional;
        default: SqlString;
      }
    >
  >;
  computed: (expression: SqlString) => TableColumnBuilder<
    SetTableColumn<
      Column,
      {
        computedExpression: SqlString;
        isOptionalForInsert: true;
      }
    >
  >;
  getColumn(): Column;
} & (AnyOf<
  [Column['dataType'] extends DataTypeArray ? true : false, IsAny<Column>]
> extends true
  ? {
      setBaseType<Base extends DataTypeBase>(options: {
        base: Base;
      }): TableColumnBuilder<
        SetTableColumn<
          Column,
          {
            dataType: DataTypeArray<Base>;
          }
        >
      >;
    }
  : {});

export type ColumnDataTypes = readonly [
  DataTypeVarchar<string>,
  DataTypeInteger<number>,
  DataTypeFloat<number>,
  DataTypeBoolean<boolean>,
  DataTypeTimestamp<Date>,
  DataTypeArray<GenericAny>,
  DataTypeJson<GenericAny>,
  DataTypeDecimal<string>,
  DataTypeDecimal<bigint>,
];

export type GetDataTypesForTs<
  DataType extends DataTypeBase,
  Type extends DataType['narrowedType'],
  /**
   * BaseType is only passed down for the array data type where
   * the base type can be anything that isn't an array.
   */
  BaseType extends (typeof allDataTypes)[number]['type'],
  /**
   * This is a hack to prevent excessive type inference. Since we "recursively"
   * call this type, but we know we won't call it more than one level deep. So the second
   * call here always sets it to false so we are effectively explicitly "telling" the type checker
   * that this is not actually infinitely recursive since it's unable to infer this on its own any other way
   * that has been tried.
   */
  First = true,
> = DataType extends DataTypeVarchar<string>
  ? DataTypeVarchar<Type>
  : DataType extends DataTypeFloat<number>
    ? DataTypeFloat<Type>
    : DataType extends DataTypeInteger<number>
      ? DataTypeInteger<Type>
      : DataType extends DataTypeBoolean<boolean>
        ? DataTypeBoolean<Type>
        : DataType extends DataTypeJson<GenericAny>
          ? DataTypeJson<Type>
          : DataType extends DataTypeTimestamp<GenericAny>
            ? DataTypeTimestamp<Type>
            : DataType extends DataTypeDecimal<string>
              ? DataTypeDecimal<Type>
              : DataType extends DataTypeArray<GenericAny>
                ? // this is some hacky logic to make sure that
                  // array types are inferred properly.
                  Extract<
                    ColumnDataTypes[number],
                    { type: BaseType }
                  > extends infer NarrowedDataType extends DataTypeBase
                  ? Type[number] extends NarrowedDataType['narrowedType']
                    ? DataTypeArray<
                        First extends true
                          ? GetDataTypesForTs<
                              NarrowedDataType,
                              Type[number],
                              BaseType,
                              false
                            >
                          : never
                      >
                    : never
                  : never
                : DataType;

type PossibleDataTypesForTypescriptType<
  T,
  DataTypes extends ReadonlyArray<DataTypeBase>,
> = DataTypes extends readonly [
  infer U extends DataTypeBase,
  ...infer J extends ReadonlyArray<DataTypeBase>,
]
  ? T extends U['narrowedType']
    ? [U, ...PossibleDataTypesForTypescriptType<T, J>]
    : T extends ReadonlyArray<infer ElementType>
      ? U extends DataTypeArray<infer PrimitiveType>
        ? ElementType extends PrimitiveType['narrowedType']
          ? [U, ...PossibleDataTypesForTypescriptType<T, J>]
          : PossibleDataTypesForTypescriptType<T, J>
        : PossibleDataTypesForTypescriptType<T, J>
      : PossibleDataTypesForTypescriptType<T, J>
  : [];

compareTypes<{
  a: PossibleDataTypesForTypescriptType<number, ColumnDataTypes>[number];
  b: DataTypeFloat<number> | DataTypeInteger<number> | DataTypeJson<GenericAny>;
}>()
  .expect('a')
  .toBeEquivalent('b');

// Add a compareTypes call for string types to ensure decimal is included
compareTypes<{
  a: PossibleDataTypesForTypescriptType<string, ColumnDataTypes>[number];
  b:
    | DataTypeVarchar<string>
    | DataTypeDecimal<string>
    | DataTypeJson<GenericAny>;
}>()
  .expect('a')
  .toBeEquivalent('b');

// Add a compareTypes call for bigint types to ensure decimal is included
compareTypes<{
  a: PossibleDataTypesForTypescriptType<bigint, ColumnDataTypes>[number];
  b: DataTypeDecimal<bigint> | DataTypeJson<GenericAny>;
}>()
  .expect('a')
  .toBeEquivalent('b');
