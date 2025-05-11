import { describe, expect, it } from 'vitest';
import { sql } from '../sql-string';

describe('SqlString', () => {
  it('should be able to create a pure primitive query', () => {
    const query = sql`SELECT * FROM "table" WHERE "id" = ${sql.p(1)}`;

    expect(query.getQuery()).toBe('SELECT * FROM "table" WHERE "id" = $1');
    expect(query.getParameters()).toEqual([1]);

    const query2 = sql`SELECT * FROM "table" WHERE "id" = ${sql.p(
      1
    )} AND "name" = ${sql.p('hello')}`;
    expect(query2.getQuery()).toBe(
      'SELECT * FROM "table" WHERE "id" = $1 AND "name" = $2'
    );

    const date = new Date();

    const query3 = sql`SELECT * FROM "table" WHERE date > ${sql.p(date)}`;
    expect(query3.getQuery()).toBe('SELECT * FROM "table" WHERE date > $1');
    expect(query3.getParameters()).toEqual([date]);
  });

  it('should be able to create a pure primitive array query', () => {
    const params = [1, 'hello'];
    const query2 = sql`SELECT * FROM "table" WHERE "id" = ${sql.p(params)}`;

    expect(query2.getParameters()).toEqual([1, 'hello']);

    const fakeIds = ['u_kvvnn', 'u_kvvnn2', 'u_kvvnn3'];
    const query3 = sql`SELECT * FROM "table" WHERE "id" IN ${sql.p(fakeIds)}`;

    expect(query3.getQuery()).toBe(
      'SELECT * FROM "table" WHERE "id" IN ($1,$2,$3)'
    );
    expect(query3.getParameters()).toEqual(fakeIds);

    const fakeParams = ['u_kvvnn', 1, 'u_nick', 2];
    const query4 = sql`SELECT * FROM "table" WHERE "id" = ${sql.p(fakeParams)}`;

    expect(query4.getQuery()).toBe(
      'SELECT * FROM "table" WHERE "id" = ($1,$2,$3,$4)'
    );
    expect(query4.getParameters()).toEqual(fakeParams);
  });

  it('should be able to handle empty arrays', () => {
    const fakeIds: string[] = [];
    const query = sql`SELECT * FROM "table" WHERE "id" IN ${sql.p(fakeIds)}`;

    expect(query.getQuery()).toBe('SELECT * FROM "table" WHERE "id" IN ()');
    expect(query.getParameters()).toEqual([]);
  });

  it('should be able to create a nested query', () => {
    const fakeIds = ['u_kvvnn', 'u_skvrah', 'u_jason123'];
    const dateBiggerThan = new Date();

    const parts = [
      sql`id IN ${sql.p(fakeIds)}`,
      sql`date > ${sql.p(dateBiggerThan)}`,
    ];

    const query = sql`SELECT * FROM "table" WHERE ${sql.and(parts)}`;

    expect(query.getQuery()).toBe(
      'SELECT * FROM "table" WHERE id IN ($1,$2,$3) AND date > $4'
    );
    expect(query.getParameters()).toEqual([...fakeIds, dateBiggerThan]);
  });

  it('should be able to encode single parameters separately', () => {
    const fakeIds = ['u_kvvnn', 'u_skvrah', 'u_jason123'].map((s) => sql.p(s));

    const query = sql`SELECT * FROM "table" WHERE "id" IN (${fakeIds[0]},${fakeIds[1]},${fakeIds[2]})`;

    const query2 = sql`SELECT * FROM "table" WHERE "id" IN ${fakeIds}`;

    expect(query.getQuery()).toBe(
      'SELECT * FROM "table" WHERE "id" IN ($1,$2,$3)'
    );
    expect(query2.getQuery()).toBe(
      'SELECT * FROM "table" WHERE "id" IN ($1,$2,$3)'
    );

    expect(query.getParameters()).toEqual([
      'u_kvvnn',
      'u_skvrah',
      'u_jason123',
    ]);
    expect(query2.getParameters()).toEqual([
      'u_kvvnn',
      'u_skvrah',
      'u_jason123',
    ]);
  });

  it('should be able to do a super complex nested query', () => {
    const fakeIds = ['u_kvvnn', 'u_skvrah', 'u_jason123'];
    const loginAlertsEnabled = 'true';
    const mfaStatus = 'not_enabled';

    const baseQuery = sql`SELECT * FROM "user" WHERE id IN ${sql.p(
      fakeIds
    )} AND settings->>'loginAlertsEnabled' = ${sql.p(loginAlertsEnabled)}`;
    const parentQuery = sql`SELECT * FROM (${baseQuery}) WHERE "mfaStatus" = ${sql.p(
      mfaStatus
    )}`;

    expect(parentQuery.getQuery()).toBe(
      'SELECT * FROM (SELECT * FROM "user" WHERE id IN ($1,$2,$3) AND settings->>\'loginAlertsEnabled\' = $4) WHERE "mfaStatus" = $5'
    );
    expect(parentQuery.getParameters()).toEqual([
      ...fakeIds,
      loginAlertsEnabled,
      mfaStatus,
    ]);
  });

  it('should be able to specify column+table names dynamically', () => {
    const columns = ['id', 'name'].map((s) => sql.column({ name: s }));
    const fakeIds = ['u_kvvnn', 'u_skvrah', 'u_jason123'].map((s) => sql.p(s));

    const query = sql`SELECT ${sql.join(
      columns,
      ', '
    )} FROM "table" WHERE "id" IN (${fakeIds[0]},${fakeIds[1]},${fakeIds[2]})`;

    expect(query.getQuery()).toBe(
      'SELECT "id", "name" FROM "table" WHERE "id" IN ($1,$2,$3)'
    );
    expect(query.getParameters()).toEqual([
      'u_kvvnn',
      'u_skvrah',
      'u_jason123',
    ]);

    const complexColumns = [
      {
        table: 'ui',
        name: 'id',
        alias: 'ui_id',
      },
      {
        table: 'ui',
        name: 'name',
        alias: 'ui_name',
      },
    ].map((s) => sql.column(s));

    const complexTable = sql.table({
      schema: 'public',
      name: 'user_identity',
      index: 'fake_index',
      alias: 'ui',
    });

    const query2 = sql`SELECT ${sql.join(
      complexColumns,
      ', '
    )} FROM ${complexTable} WHERE "id" IN ${fakeIds}`;

    expect(query2.getQuery()).toBe(
      'SELECT "ui"."id" AS "ui_id", "ui"."name" AS "ui_name" FROM "public"."user_identity"@"fake_index" AS "ui" WHERE "id" IN ($1,$2,$3)'
    );
    expect(query2.getParameters()).toEqual([
      'u_kvvnn',
      'u_skvrah',
      'u_jason123',
    ]);
  });

  it('should work with conditional subqueries', () => {
    const fakeIds = ['u_kvvnn', 'u_skvrah', 'u_jason123'];
    const fakeIdentities = ['u_tabtab', 'u_app', 'u_tabtab_app'];

    const getDynamicQuery = (identities: string[]) => {
      const whereClauses = [sql`id IN ${sql.p(fakeIds)}`];

      if (identities.length > 0) {
        whereClauses.push(sql`identity IN ${sql.p(identities)}`);
      }

      return sql`SELECT * FROM "user" WHERE ${sql.and(whereClauses)}`;
    };

    const query = getDynamicQuery([]);

    expect(query.getQuery()).toBe(
      'SELECT * FROM "user" WHERE id IN ($1,$2,$3)'
    );
    expect(query.getParameters()).toEqual(fakeIds);

    const query2 = getDynamicQuery(fakeIdentities);

    expect(query2.getQuery()).toBe(
      'SELECT * FROM "user" WHERE id IN ($1,$2,$3) AND identity IN ($4,$5,$6)'
    );
    expect(query2.getParameters()).toEqual([...fakeIds, ...fakeIdentities]);
  });

  it('wrapped query should be equal to unwrapped query', () => {
    const fakeIds = ['u_kvvnn', 'u_skvrah', 'u_jason123'];
    const loginAlertsEnabled = 'true';

    const baseQuery = sql`SELECT * FROM "user" WHERE id IN ${sql.p(
      fakeIds
    )} AND settings->>'loginAlertsEnabled' = ${sql.p(loginAlertsEnabled)}`;

    const wrappedQuery = sql`${baseQuery}`;

    expect(wrappedQuery.getQuery()).toBe(baseQuery.getQuery());
    expect(wrappedQuery.getParameters()).toEqual(baseQuery.getParameters());
  });

  it('should parameterize snowflake queries properly', () => {
    const fakeIds = ['u_kvvnn', 'u_skvrah', 'u_jason123'];
    const baseQuery = sql`SELECT * FROM "user" WHERE id IN ${sql.p(fakeIds)}`;

    expect(baseQuery.getQuery({ database: 'snowflake' })).toBe(
      'SELECT * FROM "user" WHERE id IN (?,?,?)'
    );
    expect(baseQuery.getParameters()).toEqual(fakeIds);
  });

  it('should throw error on invalid column/table names', () => {
    expect(() => sql.column({ name: '"id"', alias: 'test' })).toThrowError();

    expect(() => sql.table({ name: 'table', alias: 'test"' })).toThrowError();

    expect(() =>
      sql.table({ name: 'table', index: 'test; DROP table users' })
    ).toThrowError();

    const validTable = sql.table({
      name: 'table',
      alias: 'My_Table3',
      index: 'MY_INDEX',
      schema: 'MyLittlePony1',
    });

    expect(validTable.getQuery()).toBe(
      '"MyLittlePony1"."table"@"MY_INDEX" AS "My_Table3"'
    );

    const validColumn = sql.column({
      table: 'My_Table3',
      name: 'Cool123',
      alias: 'Cool_Column',
    });

    expect(validColumn.getQuery()).toBe(
      '"My_Table3"."Cool123" AS "Cool_Column"'
    );
  });
});
