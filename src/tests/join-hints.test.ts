import type { GenericAny } from '@/core-utils';
import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../db-helper';
import type { SqlString } from '../sql-string';

// Mock query executor for testing
const mockQueryExecutor = {
  query: async (_queryName: string, _sqlString: SqlString) => {
    return [];
  },
  runQueriesInTransaction: async (
    runQueries: (manager: GenericAny) => Promise<void>
  ) => {
    await runQueries(console);
  },
};

// Create test database instance
const db = createDb({
  query: mockQueryExecutor.query,
  runQueriesInTransaction: mockQueryExecutor.runQueriesInTransaction,
  discriminator: createDbDiscriminator('test'),
  getQueryBuilderIndexes: () => Promise.resolve({} as GenericAny),
});

// Define test schemas
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

interface CommentSchema {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

// Build test tables
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
    .build(),
} as const;

const CommentTable = {
  Table: db
    .buildTableFromSchema<CommentSchema>()
    .tableName('comments')
    .defaultAlias('comment')
    .columns({
      id: (_) => _.varchar(),
      postId: (_) => _.varchar(),
      userId: (_) => _.varchar(),
      content: (_) => _.varchar(),
      createdAt: (_) => _.timestamp(),
    })
    .primaryKey('id')
    .build(),
} as const;

// Register tables
db.register(UserTable);
db.register(PostTable);
db.register(CommentTable);

describe('Join Hints', () => {
  describe('LEFT JOIN with hints', () => {
    it('should generate LEFT JOIN without hint when joinHint is not provided', () => {
      const query = db.from(UserTable).leftJoin(PostTable, {
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('LEFT JOIN');
      expect(sqlText).not.toContain('LOOKUP');
      expect(sqlText).not.toContain('MERGE');
      expect(sqlText).not.toContain('HASH');
    });

    it('should generate LEFT LOOKUP JOIN when joinHint is LOOKUP', () => {
      const query = db.from(UserTable).leftJoin(PostTable, {
        joinHint: 'LOOKUP',
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('LEFT LOOKUP JOIN');
      expect(sqlText).not.toContain('MERGE');
      expect(sqlText).not.toContain('HASH');
    });

    it('should generate LEFT MERGE JOIN when joinHint is MERGE', () => {
      const query = db.from(UserTable).leftJoin(PostTable, {
        joinHint: 'MERGE',
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('LEFT MERGE JOIN');
      expect(sqlText).not.toContain('LOOKUP');
      expect(sqlText).not.toContain('HASH');
    });

    it('should generate LEFT HASH JOIN when joinHint is HASH', () => {
      const query = db.from(UserTable).leftJoin(PostTable, {
        joinHint: 'HASH',
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('LEFT HASH JOIN');
      expect(sqlText).not.toContain('LOOKUP');
      expect(sqlText).not.toContain('MERGE');
    });
  });

  describe('INNER JOIN with hints', () => {
    it('should generate INNER JOIN without hint when joinHint is not provided', () => {
      const query = db.from(UserTable).innerJoin(PostTable, {
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('INNER JOIN');
      expect(sqlText).not.toContain('LOOKUP');
      expect(sqlText).not.toContain('MERGE');
      expect(sqlText).not.toContain('HASH');
    });

    it('should generate INNER LOOKUP JOIN when joinHint is LOOKUP', () => {
      const query = db.from(UserTable).innerJoin(PostTable, {
        joinHint: 'LOOKUP',
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('INNER LOOKUP JOIN');
      expect(sqlText).not.toContain('MERGE');
      expect(sqlText).not.toContain('HASH');
    });

    it('should generate INNER MERGE JOIN when joinHint is MERGE', () => {
      const query = db.from(UserTable).innerJoin(PostTable, {
        joinHint: 'MERGE',
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('INNER MERGE JOIN');
      expect(sqlText).not.toContain('LOOKUP');
      expect(sqlText).not.toContain('HASH');
    });

    it('should generate INNER HASH JOIN when joinHint is HASH', () => {
      const query = db.from(UserTable).innerJoin(PostTable, {
        joinHint: 'HASH',
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('INNER HASH JOIN');
      expect(sqlText).not.toContain('LOOKUP');
      expect(sqlText).not.toContain('MERGE');
    });
  });

  describe('RIGHT JOIN with hints', () => {
    it('should generate RIGHT JOIN without hint when joinHint is not provided', () => {
      const query = db.from(UserTable).rightJoin(PostTable, {
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('RIGHT JOIN');
      expect(sqlText).not.toContain('LOOKUP');
      expect(sqlText).not.toContain('MERGE');
      expect(sqlText).not.toContain('HASH');
    });

    it('should generate RIGHT LOOKUP JOIN when joinHint is LOOKUP', () => {
      const query = db.from(UserTable).rightJoin(PostTable, {
        joinHint: 'LOOKUP',
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('RIGHT LOOKUP JOIN');
      expect(sqlText).not.toContain('MERGE');
      expect(sqlText).not.toContain('HASH');
    });

    it('should generate RIGHT MERGE JOIN when joinHint is MERGE', () => {
      const query = db.from(UserTable).rightJoin(PostTable, {
        joinHint: 'MERGE',
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('RIGHT MERGE JOIN');
      expect(sqlText).not.toContain('LOOKUP');
      expect(sqlText).not.toContain('HASH');
    });

    it('should generate RIGHT HASH JOIN when joinHint is HASH', () => {
      const query = db.from(UserTable).rightJoin(PostTable, {
        joinHint: 'HASH',
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('RIGHT HASH JOIN');
      expect(sqlText).not.toContain('LOOKUP');
      expect(sqlText).not.toContain('MERGE');
    });
  });

  describe('Multiple joins with different hints', () => {
    it('should handle multiple joins with different hints correctly', () => {
      const query = db
        .from(UserTable)
        .leftJoin(PostTable, {
          joinHint: 'LOOKUP',
          on: (_) => _.post.userId.equals(_.user.id),
        })
        .innerJoin(CommentTable, {
          joinHint: 'HASH',
          on: (_) => _.comment.postId.equals(_.post.id),
        });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('LEFT LOOKUP JOIN');
      expect(sqlText).toContain('INNER HASH JOIN');
      expect(sqlText).not.toContain('MERGE');
    });

    it('should handle mixed joins with and without hints', () => {
      const query = db
        .from(UserTable)
        .leftJoin(PostTable, {
          joinHint: 'MERGE',
          on: (_) => _.post.userId.equals(_.user.id),
        })
        .innerJoin(CommentTable, {
          // No joinHint provided
          on: (_) => _.comment.postId.equals(_.post.id),
        });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('LEFT MERGE JOIN');
      expect(sqlText).toContain('INNER JOIN');
      expect(sqlText).not.toContain('INNER MERGE JOIN');
      expect(sqlText).not.toContain('LOOKUP');
      expect(sqlText).not.toContain('HASH');
    });
  });

  describe('Join hints with aliases and indexes', () => {
    it('should work with custom aliases and join hints', () => {
      const query = db.from(UserTable, 'u').leftJoin(PostTable, {
        alias: 'p',
        joinHint: 'LOOKUP',
        on: (_) => _.p.userId.equals(_.u.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('LEFT LOOKUP JOIN');
      expect(sqlText).toContain('AS "p"');
      expect(sqlText).toContain('AS "u"');
    });

    it('should work with custom indexes and join hints', () => {
      const query = db.from(UserTable).leftJoin(PostTable, {
        index: 'user_id_idx',
        joinHint: 'HASH',
        on: (_) => _.post.userId.equals(_.user.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('LEFT HASH JOIN');
      expect(sqlText).toContain('@"user_id_idx"');
    });

    it('should work with both custom alias, index, and join hints', () => {
      const query = db.from(UserTable, 'u').leftJoin(PostTable, {
        alias: 'p',
        index: 'user_id_idx',
        joinHint: 'MERGE',
        on: (_) => _.p.userId.equals(_.u.id),
      });

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('LEFT MERGE JOIN');
      expect(sqlText).toContain('@"user_id_idx"');
      expect(sqlText).toContain('AS "p"');
      expect(sqlText).toContain('AS "u"');
    });
  });

  describe('Complex queries with join hints', () => {
    it('should work with WHERE clauses and join hints', () => {
      const query = db
        .from(UserTable)
        .leftJoin(PostTable, {
          joinHint: 'LOOKUP',
          on: (_) => _.post.userId.equals(_.user.id),
        })
        .where((_) => _.user.email.equals('test@example.com'))
        .select((_) => [_.user.name, _.post.title]);

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('LEFT LOOKUP JOIN');
      expect(sqlText).toContain('WHERE');
      expect(sqlText).toContain('SELECT');
    });

    it('should work with ORDER BY and join hints', () => {
      const query = db
        .from(UserTable)
        .innerJoin(PostTable, {
          joinHint: 'HASH',
          on: (_) => _.post.userId.equals(_.user.id),
        })
        .orderBy((_) => [_.user.createdAt]);

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('INNER HASH JOIN');
      expect(sqlText).toContain('ORDER BY');
    });

    it('should work with LIMIT and join hints', () => {
      const query = db
        .from(UserTable)
        .rightJoin(PostTable, {
          joinHint: 'MERGE',
          on: (_) => _.post.userId.equals(_.user.id),
        })
        .limit(10);

      const sql = query.getSqlString();
      const sqlText = sql.getQuery();

      expect(sqlText).toContain('RIGHT MERGE JOIN');
      expect(sqlText).toContain('LIMIT');
    });
  });
});
