import { getSqlForColumnExpressionForDataType } from '../../migrations/column-expression-for-data-type';
import type { SqlString } from '../../sql-string';
import { sql } from '../../sql-string';
import type {
  AddColumnAction,
  AddConstraintAction,
  AlterColumnAction,
  AlterPrimaryKeyAction,
  AlterTableAction,
  AlterTableDefinition,
  ColumnConstraint,
  DropColumnAction,
  DropConstraintAction,
  DropIndexAction,
  DropTableAction,
  TableConstraint,
} from './types';

function serializeConstraints(constraints: ColumnConstraint[]): SqlString[] {
  return constraints.map((c) => {
    switch (c.type) {
      case 'NOT NULL':
        return sql`NOT NULL`;
      case 'NULL':
        return sql`NULL`;
      case 'DEFAULT':
        return sql`DEFAULT ${c.value === undefined ? sql`NULL` : sql.p(c.value)}`;
      case 'UNIQUE':
        return c.name
          ? sql`CONSTRAINT ${sql.column({ name: c.name })} UNIQUE`
          : sql`UNIQUE`;
      case 'CHECK':
        return c.name
          ? sql`CONSTRAINT ${sql.column({ name: c.name })} CHECK (${sql.p(c.value || '')})`
          : sql`CHECK (${c.value === undefined ? sql`NULL` : sql.p(c.value)})`;
      case 'PRIMARY KEY':
        return c.name
          ? sql`CONSTRAINT ${sql.column({ name: c.name })} PRIMARY KEY`
          : sql`PRIMARY KEY`;
      case 'REFERENCES':
        return sql`REFERENCES ${c.value === undefined ? sql`NULL` : sql.p(c.value)}`;
      default:
        throw new Error(
          `Unknown column constraint type: ${(c as ColumnConstraint).type}`
        );
    }
  });
}

interface HandlerResult {
  up: SqlString;
  down: SqlString;
}

function serializeTableConstraint(constraint: TableConstraint): SqlString {
  switch (constraint.type) {
    case 'PRIMARY KEY': {
      const columns = sql.join(
        constraint.columns.map((c) => sql.column({ name: c })),
        ', '
      );
      return constraint.name
        ? sql`CONSTRAINT ${sql.column({ name: constraint.name })} PRIMARY KEY (${columns})`
        : sql`PRIMARY KEY (${columns})`;
    }
    case 'FOREIGN KEY': {
      const columns = sql.join(
        constraint.columns.map((c) => sql.column({ name: c })),
        ', '
      );
      const refColumns = sql.join(
        constraint.referenceColumns.map((c) => sql.column({ name: c })),
        ', '
      );
      const refTable = sql.table({ name: constraint.referenceTable });

      let result = constraint.name
        ? sql`CONSTRAINT ${sql.column({ name: constraint.name })} FOREIGN KEY (${columns}) REFERENCES ${refTable} (${refColumns})`
        : sql`FOREIGN KEY (${columns}) REFERENCES ${refTable} (${refColumns})`;

      if (constraint.actions) {
        if (constraint.actions.onDelete) {
          result = sql`${result} ON DELETE ${sql.p(constraint.actions.onDelete)}`;
        }
        if (constraint.actions.onUpdate) {
          result = sql`${result} ON UPDATE ${sql.p(constraint.actions.onUpdate)}`;
        }
      }
      return result;
    }
    case 'UNIQUE': {
      const columns = sql.join(
        constraint.columns.map((c) => sql.column({ name: c })),
        ', '
      );
      let result = constraint.name
        ? sql`CONSTRAINT ${sql.column({ name: constraint.name })} UNIQUE (${columns})`
        : sql`UNIQUE (${columns})`;

      if (constraint.nullsNotDistinct) {
        result = sql`${result} NULLS NOT DISTINCT`;
      }
      return result;
    }
    case 'CHECK': {
      return constraint.name
        ? sql`CONSTRAINT ${sql.column({ name: constraint.name })} CHECK (${sql.p(constraint.expression)})`
        : sql`CHECK (${sql.p(constraint.expression)})`;
    }
  }
}

// Individual action handlers
const handleAddColumn = (
  tableName: string,
  schema: string,
  action: AddColumnAction
): HandlerResult => {
  if (!action.columnDefinition) {
    throw new Error('Column definition required for ADD COLUMN action');
  }
  const colDef = action.columnDefinition;

  const parts = [
    sql`ALTER TABLE ${sql.table({ name: tableName, schema })} ADD COLUMN ${sql.column({ name: action.name })}`,
    getSqlForColumnExpressionForDataType(colDef.dataType, {
      defaultValue: colDef.default,
    }),
    ...(colDef.constraints?.length
      ? serializeConstraints(colDef.constraints)
      : []),
  ];

  return {
    up: sql.join(parts, ' '),
    down: sql`ALTER TABLE ${sql.table({ name: tableName, schema })} DROP COLUMN ${sql.column({ name: action.name })} CASCADE`,
  };
};

const handleDropColumn = (
  tableName: string,
  schema: string,
  action: DropColumnAction
): HandlerResult => {
  const downParts = [
    sql`ALTER TABLE ${sql.table({ name: tableName, schema })} ADD COLUMN ${sql.column({ name: action.name })}`,
  ];

  if (action.previousState) {
    downParts.push(
      getSqlForColumnExpressionForDataType(action.previousState.dataType, {
        defaultValue: action.previousState.default,
      })
    );
    if (action.previousState.constraints.length) {
      downParts.push(...serializeConstraints(action.previousState.constraints));
    }
  }

  return {
    up: sql`ALTER TABLE ${sql.table({ name: tableName, schema })} DROP COLUMN ${sql.column({ name: action.name })} CASCADE`,
    down: sql.join(downParts, ' '),
  };
};

const handleAlterColumn = (
  tableName: string,
  schema: string,
  action: AlterColumnAction
): HandlerResult => {
  if (!action.alterColumnAction) {
    throw new Error('Alter column action required for ALTER COLUMN action');
  }
  const { type, value } = action.alterColumnAction;
  const table = sql.table({ name: tableName, schema });
  const column = sql.column({ name: action.name });

  switch (type) {
    case 'SET DATA TYPE': {
      const dataType = value;
      const previousDataType = action.previousState?.dataType;
      if (!dataType || !previousDataType) {
        throw new Error(`Invalid data type: ${dataType}`);
      }
      return {
        up: sql`ALTER TABLE ${table} ALTER COLUMN ${column} SET DATA TYPE ${sql([dataType])}`,
        down: sql`ALTER TABLE ${table} ALTER COLUMN ${column} SET DATA TYPE ${sql([previousDataType])}`,
      };
    }
    case 'SET NOT NULL': {
      return {
        up: sql`ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL`,
        down: sql`ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL`,
      };
    }
    case 'DROP NOT NULL': {
      return {
        up: sql`ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL`,
        down: sql`ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL`,
      };
    }
    case 'SET DEFAULT': {
      return {
        up: sql`ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT (${value === undefined ? sql`NULL` : sql.p(value)})`,
        down: sql`ALTER TABLE ${table} ALTER COLUMN ${column} DROP DEFAULT`,
      };
    }
    case 'DROP DEFAULT': {
      return {
        up: sql`ALTER TABLE ${table} ALTER COLUMN ${column} DROP DEFAULT`,
        down: action.previousState?.default
          ? sql`ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT (${action.previousState.default})`
          : sql`ALTER TABLE ${table} ALTER COLUMN ${column} DROP DEFAULT`,
      };
    }
    default: {
      throw new Error(`Unknown alter column action type: ${type as string}`);
    }
  }
};

const handleAddConstraint = (
  tableName: string,
  schema: string,
  action: AddConstraintAction
): HandlerResult => {
  if (!action.constraint) {
    throw new Error('Constraint required for ADD CONSTRAINT action');
  }
  const table = sql.table({ name: tableName, schema });
  const parts = [sql`ALTER TABLE ${table} ADD`];

  if (action.name) {
    parts.push(sql`CONSTRAINT ${sql.column({ name: action.name })}`);
  }

  parts.push(sql`${serializeTableConstraint(action.constraint)}`);

  return {
    up: sql.join(parts, ' '),
    down: sql`ALTER TABLE ${table} DROP CONSTRAINT ${sql.column({ name: action.name })} CASCADE`,
  };
};

const handleDropConstraint = (
  tableName: string,
  schema: string,
  action: DropConstraintAction
): HandlerResult => {
  const table = sql.table({ name: tableName, schema });
  const downParts = [sql`ALTER TABLE ${table} ADD`];

  if (action.name) {
    downParts.push(sql`CONSTRAINT ${sql.column({ name: action.name })}`);
  }

  if (action.previousState) {
    downParts.push(serializeTableConstraint(action.previousState.constraint));
  }

  return {
    up: sql`ALTER TABLE ${table} DROP CONSTRAINT ${sql.column({ name: action.name })} CASCADE`,
    down: sql.join(downParts, ' '),
  };
};

const handleDropTable = (
  _tableName: string,
  _schema: string,
  action: DropTableAction
): HandlerResult => {
  const downParts = [sql`CREATE TABLE`];

  if (action.previousState) {
    const columnDefs = action.previousState.columns.map((col) => {
      const colParts = [
        sql.column({ name: col.name }),
        getSqlForColumnExpressionForDataType(col.dataType, {
          defaultValue: col.default,
        }),
      ];

      if (col.constraints?.length) {
        colParts.push(...serializeConstraints(col.constraints));
      }

      return sql.join(colParts, ' ');
    });

    const constraintDefs = action.previousState.constraints.map(
      (constraint) => {
        if (!constraint.name) {
          throw new Error(
            'Constraint name required for DROP CONSTRAINT action'
          );
        }
        const parts = [
          sql`CONSTRAINT`,
          sql.column({ name: constraint.name }),
          serializeTableConstraint(constraint),
        ];
        return sql.join(parts, ' ');
      }
    );

    const allDefs = [...columnDefs, ...constraintDefs];
    downParts.push(sql`(\n  ${sql.join(allDefs, ',\n  ')}\n)`);
  }

  return {
    up: sql`DROP TABLE CASCADE`,
    down: sql.join(downParts, ' '),
  };
};

const handleDropIndex = (
  tableName: string,
  schema: string,
  action: DropIndexAction
): HandlerResult => {
  const downParts = [sql`CREATE`];

  if (action.previousState) {
    if (action.previousState.unique) {
      downParts.push(sql`UNIQUE`);
    }

    downParts.push(sql`INDEX ${sql.column({ name: action.name })}`);
    downParts.push(sql`ON ${sql.table({ name: action.previousState.table })}`);

    const expressions = action.previousState.expressions.map((expr) =>
      sql([expr.getQuery()])
    );
    downParts.push(sql`(${sql.join(expressions, ', ')})`);
  }

  return {
    up: sql`DROP INDEX ${sql.table({ name: tableName, schema })}@${sql.column({ name: action.name })}`,
    down: sql.join(downParts, ' '),
  };
};

const handleAlterPrimaryKey = (
  tableName: string,
  schema: string,
  action: AlterPrimaryKeyAction
): HandlerResult => {
  const table = sql.table({ name: tableName, schema });
  const columns = sql.join(
    action.columns.map((c) => sql.column({ name: c })),
    ', '
  );
  const oldColumns = action.previousState?.columns
    ? sql.join(
        action.previousState.columns.map((c) => sql.column({ name: c })),
        ', '
      )
    : sql`rowid`;

  if (action.keepOldPrimaryKey) {
    // Use ALTER PRIMARY KEY which keeps old primary key as secondary index
    return {
      up: sql`ALTER TABLE ${table} ALTER PRIMARY KEY USING COLUMNS (${columns})`,
      down: sql`ALTER TABLE ${table} ALTER PRIMARY KEY USING COLUMNS (${oldColumns})`,
    };
  } else {
    // Use DROP/ADD CONSTRAINT approach which doesn't keep old primary key
    const upParts = [
      sql`ALTER TABLE ${table} DROP PRIMARY KEY CASCADE`,
      sql`ALTER TABLE ${table} ADD PRIMARY KEY (${columns})`,
    ];
    const downParts = [
      sql`ALTER TABLE ${table} DROP PRIMARY KEY CASCADE`,
      sql`ALTER TABLE ${table} ADD PRIMARY KEY (${oldColumns})`,
    ];

    return {
      up: sql.join(upParts, ';\n'),
      down: sql.join(downParts, ';\n'),
    };
  }
};

type ActionHandler<T extends AlterTableAction> = (
  tableName: string,
  schema: string,
  action: T
) => HandlerResult;

// Map of action types to their handlers
const actionHandlers: {
  [K in AlterTableAction['type']]: ActionHandler<
    Extract<AlterTableAction, { type: K }>
  >;
} = {
  'ADD COLUMN': handleAddColumn,
  'DROP COLUMN': handleDropColumn,
  'ALTER COLUMN': handleAlterColumn,
  'ADD CONSTRAINT': handleAddConstraint,
  'DROP CONSTRAINT': handleDropConstraint,
  'DROP TABLE': handleDropTable,
  'DROP INDEX': handleDropIndex,
  'ALTER PRIMARY KEY': handleAlterPrimaryKey,
};

function serializeAlterTableAction(
  tableName: string,
  schema: string,
  action: AlterTableAction
): HandlerResult {
  const handler = actionHandlers[action.type];
  if (!handler) {
    throw new Error(`Unknown action type: ${action.type}`);
  }
  return handler(tableName, schema, action as never);
}

export function alterTableWithDownMigration(
  definition: AlterTableDefinition
): Array<{ up: SqlString; down: SqlString }> {
  const migrations = definition.actions.map((action) => {
    const { up, down } = serializeAlterTableAction(
      definition.name,
      definition.schema,
      action
    );
    return {
      up: up,
      down: down,
    };
  });

  // Reverse the down migrations to maintain correct order
  migrations.forEach((migration, i) => {
    migration.down = migrations[migrations.length - 1 - i].down;
  });

  return migrations;
}
