import type { BaseDbDiscriminator, ExpressionBase, TableBase } from './Base';
import type { DataTypeBoolean } from './DataType';
import type { GenericEntityTarget } from './EntityTarget';

export type TargetJoinType =
  | {
      type: 'left';
      on: ExpressionBase<DataTypeBoolean>;
    }
  | {
      type: 'right';
      on: ExpressionBase<DataTypeBoolean>;
    }
  | {
      /**
       * Joins for inserts
       */
      type: 'insert';
    };

export interface TargetBase<S extends BaseDbDiscriminator> {
  table: TableBase<S>;
  alias: string;
  customIndex?: string | undefined;
  join?: TargetJoinType;
  /**
   * Whether the target uses the alias in its expressions
   */
  isUsingAlias: boolean;
}

export type TargetList<S extends BaseDbDiscriminator> =
  readonly TargetBase<S>[];

export function extendTargetList<
  T extends TargetList<S>,
  New extends TargetBase<S>,
  S extends BaseDbDiscriminator,
>(curr: T, newValue: New): readonly [...T, New] {
  return [...curr, newValue] as const;
}

export type LeftJoinTarget<
  Target extends GenericEntityTarget<S>,
  Alias extends string,
  BooleanExpr extends ExpressionBase<DataTypeBoolean>,
  S extends BaseDbDiscriminator,
> = {
  join: {
    type: 'left';
    on: BooleanExpr;
  };
  table: Target['Table'];
  target: Target;
  alias: Alias;
  isUsingAlias: true;
};

export type RightJoinTarget<
  Target extends GenericEntityTarget<S>,
  Alias extends string,
  BooleanExpr extends ExpressionBase<DataTypeBoolean>,
  S extends BaseDbDiscriminator,
> = {
  join: {
    type: 'right';
    on: BooleanExpr;
  };
  table: Target['Table'];
  target: Target;
  alias: Alias;
  isUsingAlias: true;
};

export type GetEntityFromTargetList<
  List extends TargetList<S>,
  Alias extends List[number]['alias'],
  S extends BaseDbDiscriminator,
> = Extract<List[number], { alias: Alias }>;

export type InferAlias<
  Target extends GenericEntityTarget<S>,
  Alias extends string,
  S extends BaseDbDiscriminator,
> = [Alias] extends [never]
  ? Target extends GenericEntityTarget<S>
    ? Target['Table']['defaultAlias']
    : never
  : Alias;
