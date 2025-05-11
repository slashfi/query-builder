# Query Building

## Table of Contents

1. [Overview](#overview)
2. [Basic Queries](#basic-queries)
   - [Select Queries](#select-queries)
   - [Where Clauses](#where-clauses)
   - [Joins](#joins)
3. [Advanced Features](#advanced-features)
   - [Aggregations](#aggregations)
   - [Conditional Logic](#conditional-logic)
   - [Array Fields](#array-fields)
4. [Type Safety](#type-safety)
   - [Result Types](#result-types)
   - [Null Handling](#null-handling)
   - [Join Types](#join-types)

## Overview

The Query Builder provides a type-safe way to build SQL queries using `db.from()`. It ensures queries are both type-safe at compile time and efficient at runtime.

## Basic Queries

### Select Queries

```typescript
// Basic select with all columns
const users = await db.from(UserTable);

// Custom column selection
const result = await db
  .from(UserTable)
  .select((_) => [
    _.user.id,
    _.user.email,
    _.user.status
  ]);

// With where clause
const activeUsers = await db
  .from(UserTable)
  .where((_) => _.user.status.equals('active'));

// With limit
const firstTen = await db
  .from(UserTable)
  .limit(10);
```

### Where Clauses

```typescript
// Simple equality
const user = await db
  .from(UserTable)
  .where((_) => _.user.email.equals('test@example.com'));

// Multiple conditions
const filtered = await db
  .from(UserTable)
  .where((_) => 
    _.user.status.equals('active')
      .and(_.user.loginCount.moreThan(5))
  );

// Null checks
const withoutEmail = await db
  .from(UserTable)
  .where((_) => _.user.email.isNull());

// Pattern matching
const search = await db
  .from(UserTable)
  .where((_) => _.user.email.like('%@example.com'));
```

### Joins

```typescript
// Left join with type-safe null handling
const usersWithProfiles = await db
  .from(UserTable)
  .leftJoin(ProfileTable, {
    alias: 'profile',
    on: (_) => _.profile.userId.equals(_.user.id)
  });
// Type: { user: UserSchema, profile?: ProfileSchema }[]

// Multiple joins
const fullData = await db
  .from(UserTable)
  .leftJoin(ProfileTable, {
    alias: 'profile',
    on: (_) => _.profile.userId.equals(_.user.id)
  })
  .leftJoin(SettingsTable, {
    alias: 'settings',
    on: (_) => _.settings.userId.equals(_.user.id)
  });
```

## Advanced Features

### Aggregations

```typescript
// Count with grouping
const userCounts = await db
  .from(UserTable)
  .select((_) => [
    _.user.status,
    fns.count(_.user.id).as('userCount')
  ])
  .groupBy((_) => [_.user.status]);

// Complex aggregations
const stats = await db
  .from(UserTable)
  .select((_) => [
    fns.count(
      fns.ifClause(_.user.status.equals('active'), {
        ifTrue: constantInt(1),
        ifFalse: constantInt(0)
      })
    ).as('activeCount')
  ])
  .groupBy((_) => [_.user.id]);
```

### Conditional Logic

```typescript
// If clause in select
const result = await db
  .from(UserTable)
  .select((_) => [
    fns.ifClause(_.user.status.equals('active'), {
      ifTrue: _.user.email,
      ifFalse: fns.nullValue()
    }).as('conditionalEmail')
  ]);

// Complex conditions
const data = await db
  .from(UserTable)
  .select((_) => [
    fns.ifClause(_.user.loginCount.moreThan(10), {
      ifTrue: fns.ifClause(_.user.status.equals('active'), {
        ifTrue: _.user.email,
        ifFalse: fns.nullValue()
      }),
      ifFalse: _.user.id
    }).as('complexField')
  ]);
```

### Array Fields

```typescript
// Query array fields
const withArray = await db
  .from(UserTable)
  .where((_) => _.user.tags.isNotNull());

// Insert with array
await db.insert(UserTable)
  .values({
    id: 'user_1',
    tags: ['tag1', 'tag2'],
    // ... other fields
  });
```

## Type Safety

### Result Types

The Query Builder provides automatic type inference:

```typescript
// Basic query - all fields
const users = await db.from(UserTable);
// Type: UserSchema[]

// Custom select
const result = await db
  .from(UserTable)
  .select((_) => [
    _.user.id,
    _.user.email
  ]);
// Type: { id: string, email: string }[]

// With joins
const joined = await db
  .from(UserTable)
  .leftJoin(ProfileTable, {
    alias: 'profile',
    on: (_) => _.profile.userId.equals(_.user.id)
  });
// Type: { user: UserSchema, profile?: ProfileSchema }[]
```

### Null Handling

```typescript
// Nullable fields are properly typed
const result = await db
  .from(UserTable)
  .select((_) => [
    _.user.id,                // string
    _.user.email,             // string
    _.user.deletedAt         // Date | undefined
  ]);

// Left joins are properly nullable
const joined = await db
  .from(UserTable)
  .leftJoin(ProfileTable, {
    alias: 'profile',
    on: (_) => _.profile.userId.equals(_.user.id)
  })
  .select((_) => [
    _.user.id,               // string
    _.profile.bio           // string | undefined
  ]);
```

### Join Types

```typescript
// Left join makes joined table nullable
const result = await db
  .from(UserTable)
  .leftJoin(ProfileTable, {
    alias: 'profile',
    on: (_) => _.profile.userId.equals(_.user.id)
  });
// profile is optional: profile?: ProfileSchema

// Inner join requires joined table
const result = await db
  .from(UserTable)
  .join(ProfileTable, {
    alias: 'profile',
    on: (_) => _.profile.userId.equals(_.user.id)
  });
// profile is required: profile: ProfileSchema