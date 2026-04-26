// taxNameFk (→ GST) is resolved at runtime
export default [
  { code: 'GST_0',    name: 'Nil Rate',           rate: '0',    description: 'Nil-rated goods — fresh produce, life-saving drugs.', isDefault: false, isSystem: true },
  { code: 'GST_0_25', name: 'Special Rate 0.25%', rate: '0.25', description: 'Cut and semi-polished stones.',                       isDefault: false, isSystem: true },
  { code: 'GST_3',    name: 'Special Rate 3%',    rate: '3',    description: 'Gold, silver, jewellery.',                            isDefault: false, isSystem: true },
  { code: 'GST_5',    name: 'Reduced Rate 5%',    rate: '5',    description: 'Essential goods — edible oil, sugar, tea, coffee.',   isDefault: false, isSystem: true },
  { code: 'GST_12',   name: 'Standard Rate 12%',  rate: '12',   description: 'Standard goods — ghee, butter, packaged foods.',      isDefault: false, isSystem: true },
  { code: 'GST_18',   name: 'Standard Rate 18%',  rate: '18',   description: 'Most services and manufactured goods.',               isDefault: true,  isSystem: true },
  { code: 'GST_40',   name: 'Sin Tax 40%',         rate: '40',   description: 'High-sin goods (Soda, Tobacco) — replaces 28% + Cess.', isDefault: false, isSystem: true },
];
