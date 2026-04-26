// taxAgencyFk is resolved at runtime after agency insert
export default [
  { code: 'GST',   taxName: 'Goods and Services Tax',                 description: 'Combined rate applied at the product level.',                        isSystem: true },
  { code: 'CGST',  taxName: 'Central Goods and Services Tax',         description: 'Central component — collected by the central government.',           isSystem: true },
  { code: 'SGST',  taxName: 'State Goods and Services Tax',           description: 'State component — applies to intra-state transactions.',              isSystem: true },
  { code: 'IGST',  taxName: 'Integrated Goods and Services Tax',      description: 'Applies to inter-state transactions. Equal to full GST rate.',       isSystem: true },
  { code: 'UTGST', taxName: 'Union Territory Goods and Services Tax', description: 'Applies to UTs without legislature (e.g., Ladakh).',                 isSystem: true },
];
