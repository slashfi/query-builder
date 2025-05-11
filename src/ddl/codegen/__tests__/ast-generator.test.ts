import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createDb, createDbDiscriminator } from '../../../db-helper';
import { generateIndexTypes } from '../ast-generator';

interface TestSchema {
  id: string;
  email: string;
  status: string;
  name: string;
  createdAt: Date;
}

interface ColumnDefinition {
  column: boolean;
  storing: boolean;
  partial: boolean;
  requiredColumns: string[];
}

interface IndexDefinition {
  columns: Record<string, ColumnDefinition>;
  columnsOrder: string[];
  minimumSufficientColumns: string[];
  unique: boolean;
}

interface TableDefinition {
  [indexName: string]: IndexDefinition;
}

interface SchemaDefinition {
  [tableName: string]: TableDefinition;
}

function parseTypeScript(code: string): SchemaDefinition {
  const sourceFile = ts.createSourceFile(
    'test.ts',
    code,
    ts.ScriptTarget.Latest,
    true
  );

  function findInterface(node: ts.Node): ts.InterfaceDeclaration | undefined {
    if (
      ts.isInterfaceDeclaration(node) &&
      node.name.text === '__queryBuilderIndexes'
    ) {
      return node;
    }

    // Check module declarations
    if (ts.isModuleDeclaration(node) && node.body) {
      if (ts.isModuleBlock(node.body)) {
        for (const statement of node.body.statements) {
          const result = findInterface(statement);
          if (result) return result;
        }
      }
    }

    // Recursively check all children
    let result: ts.InterfaceDeclaration | undefined;
    ts.forEachChild(node, (child) => {
      if (!result) {
        result = findInterface(child);
      }
    });
    return result;
  }

  function parseColumnDefinition(
    node: ts.TypeElement
  ): ColumnDefinition | undefined {
    if (!ts.isPropertySignature(node)) return undefined;
    if (!node.type || !ts.isTypeLiteralNode(node.type)) return undefined;

    const result: ColumnDefinition = {
      column: false,
      storing: false,
      partial: false,
      requiredColumns: [],
    };

    node.type.members.forEach((member) => {
      if (
        !ts.isPropertySignature(member) ||
        !member.type ||
        !ts.isIdentifier(member.name)
      ) {
        return;
      }

      const name = member.name.text;
      if (name === 'requiredColumns' && ts.isTupleTypeNode(member.type)) {
        result.requiredColumns = member.type.elements
          .filter((element): element is ts.LiteralTypeNode =>
            ts.isLiteralTypeNode(element)
          )
          .map((element) => {
            if (!ts.isStringLiteral(element.literal)) {
              throw new Error('Expected string literal in requiredColumns');
            }
            return element.literal.text;
          });
      } else if (ts.isLiteralTypeNode(member.type)) {
        const key = name as keyof Omit<ColumnDefinition, 'requiredColumns'>;
        result[key] = member.type.literal.kind === ts.SyntaxKind.TrueKeyword;
      }
    });

    return result;
  }

  function parseIndexDefinition(
    node: ts.TypeElement
  ): [string, IndexDefinition] | undefined {
    if (!ts.isPropertySignature(node)) return undefined;
    if (!node.type || !ts.isTypeLiteralNode(node.type)) return undefined;
    if (!ts.isStringLiteral(node.name)) return undefined;

    const indexName = node.name.text;
    const indexDef: IndexDefinition = {
      columns: {},
      columnsOrder: [],
      minimumSufficientColumns: [],
      unique: false,
    };

    node.type.members.forEach((member) => {
      if (!ts.isPropertySignature(member)) return;
      if (!member.type) return;
      if (!ts.isIdentifier(member.name)) return;

      if (member.name.text === 'columns' && ts.isTypeLiteralNode(member.type)) {
        member.type.members.forEach((columnMember) => {
          const columnDef = parseColumnDefinition(columnMember);
          if (
            columnDef &&
            ts.isPropertySignature(columnMember) &&
            ts.isStringLiteral(columnMember.name)
          ) {
            indexDef.columns[columnMember.name.text] = columnDef;
          }
        });
      } else if (
        member.name.text === 'columnsOrder' &&
        ts.isTupleTypeNode(member.type)
      ) {
        indexDef.columnsOrder = member.type.elements
          .filter((element): element is ts.LiteralTypeNode =>
            ts.isLiteralTypeNode(element)
          )
          .map((element) => {
            if (!ts.isStringLiteral(element.literal)) {
              throw new Error('Expected string literal in columnsOrder');
            }
            return element.literal.text;
          });
      } else if (
        member.name.text === 'minimumSufficientColumns' &&
        ts.isTupleTypeNode(member.type)
      ) {
        indexDef.minimumSufficientColumns = member.type.elements
          .filter((element): element is ts.LiteralTypeNode =>
            ts.isLiteralTypeNode(element)
          )
          .map((element) => {
            if (!ts.isStringLiteral(element.literal)) {
              throw new Error(
                'Expected string literal in minimumSufficientColumns'
              );
            }
            return element.literal.text;
          });
      } else if (
        member.name.text === 'unique' &&
        ts.isLiteralTypeNode(member.type)
      ) {
        indexDef.unique =
          member.type.literal.kind === ts.SyntaxKind.TrueKeyword;
      }
    });

    return [indexName, indexDef];
  }

  function parseTableDefinition(
    node: ts.TypeElement
  ): [string, TableDefinition] | undefined {
    if (!ts.isPropertySignature(node)) return undefined;
    if (!node.type || !ts.isTypeLiteralNode(node.type)) return undefined;
    if (!ts.isStringLiteral(node.name)) return undefined;

    const tableName = node.name.text;
    const tableDef: TableDefinition = {};

    node.type.members.forEach((member) => {
      const indexDef = parseIndexDefinition(member);
      if (indexDef) {
        tableDef[indexDef[0]] = indexDef[1];
      }
    });

    return [tableName, tableDef];
  }

  const interfaceDecl = findInterface(sourceFile);
  if (!interfaceDecl) {
    throw new Error('Could not find __queryBuilderIndexes interface');
  }

  const schema: SchemaDefinition = {};
  interfaceDecl.members.forEach((member) => {
    const tableDef = parseTableDefinition(member);
    if (tableDef) {
      schema[tableDef[0]] = tableDef[1];
    }
  });

  return schema;
}

describe('AST Generator', () => {
  const testSym = createDbDiscriminator('test');
  const db = createDb({
    query: async () => [],
    runQueriesInTransaction: async () => {},
    discriminator: testSym,
    getQueryBuilderIndexes: () => Promise.resolve({ queryBuilderIndexes: {} }),
  });

  it('generates correct metadata for basic index', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
        name: (_) => _.varchar(),
        createdAt: (_) => _.timestamp(),
      })
      .primaryKey('id')
      .indexes(({ table, index }) => ({
        idx_email_status: index(table.email, table.status),
      }))
      .build();

    const result = generateIndexTypes([{ Table: table }]);
    const schema = parseTypeScript(result);

    expect(schema).toEqual({
      users: {
        idx_email_status: {
          columns: {
            email: {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: [],
            },
            status: {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: ['email'],
            },
          },
          columnsOrder: ['email', 'status'],
          minimumSufficientColumns: ['email'],
          unique: false,
        },
      },
    });
  });

  it('generates correct metadata for storing columns', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
        name: (_) => _.varchar(),
        createdAt: (_) => _.timestamp(),
      })
      .primaryKey('id')
      .indexes(({ table, index }) => ({
        idx_email: index(table.email).storing(table.name, table.createdAt),
      }))
      .build();

    const result = generateIndexTypes([{ Table: table }]);
    const schema = parseTypeScript(result);

    expect(schema).toEqual({
      users: {
        idx_email: {
          columns: {
            email: {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: [],
            },
            name: {
              column: false,
              storing: true,
              partial: false,
              requiredColumns: ['email'],
            },
            createdAt: {
              column: false,
              storing: true,
              partial: false,
              requiredColumns: ['email'],
            },
          },
          columnsOrder: ['email'],
          minimumSufficientColumns: ['email'],
          unique: false,
        },
      },
    });
  });

  it('generates correct metadata for where clause', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
        name: (_) => _.varchar(),
        createdAt: (_) => _.timestamp(),
      })
      .primaryKey('id')
      .indexes(({ table, index }) => ({
        idx_email: index(table.email).where(table.status.equals('active')),
      }))
      .build();

    const result = generateIndexTypes([{ Table: table }]);
    const schema = parseTypeScript(result);

    expect(schema).toEqual({
      users: {
        idx_email: {
          columns: {
            email: {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: [],
            },
            status: {
              column: false,
              storing: false,
              partial: true,
              requiredColumns: [],
            },
          },
          columnsOrder: ['email'],
          minimumSufficientColumns: ['email'],
          unique: false,
        },
      },
    });
  });

  it('generates correct metadata when column is both index and where clause', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
        name: (_) => _.varchar(),
        createdAt: (_) => _.timestamp(),
      })
      .primaryKey('id')
      .indexes(({ table, index }) => ({
        idx_status_email: index(table.status, table.email).where(
          table.status.equals('active')
        ),
      }))
      .build();

    const result = generateIndexTypes([{ Table: table }]);
    const schema = parseTypeScript(result);

    expect(schema).toEqual({
      users: {
        idx_status_email: {
          columns: {
            status: {
              column: true,
              storing: false,
              partial: true,
              requiredColumns: [],
            },
            email: {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: ['status'],
            },
          },
          columnsOrder: ['status', 'email'],
          minimumSufficientColumns: ['status'],
          unique: false,
        },
      },
    });
  });

  it('generates correct metadata for multi-column index with all required columns', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
        name: (_) => _.varchar(),
        createdAt: (_) => _.timestamp(),
      })
      .primaryKey('id')
      .indexes(({ table, index }) => ({
        idx_composite: index(
          table.email,
          table.status,
          table.name,
          table.createdAt
        ),
      }))
      .build();

    const result = generateIndexTypes([{ Table: table }]);
    const schema = parseTypeScript(result);

    expect(schema).toEqual({
      users: {
        idx_composite: {
          columns: {
            email: {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: [],
            },
            status: {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: ['email'],
            },
            name: {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: ['email', 'status'],
            },
            createdAt: {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: ['email', 'status', 'name'],
            },
          },
          columnsOrder: ['email', 'status', 'name', 'createdAt'],
          minimumSufficientColumns: ['email'],
          unique: false,
        },
      },
    });
  });

  it('generates correct metadata for unique index', () => {
    const table = db
      .buildTableFromSchema<TestSchema>()
      .tableName('users')
      .defaultAlias('user')
      .columns({
        id: (_) => _.varchar(),
        email: (_) => _.varchar(),
        status: (_) => _.varchar(),
        name: (_) => _.varchar(),
        createdAt: (_) => _.timestamp(),
      })
      .primaryKey('id')
      .indexes(({ table, index }) => ({
        idx_unique_email: index(table.email).unique(),
      }))
      .build();

    const result = generateIndexTypes([{ Table: table }]);
    const schema = parseTypeScript(result);

    expect(schema).toEqual({
      users: {
        idx_unique_email: {
          columns: {
            email: {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: [],
            },
          },
          columnsOrder: ['email'],
          minimumSufficientColumns: ['email'],
          unique: true,
        },
      },
    });
  });
});
