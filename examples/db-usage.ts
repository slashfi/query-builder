import { createDb, createDbDiscriminator } from '../src/db-helper';

// Create database instance
const db = createDb({
  query: async (
    queryName,
    sqlString,
    manager?: { log: typeof console.log }
  ) => {
    // Example query implementation
    const client = manager ?? console;
    client.log(`Executing query ${queryName}:`, sqlString);
    return [];
  },
  runQueriesInTransaction: async (runQueries) => {
    console.log('BEGIN TRANSACTION');
    try {
      await runQueries(console);
      console.log('COMMIT TRANSACTION');
    } catch (e) {
      console.log('ROLLBACK TRANSACTION');
      console.error('Transaction failed:', e);
    }
  },
  discriminator: createDbDiscriminator('test'),
  getQueryBuilderIndexes: () => import('./generated/types'),
});

// Define schemas
interface UserSchema {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

interface PostSchema {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: Date;
}

// Build tables
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
      email_idx: index(table.email).unique(),
      created_at_idx: index(table.createdAt),
    }))
    .build(),
} as const;

const PostTable = {
  Table: db
    .buildTableFromSchema<PostSchema>()
    .tableName('posts')
    .defaultAlias('post')
    .columns({
      id: (_) => _.varchar(),
      userId: (_) => _.varchar(),
      title: (_) => _.varchar(),
      content: (_) => _.varchar(),
      createdAt: (_) => _.timestamp(),
    })
    .primaryKey('id')
    .indexes(({ table, index }) => ({
      user_id_idx: index(table.userId),
      created_at_idx: index(table.createdAt),
    }))
    .build(),
} as const;

// Register tables with DB
db.register(UserTable);
db.register(PostTable);

// Example queries
async function examples() {
  // Basic query (no transaction)
  await db
    .insert(UserTable)
    .values({
      id: 'user_1',
      email: 'user@example.com',
      name: 'Test User',
      createdAt: new Date(),
    })
    .returning('*')
    .query();

  // Using transaction for related operations
  await db.transaction(async () => {
    // Create user
    const user = await db
      .insert(UserTable)
      .values({
        id: 'user_2',
        email: 'user2@example.com',
        name: 'Test User 2',
        createdAt: new Date(),
      })
      .returning('*')
      .query();

    // Create related post
    await db
      .insert(PostTable)
      .values({
        id: 'post_1',
        userId: user.result[0].id,
        title: 'First Post',
        content: 'Hello World',
        createdAt: new Date(),
      })
      .query();
  });

  // Nested transactions
  await db.transaction(async () => {
    // Parent transaction
    const user = await db
      .insert(UserTable)
      .values({
        id: 'user_3',
        email: 'user3@example.com',
        name: 'Test User 3',
        createdAt: new Date(),
      })
      .returning('*')
      .query();

    // Nested transaction (reuses parent transaction)
    await db.transaction(async () => {
      await db
        .insert(PostTable)
        .values({
          id: 'post_2',
          userId: user.result[0].id,
          title: 'Second Post',
          content: 'Nested Transaction',
          createdAt: new Date(),
        })
        .query();
    });
  });

  // Query users
  await db
    .from(UserTable)
    .where((_) => _.user.email.equals('user@example.com'))
    .select((_) => [_.user.id, _.user.email, _.user.name]);

  // Join query
  await db
    .from(UserTable)
    .leftJoin(PostTable, {
      on: (_) => _.post.userId.equals(_.user.id),
    })
    .where((_) => _.user.email.equals('user@example.com'))
    .select((_) => [_.user.id, _.user.email, _.post.title, _.post.content]);

  // Check entity registration
  if (db.hasEntity('users')) {
    const userTable = db.getEntity('users');
    console.log('Found user table:', userTable?.tableName);
  }
}

// Run examples
examples().catch(console.error);
