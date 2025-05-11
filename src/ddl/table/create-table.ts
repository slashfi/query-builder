import { getSqlForColumnExpressionForDataType } from '../../migrations/columnExpressionForDataType';
import type { SqlString } from '../../sql-string';
import { sql } from '../../sql-string';
import type {
  ColumnConstraint,
  ColumnDefinition,
  StorageParameters,
  TableConstraint,
  TableDefinition,
} from './types';

function serializeColumnConstraint(constraint: ColumnConstraint): SqlString {
  switch (constraint.type) {
    case 'NOT NULL': {
      return sql`NOT NULL`;
    }
    case 'NULL': {
      return sql`NULL`;
    }
    case 'DEFAULT': {
      return sql`DEFAULT ${constraint.value === undefined ? sql`NULL` : sql.p(constraint.value)}`;
    }
    case 'UNIQUE': {
      return constraint.name
        ? sql`CONSTRAINT ${sql.column({ name: constraint.name })} UNIQUE`
        : sql`UNIQUE`;
    }
    case 'CHECK': {
      return constraint.name
        ? sql`CONSTRAINT ${sql.column({ name: constraint.name })} CHECK (${constraint.value === undefined ? sql`NULL` : sql.p(constraint.value)})`
        : sql`CHECK (${constraint.value === undefined ? sql`NULL` : sql.p(constraint.value)})`;
    }
    case 'PRIMARY KEY': {
      return constraint.name
        ? sql`CONSTRAINT ${sql.column({ name: constraint.name })} PRIMARY KEY`
        : sql`PRIMARY KEY`;
    }
    case 'REFERENCES': {
      return sql`REFERENCES ${constraint.value === undefined ? sql`NULL` : sql.p(constraint.value)}`;
    }
    default: {
      throw new Error(
        `Unknown column constraint type: ${(constraint as ColumnConstraint).type}`
      );
    }
  }
}

function serializeColumnDefinition(column: ColumnDefinition): SqlString {
  const parts = [
    sql.column({ name: column.name }),
    getSqlForColumnExpressionForDataType(column.dataType, {
      defaultValue: column.default,
    }),
  ];

  if (column.constraints?.length) {
    parts.push(...column.constraints.map(serializeColumnConstraint));
  }

  return sql.join(parts, ' ');
}

function serializeTableConstraint(constraint: TableConstraint): SqlString {
  switch (constraint.type) {
    case 'PRIMARY KEY': {
      // Write PRIMARY KEY without CONSTRAINT prefix
      const columns = sql.join(
        constraint.columns.map((c) => sql.column({ name: c })),
        ', '
      );
      return sql`PRIMARY KEY (${columns})`;
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
      const refTable = sql.table({
        name: constraint.referenceTable,
        schema: constraint.referenceSchema,
      });

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
    default: {
      throw new Error(
        `Unknown table constraint type: ${(constraint as TableConstraint).type}`
      );
    }
  }
}

function serializeStorageParameters(params: StorageParameters): SqlString {
  const entries = Object.entries(params).map(([key, value]) => {
    if (typeof value === 'string') {
      return sql`${sql.rawIdentifier(key)} = ${sql.p(value)}`;
    }
    return sql`${sql.rawIdentifier(key)} = ${sql.p(value)}`;
  });
  return sql.join(entries, ', ');
}

export function createTable(definition: TableDefinition): SqlString {
  const sqlParts: SqlString[] = [sql`CREATE`];

  if (definition.temporary) {
    sqlParts.push(sql`TEMPORARY`);
  }

  sqlParts.push(sql`TABLE`);

  if (definition.ifNotExists) {
    sqlParts.push(sql`IF NOT EXISTS`);
  }

  sqlParts.push(
    sql.table({ name: definition.name, schema: definition.schema })
  );

  // Find primary key constraint
  const pkConstraint = definition.constraints?.find(
    (c) => c.type === 'PRIMARY KEY'
  );

  // Column and constraint definitions
  const tableElements: SqlString[] = [
    // Column definitions
    ...definition.columns.map(serializeColumnDefinition),
  ];

  // Add table constraints, but skip primary key if it will be defined in locality
  if (definition.constraints?.length) {
    const constraints = definition.constraints.filter((c) => {
      // Only filter out primary key if it will be defined in locality
      if (c.type === 'PRIMARY KEY' && definition.locality?.asPrimaryKey) {
        return false;
      }
      return true;
    });
    tableElements.push(...constraints.map(serializeTableConstraint));
  }

  sqlParts.push(sql`(\n  ${sql.join(tableElements, ',\n  ')}\n)`);

  // Storage parameters
  if (definition.storageParameters) {
    sqlParts.push(
      sql`WITH (${serializeStorageParameters(definition.storageParameters)})`
    );
  }

  // Table locality
  if (definition.locality) {
    const { type, region, asPrimaryKey } = definition.locality;
    let locality = sql`LOCALITY ${sql.p(type)}`;
    if (region) {
      locality = sql`${locality} IN ${sql.p(region)}`;
    }
    if (asPrimaryKey && pkConstraint) {
      const columns = sql.join(
        pkConstraint.columns.map((c) => sql.column({ name: c })),
        ', '
      );
      locality = sql`${locality} AS PRIMARY KEY (${columns})`;
    }
    sqlParts.push(locality);
  }

  // Partition by
  if (definition.partition) {
    const { type, columns, subpartition } = definition.partition;
    const partitionColumns = sql.join(
      columns.map((c) => sql.column({ name: c })),
      ', '
    );
    let partition = sql`PARTITION BY ${sql.p(type)} (${partitionColumns})`;

    if (subpartition) {
      const subpartitionColumns = sql.join(
        subpartition.columns.map((c) => sql.column({ name: c })),
        ', '
      );
      partition = sql`${partition} SUBPARTITION BY ${sql.p(subpartition.type)} (${subpartitionColumns})`;
    }
    sqlParts.push(partition);
  }

  // On commit clause for temporary tables
  if (definition.temporary && definition.onCommit) {
    sqlParts.push(sql`ON COMMIT ${sql.p(definition.onCommit)}`);
  }

  return sql.join(sqlParts, ' ');
}

export function createTableWithDownMigration(definition: TableDefinition): {
  up: SqlString;
  down: SqlString;
} {
  return {
    up: createTable(definition),
    down: sql`DROP TABLE ${sql.table({ schema: definition.schema, name: definition.name })} CASCADE`,
  };
}
