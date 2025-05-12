import type { BaseDbDiscriminator, TableBase } from './base';

export type EntityTarget<
  T extends TableBase<S>,
  S extends BaseDbDiscriminator,
> = {
  Table: T;
};

export type GenericEntityTarget<S extends BaseDbDiscriminator> = EntityTarget<
  TableBase<S>,
  S
>;
