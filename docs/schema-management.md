# Schema Management

## Table of Contents

1. [Overview](#overview)
2. [Schema Definition](#schema-definition)
   - [Table Structure](#table-structure)
   - [Column Types](#column-types)
   - [Relationships](#relationships)
3. [Introspection](#introspection)
   - [Configuration](#configuration)
   - [Ignore Patterns](#ignore-patterns)
   - [Index Sync Modes](#index-sync-modes)
4. [Migration Management](#migration-management)
   - [Generation](#generation)
   - [Validation](#validation)
   - [Execution](#execution)
5. [Best Practices](#best-practices)

## Overview

The Query Builder provides schema management capabilities including schema definition, introspection, and migration generation. It helps maintain consistency between your TypeScript code and database schema.

## Schema Definition

### Table Structure

Define your database schema using TypeScript interfaces:

```typescript
interface UserSchema {
  id: string;
  email: string;
  status: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

class UserTable {
  static readonly Table = db
    .buildTableFromSchema<UserSchema>()
    .columns({
      id: (_) => _.varchar(),
      email: (_) => _.varchar(),
      status: (_) => _.varchar(),
      metadata: (_) => _.json()
    })
    .primaryKey('id')
    .tableName('users')
    .defaultAlias('user')
    .build();
}
```

### Column Types

Available column types with their TypeScript mappings:

```typescript
class ExampleTable {
  static readonly Table = db
    .buildTableFromSchema<Schema>()
    .columns({
      // String types
      varcharField: (_) => _.varchar(),
      textField: (_) => _.text(),
      
      // Numeric types
      intField: (_) => _.int(),
      floatField: (_) => _.float(),
      
      // Date/Time types
      timestampField: (_) => _.timestamp(),
      dateField: (_) => _.date(),
      
      // JSON types
      jsonField: (_) => _.json(),
      jsonbField: (_) => _.jsonb(),
      
      // Nullable fields
      nullableField: (_) => _.varchar({ isNullable: true }),
      
      // With default values
      defaultField: (_) => _.int({ default: 0 })
    })
    .build();
}
```

## Introspection

### Configuration

Configure introspection at the table level:

```typescript
class UserTable {
  static readonly Table = db
    .buildTableFromSchema<UserSchema>()
    .columns({
      id: (_) => _.varchar(),
      email: (_) => _.varchar(),
      internalField: (_) => _.varchar()
    })
    .introspect({
      // Enable/disable feature checks
      columns: 'enforce',    // 'enforce' | 'warn' | 'ignore'
      indexes: 'enforce',    // 'enforce' | 'warn' | 'ignore'
      constraints: 'warn',   // 'enforce' | 'warn' | 'ignore'
      
      // Ignore patterns
      ignoreColumns: [/^internal/],  // Skip internal columns
      ignoreIndexes: [/_temp$/],     // Skip temporary indexes
      
      // Index sync behavior
      indexSyncMode: 'additive'      // 'additive' | 'full'
    })
    .build();
}
```

### Ignore Patterns

Use regular expressions to ignore specific columns or indexes:

```typescript
.introspect({
  // Ignore patterns for columns
  ignoreColumns: [
    /^_/,           // Skip columns starting with underscore
    /^internal_/,   // Skip internal columns
    /temp$/         // Skip temporary columns
  ],
  
  // Ignore patterns for indexes
  ignoreIndexes: [
    /_temp$/,       // Skip temporary indexes
    /^idx_temp_/,   // Skip temporary indexes
    /^_/           // Skip internal indexes
  ]
})
```

### Index Sync Modes

Control how index changes are handled:

```typescript
// Additive mode - only add new indexes
.introspect({
  indexes: 'enforce',
  indexSyncMode: 'additive'  // Never remove existing indexes
})

// Full sync mode - add new and remove old indexes
.introspect({
  indexes: 'enforce',
  indexSyncMode: 'full'     // Sync exactly with schema
})
```

## Migration Management

### Generation

Generate migrations using the CLI:

```bash
# Generate migration with default config
qb generate

# Generate with custom config file
qb generate --config path/to/config.ts

# Generate with specific name
qb generate --name AddUserEmail
```

Configure migration generation in qb.config.ts:

```typescript
export default {
  // Database connection
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'postgres',
    password: 'password'
  },
  
  // Migration options
  migrationsDir: './migrations',
  features: {
    anthropicMigrationNaming: true  // Use AI to generate names
  }
};
```

### Validation

The system validates several aspects:

1. **Schema Consistency**
   - Column types match
   - Required columns exist
   - Indexes are properly defined

2. **Migration Safety**
   - No data loss operations
   - Backward compatible changes
   - Proper up/down migrations

3. **Constraint Validation**
   - Primary keys exist
   - Foreign keys are valid
   - Unique constraints maintained

### Execution

Migrations are TypeORM compatible:

```typescript
export class AddUserEmail20240315 implements MigrationInterface {
  name = 'AddUserEmail20240315'

  // Schema constraints embedded in migration
  static constraints = {
    users: {
      must_exist: true,
      columns: {
        id: { type: "varchar", nullable: false }
      }
    }
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN email varchar NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN email
    `);
  }
}
```

## Best Practices

1. **Schema Definition**
   - Use clear, descriptive column names
   - Include proper nullability constraints
   - Document complex relationships
   - Consider index requirements

2. **Introspection**
   - Enable strict mode in development
   - Use warning mode in production
   - Document ignored patterns
   - Review introspection results

3. **Migration Management**
   - Review generated migrations
   - Test migrations in development
   - Include rollback plans
   - Monitor migration execution

4. **General Tips**
   - Keep schemas in sync
   - Use version control
   - Document changes
   - Test thoroughly