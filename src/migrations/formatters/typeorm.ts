import type { SqlString } from '../../sql-string';
import { injectParameters } from '../../sql-string/helpers';
import type { MigrationDefinition, MigrationFormatter } from '../types';

/**
 * Creates a formatter that outputs migrations in TypeORM-compatible format
 */
export const createTypeORMMigrationFormatter = (): MigrationFormatter => {
  const formatSqlStatements = (statements: SqlString[]): string =>
    statements
      .map((sql) => injectParameters(sql))
      .map((sql) => `    await queryRunner.query(\`${sql}\`);`)
      .join('\n');

  const formatConstraints = (constraints: object): string =>
    JSON.stringify(constraints, null, 2)
      .split('\n')
      .map((line, i) => (i === 0 ? line : `  ${line}`))
      .join('\n');

  return {
    format(migration: MigrationDefinition): string {
      const upStatements = formatSqlStatements(migration.up);
      const downStatements = formatSqlStatements(migration.down);
      const constraintsString = formatConstraints(migration.constraints);

      return `import type { MigrationInterface, QueryRunner } from "typeorm";

export class ${migration.name}
  implements MigrationInterface {
  name = '${migration.name}'

  // Define schema constraints
  static constraints = ${constraintsString}

  async up(queryRunner: QueryRunner): Promise<void> {
${upStatements}
  }

  async down(queryRunner: QueryRunner): Promise<void> {
${downStatements}
  }
}
`;
    },
  };
};
