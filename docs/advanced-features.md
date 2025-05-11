# Advanced Features

## Table of Contents

1. [JSON Fields](#json-fields)
   - [Type-Safe Access](#type-safe-access)
   - [Nested Fields](#nested-fields)
   - [Type Casting](#type-casting)
2. [Custom Functions](#custom-functions)
   - [Conditional Logic](#conditional-logic)
   - [Aggregations](#aggregations)
   - [Type Casting](#type-casting-1)
3. [Expression Building](#expression-building)
   - [Complex Conditions](#complex-conditions)
   - [Function Composition](#function-composition)
   - [Type Safety](#type-safety)

## JSON Fields

### Type-Safe Access

Define JSON fields with TypeScript types:

```typescript
interface UserMetadata {
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
  profile: {
    bio: string;
    links: string[];
  };
}

interface UserSchema {
  id: string;
  email: string;
  metadata: UserMetadata;
}

class UserTable {
  static readonly Table = db
    .buildTableFromSchema<UserSchema>()
    .columns({
      id: (_) => _.varchar(),
      email: (_) => _.varchar(),
      metadata: (_) => _.json()
    })
    .build();
}
```

Access JSON fields with type safety:

```typescript
// Access nested fields
const users = await db
  .from(UserTable)
  .select((_) => [
    _.user.id,
    _.user.metadata.accessStringPath((_) => _.preferences.theme).as('theme'),
    _.user.metadata.accessStringPath((_) => _.profile.bio).as('bio')
  ]);

// Query on JSON fields
const darkMode = await db
  .from(UserTable)
  .where((_) =>
    _.user.metadata
      .accessStringPath((_) => _.preferences.theme)
      .equals('dark')
  );
```

### Nested Fields

Handle complex nested structures:

```typescript
// Check for null at any level
const result = await db
  .from(UserTable)
  .where((_) =>
    _.user.metadata
      .accessStringPath((_) => _.profile)
      .isNull()
  );

// Access array elements
const withLinks = await db
  .from(UserTable)
  .where((_) =>
    _.user.metadata
      .accessStringPath((_) => _.profile.links)
      .isNotNull()
  );
```

### Type Casting

Cast JSON fields to other types:

```typescript
// Cast to number for comparison
const result = await db
  .from(UserTable)
  .where((_) =>
    cast(
      _.user.metadata.accessStringPath((_) => _.preferences.version),
      'int'
    ).moreThan(2)
  );

// Cast for aggregation
const stats = await db
  .from(UserTable)
  .select((_) => [
    fns.sum(
      cast(
        _.user.metadata.accessStringPath((_) => _.stats.count),
        'int'
      )
    ).as('totalCount')
  ]);
```

## Custom Functions

### Conditional Logic

Use if clauses for complex logic:

```typescript
// Simple if clause
const result = await db
  .from(UserTable)
  .select((_) => [
    fns.ifClause(_.user.status.equals('active'), {
      ifTrue: _.user.email,
      ifFalse: fns.nullValue()
    }).as('activeEmail')
  ]);

// Nested conditions
const complex = await db
  .from(UserTable)
  .select((_) => [
    fns.ifClause(_.user.status.equals('active'), {
      ifTrue: fns.ifClause(
        _.user.metadata.accessStringPath((_) => _.preferences.notifications),
        {
          ifTrue: _.user.email,
          ifFalse: fns.nullValue()
        }
      ),
      ifFalse: fns.nullValue()
    }).as('notificationEmail')
  ]);
```

### Aggregations

Complex aggregations with conditions:

```typescript
// Conditional count
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

// Multiple aggregations
const metrics = await db
  .from(UserTable)
  .select((_) => [
    _.user.status,
    fns.count(_.user.id).as('totalUsers'),
    fns.sum(
      cast(
        _.user.metadata.accessStringPath((_) => _.stats.points),
        'int'
      )
    ).as('totalPoints'),
    fns.max(_.user.lastLogin).as('lastActive')
  ])
  .groupBy((_) => [_.user.status]);
```

### Type Casting

Cast between types safely:

```typescript
// Cast string to number
const result = await db
  .from(UserTable)
  .where((_) =>
    cast(_.user.version, 'int').moreThan(5)
  );

// Cast JSON number to integer
const stats = await db
  .from(UserTable)
  .select((_) => [
    cast(
      _.user.metadata.accessStringPath((_) => _.stats.count),
      'int'
    ).as('count')
  ]);
```

## Update Operations

### Array Fields

Update array fields with type safety:

```typescript
// Update array field
await db
  .update(UserTable)
  .setFields((_) => [
    _.user.id,
    _.user.tags
  ])
  .values({
    id: 'user_1',
    tags: ['tag1', 'tag2']
  })
  .where((_) => _.values.id.equals(_.user.id))
  .returning();

// Set array field to null
await db
  .update(UserTable)
  .setFields((_) => [
    _.user.id,
    _.user.tags
  ])
  .values({
    id: 'user_1',
    tags: null
  })
  .where((_) => _.values.id.equals(_.user.id));
```

### Date Fields

Handle date fields with proper timezone support:

```typescript
// Update timestamp field
await db
  .update(UserTable)
  .setFields((_) => [
    _.user.id,
    _.user.created_at
  ])
  .values({
    id: 'user_1',
    created_at: new Date('2024-01-01T00:00:00Z')
  })
  .where((_) => _.values.id.equals(_.user.id));

// Update multiple date fields
await db
  .update(UserTable)
  .setFields((_) => [
    _.user.id,
    _.user.created_at,
    _.user.updated_at
  ])
  .values({
    id: 'user_1',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date()
  })
  .where((_) => _.values.id.equals(_.user.id));
```

### JSON Fields

Update JSON/JSONB fields with type safety:

```typescript
interface UserMetadata {
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
  profile: {
    bio: string;
    links: string[];
  };
}

// Full JSON update
await db
  .update(UserTable)
  .setFields((_) => [
    _.user.id,
    _.user.metadata
  ])
  .values({
    id: 'user_1',
    metadata: {
      preferences: {
        theme: 'dark',
        notifications: true
      },
      profile: {
        bio: 'New bio',
        links: ['https://example.com']
      }
    }
  })
  .where((_) => _.values.id.equals(_.user.id));
```

## Expression Building

### Complex Conditions

Build complex where clauses:

```typescript
// Multiple conditions
const users = await db
  .from(UserTable)
  .where((_) =>
    _.user.status.equals('active')
      .and(_.user.lastLogin.moreThan(new Date('2024-01-01')))
      .and(
        _.user.metadata
          .accessStringPath((_) => _.preferences.notifications)
          .equals(true)
      )
  );

// OR conditions
const search = await db
  .from(UserTable)
  .where((_) =>
    _.user.email.like('%@example.com')
      .or(_.user.name.like('John%'))
  );
```

### Function Composition

Combine functions for complex operations:

```typescript
// Combine aggregations
const stats = await db
  .from(UserTable)
  .select((_) => [
    fns.sum(
      fns.ifClause(_.user.status.equals('active'), {
        ifTrue: cast(
          _.user.metadata.accessStringPath((_) => _.stats.points),
          'int'
        ),
        ifFalse: constantInt(0)
      })
    ).as('activePoints')
  ]);

// Complex JSON transformations
const data = await db
  .from(UserTable)
  .select((_) => [
    _.user.id,
    fns.coalesce(
      _.user.metadata.accessStringPath((_) => _.profile.displayName),
      _.user.email
    ).as('displayName')
  ]);
```

### Type Safety

All expressions maintain type safety:

```typescript
// Type-safe JSON access
const result = await db
  .from(UserTable)
  .select((_) => [
    _.user.metadata.accessStringPath((_) => _.preferences.theme)
  ]);
// Type: { theme: 'light' | 'dark' }[]

// Type-safe conditional
const data = await db
  .from(UserTable)
  .select((_) => [
    fns.ifClause(_.user.status.equals('active'), {
      ifTrue: _.user.email,        // string
      ifFalse: fns.nullValue()     // null
    }).as('email')
  ]);
// Type: { email: string | null }[]