# Contributing Guide

This document covers internal implementation details and development guidelines for the Query Builder library.

## Introspection System

### Helper Functions

The system provides several helper functions in `table-from-schema-builder.ts` to check introspection settings:

```typescript
// Check if any introspection is enabled
const needsIntrospection = shouldIntrospectSchema(table);

// Check specific aspects
const needsIndexes = shouldIntrospectIndexes(table);
const needsColumns = shouldIntrospectColumns(table);
const needsConstraints = shouldIntrospectConstraints(table);
```

These helpers are used internally to optimize query execution by determining which database queries need to be run.

### Performance Optimization

The introspection system is optimized to only execute necessary queries based on configuration:

1. Base table information is always fetched
2. Column information is only fetched if any table has `columns: 'enforce'`
3. Index information is only fetched if any table has `indexes: 'enforce'`
4. Constraint information is only fetched if any table has `constraints: 'enforce'`
5. CREATE TABLE statements are only fetched for tables with `indexes: 'enforce'`

### Index Parsing

The system parses CREATE TABLE statements to extract detailed index information:

1. Regular expressions are used to match different parts of index definitions:
   - Index name
   - Column expressions
   - WHERE conditions for partial indexes
   - STORING clauses

2. The parsed information is stored in the FastIndex type:
```typescript
interface FastIndex {
  name: string;
  unique: boolean;
  parts: FastIndexPart[];
  includeColumns: string[];
  partial?: string; // WHERE condition
}
```

### Development Guidelines

1. **Type Safety**
   - Use strict TypeScript types
   - Avoid any type assertions unless absolutely necessary
   - Validate all external data

2. **Error Handling**
   - Use specific error types
   - Provide detailed error messages
   - Include context in error objects

3. **Performance**
   - Only fetch required data
   - Use parallel queries where possible
   - Cache parsed results when appropriate

4. **Testing**
   - Add unit tests for helper functions
   - Add integration tests for database operations
   - Test with different database versions
   - Test with various index types and configurations

### Code Style

1. **TypeScript**
   - Enable strict mode
   - Use explicit return types for public APIs
   - Prefer interfaces over types for public APIs

2. **Naming**
   - Use descriptive variable names
   - Follow existing naming patterns
   - Prefix internal helpers with underscore

3. **Documentation**
   - Add JSDoc comments for public APIs
   - Keep documentation in sync with code
   - Split between user (INTROSPECT.md) and internal (CONTRIBUTING.md) docs

4. **Code Organization**
   - Keep functions focused and small
   - Group related functionality
   - Use meaningful file names

For more information about specific implementation details, see the inline code comments.