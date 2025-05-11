import type {
  BaseDbDiscriminator,
  ExpressionBase,
  TableBase,
} from '../../Base';
import type { DataTypeBoolean } from '../../DataType';
import type { ExpressionBuilderShape } from '../../ExpressionBuilder';
import { isExpressionBuilderShape } from '../../expression-builder';
import type { ExpressionColumn } from '../../expressions/ExpressionColumn';
import type { SqlString } from '../../sql-string';
import type {
  IndexDefinition,
  IndexMethod,
  IndexOptions,
} from './index-definition';

export interface IndexState<
  Table extends TableBase<S>,
  S extends BaseDbDiscriminator,
> {
  readonly expressions: Array<ExpressionBase<any> | SqlString>;
  readonly options: IndexOptions;
  readonly name?: string | undefined;
  readonly storingColumns?:
    | Array<
        ExpressionColumn<
          {
            table: Table;
            alias: Table['defaultAlias'];
            isUsingAlias: false;
          },
          string,
          S
        >
      >
    | undefined;
  readonly condition?:
    | ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>>
    | undefined;
  readonly partition?: { by: 'ALL' | SqlString } | undefined;
}

export function createIndexBuilder<
  Table extends TableBase<S>,
  S extends BaseDbDiscriminator,
>(
  expressions: Array<ExpressionBuilderShape<ExpressionBase<any>> | SqlString>
): IndexDefinition<Table, S> {
  const initialState: IndexState<Table, S> = {
    expressions: expressions.map((expr) =>
      isExpressionBuilderShape(expr) ? expr._expression : expr
    ),
    options: {},
  };

  function createBuilder(
    state: IndexState<Table, S>
  ): IndexDefinition<Table, S> {
    return {
      _properties: {
        expressions: state.expressions,
        options: state.options,
        name: state.name,
        condition: state.condition,
        partition: state.partition,
        storingColumns: state.storingColumns,
      },

      name(indexName: string) {
        return createBuilder({
          ...state,
          name: indexName,
        });
      },

      unique() {
        return createBuilder({
          ...state,
          options: { ...state.options, unique: true },
        });
      },

      concurrently() {
        return createBuilder({
          ...state,
          options: { ...state.options, concurrently: true },
        });
      },

      using(method: IndexMethod) {
        return createBuilder({
          ...state,
          options: { ...state.options, method },
        });
      },

      inverted() {
        return createBuilder({
          ...state,
          options: { ...state.options, inverted: true },
        });
      },

      where(
        condition: ExpressionBuilderShape<ExpressionBase<DataTypeBoolean>>
      ) {
        return createBuilder({
          ...state,
          condition,
        });
      },

      storing(
        ...columns: Array<
          ExpressionBuilderShape<
            ExpressionColumn<
              {
                table: Table;
                alias: Table['defaultAlias'];
                isUsingAlias: false;
              },
              string,
              S
            >
          >
        >
      ) {
        return createBuilder({
          ...state,
          storingColumns: columns.map((col) => col._expression),
        });
      },

      with(params: NonNullable<IndexOptions['storageParameters']>) {
        return createBuilder({
          ...state,
          options: {
            ...state.options,
            storageParameters: params,
          },
        });
      },

      partitionBy(expr: 'ALL' | SqlString) {
        return createBuilder({
          ...state,
          partition: { by: expr },
        });
      },
    };
  }

  return createBuilder(initialState);
}
