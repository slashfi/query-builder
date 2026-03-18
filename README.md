# @slashfi/query-builder

A type-safe SQL query builder for TypeScript with first-class support for index hints, schema introspection, and migration generation. Built for CockroachDB, designed to make query performance deterministic.

## Why?

Most ORMs and query builders treat table names and columns as first-class citizens, but indexes are an afterthought. This means your queries work fine at small scale, then blow up when the SQL planner picks a bad execution plan at 10x data.

This query builder flips that: indexes are first-class. You define your indexes in TypeScript, and the query builder enforces their usage at compile time. No more full table scans hiding in your codebase.

For the full backstory, see [docs/history.md](docs/history.md).

## Features

- **Type-safe queries** — Full TypeScript type safety for selects, inserts, updates, joins, and conditions
- **Index-safe queries** — `selectFromIndex` enforces correct index usage at compile time
- **Schema-driven** — Define your tables, columns, and indexes in TypeScript with full type inference
- **JSON field support** — Type-safe access to nested JSON fields with `accessStringPath`
- **Transaction support** — First-class transactions with automatic nesting (reuses parent transaction)
- **Schema introspection** — Introspect your live database and diff against your TypeScript definitions
- **Migration generation** — Auto-generate TypeORM-compatible migrations from schema diffs
- **CLI tooling** — `qb generate` and `qb codegen` for schema management workflows

## Installation

```bash
npm install @slashfi/query-builder
```

## Quick Start

### 1. Create a database instance

```typescript
import { createDb, createDbDiscriminator } from '@slashfi/query-builder';

const db = createDb({
  query: async (queryName, sqlString, manager?) => {
    const client = manager ?? pool;
    return client.query(sqlString.getQuery(), sqlString.getParameters());
  },
  runQueriesInTransaction: async (runQueries) => {
    await pool.query('BEGIN');
    try {
      await runQueries(pool);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  },
  discriminator: createDbDiscriminator('app'),
  getQueryBuilderIndexes: () => import('./generated/types'),
});
```

### 2. Define a table

```typescript
interface UserSchema {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

const UserTable = {
  Table: db
    .buildTableFromSchema<UserSchema>()
    .tableName('users')
    .defaultAlias('user')
    .columns({
      id: (_) => _.varchar(),
      email: (_) => _.varchar(),
      name: (_) => _.varchar(),
      createdAt: (_) => _.timestamp(),
    })
    .primaryKey('id')
    .indexes(({ table, index }) => ({
      by_email: index(table.email).unique(),
      by_created: index(table.createdAt),
    }))
    .build(),
} as const;

// Configure index usage for type-safe index queries
const userIdx = db.indexConfig(UserTable.Table, {
  by_email: {
    strict: { columnsOnly: false },
  },
  by_created: {
    minimumSufficientColumns: ['createdAt'],
  },
});
```

### 3. Query with index safety

```typescript
// Select using an index — the query builder enforces that you're using
// a real index and provides type-safe where clauses for its columns
const user = await db
  .selectFromIndex(userIdx.by_email)
  .where({ email: 'user@example.com' })
  .expectOne();

// Insert with returning
const newUser = await db
  .insert(UserTable)
  .values({
    id: 'user_1',
    email: 'new@example.com',
    name: 'Alice',
    createdAt: new Date(),
  })
  .returning('*')
  .query();
```

### 4. Flexible queries with `db.from()`

For queries that don't need index enforcement:

```typescript
// Select with conditions
const activeUsers = await db
  .from(UserTable)
  .where((_) => _.user.email.equals('user@example.com'))
  .select((_) => [_.user.id, _.user.email, _.user.name]);

// Joins
const usersWithPosts = await db
  .from(UserTable)
  .leftJoin(PostTable, {
    on: (_) => _.post.userId.equals(_.user.id),
  })
  .select((_) => [_.user.name, _.post.title]);

// Aggregations
const counts = await db
  .from(UserTable)
  .select((_) => [
    _.user.status,
    fns.count(_.user.id).as('count'),
  ])
  .groupBy((_) => [_.user.status]);
```

## Column Types

```typescript
.columns({
  id: (_) => _.varchar(),
  email: (_) => _.varchar(),
  count: (_) => _.int(),
  amount: (_) => _.float(),
  isActive: (_) => _.boolean(),
  createdAt: (_) => _.timestamp(),
  date: (_) => _.date(),
  metadata: (_) => _.json(),
  tags: (_) => _.array(),
})
```

## Index Types

```typescript
.indexes(({ table, index }) => ({
  // Simple index
  by_email: index(table.email),

  // Unique index
  by_email_unique: index(table.email).unique(),

  // Composite index
  by_org_team: index(table.orgId, table.teamId)
    .storing(table.email, table.name),

  // Partial index
  by_active_users: index(table.email)
    .where(table.status.equals('active')),

  // Index on JSON field
  by_created: index(
    table.metadata.accessStringPath((_) => _.createdAt)
  ),
}))
```

## JSON Fields

Type-safe access to nested JSON:

```typescript
interface UserMetadata {
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
  profile: {
    bio: string;
  };
}

// Query on nested JSON
const darkMode = await db
  .from(UserTable)
  .where((_) =>
    _.user.metadata
      .accessStringPath((_) => _.preferences.theme)
      .equals('dark')
  );

// Select nested fields
const themes = await db
  .from(UserTable)
  .select((_) => [
    _.user.id,
    _.user.metadata.accessStringPath((_) => _.preferences.theme).as('theme'),
  ]);
```

## Transactions

```typescript
// Basic transaction
await db.transaction(async () => {
  const user = await db
    .insert(UserTable)
    .values({ id: 'user_1', email: 'alice@example.com', name: 'Alice', createdAt: new Date() })
    .returning('*')
    .query();

  await db
    .insert(PostTable)
    .values({ id: 'post_1', userId: user.result[0].id, title: 'Hello', content: 'World', createdAt: new Date() })
    .query();
});

// Nested transactions reuse the parent
await db.transaction(async () => {
  // parent
  await db.transaction(async () => {
    // reuses parent transaction
  });
});
```

## CLI

The query builder ships with a CLI for schema management:

```bash
# Generate migrations by diffing your TypeScript schemas against the live database
qb generate --name add-user-email

# Generate migrations for specific tables only
qb generate --name add-user-email --filter users,posts

# Generate index type metadata for type-safe index queries
qb codegen
```

Both commands accept `--config` (`-c`) to specify a config file path (defaults to `qb.config.ts`).

### Configuration

Create a `qb.config.ts` in your project root:

```typescript
import type { Config } from '@slashfi/query-builder/introspection/config';

export default {
  database: {
    host: 'localhost',
    port: 26257,
    schema: 'public',
    user: 'root',
    password: '',
    ssl: false,
    database: 'mydb',
  },
  // Glob patterns to find your schema files
  patterns: ['./**/*.schema.ts'],
  // Where to output generated migrations
  migrationsDir: 'migrations',
  codegen: {
    outDir: 'generated',
    fileNames: {
      types: 'types.ts',
    },
  },
  // Optional features
  features: {
    // Use Anthropic to auto-name migrations based on the diff
    anthropicMigrationNaming: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: 'claude-3-5-haiku-latest', // default
    },
  },
} satisfies Config;
```

## Testing

Unit tests (no database required):

```bash
npm test
```

Full test suite including integration tests (requires Docker):

```bash
npm run test:all
```

This will start a CockroachDB instance via Docker Compose, run all tests, and tear it down. You can also manage the database manually:

```bash
npm run db:up      # Start CockroachDB
npm run db:wait    # Wait until healthy
npm test           # Run tests
npm run db:down    # Stop and clean up
```

The CockroachDB instance runs on `localhost:26207` (SQL) and `localhost:8181` (Admin UI).

## Further Reading

- [Query Building](docs/query-building.md) — Detailed guide on selects, where clauses, joins, and aggregations
- [Index Management](docs/index-management.md) — Index types, configuration, and query optimization
- [Schema Management](docs/schema-management.md) — Schema definition, introspection, and migrations
- [Advanced Features](docs/advanced-features.md) — JSON fields, custom functions, and expression building
- [History](docs/history.md) — Why we built this and the journey from TypeORM to here
- [Contributing](docs/contributing.md) — Development setup and guidelines

## License

ISC
