// Codes must match EntityCodes in src/common/constants/entity-codes.constants.ts

export default [
  // Platform administration
  { code: 'CODE_CATEGORY',   label: 'Code Category',   description: 'Code classification categories'              },
  { code: 'CODE_VALUE',      label: 'Code Value',       description: 'Code values within categories'              },
  { code: 'STATUS',          label: 'Status',           description: 'Status definitions (Active, Inactive, Pending)' },
  { code: 'LOOKUP',          label: 'Lookup',           description: 'Reference data (salutations, designations, etc.)' },
  { code: 'AUDIT_LOG',       label: 'Audit Log',        description: 'System audit trail'                         },
  { code: 'USER',            label: 'User',             description: 'User accounts'                              },
  { code: 'ENTITY_STATUS',   label: 'Entity Status',    description: 'Mapping between domain entities and allowed statuses' },
  { code: 'ROLE',            label: 'Role',             description: 'Role definitions and permissions'           },
  { code: 'ROUTE',           label: 'Route',            description: 'Application routes and navigation'          },
  { code: 'SYNC',            label: 'Sync',             description: 'Offline sync push operations'               },
  // Business domain
  { code: 'INVOICE',         label: 'Invoice',          description: 'Sales/Purchase invoices'                    },
  { code: 'PRODUCT',         label: 'Product',          description: 'Product master data'                        },
  { code: 'PURCHASE_ORDER',  label: 'Purchase Order',   description: 'Purchase orders'                            },
  { code: 'REPORT',          label: 'Report',           description: 'Business reports and analytics'             },
  { code: 'CUSTOMER',        label: 'Customer',         description: 'Customer records'                           },
  { code: 'VENDOR',          label: 'Vendor',           description: 'Vendor/Supplier records'                    },
  { code: 'INVENTORY',       label: 'Inventory',        description: 'Inventory and stock management'             },
  { code: 'TRANSACTION',     label: 'Transaction',      description: 'Sales/Purchase transactions'                },
  { code: 'PAYMENT',         label: 'Payment',          description: 'Payment records'                            },
];
