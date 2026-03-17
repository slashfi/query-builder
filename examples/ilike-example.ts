import { createDb, createDbDiscriminator } from '../src/db-helper';

interface UserTable {
  id: string;
  name: string;
  email: string;
}

const testSym = createDbDiscriminator('example');
const db = createDb({
  runQueriesInTransaction: async () => {},
  query: async () => [],
  discriminator: testSym,
  getQueryBuilderIndexes: () =>
    Promise.resolve({ queryBuilderIndexes: {} as any }),
});

class Users {
  static readonly Table = db
    .buildTableFromSchema<UserTable>()
    .columns({
      id: (_) => _.varchar(),
      name: (_) => _.varchar(),
      email: (_) => _.varchar(),
    })
    .primaryKey('id')
    .tableName('users')
    .defaultAlias('u')
    .build();
}

// Example usage of the ilike operator
function demonstrateIlikeUsage() {
  console.log('=== ILIKE Operator Examples ===\n');

  // Case-insensitive search for names containing "john"
  const nameSearchQuery = db
    .from(Users)
    .where((_) => _.u.name.ilike('%john%'))
    .getSqlString();

  console.log('1. Case-insensitive name search:');
  console.log('SQL:', nameSearchQuery.getQuery());
  console.log('Parameters:', nameSearchQuery.getParameters());
  console.log();

  // Case-insensitive email domain search
  const emailDomainQuery = db
    .from(Users)
    .where((_) => _.u.email.ilike('%@gmail.com'))
    .getSqlString();

  console.log('2. Case-insensitive email domain search:');
  console.log('SQL:', emailDomainQuery.getQuery());
  console.log('Parameters:', emailDomainQuery.getParameters());
  console.log();

  // Combined search with AND
  const combinedQuery = db
    .from(Users)
    .where((_) =>
      _.u.name.ilike('%john%').and(_.u.email.ilike('%@company.com'))
    )
    .getSqlString();

  console.log('3. Combined case-insensitive search:');
  console.log('SQL:', combinedQuery.getQuery());
  console.log('Parameters:', combinedQuery.getParameters());
  console.log();

  // Comparison: ILIKE vs LIKE
  const ilikeQuery = db
    .from(Users)
    .where((_) => _.u.name.ilike('%JOHN%'))
    .getSqlString();

  const likeQuery = db
    .from(Users)
    .where((_) => _.u.name.like('%JOHN%'))
    .getSqlString();

  console.log('4. ILIKE vs LIKE comparison:');
  console.log('ILIKE SQL:', ilikeQuery.getQuery());
  console.log('LIKE SQL:', likeQuery.getQuery());
  console.log('(Note: ILIKE is case-insensitive, LIKE is case-sensitive)');
}

// Run the demonstration
demonstrateIlikeUsage();
