export default [
  { code: 'PENDING',  label: 'Pending',  description: 'Invitation sent, awaiting acceptance', isPending: true,  isTerminal: false },
  { code: 'ACCEPTED', label: 'Accepted', description: 'Invitation accepted, staff onboarded', isPending: false, isTerminal: true  },
  { code: 'REJECTED', label: 'Rejected', description: 'Invitation declined by the invitee',   isPending: false, isTerminal: true  },
  { code: 'REVOKED',  label: 'Revoked',  description: 'Invitation revoked by admin',           isPending: false, isTerminal: true  },
  { code: 'EXPIRED',  label: 'Expired',  description: 'Invitation link expired',               isPending: false, isTerminal: true  },
];
