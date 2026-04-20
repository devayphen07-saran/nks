export const agencyData = [
  {
    code: 'GSTN',
    name: 'Goods and Services Tax Network',
    description: 'Indian central GST authority governing CGST, SGST, and IGST.',
    referenceUrl: 'https://www.gst.gov.in',
    isSystem: true,
  },
];

// taxAgencyFk is resolved at runtime after agency insert
export const taxNameData = [
  { code: 'GST',   taxName: 'Goods and Services Tax',                description: 'Combined rate applied at the product level.',                         isSystem: true },
  { code: 'CGST',  taxName: 'Central Goods and Services Tax',        description: 'Central component — collected by the central government.',            isSystem: true },
  { code: 'SGST',  taxName: 'State Goods and Services Tax',          description: 'State component — applies to intra-state transactions.',               isSystem: true },
  { code: 'IGST',  taxName: 'Integrated Goods and Services Tax',     description: 'Applies to inter-state transactions. Equal to full GST rate.',        isSystem: true },
  { code: 'UTGST', taxName: 'Union Territory Goods and Services Tax', description: 'Applies to UTs without legislature (e.g., Ladakh).',                 isSystem: true },
];

// taxNameFk (→GST) is resolved at runtime
export const taxLevelData = [
  { code: 'GST_0',    name: 'Nil Rate',           rate: '0',    description: 'Nil-rated goods — fresh produce, life-saving drugs.', isDefault: false, isSystem: true },
  { code: 'GST_0_25', name: 'Special Rate 0.25%', rate: '0.25', description: 'Cut and semi-polished stones.',                       isDefault: false, isSystem: true },
  { code: 'GST_3',    name: 'Special Rate 3%',    rate: '3',    description: 'Gold, silver, jewellery.',                            isDefault: false, isSystem: true },
  { code: 'GST_5',    name: 'Reduced Rate 5%',    rate: '5',    description: 'Essential goods — edible oil, sugar, tea, coffee.',   isDefault: false, isSystem: true },
  { code: 'GST_12',   name: 'Standard Rate 12%',  rate: '12',   description: 'Standard goods — ghee, butter, packaged foods.',      isDefault: false, isSystem: true },
  { code: 'GST_18',   name: 'Standard Rate 18%',  rate: '18',   description: 'Most services and manufactured goods.',               isDefault: true,  isSystem: true },
  { code: 'GST_40',   name: 'Sin Tax 40%',         rate: '40',   description: 'High-sin goods (Soda, Tobacco) — replaces 28% + Cess.', isDefault: false, isSystem: true },
];
