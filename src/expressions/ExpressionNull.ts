import type { ExpressionBase } from '../Base';
import { type DataTypeNull, createDataTypeNull } from '../DataType';
import { createAstNode } from '../createAstNode';
import { sql } from '../sql-string';

export interface ExpressionNull extends ExpressionBase<DataTypeNull> {
  variant: 'null_expression';
  type: 'null';
  isAggregate: false;
  columnReferences: readonly [];
  inferredAliases: [];
}

export const expressionNull = createAstNode<ExpressionNull>()({
  class: 'expression',
  variant: 'null_expression',
  type: 'null',
  create: () => {
    return {
      class: 'expression',
      variant: 'null_expression',
      type: 'null',
      columnReferences: [] as any,
      dataType: createDataTypeNull(),
      isAggregate: false,
      inferredAliases: [],
    };
  },
  writeSql: () => {
    return sql`NULL`;
  },
});
