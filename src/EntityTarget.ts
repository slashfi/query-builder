import type { GenericAny } from './core-utils';
import type { BaseDbDiscriminator, TableBase } from './Base';
import type { CompiledIndexesConfig } from './ddl/index-config';

export type EntityTarget<
  T extends TableBase<S>,
  S extends BaseDbDiscriminator,
> = {
  Table: T;
  idx?: CompiledIndexesConfig<{ Table: T }, GenericAny, S>;
};

export type GenericEntityTarget<S extends BaseDbDiscriminator> = EntityTarget<
  TableBase<S>,
  S
>;
