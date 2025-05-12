import ts from 'typescript';
import { getAstNodeRepository } from '../../ast-node-repository';
import type {
  BaseDbDiscriminator,
  ExpressionBase,
  TableBase,
} from '../../base';
import type { EntityTarget } from '../../entity-target';
import type { SqlString } from '../../sql-string';

import type { ExpressionBuilderShape } from '../../expression-builder-type';
import { injectParameters } from '../../sql-string/helpers';

// SQL keywords to ignore when extracting column names
const SQL_KEYWORDS = new Set([
  'IS',
  'NOT',
  'NULL',
  'AND',
  'OR',
  'IN',
  'LIKE',
  'ILIKE',
  'ANY',
  'ALL',
  'SOME',
  'TRUE',
  'FALSE',
]);

/**
 * Extract column names from SQL string
 */
function getColumnNamesFromSql(sql: SqlString): string[] {
  const query = sql.getQuery();
  const matches = query.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  return matches.filter((match) => !SQL_KEYWORDS.has(match.toUpperCase()));
}

/**
 * Extract column names from ExpressionBuilder AST
 */
function getColumnNamesFromExpression(
  expr: ExpressionBuilderShape<ExpressionBase<any>>
): string[] {
  return Array.from(
    expr._expression.columnReferences.map((val) => val[0].value)
  );
}

/**
 * Creates an AST node for the __queryBuilderIndexes interface augmentation
 */
function createIndexMetadataInterface<S extends BaseDbDiscriminator>(
  schemas: EntityTarget<TableBase<S>, S>[]
): ts.InterfaceDeclaration {
  const members: ts.TypeElement[] = [];

  // Add each table's indexes
  for (const schema of schemas) {
    const table = schema.Table;
    if (!table.indexes || Object.keys(table.indexes).length === 0) continue;

    const indexMembers: ts.TypeElement[] = [];

    // Add each index
    for (const [indexName, index] of Object.entries(table.indexes)) {
      // Track all columns and their contexts
      const columnInfo = new Map<
        string,
        {
          column: boolean;
          storing: boolean;
          partial: boolean;
          requiredColumns?: string[]; // Track columns that must be specified
        }
      >();

      // Track columns from first expression for storing/where clauses
      const firstExpressionColumns: string[] = [];

      // Process index expressions
      if (index.expressions) {
        for (const expr of index.expressions) {
          const columnNames = getColumnNamesFromSql(expr);

          // If this is the first expression, track its columns as they'll be required
          // for any storing/where clause columns
          if (firstExpressionColumns.length === 0) {
            firstExpressionColumns.push(...columnNames);
          }

          // Keep track of all columns seen in expressions so far
          const allSeenColumns = Array.from(columnInfo.keys());

          // Process each column in this expression
          columnNames.forEach((columnName) => {
            columnInfo.set(columnName, {
              column: true,
              storing: false,
              partial: false,
              requiredColumns: allSeenColumns, // All columns seen before this one
            });
          });
        }
      }

      // Process storing columns
      if (index.storingColumns) {
        for (const columnName of index.storingColumns) {
          const info = columnInfo.get(columnName);
          if (info) {
            info.storing = true;
            // For storing columns, only require the first column from first expression
            info.requiredColumns =
              firstExpressionColumns.length > 0
                ? [firstExpressionColumns[0]]
                : [];
          } else {
            columnInfo.set(columnName, {
              column: false,
              storing: true,
              partial: false,
              requiredColumns:
                firstExpressionColumns.length > 0
                  ? [firstExpressionColumns[0]]
                  : [], // Only require first column
            });
          }
        }
      }

      // Process partial condition
      if (index.whereClause) {
        const columnNames = getColumnNamesFromExpression(index.whereClause);
        columnNames.forEach((columnName) => {
          const info = columnInfo.get(columnName);
          if (info) {
            // Keep existing properties but mark as partial
            info.partial = true;
            // Where clause columns have no additional requirements
            info.requiredColumns = info.column
              ? info.requiredColumns || []
              : [];
          } else {
            columnInfo.set(columnName, {
              column: false,
              storing: false,
              partial: true,
              requiredColumns: [], // No requirements for where clause columns
            });
          }
        });
      }

      // Create column properties
      const columnMembers: ts.TypeElement[] = [];
      columnInfo.forEach((info, columnName) => {
        columnMembers.push(
          ts.factory.createPropertySignature(
            undefined,
            ts.factory.createStringLiteral(columnName),
            undefined,
            ts.factory.createTypeLiteralNode([
              ts.factory.createPropertySignature(
                undefined,
                'column',
                undefined,
                ts.factory.createLiteralTypeNode(
                  info.column
                    ? ts.factory.createTrue()
                    : ts.factory.createFalse()
                )
              ),
              ts.factory.createPropertySignature(
                undefined,
                'storing',
                undefined,
                ts.factory.createLiteralTypeNode(
                  info.storing
                    ? ts.factory.createTrue()
                    : ts.factory.createFalse()
                )
              ),
              ts.factory.createPropertySignature(
                undefined,
                'partial',
                undefined,
                ts.factory.createLiteralTypeNode(
                  info.partial
                    ? ts.factory.createTrue()
                    : ts.factory.createFalse()
                )
              ),
              // Add required columns to AST
              ts.factory.createPropertySignature(
                undefined,
                'requiredColumns',
                undefined,
                ts.factory.createTupleTypeNode(
                  (info.requiredColumns || []).map((col) =>
                    ts.factory.createLiteralTypeNode(
                      ts.factory.createStringLiteral(col)
                    )
                  )
                )
              ),
            ])
          )
        );
      });

      // Get only the index columns (not storing or where clause columns)
      const indexColumns = Array.from(columnInfo.entries())
        .filter(([_, info]) => info.column)
        .map(([col, _]) => col);

      // Create tuple type nodes for columns
      const columnsOrderNode = ts.factory.createTupleTypeNode(
        indexColumns.map((col) =>
          ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(col))
        )
      );

      const minimumSufficientColumnsNode = ts.factory.createTupleTypeNode(
        indexColumns
          .slice(0, 1)
          .map((col) =>
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral(col)
            )
          )
      );

      // Create index property with columns, columnsOrder, minimumSufficientColumns, and predicate
      indexMembers.push(
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createStringLiteral(indexName),
          undefined,
          ts.factory.createTypeLiteralNode([
            ts.factory.createPropertySignature(
              undefined,
              'columns',
              undefined,
              ts.factory.createTypeLiteralNode(columnMembers)
            ),
            ts.factory.createPropertySignature(
              undefined,
              'columnsOrder',
              undefined,
              columnsOrderNode
            ),
            ts.factory.createPropertySignature(
              undefined,
              'minimumSufficientColumns',
              undefined,
              minimumSufficientColumnsNode
            ),
            ts.factory.createPropertySignature(
              undefined,
              'unique',
              undefined,
              ts.factory.createLiteralTypeNode(
                index.unique
                  ? ts.factory.createTrue()
                  : ts.factory.createFalse()
              )
            ),
            // Add predicate property based on whereClause
            ...(index.whereClause
              ? [
                  ts.factory.createPropertySignature(
                    undefined,
                    ts.factory.createIdentifier('predicate'),
                    undefined,
                    ts.factory.createKeywordTypeNode(
                      ts.SyntaxKind.StringKeyword
                    )
                  ),
                ]
              : [
                  ts.factory.createPropertySignature(
                    undefined,
                    ts.factory.createIdentifier('predicate'),
                    ts.factory.createToken(ts.SyntaxKind.QuestionToken),
                    ts.factory.createKeywordTypeNode(
                      ts.SyntaxKind.UndefinedKeyword
                    )
                  ),
                ]),
          ])
        )
      );
    }

    // Add table property
    members.push(
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createStringLiteral(table.tableName),
        undefined,
        ts.factory.createTypeLiteralNode(indexMembers)
      )
    );
  }

  // Create the interface declaration for module augmentation
  return ts.factory.createInterfaceDeclaration(
    undefined,
    ts.factory.createIdentifier('__queryBuilderIndexes'),
    undefined,
    undefined,
    members
  );
}

/**
 * Generates TypeScript type definitions using the TypeScript AST
 */
export function generateIndexTypes<S extends BaseDbDiscriminator>(
  schemas: EntityTarget<TableBase<S>, S>[]
): string {
  const statements: ts.Statement[] = [];

  // Add import statement for __queryBuilderIndexes
  statements.push(
    ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(
        true, // isTypeOnly
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(
            false,
            undefined,
            ts.factory.createIdentifier('__queryBuilderIndexes')
          ),
        ])
      ),
      ts.factory.createStringLiteral('@slashfi/query-builder'),
      undefined
    )
  );

  // Create module declaration for index-metadata
  statements.push(
    ts.factory.createModuleDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword)],
      ts.factory.createStringLiteral('@slashfi/query-builder'),
      ts.factory.createModuleBlock([
        // Add __queryBuilderIndexes interface augmentation
        createIndexMetadataInterface(schemas),
      ]),
      ts.NodeFlags.None
    )
  );

  // Add the runtime object with type annotation
  statements.push(
    ts.factory.createVariableStatement(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            'queryBuilderIndexes',
            undefined,
            ts.factory.createTypeReferenceNode(
              '__queryBuilderIndexes',
              undefined
            ),
            createIndexMetadataObject(schemas)
          ),
        ],
        ts.NodeFlags.Const
      )
    )
  );

  // Create object literal matching the interface
  function createIndexMetadataObject<S extends BaseDbDiscriminator>(
    schemas: EntityTarget<TableBase<S>, S>[]
  ): ts.ObjectLiteralExpression {
    const properties: ts.PropertyAssignment[] = [];

    // Add each table's indexes
    for (const schema of schemas) {
      const table = schema.Table;
      if (!table.indexes || Object.keys(table.indexes).length === 0) continue;

      const indexProperties: ts.PropertyAssignment[] = [];

      // Add each index
      for (const [indexName, index] of Object.entries(table.indexes)) {
        // Track all columns and their contexts
        const columnInfo = new Map<
          string,
          {
            column: boolean;
            storing: boolean;
            partial: boolean;
            requiredColumns?: string[];
          }
        >();

        // Track columns from first expression for storing/where clauses
        const firstExpressionColumns: string[] = [];

        // Process index expressions
        if (index.expressions) {
          for (const expr of index.expressions) {
            const columnNames = getColumnNamesFromSql(expr);

            // If this is the first expression, track its columns as they'll be required
            // for any storing/where clause columns
            if (firstExpressionColumns.length === 0) {
              firstExpressionColumns.push(...columnNames);
            }

            // Keep track of all columns seen in expressions so far
            const allSeenColumns = Array.from(columnInfo.keys());

            // Process each column in this expression
            columnNames.forEach((columnName) => {
              columnInfo.set(columnName, {
                column: true,
                storing: false,
                partial: false,
                requiredColumns: allSeenColumns, // All columns seen before this one
              });
            });
          }
        }

        // Process storing columns
        if (index.storingColumns) {
          for (const columnName of index.storingColumns) {
            const info = columnInfo.get(columnName);
            if (info) {
              info.storing = true;
              // For storing columns, only require the first column from first expression
              info.requiredColumns =
                firstExpressionColumns.length > 0
                  ? [firstExpressionColumns[0]]
                  : [];
            } else {
              columnInfo.set(columnName, {
                column: false,
                storing: true,
                partial: false,
                requiredColumns:
                  firstExpressionColumns.length > 0
                    ? [firstExpressionColumns[0]]
                    : [], // Only require first column
              });
            }
          }
        }

        // Process partial condition
        if (index.whereClause) {
          const columnNames = getColumnNamesFromExpression(index.whereClause);
          columnNames.forEach((columnName) => {
            const info = columnInfo.get(columnName);
            if (info) {
              // Keep existing properties but mark as partial
              info.partial = true;
              // Where clause columns have no additional requirements
              info.requiredColumns = info.column
                ? info.requiredColumns || []
                : [];
            } else {
              columnInfo.set(columnName, {
                column: false,
                storing: false,
                partial: true,
                requiredColumns: [], // No requirements for where clause columns
              });
            }
          });
        }

        // Create column properties
        const columnProperties: ts.PropertyAssignment[] = [];
        columnInfo.forEach((info, columnName) => {
          columnProperties.push(
            ts.factory.createPropertyAssignment(
              ts.factory.createStringLiteral(columnName),
              ts.factory.createObjectLiteralExpression([
                ts.factory.createPropertyAssignment(
                  'column',
                  info.column
                    ? ts.factory.createTrue()
                    : ts.factory.createFalse()
                ),
                ts.factory.createPropertyAssignment(
                  'storing',
                  info.storing
                    ? ts.factory.createTrue()
                    : ts.factory.createFalse()
                ),
                ts.factory.createPropertyAssignment(
                  'partial',
                  info.partial
                    ? ts.factory.createTrue()
                    : ts.factory.createFalse()
                ),
                ts.factory.createPropertyAssignment(
                  'requiredColumns',
                  ts.factory.createArrayLiteralExpression(
                    (info.requiredColumns || []).map((col) =>
                      ts.factory.createStringLiteral(col)
                    )
                  )
                ),
              ])
            )
          );
        });

        // Get only the index columns
        const indexColumns = Array.from(columnInfo.entries())
          .filter(([_, info]) => info.column)
          .map(([col, _]) => col);

        // Create index property
        indexProperties.push(
          ts.factory.createPropertyAssignment(
            ts.factory.createStringLiteral(indexName),
            ts.factory.createObjectLiteralExpression([
              ts.factory.createPropertyAssignment(
                'columns',
                ts.factory.createObjectLiteralExpression(columnProperties)
              ),
              ts.factory.createPropertyAssignment(
                'columnsOrder',
                ts.factory.createArrayLiteralExpression(
                  indexColumns.map((col) => ts.factory.createStringLiteral(col))
                )
              ),
              ts.factory.createPropertyAssignment(
                'minimumSufficientColumns',
                ts.factory.createArrayLiteralExpression(
                  indexColumns
                    .slice(0, 1)
                    .map((col) => ts.factory.createStringLiteral(col))
                )
              ),
              ts.factory.createPropertyAssignment(
                'unique',
                index.unique
                  ? ts.factory.createTrue()
                  : ts.factory.createFalse()
              ),
              // Only add predicate property if whereClause exists
              ...(index.whereClause
                ? [
                    ts.factory.createPropertyAssignment(
                      ts.factory.createIdentifier('predicate'),
                      ts.factory.createStringLiteral(
                        (() => {
                          const sqlString = getAstNodeRepository(
                            index.whereClause._expression
                          ).writeSql(index.whereClause._expression, undefined);

                          return injectParameters(sqlString);
                        })()
                      )
                    ),
                  ]
                : []),
            ])
          )
        );
      }

      // Add table property
      properties.push(
        ts.factory.createPropertyAssignment(
          ts.factory.createStringLiteral(table.tableName),
          ts.factory.createObjectLiteralExpression(indexProperties)
        )
      );
    }

    return ts.factory.createObjectLiteralExpression(properties);
  }

  // Create source file
  const sourceFile = ts.factory.createSourceFile(
    statements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None
  );

  // Add file comment
  ts.addSyntheticLeadingComment(
    sourceFile,
    ts.SyntaxKind.MultiLineCommentTrivia,
    '* Generated by @slashfi/query-builder ',
    true
  );

  // Create printer
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
  });

  // Print the source file
  return printer.printNode(
    ts.EmitHint.SourceFile,
    sourceFile,
    ts.createSourceFile('types.d.ts', '', ts.ScriptTarget.Latest)
  );
}
