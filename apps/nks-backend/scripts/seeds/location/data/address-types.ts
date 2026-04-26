export default [
  { code: 'HOME',      label: 'Home',      description: 'Residential Address',    isShippingApplicable: true  },
  { code: 'OFFICE',    label: 'Office',    description: 'Business/Office Address', isShippingApplicable: true  },
  { code: 'BILLING',   label: 'Billing',   description: 'Billing Address',         isShippingApplicable: false },
  { code: 'SHIPPING',  label: 'Shipping',  description: 'Shipping Address',         isShippingApplicable: true  },
  { code: 'WAREHOUSE', label: 'Warehouse', description: 'Warehouse/Storage',        isShippingApplicable: true  },
  { code: 'FACTORY',   label: 'Factory',   description: 'Manufacturing Facility',   isShippingApplicable: false },
  { code: 'REGISTERED', label: 'Registered', description: 'Official registered business address', isShippingApplicable: false },
  { code: 'GST_ADDRESS', label: 'GST Address', description: 'GSTIN registered address',           isShippingApplicable: false },
  { code: 'OTHER',     label: 'Other',     description: 'Other Address Type',                     isShippingApplicable: true  },
];
