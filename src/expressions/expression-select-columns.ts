import { mapObject, pick } from '@/core-utils';
import type { TargetBase } from 'src/from-builder';
import type { BaseDbDiscriminator, ExpressionBase } from '../base';
import { createAstNode } from '../create-ast-node';
import {
  type DataTypeTabularColumns,
  createDataTypeTabularColumns,
} from '../data-type';
import { sql } from '../sql-string';
import type { TuplifyUnion } from '../util';
import {
  type IsJoinTypeNullable,
  isJoinTypeNullable,
} from './expression-column';

export interface ExpressionSelectColumns<
  Base extends TargetBase<S>,
  Keys extends
    keyof Base['table']['columnSchema'] = keyof Base['table']['columnSchema'],
  S extends BaseDbDiscriminator = BaseDbDiscriminator,
> extends ExpressionBase<
    DataTypeTabularColumns<
      Pick<
        {
          [Key in keyof Base['table']['columnSchema']]: Base['table']['columnSchema'][Key]['dataType'];
        },
        Keys
      >,
      IsJoinTypeNullable<Base['join']>
    >
  > {
  variant: 'select_expression';
  type: 'select_columns';
  table: Base['table'];
  alias: Base['alias'];
  keys: Keys[];
  isAggregate: false;
  inferredAliases: TuplifyUnion<Extract<Keys, string>> extends infer U extends
    ReadonlyArray<string>
    ? Prepend<U, Base['alias']>
    : never;
}

export const expressionSelectColumns = createAstNode<
  ExpressionSelectColumns<TargetBase<BaseDbDiscriminator>, any>
>()({
  class: 'expression',
  variant: 'select_expression',
  type: 'select_columns',
  create: <
    Base extends TargetBase<S>,
    Keys extends ReadonlyArray<
      Extract<keyof Base['table']['columnSchema'], string>
    >,
    S extends BaseDbDiscriminator,
  >(
    targetBase: Base,
    keys: Keys
  ): ExpressionSelectColumns<Base, Keys[number], S> => {
    return {
      class: 'expression',
      variant: 'select_expression',
      type: 'select_columns',
      table: targetBase.table,
      alias: targetBase.alias,
      columnReferences: [] as any,
      dataType: createDataTypeTabularColumns(
        mapObject(
          pick(targetBase.table.columnSchema, keys),
          (val) => val.dataType
        ),
        {
          isNullable: isJoinTypeNullable(targetBase.join),
        }
      ) as any,
      inferredAliases: keys.map((key) => `${targetBase.alias}_${key}`) as any,
      isAggregate: false,
      keys: keys as any,
    };
  },
  writeSql: (node) => {
    return sql.join(
      node.keys.map((key) => {
        const columnName = node.table.columnSchema[key].columnName;

        return sql.column({
          table: node.alias,
          name: columnName,
          alias: `${node.alias}_${columnName}`,
        });
      }),
      ', '
    );
  },
});

type Prepend<T extends ReadonlyArray<string>, Prepend extends string> = {
  [Key in keyof T]: T[Key] extends T[number]
    ? `"${Prepend}"_"${T[Key]}"`
    : never;
};
