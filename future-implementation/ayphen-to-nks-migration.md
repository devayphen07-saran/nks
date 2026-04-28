# Ayphen → NKS: Database Migration Reference

**Source:** Ayphen ERP (`/src/main/resources/db-scripts/`)
**Target:** NKS POS (NestJS + PostgreSQL, multi-tenant, India-first)
**Analyzed:** 2026-04-28
**Files Audited:**
- `ayphen-master-ddl.sql` — 4,559 lines
- `ayphen-master-transaction-ddl.sql` — 2,028 lines
- `ayphen-pms-ddl.sql` — 576 lines
- `ayphen-master-initial-data.sql` — 15,439 lines (seed data)
- `ayphen-account-codes-data.sql` — 893 lines (COA seed)
- `auth-migration.sql` — 90 lines

---

## Table of Contents

1. [Adaptation Rules](#1-adaptation-rules)
2. [Tier 1 — Must Migrate (Core POS Engine)](#2-tier-1--must-migrate-core-pos-engine)
   - [2.1 Products & Inventory](#21-products--inventory)
   - [2.2 Tax System](#22-tax-system)
   - [2.3 Chart of Accounts](#23-chart-of-accounts)
   - [2.4 Transaction Engine](#24-transaction-engine)
   - [2.5 Customer Management](#25-customer-management)
   - [2.6 Payment Methods](#26-payment-methods)
3. [Tier 2 — Recommended (Take Soon)](#3-tier-2--recommended-take-soon)
   - [3.1 Supplier & Purchasing](#31-supplier--purchasing)
   - [3.2 Staff & Teams](#32-staff--teams)
   - [3.3 Communication & Contacts](#33-communication--contacts)
   - [3.4 Files & Attachments](#34-files--attachments)
   - [3.5 Approvals & Workflows](#35-approvals--workflows)
   - [3.6 Store Configuration Settings](#36-store-configuration-settings)
   - [3.7 Staff Invitations](#37-staff-invitations)
   - [3.8 Product Bundles & Variants](#38-product-bundles--variants)
4. [Tier 3 — Optional (Later)](#4-tier-3--optional-later)
5. [Skip Entirely](#5-skip-entirely)
6. [Already in NKS — Do Not Re-create](#6-already-in-nks--do-not-re-create)
7. [Seed Data to Copy](#7-seed-data-to-copy)
8. [Implementation Order](#8-implementation-order)

---

## 1. Adaptation Rules

These rules apply when translating every Ayphen table into NKS. Read this section before touching any table.

### 1.1 Tenant Unit Renaming

| Ayphen column | NKS equivalent | Notes |
|---|---|---|
| `company_fk` | `store_id` | NKS uses `store` as the tenant unit |
| `company_location_fk` | `store_id` | Ayphen separates company from location; NKS treats each store as its own location |
| `application_fk` | _drop_ | Ayphen has a full application registry; NKS uses `routes` table instead |
| `application_entity_fk` | _drop_ | Same as above |

### 1.2 Soft Delete Pattern

Ayphen uses:
```sql
is_active BOOLEAN NOT NULL DEFAULT TRUE
```

NKS uses:
```sql
deleted_at TIMESTAMPTZ NULL
```

When migrating Ayphen tables, replace `is_active` with `deleted_at`. An `is_active` check in Ayphen becomes `deleted_at IS NULL` in NKS.

### 1.3 Audit Columns

Ayphen uses `created_by`, `modified_by` storing `BIGINT` user IDs.

NKS standard:
```sql
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
created_by  INTEGER REFERENCES users(id)
updated_by  INTEGER REFERENCES users(id)
```

### 1.4 Primary Keys

Ayphen uses `BIGSERIAL` integer PKs with a `guuid UUID` secondary column.

NKS uses `SERIAL` integer PK + `guuid UUID DEFAULT gen_random_uuid()` (consistent with existing NKS tables). Keep both — `guuid` is the public-facing key exposed in APIs.

### 1.5 Skip Columns

The following Ayphen columns exist purely for their multi-application architecture and have no equivalent in NKS. Drop them on all migrated tables:

- `application_fk`, `application_entity_fk`
- `is_system` (NKS handles system records via seed data flags)
- `is_hidden` (use `deleted_at` pattern instead)
- `is_movable`, `is_editable`, `is_deletable` (NKS enforces these via service layer)

---

## 2. Tier 1 — Must Migrate (Core POS Engine)

These tables are required before the first sale can be recorded. Implement in the order listed.

---

### 2.1 Products & Inventory

#### `products` — Product Master

```sql
CREATE TABLE products (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id              INTEGER NOT NULL REFERENCES stores(id),
  product_type_id       INTEGER NOT NULL REFERENCES product_type(id),
  product_category_id   INTEGER REFERENCES product_category(id),
  title                 VARCHAR(255) NOT NULL,
  product_ref_code      VARCHAR(100),
  description           TEXT,
  barcode               VARCHAR(100),
  hsn_scn_code          VARCHAR(20),          -- India: HSN code for GST
  is_barcoded           BOOLEAN NOT NULL DEFAULT FALSE,
  has_variant           BOOLEAN NOT NULL DEFAULT FALSE,
  is_digital            BOOLEAN NOT NULL DEFAULT FALSE,
  track_quantity        BOOLEAN NOT NULL DEFAULT TRUE,
  selling_price         NUMERIC(18,4) NOT NULL DEFAULT 0,
  profit_margin         NUMERIC(18,4),
  profit_margin_pct     NUMERIC(8,4),
  income_account_id     INTEGER REFERENCES accounts(id),
  inventory_account_id  INTEGER REFERENCES accounts(id),
  expense_account_id    INTEGER REFERENCES accounts(id),
  is_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id),
  updated_by            INTEGER REFERENCES users(id),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_products_store_id      ON products(store_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_barcode        ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_hsn_scn_code   ON products(hsn_scn_code) WHERE hsn_scn_code IS NOT NULL;
```

#### `product_type` — Product Type Classification

```sql
CREATE TABLE product_type (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(50) NOT NULL UNIQUE,
  title       VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ
);
```

**Seed data:**
```sql
INSERT INTO product_type (code, title, sort_order, is_system) VALUES
  ('GOODS',   'Goods',          1, TRUE),
  ('SERVICE', 'Service',        2, TRUE),
  ('DIGITAL', 'Digital',        3, TRUE),
  ('BUNDLE',  'Bundle/Combo',   4, FALSE);
```

#### `product_category` — Hierarchical Product Categories

```sql
CREATE TABLE product_category (
  id                        SERIAL PRIMARY KEY,
  guuid                     UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  name                      VARCHAR(100) NOT NULL,
  description               TEXT,
  parent_product_category_id INTEGER REFERENCES product_category(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                INTEGER REFERENCES users(id),
  deleted_at                TIMESTAMPTZ
);
```

#### `volumes` — Units of Measure

```sql
CREATE TABLE volumes (
  id                SERIAL PRIMARY KEY,
  code              VARCHAR(20) NOT NULL UNIQUE,
  volume            VARCHAR(50) NOT NULL,
  unit              VARCHAR(20) NOT NULL,
  next_item         VARCHAR(20),              -- next unit up (e.g. CASE above UNIT)
  next_item_unit    VARCHAR(20),
  conversion_factor NUMERIC(18,6) DEFAULT 1,  -- how many of this = 1 of next_item
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  is_system         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMPTZ
);
```

**Seed data:**
```sql
INSERT INTO volumes (code, volume, unit, conversion_factor, sort_order, is_default, is_system) VALUES
  ('UNIT',   'Unit',   'Unit',   1,    1, TRUE,  TRUE),
  ('PACK',   'Pack',   'Pack',   6,    2, FALSE, TRUE),
  ('CASE',   'Case',   'Case',   12,   3, FALSE, TRUE),
  ('KG',     'Kilogram','kg',    1,    4, FALSE, TRUE),
  ('GM',     'Gram',   'g',      0.001,5, FALSE, TRUE),
  ('LTR',    'Litre',  'L',      1,    6, FALSE, TRUE),
  ('ML',     'Millilitre','ml',  0.001,7, FALSE, TRUE),
  ('MTR',    'Metre',  'm',      1,    8, FALSE, TRUE),
  ('PCS',    'Pieces', 'pcs',    1,    9, FALSE, TRUE);
```

#### `case_quantities` — Multiple Packaging Units Per Product

```sql
CREATE TABLE case_quantities (
  id                        SERIAL PRIMARY KEY,
  guuid                     UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  product_id                INTEGER NOT NULL REFERENCES products(id),
  code                      VARCHAR(50) NOT NULL,
  case_quantity             NUMERIC(18,4) NOT NULL,
  case_code                 VARCHAR(50),
  recommended_selling_price NUMERIC(18,4),
  case_cost_price           NUMERIC(18,4),
  unit_cost_price           NUMERIC(18,4),
  is_default                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                INTEGER REFERENCES users(id),
  deleted_at                TIMESTAMPTZ,

  UNIQUE (product_id, code)
);
```

**Why this matters:** A single product (e.g., Soft Drink 250ml) can be sold as a single unit (₹20), a pack of 6 (₹110), or a case of 24 (₹420). Without `case_quantities`, every variant needs a separate product record — catalog bloat.

#### `storage_areas` — Physical Storage Zones Within a Store

```sql
CREATE TABLE storage_areas (
  id                SERIAL PRIMARY KEY,
  guuid             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id          INTEGER NOT NULL REFERENCES stores(id),
  stock_area_name   VARCHAR(100) NOT NULL,
  storage_type_code VARCHAR(50),              -- SHELF, BACKROOM, FRIDGE, FREEZER
  ambience_code     VARCHAR(50),              -- AMBIENT, CHILLED, FROZEN
  is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        INTEGER REFERENCES users(id),
  deleted_at        TIMESTAMPTZ
);
```

#### `product_locations` — Per-Store Product Configuration

```sql
CREATE TABLE product_locations (
  id                      SERIAL PRIMARY KEY,
  guuid                   UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  product_id              INTEGER NOT NULL REFERENCES products(id),
  store_id                INTEGER NOT NULL REFERENCES stores(id),
  default_storage_area_id INTEGER REFERENCES storage_areas(id),
  is_available            BOOLEAN NOT NULL DEFAULT TRUE,
  out_of_stock            BOOLEAN NOT NULL DEFAULT FALSE,
  min_stock_level         NUMERIC(18,4) DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by              INTEGER REFERENCES users(id),
  deleted_at              TIMESTAMPTZ,

  UNIQUE (product_id, store_id)
);
```

#### `product_storage` — Stock Quantity by Storage Area

```sql
CREATE TABLE product_storage (
  id                  SERIAL PRIMARY KEY,
  guuid               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  product_location_id INTEGER NOT NULL REFERENCES product_locations(id),
  storage_area_id     INTEGER NOT NULL REFERENCES storage_areas(id),
  stock_qty           NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          INTEGER REFERENCES users(id),
  deleted_at          TIMESTAMPTZ,

  UNIQUE (product_location_id, storage_area_id)
);
```

#### `inventory_balance` — Real-Time Stock Balances

```sql
CREATE TABLE inventory_balance (
  id                  SERIAL PRIMARY KEY,
  guuid               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id            INTEGER NOT NULL REFERENCES stores(id),
  product_id          INTEGER NOT NULL REFERENCES products(id),
  storage_area_id     INTEGER REFERENCES storage_areas(id),
  opening_qty         NUMERIC(18,4) NOT NULL DEFAULT 0,
  opening_value       NUMERIC(18,4) NOT NULL DEFAULT 0,
  inward_qty          NUMERIC(18,4) NOT NULL DEFAULT 0,
  inward_value        NUMERIC(18,4) NOT NULL DEFAULT 0,
  outward_qty         NUMERIC(18,4) NOT NULL DEFAULT 0,
  outward_value       NUMERIC(18,4) NOT NULL DEFAULT 0,
  closing_qty         NUMERIC(18,4) GENERATED ALWAYS AS (opening_qty + inward_qty - outward_qty) STORED,
  closing_value       NUMERIC(18,4) GENERATED ALWAYS AS (opening_value + inward_value - outward_value) STORED,
  valuation_method    VARCHAR(10) NOT NULL DEFAULT 'FIFO',  -- FIFO, LIFO, WAC
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (store_id, product_id, storage_area_id)
);

CREATE INDEX idx_inventory_balance_store_product ON inventory_balance(store_id, product_id);
```

#### `inventory_adjustment_sales` — Stock Deducted on Sale

```sql
CREATE TABLE inventory_adjustment_sales (
  id                  SERIAL PRIMARY KEY,
  guuid               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id            INTEGER NOT NULL REFERENCES stores(id),
  product_id          INTEGER NOT NULL REFERENCES products(id),
  transaction_item_id INTEGER NOT NULL REFERENCES transaction_items(id),
  quantity_sold       NUMERIC(18,4) NOT NULL,
  cost_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
  transaction_cost    NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          INTEGER REFERENCES users(id)
);
```

#### `inventory_adjustment_purchase` — Stock Added on Purchase

```sql
CREATE TABLE inventory_adjustment_purchase (
  id                  SERIAL PRIMARY KEY,
  guuid               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id            INTEGER NOT NULL REFERENCES stores(id),
  product_id          INTEGER NOT NULL REFERENCES products(id),
  transaction_item_id INTEGER NOT NULL REFERENCES transaction_items(id),
  quantity_received   NUMERIC(18,4) NOT NULL,
  cost_amount         NUMERIC(18,4) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          INTEGER REFERENCES users(id)
);
```

---

### 2.2 Tax System

This is the most complex subsystem Ayphen has solved well. India's GST structure (SGST + CGST + IGST + Cess) maps directly to this hierarchy.

```
tax_type (Direct/Indirect)
  └── tax (GST, VAT, Service Tax)
        └── tax_agency (Central GST Authority, State Tax Board)
              └── tax_level (National, State, Local)
                    └── tax_name (SGST, CGST, IGST, Cess)
                          └── tax_mapping (combines all above into one usable record)
                                └── tax_rate (actual %: 5, 12, 18, 28)
```

#### `tax_type`

```sql
CREATE TABLE tax_type (
  id          SERIAL PRIMARY KEY,
  tax_name    VARCHAR(100) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO tax_type (tax_name, sort_order, is_system) VALUES
  ('Indirect Tax', 1, TRUE),
  ('Direct Tax',   2, TRUE);
```

#### `tax`

```sql
CREATE TABLE tax (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) NOT NULL UNIQUE,
  tax_name    VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO tax (code, tax_name, sort_order, is_system) VALUES
  ('GST',     'Goods and Services Tax',  1, TRUE),
  ('VAT',     'Value Added Tax',         2, TRUE),
  ('SVC_TAX', 'Service Tax',             3, TRUE),
  ('CESS',    'Cess',                    4, TRUE);
```

#### `tax_level`

```sql
CREATE TABLE tax_level (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) NOT NULL UNIQUE,
  level_name  VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO tax_level (code, level_name, sort_order, is_system) VALUES
  ('NATIONAL', 'National/Central', 1, TRUE),
  ('STATE',    'State',            2, TRUE),
  ('LOCAL',    'Local/Municipal',  3, TRUE);
```

#### `tax_name`

```sql
CREATE TABLE tax_name (
  id                  SERIAL PRIMARY KEY,
  code                VARCHAR(20) NOT NULL UNIQUE,
  tax_name            VARCHAR(100) NOT NULL,
  description         TEXT,
  is_consumption_tax  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_system           BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at          TIMESTAMPTZ
);

INSERT INTO tax_name (code, tax_name, is_consumption_tax, sort_order, is_system) VALUES
  ('CGST', 'Central GST',        TRUE,  1, TRUE),
  ('SGST', 'State GST',          TRUE,  2, TRUE),
  ('IGST', 'Integrated GST',     TRUE,  3, TRUE),
  ('CESS', 'Cess',               FALSE, 4, TRUE),
  ('VAT',  'Value Added Tax',    TRUE,  5, TRUE);
```

#### `tax_agency`

```sql
CREATE TABLE tax_agency (
  id                  SERIAL PRIMARY KEY,
  code                VARCHAR(20) NOT NULL UNIQUE,
  agency_name         VARCHAR(150) NOT NULL,
  description         TEXT,
  country_id          INTEGER REFERENCES countries(id),
  is_consumption_tax  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_system           BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at          TIMESTAMPTZ
);

INSERT INTO tax_agency (code, agency_name, country_id, is_consumption_tax, sort_order, is_system)
SELECT 'CBIC', 'Central Board of Indirect Taxes and Customs', id, TRUE, 1, TRUE
FROM countries WHERE iso_code2 = 'IN';

INSERT INTO tax_agency (code, agency_name, country_id, is_consumption_tax, sort_order, is_system)
SELECT 'STATE_TAX_IN', 'State Tax Authority - India', id, TRUE, 2, TRUE
FROM countries WHERE iso_code2 = 'IN';
```

#### `tax_mapping`

```sql
CREATE TABLE tax_mapping (
  id              SERIAL PRIMARY KEY,
  guuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tax_agency_id   INTEGER NOT NULL REFERENCES tax_agency(id),
  tax_level_id    INTEGER NOT NULL REFERENCES tax_level(id),
  tax_name_id     INTEGER NOT NULL REFERENCES tax_name(id),
  tax_id          INTEGER NOT NULL REFERENCES tax(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
```

#### `tax_rate`

```sql
CREATE TABLE tax_rate (
  id              SERIAL PRIMARY KEY,
  guuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  code            VARCHAR(20) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  tax_mapping_id  INTEGER NOT NULL REFERENCES tax_mapping(id),
  tax_percentage  NUMERIC(8,4) NOT NULL,
  effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  tax_type_id     INTEGER REFERENCES tax_type(id),
  status_id       INTEGER REFERENCES statuses(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
```

**India GST rate seed data:**
```sql
-- These are inserted after tax_mapping records are created
-- GST slabs: 0%, 5%, 12%, 18%, 28%
-- CGST = SGST = half of GST slab
-- IGST = full GST slab

-- Example: GST 18% → CGST 9% + SGST 9%
INSERT INTO tax_rate (code, name, tax_mapping_id, tax_percentage, effective_date) VALUES
  ('CGST_9',  'CGST 9%',  <cgst_mapping_id>,  9.00, '2017-07-01'),
  ('SGST_9',  'SGST 9%',  <sgst_mapping_id>,  9.00, '2017-07-01'),
  ('IGST_18', 'IGST 18%', <igst_mapping_id>, 18.00, '2017-07-01'),
  ('CGST_6',  'CGST 6%',  <cgst_mapping_id>,  6.00, '2017-07-01'),
  ('SGST_6',  'SGST 6%',  <sgst_mapping_id>,  6.00, '2017-07-01'),
  ('IGST_12', 'IGST 12%', <igst_mapping_id>, 12.00, '2017-07-01'),
  ('CGST_2_5','CGST 2.5%',<cgst_mapping_id>,  2.50, '2017-07-01'),
  ('SGST_2_5','SGST 2.5%',<sgst_mapping_id>,  2.50, '2017-07-01'),
  ('IGST_5',  'IGST 5%',  <igst_mapping_id>,  5.00, '2017-07-01');
```

#### `country_tax_mapping`

```sql
CREATE TABLE country_tax_mapping (
  id              SERIAL PRIMARY KEY,
  guuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  country_id      INTEGER NOT NULL REFERENCES countries(id),
  tax_agency_id   INTEGER NOT NULL REFERENCES tax_agency(id),
  tax_name_id     INTEGER NOT NULL REFERENCES tax_name(id),
  tax_id          INTEGER NOT NULL REFERENCES tax(id),
  tax_level_id    INTEGER NOT NULL REFERENCES tax_level(id),
  tax_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
```

#### `product_tax` — Default Tax per Product

```sql
CREATE TABLE product_tax (
  id              SERIAL PRIMARY KEY,
  guuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  product_id      INTEGER NOT NULL REFERENCES products(id),
  tax_mapping_id  INTEGER NOT NULL REFERENCES tax_mapping(id),
  is_buyer_tax    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
```

---

### 2.3 Chart of Accounts

#### `mas_account_type` — System-Level Account Types

```sql
CREATE TABLE mas_account_type (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL UNIQUE,
  start_number INTEGER NOT NULL,
  digit_count  INTEGER NOT NULL DEFAULT 4,
  balance_type VARCHAR(10) NOT NULL CHECK (balance_type IN ('DEBIT', 'CREDIT')),
  statement    VARCHAR(30) NOT NULL CHECK (statement IN ('BALANCE_SHEET', 'INCOME_STATEMENT')),
  deleted_at   TIMESTAMPTZ
);

INSERT INTO mas_account_type (name, start_number, digit_count, balance_type, statement) VALUES
  ('Asset',     1000, 4, 'DEBIT',  'BALANCE_SHEET'),
  ('Liability', 2000, 4, 'CREDIT', 'BALANCE_SHEET'),
  ('Equity',    3000, 4, 'CREDIT', 'BALANCE_SHEET'),
  ('Revenue',   4000, 4, 'CREDIT', 'INCOME_STATEMENT'),
  ('Expense',   5000, 4, 'DEBIT',  'INCOME_STATEMENT');
```

#### `account_type` — Per-Store Account Types

```sql
CREATE TABLE account_type (
  id           SERIAL PRIMARY KEY,
  guuid        UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id     INTEGER NOT NULL REFERENCES stores(id),
  name         VARCHAR(100) NOT NULL,
  start_number INTEGER NOT NULL,
  digit_count  INTEGER NOT NULL DEFAULT 4,
  balance_type VARCHAR(10) NOT NULL CHECK (balance_type IN ('DEBIT', 'CREDIT')),
  statement    VARCHAR(30) NOT NULL CHECK (statement IN ('BALANCE_SHEET', 'INCOME_STATEMENT')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);
```

#### `account_codes` — Master Chart of Account Groups

```sql
CREATE TABLE account_codes (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  account_type_id       INTEGER NOT NULL REFERENCES account_type(id),
  parent_account_code_id INTEGER REFERENCES account_codes(id),
  code                  VARCHAR(10) NOT NULL,
  name                  VARCHAR(150) NOT NULL,
  description           TEXT,
  is_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,

  UNIQUE (account_type_id, code)
);
```

**Seed data from `ayphen-account-codes-data.sql`:**
```sql
-- Cash and Bank (CAB) → parent group
INSERT INTO account_codes (code, name) VALUES ('CAB', 'Cash and Bank');
  -- Cash (CAS)
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('CAS', 'Cash', <CAB_id>);
  -- Bank (BNK)
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('BNK', 'Bank', <CAB_id>);
  -- Undeposited Funds (UDF)
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('UDF', 'Undeposited Funds', <CAB_id>);

-- Current Assets (CRA)
INSERT INTO account_codes (code, name) VALUES ('CRA', 'Current Assets');
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('AR',  'Accounts Receivable', <CRA_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('INV', 'Inventory',           <CRA_id>);

-- Fixed Assets (FXA)
INSERT INTO account_codes (code, name) VALUES ('FXA', 'Fixed Assets');
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('PPE',  'Property, Plant & Equipment', <FXA_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('ADEP', 'Accumulated Depreciation',    <FXA_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('INTA', 'Intangibles',                 <FXA_id>);

-- Current Liabilities (CRL)
INSERT INTO account_codes (code, name) VALUES ('CRL', 'Current Liabilities');
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('AP',   'Accounts Payable',    <CRL_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('ARE',  'Accrued Expenses',    <CRL_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('CGST', 'CGST Payable',        <CRL_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('SGST', 'SGST Payable',        <CRL_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('IGST', 'IGST Payable',        <CRL_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('TDS',  'TDS Payable',         <CRL_id>);

-- Credit Cards and Loans (CCL)
INSERT INTO account_codes (code, name) VALUES ('CCL', 'Credit Cards and Loans');

-- Equity
INSERT INTO account_codes (code, name) VALUES ('EQT', 'Equity');
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('SRC', 'Share Capital',              <EQT_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('APC', 'Additional Paid-In Capital', <EQT_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('RE',  'Retained Earnings',          <EQT_id>);

-- Revenue
INSERT INTO account_codes (code, name) VALUES ('REV', 'Revenue');
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('SLS',  'Sales Revenue',    <REV_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('SRTN', 'Sales Returns',    <REV_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('DISC', 'Discounts',        <REV_id>);

-- Expenses
INSERT INTO account_codes (code, name) VALUES ('EXP', 'Expenses');
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('COGS', 'Cost of Goods Sold', <EXP_id>);
  INSERT INTO account_codes (code, name, parent_account_code_id) VALUES ('OPX',  'Operating Expenses', <EXP_id>);
```

#### `accounts` — Per-Store GL Accounts

```sql
CREATE TABLE accounts (
  id                  SERIAL PRIMARY KEY,
  guuid               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id            INTEGER NOT NULL REFERENCES stores(id),
  account_code_id     INTEGER NOT NULL REFERENCES account_codes(id),
  account_type_id     INTEGER NOT NULL REFERENCES account_type(id),
  parent_account_id   INTEGER REFERENCES accounts(id),
  name                VARCHAR(150) NOT NULL,
  description         TEXT,
  currency_id         INTEGER REFERENCES currencies(id),
  payment_method_id   INTEGER REFERENCES payment_methods(id),
  is_group            BOOLEAN NOT NULL DEFAULT FALSE,
  is_child_allowed    BOOLEAN NOT NULL DEFAULT TRUE,
  is_system_defined   BOOLEAN NOT NULL DEFAULT FALSE,
  is_watchlist        BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          INTEGER REFERENCES users(id),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_accounts_store_id      ON accounts(store_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_account_code  ON accounts(account_code_id);
```

#### `general_ledger` — Posted GL Entries

```sql
CREATE TABLE general_ledger (
  id              SERIAL PRIMARY KEY,
  guuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id        INTEGER NOT NULL REFERENCES stores(id),
  account_id      INTEGER NOT NULL REFERENCES accounts(id),
  transaction_id  INTEGER REFERENCES transactions(id),
  journal_id      INTEGER REFERENCES journals(id),
  posting_date    DATE NOT NULL,
  debit_amount    NUMERIC(18,4) NOT NULL DEFAULT 0,
  credit_amount   NUMERIC(18,4) NOT NULL DEFAULT 0,
  reference_number VARCHAR(50),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      INTEGER REFERENCES users(id)
);

CREATE INDEX idx_gl_store_account   ON general_ledger(store_id, account_id);
CREATE INDEX idx_gl_posting_date    ON general_ledger(posting_date);
CREATE INDEX idx_gl_transaction_id  ON general_ledger(transaction_id);
```

#### `journals` — Manual Journal Entries

```sql
CREATE TABLE journals (
  id              SERIAL PRIMARY KEY,
  guuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id        INTEGER NOT NULL REFERENCES stores(id),
  journal_number  VARCHAR(50) NOT NULL,
  journal_date    DATE NOT NULL,
  currency_id     INTEGER REFERENCES currencies(id),
  total_debit     NUMERIC(18,4) NOT NULL DEFAULT 0,
  total_credit    NUMERIC(18,4) NOT NULL DEFAULT 0,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      INTEGER REFERENCES users(id),
  deleted_at      TIMESTAMPTZ
);
```

---

### 2.4 Transaction Engine

The `transaction` table is the heart of all financial operations — sales invoices, purchase orders, credit notes, payment receipts, and refunds all live here, distinguished by `transaction_type`.

#### `transaction_types` — Lookup for Transaction Kinds

```sql
CREATE TABLE transaction_types (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO transaction_types (code, name, sort_order) VALUES
  ('SALES_INVOICE',   'Sales Invoice',       1),
  ('SALES_RETURN',    'Sales Return',        2),
  ('CASH_SALE',       'Cash Sale (POS)',     3),
  ('PURCHASE_ORDER',  'Purchase Order',      4),
  ('PURCHASE_BILL',   'Purchase Bill',       5),
  ('PURCHASE_RETURN', 'Purchase Return',     6),
  ('PAYMENT_IN',      'Payment Received',    7),
  ('PAYMENT_OUT',     'Payment Made',        8),
  ('CREDIT_NOTE',     'Credit Note',         9),
  ('DEBIT_NOTE',      'Debit Note',          10),
  ('JOURNAL',         'Manual Journal',      11);
```

#### `transactions` — Main Transaction Header

```sql
CREATE TABLE transactions (
  id                          SERIAL PRIMARY KEY,
  guuid                       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id                    INTEGER NOT NULL REFERENCES stores(id),
  transaction_type_id         INTEGER NOT NULL REFERENCES transaction_types(id),
  transaction_number          VARCHAR(50) NOT NULL,
  transaction_date            DATE NOT NULL,
  due_date                    DATE,
  reference_number            VARCHAR(100),
  customer_id                 INTEGER REFERENCES customers(id),
  supplier_id                 INTEGER REFERENCES suppliers(id),
  currency_id                 INTEGER REFERENCES currencies(id),
  exchange_rate               NUMERIC(18,8) NOT NULL DEFAULT 1,
  subtotal                    NUMERIC(18,4) NOT NULL DEFAULT 0,
  discount_amount             NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_amount                  NUMERIC(18,4) NOT NULL DEFAULT 0,
  rounding_adjustment         NUMERIC(18,4) NOT NULL DEFAULT 0,
  total_amount                NUMERIC(18,4) NOT NULL DEFAULT 0,
  paid_amount                 NUMERIC(18,4) NOT NULL DEFAULT 0,
  balance_due                 NUMERIC(18,4) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status_id                   INTEGER REFERENCES statuses(id),
  notes                       TEXT,
  is_recurring                BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked                   BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at                   TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                  INTEGER REFERENCES users(id),
  updated_by                  INTEGER REFERENCES users(id),
  deleted_at                  TIMESTAMPTZ,

  UNIQUE (store_id, transaction_number)
);

CREATE INDEX idx_transactions_store_id         ON transactions(store_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_customer_id      ON transactions(customer_id);
CREATE INDEX idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_status_id        ON transactions(status_id);
CREATE INDEX idx_transactions_type_id          ON transactions(transaction_type_id);
```

#### `transaction_items` — Line Items

```sql
CREATE TABLE transaction_items (
  id                  SERIAL PRIMARY KEY,
  guuid               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  transaction_id      INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id          INTEGER REFERENCES products(id),
  description         TEXT,
  quantity            NUMERIC(18,4) NOT NULL,
  unit_price          NUMERIC(18,4) NOT NULL,
  discount_type       VARCHAR(10) CHECK (discount_type IN ('PERCENT', 'AMOUNT')),
  discount_value      NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_mapping_id      INTEGER REFERENCES tax_mapping(id),
  tax_amount          NUMERIC(18,4) NOT NULL DEFAULT 0,
  line_amount         NUMERIC(18,4) NOT NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product_id     ON transaction_items(product_id);
```

#### `transaction_items_tax` — Per-Line Tax Breakdown (SGST/CGST/IGST separately)

```sql
CREATE TABLE transaction_items_tax (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  transaction_item_id   INTEGER NOT NULL REFERENCES transaction_items(id) ON DELETE CASCADE,
  tax_mapping_id        INTEGER NOT NULL REFERENCES tax_mapping(id),
  tax_name_id           INTEGER NOT NULL REFERENCES tax_name(id),
  tax_percentage        NUMERIC(8,4) NOT NULL,
  tax_amount            NUMERIC(18,4) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Why:** A single invoice line with GST 18% generates two rows here: one for CGST 9% and one for SGST 9% (or one IGST 18% for inter-state). Without this table, generating a GST-compliant invoice with component-level tax breakdown is impossible.

#### `transaction_payment_details` — Multiple Payments per Sale

```sql
CREATE TABLE transaction_payment_details (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  transaction_id        INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  payment_method_id     INTEGER NOT NULL REFERENCES payment_methods(id),
  payment_detail_id     INTEGER REFERENCES payment_details(id),
  amount                NUMERIC(18,4) NOT NULL,
  reference_number      VARCHAR(100),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id)
);
```

**Why:** A customer can pay ₹500 cash + ₹300 card for a ₹800 bill. Without this table you're forced to choose one payment method per transaction.

#### `transaction_number_sequence` — Auto-Increment Transaction Numbers

```sql
CREATE TABLE transaction_number_sequence (
  id                  SERIAL PRIMARY KEY,
  guuid               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id            INTEGER NOT NULL REFERENCES stores(id),
  transaction_type_id INTEGER NOT NULL REFERENCES transaction_types(id),
  prefix              VARCHAR(10),
  next_number         INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (store_id, transaction_type_id)
);
```

**Seed data:**
```sql
-- Run after stores exist — one row per type per store
INSERT INTO transaction_number_sequence (store_id, transaction_type_id, prefix, next_number)
SELECT s.id, tt.id,
  CASE tt.code
    WHEN 'SALES_INVOICE'   THEN 'INV-'
    WHEN 'CASH_SALE'       THEN 'POS-'
    WHEN 'SALES_RETURN'    THEN 'SRN-'
    WHEN 'PURCHASE_ORDER'  THEN 'PO-'
    WHEN 'PURCHASE_BILL'   THEN 'BILL-'
    WHEN 'PAYMENT_IN'      THEN 'RCP-'
    WHEN 'PAYMENT_OUT'     THEN 'PAY-'
    WHEN 'CREDIT_NOTE'     THEN 'CN-'
  END,
  1
FROM stores s CROSS JOIN transaction_types tt;
```

---

### 2.5 Customer Management

#### `customer_type`

```sql
CREATE TABLE customer_type (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  title       VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO customer_type (code, title, sort_order, is_system) VALUES
  ('RETAIL',      'Retail',         1, TRUE),
  ('WHOLESALE',   'Wholesale',      2, TRUE),
  ('CORPORATE',   'Corporate',      3, TRUE),
  ('WALK_IN',     'Walk-In',        4, TRUE),
  ('LOYALTY',     'Loyalty Member', 5, FALSE);
```

#### `customers`

```sql
CREATE TABLE customers (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id              INTEGER NOT NULL REFERENCES stores(id),
  customer_type_id      INTEGER NOT NULL REFERENCES customer_type(id),
  customer_code         VARCHAR(30),
  display_name          VARCHAR(200) NOT NULL,
  salutation            VARCHAR(20),
  first_name            VARCHAR(100),
  last_name             VARCHAR(100),
  email                 VARCHAR(200),
  phone                 VARCHAR(30),
  currency_id           INTEGER REFERENCES currencies(id),
  payment_term_id       INTEGER REFERENCES payment_terms(id),
  credit_limit          NUMERIC(18,4),
  is_tax_registered     BOOLEAN NOT NULL DEFAULT FALSE,
  tax_registration_no   VARCHAR(50),         -- GSTIN for India
  billing_type          VARCHAR(20) DEFAULT 'INVOICE',
  notes                 TEXT,
  is_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_customers_store_id     ON customers(store_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_phone        ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_customers_email        ON customers(email) WHERE email IS NOT NULL;
```

#### `payment_terms`

```sql
CREATE TABLE payment_terms (
  id          SERIAL PRIMARY KEY,
  store_id    INTEGER REFERENCES stores(id),    -- NULL = system-wide default
  code        VARCHAR(30) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  days        INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO payment_terms (code, display_name, days, sort_order, is_system) VALUES
  ('COD',    'Cash on Delivery',     0,  1, TRUE),
  ('NET7',   'Net 7 Days',           7,  2, TRUE),
  ('NET15',  'Net 15 Days',          15, 3, TRUE),
  ('NET30',  'Net 30 Days',          30, 4, TRUE),
  ('NET60',  'Net 60 Days',          60, 5, TRUE),
  ('NET90',  'Net 90 Days',          90, 6, TRUE),
  ('PREPAID','Prepaid',              0,  7, TRUE);
```

---

### 2.6 Payment Methods

#### `master_payment_method` — System Payment Methods

```sql
CREATE TABLE master_payment_method (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  is_system   BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO master_payment_method (code, name, sort_order) VALUES
  ('CASH',         'Cash',           1),
  ('CARD',         'Card',           2),
  ('UPI',          'UPI',            3),
  ('BANK_TRANSFER','Bank Transfer',  4),
  ('CHEQUE',       'Cheque',         5),
  ('WALLET',       'Digital Wallet', 6);
```

#### `master_payment_details` — Sub-types per Method

```sql
CREATE TABLE master_payment_details (
  id                SERIAL PRIMARY KEY,
  payment_method_id INTEGER NOT NULL REFERENCES master_payment_method(id),
  code              VARCHAR(30) NOT NULL UNIQUE,
  name              VARCHAR(100) NOT NULL,
  is_setup_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_system         BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at        TIMESTAMPTZ
);

INSERT INTO master_payment_details (payment_method_id, code, name, sort_order) VALUES
  -- CARD sub-types
  ((SELECT id FROM master_payment_method WHERE code='CARD'), 'VISA',       'Visa',         1),
  ((SELECT id FROM master_payment_method WHERE code='CARD'), 'MASTERCARD', 'Mastercard',   2),
  ((SELECT id FROM master_payment_method WHERE code='CARD'), 'RUPAY',      'RuPay',        3),
  ((SELECT id FROM master_payment_method WHERE code='CARD'), 'AMEX',       'Amex',         4),
  -- UPI sub-types
  ((SELECT id FROM master_payment_method WHERE code='UPI'),  'GPAY',       'Google Pay',   1),
  ((SELECT id FROM master_payment_method WHERE code='UPI'),  'PHONEPE',    'PhonePe',      2),
  ((SELECT id FROM master_payment_method WHERE code='UPI'),  'PAYTM',      'Paytm',        3),
  ((SELECT id FROM master_payment_method WHERE code='UPI'),  'BHIM',       'BHIM UPI',     4),
  -- WALLET sub-types
  ((SELECT id FROM master_payment_method WHERE code='WALLET'),'PAYTM_W',   'Paytm Wallet', 1),
  ((SELECT id FROM master_payment_method WHERE code='WALLET'),'AMAZON_PAY','Amazon Pay',   2);
```

#### `payment_methods` — Per-Store Enabled Methods

```sql
CREATE TABLE payment_methods (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id              INTEGER NOT NULL REFERENCES stores(id),
  master_payment_method_id INTEGER NOT NULL REFERENCES master_payment_method(id),
  code                  VARCHAR(30) NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  is_default            BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,

  UNIQUE (store_id, code)
);
```

#### `payment_details` — Per-Store Enabled Sub-Methods

```sql
CREATE TABLE payment_details (
  id                      SERIAL PRIMARY KEY,
  guuid                   UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id                INTEGER NOT NULL REFERENCES stores(id),
  payment_method_id       INTEGER NOT NULL REFERENCES payment_methods(id),
  master_payment_detail_id INTEGER REFERENCES master_payment_details(id),
  code                    VARCHAR(30) NOT NULL,
  name                    VARCHAR(100) NOT NULL,
  is_default              BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,

  UNIQUE (store_id, code)
);
```

---

## 3. Tier 2 — Recommended (Take Soon)

---

### 3.1 Supplier & Purchasing

#### `supplier_type`

```sql
CREATE TABLE supplier_type (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  title       VARCHAR(100) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO supplier_type (code, title, sort_order, is_system) VALUES
  ('MANUFACTURER',  'Manufacturer',     1, TRUE),
  ('DISTRIBUTOR',   'Distributor',      2, TRUE),
  ('WHOLESALER',    'Wholesaler',       3, TRUE),
  ('IMPORTER',      'Importer',         4, FALSE),
  ('TRADER',        'Trader',           5, FALSE);
```

#### `suppliers`

```sql
CREATE TABLE suppliers (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id              INTEGER NOT NULL REFERENCES stores(id),
  supplier_type_id      INTEGER NOT NULL REFERENCES supplier_type(id),
  supplier_code         VARCHAR(30),
  supplier_name         VARCHAR(200) NOT NULL,
  salutation            VARCHAR(20),
  first_name            VARCHAR(100),
  last_name             VARCHAR(100),
  email                 VARCHAR(200),
  phone                 VARCHAR(30),
  currency_id           INTEGER REFERENCES currencies(id),
  payment_term_id       INTEGER REFERENCES payment_terms(id),
  is_tax_registered     BOOLEAN NOT NULL DEFAULT FALSE,
  tax_registration_no   VARCHAR(50),
  company_reg_number    VARCHAR(50),
  notes                 TEXT,
  is_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id),
  deleted_at            TIMESTAMPTZ
);
```

#### `product_suppliers`

```sql
CREATE TABLE product_suppliers (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  product_id            INTEGER NOT NULL REFERENCES products(id),
  supplier_id           INTEGER NOT NULL REFERENCES suppliers(id),
  supplier_case_ref     VARCHAR(50),
  case_quantity_id      INTEGER REFERENCES case_quantities(id),
  case_cost_extax       NUMERIC(18,4),
  is_last_buy           BOOLEAN NOT NULL DEFAULT FALSE,
  last_buy_date         DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id),
  deleted_at            TIMESTAMPTZ,

  UNIQUE (product_id, supplier_id)
);
```

---

### 3.2 Staff & Teams

#### `teams`

```sql
CREATE TABLE teams (
  id          SERIAL PRIMARY KEY,
  guuid       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id    INTEGER NOT NULL REFERENCES stores(id),
  team_name   VARCHAR(100) NOT NULL,
  description TEXT,
  is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  INTEGER REFERENCES users(id),
  deleted_at  TIMESTAMPTZ
);
```

#### `team_members`

```sql
CREATE TABLE team_members (
  id            SERIAL PRIMARY KEY,
  guuid         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  team_id       INTEGER NOT NULL REFERENCES teams(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  is_leader     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,

  UNIQUE (team_id, user_id)
);
```

---

### 3.3 Communication & Contacts

#### `communication_types` — Phone, Email, Fax, Website

```sql
CREATE TABLE communication_types (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  type_name   VARCHAR(100) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO communication_types (code, type_name, sort_order, is_system) VALUES
  ('PHONE',   'Phone',        1, TRUE),
  ('EMAIL',   'Email',        2, TRUE),
  ('MOBILE',  'Mobile',       3, TRUE),
  ('WEBSITE', 'Website',      4, TRUE),
  ('FAX',     'Fax',          5, TRUE),
  ('WHATSAPP','WhatsApp',     6, FALSE);
```

#### `communications` — Generic Contact Details for Any Entity

```sql
CREATE TABLE communications (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  entity_type           VARCHAR(30) NOT NULL,  -- 'customer', 'supplier', 'store'
  entity_id             INTEGER NOT NULL,
  communication_type_id INTEGER NOT NULL REFERENCES communication_types(id),
  value                 VARCHAR(200) NOT NULL,   -- the phone number / email / url
  calling_code          VARCHAR(10),
  is_verified           BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_communications_entity ON communications(entity_type, entity_id);
```

#### `contact_person_types`

```sql
CREATE TABLE contact_person_types (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  type_name   VARCHAR(100) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO contact_person_types (code, type_name, sort_order) VALUES
  ('PRIMARY',    'Primary Contact',  1),
  ('ACCOUNTS',   'Accounts',         2),
  ('MANAGER',    'Manager',          3),
  ('OWNER',      'Owner',            4),
  ('DELIVERY',   'Delivery Contact', 5);
```

#### `contact_persons`

```sql
CREATE TABLE contact_persons (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  entity_type           VARCHAR(30) NOT NULL,   -- 'customer', 'supplier'
  entity_id             INTEGER NOT NULL,
  contact_person_type_id INTEGER NOT NULL REFERENCES contact_person_types(id),
  salutation            VARCHAR(20),
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100),
  designation           VARCHAR(100),
  email                 VARCHAR(200),
  phone                 VARCHAR(30),
  mobile                VARCHAR(30),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_contact_persons_entity ON contact_persons(entity_type, entity_id);
```

---

### 3.4 Files & Attachments

#### `file_types`

```sql
CREATE TABLE file_types (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) NOT NULL UNIQUE,
  type_name   VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ
);

INSERT INTO file_types (code, type_name, sort_order, is_system) VALUES
  ('INVOICE',       'Invoice',              1, TRUE),
  ('RECEIPT',       'Receipt',              2, TRUE),
  ('PURCHASE_ORDER','Purchase Order',       3, TRUE),
  ('PRODUCT_IMAGE', 'Product Image',        4, TRUE),
  ('IDENTITY',      'Identity Document',    5, FALSE),
  ('CONTRACT',      'Contract',             6, FALSE),
  ('OTHER',         'Other',                9, TRUE);
```

#### `file_storage_types`

```sql
CREATE TABLE file_storage_types (
  id                SERIAL PRIMARY KEY,
  storage_type_name VARCHAR(50) NOT NULL UNIQUE,
  description       TEXT,
  deleted_at        TIMESTAMPTZ
);

INSERT INTO file_storage_types (storage_type_name, description) VALUES
  ('S3',    'Amazon S3'),
  ('LOCAL', 'Local file system'),
  ('AZURE', 'Azure Blob Storage'),
  ('GCS',   'Google Cloud Storage');
```

#### `files`

```sql
CREATE TABLE files (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id              INTEGER NOT NULL REFERENCES stores(id),
  entity_type           VARCHAR(30) NOT NULL,
  entity_id             INTEGER NOT NULL,
  file_type_id          INTEGER NOT NULL REFERENCES file_types(id),
  file_storage_type_id  INTEGER NOT NULL REFERENCES file_storage_types(id),
  file_name             VARCHAR(255) NOT NULL,
  file_size_kb          INTEGER,
  mime_type             VARCHAR(100),
  file_url              TEXT,
  file_key              TEXT,
  is_private            BOOLEAN NOT NULL DEFAULT FALSE,
  description           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_files_entity ON files(entity_type, entity_id) WHERE deleted_at IS NULL;
```

#### `temporary_files` — Staging Before Linking

```sql
CREATE TABLE temporary_files (
  id            SERIAL PRIMARY KEY,
  guuid         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  file_name     VARCHAR(255) NOT NULL,
  file_key      TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_size_kb  INTEGER,
  mime_type     VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    INTEGER REFERENCES users(id),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  deleted_at    TIMESTAMPTZ
);
```

---

### 3.5 Approvals & Workflows

For high-value transactions (purchase orders above a threshold, large refunds, etc.).

#### `approval_rules`

```sql
CREATE TABLE approval_rules (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id              INTEGER NOT NULL REFERENCES stores(id),
  transaction_type_id   INTEGER NOT NULL REFERENCES transaction_types(id),
  rule_name             VARCHAR(100) NOT NULL,
  description           TEXT,
  is_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            INTEGER REFERENCES users(id),
  deleted_at            TIMESTAMPTZ
);
```

#### `approval_levels`

```sql
CREATE TABLE approval_levels (
  id                SERIAL PRIMARY KEY,
  guuid             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  approval_rule_id  INTEGER NOT NULL REFERENCES approval_rules(id),
  level_number      INTEGER NOT NULL,
  amount_threshold  NUMERIC(18,4),
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,

  UNIQUE (approval_rule_id, level_number)
);
```

#### `approval_level_approvers`

```sql
CREATE TABLE approval_level_approvers (
  id                  SERIAL PRIMARY KEY,
  approval_level_id   INTEGER NOT NULL REFERENCES approval_levels(id),
  user_id             INTEGER NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  UNIQUE (approval_level_id, user_id)
);
```

#### `approval_audit`

```sql
CREATE TABLE approval_audit (
  id                  SERIAL PRIMARY KEY,
  guuid               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  transaction_id      INTEGER NOT NULL REFERENCES transactions(id),
  approval_level_id   INTEGER NOT NULL REFERENCES approval_levels(id),
  approver_id         INTEGER NOT NULL REFERENCES users(id),
  status              VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  comments            TEXT,
  decided_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.6 Store Configuration Settings

#### `store_general_settings`

```sql
CREATE TABLE store_general_settings (
  id                          SERIAL PRIMARY KEY,
  guuid                       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id                    INTEGER NOT NULL UNIQUE REFERENCES stores(id),
  date_format                 VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  financial_year_end_month    INTEGER DEFAULT 3,      -- March (India)
  financial_year_end_day      INTEGER DEFAULT 31,
  report_basis                VARCHAR(10) DEFAULT 'ACCRUAL', -- ACCRUAL or CASH
  default_currency_id         INTEGER REFERENCES currencies(id),
  enable_multi_currency       BOOLEAN NOT NULL DEFAULT FALSE,
  enable_inventory            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `store_sales_settings`

```sql
CREATE TABLE store_sales_settings (
  id                              SERIAL PRIMARY KEY,
  guuid                           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id                        INTEGER NOT NULL UNIQUE REFERENCES stores(id),
  selling_price_inclusive_of_tax  BOOLEAN NOT NULL DEFAULT FALSE,
  enable_rounding_off             BOOLEAN NOT NULL DEFAULT TRUE,
  rounding_off_method             VARCHAR(20) DEFAULT 'NEAREST',  -- NEAREST, UP, DOWN
  rounding_off_account_id         INTEGER REFERENCES accounts(id),
  default_credit_limit_action     VARCHAR(20) DEFAULT 'WARN',     -- WARN, BLOCK
  sell_by_case_quantity           BOOLEAN NOT NULL DEFAULT FALSE,
  allow_split_case                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `store_inventory_settings`

```sql
CREATE TABLE store_inventory_settings (
  id                          SERIAL PRIMARY KEY,
  guuid                       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id                    INTEGER NOT NULL UNIQUE REFERENCES stores(id),
  allow_negative_stock_sales  BOOLEAN NOT NULL DEFAULT FALSE,
  default_inventory_account_id INTEGER REFERENCES accounts(id),
  default_valuation_method    VARCHAR(10) DEFAULT 'FIFO',  -- FIFO, LIFO, WAC
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.7 Staff Invitations

#### `store_invitations`

```sql
CREATE TABLE store_invitations (
  id                SERIAL PRIMARY KEY,
  guuid             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  store_id          INTEGER NOT NULL REFERENCES stores(id),
  inviter_user_id   INTEGER NOT NULL REFERENCES users(id),
  invitee_user_id   INTEGER REFERENCES users(id),
  invitee_email     VARCHAR(200) NOT NULL,
  invitee_firstname VARCHAR(100),
  invitee_lastname  VARCHAR(100),
  role_id           INTEGER REFERENCES roles(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  invitation_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  responded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);
```

---

### 3.8 Product Bundles & Variants

#### `product_bundles`

```sql
CREATE TABLE product_bundles (
  id                    SERIAL PRIMARY KEY,
  guuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  parent_product_id     INTEGER NOT NULL REFERENCES products(id),
  child_case_quantity_id INTEGER NOT NULL REFERENCES case_quantities(id),
  quantity              NUMERIC(18,4) NOT NULL DEFAULT 1,
  is_required           BOOLEAN NOT NULL DEFAULT TRUE,
  bundle_price          NUMERIC(18,4),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);
```

#### `product_attributes` (for Size/Color variants)

```sql
CREATE TABLE product_attributes (
  id          SERIAL PRIMARY KEY,
  guuid       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  name        VARCHAR(50) NOT NULL,  -- 'Size', 'Color', 'Flavor'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  UNIQUE (product_id, name)
);

CREATE TABLE product_attribute_values (
  id            SERIAL PRIMARY KEY,
  guuid         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  attribute_id  INTEGER NOT NULL REFERENCES product_attributes(id),
  value         VARCHAR(100) NOT NULL,  -- 'S', 'M', 'L', 'Red'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,

  UNIQUE (attribute_id, value)
);

CREATE TABLE product_combinations (
  id                  SERIAL PRIMARY KEY,
  guuid               UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  product_id          INTEGER NOT NULL REFERENCES products(id),
  combination_code    VARCHAR(50),
  mapped_product_id   INTEGER REFERENCES products(id),  -- points to the actual SKU product
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE product_combination_details (
  id                SERIAL PRIMARY KEY,
  combination_id    INTEGER NOT NULL REFERENCES product_combinations(id),
  attribute_id      INTEGER NOT NULL REFERENCES product_attributes(id),
  value_id          INTEGER NOT NULL REFERENCES product_attribute_values(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (combination_id, attribute_id)
);
```

---

## 4. Tier 3 — Optional (Later)

| Table(s) | Purpose | When to add |
|---|---|---|
| `selling_prices` | Price history with `effective_date` | When price tracking / promotions needed |
| `product_additional_details` | Age restriction, storage ambience, delivery options | When regulatory compliance required |
| `recon_bank_transaction` | Bank statement reconciliation | When accountants need bank recon |
| `customer_statement` | Customer aging reports | When credit management is active |
| `supplier_statement` | Supplier aging reports | When accounts payable reporting needed |
| `applied_credits` | Track credit note application to invoices | When credit notes are in scope |
| `tax_registrations` | Company GSTIN registrations | When GST filing features added |
| `department` | Departmental P&L reporting | When multi-department stores go live |
| `account_group_code` + `account_mapping` | Custom financial report groupings | When financial reporting module added |
| `transaction_templates` | Save frequently-used transaction templates | When sales order templates needed |
| `transaction_audit` | Full change history per transaction | When audit trail beyond `audit_logs` needed |
| `brand` | Product brand tagging and filtering | When brand analytics needed |
| `channel` | Retail / Online / Wholesale channel tracking | When multi-channel sales reporting added |
| `business_type` | B2B, B2C, B2G classification | When multi-segment customer analytics needed |
| `class_groups` | Hierarchical classification for reporting | When project-based or class-based reporting needed |
| `terms_and_condition` | Per-transaction-type T&C text storage | When invoice T&C customization needed |

---

## 5. Skip Entirely

| Tables | Reason |
|---|---|
| `email_scheduler_settings`, `mail_audit`, `email_processing_audit` | Defer to external email service (SES, SendGrid) |
| `email_templates`, `notification_queue` | Use a dedicated notification microservice |
| `stripe_*`, `plaid_connection` | External payment gateway — use their SDK/webhook instead |
| `exchange_rates` (Ayphen's scheduled version) | Use a real-time FX API (Open Exchange Rates, etc.) |
| `supplier_connection` | B2B marketplace feature — too specialized |
| `product_sync_mapping` | External ERP sync — defer to integration layer |
| `oss_registrations`, `country_groups` | EU-specific VAT compliance — not applicable India-first |
| `recursive_transaction` | Recurring billing — defer to job scheduler (Bull, pg-boss) |
| `country_app_entity_mapping`, `applications`, `application_entity` | Ayphen's multi-app architecture — NKS uses `routes` table |
| `report_basis` (Ayphen lookup) | Fold into `store_general_settings.report_basis` VARCHAR |

---

## 6. Already in NKS — Do Not Re-create

| Existing NKS Table | Maps to Ayphen |
|---|---|
| `users` | `users` + `company_users` |
| `roles` | `roles` |
| `route_permissions` | `role_permission_mapping` |
| `routes` | `routes` + `application_entity` |
| `user_roles` | `user_role_mapping` |
| `sessions` | `user_session` |
| `audit_logs` | `transaction_audit` + `activity_log` |
| `stores` | `company` + `company_location` |
| `states` | `state_region_province` |
| `districts` | `county` |
| `pincodes` | — |
| `lookups` | `lookup` |
| `lookup_types` | `lookup_type` |
| `statuses` | `status` |
| `entity_statuses` | `entity_status_mapping` |
| `countries` | `country` |
| `currencies` | `currency` |

---

## 7. Seed Data to Copy

### 7.1 From `ayphen-master-initial-data.sql`

| Data set | Row count (approx) | How to use |
|---|---|---|
| World timezones | ~600 rows | Copy directly into NKS `timezones` table (if added) |
| Continent data | 7 rows | Copy directly |
| Country data | 249 rows | Supplement NKS `countries` if missing any |
| Currency data | 170 rows | Supplement NKS `currencies` if missing any |
| Calling codes | 250 rows | Seed `calling_codes` table if added |
| Volumes/UOM | 20 rows | Copy as `volumes` seed (already shown above) |
| Product types | 4 rows | Copy as shown above |
| Customer types | 5 rows | Copy as shown above |
| Supplier types | 5 rows | Copy as shown above |
| Tax types, tax, tax_name, tax_level, tax_agency | ~40 rows | Copy with India-specific additions |
| Master payment methods + details | ~20 rows | Copy with UPI/RuPay additions |
| Payment terms | 7 rows | Copy as shown above |
| Communication types | 6 rows | Copy as shown above |
| File types, storage types | ~15 rows | Copy as shown above |
| Contact person types | 5 rows | Copy as shown above |

### 7.2 From `ayphen-account-codes-data.sql`

Copy the full COA hierarchy (~50+ account group codes). Only India-specific accounts need to be added:

```sql
-- India-specific additions not in Ayphen:
-- Under Current Liabilities (CRL):
INSERT INTO account_codes (code, name, parent_account_code_id) VALUES
  ('CGST_PAY',  'CGST Payable',     <CRL_id>),
  ('SGST_PAY',  'SGST Payable',     <CRL_id>),
  ('IGST_PAY',  'IGST Payable',     <CRL_id>),
  ('CESS_PAY',  'Cess Payable',     <CRL_id>),
  ('TDS_PAY',   'TDS Payable',      <CRL_id>),
  ('PF_PAY',    'PF Payable',       <CRL_id>),
  ('ESIC_PAY',  'ESIC Payable',     <CRL_id>);
```

---

## 8. Implementation Order

Build in this sequence — each layer depends on the one above.

```
Phase 1 — Reference Data (no FK dependencies)
  ├── product_type, customer_type, supplier_type, payment_terms
  ├── communication_types, contact_person_types, file_types, file_storage_types
  ├── tax_type, tax, tax_name, tax_level, tax_agency
  ├── master_payment_method, master_payment_details
  ├── volumes, transaction_types
  └── mas_account_type → account_codes (COA hierarchy seed)

Phase 2 — Store Setup (depends on stores existing)
  ├── account_type, accounts (per-store COA instances)
  ├── payment_methods, payment_details (per-store)
  ├── store_general_settings, store_sales_settings, store_inventory_settings
  └── transaction_number_sequence (per store × type)

Phase 3 — Catalog (depends on accounts)
  ├── storage_areas
  ├── product_category (hierarchical)
  ├── products
  ├── case_quantities
  ├── product_locations, product_storage, inventory_balance
  ├── tax_mapping, tax_rate, country_tax_mapping, product_tax
  └── customers, suppliers

Phase 4 — Transactions (depends on all above)
  ├── transactions
  ├── transaction_items
  ├── transaction_items_tax
  ├── transaction_payment_details
  ├── inventory_adjustment_sales, inventory_adjustment_purchase
  └── general_ledger, journals

Phase 5 — Supporting Features
  ├── teams, team_members
  ├── communications, contact_persons
  ├── files, temporary_files
  ├── store_invitations
  ├── approval_rules, approval_levels, approval_level_approvers, approval_audit
  └── product_bundles, product_attributes, product_attribute_values, product_combinations
```

---

*This document is a migration reference, not a final schema spec. Column names, FKs, and constraints should be reviewed against the current NKS TypeORM entity conventions before creating migrations.*
