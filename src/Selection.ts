import type { MakeRequired } from '@/core-utils';
import type { BaseDbDiscriminator, ExpressionBase } from './Base';
import type { DataTypeBoolean, IsDataTypeNullable } from './DataType';
import type { TargetBase } from './FromBuilder';
import type { SelectionArray } from './QueryBuilderParams';
import type { ClauseForSelectListItem } from './clauses/ClauseForSelectListItem';
import type { ExpressionColumn } from './expressions/ExpressionColumn';
import type { ExpressionLeftRightBinary } from './expressions/ExpressionLeftRightBinary';
import type { ExpressionRightUnaryBinary } from './expressions/ExpressionRightUnaryBinary';
import type { ExpressionSelectColumns } from './expressions/ExpressionSelectColumns';
import type { OperatorBinaryLogical } from './operators/OperatorBinaryLogical';
import type { OperatoryUnaryIs } from './operators/OperatorUnaryIs';
import type { TypescriptTypeFromDataType } from './util';

/**
 * Entity to track the output type definition
 * so that we can augment and narrow down the types
 */
export type SelectItemWithType = {
  expr: ExpressionBase<any>;
  typeDefinition: any;
};

export type SelectionResult<
  Selection extends SelectionArray,
  S extends BaseDbDiscriminator,
> = Selection extends readonly [infer U, ...infer J extends SelectionArray]
  ? U extends ClauseForSelectListItem<
      infer K extends ExpressionBase<any>,
      infer Alias
    >
    ? [SelectionResultFromExpression<K, Alias, S>, ...SelectionResult<J, S>]
    : []
  : [];

export type SelectionResultFromExpression<
  Base extends ExpressionBase<any>,
  Alias extends string | undefined,
  S extends BaseDbDiscriminator,
> = Base extends ExpressionBase<infer DataType>
  ? Base extends ExpressionSelectColumns<TargetBase<S>, infer _>
    ? {
        expr: Base;
        typeDefinition: {
          [Key in Base['alias']]: TypescriptTypeFromDataType<Base['dataType']>;
        };
      }
    : undefined extends Alias
      ? {
          expr: Base;
          typeDefinition: {
            [Key in ReadonlyArray<string> extends Base['inferredAliases']
              ? '?column?'
              : NonNullable<
                  Base['inferredAliases']
                >[number]]: TypescriptTypeFromDataType<DataType>;
          };
        }
      : {
          expr: Base;
          typeDefinition: {
            [Key in NonNullable<Alias>]: TypescriptTypeFromDataType<DataType>;
          };
        }
  : never;

export type TypeNarrowSelectionFromBooleanExpression<
  Data extends ReadonlyArray<SelectItemWithType>,
  Expr extends ExpressionBase<DataTypeBoolean>,
  OriginalData extends ReadonlyArray<SelectItemWithType>,
  S extends BaseDbDiscriminator,
> = Data extends [
  infer U extends SelectItemWithType,
  ...infer J extends ReadonlyArray<SelectItemWithType>,
]
  ? [
      TypeNarrowSelectItemFromBooleanExpression<U, Expr, U, S>,
      ...TypeNarrowSelectionFromBooleanExpression<J, Expr, OriginalData, S>,
    ]
  : [];

export type TypeNarrowSelectItemFromBooleanExpression<
  SelectItem extends SelectItemWithType,
  Expr extends ExpressionBase<DataTypeBoolean>,
  OriginalSelectItem extends SelectItemWithType,
  S extends BaseDbDiscriminator,
> = Expr extends ExpressionLeftRightBinary<any, any, any>
  ? TypeNarrowSelectItemForLeftRightBinaryExpr<
      SelectItem,
      Expr,
      OriginalSelectItem,
      S
    >
  : Expr extends ExpressionRightUnaryBinary<any, any>
    ? TypeNarrowSelectItemForRightUnaryExpr<SelectItem, Expr, S>
    : SelectItem;

type TypeNarrowSelectItemForLeftRightBinaryExpr<
  SelectItem extends SelectItemWithType,
  Expr extends ExpressionBase<DataTypeBoolean>,
  OriginalSelectItem extends SelectItemWithType,
  S extends BaseDbDiscriminator,
> = Expr extends ExpressionLeftRightBinary<
  infer LeftExpr,
  infer Op,
  infer RightExpr
>
  ? Op extends OperatorBinaryLogical<'AND'>
    ? TypeNarrowSelectItemFromBooleanExpression<
        TypeNarrowSelectItemFromBooleanExpression<
          SelectItem,
          LeftExpr,
          OriginalSelectItem,
          S
        >,
        RightExpr,
        OriginalSelectItem,
        S
      >
    : Op extends OperatorBinaryLogical<'OR'>
      ? OriginalSelectItem
      : SelectItem
  : SelectItem;

type TypeNarrowSelectItemForRightUnaryExpr<
  SelectItem extends SelectItemWithType,
  Expr extends ExpressionBase<DataTypeBoolean>,
  S extends BaseDbDiscriminator,
> = Expr extends ExpressionRightUnaryBinary<infer LeftExpr, infer Op>
  ? LeftExpr extends ExpressionColumn<any, any, S>
    ? Op extends OperatoryUnaryIs<'NULL', true>
      ? SelectItem['expr'] extends ExpressionSelectColumns<any, any>
        ? /*
           * If the clause is <column> IS NOT NULL then:
           *  1. IF the COLUMN itself is not null, then that means the column can only
           *      NULL if the JOIN itself was NULL. In this case, it means that the entity was
           *      successfully joined.
           *  2. If the COLUMN itself IS NULLABLE, then the JOIN might still be nullable but if the
           *       join was successful, then the column WILL NOT be NULL
           */

          // This checks clause is referencing the same table as the select column
          LeftExpr['tableAlias'] extends SelectItem['expr']['alias']
          ? IsDataTypeNullable<LeftExpr['dataType']> extends false
            ? {
                expr: SelectItem['expr'];
                typeDefinition: {
                  [Alias in keyof SelectItem['typeDefinition']]: NonNullable<
                    SelectItem['typeDefinition'][Alias]
                  >;
                };
              }
            : {
                expr: SelectItem['expr'];
                typeDefinition: {
                  [Alias in keyof SelectItem['typeDefinition']]:
                    | MakeRequired<
                        NonNullable<SelectItem['typeDefinition'][Alias]>,
                        LeftExpr['value']
                      >
                    // If the original alias is potentially undefined, make sure the new type def
                    // if also potentially undefined
                    | (SelectItem['typeDefinition'][Alias] extends
                        | any
                        | undefined
                        ? undefined
                        : never);
                };
              }
          : SelectItem
        : SelectItem
      : Op extends OperatoryUnaryIs<'NULL', false>
        ? SelectItem['expr'] extends ExpressionSelectColumns<any, any>
          ? LeftExpr['tableAlias'] extends SelectItem['expr']['alias']
            ? /*
               * 1. IF the COLUMN itself is nullable, then we force column itself to be NULL
               * 2. If the COLUMN itself is NOT nullable, then all columns should be NULL
               */
              IsDataTypeNullable<LeftExpr['dataType']> extends false
              ? {
                  expr: SelectItem['expr'];
                  typeDefinition: {
                    [Alias in keyof SelectItem['typeDefinition']]: undefined;
                  };
                }
              : {
                  expr: SelectItem['expr'];
                  typeDefinition: {
                    [Alias in keyof SelectItem['typeDefinition']]:
                      | {
                          [Column in keyof NonNullable<
                            SelectItem['typeDefinition'][Alias]
                          >]: LeftExpr['value'] extends Column
                            ? undefined
                            : NonNullable<
                                SelectItem['typeDefinition'][Alias]
                              >[Column];
                        }
                      | (SelectItem['typeDefinition'][Alias] extends
                          | any
                          | undefined
                          ? undefined
                          : never);
                  };
                }
            : SelectItem
          : SelectItem
        : SelectItem
    : SelectItem
  : SelectItem;
