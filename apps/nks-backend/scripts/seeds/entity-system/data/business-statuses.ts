export default [
  // ─── Core lifecycle ────────────────────────────────────────────────────────
  { code: 'DRAFT',            name: 'Draft',            description: 'Not yet submitted',                  fontColor: '#374151', bgColor: '#F9FAFB', borderColor: '#D1D5DB', isBold: false, sortOrder: 1,  isSystem: true },
  { code: 'ACTIVE',           name: 'Active',           description: 'Record is active',                   fontColor: '#FFFFFF', bgColor: '#10B981', borderColor: '#059669', isBold: true,  sortOrder: 2,  isSystem: true },
  { code: 'INACTIVE',         name: 'Inactive',         description: 'Record is inactive',                 fontColor: '#6B7280', bgColor: '#F3F4F6', borderColor: '#D1D5DB', isBold: false, sortOrder: 3,  isSystem: true },
  { code: 'PENDING',          name: 'Pending',          description: 'Awaiting next action',               fontColor: '#92400E', bgColor: '#FEF3C7', borderColor: '#F59E0B', isBold: false, sortOrder: 4,  isSystem: true },

  // ─── Approval workflow ────────────────────────────────────────────────────
  { code: 'PENDING_APPROVAL', name: 'Pending Approval', description: 'Submitted, awaiting approval',       fontColor: '#92400E', bgColor: '#FFF4E6', borderColor: '#FFCC80', isBold: true,  sortOrder: 5,  isSystem: true },
  { code: 'APPROVED',         name: 'Approved',         description: 'Approved and ready to proceed',      fontColor: '#FFFFFF', bgColor: '#007BFF', borderColor: '#0056B3', isBold: true,  sortOrder: 6,  isSystem: true },
  { code: 'REJECTED',         name: 'Rejected',         description: 'Rejected — requires revision',       fontColor: '#FFFFFF', bgColor: '#EF4444', borderColor: '#DC2626', isBold: true,  sortOrder: 7,  isSystem: true },

  // ─── Progress / completion ────────────────────────────────────────────────
  { code: 'IN_PROGRESS',      name: 'In Progress',      description: 'Currently being processed',          fontColor: '#FFFFFF', bgColor: '#8B5CF6', borderColor: '#7C3AED', isBold: true,  sortOrder: 8,  isSystem: true },
  { code: 'COMPLETED',        name: 'Completed',        description: 'Successfully completed',             fontColor: '#FFFFFF', bgColor: '#10B981', borderColor: '#059669', isBold: true,  sortOrder: 9,  isSystem: true },
  { code: 'CANCELED',         name: 'Canceled',         description: 'Canceled — will not proceed',        fontColor: '#FFFFFF', bgColor: '#FF6347', borderColor: '#E60000', isBold: false, sortOrder: 10, isSystem: true },
  { code: 'CLOSED',           name: 'Closed',           description: 'Closed — no further action',         fontColor: '#6B7280', bgColor: '#F3F4F6', borderColor: '#9CA3AF', isBold: true,  sortOrder: 11, isSystem: true },

  // ─── Financial ────────────────────────────────────────────────────────────
  { code: 'PAID',             name: 'Paid',             description: 'Fully paid',                         fontColor: '#FFFFFF', bgColor: '#28A745', borderColor: '#1E7B34', isBold: true,  sortOrder: 12, isSystem: true },
  { code: 'PARTIALLY_PAID',   name: 'Partially Paid',   description: 'Partially paid — balance remaining', fontColor: '#92400E', bgColor: '#FFF5E6', borderColor: '#E67E22', isBold: true,  sortOrder: 13, isSystem: true },
  { code: 'OVERDUE',          name: 'Overdue',          description: 'Payment overdue',                    fontColor: '#FFFFFF', bgColor: '#C21807', borderColor: '#D9534F', isBold: true,  sortOrder: 14, isSystem: true },

  // ─── State / outcome ─────────────────────────────────────────────────────
  { code: 'VERIFIED',         name: 'Verified',         description: 'Identity or data verified',          fontColor: '#FFFFFF', bgColor: '#10B981', borderColor: '#059669', isBold: true,  sortOrder: 15, isSystem: true },
  { code: 'FAILED',           name: 'Failed',           description: 'Processing failed',                  fontColor: '#FFFFFF', bgColor: '#D9534F', borderColor: '#E60000', isBold: true,  sortOrder: 16, isSystem: true },
  { code: 'ARCHIVED',         name: 'Archived',         description: 'Moved to archive',                   fontColor: '#6B7280', bgColor: '#F3F4F6', borderColor: '#D1D5DB', isBold: false, sortOrder: 17, isSystem: true },
];
