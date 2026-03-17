import type { GenericAny } from '@/core-utils';
import { describe, expect, it } from 'vitest';
import { createDataTypeDecimal } from '../DataType';
import { createDb, createDbDiscriminator } from '../db-helper';
import { transformColumnForDataType } from '../QueryResult';

// Setup for database tests
const testSym = createDbDiscriminator('test');
const db = createDb({
  runQueriesInTransaction: async () => {},
  query: async () => [],
  discriminator: testSym,
  getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
});

describe('Decimal BigInt Support', () => {
  describe('DataType Creation', () => {
    it('should create decimal type with string mode by default', () => {
      const decimalType = createDataTypeDecimal();
      expect(decimalType.type).toBe('decimal');
      expect(decimalType.mode).to.equal('string');
    });

    it('should create decimal type with explicit string mode', () => {
      const decimalType = createDataTypeDecimal({ mode: 'string' });
      expect(decimalType.type).toBe('decimal');
      expect(decimalType.mode).toBe('string');
    });

    it('should create decimal type with bigint mode', () => {
      const decimalType = createDataTypeDecimal({ mode: 'bigint' });
      expect(decimalType.type).toBe('decimal');
      expect(decimalType.mode).toBe('bigint');
    });
  });

  describe('Deserialization', () => {
    it('should deserialize to string for string mode', () => {
      const decimalType = createDataTypeDecimal();
      const result = transformColumnForDataType(
        '123.45',
        decimalType as GenericAny
      );
      expect(result).toBe('123.45');
      expect(typeof result).toBe('string');
    });

    it('should deserialize to bigint for bigint mode', () => {
      const decimalType = createDataTypeDecimal({ mode: 'bigint' });
      const result = transformColumnForDataType(
        '123456789012345678901234567890',
        decimalType as GenericAny
      );
      expect(result).toBe(123456789012345678901234567890n);
      expect(typeof result).toBe('bigint');
    });

    it('should throw error for invalid bigint conversion', () => {
      const decimalType = createDataTypeDecimal({ mode: 'bigint' });
      expect(() =>
        transformColumnForDataType('not-a-number', decimalType as GenericAny)
      ).toThrow('Failed to convert decimal to BigInt');
    });
  });

  describe('Table Definition', () => {
    interface TestSchemaWithBigInt {
      id: string;
      amount: bigint;
      price: string;
    }

    it('should create table with bigint decimal column', () => {
      const TestTable = db
        .buildTableFromSchema<TestSchemaWithBigInt>()
        .tableName('test_bigint_decimal')
        .columns({
          id: (_) => _.varchar(),
          amount: (_) => _.decimal({ mode: 'bigint' }),
          price: (_) => _.decimal(),
        })
        .primaryKey('id')
        .defaultAlias('test')
        .build();

      expect(TestTable.columnSchema.amount.dataType.type).toBe('decimal');
      if ('mode' in TestTable.columnSchema.amount.dataType) {
        expect(TestTable.columnSchema.amount.dataType.mode).toBe('bigint');
      }
      expect(TestTable.columnSchema.price.dataType.type).toBe('decimal');
      if ('mode' in TestTable.columnSchema.price.dataType) {
        expect(TestTable.columnSchema.price.dataType.mode).toBeUndefined();
      }
    });
  });
});
