import type { AllOf, Expand, IsAny, Not, TypecheckError } from '@/core-utils';
import type {
  AstNode,
  BaseDbDiscriminator,
  DataTypeBase,
  TableColumnBase,
} from './base';

import { createAstNode } from './create-ast-node';
import {
  type DataTypeTabularColumns,
  type allDataTypes,
  createDataTypeTabularColumns,
} from './data-type';
import type { EntityTarget } from './entity-target';
import type { BuildColumn, BuildTable } from './from-builder';
import { serializeValueForDataType } from './insert-builder';
import { type SqlString, sql } from './sql-string';

export interface TableNodeForValues<DataType extends DataTypeTabularColumns>
  extends AstNode {
  class: 'table';
  variant: 'table_from_values';
  values: DataType['narrowedType'][];
  type: 'values';
  dataType: DataType;
}

export const tableNodeForValues = createAstNode<
  TableNodeForValues<DataTypeTabularColumns>
>()({
  class: 'table',
  type: 'values',
  variant: 'table_from_values',
  create: <DataTypes extends { [Key in string]: DataTypeBase }>(
    dataTypes: DataTypes,
    values: DataTypeTabularColumns<DataTypes>['narrowedType'][]
  ): TableNodeForValues<DataTypeTabularColumns<DataTypes>> => ({
    class: 'table',
    variant: 'table_from_values',
    type: 'values',
    values,
    dataType: createDataTypeTabularColumns(dataTypes),
  }),
  writeSql: (node) => {
    const columnDataTypes = node.dataType.columnDataTypes;
    const columnNames = Object.keys(columnDataTypes);

    const columnSql: SqlString = sql.join(
      columnNames.map((name, index) =>
        sql.column({ name: `column${index + 1}`, alias: name })
      ),
      ', '
    );
    const valueSql: SqlString = sql.join(
      node.values.map((row) => {
        const eachColumnValue: SqlString[] = columnNames.map(
          (columnName) =>
            serializeValueForDataType(
              columnName,
              row[columnName],
              columnDataTypes[columnName] as (typeof allDataTypes)[number]
            ) ?? sql`NULL`
        );

        return sql`(${sql.join(eachColumnValue, ', ')})`;
      }),
      ', '
    );

    return sql`SELECT ${columnSql} FROM (VALUES ${valueSql})`;
  },
});

export function createValuesBuilder<
  Params extends ValuesParams<S>,
  S extends BaseDbDiscriminator,
>(params: Params): ValuesTableBuilder<Params, S> {
  const self: ValuesTableBuilder<any, S> = {
    _params() {
      return params;
    },
    withDataTypes: (dataTypes) => {
      return createValuesBuilder({
        ...params,
        dataTypeConstraints: dataTypes,
      }) as ValuesTableBuilder<any, S>;
    },
    rows(...values) {
      return createValuesBuilder({
        ...params,
        values,
      }) as ValuesTableBuilder<any, S>;
    },
    withAlias(alias) {
      if (!params.values) {
        throw new Error(`Can't alias a table that doesn't have rows specified`);
      }
      return {
        Table: {
          defaultAlias: alias,
          columnSchema: Object.fromEntries(
            Object.entries(params.dataTypeConstraints).map(
              ([name, dataType]) => [
                name,
                {
                  class: 'table_column',
                  columnName: name,
                  dataType: dataType,
                  type: 'column',
                  variant: 'column',
                } satisfies TableColumnBase,
              ]
            )
          ),
          tableName: alias,
          schema: 'public',
          type: 'subquery',
          variant: 'table',
          valuesTable: tableNodeForValues.create(
            params.dataTypeConstraints,
            params.values
          ),
          primaryKey: [],
          class: 'table',
          indexes: undefined,
          _internalIndexes: undefined,
          _databaseType: params.discriminator,
        },
      };
    },
  };

  return self;
}

export interface ValuesTableBuilder<
  Params extends ValuesParams<S>,
  S extends BaseDbDiscriminator,
> {
  _params(): Params;
  rows: [Params['dataTypeConstraints']] extends [never]
    ? TypecheckError<
        'You must specify data types for the values clause',
        { dataTypes: Params['dataTypeConstraints'] }
      >
    : <
        T extends {
          [Key in keyof Params['dataTypeConstraints']]: DataTypeBase extends Params['dataTypeConstraints'][Key]
            ? any
            : Params['dataTypeConstraints'][Key]['narrowedType'];
        },
      >(
        ...values: T[]
      ) => ValuesTableBuilder<SetValuesParams<Params, { values: T[] }, S>, S>;

  withAlias: AllOf<
    [
      undefined extends Params['values'] ? true : false,
      Not<IsAny<Params['values']>>,
    ]
  > extends true
    ? TypecheckError<
        `Can't alias a table that doesn't have rows specified`,
        { values: Params['values'] }
      >
    : <Alias extends string>(
        alias: Alias
      ) => EntityTarget<
        BuildTable<
          {
            defaultAlias: Alias;
            class: 'table';
            columnSchema: {
              [Key in keyof Params['dataTypeConstraints']]: BuildColumn<{
                class: 'table_column';
                type: 'column';
                columnName: Extract<Key, string>;
                dataType: Params['dataTypeConstraints'][Key];
                variant: 'column';
              }>;
            };
            tableName: Alias;
            schema: string;
            type: 'subquery';
            variant: 'table';
            valuesTable: TableNodeForValues<
              DataTypeTabularColumns<Params['dataTypeConstraints']>
            >;
            primaryKey: [];
            indexes: undefined;
            _internalIndexes: undefined;
            _databaseType: S;
          },
          S
        >,
        S
      >;

  withDataTypes: undefined extends Params['values']
    ? <
        DataTypes extends {
          [Key in string]: DataTypeBase;
        },
      >(
        dataTypes: DataTypes
      ) => ValuesTableBuilder<
        SetValuesParams<Params, { dataTypeConstraints: DataTypes }, S>,
        S
      >
    : never;
}

interface ValuesParams<S extends BaseDbDiscriminator> {
  dataTypeConstraints: { [Key in string]: DataTypeBase };
  values: any[] | undefined;
  discriminator: S;
}

export type SetValuesParams<
  Params extends ValuesParams<S>,
  Update extends Partial<ValuesParams<S>>,
  S extends BaseDbDiscriminator,
> = IsAny<Params> extends true
  ? Params
  : Omit<Params, keyof Update> & Update extends infer U extends ValuesParams<S>
    ? Expand<U>
    : never;
