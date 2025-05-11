import type { __queryBuilderIndexes } from "@slashfi/query-builder";
declare module "@slashfi/query-builder" {
    interface __queryBuilderIndexes {
        "test_items": {
            "by_name": {
                columns: {
                    "name": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "name"
                ];
                minimumSufficientColumns: [
                    "name"
                ];
                unique: true;
                predicate?: undefined;
            };
            "by_status_strict": {
                columns: {
                    "status": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "status"
                ];
                minimumSufficientColumns: [
                    "status"
                ];
                unique: false;
                predicate?: undefined;
            };
            "by_count_name": {
                columns: {
                    "count": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                    "name": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                            "count"
                        ];
                    };
                    "status": {
                        column: false;
                        storing: true;
                        partial: false;
                        requiredColumns: [
                            "count"
                        ];
                    };
                };
                columnsOrder: [
                    "count",
                    "name"
                ];
                minimumSufficientColumns: [
                    "count"
                ];
                unique: false;
                predicate?: undefined;
            };
            "by_non_null_count_with_name": {
                columns: {
                    "name": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                    "status": {
                        column: false;
                        storing: true;
                        partial: false;
                        requiredColumns: [
                            "name"
                        ];
                    };
                    "count": {
                        column: false;
                        storing: false;
                        partial: true;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "name"
                ];
                minimumSufficientColumns: [
                    "name"
                ];
                unique: false;
                predicate: string;
            };
        };
        "update_test": {
            "by_name": {
                columns: {
                    "name": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "name"
                ];
                minimumSufficientColumns: [
                    "name"
                ];
                unique: false;
                predicate?: undefined;
            };
            "by_status_strict": {
                columns: {
                    "status": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "status"
                ];
                minimumSufficientColumns: [
                    "status"
                ];
                unique: false;
                predicate?: undefined;
            };
            "by_id": {
                columns: {
                    "id": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "id"
                ];
                minimumSufficientColumns: [
                    "id"
                ];
                unique: true;
                predicate?: undefined;
            };
            "by_name_status_strict": {
                columns: {
                    "name": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                    "status": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                            "name"
                        ];
                    };
                };
                columnsOrder: [
                    "name",
                    "status"
                ];
                minimumSufficientColumns: [
                    "name"
                ];
                unique: false;
                predicate?: undefined;
            };
            "by_count_name": {
                columns: {
                    "count": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                    "name": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                            "count"
                        ];
                    };
                    "tags": {
                        column: false;
                        storing: true;
                        partial: false;
                        requiredColumns: [
                            "count"
                        ];
                    };
                };
                columnsOrder: [
                    "count",
                    "name"
                ];
                minimumSufficientColumns: [
                    "count"
                ];
                unique: false;
                predicate?: undefined;
            };
            "by_non_zero_count_with_name": {
                columns: {
                    "name": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                    "count": {
                        column: false;
                        storing: true;
                        partial: true;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "name"
                ];
                minimumSufficientColumns: [
                    "name"
                ];
                unique: false;
                predicate: string;
            };
        };
        "test_schema": {
            "stringField_idx": {
                columns: {
                    "stringField": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "stringField"
                ];
                minimumSufficientColumns: [
                    "stringField"
                ];
                unique: false;
                predicate?: undefined;
            };
            "number_string_idx": {
                columns: {
                    "numberField": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                    "stringField": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                            "numberField"
                        ];
                    };
                    "nullableString": {
                        column: false;
                        storing: true;
                        partial: false;
                        requiredColumns: [
                            "numberField"
                        ];
                    };
                };
                columnsOrder: [
                    "numberField",
                    "stringField"
                ];
                minimumSufficientColumns: [
                    "numberField"
                ];
                unique: false;
                predicate?: undefined;
            };
            "bool_idx": {
                columns: {
                    "nullableBoolean": {
                        column: true;
                        storing: false;
                        partial: true;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "nullableBoolean"
                ];
                minimumSufficientColumns: [
                    "nullableBoolean"
                ];
                unique: false;
                predicate: string;
            };
        };
        "thenable_test": {
            "by_name": {
                columns: {
                    "name": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "name"
                ];
                minimumSufficientColumns: [
                    "name"
                ];
                unique: false;
                predicate?: undefined;
            };
            "by_status_strict": {
                columns: {
                    "status": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "status"
                ];
                minimumSufficientColumns: [
                    "status"
                ];
                unique: false;
                predicate?: undefined;
            };
            "by_id": {
                columns: {
                    "id": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                };
                columnsOrder: [
                    "id"
                ];
                minimumSufficientColumns: [
                    "id"
                ];
                unique: true;
                predicate?: undefined;
            };
            "by_name_status_strict": {
                columns: {
                    "name": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                    "status": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                            "name"
                        ];
                    };
                };
                columnsOrder: [
                    "name",
                    "status"
                ];
                minimumSufficientColumns: [
                    "name"
                ];
                unique: false;
                predicate?: undefined;
            };
            "by_count_name": {
                columns: {
                    "count": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                        ];
                    };
                    "name": {
                        column: true;
                        storing: false;
                        partial: false;
                        requiredColumns: [
                            "count"
                        ];
                    };
                    "tags": {
                        column: false;
                        storing: true;
                        partial: false;
                        requiredColumns: [
                            "count"
                        ];
                    };
                };
                columnsOrder: [
                    "count",
                    "name"
                ];
                minimumSufficientColumns: [
                    "count"
                ];
                unique: false;
                predicate?: undefined;
            };
        };
    }
}
export const queryBuilderIndexes: __queryBuilderIndexes = { "test_items": { "by_name": { columns: { "name": { column: true, storing: false, partial: false, requiredColumns: [] } }, columnsOrder: ["name"], minimumSufficientColumns: ["name"], unique: true }, "by_status_strict": { columns: { "status": { column: true, storing: false, partial: false, requiredColumns: [] } }, columnsOrder: ["status"], minimumSufficientColumns: ["status"], unique: false }, "by_count_name": { columns: { "count": { column: true, storing: false, partial: false, requiredColumns: [] }, "name": { column: true, storing: false, partial: false, requiredColumns: ["count"] }, "status": { column: false, storing: true, partial: false, requiredColumns: ["count"] } }, columnsOrder: ["count", "name"], minimumSufficientColumns: ["count"], unique: false }, "by_non_null_count_with_name": { columns: { "name": { column: true, storing: false, partial: false, requiredColumns: [] }, "status": { column: false, storing: true, partial: false, requiredColumns: ["name"] }, "count": { column: false, storing: false, partial: true, requiredColumns: [] } }, columnsOrder: ["name"], minimumSufficientColumns: ["name"], unique: false, predicate: "\"count\" IS NOT NULL" } }, "update_test": { "by_name": { columns: { "name": { column: true, storing: false, partial: false, requiredColumns: [] } }, columnsOrder: ["name"], minimumSufficientColumns: ["name"], unique: false }, "by_status_strict": { columns: { "status": { column: true, storing: false, partial: false, requiredColumns: [] } }, columnsOrder: ["status"], minimumSufficientColumns: ["status"], unique: false }, "by_id": { columns: { "id": { column: true, storing: false, partial: false, requiredColumns: [] } }, columnsOrder: ["id"], minimumSufficientColumns: ["id"], unique: true }, "by_name_status_strict": { columns: { "name": { column: true, storing: false, partial: false, requiredColumns: [] }, "status": { column: true, storing: false, partial: false, requiredColumns: ["name"] } }, columnsOrder: ["name", "status"], minimumSufficientColumns: ["name"], unique: false }, "by_count_name": { columns: { "count": { column: true, storing: false, partial: false, requiredColumns: [] }, "name": { column: true, storing: false, partial: false, requiredColumns: ["count"] }, "tags": { column: false, storing: true, partial: false, requiredColumns: ["count"] } }, columnsOrder: ["count", "name"], minimumSufficientColumns: ["count"], unique: false }, "by_non_zero_count_with_name": { columns: { "name": { column: true, storing: false, partial: false, requiredColumns: [] }, "count": { column: false, storing: true, partial: true, requiredColumns: [] } }, columnsOrder: ["name"], minimumSufficientColumns: ["name"], unique: false, predicate: "\"count\" != 0" } }, "test_schema": { "stringField_idx": { columns: { "stringField": { column: true, storing: false, partial: false, requiredColumns: [] } }, columnsOrder: ["stringField"], minimumSufficientColumns: ["stringField"], unique: false }, "number_string_idx": { columns: { "numberField": { column: true, storing: false, partial: false, requiredColumns: [] }, "stringField": { column: true, storing: false, partial: false, requiredColumns: ["numberField"] }, "nullableString": { column: false, storing: true, partial: false, requiredColumns: ["numberField"] } }, columnsOrder: ["numberField", "stringField"], minimumSufficientColumns: ["numberField"], unique: false }, "bool_idx": { columns: { "nullableBoolean": { column: true, storing: false, partial: true, requiredColumns: [] } }, columnsOrder: ["nullableBoolean"], minimumSufficientColumns: ["nullableBoolean"], unique: false, predicate: "\"nullableBoolean\" IS NOT NULL" } }, "thenable_test": { "by_name": { columns: { "name": { column: true, storing: false, partial: false, requiredColumns: [] } }, columnsOrder: ["name"], minimumSufficientColumns: ["name"], unique: false }, "by_status_strict": { columns: { "status": { column: true, storing: false, partial: false, requiredColumns: [] } }, columnsOrder: ["status"], minimumSufficientColumns: ["status"], unique: false }, "by_id": { columns: { "id": { column: true, storing: false, partial: false, requiredColumns: [] } }, columnsOrder: ["id"], minimumSufficientColumns: ["id"], unique: true }, "by_name_status_strict": { columns: { "name": { column: true, storing: false, partial: false, requiredColumns: [] }, "status": { column: true, storing: false, partial: false, requiredColumns: ["name"] } }, columnsOrder: ["name", "status"], minimumSufficientColumns: ["name"], unique: false }, "by_count_name": { columns: { "count": { column: true, storing: false, partial: false, requiredColumns: [] }, "name": { column: true, storing: false, partial: false, requiredColumns: ["count"] }, "tags": { column: false, storing: true, partial: false, requiredColumns: ["count"] } }, columnsOrder: ["count", "name"], minimumSufficientColumns: ["count"], unique: false } } };
