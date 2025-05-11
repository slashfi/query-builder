import { describe, expect, it } from 'vitest';
import { sql } from '../../sql-string';
import { createTypeORMMigrationFormatter } from '../formatters/typeorm';
import type { MigrationDefinition } from '../types';

describe('TypeORMMigrationFormatter', () => {
  const formatter = createTypeORMMigrationFormatter();

  it('formats basic migration with up and down', () => {
    const migration: MigrationDefinition = {
      name: 'AddUserEmail20240315',
      constraints: {
        users: {
          must_exist: true,
          columns: {},
          indexes: {},
        },
      },
      up: [
        sql.__dangerouslyConstructRawSql(
          'ALTER TABLE users ADD COLUMN email varchar NOT NULL'
        ),
      ],
      down: [
        sql.__dangerouslyConstructRawSql('ALTER TABLE users DROP COLUMN email'),
      ],
      tables: ['users'],
    };

    const result = formatter.format(migration);

    // Verify TypeORM structure
    expect(result).toContain(
      'import type { MigrationInterface, QueryRunner } from "typeorm"'
    );
    expect(result).toContain(
      'export class AddUserEmail20240315\n  implements MigrationInterface'
    );
    expect(result).toContain("name = 'AddUserEmail20240315'");

    // Verify constraints
    expect(result).toContain('static constraints =');
    expect(result).toContain('"must_exist": true');

    // Verify up migration
    expect(result).toContain(
      'async up(queryRunner: QueryRunner): Promise<void>'
    );
    expect(result).toContain(
      'ALTER TABLE users ADD COLUMN email varchar NOT NULL'
    );

    // Verify down migration
    expect(result).toContain(
      'async down(queryRunner: QueryRunner): Promise<void>'
    );
    expect(result).toContain('ALTER TABLE users DROP COLUMN email');
  });

  it('formats migration with multiple statements', () => {
    const migration: MigrationDefinition = {
      name: 'AddUserEmailAndIndex20240315',
      constraints: {
        users: {
          must_exist: true,
          columns: {},
          indexes: {},
        },
      },
      up: [
        sql.__dangerouslyConstructRawSql(
          'ALTER TABLE users ADD COLUMN email varchar NOT NULL'
        ),
        sql.__dangerouslyConstructRawSql(
          'CREATE INDEX idx_user_email ON users(email)'
        ),
      ],
      down: [
        sql.__dangerouslyConstructRawSql('DROP INDEX idx_user_email'),
        sql.__dangerouslyConstructRawSql('ALTER TABLE users DROP COLUMN email'),
      ],
      tables: ['users'],
    };

    const result = formatter.format(migration);

    // Verify multiple up statements
    expect(result).toContain(
      'ALTER TABLE users ADD COLUMN email varchar NOT NULL'
    );
    expect(result).toContain('CREATE INDEX idx_user_email ON users(email)');

    // Verify multiple down statements in correct order
    const downIndex = result.indexOf('DROP INDEX idx_user_email');
    const dropColumnIndex = result.indexOf(
      'ALTER TABLE users DROP COLUMN email'
    );
    expect(downIndex).toBeLessThan(dropColumnIndex);
  });

  it('formats migration with complex constraints', () => {
    const migration: MigrationDefinition = {
      name: 'ModifyUserEmail20240315',
      constraints: {
        users: {
          must_exist: true,
          columns: {
            email: {
              type: 'varchar',
              nullable: false,
            },
          },
          indexes: {
            idx_user_email: {
              must_exist: true,
            },
          },
        },
      },
      up: [
        sql.__dangerouslyConstructRawSql(
          'ALTER TABLE users ALTER COLUMN email SET DATA TYPE text'
        ),
      ],
      down: [
        sql.__dangerouslyConstructRawSql(
          'ALTER TABLE users ALTER COLUMN email SET DATA TYPE varchar'
        ),
      ],
      tables: ['users'],
    };

    const result = formatter.format(migration);

    // Verify constraints are properly formatted
    expect(result).toContain('"type": "varchar"');
    expect(result).toContain('"nullable": false');
    expect(result).toContain('"must_exist": true');

    // Split result into lines for exact indentation checking
    const lines = result.split('\n');

    // Helper to count leading spaces
    const getLeadingSpaces = (line: string) =>
      line.match(/^(\s*)/)?.[1].length ?? 0;

    // Helper to find and verify a line
    const verifyLine = (
      pattern: string,
      expectedSpaces: number,
      expectedLine: string
    ) => {
      const line = lines.find((l) => l.includes(pattern));
      expect(line).toBeDefined();
      if (line) {
        expect(getLeadingSpaces(line)).toBe(expectedSpaces);
        expect(line).toBe(expectedLine);
      }
    };

    // Verify each line's indentation
    verifyLine('class', 0, `export class ${migration.name}`);
    verifyLine('name =', 2, `  name = '${migration.name}'`);
    verifyLine('static constraints', 2, '  static constraints = {');
    verifyLine(
      'async up',
      2,
      '  async up(queryRunner: QueryRunner): Promise<void> {'
    );
    verifyLine(
      'async down',
      2,
      '  async down(queryRunner: QueryRunner): Promise<void> {'
    );

    // SQL statements should have exactly 4 spaces
    const sqlLines = lines.filter((line) =>
      line.includes('await queryRunner.query')
    );
    expect(sqlLines.length).toBeGreaterThan(0);
    sqlLines.forEach((line) => {
      expect(getLeadingSpaces(line)).toBe(4);
      expect(line.startsWith('    await queryRunner.query')).toBe(true);
    });
  });

  it('handles empty migrations', () => {
    const migration: MigrationDefinition = {
      name: 'EmptyMigration20240315',
      constraints: {},
      up: [],
      down: [],
      tables: [],
    };

    const result = formatter.format(migration);

    // Should still create valid TypeORM class
    expect(result).toContain(
      'export class EmptyMigration20240315\n  implements MigrationInterface'
    );
    expect(result).toContain(
      'async up(queryRunner: QueryRunner): Promise<void>'
    );
    expect(result).toContain(
      'async down(queryRunner: QueryRunner): Promise<void>'
    );
  });
});
