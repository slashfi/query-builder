# Query Builder Overview

## Table of Contents

- [Query Builder Overview](#query-builder-overview)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Key Features](#key-features)
  - [Getting Started](#getting-started)
    - [Installation](#installation)
    - [Basic Setup](#basic-setup)
    - [Basic Queries](#basic-queries)
  - [Core Concepts](#core-concepts)
    - [1. Schema-Based Queries](#1-schema-based-queries)
    - [2. Index-Safe Queries](#2-index-safe-queries)
    - [3. JSON Field Support](#3-json-field-support)
    - [4. Transaction Support](#4-transaction-support)
  - [CLI Tools](#cli-tools)
  - [Best Practices](#best-practices)
  - [Further Reading](#further-reading)

## Introduction

The query builder provides a fully type-safe way to build SQL queries in TypeScript, with a focus on index-safe queries, schema validation, and developer experience. It combines the safety of schema definitions with the flexibility of raw SQL when needed.

## Key Features

- **Type-Safe Queries**: Full TypeScript type safety for queries, preventing runtime errors
- **Index-Safe Queries**: Enforced correct index usage with support for complex indexes
- **Schema Management**: Introspection, validation, and migration generation
- **JSON Support**: First-class support for JSON fields and nested queries
- **Transaction Support**: First-class support for transactions with proper nesting
- **Developer Experience**: Clear error messages, IDE support, and minimal boilerplate

## Getting Started

### Installation

(not relevant in the monorepo)

```bash
npm install @slashfi/query-builder
# or
yarn add @slashfi/query-builder
```

### Basic Setup

1. Define your schema:
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

class User {
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
    .indexes(({ table, index }) => ({
      by_email: index(table.email).unique(),
      by_status: index(table.status, index.email),
      by_created: index(
        table.metadata.accessStringPath((_) => _.createdAt)
      )
    }))
    .build();

  // Configure index usage
  static readonly idx = db.indexConfig(User.Table, {
    by_email: {
      strict: { columnsOnly: false }
    },
    by_status: {
      minimumSufficientColumns: ['status']
    }
  });
}
```

2. Create database connection:
```typescript
const db = createDb({
  // Query function that can use an optional transaction manager
  query: async (queryName, sqlString, manager?) => {
    const client = manager ?? pool; // Use transaction manager or default connection
    return client.query(sqlString.getQuery(), sqlString.getParameters());
  },
  // Function to run queries in a transaction
  runQueriesInTransaction: async (runQueries) => {
    await pool.query('BEGIN');
    try {
      await runQueries(pool);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error("Transaction failed and rolled back", e);
    }
  },
  discriminator: createDbDiscriminator('app'),
  getQueryBuilderIndexes: () => import('./generated/types')
});
```

### Basic Queries

```typescript
// Select using index
const user = await db
  .selectFromIndex(User.idx.by_email)
  .where({ email: 'user@example.com' })
  .expectOne();

// Insert with returning
const newUser = await db
  .insert(User)
  .values({
    id: 'user_1',
    email: 'new@example.com',
    status: 'active',
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  })
  .returning('*')
  .expectOne();

// Complex conditions
const activeUsers = await db
  .selectFromIndex(User.idx.by_status)
  .where({ status: 'active' })
  .andWhere((_) =>
    _.user.metadata
      .accessStringPath((_) => _.createdAt)
      .moreThan('2024-01-01')
  );

// Using transactions
await db.transaction(async () => {
  // All queries here will use the same transaction
  await db.insert(User).values({...}).query();
  
  // Nested transactions reuse the parent transaction
  await db.transaction(async () => {
    await db.insert(User).values({...}).query();
  });
});
```

## Core Concepts

### 1. Schema-Based Queries

The library uses TypeScript interfaces to define your database schema, providing compile-time type checking:

```typescript
interface OrderSchema {
  id: string;
  userId: string;
  status: string;
  items: { id: string; quantity: number }[];
}

class OrderTable {
  static readonly Table = buildTableFromSchema<OrderSchema>()
    .columns({
      id: (_) => _.varchar(),
      userId: (_) => _.varchar(),
      status: (_) => _.varchar(),
      items: (_) => _.json()
    })
    .build();
}
```

### 2. Index-Safe Queries

Indexes are first-class citizens with built-in safety:

```typescript
class UserTable {
  static readonly Table = /* ... */;

  static readonly idx = db.indexConfig(this.Table, {
    by_email: {
      // Allow additional conditions
      strict: { columnsOnly: false }
    },
    by_status: {
      // Allow additional conditions
      strict: { columnsOnly: false }
    }
  });
}

// Type-safe index usage
const user = await db
  .selectFromIndex(UserTable.idx.by_email)
  .where({ email: 'user@example.com' })
  .select({
    id: (_) => _.user.id,
    email: (_) => _.user.email
  });
```

### 3. JSON Field Support

First-class support for JSON fields with type safety:

```typescript
const users = await db
  .selectFromIndex(UserTable.idx.by_status)
  .where({ status: 'active' })
  .select({
    id: (_) => _.user.id,
    created: (_) =>
      _.user.metadata.accessStringPath((_) => _.createdAt),
    updated: (_) =>
      _.user.metadata.accessStringPath((_) => _.updatedAt)
  });
```

### 4. Transaction Support

The query builder provides first-class support for transactions:

To use transactions, you need to provide a `runQueriesInTransaction` function to the `createDb` function. This function will be used to run queries in a transaction.

```typescript
const db = createDb({
  // Manager parameter here is passed in by the transaction manager in runQueriesInTransaction method
  query: async (queryName, sqlString, manager?) => {
    const client = manager ?? pool; // Use transaction manager or default connection
    return client.query(sqlString.getQuery(), sqlString.getParameters());
  },
  runQueriesInTransaction: async (runQueries) => {
    await pool.query('BEGIN');
    try {
      // pool here is the manager that's used in the query function above
      await runQueries(pool);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error("Transaction failed and rolled back", e);
    }
  }
});

// Transaction with automatic commit/rollback
await db.transaction(async () => {
  // All queries use the same transaction
  await db.insert(User).values({...}).query();
  await db.update(User).set({...}).query();
});

// Nested transactions (reuses parent transaction)
await db.transaction(async () => {
  await db.insert(User).values({...}).query();
  
  await db.transaction(async () => {
    // Uses parent transaction
    await db.update(User).set({...}).query();
  });
});

// Queries can also run outside transactions
await db.insert(User).values({...}).query();
```

The transaction implementation uses AsyncLocalStorage to track the current transaction manager, ensuring:
- All queries in a transaction block use the same transaction
- Nested transactions reuse the parent transaction
- Proper error handling and rollback on failure

## CLI Tools

The Query Builder provides CLI tools for common tasks:

```bash
# Generate TypeScript types from database
qb codegen

# Validate schema against database (TODO)
qb validate

# Generate migrations
qb generate
```

## Best Practices

1. **Schema Definition**
   - Define comprehensive interfaces for tables
   - Use proper TypeScript types
   - Mark optional fields appropriately

2. **Index Usage**
   - Configure index restrictions upfront
   - Use strict mode when possible
   - Consider STORING clauses for frequently accessed columns

3. **Query Building**
   - Prefer index-based queries for performance
   - Use type-safe column access
   - Handle potential null values

4. **Transaction Usage**
   - Use transactions for related operations
   - Let errors propagate for proper rollback
   - Leverage nested transactions for code organization

5. **Error Handling**
   - Use expectOne() for unique results
   - Implement proper error handling
   - Validate input data before querying

## Further Reading

- [Query Building](./query-building.md) - Detailed query building guide
- [Index Management](./index-management.md) - Index configuration and optimization
- [Schema Management](./schema-management.md) - Schema handling and migrations
- [Advanced Features](./advanced-features.md) - Advanced usage patterns
- [Contributing](./contributing.md) - Development and contribution guide
- [Roadmap](./roadmap.md) - Future plans and improvements