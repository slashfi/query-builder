# Index Management

## Table of Contents

- [Index Management](#index-management)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Index Definition](#index-definition)
    - [Basic Indexes](#basic-indexes)
    - [Unique Indexes](#unique-indexes)
    - [Composite Indexes](#composite-indexes)
    - [Partial Indexes](#partial-indexes)
    - [Expression Indexes](#expression-indexes)
  - [Type Generation](#type-generation)
    - [Running Code Generation](#running-code-generation)
    - [Generated Types](#generated-types)
    - [Type Integration](#type-integration)
  - [Index Configuration](#index-configuration)
    - [Strict Mode](#strict-mode)
    - [STORING Clause](#storing-clause)
    - [Column Requirements](#column-requirements)
  - [Query Optimization](#query-optimization)
    - [Index Selection](#index-selection)
    - [Performance Tips](#performance-tips)
    - [Common Pitfalls](#common-pitfalls)
  - [Best Practices](#best-practices)

## Overview

The Query Builder provides comprehensive index management capabilities with type safety and performance optimization. It ensures indexes are used correctly at compile time while maintaining runtime performance.

## Index Definition

### Basic Indexes

Define simple indexes on single columns:

```typescript
class UserTable {
  static readonly Table = db
    .buildTableFromSchema<UserSchema>()
    .columns({
      id: (_) => _.varchar(),
      email: (_) => _.varchar(),
      status: (_) => _.varchar()
    })
    .indexes(({ table, index }) => ({
      by_email: index(table.email),
      by_status: index(table.status)
    }))
    .build();
}
```

### Unique Indexes

Enforce uniqueness constraints:

```typescript
class UserTable {
  static readonly Table = db
    .buildTableFromSchema<UserSchema>()
    .indexes(({ table, index }) => ({
      by_email: index(table.email).unique()
    }))
    .build();
}
```

### Composite Indexes

Create indexes on multiple columns:

```typescript
class UserTable {
  static readonly Table = db
    .buildTableFromSchema<UserSchema>()
    .indexes(({ table, index }) => ({
      by_org_team: index(table.org, table.team)
        .storing(table.email, table.name),
      by_status_created: index(
        table.status,
        table.createdAt.desc()
      )
    }))
    .build();
}
```

### Partial Indexes

Define indexes with WHERE conditions:

```typescript
class UserTable {
  static readonly Table = db
    .buildTableFromSchema<UserSchema>()
    .indexes(({ table, index }) => ({
      active_users: index(table.email)
        .where(table.status.equals('active')),
      recent_logins: index(table.lastLoginDate)
        .where(table.isActive.equals(true))
    }))
    .build();
}
```

### Expression Indexes

Create indexes on expressions:

```typescript
class UserTable {
  static readonly Table = db
    .buildTableFromSchema<UserSchema>()
    .indexes(({ table, index }) => ({
      by_email_lower: index(
        fns.lower(table.email)
      ),
      by_json_field: index(
        table.metadata.accessStringPath((_) => _.createdAt)
      )
    }))
    .build();
}
```

## Type Generation

The Query Builder uses code generation to provide type safety for index queries. This ensures that indexes are used correctly and efficiently at compile time.

### Running Code Generation

Generate type definitions using the CLI:

```bash
# Basic usage with default config
qb codegen

# Using custom config file
qb codegen --config path/to/config.ts
```

Configure code generation in your qb.config.ts:

```typescript
export default {
  // Database connection config
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'postgres',
    password: 'password'
  },
  // Code generation options
  codegen: {
    // Output directory for generated files (default: '.')
    outDir: './generated',
    // File names for generated files
    fileNames: {
      types: 'types.ts'  // default: 'types.ts'
    }
  }
};
```

The generator creates a types.d.ts file containing index metadata:

```typescript
declare module '@slashfi/query-builder' {
  interface TableBase {
    __indexMetadata: {
      [K in keyof typeof __queryBuilderIndexes]: {
        [I in keyof typeof __queryBuilderIndexes[K]]: {
          columns: typeof __queryBuilderIndexes[K][I]['columns'];
          storing: typeof __queryBuilderIndexes[K][I]['storing'];
          partial: typeof __queryBuilderIndexes[K][I]['partial'];
        }
      }
    }[keyof typeof __queryBuilderIndexes];
  }
}

declare global {
  var __queryBuilderIndexes: {
    'users': {
      'by_email': {
        columns: {
          email: {
            column: true;
            storing: false;
            partial: false;
            requiredColumns: [];
          };
        };
        columnsOrder: ['email'];
        minimumSufficientColumns: ['email'];
        unique: true;
      };
      'by_status_created': {
        columns: {
          status: {
            column: true;
            storing: false;
            partial: false;
            requiredColumns: [];
          };
          createdAt: {
            column: true;
            storing: false;
            partial: false;
            requiredColumns: ['status'];
          };
        };
        columnsOrder: ['status', 'createdAt'];
        minimumSufficientColumns: ['status'];
        unique: false;
      };
    };
  };
}
```

### Generated Types

The generated types include:

1. **Column Information**
   - Whether it's an index column
   - Whether it's included in STORING
   - Whether it's part of a partial index
   - Required preceding columns

2. **Index Metadata**
   - Column order
   - Minimum sufficient columns
   - Uniqueness constraints
   - STORING clauses
   - Partial index conditions

3. **Type Integration**
   - Automatic integration with query builder
   - IDE support for index usage
   - Compile-time validation

### Type Integration

The generated types automatically integrate with the query builder:

```typescript
// DB setup with type integration
const db = createDb({
  query: async (queryName, sqlString) => {
    return pool.query(sqlString.getQuery(), sqlString.getParameters());
  },
  discriminator: createDbDiscriminator('app'),
  // Point to generated types
  getQueryBuilderIndexes: () => import('./generated/types')
});

// Type-safe index usage
const users = await db
  .selectFromIndex(UserTable.idx.by_status_created)
  .where({
    status: 'active',    // Required by generated type
    createdAt: '2024'    // Optional from type metadata
  });

// Error: missing required column
const invalid = await db
  .selectFromIndex(UserTable.idx.by_status_created)
  .where({
    createdAt: '2024'    // Error: status is required first
  });

// Error: unknown index
const error = await db
  .selectFromIndex(UserTable.idx.nonexistent) // Error: index doesn't exist
  .where({});
```

## Index Configuration

### Strict Mode

Control how indexes can be used:

```typescript
class UserTable {
  static readonly idx = db.indexConfig(this.Table, {
    // Only allow using index columns
    by_email_strict: {
      strict: { columnsOnly: true }
    },
    // Allow additional conditions
    by_status_flexible: {
      strict: { columnsOnly: false }
    }
  });
}

// With strict mode
const user = await db
  .selectFromIndex(UserTable.idx.by_email_strict)
  .where({ email: 'test@example.com' })
  .select // doesn't exist since strict mode is on

// With flexible mode
const users = await db
  .selectFromIndex(UserTable.idx.by_status_flexible)
  .where({ status: 'active' })
  // can add an additional andWhere clause which will incur index joins
  .andWhere((_) => _.user.lastLogin.moreThan(new Date()))
  .select({
    email: (_) => _.user.email,
    lastLogin: (_) => _.user.lastLogin
  });
```

### STORING Clause

Include additional columns in the index:

```typescript
class UserTable {
  static readonly Table = db
    .buildTableFromSchema<UserSchema>()
    .indexes(({ table, index }) => ({
      by_status: index(table.status)
        .storing(table.email, table.name)
    }))
    .build();
}

// Query using stored columns
const users = await db
  .selectFromIndex(UserTable.idx.by_status)
  .where({ status: 'active' })

// users will have email and name columns included since it's in the STORING clause
```

### Column Requirements

Configure which columns are required:

```typescript
class UserTable {
  static readonly idx = db.indexConfig(this.Table, {
    by_org_team: {
      minimumSufficientColumns: ['org'], // Only org is required
      columns: {
        org: {
          operations: ['eq']
        },
        team: {
          operations: ['eq', 'like'],
          optional: true
        }
      }
    }
  });
}

// Using required and optional columns
const users = await db
  .selectFromIndex(UserTable.idx.by_org_team)
  .where({
    org: 'org_1',           // Required
    team: { like: 'team_%'} // Optional
  });
```

## Query Optimization

### Index Selection

The Query Builder helps select the best index:

```typescript
// Automatically uses by_email for uniqueness
const user = await db
  .selectFromIndex(UserTable.idx.by_email)
  .where({ email: 'test@example.com' })
  .expectOne();

// Uses composite index for range scan
const users = await db
  .selectFromIndex(UserTable.idx.by_status_created)
  .where({
    status: 'active',
    createdAt: { gt: new Date('2024-01-01') }
  });
```

### Performance Tips

1. **Use Covering Indexes**
   ```typescript
   // All columns in index or STORING clause
   const users = await db
     .selectFromIndex(UserTable.idx.by_status)
     .where({ status: 'active' })
     .select({
       status: (_) => _.user.status,  // Index column
       email: (_) => _.user.email,    // STORING column
       name: (_) => _.user.name       // STORING column
     });
   ```

2. **Leverage Partial Indexes**
   ```typescript
   // Smaller, more focused index
   const activeUsers = await db
     .selectFromIndex(UserTable.idx.active_users)
     .where({ email: 'test@example.com' });
   ```

3. **Use Expression Indexes**
   ```typescript
   // Case-insensitive search
   const user = await db
     .selectFromIndex(UserTable.idx.by_email_lower)
     .where({
       email: 'TEST@EXAMPLE.COM'.toLowerCase()
     });
   ```

### Common Pitfalls

1. **Wrong Column Order**
   ```typescript
   // Less efficient: status is second in index
   const users = await db
     .selectFromIndex(UserTable.idx.by_org_status)
     .where({ status: 'active' }); // Missing org column
   ```

2. **Missing Required Columns**
   ```typescript
   // Error: org is required
   const users = await db
     .selectFromIndex(UserTable.idx.by_org_team)
     .where({ team: 'team_1' });
   ```

3. **Incompatible Operations**
   ```typescript
   // Error: like not allowed on org
   const users = await db
     .selectFromIndex(UserTable.idx.by_org_team)
     .where({
       org: { like: 'org_%' }
     });
   ```

## Best Practices

1. **Index Design**
   - Put equality columns before range columns
   - Use partial indexes for filtered queries
   - Include commonly accessed columns in STORING
   - Consider maintenance overhead

2. **Query Patterns**
   - Use strict mode when possible
   - Leverage covering indexes
   - Monitor query performance
   - Review execution plans

3. **Type Generation**
   - Run code generation after schema changes
   - Keep generated types in source control
   - Review type changes during code review
   - Use watch mode during development

4. **Maintenance**
   - Remove unused indexes
   - Update indexes with schema changes
   - Monitor index size and usage
   - Consider rebuild/reindex timing