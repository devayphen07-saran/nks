export default [
  { code: 'VIEW',    displayName: 'View',    description: 'Read access to a resource',          sortOrder: 1 },
  { code: 'CREATE',  displayName: 'Create',  description: 'Create new records',                 sortOrder: 2 },
  { code: 'EDIT',    displayName: 'Edit',    description: 'Modify existing records',             sortOrder: 3 },
  { code: 'DELETE',  displayName: 'Delete',  description: 'Remove records (soft or hard)',       sortOrder: 4 },
  { code: 'EXPORT',  displayName: 'Export',  description: 'Export data to CSV/PDF/Excel',        sortOrder: 5 },
  { code: 'APPROVE', displayName: 'Approve', description: 'Approve or reject workflows',         sortOrder: 6 },
  { code: 'ARCHIVE', displayName: 'Archive', description: 'Move records to archived state',      sortOrder: 7 },
];
