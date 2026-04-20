export default [
  {
    code: 'INCOMPLETE',
    name: 'Incomplete',
    description: 'Subscription setup incomplete',
    fontColor: '#6B7280', bgColor: '#F3F4F6', borderColor: '#D1D5DB',
    isBold: false, sortOrder: 1, isSystem: true,
  },
  {
    code: 'TRIALING',
    name: 'Trialing',
    description: 'In trial period',
    fontColor: '#2563EB', bgColor: '#DBEAFE', borderColor: '#93C5FD',
    isBold: false, sortOrder: 2, isSystem: true,
  },
  {
    code: 'ACTIVE',
    name: 'Active',
    description: 'Subscription is active',
    fontColor: '#FFFFFF', bgColor: '#10B981', borderColor: '#059669',
    isBold: true, sortOrder: 3, isSystem: true,
  },
  {
    code: 'PAST_DUE',
    name: 'Past Due',
    description: 'Payment is overdue',
    fontColor: '#FFFFFF', bgColor: '#F59E0B', borderColor: '#D97706',
    isBold: true, sortOrder: 4, isSystem: true,
  },
  {
    code: 'UNPAID',
    name: 'Unpaid',
    description: 'Subscription canceled due to non-payment',
    fontColor: '#FFFFFF', bgColor: '#EF4444', borderColor: '#DC2626',
    isBold: true, sortOrder: 5, isSystem: true,
  },
  {
    code: 'CANCELED',
    name: 'Canceled',
    description: 'Subscription has been canceled',
    fontColor: '#6B7280', bgColor: '#E5E7EB', borderColor: '#9CA3AF',
    isBold: false, sortOrder: 6, isSystem: true,
  },
];
