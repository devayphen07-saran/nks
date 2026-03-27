// This folder contains only pgEnum definitions — no table with FKs to relate.
// Relations are implicitly declared on the tables that reference these enums
// (e.g. audit_logs.action uses auditActionTypeEnum).
// No Drizzle `relations()` object is needed here.
export {};
