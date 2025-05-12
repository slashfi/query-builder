import { describe, expect, it } from 'vitest';
import type { BaseDbDiscriminator } from '../../base';
import type { Config } from '../../introspection/config';
import type { FastSchema } from '../../introspection/introspect-schema';
import type { IntrospectionResult } from '../../introspection/schema-diff';
import { sql } from '../../sql-string';
import { extractConstraints } from '../extract-constraints';
import { createTypeORMMigrationFormatter } from '../formatters/typeorm';

describe('Migration Generation Integration', () => {
  const emptyConfig: Config = {
    database: {
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      database: 'test',
    },
    patterns: [],
    migrationsDir: './migrations',
  };

  const emptySchema: FastSchema = {
    tables: [],
  };

  it('generates complete TypeORM migration from schema changes', () => {
    // Setup introspection result with schema changes
    const result: IntrospectionResult<BaseDbDiscriminator> = {
      diff: {
        missingTables: [],
        extraTables: [],
        modifiedTables: [
          {
            name: 'users',
            missingColumns: [],
            extraColumns: [],
            modifiedColumns: [
              {
                name: 'email',
                type: {
                  db: 'varchar',
                  schema: 'text',
                },
                nullable: {
                  db: false,
                  schema: true,
                },
              },
            ],
            missingIndexes: [],
            extraIndexes: [],
            modifiedIndexes: [],
          },
        ],
      },
      diffOutput: '',
      migrations: {
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
          sql.__dangerouslyConstructRawSql(
            'ALTER TABLE users DROP COLUMN email'
          ),
        ],
      },
      config: emptyConfig,
      schemas: [],
      dbSchema: emptySchema,
    };

    // Extract constraints
    const constraints = extractConstraints(result);

    // Create migration definition
    const timestamp = '20240315123456';
    const migrationDefinition = {
      name: `SchemaSync${timestamp}`,
      constraints,
      up: result.migrations.up,
      down: result.migrations.down,
      tables: result.diff.modifiedTables.map((table) => table.name),
    };

    // Format as TypeORM migration
    const formatter = createTypeORMMigrationFormatter();
    const migrationContent = formatter.format(migrationDefinition);

    // Verify the complete output
    expect(migrationContent).toContain(
      'import type { MigrationInterface, QueryRunner } from "typeorm"'
    );
    expect(migrationContent).toContain(`export class SchemaSync${timestamp}`);

    // Verify constraints
    expect(migrationContent).toContain('"must_exist": true');
    expect(migrationContent).toContain('"type": "varchar"');
    expect(migrationContent).toContain('"nullable": false');

    // Verify up migrations
    expect(migrationContent).toContain(
      'ALTER TABLE users ADD COLUMN email varchar NOT NULL'
    );
    expect(migrationContent).toContain(
      'CREATE INDEX idx_user_email ON users(email)'
    );

    // Verify down migrations in reverse order
    const downSection = migrationContent.slice(
      migrationContent.indexOf('async down')
    );
    const dropIndexPos = downSection.indexOf('DROP INDEX idx_user_email');
    const dropColumnPos = downSection.indexOf(
      'ALTER TABLE users DROP COLUMN email'
    );
    expect(dropIndexPos).toBeLessThan(dropColumnPos);

    // Verify TypeORM class structure
    expect(migrationContent).toMatch(/implements MigrationInterface/);
    expect(migrationContent).toMatch(
      /async up\(queryRunner: QueryRunner\): Promise<void>/
    );
    expect(migrationContent).toMatch(
      /async down\(queryRunner: QueryRunner\): Promise<void>/
    );
  });

  it('handles empty changes gracefully', () => {
    const result: IntrospectionResult<BaseDbDiscriminator> = {
      diff: {
        missingTables: [],
        extraTables: [],
        modifiedTables: [],
      },
      diffOutput: '',
      migrations: {
        up: [],
        down: [],
      },
      config: emptyConfig,
      schemas: [],
      dbSchema: emptySchema,
    };

    const constraints = extractConstraints(result);

    const migrationDefinition = {
      name: 'EmptySync20240315',
      constraints,
      up: result.migrations.up,
      down: result.migrations.down,
      tables: result.diff.modifiedTables.map((table) => table.name),
    };

    const formatter = createTypeORMMigrationFormatter();
    const migrationContent = formatter.format(migrationDefinition);

    // Should still produce valid TypeORM class
    expect(migrationContent).toContain(
      'export class EmptySync20240315\n  implements MigrationInterface'
    );
    expect(migrationContent).toContain(
      'async up(queryRunner: QueryRunner): Promise<void>'
    );
    expect(migrationContent).toContain(
      'async down(queryRunner: QueryRunner): Promise<void>'
    );
    expect(migrationContent).toContain('static constraints = {}');
  });
});
