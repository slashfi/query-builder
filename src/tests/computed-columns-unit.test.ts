import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';
import { sql } from '../sql-string';

describe('Computed Columns - Unit Tests', () => {
  const testSym = createDbDiscriminator('test');

  const db = createDb({
    query: async () => [],
    runQueriesInTransaction: async () => {},
    discriminator: testSym,
    getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
  });

  interface TestSchema {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string; // computed
    salary: number;
    tax: number; // computed
    netSalary: number; // computed
    createdAt: Date;
    updatedAt: Date | undefined;
  }

  class TestTable {
    static readonly Table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('test_computed_columns')
      .columns({
        id: (_) => _.varchar(),
        firstName: (_) => _.varchar(),
        lastName: (_) => _.varchar(),
        // Computed column: concatenate first and last name
        fullName: (_) =>
          _.varchar().computed(sql`CONCAT(first_name, ' ', last_name)`),
        salary: (_) => _.float(),
        // Computed column: calculate tax (10%)
        tax: (_) => _.float().computed(sql`salary * 0.1`),
        // Computed column: net salary after tax
        netSalary: (_) => _.float().computed(sql`salary - (salary * 0.1)`),
        createdAt: (_) => _.timestamp().default(sql`current_timestamp()`),
        // Nullable computed column
        updatedAt: (_) => _.timestamp({ isNullable: true }),
      })
      .primaryKey('id')
      .defaultAlias('testTable')
      .build();
  }

  describe('SQL generation - computed columns excluded from INSERT', () => {
    it('should exclude computed columns from INSERT statements', () => {
      const insertQuery = db.insert(TestTable).values({
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        salary: 75000.0,
        // fullName, tax, netSalary should be automatically computed and excluded
        // createdAt will use DEFAULT
        updatedAt: undefined,
      });

      const sqlString = insertQuery.getSqlString();
      const query = sqlString.getQuery();

      // Should not contain computed column names in INSERT
      expect(query).not.toContain('fullName');
      expect(query).not.toContain('tax');
      expect(query).not.toContain('netSalary');

      // Should contain non-computed columns
      expect(query).toContain('"id"');
      expect(query).toContain('"firstName"');
      expect(query).toContain('"lastName"');
      expect(query).toContain('"salary"');
      expect(query).toContain('"createdAt"');

      // Should use DEFAULT for createdAt
      expect(query).toContain('DEFAULT');

      expect(sqlString.getParameters()).toEqual(['1', 'John', 'Doe', 75000.0]);
    });

    it('should exclude computed columns from batch INSERT statements', () => {
      const insertQuery = db.insert(TestTable).values([
        {
          id: '1',
          firstName: 'John',
          lastName: 'Doe',
          salary: 75000.0,
          updatedAt: undefined,
        },
        {
          id: '2',
          firstName: 'Jane',
          lastName: 'Smith',
          salary: 85000.0,
          updatedAt: undefined,
        },
      ]);

      const sqlString = insertQuery.getSqlString();
      const query = sqlString.getQuery();

      // Should not contain computed column names
      expect(query).not.toContain('fullName');
      expect(query).not.toContain('tax');
      expect(query).not.toContain('netSalary');

      // Should contain two rows of values
      expect(query).toContain('($1,$2,$3,$4,DEFAULT)');
      expect(query).toContain('($5,$6,$7,$8,DEFAULT)');

      expect(sqlString.getParameters()).toEqual([
        '1',
        'John',
        'Doe',
        75000.0,
        '2',
        'Jane',
        'Smith',
        85000.0,
      ]);
    });

    it('should handle mixed computed and default columns correctly', () => {
      const insertQuery = db.insert(TestTable).values({
        id: '3',
        firstName: 'Bob',
        lastName: 'Johnson',
        salary: 65000.0,
        // createdAt has default, should use DEFAULT
        // fullName, tax, netSalary are computed, should be excluded
        updatedAt: undefined,
      });

      const sqlString = insertQuery.getSqlString();
      const query = sqlString.getQuery();

      // Verify structure: only non-computed columns are included
      expect(query).toBe(
        '\n    INSERT INTO "public"."test_computed_columns" AS "testTable"\n    ("id","firstName","lastName","salary","createdAt") VALUES \n    ($1,$2,$3,$4,DEFAULT)\n    \n    \n  '
      );

      expect(sqlString.getParameters()).toEqual([
        '3',
        'Bob',
        'Johnson',
        65000.0,
      ]);
    });
  });

  describe('Type safety', () => {
    it('should exclude computed columns from InsertableValues type', () => {
      // This should compile without TypeScript errors - computed columns are not required
      const insertQuery = db.insert(TestTable).values({
        id: '4',
        firstName: 'Alice',
        lastName: 'Wilson',
        salary: 90000.0,
        // fullName, tax, netSalary should not be required or allowed
        updatedAt: undefined,
      });

      expect(insertQuery).toBeDefined();

      // Verify the types allow this
      const sqlString = insertQuery.getSqlString();
      expect(sqlString).toBeDefined();
    });

    it('should allow computed columns to be chained with other methods', () => {
      // Test that computed columns can be chained with isNullable
      interface TestSchemaWithNullableComputed {
        id: string;
        value: number;
        computedValue: number | undefined; // nullable computed
      }

      class TestTableWithNullableComputed {
        static readonly Table = db
          .buildTableFromSchema<TestSchemaWithNullableComputed>()
          .tableName('test_nullable_computed')
          .columns({
            id: (_) => _.varchar(),
            value: (_) => _.int(),
            // Nullable computed column
            computedValue: (_) =>
              _.int({ isNullable: true }).computed(sql`value * 2`),
          })
          .primaryKey('id')
          .defaultAlias('testNullable')
          .build();
      }

      const insertQuery = db.insert(TestTableWithNullableComputed).values({
        id: '1',
        value: 42,
        // computedValue should be excluded from insert
      });

      const sqlString = insertQuery.getSqlString();
      const query = sqlString.getQuery();

      expect(query).not.toContain('computed_value');
      expect(query).toContain('"id"');
      expect(query).toContain('"value"');
      expect(sqlString.getParameters()).toEqual(['1', 42]);
    });
  });

  describe('SELECT operations', () => {
    it('should include computed columns in SELECT statements', () => {
      const selectQuery = db
        .from(TestTable)
        .select((t) => [
          t.testTable.id,
          t.testTable.fullName,
          t.testTable.tax,
          t.testTable.netSalary,
        ])
        .where((t) => t.testTable.salary.equals(75000.0));

      const sqlString = selectQuery.getSqlString();
      const query = sqlString.getQuery();

      // Should include computed columns in SELECT
      expect(query).toContain('"testTable"."fullName"');
      expect(query).toContain('"testTable"."tax"');
      expect(query).toContain('"testTable"."netSalary"');
      expect(query).toContain('WHERE "testTable"."salary" = $1');

      expect(sqlString.getParameters()).toEqual([75000.0]);
    });

    it('should allow computed columns in WHERE clauses', () => {
      const selectQuery = db
        .from(TestTable)
        .select((t) => [
          t.testTable.id,
          t.testTable.firstName,
          t.testTable.lastName,
        ])
        .where((t) => t.testTable.fullName.ilike('%john%'));

      const sqlString = selectQuery.getSqlString();
      const query = sqlString.getQuery();

      expect(query).toContain('WHERE "testTable"."fullName" ILIKE $1');
      expect(sqlString.getParameters()).toEqual(['%john%']);
    });

    it('should allow computed columns in ORDER BY clauses', () => {
      const selectQuery = db
        .from(TestTable)
        .select((t) => [
          t.testTable.id,
          t.testTable.fullName,
          t.testTable.netSalary,
        ])
        .orderBy((t) => [
          t.testTable.netSalary.desc(),
          t.testTable.fullName.asc(),
        ]);

      const sqlString = selectQuery.getSqlString();
      const query = sqlString.getQuery();

      expect(query).toContain(
        'ORDER BY "testTable"."netSalary" DESC, "testTable"."fullName" ASC'
      );
    });
  });

  describe('DDL generation', () => {
    it('should generate correct CREATE TABLE with computed columns', () => {
      // This test verifies that the table definition includes computed expressions
      const table = TestTable.Table;

      // Check that computed columns have computedExpression property
      expect(table.columnSchema.fullName.computedExpression).toBeDefined();
      expect(table.columnSchema.tax.computedExpression).toBeDefined();
      expect(table.columnSchema.netSalary.computedExpression).toBeDefined();

      // Check that non-computed columns don't have computedExpression
      expect('computedExpression' in table.columnSchema.id).toBe(false);
      expect('computedExpression' in table.columnSchema.firstName).toBe(false);
      expect('computedExpression' in table.columnSchema.lastName).toBe(false);

      // Check that computed columns are marked as optional for insert
      expect(table.columnSchema.fullName.isOptionalForInsert).toBe(true);
      expect(table.columnSchema.tax.isOptionalForInsert).toBe(true);
      expect(table.columnSchema.netSalary.isOptionalForInsert).toBe(true);
    });

    it('should have correct SQL expressions for computed columns', () => {
      const table = TestTable.Table;

      // Check the actual SQL expressions
      expect(table.columnSchema.fullName.computedExpression?.getQuery()).toBe(
        "CONCAT(first_name, ' ', last_name)"
      );
      expect(table.columnSchema.tax.computedExpression?.getQuery()).toBe(
        'salary * 0.1'
      );
      expect(table.columnSchema.netSalary.computedExpression?.getQuery()).toBe(
        'salary - (salary * 0.1)'
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle computed columns with complex expressions', () => {
      interface ComplexSchema {
        id: string;
        price: number;
        quantity: number;
        discount: number;
        total: number; // computed with complex expression
      }

      class ComplexTable {
        static readonly Table = db
          .buildTableFromSchema<ComplexSchema>()
          .tableName('complex_computed')
          .columns({
            id: (_) => _.varchar(),
            price: (_) => _.float(),
            quantity: (_) => _.int(),
            discount: (_) => _.float(),
            // Complex computed expression
            total: (_) =>
              _.float().computed(
                sql`ROUND((price * quantity) * (1 - discount / 100), 2)`
              ),
          })
          .primaryKey('id')
          .defaultAlias('complex')
          .build();
      }

      const insertQuery = db.insert(ComplexTable).values({
        id: '1',
        price: 19.99,
        quantity: 3,
        discount: 10.0,
        // total should be computed
      });

      const sqlString = insertQuery.getSqlString();
      const query = sqlString.getQuery();

      expect(query).not.toContain('total');
      expect(query).toContain('"price"');
      expect(query).toContain('"quantity"');
      expect(query).toContain('"discount"');

      expect(sqlString.getParameters()).toEqual(['1', 19.99, 3, 10.0]);
    });

    it('should handle computed columns that reference other computed columns indirectly', () => {
      // Note: Direct references between computed columns may not work in all databases,
      // but we can test the structure
      interface ChainedSchema {
        id: string;
        baseValue: number;
        doubled: number; // computed: baseValue * 2
        quadrupled: number; // computed: doubled * 2 (references computed column)
      }

      class ChainedTable {
        static readonly Table = db
          .buildTableFromSchema<ChainedSchema>()
          .tableName('chained_computed')
          .columns({
            id: (_) => _.varchar(),
            baseValue: (_) => _.int(),
            doubled: (_) => _.int().computed(sql`base_value * 2`),
            quadrupled: (_) => _.int().computed(sql`doubled * 2`),
          })
          .primaryKey('id')
          .defaultAlias('chained')
          .build();
      }

      const insertQuery = db.insert(ChainedTable).values({
        id: '1',
        baseValue: 5,
        // doubled and quadrupled should be computed
      });

      const sqlString = insertQuery.getSqlString();
      const query = sqlString.getQuery();

      expect(query).not.toContain('doubled');
      expect(query).not.toContain('quadrupled');
      expect(query).toContain('"baseValue"');

      expect(sqlString.getParameters()).toEqual(['1', 5]);
    });

    it('should handle tables with only computed columns (besides primary key)', () => {
      interface ComputedOnlySchema {
        id: string;
        computed1: string; // computed
        computed2: number; // computed
      }

      class ComputedOnlyTable {
        static readonly Table = db
          .buildTableFromSchema<ComputedOnlySchema>()
          .tableName('computed_only')
          .columns({
            id: (_) => _.varchar(),
            computed1: (_) => _.varchar().computed(sql`'computed_' || id`),
            computed2: (_) => _.int().computed(sql`LENGTH(id)`),
          })
          .primaryKey('id')
          .defaultAlias('computedOnly')
          .build();
      }

      const insertQuery = db.insert(ComputedOnlyTable).values({
        id: 'test123',
        // All other columns are computed
      });

      const sqlString = insertQuery.getSqlString();
      const query = sqlString.getQuery();

      expect(query).not.toContain('computed1');
      expect(query).not.toContain('computed2');
      expect(query).toContain('"id"');

      expect(sqlString.getParameters()).toEqual(['test123']);
    });
  });

  describe('Integration with other features', () => {
    it('should work with RETURNING clause', () => {
      const insertQuery = db
        .insert(TestTable)
        .values({
          id: '5',
          firstName: 'Charlie',
          lastName: 'Brown',
          salary: 55000.0,
          updatedAt: undefined,
        })
        .returning((t) => [t.id, t.fullName, t.tax, t.netSalary]);

      const sqlString = insertQuery.getSqlString();
      const query = sqlString.getQuery();

      // Should exclude computed columns from INSERT but include in RETURNING
      expect(query).toContain('INSERT INTO');
      expect(query).not.toContain('"full_name","tax","net_salary") VALUES'); // Not in VALUES
      expect(query).toContain(
        'RETURNING "testTable"."id", "testTable"."fullName", "testTable"."tax", "testTable"."netSalary"'
      );

      expect(sqlString.getParameters()).toEqual([
        '5',
        'Charlie',
        'Brown',
        55000.0,
      ]);
    });

    it('should work with ON CONFLICT clauses', () => {
      const insertQuery = db
        .insert(TestTable)
        .values({
          id: '6',
          firstName: 'David',
          lastName: 'Miller',
          salary: 70000.0,
          updatedAt: undefined,
        })
        .onConflict({
          columns: (t) => [t.id],
          doUpdateSet: {
            firstName: 'Updated David',
            salary: 75000.0,
            // Cannot update computed columns - they should be excluded from doUpdateSet type
          },
        });

      const sqlString = insertQuery.getSqlString();
      const query = sqlString.getQuery();

      expect(query).toContain('ON CONFLICT');
      expect(query).toContain('DO UPDATE SET');
      expect(query).toContain('"firstName"');
      expect(query).toContain('"salary"');

      // Computed columns should not be in the UPDATE SET
      const updateSetPart = query.substring(query.indexOf('UPDATE SET'));
      expect(updateSetPart).not.toContain('fullName');
      expect(updateSetPart).not.toContain('tax');
      expect(updateSetPart).not.toContain('netSalary');
    });
  });
});
