import { describe, expect, it } from 'vitest';
import { getAstNodeRepository } from '../ast-node-repository';
import { constantForArray } from '../constants/ConstantForArray';
import { constantForDecimal } from '../constants/ConstantForDecimal';
import { constantForInteger } from '../constants/ConstantForInteger';
import { createDataTypeDecimal } from '../DataType';
import { createDb, createDbDiscriminator } from '../db-helper';
import { createExpressionBuilder } from '../expression-builder';
import { cast } from '../functions/cast';
import { avg, max, min } from '../functions/minOrMaxExpressionBuilder';
import { sum } from '../functions/sum';

// Setup for database tests
const testSym = createDbDiscriminator('test');
const db = createDb({
  runQueriesInTransaction: async () => {},
  query: async () => [],
  discriminator: testSym,
  getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
});

interface CustomSchemaTable {
  id: string;
  value: string;
  test: number;
}

class MainTable {
  static readonly Table = db
    .buildTableFromSchema<CustomSchemaTable>()
    .columns({
      id: (_) => _.varchar(),
      value: (_) => _.decimal(),
      test: (_) => _.int(),
    })
    .primaryKey('id')
    .tableName('main_table')
    .schema('custom')
    .defaultAlias('main')
    .build();
}

describe('decimal data type tests', function () {
  // Basic functionality tests
  describe('basic functionality', () => {
    it('should create a decimal constant with string value', () => {
      const c = constantForDecimal.create('1.23');
      expect(typeof c.value).toBe('string');
      expect(c.type).toBe('decimal');
      expect(c.dataType.type).toBe('decimal');
    });

    it('should generate correct SQL for constants', () => {
      const c = constantForDecimal.create('1.23');
      const sqlString = constantForDecimal.writeSql(c);
      // SQL uses parameterized queries, so the value is replaced with a placeholder
      expect(sqlString.getQuery()).toEqual('$1');
      expect(sqlString.getParameters()).toEqual(['1.23']);
    });
  });

  // Aggregate function tests
  describe('aggregate functions', () => {
    it('should support sum function with decimal values', () => {
      const c = constantForDecimal.create('1.23');
      const expr = createExpressionBuilder(c);
      const sumExpr = sum(expr);

      expect(sumExpr._expression.type).toBe('sum');
      // The data type is a union of decimal and null, so the type is 'union'
      expect(sumExpr._expression.dataType.type).toBe('union');
      // But the non-null part of the union should be decimal
      const nonNullType = sumExpr._expression.dataType.values.find(
        (dt) => dt.type !== 'null'
      );
      expect(nonNullType?.type).toBe('decimal');

      // Get the SQL string from the expression using the repository
      const repo = getAstNodeRepository(sumExpr._expression);
      const sqlString = repo.writeSql(sumExpr._expression, undefined);
      expect(sqlString.getQuery()).toEqual('SUM($1)');
      expect(sqlString.getParameters()).toEqual(['1.23']);
    });

    it('should support min function with decimal values', () => {
      const c = constantForDecimal.create('1.23');
      const expr = createExpressionBuilder(c);
      const minExpr = min(expr);

      expect(minExpr._expression.type).toBe('data_distribution_function');
      expect(minExpr._expression.dataType.type).toBe('union');

      // Get the SQL string from the expression using the repository
      const repo = getAstNodeRepository(minExpr._expression);
      const sqlString = repo.writeSql(minExpr._expression, undefined);
      expect(sqlString.getQuery()).toEqual('MIN($1)');
      expect(sqlString.getParameters()).toEqual(['1.23']);
    });

    it('should support max function with decimal values', () => {
      const c = constantForDecimal.create('1.23');
      const expr = createExpressionBuilder(c);
      const maxExpr = max(expr);

      expect(maxExpr._expression.type).toBe('data_distribution_function');
      expect(maxExpr._expression.dataType.type).toBe('union');

      // Get the SQL string from the expression using the repository
      const repo = getAstNodeRepository(maxExpr._expression);
      const sqlString = repo.writeSql(maxExpr._expression, undefined);
      expect(sqlString.getQuery()).toEqual('MAX($1)');
      expect(sqlString.getParameters()).toEqual(['1.23']);
    });

    it('should support avg function with decimal values', () => {
      const c = constantForDecimal.create('1.23');
      const expr = createExpressionBuilder(c);
      const avgExpr = avg(expr);

      expect(avgExpr._expression.type).toBe('data_distribution_function');
      expect(avgExpr._expression.dataType.type).toBe('union');

      // Get the SQL string from the expression using the repository
      const repo = getAstNodeRepository(avgExpr._expression);
      const sqlString = repo.writeSql(avgExpr._expression, undefined);
      expect(sqlString.getQuery()).toEqual('AVG($1)');
      expect(sqlString.getParameters()).toEqual(['1.23']);
    });
  });

  // Comparison operator tests
  describe('comparison operators', () => {
    it('should support equals comparison with decimal values', () => {
      const c1 = constantForDecimal.create('1.23');
      const c2 = constantForDecimal.create('1.23');
      const expr1 = createExpressionBuilder(c1);
      const expr2 = createExpressionBuilder(c2);

      const equalsExpr = expr1.equals(expr2);

      expect(equalsExpr._expression.type).toBe('left_right_comparator');
      expect(equalsExpr._expression.dataType.type).toBe('boolean');

      const repo = getAstNodeRepository(equalsExpr._expression);
      const sqlString = repo.writeSql(equalsExpr._expression, undefined);
      expect(sqlString.getQuery()).toEqual('$1 = $2');
      expect(sqlString.getParameters()).toEqual(['1.23', '1.23']);
    });

    it('should support database queries with decimal comparisons', () => {
      const val = '1000000000000000000000000000000';

      const sqlString = db
        .from(MainTable)
        .where((_) => _.main.value.equals(val).and(_.main.test.equals(1)))
        .getSqlString();

      expect(sqlString.getQuery()).toContain('"main"."value" = $1');
      expect(sqlString.getParameters()).toContain(val);
    });
  });

  // Type casting tests
  describe('type casting', () => {
    it('should support casting to decimal type', () => {
      const c = constantForInteger.create(123);
      const expr = createExpressionBuilder(c);
      const castExpr = cast(expr, 'decimal');

      expect(castExpr._expression.type).toBe('cast');
      expect(castExpr._expression.dataType.type).toBe('decimal');

      const repo = getAstNodeRepository(castExpr._expression);
      const sqlString = repo.writeSql(castExpr._expression, undefined);
      expect(sqlString.getQuery()).toEqual('CAST($1 AS decimal)');
      expect(sqlString.getParameters()).toEqual([123]);
    });

    it('should support casting from decimal to other types', () => {
      const c = constantForDecimal.create('123.45');
      const expr = createExpressionBuilder(c);
      const castExpr = cast(expr, 'int');

      expect(castExpr._expression.type).toBe('cast');
      expect(castExpr._expression.dataType.type).toBe('int');

      const repo = getAstNodeRepository(castExpr._expression);
      const sqlString = repo.writeSql(castExpr._expression, undefined);
      expect(sqlString.getQuery()).toEqual('CAST($1 AS int)');
      expect(sqlString.getParameters()).toEqual(['123.45']);
    });
  });

  // Edge case tests
  describe('edge cases', () => {
    it('should handle very large integer values', () => {
      const largeInt = '1'.repeat(70);
      const c = constantForDecimal.create(largeInt);
      expect(c.value).toEqual(largeInt);

      const sqlString = constantForDecimal.writeSql(c);
      expect(sqlString.getQuery()).toEqual('$1');
      expect(sqlString.getParameters()).toEqual([largeInt]);
    });

    it('should handle high-precision fractional values', () => {
      const highPrecision = `3.${'1'.repeat(50)}`;
      const c = constantForDecimal.create(highPrecision);
      expect(c.value).toEqual(highPrecision);

      const sqlString = constantForDecimal.writeSql(c);
      expect(sqlString.getQuery()).toEqual('$1');
      expect(sqlString.getParameters()).toEqual([highPrecision]);
    });

    it('should handle negative values', () => {
      const negative = '-42.5';
      const c = constantForDecimal.create(negative);
      expect(c.value).toEqual(negative);

      const sqlString = constantForDecimal.writeSql(c);
      expect(sqlString.getQuery()).toEqual('$1');
      expect(sqlString.getParameters()).toEqual([negative]);
    });

    it('should handle zero', () => {
      const zero = '0.0';
      const c = constantForDecimal.create(zero);
      expect(c.value).toEqual(zero);

      const sqlString = constantForDecimal.writeSql(c);
      expect(sqlString.getQuery()).toEqual('$1');
      expect(sqlString.getParameters()).toEqual([zero]);
    });
  });

  // Array support tests
  describe('array support', () => {
    it('should support decimal arrays', () => {
      const decimalType = createDataTypeDecimal({ isNullable: false });
      const values = ['1.1', '2.2', '3.3'].map((v) =>
        constantForDecimal.create(v)
      );
      const array = constantForArray.create(decimalType, values);

      expect(array.dataType.type).toEqual('array');
      expect(array.dataType.primitiveDataType.type).toEqual('decimal');

      const sqlString = constantForArray.writeSql(array);
      expect(sqlString.getQuery()).toEqual('ARRAY[$1,$2,$3]::DECIMAL[]');
      expect(sqlString.getParameters()).toEqual(['1.1', '2.2', '3.3']);
    });
  });
});
