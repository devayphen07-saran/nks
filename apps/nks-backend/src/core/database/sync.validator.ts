/**
 * SyncValidator — Simple utilities to validate sync write compliance.
 *
 * Use these helpers in tests or middleware to detect common Phase 6 violations:
 * - Version not incremented
 * - Audit fields missing
 * - Soft delete not applied
 */

/**
 * Validate that a row was created with sync columns.
 */
export function validateSyncCreate(row: any) {
  if (row.version !== 1) {
    throw new Error(
      `Sync CREATE violation: version should be 1, got ${row.version}`,
    );
  }
  if (row.createdByDevice !== null) {
    throw new Error(
      `Sync CREATE violation: createdByDevice should be null (web origin), got ${row.createdByDevice}`,
    );
  }
  if (!row.createdBy) {
    throw new Error(`Sync CREATE violation: createdBy not set`);
  }
  if (!row.modifiedBy) {
    throw new Error(`Sync CREATE violation: modifiedBy not set`);
  }
  if (!row.createdAt) {
    throw new Error(`Sync CREATE violation: createdAt not set`);
  }
  if (!row.updatedAt) {
    throw new Error(`Sync CREATE violation: updatedAt not set`);
  }
}

/**
 * Validate that a row was updated with version increment.
 */
export function validateSyncUpdate(prev: any, updated: any) {
  if (updated.version !== prev.version + 1) {
    throw new Error(
      `Sync UPDATE violation: version should be ${prev.version + 1}, got ${updated.version}`,
    );
  }
  if (!updated.modifiedBy) {
    throw new Error(`Sync UPDATE violation: modifiedBy not set`);
  }
  if (updated.updatedAt <= prev.updatedAt) {
    throw new Error(
      `Sync UPDATE violation: updatedAt should be newer, was ${prev.updatedAt}, now ${updated.updatedAt}`,
    );
  }
  // created_by and created_at should NOT change
  if (updated.createdBy !== prev.createdBy) {
    throw new Error(`Sync UPDATE violation: createdBy changed (should be immutable)`);
  }
  if (updated.createdAt !== prev.createdAt) {
    throw new Error(`Sync UPDATE violation: createdAt changed (should be immutable)`);
  }
}

/**
 * Validate that a row was soft deleted.
 */
export function validateSyncDelete(prev: any, deleted: any) {
  if (!deleted.deletedAt) {
    throw new Error(`Sync DELETE violation: deletedAt not set (hard delete forbidden)`);
  }
  if (!deleted.deletedBy) {
    throw new Error(`Sync DELETE violation: deletedBy not set`);
  }
  if (deleted.isActive !== false) {
    throw new Error(`Sync DELETE violation: isActive should be false`);
  }
  if (deleted.version !== prev.version + 1) {
    throw new Error(
      `Sync DELETE violation: version should be ${prev.version + 1}, got ${deleted.version}`,
    );
  }
  // Deletion is also an update, so modifiedBy and updatedAt should change
  if (!deleted.modifiedBy) {
    throw new Error(`Sync DELETE violation: modifiedBy not set`);
  }
  if (deleted.updatedAt <= prev.updatedAt) {
    throw new Error(`Sync DELETE violation: updatedAt should be newer`);
  }
}

/**
 * Validate that all required sync columns exist on a table.
 * Use this in schema tests to catch missing columns early.
 */
export function validateSyncTableSchema(tableDefinition: any) {
  const columns = Object.keys(tableDefinition);

  const required = [
    'version',
    'createdByDevice',
    'createdBy',
    'createdAt',
    'modifiedBy',
    'updatedAt',
    'deletedAt',
    'deletedBy',
    'isActive',
  ];

  const missing = required.filter((col) => !columns.includes(col));
  if (missing.length > 0) {
    throw new Error(
      `Sync table schema violation: missing columns: ${missing.join(', ')}`,
    );
  }
}
