import type { Config as BaseConfig } from '@swc/types';

export type Config = BaseConfig & {
  /**
   * A list of require statements
   */
  extends?: any[];
};
