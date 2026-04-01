import type { Db } from './types.js';
import { commodityCodes, country } from '../../src/core/database/schema';
import { eq } from 'drizzle-orm';

/**
 * India Commodity Codes (HSN - Harmonized System of Nomenclature)
 *
 * Covers primary goods across major categories:
 *   - Food & Agriculture (0201-0710)
 *   - Minerals & Chemicals (2506-2847)
 *   - Textiles (5008-6204)
 *   - Electronics (8471-8517)
 *   - Vehicles (8704-8711)
 *   - Services (SAC - 9950+)
 *
 * Each linked to default tax rate per commodity classification.
 * Stores can override rates in tax_rate_master for specific needs.
 *
 * Multi-country ready: Type field supports HSN (India), HS (international),
 * CN (EU), and other classification systems per jurisdiction.
 */
const commodityData = [
  // ─── Agricultural & Food ───────────────────────────────────────────
  { code: '0201', digits: '4' as const, type: 'HSN' as const, displayName: 'Beef', description: 'Meat of bovine animals, fresh or chilled', defaultTaxRate: '12' },
  { code: '0302', digits: '4' as const, type: 'HSN' as const, displayName: 'Fish', description: 'Fish, fresh or chilled (excluding fillets)', defaultTaxRate: '5' },
  { code: '0402', digits: '4' as const, type: 'HSN' as const, displayName: 'Milk', description: 'Milk and cream, concentrated or sweetened', defaultTaxRate: '12' },
  { code: '0511', digits: '4' as const, type: 'HSN' as const, displayName: 'Animal Products', description: 'Eggs of birds, in shell, fresh, preserved', defaultTaxRate: '5' },
  { code: '0703', digits: '4' as const, type: 'HSN' as const, displayName: 'Onions', description: 'Onions, shallots, garlic, leeks', defaultTaxRate: '5' },
  { code: '0709', digits: '4' as const, type: 'HSN' as const, displayName: 'Vegetables', description: 'Vegetables, fresh or chilled (other)', defaultTaxRate: '5' },
  { code: '0804', digits: '4' as const, type: 'HSN' as const, displayName: 'Dates', description: 'Dates, figs, pineapples, avocados, guavas', defaultTaxRate: '5' },
  { code: '0901', digits: '4' as const, type: 'HSN' as const, displayName: 'Coffee', description: 'Coffee, whether or not roasted or decaffeinated', defaultTaxRate: '5' },
  { code: '0902', digits: '4' as const, type: 'HSN' as const, displayName: 'Tea', description: 'Tea, whether or not flavoured', defaultTaxRate: '5' },
  { code: '1001', digits: '4' as const, type: 'HSN' as const, displayName: 'Wheat', description: 'Wheat and meslin', defaultTaxRate: '5' },
  { code: '1005', digits: '4' as const, type: 'HSN' as const, displayName: 'Rice', description: 'Maize (corn)', defaultTaxRate: '5' },
  { code: '1006', digits: '4' as const, type: 'HSN' as const, displayName: 'Rice', description: 'Rice', defaultTaxRate: '5' },
  { code: '1201', digits: '4' as const, type: 'HSN' as const, displayName: 'Soybeans', description: 'Soybeans, whether or not broken', defaultTaxRate: '0' },
  { code: '1404', digits: '4' as const, type: 'HSN' as const, displayName: 'Seaweed', description: 'Seaweed and other algae; sugar beet, sugar cane', defaultTaxRate: '5' },
  { code: '1507', digits: '4' as const, type: 'HSN' as const, displayName: 'Oil Seeds', description: 'Soya-bean oil and its fractions', defaultTaxRate: '5' },
  { code: '1512', digits: '4' as const, type: 'HSN' as const, displayName: 'Oil Seeds', description: 'Sunflower-seed, safflower or cotton-seed oil', defaultTaxRate: '5' },
  { code: '1701', digits: '4' as const, type: 'HSN' as const, displayName: 'Sugar', description: 'Cane or beet sugar and chemically pure sucrose', defaultTaxRate: '5' },
  { code: '1806', digits: '4' as const, type: 'HSN' as const, displayName: 'Chocolate', description: 'Chocolate and other food preparations', defaultTaxRate: '5' },
  { code: '1905', digits: '4' as const, type: 'HSN' as const, displayName: 'Bread', description: 'Bread, pastry, cakes, biscuits and other bakers wares', defaultTaxRate: '5' },

  // ─── Spices & Condiments ────────────────────────────────────────────
  { code: '0904', digits: '4' as const, type: 'HSN' as const, displayName: 'Pepper', description: 'Pepper of the genus Piper; dried berries', defaultTaxRate: '5' },
  { code: '0905', digits: '4' as const, type: 'HSN' as const, displayName: 'Vanilla', description: 'Vanilla', defaultTaxRate: '5' },
  { code: '0906', digits: '4' as const, type: 'HSN' as const, displayName: 'Cinnamon', description: 'Cinnamon and cinnamon-tree flowers', defaultTaxRate: '5' },
  { code: '0907', digits: '4' as const, type: 'HSN' as const, displayName: 'Cloves', description: 'Cloves, whole fruit', defaultTaxRate: '5' },
  { code: '0908', digits: '4' as const, type: 'HSN' as const, displayName: 'Nutmeg', description: 'Nutmeg, mace and cardamom', defaultTaxRate: '5' },
  { code: '0910', digits: '4' as const, type: 'HSN' as const, displayName: 'Spices', description: 'Ginger, saffron, turmeric (curcuma), thyme, bay leaves', defaultTaxRate: '5' },

  // ─── Minerals & Chemicals ──────────────────────────────────────────
  { code: '2506', digits: '4' as const, type: 'HSN' as const, displayName: 'Quartz Sand', description: 'Quartz and quartzite, whether or not roughly trimmed', defaultTaxRate: '5' },
  { code: '2530', digits: '4' as const, type: 'HSN' as const, displayName: 'Mineral Salts', description: 'Mineral salts; sulfurous earth; other mineral substances', defaultTaxRate: '5' },
  { code: '2701', digits: '4' as const, type: 'HSN' as const, displayName: 'Coal', description: 'Coal; briquettes, ovoids and similar solid fuels', defaultTaxRate: '5' },
  { code: '2707', digits: '4' as const, type: 'HSN' as const, displayName: 'Coal Tar', description: 'Oils and other products of coal tar distillation', defaultTaxRate: '18' },
  { code: '2801', digits: '4' as const, type: 'HSN' as const, displayName: 'Chlorine', description: 'Chlorine; bromine', defaultTaxRate: '5' },
  { code: '2802', digits: '4' as const, type: 'HSN' as const, displayName: 'Sulfur', description: 'Sulfur, sublimed or precipitated', defaultTaxRate: '5' },
  { code: '2810', digits: '4' as const, type: 'HSN' as const, displayName: 'Phosphorus', description: 'Phosphine (phosphorus trihydride) and other inorganic compounds', defaultTaxRate: '5' },
  { code: '2847', digits: '4' as const, type: 'HSN' as const, displayName: 'Hydrogen Peroxide', description: 'Hydrogen peroxide, whether or not solidified with urea', defaultTaxRate: '5' },

  // ─── Metals & Alloys ───────────────────────────────────────────────
  { code: '7102', digits: '4' as const, type: 'HSN' as const, displayName: 'Diamonds', description: 'Diamonds (whether or not worked) but not mounted or set', defaultTaxRate: '0' },
  { code: '7108', digits: '4' as const, type: 'HSN' as const, displayName: 'Gold', description: 'Gold (including gold plated with platinum), unwrought form', defaultTaxRate: '3' },
  { code: '7110', digits: '4' as const, type: 'HSN' as const, displayName: 'Platinum', description: 'Platinum, unwrought or in powder form; waste and scrap', defaultTaxRate: '3' },
  { code: '7204', digits: '4' as const, type: 'HSN' as const, displayName: 'Iron & Steel Waste', description: 'Ferrous waste and scrap; remelting scrap ingots of iron or steel', defaultTaxRate: '5' },
  { code: '7208', digits: '4' as const, type: 'HSN' as const, displayName: 'Iron Plates', description: 'Flat-rolled products of iron or non-alloy steel, hot rolled', defaultTaxRate: '5' },
  { code: '7326', digits: '4' as const, type: 'HSN' as const, displayName: 'Iron Articles', description: 'Articles of iron or steel, not elsewhere specified or included', defaultTaxRate: '12' },

  // ─── Textiles ──────────────────────────────────────────────────────
  { code: '5008', digits: '4' as const, type: 'HSN' as const, displayName: 'Silk', description: 'Silk yarn (not sewing thread) and yarn spun from silk waste', defaultTaxRate: '5' },
  { code: '5109', digits: '4' as const, type: 'HSN' as const, displayName: 'Wool Yarn', description: 'Yarn of wool, not put up for retail sale', defaultTaxRate: '5' },
  { code: '5209', digits: '4' as const, type: 'HSN' as const, displayName: 'Cotton Fabric', description: 'Woven fabrics of cotton, other', defaultTaxRate: '5' },
  { code: '6001', digits: '4' as const, type: 'HSN' as const, displayName: 'Knit Fabric', description: 'Pile fabrics and similar terry fabrics, of cotton', defaultTaxRate: '5' },
  { code: '6201', digits: '4' as const, type: 'HSN' as const, displayName: 'Men Clothing', description: 'Men or boys overcoats, cardigans, windcheaters etc', defaultTaxRate: '5' },
  { code: '6204', digits: '4' as const, type: 'HSN' as const, displayName: 'Women Clothing', description: 'Women or girls dresses, skirts, trousers, dungarees, etc', defaultTaxRate: '5' },
  { code: '6502', digits: '4' as const, type: 'HSN' as const, displayName: 'Hats', description: 'Hat-forms, hat bodies and hoods of felt; blocks for milliners', defaultTaxRate: '12' },

  // ─── Footwear ─────────────────────────────────────────────────────
  { code: '6401', digits: '4' as const, type: 'HSN' as const, displayName: 'Waterproof Footwear', description: 'Waterproof footwear with outer soles and uppers of rubber or plastic', defaultTaxRate: '5' },
  { code: '6402', digits: '4' as const, type: 'HSN' as const, displayName: 'Sports Footwear', description: 'Other footwear with outer soles and uppers of rubber or plastic', defaultTaxRate: '5' },
  { code: '6403', digits: '4' as const, type: 'HSN' as const, displayName: 'Leather Footwear', description: 'Footwear with outer soles of rubber, plastic, leather and uppers of leather', defaultTaxRate: '5' },

  // ─── Ceramics & Glass ─────────────────────────────────────────────
  { code: '6907', digits: '4' as const, type: 'HSN' as const, displayName: 'Tiles', description: 'Tiles and flags, having a glazed surface', defaultTaxRate: '12' },
  { code: '7007', digits: '4' as const, type: 'HSN' as const, displayName: 'Glass', description: 'Toughened (tempered) glass', defaultTaxRate: '12' },
  { code: '7010', digits: '4' as const, type: 'HSN' as const, displayName: 'Glass Bottles', description: 'Carboys, bottles, flasks, jars, pots, vials, ampules etc of glass', defaultTaxRate: '12' },

  // ─── Electronics & Electrical ──────────────────────────────────────
  { code: '8471', digits: '4' as const, type: 'HSN' as const, displayName: 'Computers', description: 'Automatic data processing machines and units thereof', defaultTaxRate: '5' },
  { code: '8517', digits: '4' as const, type: 'HSN' as const, displayName: 'Telecom Equipment', description: 'Telephone sets, including smartphones; other apparatus for transmission etc', defaultTaxRate: '5' },
  { code: '8527', digits: '4' as const, type: 'HSN' as const, displayName: 'Radio & TV', description: 'Reception apparatus for radio broadcasting, whether or not combined', defaultTaxRate: '18' },
  { code: '8708', digits: '4' as const, type: 'HSN' as const, displayName: 'Vehicle Parts', description: 'Parts and accessories of the motor vehicles', defaultTaxRate: '18' },

  // ─── Vehicles ──────────────────────────────────────────────────────
  { code: '8704', digits: '4' as const, type: 'HSN' as const, displayName: 'Commercial Vehicles', description: 'Motor vehicles for the transport of goods', defaultTaxRate: '28' },
  { code: '8711', digits: '4' as const, type: 'HSN' as const, displayName: 'Motorcycles', description: 'Motorcycles (including mopeds) and cycles', defaultTaxRate: '28' },

  // ─── Machinery ────────────────────────────────────────────────────
  { code: '8425', digits: '4' as const, type: 'HSN' as const, displayName: 'Pulleys', description: 'Pulley tackle and hoists; winches and capstans', defaultTaxRate: '18' },
  { code: '8430', digits: '4' as const, type: 'HSN' as const, displayName: 'Earth Moving', description: 'Earth-moving machinery', defaultTaxRate: '28' },
  { code: '8470', digits: '4' as const, type: 'HSN' as const, displayName: 'Calculators', description: 'Calculating machines; accounting machines, cash registers', defaultTaxRate: '18' },

  // ─── Services (SAC) ────────────────────────────────────────────────
  { code: '9951', digits: '4' as const, type: 'SAC' as const, displayName: 'Accounting Services', description: 'Accounting, auditing and book keeping services', defaultTaxRate: '18' },
  { code: '9952', digits: '4' as const, type: 'SAC' as const, displayName: 'Legal Services', description: 'Legal and accounting consultancy services', defaultTaxRate: '18' },
  { code: '9954', digits: '4' as const, type: 'SAC' as const, displayName: 'IT Services', description: 'Information technology and related services', defaultTaxRate: '18' },
  { code: '9955', digits: '4' as const, type: 'SAC' as const, displayName: 'Telecom Services', description: 'Telecommunications services', defaultTaxRate: '18' },
  { code: '9957', digits: '4' as const, type: 'SAC' as const, displayName: 'Transportation', description: 'Transportation of goods and passengers, storage and warehousing services', defaultTaxRate: '5' },
  { code: '9960', digits: '4' as const, type: 'SAC' as const, displayName: 'Hotel Services', description: 'Accommodation services, food services and beverage provision services', defaultTaxRate: '5' },
];

export async function seedCommodityCodes(db: Db) {
  // Resolve India country ID
  const [india] = await db
    .select({ id: country.id })
    .from(country)
    .where(eq(country.isoCode2, 'IN'))
    .limit(1);

  if (!india) {
    throw new Error('seedCommodityCodes: India country not found. Run seedCountries first.');
  }

  // Add countryFk and type (HSN/SAC) to all commodity codes
  const data: Array<typeof commodityCodes.$inferInsert> = commodityData.map((c) => ({
    ...c,
    countryFk: india.id,
    isExempted: false,
  }));

  return db.insert(commodityCodes).values(data).onConflictDoNothing();
}
