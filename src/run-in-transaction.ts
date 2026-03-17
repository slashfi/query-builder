import { AsyncLocalStorage } from 'node:async_hooks';
import type { GenericAny } from './core-utils';
import type { BaseDbDiscriminator } from './Base';
import type { DbConfig } from './db-helper';

export const managerLocalStorage = new AsyncLocalStorage<{
  manager: GenericAny;
  sideEffects: (() => Promise<void>)[];
}>();

export const createTransaction = <S extends BaseDbDiscriminator>(
  config: DbConfig<S, GenericAny>
) => {
  return async <T>(func: () => Promise<T>): Promise<T> => {
    if (!config.runQueriesInTransaction) {
      throw new Error(
        'runQueriesInTransaction is not implemented. Please implement it in your db config. see docs/overview.md#4-transaction-support'
      );
    }

    if (managerLocalStorage.getStore()?.manager) {
      return await func();
    }

    const sideEffects: (() => Promise<void>)[] = [];

    let result: GenericAny;
    await config.runQueriesInTransaction(async (manager) => {
      await managerLocalStorage.run({ manager, sideEffects }, async () => {
        result = await func();
      });
    });

    for (const sideEffect of sideEffects) {
      await sideEffect();
    }

    return result;
  };
};
