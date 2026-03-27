# SuperStore — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** March 26, 2026  
**Author:** Product Management  
**Status:** Draft for Engineering & Design Review  
**Classification:** Confidential  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Competitive Analysis](#2-competitive-analysis)
3. [Personas](#3-personas)
4. [End-to-End Business Flows](#4-end-to-end-business-flows)
5. [Detailed Workflows (Module-wise)](#5-detailed-workflows-module-wise)
6. [Feature Breakdown (Module-wise)](#6-feature-breakdown-module-wise)
7. [User Roles & Permissions](#7-user-roles--permissions)
8. [System Architecture (High-Level)](#8-system-architecture-high-level)
9. [Integrations](#9-integrations)
10. [Unique / Differentiated Features](#10-unique--differentiated-features)
11. [Reports & Analytics](#11-reports--analytics)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Future Roadmap](#13-future-roadmap)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Advanced System Capabilities (Cross-Cutting)](#15-advanced-system-capabilities-cross-cutting)
    - 15.1 Notifications & Alerts Framework
    - 15.2 Approval Workflow Engine
    - 15.3 Audit & Compliance System
    - 15.4 Advanced RBAC
    - 15.5 Workflow Automation Engine
    - 15.6 Offline-First Sync Architecture (Detailed)
    - 15.7 Reporting & Intelligence Layer (Advanced)
    - 15.8 Multi-Device & Session Management
    - 15.9 Data Backup & Disaster Recovery
    - 15.10 Security & Fraud Detection
16. [Cross-Module Integration Workflows](#16-cross-module-integration-workflows)
17. [Unique & Differentiated Features (Extended)](#17-unique--differentiated-features-extended)

---

# 1. Executive Summary

## 1.1 Vision

SuperStore is a cloud-first, offline-capable SaaS platform purpose-built for mid-sized Indian supermarkets (5–20 staff, single or multi-branch). It unifies point-of-sale billing, inventory management, GST-compliant accounting, supplier and customer relationship management, purchase/sales order processing, stock auditing, e-commerce (own white-label storefront + marketplace integrations), and AI-powered business intelligence into a single, tightly integrated system.

The product is designed from the ground up to reflect the realities of Indian retail — unreliable internet connectivity, GST regulatory complexity, informal supplier credit flows, regional language diversity, price-sensitive customers who compare on WhatsApp, and billing staff who may have limited tech literacy. SuperStore replaces the patchwork of TallyPrime (accounting), Marg ERP (POS), Excel sheets (stock tracking), paper registers (credit khata), and WhatsApp groups (ordering) with one unified platform that works on a ₹12,000 Android tablet at the billing counter and a browser on the owner's laptop.

## 1.2 Target Users

| Segment | Description | Size Estimate |
|---|---|---|
| **Primary** | Mid-sized supermarkets / departmental stores (5–20 staff, ₹50L–₹10Cr annual turnover, 1–5 branches) | ~3.2 lakh stores in India |
| **Secondary** | Growing kirana stores upgrading from manual processes (2–5 staff, ₹10L–₹50L turnover) | ~8 lakh stores |
| **Tertiary** | Small supermarket chains / franchise networks (5–20 outlets under a single owner or brand) | ~15,000 chains |

**Geographic priority:** Tier-2 and Tier-3 cities in Tamil Nadu, Karnataka, Maharashtra, Gujarat, and UP (highest density of mid-sized departmental stores).

## 1.3 Key Value Proposition

1. **One platform, zero stitching** — POS + Inventory + Accounting + CRM + E-commerce in a single login, eliminating the TallyPrime-for-accounts + Marg-for-POS + WhatsApp-for-orders fragmentation.
2. **Offline-first architecture** — Full billing, inventory lookup, and customer credit operations work without internet. Data syncs automatically when connectivity resumes. No lost sales during internet outages.
3. **India-native from day one** — GST auto-calculation with HSN code mapping, e-invoice/e-way bill generation, UPI QR at every billing terminal, regional language UI (Tamil, Hindi, Kannada, Telugu, Marathi, Gujarati), and credit khata digitization with WhatsApp reminders.
4. **AI-powered operations** — Demand forecasting per SKU per branch, smart reorder suggestions factoring in lead times and seasonality, credit risk scoring for customers, and dead stock detection — capabilities absent from Vyapar, Marg, and TallyPrime.
5. **WhatsApp-first commerce** — Customers browse a catalog, place orders, pay via UPI link, and get delivery updates entirely within WhatsApp. No app download required for end consumers.
6. **Hardware-agnostic POS** — Works with any Android tablet, existing barcode scanners (USB/Bluetooth), thermal receipt printers, and electronic weighing scales. No proprietary hardware lock-in.

---

# 2. Competitive Analysis

## 2.1 Competitor Overview

| Competitor | Primary Strength | Primary Weakness | Target Segment | Deployment | Pricing (approx.) |
|---|---|---|---|---|---|
| **TallyPrime** | Accounting & GST compliance gold standard; 80% SMB market share in India | Desktop-only, no native mobile app, no built-in POS, no e-commerce, no cloud-native architecture | Accountants, traders, manufacturers | On-premise (desktop) | Silver: ₹22,500 lifetime; Gold: ₹67,500 lifetime |
| **Marg ERP** | Deep supermarket POS with barcode, expiry tracking, multi-godown | Not cloud-based, single-machine access, outdated UI, poor customer support, English-only | Supermarkets, pharma retail, distributors | On-premise | ₹15,000–₹50,000+ (varies by modules) |
| **Vyapar** | Simple, affordable, mobile-first billing & invoicing; 1Cr+ users | Limited inventory depth (no batch/expiry for supermarkets), weak POS hardware integration, no multi-branch, no e-commerce | Micro/small businesses, solo traders | Cloud + mobile | Free tier; Gold ₹222/mo; Platinum ₹639/mo |
| **Zoho Inventory** | Cloud-native, API-rich, global integrations | Not India-retail-specific, no POS, complex for non-tech users, overkill for a single supermarket | Tech-savvy SMBs, D2C brands | Cloud SaaS | ₹3,999/mo+ for useful plans |
| **Shopify POS** | Excellent e-commerce + POS unification, modern UX | Expensive for Indian market, no GST-first design, no offline billing, no credit khata, no weighing scale integration | D2C brands, premium retail | Cloud SaaS | ₹2,000/mo+ plus transaction fees |
| **JioMart (Partner)** | Massive consumer reach, logistics network | Not a SaaS tool — it's a marketplace; store loses brand identity; limited operational control | Kirana stores joining JioMart network | Marketplace | Commission-based |

## 2.2 Feature Comparison Matrix

| Feature | SuperStore | TallyPrime | Marg ERP | Vyapar | Zoho Inventory | Shopify POS |
|---|---|---|---|---|---|---|
| POS Billing (touch/scan) | ✅ Full | ⚠️ Basic add-on | ✅ Full | ⚠️ Basic invoicing | ❌ | ✅ Full |
| Barcode Scanner Integration | ✅ USB + Bluetooth | ⚠️ via add-on | ✅ | ⚠️ Camera-based | ❌ | ✅ |
| Weighing Scale Integration | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Thermal Receipt Printer | ✅ | ⚠️ via add-on | ✅ | ✅ | ❌ | ✅ |
| Offline Billing | ✅ Full | ✅ (desktop) | ✅ (desktop) | ✅ | ❌ | ⚠️ Limited |
| GST Auto-calculation | ✅ | ✅ Best-in-class | ✅ | ✅ | ⚠️ Generic | ⚠️ Generic |
| E-invoice / E-way Bill | ✅ | ✅ | ✅ | ⚠️ Limited | ⚠️ | ❌ |
| GSTR-1/3B Filing Support | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Multi-branch Support | ✅ | ⚠️ via sync | ⚠️ Limited | ❌ | ✅ | ✅ |
| Inventory (Batch + Expiry) | ✅ | ✅ | ✅ | ⚠️ Basic | ✅ | ⚠️ |
| FIFO/LIFO/Weighted Avg Costing | ✅ All three | ✅ | ✅ | ❌ | ✅ | ❌ |
| Purchase Order Management | ✅ | ✅ | ✅ | ⚠️ Basic | ✅ | ⚠️ |
| Supplier Credit Management | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| Customer Credit (Khata) | ✅ + WhatsApp reminders | ⚠️ Basic ledger | ⚠️ Basic ledger | ✅ | ❌ | ❌ |
| UPI / QR Payment | ✅ Native | ❌ | ⚠️ | ⚠️ | ❌ | ❌ |
| WhatsApp Ordering | ✅ | ❌ | ❌ | ⚠️ Invoice sharing only | ❌ | ❌ |
| Own Online Storefront | ✅ | ❌ | ❌ | ⚠️ Basic catalog | ❌ | ✅ Best-in-class |
| Marketplace Integration (Swiggy/Dunzo) | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| AI Demand Forecasting | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Smart Reorder Suggestions | ✅ | ❌ | ⚠️ Basic reorder level | ❌ | ⚠️ Basic | ❌ |
| Credit Risk Scoring | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Voice-based Billing | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Regional Language UI | ✅ 6 languages | ❌ English only | ❌ English only | ⚠️ Limited | ❌ | ❌ |
| Mobile App (Full featured) | ✅ Android + iOS | ❌ No mobile | ⚠️ Limited app | ✅ Mobile-first | ✅ | ✅ |
| Cloud-native Architecture | ✅ | ❌ Desktop only | ❌ Desktop only | ✅ | ✅ | ✅ |
| Stock Audit / Physical Count | ✅ | ⚠️ Manual | ✅ | ❌ | ✅ | ⚠️ |
| Returns & Refund Management | ✅ | ⚠️ Credit note | ✅ | ⚠️ | ✅ | ✅ |

## 2.3 Key Gaps and Opportunities

**Gap 1: No single tool unifies POS + Accounting + E-commerce for Indian supermarkets.** TallyPrime excels at accounting but has no POS. Marg has POS but is desktop-locked with no e-commerce. Vyapar is mobile-first but too shallow for supermarket inventory (no batch/expiry, no multi-branch). SuperStore fills this by being the first platform that is genuinely integrated across all three.

**Gap 2: Desktop-era architecture.** Both TallyPrime and Marg ERP are fundamentally desktop applications. They lack cloud sync, mobile access, and multi-device collaboration. A store owner checking stock levels from home or a second branch manager accessing reports requires workarounds (TeamViewer, data export). SuperStore is cloud-first with real-time sync.

**Gap 3: Zero AI/ML capabilities.** None of the Indian competitors offer demand forecasting, smart reorder, or credit risk scoring. These are table-stakes features in global retail SaaS (e.g., Lightspeed, Square) but absent in the Indian mid-market. SuperStore introduces these as a major differentiator.

**Gap 4: No WhatsApp-native commerce.** Indian consumers live on WhatsApp. No existing tool offers a complete ordering → payment → delivery tracking flow inside WhatsApp. Vyapar allows invoice sharing via WhatsApp, but that's one-directional. SuperStore enables two-way WhatsApp commerce.

**Gap 5: Regional language deficit.** Marg ERP is English-only. TallyPrime is English-only. Vyapar has limited Hindi support. A billing clerk in Madurai or Varanasi operating a POS in English faces unnecessary friction. SuperStore launches with Tamil, Hindi, Kannada, Telugu, Marathi, and Gujarati UI.

**Gap 6: Customer support as a competitive moat.** Both Marg ERP and Vyapar receive severe criticism for post-sale support quality. SuperStore can differentiate with in-app chat support in regional languages, video tutorials, and a WhatsApp support line.

---

# 3. Personas

## 3.1 Persona: Rajesh — Store Owner

| Attribute | Details |
|---|---|
| **Age** | 42 |
| **Location** | Coimbatore, Tamil Nadu |
| **Business** | "Rajesh Super Market" — 2 branches, 12 staff total, ₹3.5 Cr annual turnover |
| **Tech literacy** | Moderate — uses WhatsApp, Google Pay, basic Excel. Never used ERP software. Currently uses Marg for billing at one branch and paper registers at the other. |
| **Language** | Tamil (primary), English (reads but prefers Tamil for daily work) |
| **Goals** | Unified view of both branches from his phone. Know exact stock levels at any time. Reduce pilferage (suspects ~₹2L annual shrinkage). Grow online orders without building a separate website. Ensure GST compliance without a full-time accountant. |
| **Pain points** | Cannot see Branch 2 stock from Branch 1. Marg ERP is desktop-only — has to physically go to the store to check reports. Supplier payments tracked in a notebook — misses early payment discounts. Credit customers (₹8L outstanding) have no automated reminders. Tax filing requires manual data export to CA. |
| **Daily workflow** | 7:00 AM — Reviews yesterday's sales on phone (currently via WhatsApp photos of Marg screenshots). 8:30 AM — Arrives at Branch 1, checks stock visually, instructs purchase of low items by calling suppliers. 10:00 AM–1:00 PM — Oversees billing, handles supplier deliveries, negotiates prices. 2:00 PM — Visits Branch 2. 4:00 PM — Returns to Branch 1, reviews the day's cash collection. 8:00 PM — Reconciles cash at home (manually). |
| **Quote** | *"I need one app that shows me everything — both shops, all stock, all money — on my phone before I sleep."* |

## 3.2 Persona: Priya — Store Manager

| Attribute | Details |
|---|---|
| **Age** | 31 |
| **Location** | Coimbatore, Tamil Nadu |
| **Role** | Manager of Branch 2, reports to Rajesh |
| **Tech literacy** | High — uses smartphone fluently, comfortable with apps, quick learner |
| **Language** | Tamil (primary), English (comfortable) |
| **Goals** | Maintain zero stock-outs on top-selling items. Keep billing counter wait time under 3 minutes. Manage 4 staff shifts efficiently. Earn Rajesh's trust to eventually run a third branch. |
| **Pain points** | No automated low-stock alerts — discovers stock-outs when customers complain. Staff sometimes give unauthorized discounts. Cannot see which items are selling fast at Branch 1 to cross-stock. Credit approvals for regular customers require calling Rajesh every time. Returns process is ad-hoc — no standard workflow. |
| **Daily workflow** | 8:00 AM — Opens store, checks cash from previous closing. 9:00 AM — Receives supplier deliveries, counts and records manually. 10:00 AM–7:00 PM — Manages floor, assists billing during rush, handles customer complaints. 7:30 PM — Counts cash, reconciles with register, reports to Rajesh via WhatsApp. |
| **Quote** | *"I want the system to tell me what to order before I run out, not after."* |

## 3.3 Persona: Kumar — Billing Staff / Cashier

| Attribute | Details |
|---|---|
| **Age** | 24 |
| **Location** | Coimbatore, Tamil Nadu |
| **Role** | Full-time cashier at Branch 1 |
| **Tech literacy** | Low-moderate — uses WhatsApp and YouTube on phone, no computer experience beyond billing software |
| **Language** | Tamil only |
| **Goals** | Bill customers quickly without errors. Handle UPI/cash/card payments smoothly. End shift on time without cash discrepancies. |
| **Pain points** | Marg ERP interface is in English — memorizes button positions rather than reading labels. Weighing items (vegetables, groceries) requires manual weight entry — no scale integration. Regular customers expect credit — has to call manager for approval each time. Receipt printer jams frequently, causing queues. |
| **Daily workflow** | 9:00 AM — Logs into POS, counts opening cash. 9:30 AM–1:00 PM — Continuous billing (average 8–12 customers/hour). 1:00 PM — Lunch break (backup cashier takes over). 2:00 PM–8:00 PM — Continuous billing, peak rush 5:30–7:30 PM. 8:00 PM — Cash count, shift handover, Z-report. |
| **Quote** | *"If the screen is in Tamil and the barcode scanner works, I can bill twice as fast."* |

## 3.4 Persona: Devi — Inventory Manager

| Attribute | Details |
|---|---|
| **Age** | 35 |
| **Location** | Coimbatore, Tamil Nadu |
| **Role** | Handles procurement, stock management, and supplier coordination for both branches |
| **Tech literacy** | Moderate — uses Excel for stock tracking, comfortable with smartphones |
| **Language** | Tamil (primary), English (reading) |
| **Goals** | Maintain optimal stock levels across both branches. Minimize expired goods wastage (currently ~₹50K/month). Get best prices from suppliers through competitive quotation. Track all supplier payments and pending amounts accurately. |
| **Pain points** | Stock tracking is split between Marg (Branch 1) and paper (Branch 2) — consolidating is a nightmare. Expiry tracking is manual — discovers expired goods during physical audits. No visibility into which items are slow-moving until year-end stock audit. Supplier comparison (who offers better price for the same SKU) requires flipping through paper files. Physical stock count takes 2 full days and shuts the store. |
| **Daily workflow** | 7:30 AM — Checks stock levels (Marg + paper). 8:30 AM — Places phone orders to 5–8 suppliers. 10:00 AM–12:00 PM — Receives deliveries, checks quantities against delivery challans, verifies quality. 12:00 PM–2:00 PM — Updates stock in Marg (Branch 1) and paper register (Branch 2). 3:00 PM — Reviews pending supplier payments, coordinates with Rajesh. 4:00 PM — Checks for near-expiry items, arranges for clearance sale pricing. |
| **Quote** | *"I spend 3 hours a day just recording stock in and stock out. The system should do that in 3 minutes."* |

---

# 4. End-to-End Business Flows

## 4.1 Flow 1: Procurement → Stock Intake → Shelf → Sale → Reporting

```
[1. NEED IDENTIFICATION]
  │
  ├── Automatic: System detects SKU below reorder point → generates reorder suggestion
  ├── Manual: Inventory Manager identifies need during daily review
  ├── AI: Demand forecast predicts upcoming spike (e.g., festival season) → proactive suggestion
  │
  ▼
[2. PURCHASE ORDER CREATION]
  │
  ├── Select supplier (system suggests best supplier based on price history, lead time, reliability score)
  ├── Auto-populate items, quantities (from reorder suggestion or manual selection)
  ├── Apply negotiated pricing / last purchase rate / supplier price list
  ├── Add terms: payment terms (30/60/90 days), delivery date, transport charges
  ├── Multi-branch PO: Specify delivery branch(es)
  ├── Approval: PO > ₹50,000 requires Owner approval (configurable threshold)
  ├── Send PO to supplier via WhatsApp / Email / Print
  │
  ▼
[3. GOODS RECEIPT / STOCK INTAKE]
  │
  ├── Supplier delivers goods with delivery challan / invoice
  ├── Inventory staff opens "Receive against PO" in app
  ├── Scan barcodes or manually enter items received
  ├── System shows expected vs. received quantities
  ├── Record discrepancies: short shipment, damaged goods, wrong items
  ├── For weighable items: integrate weighing scale → auto-capture weight
  ├── For items with batch/expiry: enter or scan batch number, manufacturing date, expiry date
  ├── System auto-assigns storage location (aisle/rack/bin) if warehouse mapping is configured
  ├── Accept delivery → system updates stock levels in real-time
  ├── Reject/partial reject → generates debit note / return-to-supplier record
  ├── Supplier invoice recorded → auto-maps to PO → accounts payable entry created
  │
  ▼
[4. SHELF / PRICING]
  │
  ├── Items move from receiving area to shelves (tracked if warehouse mapping is enabled)
  ├── Pricing: System applies MRP, selling price, or margin-based pricing rules
  ├── Promotional pricing: scheduled discounts, combo offers, bulk pricing
  ├── Barcode labels: print new labels if price changed or loose items need labeling
  ├── Near-expiry items: system auto-flags items within configurable window (e.g., 30 days)
  ├── Clearance pricing: owner/manager can set markdown rules for near-expiry
  │
  ▼
[5. IN-STORE SALE (POS)]
  │
  ├── Cashier scans barcode or searches item by name/code
  ├── Weighable items: scale transmits weight → POS calculates price
  ├── System applies applicable discounts, combo offers, loyalty points
  ├── Customer identified: phone number lookup → credit check → loyalty balance shown
  ├── Payment: UPI QR / Cash / Card / Split payment / Credit (if approved)
  ├── GST calculated automatically per item (5%, 12%, 18% based on HSN)
  ├── Receipt printed (thermal) or sent via WhatsApp/SMS
  ├── Inventory decremented in real-time
  ├── Cash drawer opens for cash transactions
  │
  ▼
[5B. ONLINE SALE (E-commerce)]
  │
  ├── Customer browses WhatsApp catalog or online storefront
  ├── Adds items to cart, selects delivery slot or pickup
  ├── Pays via UPI / online payment
  ├── Order received at store → staff picks and packs
  ├── Delivery: own delivery staff or Dunzo/Porter integration
  ├── Inventory decremented upon order confirmation
  ├── Customer receives delivery confirmation + invoice via WhatsApp
  │
  ▼
[6. REPORTING]
  │
  ├── Real-time: Sales dashboard updates live (total sales, items sold, payment method split)
  ├── Daily: Day-end summary auto-generated (sales, returns, collections, cash vs. digital)
  ├── Weekly: Stock movement report, slow-mover alerts, supplier payment reminders
  ├── Monthly: P&L summary, GST return data (GSTR-1, GSTR-3B), stock valuation
  ├── AI: Demand forecast for next 2 weeks, reorder suggestions, margin optimization alerts
```

## 4.2 Flow 2: Customer In-Store Purchase Journey

```
CUSTOMER ENTERS STORE
  │
  ├── [BROWSING] Customer picks items from shelves
  │
  ├── [WEIGHABLE ITEMS] Takes loose items (dal, rice, vegetables) to weighing counter
  │     ├── Staff places item on scale → weight captured
  │     ├── Label printed with item name, weight, price, barcode
  │     └── Customer proceeds to billing
  │
  ├── [BILLING]
  │     ├── Cashier scans items one by one (barcode scanner)
  │     ├── Manual items: search by name or code
  │     ├── Weighted items: scan label barcode → price auto-calculated
  │     ├── Cashier asks: "Phone number?" → customer gives number
  │     │     ├── Existing customer: loyalty points shown, credit balance shown
  │     │     └── New customer: quick registration (name + phone, 10 seconds)
  │     ├── Bill total displayed with GST breakup
  │     ├── Discount: automatic (scheme-based) or manual (manager override with PIN)
  │     └── Bag charge added (if applicable, per state regulation)
  │
  ├── [PAYMENT]
  │     ├── Customer chooses: Cash / UPI / Card / Wallet / Split
  │     ├── UPI: Dynamic QR displayed on customer-facing screen or printed
  │     │     ├── Customer scans, pays
  │     │     └── System auto-confirms payment (callback from payment gateway)
  │     ├── Cash: Cashier enters amount tendered → system calculates change
  │     ├── Card: POS terminal integration → swipe/tap → auto-confirmation
  │     ├── Credit: Cashier selects "Add to Khata" → requires manager approval if over limit
  │     └── Split: e.g., ₹500 cash + ₹300 UPI → system handles both
  │
  ├── [RECEIPT]
  │     ├── Thermal receipt printed automatically
  │     ├── Optional: WhatsApp receipt (digital invoice sent to customer's number)
  │     └── Receipt includes: items, prices, GST breakup, payment method, loyalty points earned
  │
  └── CUSTOMER EXITS
```

## 4.3 Flow 3: Credit (Khata) Lifecycle

```
[1. CREDIT ACCOUNT SETUP]
  │
  ├── Owner/Manager creates credit account for trusted customer
  ├── Sets credit limit (e.g., ₹5,000)
  ├── Links customer phone number
  ├── Optional: collects basic KYC (Aadhaar last 4 digits, address)
  ├── System generates initial credit score (based on: credit limit, account age)
  │
  ▼
[2. CREDIT PURCHASE]
  │
  ├── At billing, cashier identifies customer (phone number)
  ├── System shows: current credit balance, credit limit, credit score
  ├── If purchase amount ≤ remaining limit:
  │     ├── Cashier selects "Credit / Khata" as payment method
  │     ├── Bill added to customer's credit ledger
  │     └── Customer signs on screen (optional, configurable)
  ├── If purchase amount > remaining limit:
  │     ├── System blocks credit → shows warning
  │     ├── Manager can override with PIN (logged for audit)
  │     └── Or customer pays the excess via UPI/cash (split payment)
  │
  ▼
[3. CREDIT TRACKING]
  │
  ├── Customer's ledger shows all credit purchases with dates, amounts, items
  ├── Running balance visible to owner/manager at any time
  ├── Aging analysis: 0–30 days, 31–60 days, 61–90 days, 90+ days
  ├── Credit score adjusts: timely payments increase score; delays decrease
  │
  ▼
[4. PAYMENT COLLECTION]
  │
  ├── Customer walks in to pay: cash / UPI / partial payment
  ├── Cashier opens customer credit ledger → records payment
  ├── System applies payment against oldest invoices first (FIFO)
  ├── Receipt generated for payment
  ├── Alternatively: customer pays via UPI link sent on WhatsApp (self-service)
  │
  ▼
[5. REMINDERS & ESCALATION]
  │
  ├── Automated WhatsApp reminder at configurable intervals:
  │     ├── Day 7: Friendly reminder with balance
  │     ├── Day 15: Second reminder
  │     ├── Day 30: Firm reminder with aging detail
  │     ├── Day 45+: Escalation — Owner notified, credit limit auto-reduced
  ├── Owner can send manual reminder from app (one-tap WhatsApp message)
  ├── If customer consistently late: system suggests reducing credit limit or revoking
  │
  ▼
[6. SETTLEMENT / WRITE-OFF]
  │
  ├── Full settlement: balance becomes zero, credit score improved
  ├── Partial write-off: Owner marks amount as bad debt (accounting entry created)
  └── Credit revocation: Owner disables credit for customer (with reason logged)
```

## 4.4 Flow 4: Returns & Refunds

```
[1. RETURN INITIATED]
  │
  ├── In-store return:
  │     ├── Customer brings item + receipt (or receipt lookup by phone number / bill number)
  │     ├── Cashier opens "Returns" module
  │     ├── Scans original receipt barcode or searches by bill number
  │     └── Original bill details loaded
  ├── Online order return:
  │     ├── Customer initiates return via WhatsApp or storefront
  │     ├── Return request appears in store dashboard
  │     └── Staff approves/rejects based on return policy
  │
  ▼
[2. RETURN VALIDATION]
  │
  ├── System checks return policy rules:
  │     ├── Return window (e.g., 7 days from purchase for packaged goods)
  │     ├── Item category eligibility (no returns on perishables, opened personal care)
  │     ├── Quantity limits (cannot return more than purchased)
  │     └── Condition check (staff verifies item condition — sealed, unused, etc.)
  ├── If within policy → auto-approved
  ├── If outside policy → requires Manager approval with reason
  ├── If item is tampered/damaged by customer → rejection with reason logged
  │
  ▼
[3. REFUND PROCESSING]
  │
  ├── Refund method mirrors original payment:
  │     ├── Cash purchase → cash refund (cash drawer opens)
  │     ├── UPI purchase → UPI refund (initiated via payment gateway)
  │     ├── Card purchase → card refund (via POS terminal)
  │     ├── Credit purchase → credit balance adjusted
  ├── Alternatively: store credit issued (customer's wallet in SuperStore)
  ├── GST reversal: system auto-creates credit note with GST adjustment
  │
  ▼
[4. STOCK ADJUSTMENT]
  │
  ├── Returned item inspected:
  │     ├── Saleable condition → added back to inventory at original location
  │     ├── Damaged → moved to "damaged goods" inventory (separate tracking)
  │     ├── Expired → moved to "expired/waste" inventory
  ├── Stock levels updated in real-time
  │
  ▼
[5. REPORTING]
  │
  ├── Return entry linked to original sale for audit trail
  ├── Returns dashboard: daily/weekly return rate, top returned items, return reasons
  ├── High-return items flagged for quality review
  └── Refund amount reconciled in daily cash/payment reports
```

---

# 5. Detailed Workflows (Module-wise)

## 5.1 Module: Inventory Management

### 5.1.1 Item Master Setup

**Step-by-step flow:**

1. Navigate to Items → Add New Item.
2. Enter basic details: Item Name (multi-language), Item Code (auto-generated or manual), HSN/SAC Code, Category, Sub-category.
3. Set unit of measurement (UoM): pieces, kg, grams, liters, ml, meters, pack, dozen, box.
4. For weighable items: mark as "Weighable" → triggers scale integration at POS.
5. For items with variants: add variants (e.g., "Aavin Milk" → 500ml, 1L, 200ml).
6. Set pricing: MRP, Purchase Price, Selling Price, Wholesale Price. Configure margin-based pricing if needed.
7. Set tax: GST rate (0%, 5%, 12%, 18%, 28%), Cess (if applicable). System validates against HSN code.
8. Enable batch tracking if required (for FMCG, dairy, pharma items).
9. Enable expiry tracking: set expiry alert window (e.g., 30 days before expiry).
10. Set reorder point, reorder quantity, maximum stock level, minimum stock level.
11. Assign preferred supplier(s) with supplier item code and last purchase price.
12. Upload item image (used in online storefront and WhatsApp catalog).
13. Generate barcode (EAN-13 / Code 128) or map existing barcode.
14. Assign to branch(es) — multi-branch items can have different pricing per branch.
15. Save → item is live and available at POS, online storefront, and inventory modules.

**Edge cases:**

- **Duplicate barcode:** System checks for duplicates and warns. Same barcode can map to same item across branches but not to different items.
- **HSN code mismatch:** If HSN code doesn't match the selected GST rate per government database, system flags a warning (not blocking — rates change periodically).
- **Zero-price item:** Allowed for promotional/free items but requires manager confirmation.
- **Bulk import:** CSV/Excel upload for initial catalog setup. Template provided with validation rules. Errors shown line-by-line for correction.
- **Item discontinuation:** Soft-delete — item hidden from POS and orders but historical data retained. Hard-delete only if zero transactions.

**Offline scenario:**
- New items can be created offline. Synced on reconnect. If two users create the same item offline (rare), system flags a conflict for manual resolution.

### 5.1.2 Stock In (Goods Receipt)

**Step-by-step flow:**

1. Go to Inventory → Stock In → Receive Against PO (or Direct Stock In for non-PO purchases).
2. Select PO number → items, quantities, and pricing auto-populated.
3. For each item:
   a. Enter received quantity.
   b. If weighable: place on scale → weight captured automatically.
   c. Enter batch number and expiry date (if batch-tracked).
   d. Note discrepancies (short/excess/damaged).
4. System calculates: Total quantity expected vs. received, value variance.
5. For short shipments: create partial receipt → PO remains open for remaining items.
6. For excess delivery: accept (with note) or reject excess quantity.
7. For damaged goods: record damaged quantity → optionally create return-to-supplier.
8. Enter supplier invoice number and date (for accounting linkage).
9. Confirm receipt → stock levels updated immediately.
10. Supplier invoice auto-created in Accounts Payable with GST ITC (Input Tax Credit) implications.

**Edge cases:**

- **No PO (informal purchase):** Many Indian suppliers don't work with formal POs. "Direct Stock In" flow allows recording purchases without prior PO. Enter supplier, items, quantities, price, invoice number.
- **Cash purchase from local vendor:** No invoice available. Record as "Cash Purchase" with vendor name and amount. System flags these for GST reconciliation (no ITC available without invoice).
- **Free goods / samples:** Record with ₹0 purchase price, add note "sample" or "scheme free goods."
- **Items not in master:** Quick-add item during receipt — minimal fields (name, category, price, UoM), full details can be added later.

**Error handling:**

- Receipt quantity > PO quantity by more than configurable tolerance (e.g., 10%): warning shown, manager approval required.
- Batch number already exists for the same item: system warns and allows override if intentional (common in re-deliveries).
- Scale not connected: manual weight entry enabled with visual indicator that scale is offline.

**Offline scenario:**
- Full stock-in process works offline. Entries queued and synced when online. PO matching validated during sync — conflicts flagged for resolution.

### 5.1.3 Stock Movement & Transfer

**Step-by-step flow:**

1. Navigate to Inventory → Stock Transfer.
2. Select source branch and destination branch.
3. Add items: scan barcodes or search. Enter quantity to transfer.
4. System validates: sufficient stock at source, within transfer limits (if configured).
5. Generate Transfer Out note (at source branch).
6. Physical goods moved (by delivery vehicle, staff, etc.).
7. At destination: Receive Transfer → scan/verify items → accept or note discrepancies.
8. Stock decremented at source, incremented at destination upon acceptance.
9. If discrepancy: transit loss/damage recorded separately.

**Edge cases:**

- **Transfer in transit:** Stock in transit is tracked separately — not counted at either branch until received.
- **Partial receipt at destination:** Remaining items tracked as "in transit" until resolved.
- **Cross-branch stock visibility:** All users can view stock at other branches (read-only) to check availability before initiating transfer.

### 5.1.4 Expiry Management

**Step-by-step flow:**

1. System runs nightly check: identifies items within expiry alert window.
2. Dashboard widget: "Expiring Soon" with date-wise breakdown.
3. Auto-suggestions: mark down price for near-expiry items (configurable rule: e.g., 20% off if <15 days to expiry).
4. Items past expiry: auto-blocked from POS billing (configurable — block or warn).
5. Expired stock write-off: Manager initiates write-off → quantity removed from sellable stock → accounting entry for loss.
6. Expired goods disposal: record disposal date, quantity, method (returned to supplier, donated, discarded).

**Edge cases:**

- **Bulk expiry (supplier recall):** Batch-level recall — select batch number, all units across branches identified and blocked simultaneously.
- **Date-format confusion:** System standardizes DD/MM/YYYY across all interfaces (Indian format). No MM/DD/YYYY ambiguity.

### 5.1.5 Stock Valuation

SuperStore supports three valuation methods (configurable per item or globally):

- **FIFO (First In, First Out):** Default for perishable goods. Cost of oldest stock assigned to sales first.
- **LIFO (Last In, First Out):** Available but not default (less common in India, useful for specific scenarios).
- **Weighted Average Cost:** Default for non-perishable items. Running average of purchase prices.

The system maintains real-time stock valuation and generates reports showing: current stock value (by branch, by category, by item), cost of goods sold, gross margin per item/category.

---

## 5.2 Module: Billing / POS

### 5.2.1 POS Interface Design Principles

- **Optimized for speed:** Maximum 3 taps/scans to add an item. Target billing time: <90 seconds for a 15-item cart.
- **Touch-friendly:** Large buttons, finger-friendly targets (minimum 48dp touch area). Works on 10" tablets and 15" touchscreens.
- **Regional language:** Full UI in Tamil, Hindi, Kannada, Telugu, Marathi, Gujarati. Item names, categories, and button labels all localized.
- **Minimal training:** A new cashier should be productive within 30 minutes of guided tutorial.

### 5.2.2 Billing Flow (In-Store)

**Step-by-step:**

1. **Start new bill:** Cashier taps "New Bill" or system auto-creates on first item scan.
2. **Add items:**
   a. **Barcode scan:** Scanner reads barcode → item added to cart with quantity 1. Repeat scan increments quantity. If item not found, beep + "Item not found" message with option to add manually.
   b. **Manual search:** Type item name (supports fuzzy search and regional language search). Autocomplete suggestions appear after 2 characters.
   c. **Favorites grid:** Configurable quick-access grid of top 20–50 fast-moving items (with images). One tap to add.
   d. **Category browse:** Browse by category → sub-category → item. Useful for items without barcodes.
   e. **Weighable items:** Select item → system reads weight from connected scale → price auto-calculated. Alternatively, scan weight-embedded barcode (PLU format).
3. **Quantity adjustment:** Tap item in cart → +/- buttons or type quantity. For weighable items, re-weigh or type weight.
4. **Price override:** Requires manager PIN. Logged for audit. Configurable: allow price override above MRP (no), below MRP (yes, with PIN), below cost price (require owner approval).
5. **Discounts:**
   a. **Automatic:** System applies active schemes (buy 2 get 1, combo offers, loyalty discounts).
   b. **Manual line-level:** Cashier applies % or ₹ discount to specific item → requires manager PIN if above threshold.
   c. **Manual bill-level:** % or ₹ discount on total bill → requires manager PIN.
   d. **Coupon code:** Enter/scan coupon → validated against active promotions.
6. **Customer identification:** Cashier enters phone number → customer profile loaded → name displayed ("Welcome, Lakshmi!") → loyalty points shown → credit eligibility shown.
7. **Bill total:** System shows: subtotal, discount, taxable amounts by GST slab, CGST, SGST (intra-state) or IGST (inter-state), cess, grand total, savings on discounts, loyalty points earned.
8. **Payment:** (See section 5.2.3)
9. **Receipt:** (See section 5.2.4)
10. **Bill finalized:** Inventory decremented, accounting entries posted, customer loyalty updated.

**Edge cases:**

- **Item with multiple tax rates:** Some combo packs contain items with different GST rates. System allows splitting — or applying the highest rate (configurable per business rule).
- **MRP change mid-day:** Owner updates MRP — all new bills use new MRP. Bills already in progress use MRP at the time item was added.
- **Barcode scanner disconnects:** POS shows "Scanner offline" banner. Cashier can continue with manual search. Reconnection auto-detected.
- **Power cut during billing:** Offline mode maintains bill in local storage. On power restore (with UPS), bill is intact. If device shuts down without UPS, auto-save ensures last bill state is recoverable.

### 5.2.3 Payment Processing

**Supported payment methods:**

| Method | Flow | Integration |
|---|---|---|
| **Cash** | Cashier enters amount tendered → system calculates change → cash drawer opens | Cash drawer via USB/Bluetooth |
| **UPI (QR)** | Dynamic QR generated with exact amount → displayed on customer-facing screen or printed → customer scans with any UPI app → payment callback confirms | Razorpay / PayU / Juspay gateway |
| **UPI (Collect)** | Cashier enters customer UPI ID → collect request sent → customer approves on phone | Same gateway |
| **Card (Debit/Credit)** | Amount pushed to POS terminal → customer taps/swipes/inserts → terminal confirms | Pine Labs / Mswipe / Paytm terminal |
| **Wallet** | Paytm / PhonePe / Amazon Pay → via QR or customer number | Respective SDKs or aggregator |
| **Store Credit** | Deducted from customer's credit balance in SuperStore | Internal |
| **Credit (Khata)** | Added to customer's credit ledger → requires credit limit check and optional manager approval | Internal |
| **Split Payment** | Any combination of above (e.g., ₹500 cash + ₹300 UPI) | Internal orchestration |

**Error handling:**

- **UPI payment timeout (>120 seconds):** System cancels QR, offers retry or alternative payment.
- **UPI payment confirmed but gateway callback delayed:** Bill marked "Payment pending verification." Auto-reconciled when callback arrives (typically <5 minutes). Cashier can proceed to next customer.
- **Card terminal offline:** Prompt cashier to offer UPI or cash. Do not block the sale.
- **Cash drawer doesn't open:** Manual open button on screen + physical key override on drawer.

**Offline scenario:**
- **Cash:** Works fully offline. Cash drawer command sent locally.
- **UPI:** NOT available offline (requires internet). System hides UPI option when offline.
- **Card:** Depends on terminal — some terminals have offline authorization. SuperStore communicates terminal status.
- **Credit:** Works offline (local credit limit check). Synced when online.

### 5.2.4 Receipt & Invoice

**Thermal receipt includes:**
- Store name, address, GSTIN, branch name
- Bill number, date, time
- Cashier name/ID
- Item-wise: name, HSN, quantity, rate, discount, GST rate, amount
- Subtotal, discount total, GST breakup (CGST + SGST or IGST), grand total
- Payment method(s)
- Loyalty points earned / redeemed
- QR code linking to digital invoice
- Store-configurable footer (return policy, contact info, promo message)

**Digital receipt (WhatsApp/SMS):**
- Auto-sent to identified customer's phone number (configurable: always, on-demand, never)
- Contains: bill summary, PDF invoice link, feedback link
- WhatsApp message template pre-approved for transactional messaging

### 5.2.5 Day-End / Shift-End Operations

**Z-Report (End of Day):**

1. Cashier or manager initiates "Close Register."
2. System prompts physical cash count — cashier enters denominations.
3. System compares: expected cash (based on cash sales) vs. counted cash.
4. Variance shown: shortage / excess with amount.
5. If variance > configurable threshold (e.g., ₹100): requires manager acknowledgment with reason.
6. UPI / card totals reconciled against gateway reports (auto-fetched).
7. Z-report generated: total sales, payment method breakdown, returns, discounts, cash variance.
8. Register closed → cash carried forward or deposited.

---

## 5.3 Module: GST + Accounting

### 5.3.1 GST Configuration

**Setup:**
1. Enter business GSTIN, Legal Name, Trade Name, State.
2. Configure tax preferences: composition scheme (if applicable), regular scheme.
3. For multi-state operations: enter GSTIN per state.
4. HSN code master: preloaded with government HSN code database. Auto-suggest as user types item name.
5. Tax rate mapping: each item linked to HSN → GST rate derived automatically. Override available for special cases.

### 5.3.2 Automated GST Calculation

- **Intra-state sale:** CGST + SGST (equal split of total GST rate). E.g., 18% GST = 9% CGST + 9% SGST.
- **Inter-state sale:** IGST (full rate). E.g., 18% GST = 18% IGST.
- **Composition scheme:** No GST charged to customers. Quarterly composition tax calculated on turnover.
- **Exempt / nil-rated items:** No tax. System tracks for reporting.
- **Reverse charge:** For specified goods/services, buyer pays GST. System flags and calculates.

### 5.3.3 Invoice Types

| Invoice Type | When Used | Key Fields |
|---|---|---|
| Tax Invoice | B2B sales > ₹2.5L or any sale where buyer needs ITC | Full GST breakup, buyer GSTIN |
| Bill of Supply | Sales under composition scheme or exempt goods | No GST breakup |
| Credit Note | Returns, post-sale discounts | Links to original invoice |
| Debit Note | Price increase after sale, additional charges | Links to original invoice |
| E-Invoice | Mandatory for turnover > ₹5 Cr (as of 2024) | IRN from NIC portal |
| E-Way Bill | Goods movement > ₹50,000 | Vehicle number, route details |

### 5.3.4 GST Return Data Preparation

**GSTR-1 (Outward supplies):**
- Auto-compiled from all sales invoices.
- Categorized: B2B (with buyer GSTIN), B2C large (>₹2.5L inter-state), B2C small, credit/debit notes, exports, nil-rated/exempt.
- Export-ready format: JSON for GST portal upload, Excel for CA review.
- Reconciliation: system flags mismatches between saved invoices and return data.

**GSTR-3B (Summary return):**
- Auto-populated from sales and purchase data.
- Tax liability: output tax from sales minus ITC from purchases.
- ITC reconciliation: GSTR-2A/2B auto-matched with purchase records. Mismatches flagged.
- Filing support: data exported for direct upload or shared with CA.

### 5.3.5 Accounting Engine

**Double-entry system:**
Every transaction in SuperStore auto-generates double-entry accounting entries.

| Transaction | Debit | Credit |
|---|---|---|
| Cash sale | Cash A/c | Sales A/c + GST Output A/c |
| UPI sale | Payment Gateway A/c | Sales A/c + GST Output A/c |
| Credit sale | Customer (Debtor) A/c | Sales A/c + GST Output A/c |
| Purchase (credit) | Purchase A/c + GST Input A/c | Supplier (Creditor) A/c |
| Purchase (cash) | Purchase A/c + GST Input A/c | Cash A/c |
| Customer payment received | Cash/Bank A/c | Customer (Debtor) A/c |
| Supplier payment made | Supplier (Creditor) A/c | Cash/Bank A/c |
| Sales return | Sales Return A/c + GST Output A/c (reversal) | Customer A/c or Cash A/c |
| Stock write-off (expiry) | Loss on Expired Goods A/c | Inventory A/c |

**Chart of Accounts:**
Pre-configured chart of accounts suitable for Indian retail:
- Assets: Cash, Bank (multiple accounts), Accounts Receivable, Inventory, Fixed Assets
- Liabilities: Accounts Payable, GST Payable (CGST, SGST, IGST), Loans
- Income: Sales, Other Income
- Expenses: Purchases, Salaries, Rent, Electricity, Transport, Shrinkage/Loss
- Customizable: owners can add/rename accounts.

**Bank Reconciliation:**
- Import bank statements (CSV/OFX) or connect via account aggregator.
- Auto-match: system matches bank transactions with SuperStore entries by amount, date, reference.
- Unmatched items flagged for manual review.

---

## 5.4 Module: Supplier Management

### 5.4.1 Supplier Master

**Fields:** Supplier Name, GSTIN (validated against GST portal format), PAN, Contact Person, Phone, Email, WhatsApp Number, Address (with PIN code), Bank Details (for NEFT/RTGS payments), Payment Terms (default: 30 days), Supplier Category (distributor, wholesaler, manufacturer, local vendor), Items Supplied (linked to item master), Supply Territory (which branches this supplier serves).

### 5.4.2 Supplier Price Management

- **Price list per supplier:** Each supplier can have a price list for items they supply. Updated manually or via supplier price list import (Excel).
- **Price comparison:** When creating a PO, system shows price from all configured suppliers for the selected item. Visual comparison: current price vs. last 3 purchase prices vs. other suppliers.
- **Price history:** Track supplier price changes over time. Alert when a supplier increases price above a configurable threshold.

### 5.4.3 Supplier Performance Scoring

Automated scoring based on:
- **Delivery reliability:** % of POs delivered on time.
- **Quantity accuracy:** % of POs with correct quantity (no short shipments).
- **Quality:** % of deliveries with no damaged/expired goods.
- **Price competitiveness:** Average price relative to other suppliers for same items.
- **Credit terms:** Payment flexibility offered.

Score displayed on supplier profile (1–5 stars). Used in PO suggestions.

### 5.4.4 Supplier Payments

- **Accounts payable dashboard:** All pending supplier payments with aging (0–30, 31–60, 61–90, 90+ days).
- **Payment scheduling:** Set payment dates, get reminders.
- **Payment recording:** Record payments (cheque, NEFT, UPI, cash) → linked to specific invoices.
- **Early payment discount tracking:** If supplier offers 2% discount for payment within 10 days, system tracks eligibility window and alerts owner.

---

## 5.5 Module: Customer Management

### 5.5.1 Customer Profile

**Fields:** Name, Phone (primary key), Email, WhatsApp Number (auto-populated from phone), Address, Customer Type (walk-in, regular, credit, wholesale), Loyalty Points Balance, Credit Limit, Credit Balance, Credit Score, Purchase History, Preferred Branch, Notes.

**Quick registration at POS:** Phone number + Name only (10 seconds). Additional details captured later.

### 5.5.2 Loyalty Program

- **Points earning:** Configurable: ₹1 = 1 point, or ₹100 = 1 point, or custom rules per category.
- **Points redemption:** 100 points = ₹1 (configurable). Redeem at billing. Minimum redemption threshold configurable.
- **Tier system (optional):** Bronze / Silver / Gold based on annual spend. Higher tiers earn faster and get exclusive offers.
- **Birthday/anniversary offers:** Auto-triggered WhatsApp message with special offer.

### 5.5.3 WhatsApp Engagement

- **Transactional:** Bill receipt, payment confirmation, delivery update.
- **Promotional:** Weekly offers, festival deals, new arrivals (requires customer opt-in, compliant with WhatsApp Business API policies).
- **Reminder:** Credit payment due, loyalty points expiring.
- **Two-way ordering:** Customer messages store WhatsApp → catalog shared → order placed → payment link → delivery updates. (Detailed in Module 5.10)

---

## 5.6 Module: Purchase Orders (PO)

### 5.6.1 PO Creation Flow

1. Inventory Manager or system (via reorder suggestion) initiates PO.
2. Select supplier → items auto-suggested based on reorder needs + supplier's item catalog.
3. Enter quantities (system pre-fills reorder quantity if from auto-suggestion).
4. Pricing: last purchase price auto-filled; override allowed.
5. Add terms: delivery date, payment terms, transport charges, notes.
6. For multi-branch orders: specify delivery branch per item or for entire PO.
7. PO total calculated with GST.
8. **Approval flow:** PO below threshold → auto-approved. PO above threshold → routed to Owner for approval (push notification + WhatsApp alert).
9. Owner reviews → approves / rejects / modifies.
10. Approved PO sent to supplier: WhatsApp (PDF attached) / Email / Print.

### 5.6.2 PO Tracking

- **Status:** Draft → Pending Approval → Approved → Sent to Supplier → Partially Received → Fully Received → Closed.
- **Follow-up:** If delivery date passes without receipt, system alerts Inventory Manager + sends automated follow-up WhatsApp to supplier.
- **PO amendment:** Can be amended before full receipt. Amendment history tracked.
- **PO cancellation:** Allowed before any receipt. After partial receipt, cancellation closes remaining items.

---

## 5.7 Module: Sales Orders (SO)

### 5.7.1 Use Cases for Sales Orders in a Supermarket Context

- **Bulk / wholesale orders:** A restaurant or canteen orders large quantities for weekly delivery.
- **Pre-orders:** Customers order specific items not currently in stock (imported goods, festival specials).
- **Online orders:** Orders from WhatsApp, online storefront, or marketplace (Swiggy Instamart, Dunzo).
- **Standing orders:** Recurring orders from regular customers (e.g., office pantry supplies every Monday).

### 5.7.2 SO Creation Flow

1. Created from: POS (cashier creates for walk-in bulk order), Online storefront, WhatsApp, Marketplace integration, or manually by Manager.
2. Select customer → add items → set delivery date → set delivery method (pickup / own delivery / third-party delivery).
3. Payment: advance payment, full prepaid, or COD / credit.
4. SO confirmed → stock reserved (soft allocation — not decremented until dispatch).
5. Picking list generated for store staff.
6. Staff picks items → confirms picked quantities → packs order.
7. Dispatch / handover to delivery → status updated.
8. Customer notified at each stage via WhatsApp.
9. Delivery confirmed → inventory decremented → invoice generated → payment settled.

---

## 5.8 Module: Stock Audit / Stock Take

### 5.8.1 Full Stock Count

**Step-by-step:**

1. Manager schedules stock count → system freezes stock movements (optional — can also count during operations with variance tracking).
2. System generates count sheets: organized by aisle → rack → bin (if warehouse mapped) or by category.
3. Staff uses mobile app to count:
   a. Scan item barcode → enter counted quantity.
   b. For weighable items: weigh on scale → enter weight.
   c. For items without barcode: search by name.
4. System compares: system quantity vs. counted quantity.
5. Variance report generated: item-wise with shortage / excess, value of variance.
6. Manager reviews → approves adjustments.
7. Stock adjusted → accounting entries for shrinkage (loss) or surplus posted.

### 5.8.2 Cycle Count (Partial Audit)

Instead of counting all items at once (which disrupts operations), cycle counting lets stores count a subset regularly:

- **ABC analysis-based:** A items (top 20% by value) counted weekly. B items monthly. C items quarterly.
- **Category rotation:** Different category each day.
- **Random sampling:** System selects random items for verification.

### 5.8.3 Variance Analysis

- **Shrinkage rate:** Track shrinkage % over time (industry benchmark for Indian supermarkets: 1.5–3%).
- **Category-wise shrinkage:** Identify which categories have highest loss (typically fresh produce, personal care).
- **Time-based patterns:** Shrinkage by shift / day of week (to identify theft patterns).
- **Threshold alerts:** If single-item variance > configurable % → auto-alert to owner.

---

## 5.9 Module: Multi-Location / Multi-Branch Support

### 5.9.1 Branch Setup

- Each branch has: unique Branch Code, Name, Address, GSTIN (same or different per state), assigned staff, assigned inventory, POS terminals.
- **Central configuration:** Item master, pricing rules, tax configuration, supplier list — managed centrally, inherited by all branches. Branch-specific overrides allowed (e.g., different selling price at Branch 2 due to local competition).
- **Branch-specific settings:** Operating hours, receipt footer text, delivery zones.

### 5.9.2 Cross-Branch Capabilities

| Capability | Description |
|---|---|
| **Unified dashboard** | Owner sees sales, stock, cash across all branches on one screen |
| **Cross-branch stock view** | Any user can view stock at other branches (read-only) |
| **Inter-branch transfer** | Transfer stock with full audit trail (see section 5.1.3) |
| **Cross-branch reporting** | Consolidated P&L, sales comparison, stock valuation across branches |
| **Centralized purchasing** | Single PO for multiple branches with split delivery |
| **Customer portability** | Customer profile, loyalty points, credit balance work across branches |
| **Staff assignment** | Staff can be assigned to one or more branches. Branch-level access control. |

### 5.9.3 Data Architecture for Multi-Branch

- **Tenant model:** Single tenant per business owner (even with multiple branches). All branches share the same database with branch_id as partition key.
- **Sync model:** Each branch's POS operates independently (offline-capable). Data syncs to cloud in real-time when online. Cross-branch queries served from cloud.
- **Conflict resolution:** If same item edited at two branches simultaneously, last-write-wins for non-critical fields (description, image). For critical fields (price, stock quantity), conflict flagged for manual resolution.

---

## 5.10 Module: E-Commerce Integrations

### 5.10.1 Own White-Label Online Storefront

**Features:**
- **Customizable storefront:** Store name, logo, colors, banner images. Custom domain (e.g., shop.rajeshsupermarket.in) or subdomain (rajesh.superstore.in).
- **Product catalog:** Synced from SuperStore item master. Prices, images, descriptions, availability — all auto-updated.
- **Category navigation:** Browse by department (Groceries, Dairy, Personal Care, etc.).
- **Search:** Full-text search with fuzzy matching and regional language support.
- **Cart & checkout:** Add to cart → select delivery slot (2-hour windows) or pickup → enter address → pay (UPI / card / COD).
- **Delivery zones:** Store owner configures delivery radius (e.g., 5 km). Pin code-based zone mapping.
- **Delivery charges:** Configurable: free above ₹X, flat fee, distance-based.
- **Order tracking:** Customer sees order status: Confirmed → Picking → Packed → Out for Delivery → Delivered.

### 5.10.2 WhatsApp Commerce

**How it works:**

1. **Discovery:** Customer messages store WhatsApp number (or clicks WhatsApp link from store's Google My Business / social media / physical store signage).
2. **Catalog share:** Store auto-responds with product catalog (WhatsApp Business API catalog feature) or a link to web-based catalog.
3. **Order placement:** Customer selects items and quantities → sends order message.
4. **Order parsing:** SuperStore's backend parses WhatsApp message using NLP + structured buttons → creates draft SO.
5. **Confirmation:** Store staff reviews → confirms availability → confirms total with delivery charges → sends payment link.
6. **Payment:** UPI payment link (Razorpay / PayU) sent in WhatsApp → customer pays → payment confirmed.
7. **Fulfillment:** Picking → packing → delivery (own staff or Dunzo/Porter).
8. **Status updates:** WhatsApp messages at each stage.
9. **Post-delivery:** Invoice PDF sent via WhatsApp. Feedback request.

**Technical requirements:**
- WhatsApp Business API account (Meta-approved BSP).
- Message template approval for transactional and promotional messages.
- Webhook integration for incoming messages.
- NLP parsing for unstructured messages (e.g., "send me 2 kg rice and 1 Aavin milk").

### 5.10.3 Marketplace Integrations

| Marketplace | Integration Type | Data Flow |
|---|---|---|
| **Swiggy Instamart** | API integration | Orders received → mapped to SuperStore inventory → accepted/rejected → picked → handed to Swiggy delivery |
| **Dunzo** | API integration (delivery only) | SuperStore dispatches delivery → Dunzo picks up → delivers → tracking shared with customer |
| **BigBasket** | API integration | Catalog sync + order flow (similar to Swiggy) |
| **JioMart Partner** | API integration | Store listed on JioMart → orders flow in → fulfilled from store inventory |

**Inventory sync concern:** Online orders must check real-time stock to avoid overselling. A configurable "safety buffer" (e.g., show only 80% of actual stock online) prevents oversell during high-traffic periods.

---

## 5.11 Module: Payments

(Covered in detail in section 5.2.3 for POS payments and section 9.1 for gateway integrations.)

**Additional payment features:**

- **Payment reconciliation dashboard:** Daily auto-reconciliation of UPI (Razorpay settlement vs. billed UPI transactions), card (Pine Labs settlement vs. card transactions), cash (expected vs. counted).
- **Settlement tracking:** Payment gateways settle in T+1 or T+2. System tracks expected settlement date and amount. Flags if settlement doesn't arrive.
- **Refund tracking:** UPI refunds (2–5 business days), card refunds (5–7 business days) tracked with status.

---

## 5.12 Module: Reporting & Analytics

(Full detail in Section 11)

---

# 6. Feature Breakdown (Module-wise)

## 6.1 Inventory Management

| # | Feature | Description | Priority | Dependencies |
|---|---|---|---|---|
| INV-01 | Item Master CRUD | Create, read, update, soft-delete items with full attributes (name, barcode, HSN, UoM, tax, pricing, images, variants) | P0 | None |
| INV-02 | Barcode Generation | Generate EAN-13 / Code 128 barcodes for items without existing barcodes; print barcode labels | P0 | INV-01, Printer integration |
| INV-03 | Barcode Scanning | Scan barcodes via USB/Bluetooth scanner or device camera to identify items | P0 | INV-01 |
| INV-04 | Batch & Expiry Tracking | Track manufacturing date, batch number, expiry date per stock lot; alert on near-expiry | P0 | INV-01 |
| INV-05 | Multi-UoM Support | Support multiple units (kg, g, L, ml, piece, pack, dozen) with conversion factors | P0 | INV-01 |
| INV-06 | Stock In (GRN) | Record goods received against PO or direct purchase; discrepancy handling | P0 | INV-01, PO module |
| INV-07 | Stock Out (Sale) | Auto-decrement stock on sale; FIFO/weighted average cost assignment | P0 | INV-01, POS module |
| INV-08 | Stock Transfer (Inter-Branch) | Transfer stock between branches with transit tracking | P0 | INV-01, Multi-branch module |
| INV-09 | Reorder Point & Level | Set min/max stock, reorder point per item per branch; low-stock alerts | P0 | INV-01 |
| INV-10 | Stock Valuation (FIFO/LIFO/Avg) | Real-time stock valuation using selected costing method | P0 | INV-01, INV-06, INV-07 |
| INV-11 | Bulk Item Import (CSV/Excel) | Import item master data from CSV/Excel with validation and error reporting | P1 | INV-01 |
| INV-12 | Expiry Alert & Auto-Markdown | Automated alerts for near-expiry items; auto-suggest/apply markdown pricing | P1 | INV-04 |
| INV-13 | Dead Stock Detection | Identify items with zero or negligible sales in configurable period (e.g., 90 days) | P1 | INV-01, INV-07 |
| INV-14 | Category & Sub-category Hierarchy | Multi-level category tree for item organization (Department → Category → Sub-category) | P0 | None |
| INV-15 | Item Image Management | Upload, store, and display item images (used in POS search, online storefront, WhatsApp catalog) | P1 | INV-01, Cloud storage |
| INV-16 | Weighable Item Support | Mark items as weighable; integrate with electronic scale for auto weight capture | P0 | INV-01, Scale hardware |
| INV-17 | Negative Inventory Prevention | Configurable: block sale if stock is zero (default) or allow negative inventory with alert | P1 | INV-01 |
| INV-18 | Stock Adjustment (Manual) | Manual stock increase/decrease with reason code (damage, theft, misccount, sample, donation) | P0 | INV-01 |
| INV-19 | Stock Movement History | Complete audit trail of every stock change: who, when, what, why, how many | P0 | INV-01 |
| INV-20 | Warehouse/Location Mapping | Map physical locations (aisle, rack, bin) to items for efficient picking and counting | P2 | INV-01 |

## 6.2 Billing / POS

| # | Feature | Description | Priority | Dependencies |
|---|---|---|---|---|
| POS-01 | Touch POS Interface | Touch-optimized billing screen with item search, cart, payment, and receipt | P0 | INV-01 |
| POS-02 | Barcode Scan to Bill | Scan item barcode to add to bill; repeat scan increments quantity | P0 | INV-03 |
| POS-03 | Quick Item Favorites | Configurable grid of top-selling items for one-tap add | P0 | INV-01 |
| POS-04 | Customer Identification (Phone) | Lookup customer by phone number; show name, loyalty, credit status | P0 | CRM module |
| POS-05 | Multi-Payment Support | Accept cash, UPI, card, wallet, credit, store credit in single bill (split payments) | P0 | Payment gateway integration |
| POS-06 | UPI QR Payment | Generate dynamic QR with amount; auto-confirm via gateway callback | P0 | Payment gateway |
| POS-07 | Cash Management | Cash tendered, change calculation, cash drawer control | P0 | Cash drawer hardware |
| POS-08 | Thermal Receipt Printing | Print itemized receipt with GST breakup on thermal printer | P0 | Printer hardware |
| POS-09 | WhatsApp Digital Receipt | Send bill as WhatsApp message / PDF to customer | P1 | WhatsApp Business API |
| POS-10 | Discount Management | Auto-apply schemes + manual discounts (line/bill level) with PIN authorization | P0 | None |
| POS-11 | Weighing Scale Integration | Read weight from connected scale and auto-calculate price | P0 | Scale hardware |
| POS-12 | Price Override with Audit | Allow price changes with manager PIN; fully logged | P0 | None |
| POS-13 | Hold & Recall Bill | Hold current bill (customer forgot wallet), start new bill, recall held bill later | P1 | None |
| POS-14 | Return & Refund at POS | Process returns against original bill; refund via original payment method or store credit | P0 | INV-01 |
| POS-15 | Day-End Z-Report | Shift/day closing: cash count, payment reconciliation, variance report | P0 | None |
| POS-16 | Offline Billing | Full billing, inventory lookup, and receipt printing without internet | P0 | Local data sync |
| POS-17 | Customer-Facing Display | Second screen showing items being billed, total, payment QR | P2 | Second display hardware |
| POS-18 | Regional Language UI | POS interface in Tamil, Hindi, Kannada, Telugu, Marathi, Gujarati | P0 | Localization framework |
| POS-19 | Multi-Terminal Support | Multiple POS terminals per branch, each independently operational | P1 | Multi-branch arch |
| POS-20 | Bill Reprint & Duplicate | Reprint any past bill (thermal or PDF) | P1 | None |

## 6.3 GST + Accounting

| # | Feature | Description | Priority | Dependencies |
|---|---|---|---|---|
| GST-01 | Auto GST Calculation | Calculate CGST+SGST or IGST per item based on HSN code and transaction type | P0 | INV-01 |
| GST-02 | HSN Code Master | Preloaded HSN database with auto-suggest; validated GST rate mapping | P0 | None |
| GST-03 | E-Invoice Generation | Generate e-invoice via NIC API; obtain IRN | P0 (if turnover > ₹5Cr) | NIC API integration |
| GST-04 | E-Way Bill Generation | Generate e-way bill for goods movement > ₹50,000 | P1 | NIC API integration |
| GST-05 | GSTR-1 Data Export | Auto-compile outward supply data; export as JSON/Excel for GST portal | P0 | POS, Sales data |
| GST-06 | GSTR-3B Data Export | Auto-compile summary return data with ITC reconciliation | P0 | Purchase + Sales data |
| GST-07 | ITC Reconciliation (2A/2B) | Match GSTR-2A/2B with purchase records; flag mismatches | P1 | Supplier invoices |
| GST-08 | Credit Note / Debit Note | Generate GST-compliant credit/debit notes linked to original invoices | P0 | POS-14 |
| GST-09 | Double-Entry Accounting | Auto-generated journal entries for every transaction | P0 | All modules |
| GST-10 | Chart of Accounts | Pre-configured + customizable chart of accounts for Indian retail | P0 | None |
| GST-11 | Bank Reconciliation | Import bank statements; auto-match with system entries | P1 | Bank statement import |
| GST-12 | P&L Statement | Real-time profit & loss statement (branch-wise, consolidated) | P0 | GST-09 |
| GST-13 | Balance Sheet | Auto-generated balance sheet | P1 | GST-09 |
| GST-14 | Cash Flow Statement | Track cash inflows/outflows with categorization | P1 | GST-09 |
| GST-15 | Multi-Currency Support | For import purchases (uncommon but needed for some supermarkets importing goods) | P2 | None |
| GST-16 | Tally Export | Export accounting data in Tally-compatible format for CAs still using TallyPrime | P1 | GST-09 |

## 6.4 Supplier Management

| # | Feature | Description | Priority | Dependencies |
|---|---|---|---|---|
| SUP-01 | Supplier Master CRUD | Full supplier profile with GSTIN validation, contact, bank details, terms | P0 | None |
| SUP-02 | Supplier Price List | Maintain item-wise price list per supplier; import from Excel | P0 | INV-01 |
| SUP-03 | Price Comparison | Compare prices across suppliers for same item at PO creation time | P1 | SUP-02 |
| SUP-04 | Supplier Performance Score | Auto-calculated score based on delivery reliability, quality, price | P1 | PO module |
| SUP-05 | Accounts Payable Dashboard | All pending payments with aging, due dates, early payment discount tracking | P0 | GST-09 |
| SUP-06 | Payment Recording | Record supplier payments (cash/cheque/NEFT/UPI) linked to invoices | P0 | GST-09 |
| SUP-07 | Supplier Communication Log | Track all communications: POs sent, follow-ups, price negotiations | P2 | PO module |
| SUP-08 | Supplier WhatsApp Integration | Send POs, follow-ups, payment confirmations via WhatsApp | P1 | WhatsApp API |

## 6.5 Customer Management

| # | Feature | Description | Priority | Dependencies |
|---|---|---|---|---|
| CRM-01 | Customer Profile CRUD | Name, phone, email, address, type, purchase history, loyalty, credit | P0 | None |
| CRM-02 | Quick Registration at POS | Phone + Name in 10 seconds during billing | P0 | POS-04 |
| CRM-03 | Credit / Khata Management | Credit limit setting, credit purchases, ledger, aging, WhatsApp reminders | P0 | POS-05 |
| CRM-04 | Loyalty Points Program | Earn & redeem points; configurable rules; tier system | P1 | POS module |
| CRM-05 | Customer Purchase History | Full transaction history; last purchased items; average basket size | P0 | POS module |
| CRM-06 | WhatsApp Engagement | Transactional messages (receipt, payment), reminders, promotions | P1 | WhatsApp API |
| CRM-07 | Credit Risk Scoring | AI-based score using payment history, frequency, outstanding amount, aging | P1 | CRM-03 data |
| CRM-08 | Customer Segmentation | Auto-segment: high-value, at-risk, dormant, new, credit-heavy | P2 | CRM-05 data |
| CRM-09 | Birthday/Anniversary Offers | Auto-triggered WhatsApp greetings with special coupon | P2 | CRM-01, CRM-06 |

## 6.6 Purchase Orders

| # | Feature | Description | Priority | Dependencies |
|---|---|---|---|---|
| PO-01 | PO Creation | Create PO with supplier, items, quantities, pricing, terms, delivery branch | P0 | INV-01, SUP-01 |
| PO-02 | PO from Reorder Suggestion | One-click PO generation from system's reorder suggestions | P0 | INV-09 |
| PO-03 | PO Approval Workflow | Configurable approval threshold; Owner approval via push/WhatsApp notification | P0 | Notification system |
| PO-04 | PO Status Tracking | Draft → Approved → Sent → Partially Received → Fully Received → Closed | P0 | INV-06 |
| PO-05 | PO Communication (WhatsApp/Email) | Send PO PDF to supplier via WhatsApp or email | P1 | WhatsApp API |
| PO-06 | PO Amendment & History | Amend PO before full receipt; full amendment audit trail | P1 | PO-01 |
| PO-07 | Multi-Branch PO | Single PO with split delivery across branches | P1 | Multi-branch |
| PO-08 | Auto-Follow-Up | System sends supplier reminder if delivery date passes | P2 | PO-04, WhatsApp API |

## 6.7 Sales Orders

| # | Feature | Description | Priority | Dependencies |
|---|---|---|---|---|
| SO-01 | SO Creation (Manual) | Create SO for bulk/wholesale orders from POS or manager interface | P0 | INV-01, CRM-01 |
| SO-02 | SO from Online Storefront | Auto-create SO from customer's online order | P0 | E-commerce module |
| SO-03 | SO from WhatsApp | Parse WhatsApp order messages into structured SO | P1 | WhatsApp API, NLP |
| SO-04 | SO from Marketplace | Receive and create SO from Swiggy/Dunzo/BigBasket orders | P1 | Marketplace API |
| SO-05 | Stock Reservation | Soft-reserve inventory for confirmed SO until fulfillment | P0 | INV module |
| SO-06 | Picking List Generation | Generate picking list for store staff; organized by aisle/location | P1 | INV-20, SO-01 |
| SO-07 | Order Status Tracking | Confirmed → Picking → Packed → Dispatched → Delivered → Completed | P0 | SO-01 |
| SO-08 | Delivery Management | Assign delivery staff; track delivery; proof of delivery | P1 | Delivery module |
| SO-09 | Standing Orders | Recurring orders for regular customers (e.g., weekly pantry supplies) | P2 | SO-01, CRM-01 |

## 6.8 Stock Audit

| # | Feature | Description | Priority | Dependencies |
|---|---|---|---|---|
| AUD-01 | Full Stock Count | Generate count sheets; mobile-based counting; variance calculation | P0 | INV-01 |
| AUD-02 | Cycle Count | Partial audits: ABC-based, category rotation, random sampling | P1 | INV-01, Analytics |
| AUD-03 | Barcode-Assisted Counting | Scan item barcode → enter count → auto-compare with system stock | P0 | INV-03 |
| AUD-04 | Variance Report | Item-wise variance with value; shrinkage % calculation | P0 | AUD-01 |
| AUD-05 | Stock Adjustment from Audit | Approve variance → auto-adjust stock with accounting entries | P0 | AUD-04, GST-09 |
| AUD-06 | Shrinkage Trending | Track shrinkage rate over time; category-wise; shift-wise patterns | P1 | AUD-04 data |

## 6.9 Multi-Location

| # | Feature | Description | Priority | Dependencies |
|---|---|---|---|---|
| ML-01 | Branch Setup & Config | Create branches with address, GSTIN, staff, settings | P0 | None |
| ML-02 | Centralized Item Master | Single item catalog shared across branches; branch-level overrides for pricing | P0 | INV-01 |
| ML-03 | Unified Owner Dashboard | Cross-branch view: sales, stock, cash, top items, alerts — one screen | P0 | All modules |
| ML-04 | Inter-Branch Stock Transfer | (Same as INV-08) | P0 | INV-01 |
| ML-05 | Cross-Branch Reporting | Consolidated + comparative reports across branches | P0 | Reporting module |
| ML-06 | Branch-Level Access Control | Staff see only their branch data; managers see assigned branches; owner sees all | P0 | Auth module |
| ML-07 | Centralized Purchasing | PO for multiple branches in one flow | P1 | PO module |

## 6.10 E-Commerce

| # | Feature | Description | Priority | Dependencies |
|---|---|---|---|---|
| EC-01 | White-Label Storefront | Customizable online store with catalog, cart, checkout, payment | P0 | INV-01, Payment |
| EC-02 | Product Catalog Sync | Auto-sync item master to storefront; real-time stock availability | P0 | INV-01 |
| EC-03 | Delivery Zone & Slot Management | Define delivery zones, time slots, delivery charges | P0 | EC-01 |
| EC-04 | WhatsApp Commerce (Catalog + Order) | Share catalog, receive orders, send payment links, delivery updates via WhatsApp | P1 | WhatsApp API |
| EC-05 | Marketplace Integration (Swiggy) | API integration with Swiggy Instamart for order flow | P1 | Swiggy API |
| EC-06 | Marketplace Integration (Dunzo) | Delivery-only integration with Dunzo for last-mile | P2 | Dunzo API |
| EC-07 | Order Management Dashboard | Unified view of all online orders (own storefront + WhatsApp + marketplaces) | P0 | EC-01 to EC-06 |
| EC-08 | Online Payment Processing | UPI, card, net banking for online orders | P0 | Payment gateway |
| EC-09 | Inventory Safety Buffer | Configure % of stock available online to prevent overselling | P1 | INV-01, EC-02 |
| EC-10 | Customer Order Tracking (Web/WA) | Real-time order status for customers | P1 | EC-07 |

## 6.11 Payments

(Features covered in POS-05, POS-06, POS-07 and Section 9.1)

## 6.12 Reporting & Analytics

(Features covered in Section 11)

---

# 7. User Roles & Permissions

## 7.1 Role Definitions

| Role | Description | Typical User |
|---|---|---|
| **Owner** | Full access to all features, data, and settings across all branches. Can create/modify users, pricing, policies. | Rajesh (Store Owner) |
| **Manager** | Operational control of assigned branch(es). Can approve transactions, override POS actions, manage staff schedules. Cannot change global pricing or business policies without owner approval. | Priya (Branch Manager) |
| **Cashier** | POS billing and basic customer interactions. No access to reports, settings, or other modules beyond billing. | Kumar (Billing Staff) |
| **Inventory Staff** | Stock intake, stock count, stock transfer. Can view inventory reports. No access to POS, accounting, or customer credit management. | Devi (Inventory Manager) |
| **Accountant** | Access to accounting, GST, payment reconciliation, financial reports. No access to POS operations or inventory management. | External CA or in-house accountant |
| **Delivery Staff** | View assigned delivery orders, update delivery status, collect payment (COD). No access to any other module. | Delivery boy |
| **View-Only (Auditor/CA)** | Read-only access to specified reports and data. No create/edit/delete permissions. | External auditor or CA |

## 7.2 Permissions Matrix

| Permission | Owner | Manager | Cashier | Inventory | Accountant | Delivery | View-Only |
|---|---|---|---|---|---|---|---|
| **POS — Billing** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **POS — Apply manual discount** | ✅ | ✅ (with limit) | ❌ (needs PIN) | ❌ | ❌ | ❌ | ❌ |
| **POS — Price override** | ✅ | ✅ (with PIN) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **POS — Issue credit sale** | ✅ | ✅ (within limit) | ❌ (needs approval) | ❌ | ❌ | ❌ | ❌ |
| **POS — Process return** | ✅ | ✅ | ❌ (needs approval) | ❌ | ❌ | ❌ | ❌ |
| **POS — Void bill** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **POS — Day-end close** | ✅ | ✅ | ✅ (own shift) | ❌ | ❌ | ❌ | ❌ |
| **Inventory — View stock** | ✅ | ✅ | ✅ (own branch) | ✅ | ✅ | ❌ | ✅ |
| **Inventory — Stock in (GRN)** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Inventory — Stock adjustment** | ✅ | ✅ | ❌ | ✅ (needs approval) | ❌ | ❌ | ❌ |
| **Inventory — Stock transfer** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Inventory — Item master CRUD** | ✅ | ✅ (create/edit) | ❌ | ✅ (create/edit) | ❌ | ❌ | ❌ |
| **Inventory — Delete item** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Pricing — View** | ✅ | ✅ | ✅ (POS only) | ✅ | ✅ | ❌ | ✅ |
| **Pricing — Edit** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Supplier — CRUD** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **PO — Create** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **PO — Approve** | ✅ | ❌ (below threshold) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Customer — View** | ✅ | ✅ | ✅ (basic) | ❌ | ✅ | ❌ | ✅ |
| **Customer — Credit limit set** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Customer — Credit override** | ✅ | ✅ (with PIN) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Accounting — View reports** | ✅ | ✅ (branch) | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Accounting — Journal entries** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Accounting — GST filing data** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Reports — Sales** | ✅ | ✅ (branch) | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Reports — Inventory** | ✅ | ✅ (branch) | ❌ | ✅ (branch) | ❌ | ❌ | ✅ |
| **Reports — Financial** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Settings — Business** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Settings — Branch** | ✅ | ✅ (own branch) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Settings — Users** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **E-commerce — Manage storefront** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **E-commerce — Order management** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Delivery — View/update orders** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

## 7.3 Access Control Scenarios

**Scenario 1: Cashier tries to give discount > 5%**
→ POS shows "Manager approval required" → Cashier calls manager → Manager enters PIN on cashier's terminal → Discount applied → Audit log records: who approved, PIN used, discount amount, original price, reason.

**Scenario 2: Inventory staff discovers missing stock**
→ Inventory staff creates stock adjustment (decrease, reason: "shrinkage") → Adjustment queued for Manager approval → Manager reviews and approves → Stock updated, accounting entry posted.

**Scenario 3: Owner wants to check Branch 2 sales from home**
→ Opens mobile app → Unified dashboard shows all branches → Taps Branch 2 → Branch-specific sales, inventory, and cash data visible in real-time.

**Scenario 4: External CA needs GST data**
→ Owner creates "View-Only" user for CA → CA logs in → Can view all financial reports, GST data exports, and trial balance → Cannot modify any data.

---

# 8. System Architecture (High-Level)

## 8.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│ Android App  │   iOS App    │ Web App      │ Customer Storefront    │
│ (POS + Mgmt) │ (Mgmt only)  │ (Full suite) │ (PWA / Responsive Web) │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│                     LOCAL LAYER (per device)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ SQLite   │  │ Offline  │  │ Local    │  │ Hardware │           │
│  │ (Local   │  │ Queue    │  │ Auth     │  │ Drivers  │           │
│  │  Cache)  │  │ (Sync)   │  │ Cache    │  │ (Print/  │           │
│  │          │  │          │  │          │  │  Scale/  │           │
│  │          │  │          │  │          │  │  Scanner)│           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
├─────────────────────────────────────────────────────────────────────┤
│                          API GATEWAY                                │
│                   (REST + WebSocket + GraphQL)                      │
├─────────────────────────────────────────────────────────────────────┤
│                       BACKEND SERVICES                              │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Auth     │ Billing  │ Inventory│ Accounting│ E-comm  │ Notification│
│ Service  │ Service  │ Service  │ Service   │ Service │ Service     │
├──────────┼──────────┼──────────┼──────────┼──────────┼─────────────┤
│ Customer │ Supplier │ PO/SO    │ Reports  │ Payment │ AI/ML       │
│ Service  │ Service  │ Service  │ Service  │ Service │ Service     │
├──────────┴──────────┴──────────┴──────────┴──────────┴─────────────┤
│                        DATA LAYER                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │PostgreSQL│  │  Redis   │  │ S3/Blob  │  │  Event   │           │
│  │(Primary) │  │ (Cache + │  │ (Images, │  │  Store   │           │
│  │          │  │  Pub/Sub)│  │  Docs)   │  │ (Kafka)  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
├─────────────────────────────────────────────────────────────────────┤
│                     EXTERNAL INTEGRATIONS                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Payment  │  │ WhatsApp │  │ GST/NIC  │  │Marketplace│          │
│  │ Gateway  │  │ Business │  │ Portal   │  │  APIs    │           │
│  │(Razorpay)│  │  API     │  │          │  │(Swiggy)  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

## 8.2 Mobile vs. Web Responsibilities

| Capability | Android App | iOS App | Web App |
|---|---|---|---|
| POS Billing | ✅ Primary POS device (tablet) | ❌ (not a POS use case for iOS) | ✅ (browser-based POS on desktop) |
| Hardware Integration (scanner, printer, scale) | ✅ USB + Bluetooth | ❌ (limited iOS hardware support) | ✅ (USB via WebUSB/desktop agent) |
| Offline Billing | ✅ Full | ❌ | ⚠️ Limited (Service Worker cache) |
| Inventory Management | ✅ Stock in, count, transfer | ✅ View + approve | ✅ Full |
| Reports & Dashboards | ✅ Key dashboards, mobile-optimized | ✅ Same as Android | ✅ Full, desktop-optimized |
| Accounting & GST | ⚠️ View reports, approve entries | ⚠️ Same | ✅ Full data entry + reporting |
| E-commerce Management | ✅ Order management | ✅ Order management | ✅ Full storefront setup + orders |
| Settings & Configuration | ⚠️ Basic settings | ⚠️ Basic settings | ✅ Full settings |
| User Management | ❌ | ❌ | ✅ |

**Rationale:** The Android app is the primary POS device (runs on ₹12,000–₹20,000 tablets). It handles all billing, hardware interaction, and offline operations. The Web app is the management console for owners, managers, and accountants — full reporting, configuration, and accounting. iOS app serves managers and owners for on-the-go monitoring and approvals.

## 8.3 Offline Sync Design

**Architecture: Local-first with background sync**

1. **Local database:** Each device maintains a SQLite database with the subset of data needed for its role:
   - POS terminal: item master (name, barcode, price, GST rate, stock quantity), customer profiles (name, phone, credit limit, balance), pending bills, payment records.
   - Inventory device: full item master with batch/expiry, stock quantities, pending POs.

2. **Sync protocol:**
   - **Online → Offline:** Cloud pushes updates to device via WebSocket (real-time) or periodic pull (every 30 seconds if WebSocket unavailable).
   - **Offline → Online:** All offline actions stored in a local queue. When connectivity resumes, queue replays to cloud in chronological order.
   - **Conflict resolution:**
     - Stock quantities: cloud maintains authoritative count. Offline decrements (sales) are applied additively. If cloud stock = 50 and Device A sold 3 offline and Device B sold 2 offline, cloud reconciles: 50 - 3 - 2 = 45.
     - Price changes: last-write-wins with timestamp comparison.
     - Customer credit: cloud maintains authoritative balance. Offline credit purchases queued and applied in order.

3. **Data freshness indicators:**
   - Green dot: data synced in last 30 seconds (real-time).
   - Yellow dot: data synced in last 5 minutes (slightly stale).
   - Red dot: device offline — using local cache. "Last synced: 10:23 AM" displayed.

4. **Initial sync (new device setup):**
   - Full item master download (~5,000 items ≈ 10 MB compressed).
   - Customer database download (~2,000 customers ≈ 2 MB).
   - Configuration sync (~100 KB).
   - Total initial sync: <15 MB, completes in <60 seconds on 4G.

## 8.4 Data Flow Summary

**Sale transaction data flow:**
1. Cashier completes sale on POS (Android tablet).
2. Bill data saved to local SQLite immediately.
3. Inventory decremented locally.
4. Receipt printed via local Bluetooth/USB printer.
5. In background: bill data + inventory change + payment record pushed to cloud.
6. Cloud updates: PostgreSQL (master data), Redis (real-time dashboards), Kafka (event for downstream — accounting, reports, analytics).
7. Accounting service picks up event → creates double-entry journal.
8. Reports service picks up event → updates real-time dashboard.
9. If customer identified → loyalty points calculated and updated.
10. If online order → delivery service picks up event → triggers next status update.

---

# 9. Integrations

## 9.1 Payment Gateways

### 9.1.1 UPI Integration

| Aspect | Detail |
|---|---|
| **Primary gateway** | Razorpay (widest UPI coverage, good documentation, settlement in T+2) |
| **Fallback gateway** | PayU or Juspay |
| **QR generation** | Dynamic QR with encoded amount (UPI 2.0 compliant). Generated per transaction. |
| **Callback mechanism** | Webhook from Razorpay on payment success/failure → SuperStore backend → POS device notified via WebSocket |
| **Offline fallback** | Static QR with store's VPA (no encoded amount). Customer enters amount manually. Reconciliation manual. |
| **Settlement** | Daily auto-settlement to store's bank account. Dashboard shows expected vs. received settlements. |
| **Refunds** | Initiated via Razorpay API → 2–5 business days → status tracked in SuperStore |

### 9.1.2 Card Payment Integration

| Aspect | Detail |
|---|---|
| **Terminal providers** | Pine Labs (most widespread in India), Mswipe, Paytm EPOS |
| **Integration type** | SDK-based — SuperStore sends amount to terminal via SDK → terminal handles card interaction → returns success/failure |
| **Supported cards** | Visa, Mastercard, RuPay (UPI-linked debit cards also via terminal) |
| **Settlement** | Via terminal provider → T+1 or T+2 |
| **Contactless (NFC)** | Supported on compatible terminals (Pine Labs Smart, Mswipe WisePOS) |

### 9.1.3 Cash Drawer Integration

| Aspect | Detail |
|---|---|
| **Connection** | USB (RJ11 cable from drawer to receipt printer, triggered by printer command) or Bluetooth |
| **Trigger** | Auto-open on cash payment completion. Manual open button in POS (manager PIN required). |
| **Supported drawers** | Any standard RJ11-compatible cash drawer (cost: ₹2,000–₹5,000) |

## 9.2 GST / Government Integrations

| System | Integration Type | Purpose |
|---|---|---|
| **NIC E-Invoice** | REST API (via ASP/GSP) | Generate e-invoices for B2B transactions > ₹5Cr turnover. Obtain IRN. |
| **NIC E-Way Bill** | REST API | Generate e-way bills for goods movement > ₹50,000. |
| **GST Portal** | Export (JSON/Excel) | Export GSTR-1, GSTR-3B data in portal-compatible format for upload. Direct filing support planned for V2. |
| **GSTIN Validation** | Public API | Validate customer/supplier GSTIN during entry. |

## 9.3 WhatsApp Business API

| Aspect | Detail |
|---|---|
| **BSP (Business Solution Provider)** | Gupshup or Wati or official Meta Cloud API |
| **Use cases** | Transactional messages (receipt, payment confirmation), promotional (offers, new arrivals), credit reminders, order updates, catalog sharing, two-way ordering |
| **Message templates** | Pre-approved by Meta: "Your bill of ₹{{amount}} at {{store}} is ready. [View Invoice]" etc. |
| **Catalog integration** | WhatsApp Business catalog synced with SuperStore item master via API |
| **Pricing** | Per-conversation pricing (as per Meta's model). Estimated ₹0.50–₹1.00 per conversation. |
| **Opt-in management** | Customer opt-in tracked in CRM. Opt-out handled automatically. Compliance with TRAI DND. |

## 9.4 Hardware Integrations (Detailed)

### 9.4.1 Barcode Scanners

| Aspect | Detail |
|---|---|
| **Supported types** | 1D (laser): reads EAN-13, UPC-A, Code 128. 2D (imager): additionally reads QR codes, DataMatrix. |
| **Connection** | USB (HID keyboard mode — scanner types barcode as keyboard input) or Bluetooth SPP. |
| **Android integration** | USB: detected as keyboard input — no driver needed. Bluetooth: pair via Android settings → SuperStore recognizes. |
| **Web integration** | USB: keyboard input captured by focused POS input field. Web Bluetooth API for advanced scanners. |
| **Recommended models** | Honeywell Voyager 1200g (USB, ₹3,500), Zebra DS2208 (2D, ₹5,000), Inateck BCST-70 (Bluetooth, ₹2,500). |
| **Error handling** | Unrecognized barcode: beep + "Item not found" → option to add new item or search manually. |
| **Weight-embedded barcodes** | PLU format support: barcode encodes item code + weight → parsed at POS → weight extracted → price calculated. |

### 9.4.2 Receipt Printers

| Aspect | Detail |
|---|---|
| **Type** | Thermal receipt printers (58mm or 80mm paper width) |
| **Connection** | USB, Bluetooth, or WiFi/LAN (for shared printer across terminals) |
| **Protocol** | ESC/POS (Epson Standard Code) — industry-standard thermal printer protocol |
| **Android integration** | USB: via USB serial. Bluetooth: via SPP. Printing commands sent in ESC/POS format. |
| **Web integration** | Via print agent (lightweight desktop app that bridges browser → USB printer) or network printer via HTTP. |
| **Recommended models** | Epson TM-T82 (USB+LAN, ₹12,000), TVS-E RP-3200 Star (USB, ₹8,000), Generic 80mm Bluetooth (₹3,000). |
| **Receipt format** | Configurable: store name, logo (if printer supports graphics), items, GST breakup, footer. |
| **Auto-cut** | Full cut after receipt (if printer supports). Otherwise, partial cut with tear bar. |
| **Offline printing** | Works fully offline — print commands generated locally. |

### 9.4.3 Weighing Scales

| Aspect | Detail |
|---|---|
| **Supported types** | Electronic table-top scales with serial/USB output (common in Indian supermarkets). |
| **Connection** | RS-232 serial (via USB-to-serial adapter on Android) or USB HID. |
| **Data protocol** | Scale sends weight value as serial data string (format varies by manufacturer — configurable parser). Common formats: "ST,GS,+00.250 kg" or plain "0.250". |
| **Integration flow** | 1. Cashier selects weighable item. 2. Item placed on scale. 3. Weight auto-read from scale. 4. Price calculated (rate × weight). 5. Added to bill. |
| **Stable weight detection** | System waits for stable weight reading (no fluctuation for 500ms) before capturing — prevents capturing while customer is still placing items. |
| **Recommended models** | Essae DS-215 (₹3,500, USB), Citizen CT-33 (₹2,500, serial), iScale i-10 (₹4,000, Bluetooth). |
| **Fallback** | If scale disconnects, manual weight entry enabled. Indicator shown: "Scale offline — enter weight manually." |

### 9.4.4 POS Terminal (Card Payment)

| Aspect | Detail |
|---|---|
| **Integration type** | SDK-based. SuperStore POS sends "charge ₹X" to terminal SDK → terminal handles NFC/chip/swipe → returns result. |
| **Supported terminals** | Pine Labs (Smart series), Mswipe (WisePOS), Paytm (EDC device). |
| **Android integration** | Pine Labs Plutus SDK (Android library). Mswipe SDK. |
| **Flow** | POS app calls terminal SDK with amount → terminal screen shows "Tap/Insert/Swipe card" → customer interacts → terminal returns approval code + card last 4 digits → POS records payment. |
| **Receipt** | Terminal prints its own receipt (merchant copy + customer copy). POS receipt also includes card payment reference. |

## 9.5 E-Commerce Platform Integrations

| Platform | Integration Type | Scope |
|---|---|---|
| **Swiggy Instamart** | REST API | Catalog push, order receive, accept/reject, status update |
| **Dunzo for Business** | REST API | Delivery-only: create delivery task, track delivery, POD |
| **BigBasket Daily** | REST API (if available) | Similar to Swiggy |
| **Google My Business** | API | Store listing, hours, reviews, messaging |
| **Facebook/Instagram Shop** | Catalog API | Sync product catalog to Facebook Shop |

---

# 10. Unique / Differentiated Features

## 10.1 AI-Based Demand Forecasting

**Problem solved:** Indian supermarket owners order stock based on gut feel and experience. This leads to overstocking (capital locked in dead inventory), understocking (lost sales), and expired goods wastage (especially dairy, FMCG).

**How it works:**
1. **Data collected:** Per-SKU daily sales history, seasonal patterns (festivals: Pongal, Diwali, Ramzan; weekly: Sunday peaks), weather data (ice cream sales in summer), local events (school reopening, wedding season).
2. **Model:** Time-series forecasting (Prophet or LSTM) trained on store's own sales data. Minimum 90 days of data required for meaningful predictions.
3. **Output:** For each SKU: predicted demand for next 7/14/30 days with confidence interval.
4. **Actionable:** Dashboard widget: "Next week's top sellers" and "Items you'll need to reorder by Friday."
5. **Learning loop:** Actual sales compared to predictions → model accuracy improves over time.

**Why competitors don't have it:** Vyapar, Marg, and TallyPrime are fundamentally billing/accounting tools — they don't invest in ML infrastructure. Global tools (Shopify) have it but not calibrated for Indian retail patterns (festive cycles, regional food preferences, monsoon effects).

## 10.2 Smart Reorder Suggestions

**Problem solved:** Reorder points in existing tools are static (fixed quantity trigger). Indian supermarkets have dynamic demand — rice sells 3x more during Pongal, cold drinks spike in summer. Static reorder points cause stockouts during peaks and overstocking during lulls.

**How it works:**
1. Combines demand forecast (10.1) with current stock, pipeline stock (POs in transit), supplier lead times, and minimum order quantities.
2. Generates daily "Recommended Purchase List" — items, quantities, suggested suppliers, estimated cost.
3. One-click: convert suggestion to PO.
4. Factors in budget constraints: if owner sets "max weekly purchase budget = ₹2L," system prioritizes essential items within budget.

**Why competitors don't have it:** Marg has basic "reorder level" alerts (item drops below X, alert triggers). No demand intelligence, no lead time factoring, no budget optimization.

## 10.3 Credit Risk Scoring for Customers

**Problem solved:** Indian supermarket owners extend "khata" credit to regular customers without any formal risk assessment. Result: ₹5L–₹15L outstanding credit is common, with 10–15% turning into bad debt. Owners hesitate to refuse credit to known customers for fear of losing business.

**How it works:**
1. **Score inputs:** Payment history (% on-time), average payment delay (days), outstanding balance, credit utilization (% of limit used), purchase frequency, relationship age, returned cheques.
2. **Score output:** 0–100 scale. Green (70–100): healthy, extend credit confidently. Yellow (40–69): caution, consider reducing limit. Red (0–39): high risk, restrict credit.
3. **Auto-actions (configurable):** Score drops below 40 → auto-reduce credit limit by 50%. Score drops below 20 → auto-block new credit.
4. **Owner dashboard:** "At-Risk Credit Accounts" widget showing customers with deteriorating scores.
5. **WhatsApp integration:** System sends tailored reminders — gentle for Green, firm for Red.

**Why competitors don't have it:** Vyapar and Marg treat credit as a simple ledger. No scoring, no risk segmentation, no automated limit adjustments. This is a fintech-grade feature applied to neighborhood retail.

## 10.4 WhatsApp-First Commerce

**Problem solved:** Indian consumers increasingly order groceries via WhatsApp messages to their local store. Currently, this is a manual process — customer sends a text list ("2 kg rice, 1 Aavin milk, 5 eggs"), store owner reads, picks, calculates manually, sends total, customer pays via Google Pay. This is error-prone, untracked, and doesn't update inventory.

**How it works:**
1. Customer messages store's WhatsApp Business number.
2. SuperStore's WhatsApp bot responds with interactive catalog (buttons, product carousels).
3. Customer selects items, quantities.
4. Order parsed and created as Sales Order in SuperStore.
5. Automated: stock check → availability confirmation → total with delivery charges → UPI payment link.
6. Customer pays → order confirmed → store picks and packs.
7. Delivery status updates via WhatsApp: "Your order is packed," "Out for delivery," "Delivered."
8. Post-delivery: digital invoice + feedback request.
9. All data: sale recorded, inventory updated, GST calculated, accounting entries posted — all automated.

**Why competitors don't have it:** WhatsApp Business API requires significant technical integration (webhooks, NLP, catalog sync, payment link generation). Billing-focused tools like Vyapar and Marg don't have the architecture for conversational commerce. Shopify has omnichannel but not WhatsApp-native for Indian use cases.

## 10.5 Voice-Based Billing (Regional Languages)

**Problem solved:** Billing staff in small-town supermarkets often have limited literacy and struggle with English-only interfaces. Even Tamil UI helps, but for quick item lookup, voice is faster than typing — especially during rush hours.

**How it works:**
1. Cashier taps microphone button on POS screen.
2. Speaks item name in Tamil/Hindi: "இரண்டு கிலோ பாசுமதி அரிசி" (2 kg Basmati rice).
3. Speech-to-text engine (Google Speech API / Whisper model) converts to text.
4. Text matched against item master using fuzzy matching + NLP.
5. Item identified → added to cart with quantity and weight.
6. Cashier confirms or corrects.

**Why competitors don't have it:** Requires: (a) speech-to-text in regional languages, (b) NLP for item matching, (c) tight POS integration. None of the Indian competitors have invested in this. Global leaders have voice assistants but not in Tamil/Kannada for retail billing.

**MVP scope:** Hindi and Tamil with top 200 item names. Expand languages and vocabulary in V2.

## 10.6 Automated Supplier Negotiation Insights

**Problem solved:** Indian supermarket owners negotiate with 20–50 suppliers but lack data to negotiate effectively. They don't know: "Is this supplier's price for Aashirvaad Atta above market average? Has this supplier increased prices faster than others?"

**How it works:**
1. **Price benchmarking:** For each item, system tracks all suppliers' prices over time. Shows: this supplier vs. cheapest supplier, price trend (increasing/decreasing), % difference from weighted average.
2. **Volume leverage:** "You buy ₹5L/month from Supplier A. If you consolidate Supplier B's overlapping items (₹1.2L/month) with Supplier A, your total = ₹6.2L — you may qualify for a 2% volume discount."
3. **Payment term optimization:** "Supplier C offers 2% discount for payment within 10 days. Your average payment to Supplier C is on Day 23. Paying 13 days earlier on ₹3L purchases saves ₹6,000/month."
4. **Alert:** "Supplier D increased prices on 8 items by 5–8% this month. Industry average increase for these items: 2%. Consider renegotiating or switching."

**Why competitors don't have it:** Requires multi-supplier price history analysis + data science. Billing tools don't track this depth of supplier data. This is ERP-grade analytics made accessible to a supermarket owner.

---

# 11. Reports & Analytics

## 11.1 Report Catalog

### Sales Reports

| Report Name | Description | Frequency | Role Access |
|---|---|---|---|
| Daily Sales Summary | Total sales, items sold, average basket size, payment split, returns | Daily | Owner, Manager |
| Hourly Sales Heatmap | Sales by hour to identify peak and slow periods | Daily | Owner, Manager |
| Item-wise Sales | Sales quantity, revenue, margin per item | Daily/Weekly | Owner, Manager |
| Category-wise Sales | Sales aggregated by category/department | Weekly | Owner, Manager |
| Branch-wise Sales Comparison | Compare sales across branches for same period | Weekly | Owner |
| Cashier Performance | Bills processed, average billing time, error rate per cashier | Daily | Owner, Manager |
| Discount Analysis | Total discounts given, by type (scheme/manual/coupon), by cashier | Weekly | Owner, Manager |
| Sales Return Analysis | Returns by item, reason, frequency, value | Weekly | Owner, Manager |
| Top Sellers / Slow Movers | Ranked list of best and worst performing items | Weekly | Owner, Manager, Inventory |
| Bill-wise Detail | Drill-down into any individual bill with full line items | On-demand | Owner, Manager |

### Inventory Reports

| Report Name | Description | Frequency | Role Access |
|---|---|---|---|
| Current Stock | Stock quantity and value per item per branch | Real-time | Owner, Manager, Inventory |
| Stock Movement | All stock in/out/transfers for a date range | Daily/Weekly | Owner, Inventory |
| Expiry Report | Items expiring in 7/15/30/60/90 days with value | Daily | Owner, Manager, Inventory |
| Dead Stock | Items with zero sales in configurable period | Monthly | Owner, Inventory |
| Reorder Report | Items below reorder point with suggested PO quantities | Daily | Owner, Inventory |
| Stock Valuation | Total stock value by FIFO/LIFO/Weighted Avg, by branch, by category | Monthly | Owner, Accountant |
| Shrinkage Report | Variance from stock audits; shrinkage % by category, branch, period | Post-audit | Owner |
| Batch-wise Stock | Stock by batch number with expiry dates and source PO | On-demand | Inventory |
| Stock Aging | Stock held by time period (0–30, 31–60, 61–90, 90+ days) | Monthly | Owner, Inventory |

### Financial Reports

| Report Name | Description | Frequency | Role Access |
|---|---|---|---|
| Profit & Loss Statement | Revenue, COGS, gross margin, expenses, net profit (branch-wise + consolidated) | Monthly | Owner, Accountant |
| Balance Sheet | Assets, liabilities, equity snapshot | Monthly/Quarterly | Owner, Accountant |
| Cash Flow Statement | Cash inflows/outflows categorized by operating, investing, financing | Monthly | Owner, Accountant |
| Accounts Payable Aging | Supplier-wise outstanding with aging buckets | Weekly | Owner, Inventory, Accountant |
| Accounts Receivable Aging | Customer credit outstanding with aging buckets | Weekly | Owner, Manager, Accountant |
| Payment Reconciliation | Daily reconciliation: expected vs. received for UPI, card, cash | Daily | Owner, Manager, Accountant |
| GST Summary | Output tax, input tax, net payable/refundable | Monthly | Owner, Accountant |
| GSTR-1 Report | Outward supply data formatted for GST portal upload | Monthly | Owner, Accountant |
| GSTR-3B Report | Summary return data with ITC reconciliation | Monthly | Owner, Accountant |
| Trial Balance | Ledger-wise debit/credit balances | On-demand | Owner, Accountant |
| Day Book / Cash Book | All cash transactions for a day | Daily | Owner, Manager |

### Customer Reports

| Report Name | Description | Frequency | Role Access |
|---|---|---|---|
| Customer Purchase History | All transactions for a specific customer | On-demand | Owner, Manager |
| Credit Customer Ledger | Credit purchases, payments, balance for each credit customer | On-demand | Owner, Manager |
| Credit Aging Summary | All credit customers with aging breakdown | Weekly | Owner |
| Credit Risk Dashboard | Customers ranked by risk score with recommended actions | Weekly | Owner |
| Loyalty Program Report | Points earned, redeemed, expired; active members; tier distribution | Monthly | Owner, Manager |
| Customer Segmentation | High-value, at-risk, dormant, new customer counts and behavior | Monthly | Owner |

### Supplier Reports

| Report Name | Description | Frequency | Role Access |
|---|---|---|---|
| Supplier Purchase Summary | Total purchases per supplier with item breakdown | Monthly | Owner, Inventory |
| Supplier Price Trend | Price changes per item per supplier over time | Monthly | Owner, Inventory |
| Supplier Performance | Delivery reliability, quality, price competitiveness scores | Quarterly | Owner, Inventory |
| PO Fulfillment Report | PO on-time delivery %, short shipment %, rejection % | Monthly | Owner, Inventory |

## 11.2 Role-Based Dashboards

### Owner Dashboard (Mobile + Web)

- **Today's Snapshot:** Total sales (₹), total bills, average basket size — all branches combined.
- **Branch comparison:** Side-by-side sales bars for each branch.
- **Cash vs. Digital:** Pie chart of payment methods.
- **Alerts:** Low stock items, expiring items, credit customers overdue, PO awaiting approval.
- **AI Insights:** "Rice sales expected to spike 40% next week (Pongal). Current stock: 5 days supply. Reorder recommended."
- **Trend:** 7-day sales trend line, same-period last month comparison.
- **Profit tracker:** Gross margin % today vs. target.

### Manager Dashboard (Mobile + Web)

- **Branch today:** Sales, bills, returns, discounts — own branch only.
- **Staff:** Active cashiers, billing speed, shift status.
- **Inventory alerts:** Low stock items for this branch.
- **Pending tasks:** POs to follow up, deliveries expected, stock counts due.
- **Customer issues:** Returns pending processing, credit approvals needed.

### Cashier Dashboard (POS screen only)

- **Current shift:** Bills processed, total amount billed, errors/voids.
- **Quick actions:** New bill, search item, hold bill, recall held bill.
- **No access to reports or analytics.**

### Accountant Dashboard (Web)

- **Financial overview:** Revenue, P&L summary, cash flow.
- **GST tracker:** Output tax, input tax, ITC mismatch count.
- **Pending reconciliation:** Unmatched bank transactions, unsettled payment gateway amounts.
- **Filing calendar:** GSTR-1 due date, GSTR-3B due date, advance tax due date.

## 11.3 Predictive Insights (AI-Powered)

| Insight | Description | Update Frequency |
|---|---|---|
| **Demand Forecast** | Predicted sales quantity per SKU for next 7/14/30 days | Daily |
| **Reorder Recommendations** | Items to reorder, quantities, suggested suppliers, estimated cost | Daily |
| **Margin Opportunities** | Items where price increase won't affect demand (low price elasticity) | Weekly |
| **Dead Stock Alerts** | Items likely to become dead stock based on declining trend | Weekly |
| **Expiry Wastage Forecast** | Estimated value of items that will expire if not sold/marked down | Daily |
| **Credit Default Risk** | Customers likely to default based on payment pattern deterioration | Weekly |
| **Supplier Price Anomaly** | Suppliers whose prices are increasing faster than market norms | Monthly |
| **Peak Hour Staffing** | Recommended cashier count per hour based on historical foot traffic | Weekly |

---

# 12. Non-Functional Requirements

## 12.1 Performance

| Metric | Target | Measurement |
|---|---|---|
| POS bill creation (local) | <200ms per item scan-to-add | Device-level benchmark |
| POS bill finalization | <500ms (total processing including local DB write, print trigger) | Device-level benchmark |
| UPI QR generation | <1 second | API response time |
| UPI payment confirmation | <5 seconds from customer payment | Gateway callback latency |
| Dashboard load (web) | <2 seconds for initial load, <500ms for data refresh | Browser performance |
| Report generation | <5 seconds for most reports, <30 seconds for complex reports (annual P&L, stock valuation) | Server response time |
| Search (item search in POS) | <100ms for autocomplete suggestions | Local DB query |
| Offline → Online sync | <5 seconds per 100 transactions | Background sync timing |
| API response (cloud) | P95 < 300ms for read APIs, P95 < 500ms for write APIs | Server monitoring |
| Concurrent users per tenant | Support 50 concurrent sessions (20 POS terminals + 30 management users) | Load testing |

## 12.2 Scalability

| Dimension | Capacity | Growth Plan |
|---|---|---|
| Items per tenant | Up to 50,000 SKUs | Sufficient for largest supermarkets |
| Transactions per day | Up to 10,000 bills per branch per day | Covers peak festival days |
| Branches per tenant | Up to 50 | Covers small chain networks |
| Users per tenant | Up to 200 | Covers all staff across branches |
| Tenants (total platform) | 10,000+ in Year 1; 100,000+ by Year 3 | Horizontal scaling via Kubernetes |
| Data retention | 7 years (GST compliance requires 6 years + 1 year buffer) | Tiered storage: hot (current year), warm (2–3 years), cold (4–7 years) |
| Online storefront traffic | Up to 1,000 concurrent visitors per store | CDN + auto-scaling |

## 12.3 Security

| Requirement | Implementation |
|---|---|
| Authentication | Email/phone + password + optional MFA (OTP). Session management with JWT tokens (15-min access, 30-day refresh). |
| Authorization | Role-based access control (RBAC) per Section 7. Branch-level data isolation. |
| Data encryption in transit | TLS 1.3 for all API communication. HTTPS enforced. |
| Data encryption at rest | AES-256 for database, S3 objects. |
| PII protection | Customer phone, email, Aadhaar (if collected) encrypted with separate keys. Masked in logs. |
| Payment data | PCI-DSS compliance via payment gateway (SuperStore never stores card numbers). UPI VPAs not stored. |
| Audit logging | All sensitive actions logged: login, price change, discount, void, stock adjustment, credit override, user creation. Immutable audit log (append-only). |
| Device management | Remote wipe capability for lost POS devices. Device registration/deregistration by Owner. |
| Data backup | Automated daily backups. Cross-region replication (Mumbai + Hyderabad). Point-in-time recovery for 30 days. |
| Penetration testing | Quarterly by external security firm. Bug bounty program from V2. |

## 12.4 Reliability

| Metric | Target |
|---|---|
| Uptime (cloud services) | 99.9% (≤8.7 hours downtime/year) |
| Data durability | 99.999999999% (S3 standard) |
| Recovery Point Objective (RPO) | <1 hour (continuous backup) |
| Recovery Time Objective (RTO) | <4 hours for full recovery; <30 minutes for POS-critical services |
| Offline operation | Unlimited duration — POS functions fully offline. Sync resume automatic. |
| Data loss prevention | Zero transaction loss — all transactions stored locally before cloud sync. Double-write (local + queue). |

## 12.5 Offline Capability

| Feature | Offline Support | Limitation |
|---|---|---|
| POS billing | ✅ Full | Stock quantities may be slightly stale (last sync time shown) |
| Barcode scanning | ✅ Full | Item must exist in local cache (synced during last online period) |
| Receipt printing | ✅ Full | No digital receipt via WhatsApp until online |
| Cash payment | ✅ Full | None |
| UPI payment | ❌ | Requires internet for QR generation and payment confirmation |
| Card payment | ⚠️ Depends on terminal | Some terminals support offline authorization |
| Credit sale | ✅ Full | Credit limit checked against local cache; reconciled on sync |
| Stock lookup | ✅ Full | May be slightly stale |
| Stock in (GRN) | ✅ Full | Synced when online |
| Stock count | ✅ Full | Synced when online |
| Reports | ⚠️ Limited | Only local data (current device's transactions). Full reports require cloud. |
| Customer registration | ✅ Full | Synced when online |
| Price changes | ✅ (received via last sync) | New price changes from cloud won't arrive until online |

---

# 13. Future Roadmap

## 13.1 Phase 1: MVP (Months 1–6)

**Goal:** Core POS + Inventory + Accounting for a single branch.

**Includes:**
- POS billing with barcode scanner, thermal printer, and weighing scale integration (Android tablet).
- Item master with batch/expiry tracking, barcode generation.
- Cash + UPI payment (Razorpay).
- GST auto-calculation, tax invoice generation, GSTR-1/3B data export.
- Customer registration, loyalty points (basic), credit/khata ledger.
- Purchase order creation, goods receipt, supplier master.
- Stock adjustment, basic stock count.
- Day-end Z-report.
- Offline billing capability.
- Web dashboard for owner: sales, inventory, financial reports.
- Regional language UI: Tamil + Hindi.
- Roles: Owner, Manager, Cashier.

**Excludes (deferred to V2+):** Multi-branch, e-commerce, WhatsApp commerce, AI features, marketplace integrations, voice billing.

## 13.2 Phase 2: V2 (Months 7–12)

**Goal:** Multi-branch + E-commerce + WhatsApp.

**Adds:**
- Multi-branch support: branch setup, inter-branch transfer, consolidated dashboards, centralized item master.
- White-label online storefront: catalog, cart, checkout, delivery zone/slot management.
- WhatsApp commerce: catalog sharing, order placement, payment link, order status updates.
- WhatsApp receipts and credit reminders.
- Card payment integration (Pine Labs).
- Customer-facing display at POS.
- Stock audit / cycle count with mobile app.
- Bank reconciliation.
- Additional languages: Kannada, Telugu.
- Roles: Inventory Staff, Delivery Staff.

## 13.3 Phase 3: V3 (Months 13–18)

**Goal:** AI Intelligence + Marketplace + Advanced Features.

**Adds:**
- AI demand forecasting.
- Smart reorder suggestions.
- Credit risk scoring.
- Voice-based billing (Tamil + Hindi).
- Marketplace integrations: Swiggy Instamart, Dunzo.
- Supplier negotiation insights.
- E-invoice and e-way bill generation.
- Advanced analytics: customer segmentation, margin optimization.
- Additional languages: Marathi, Gujarati.
- Accountant role with full accounting module.
- Tally export.
- API for third-party integrations.

## 13.4 Phase 4: V4+ (Months 19–24+)

**Goal:** Platform expansion.

**Ideas (to be validated):**
- **Franchise management:** Central franchisor controls item catalog, pricing, branding across franchisee stores. Each franchisee operates as a managed branch.
- **B2B marketplace:** SuperStore owners can buy from a curated wholesale marketplace within the app, comparing prices and placing orders across verified distributors.
- **Employee management:** Shift scheduling, attendance tracking, basic payroll — integrated with POS data (billing hours, performance).
- **Kitchen / prepared foods module:** For supermarkets with bakery/hot food sections — production planning, recipe costing, batch production, counter billing.
- **Dark store mode:** Convert to delivery-only operations (no walk-in customers). Optimized picking interface, delivery fleet management.
- **Financial services:** Working capital loans based on SuperStore data (transaction history as collateral signal). Partnership with NBFCs.
- **Loyalty coalition:** Cross-store loyalty — customers earn points at any SuperStore merchant. Creates a network effect.

---

# 14. Risks & Mitigations

## 14.1 Adoption Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Store owners resist switching from TallyPrime/Marg** — deeply entrenched habits, data migration anxiety | High | Offer free data migration service (import from Tally/Marg). Run parallel for 30 days. Provide Tally export from SuperStore (owner keeps Tally as backup). White-glove onboarding for first 500 stores. |
| **Low tech literacy of billing staff** — new tool = slow billing = customer complaints | High | Tamil/Hindi UI. 30-minute guided tutorial. "Practice mode" (fake billing for training without affecting real data). On-site training during deployment. |
| **Price sensitivity** — supermarket owners are cost-conscious, may balk at subscription pricing | Medium | Freemium model for single-terminal single-branch. Competitive pricing: ₹499/mo for base plan (cheaper than Marg annual + TallyPrime combined). ROI calculator: "Save ₹15,000/month in reduced shrinkage and better credit recovery." |
| **Internet reliability in Tier-2/3 cities** — owners fear cloud dependency | High | Offline-first architecture as core differentiator. Demo offline billing during sales pitch. "Works without internet" as primary marketing message. |

## 14.2 Technical Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Offline-online sync conflicts** — two terminals sell the same last unit simultaneously | Medium | Conflict resolution protocol (Section 8.3). Safety buffer for online orders. Accept that very rare oversells will happen — business handles this today with manual processes anyway. |
| **Hardware fragmentation** — hundreds of barcode scanner, printer, and scale models in Indian market | High | Focus on top 5 models per category for certified support. Generic driver support for ESC/POS printers and HID scanners. Community-driven hardware compatibility list. |
| **WhatsApp Business API approval** — Meta's approval process can be slow, message template rejections | Medium | Apply early (Month 1). Use approved BSP (Gupshup/Wati) for faster approval. Start with transactional messages (higher approval rate), add promotional later. |
| **AI model accuracy in early days** — insufficient data for new stores | Low | AI features clearly labeled as "beta" until 90 days of data. Fallback: manual reorder levels work alongside. Accuracy improves transparently — show prediction vs. actual to build owner trust. |
| **Scale under peak festival load** — Diwali/Pongal billing surge | Medium | Load testing at 3x normal capacity before each festival season. Auto-scaling backend. POS operations are local (scale-independent). |

## 14.3 Regulatory Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **GST rate changes** — government changes GST slabs or HSN mappings | Medium | Backend-configurable tax tables pushed to all devices. SLA: update within 24 hours of government notification. Dedicated compliance team monitors GST council meetings. |
| **E-invoice mandate expansion** — turnover threshold may drop, making e-invoicing mandatory for smaller stores | Low (positive for SuperStore) | E-invoice readiness built from V3. When mandate expands, SuperStore users are already compliant — competitive advantage over non-ready tools. |
| **Data localization requirements** — India may tighten data residency rules | Low | All data hosted in India (AWS Mumbai / Hyderabad). No cross-border data transfer. |
| **UPI regulation changes** — UPI MDR (merchant discount rate) may be imposed, affecting payment economics | Medium | Monitor RBI circulars. If MDR imposed, adjust payment gateway costs. Diversify: support BBPS, IMPS, NEFT for B2B payments. |
| **WhatsApp policy changes** — Meta changes API pricing or restrictions | Medium | Maintain alternative channels: SMS, email, in-app notifications. WhatsApp is preferred but not sole channel. |

## 14.4 Business Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Competitor response** — TallyPrime builds mobile app or Marg goes cloud | High | Execute fast — first-mover advantage in unified cloud+offline+AI space. Build brand loyalty and switching costs (data, training, workflows). Patent/IP protection for AI features. |
| **Large player enters** — Reliance Jio or PhonePe builds supermarket SaaS | High | Focus on mid-market (not interesting to mass-market players). Deep customization for Indian retail nuances. Community and support as moat. Move fast — be the default before a large player arrives. |
| **Customer churn** — stores sign up but don't fully adopt | Medium | Proactive onboarding: dedicated success manager for first 60 days. Gamification: "Complete your setup" checklist. Usage-based health score with automated outreach for declining engagement. |
| **Cash flow** — long sales cycles in India, delayed subscription payments | Medium | Annual prepaid discount (20% off). UPI autopay for subscriptions. Build pipeline of 3x target for revenue buffer. |

---

---

# 15. Advanced System Capabilities (Cross-Cutting)

These systems are NOT standalone modules. They are foundational infrastructure layers that permeate every module in SuperStore. Each subsection defines the system, its integration points across all modules, and cross-module workflow examples.

---

## 15.1 Notifications & Alerts Framework

### 15.1.1 Architecture Overview

SuperStore implements a centralized, event-driven notification system built on an internal event bus (Kafka / Redis Streams). Every significant action across any module emits an event. The Notification Service consumes these events, evaluates rules, and dispatches alerts through the appropriate channel.

```
[Any Module] → emits Event → [Event Bus (Kafka)]
                                    │
                              [Notification Service]
                                    │
                    ┌───────────────┼───────────────────┐
                    │               │                   │
              [Rule Engine]   [Template Engine]   [Channel Router]
                    │               │                   │
              Evaluate:        Render message      Dispatch via:
              - Who to notify  in correct language  - In-app
              - Priority       - Tamil/Hindi/EN     - Push notification
              - Escalation                          - SMS
                                                    - WhatsApp
                                                    - Email
```

### 15.1.2 Event → Trigger → Action Mapping

| Event Source | Trigger Condition | Priority | Recipients | Channel(s) | Action |
|---|---|---|---|---|---|
| **Inventory** | Stock falls below reorder point | Warning | Inventory Staff, Manager | In-app, Push | Show reorder suggestion with one-tap PO creation |
| **Inventory** | Stock reaches zero (out-of-stock) | Critical | Manager, Owner | In-app, Push, WhatsApp | Block item in online storefront; suggest inter-branch transfer if stock exists elsewhere |
| **Inventory** | Item expiry within alert window (e.g., 15 days) | Warning | Inventory Staff, Manager | In-app, Push | Suggest markdown pricing; generate clearance report |
| **Inventory** | Stock variance > threshold during audit | Critical | Owner | In-app, Push, WhatsApp | Flag for investigation; link to audit report |
| **POS** | Sales spike: item selling 3x normal rate within 2 hours | Info | Manager, Owner | In-app, Push | Show trending items; suggest stock recheck |
| **POS** | Frequent voids by a cashier (>3 in 1 hour) | Warning | Manager | In-app, Push | Flag for review; link to void log |
| **POS** | High manual discount usage (>₹500 in a shift) | Warning | Owner | In-app, WhatsApp | Show discount summary with cashier details |
| **Payment** | UPI payment failed / timeout | Info | Cashier | In-app (POS screen) | Offer retry or alternative payment method |
| **Payment** | Gateway settlement mismatch | Critical | Owner, Accountant | In-app, Email | Show expected vs. received with affected transactions |
| **Payment** | Daily settlement not received by T+3 | Critical | Owner | In-app, WhatsApp, Email | Escalation: contact gateway support |
| **Customer** | Credit payment overdue (Day 7) | Info | Customer (via WhatsApp) | WhatsApp | Friendly reminder with balance and UPI payment link |
| **Customer** | Credit payment overdue (Day 15) | Warning | Customer (WhatsApp), Owner (in-app) | WhatsApp, In-app | Second reminder; owner sees aging update |
| **Customer** | Credit payment overdue (Day 30+) | Critical | Customer (WhatsApp + SMS), Owner (all channels) | WhatsApp, SMS, In-app, Push | Firm reminder; auto-reduce credit limit suggested |
| **Customer** | Credit score drops below 40 | Warning | Owner | In-app, Push | Recommend credit limit reduction; show payment history |
| **Approval** | PO pending approval > 2 hours | Warning | Owner | Push, WhatsApp | Quick-approve button in notification; show PO summary |
| **Approval** | Discount override request at POS | Critical (time-sensitive) | Manager | Push (immediate) | Approve/reject with one tap; auto-timeout in 60 seconds |
| **Approval** | Return/refund request > ₹2,000 | Warning | Manager | In-app, Push | Show original bill, return items, refund method |
| **Sync** | Device offline > 30 minutes | Warning | Manager | In-app (on Manager's device) | Show which terminal is offline; last sync time |
| **Sync** | Sync failure after reconnect (conflict detected) | Critical | Manager, Owner | In-app, Push | Link to conflict resolution UI |
| **System** | Backup failure | Critical | Owner | Email, Push | Retry initiated; show backup status |
| **E-commerce** | New online order received | Info | Manager, assigned picker | In-app, Push | Show order details; prompt to accept/reject |
| **E-commerce** | Order not accepted within 10 minutes | Warning | Manager, Owner | Push, WhatsApp | Escalation; customer waiting |
| **Supplier** | PO delivery date passed without receipt | Warning | Inventory Staff, Manager | In-app, Push | Auto-send follow-up WhatsApp to supplier |
| **GST** | GSTR-1 filing due in 5 days | Info | Owner, Accountant | In-app, Email | Show filing readiness; link to export data |
| **GST** | ITC mismatch detected in GSTR-2B reconciliation | Warning | Accountant, Owner | In-app, Email | Show mismatched invoices with supplier details |

### 15.1.3 Notification Preferences & Escalation

**Role-based default preferences:**

| Role | In-App | Push | WhatsApp | SMS | Email |
|---|---|---|---|---|---|
| Owner | All | Critical + Warning | Critical only | Critical only | Financial + GST |
| Manager | Branch-specific | Critical + Warning | Critical only | Off | Off |
| Cashier | POS alerts only | Off | Off | Off | Off |
| Inventory Staff | Inventory alerts | Warning+ | Off | Off | Off |
| Accountant | Financial + GST | Off | Off | Off | All financial |

Users can customize preferences within their role's permission scope. Owners cannot be excluded from critical alerts.

**Escalation rules:**

1. **Time-based:** If a Critical notification is not acknowledged within 15 minutes → escalate to next role up (Cashier → Manager → Owner).
2. **Repeated failure:** If an automated reminder bounces 3 times → switch channel (WhatsApp failed → try SMS → try email).
3. **Business-critical:** If POS terminal is offline for >1 hour during business hours → auto-page Owner via SMS (bypassing preferences).

**Retry mechanism:**
- Failed delivery (channel error) → retry after 30 seconds, then 2 minutes, then 10 minutes (exponential backoff, max 3 retries).
- If all retries fail → log failure, attempt via fallback channel.

**Notification history:**
- All notifications stored for 90 days. Searchable by date, module, priority, recipient, status.
- Exportable as CSV for audit purposes.

### 15.1.4 Example Cross-Module Flow: Low Stock → Auto Alert → Auto PO

```
1. [Inventory Module] Sale of "Aashirvaad Atta 5kg" completes at POS
   → Stock decremented: 50 → 12 units (reorder point = 15)

2. [Event Bus] Event emitted: STOCK_BELOW_REORDER
   Payload: {item_id, item_name, branch_id, current_stock: 12, reorder_point: 15}

3. [Notification Service] Rule evaluated:
   - Trigger: stock < reorder_point ✅
   - Priority: Warning
   - Recipients: Inventory Staff (Devi), Manager (Priya)

4. [Notification Delivered]
   Devi's phone: "⚠️ Low Stock: Aashirvaad Atta 5kg — 12 units left"
   Action buttons: [Create PO] [Dismiss] [Snooze 2 hours]

5. [Workflow Automation] (if auto-PO rule is enabled):
   → Auto-create draft PO:
     Supplier: "Sri Balaji Distributors" (preferred supplier)
     Item: Aashirvaad Atta 5kg × 50 units @ ₹285/unit
     Total: ₹14,250 + GST

6. [Approval Engine] PO amount < ₹50,000 threshold → Auto-approved
   → PO sent to supplier via WhatsApp

7. [Audit System] Logged:
   - Stock alert generated, PO auto-created, PO auto-approved, WhatsApp sent

8. [Notification] Owner gets daily digest: "3 auto-POs created today totaling ₹42,300"
```

---

## 15.2 Approval Workflow Engine

### 15.2.1 Architecture

The Approval Engine is configurable, rule-based middleware that intercepts actions requiring authorization before they execute.

```
[Any Module Action] → [Approval Engine]
                           │
                    ┌──────┴──────┐
                    │ Rule Check  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        [Auto-Approve] [Route for   [Auto-Reject]
        (within rules)  Approval]   (policy violation)
                           │
                    [Approver(s) Notified]
                           │
              ┌────────────┼────────────┐
              │            │            │
          [Approve]   [Reject]    [Timeout/Escalate]
              │            │            │
        [Execute]    [Notify      [Escalate to
              │       Requestor]    next level]
        [Audit Log]
```

### 15.2.2 Approval Scenarios & Rules

| Scenario | Trigger | Level 1 Approver | Level 2 (Escalation) | SLA | Auto-Action on Timeout |
|---|---|---|---|---|---|
| **PO > ₹50,000** | PO creation | Owner | N/A | 4 hours | Reminder every 2 hours |
| **PO ₹10,000–₹50,000** | PO creation | Manager | Owner (if Manager doesn't act in 2 hrs) | 2 hours | Escalate to Owner |
| **PO < ₹10,000** | PO creation | Auto-approved | N/A | Instant | Auto-approved |
| **Manual discount > 5%** | Cashier at POS | Manager (PIN on terminal) | N/A | 60 seconds | Auto-reject |
| **Manual discount > 15%** | Cashier at POS | Owner (PIN or remote) | N/A | 120 seconds | Auto-reject |
| **Price override below cost** | Cashier changes price | Owner only | N/A | 120 seconds | Auto-reject |
| **Credit sale > customer limit** | Cashier selects credit | Manager (PIN or remote) | Owner | 90 seconds | Auto-reject (offer split) |
| **New credit limit > ₹10,000** | Manager sets limit | Owner | N/A | 4 hours | Reminder |
| **Stock adjustment > 50 units or ₹5,000** | Inventory staff | Manager | Owner (4 hr escalation) | 4 hours | Escalate |
| **Stock write-off (expiry)** | Any write-off | Manager | Owner (if > ₹10,000) | 8 hours | Escalate |
| **Refund > ₹2,000** | Return at POS | Manager | Owner (if > ₹5,000) | 30 minutes | Escalate |
| **Void bill after completion** | Cashier/Manager | Owner only | N/A | 1 hour | Reminder |
| **User creation / role change** | Admin action | Owner only | N/A | N/A | Owner-only |

**All thresholds are configurable by Owner through Settings → Approval Rules.**

### 15.2.3 Approval Capabilities

**Multi-level approvals:** Up to 3 levels. Sequential: Level 2 engaged if Level 1 approves (AND logic) or times out (escalation).

**Conditional routing:** Route based on value (PO < ₹10K auto-approve, ₹10K–₹50K Manager, >₹50K Owner), category ("Equipment" POs always require Owner), or branch (Branch 2 Manager can approve up to ₹25K).

**Delegation:** Owner can delegate to Manager for a defined period (e.g., traveling Oct 10–15). Delegation logged in audit. Auto-revoked when period ends. Delegated approvals marked: "Approved by Priya (delegated from Rajesh)."

**Mobile quick actions:** Push notification includes [Approve] [Reject] [View Details]. POS-initiated approvals: Manager enters 4-digit PIN on cashier's terminal.

### 15.2.4 Edge Cases

- **Rejection:** Requestor notified with reason (free text or pre-defined). At POS: cashier sees "Discount rejected" → offers customer original price. PO rejected → returns to Draft for modification.
- **Timeout (POS):** Auto-reject after timeout (customer cannot wait). Approver notified: "Request timed out."
- **Timeout (non-POS):** Escalation to next level. Final level timeout → remains pending with repeated reminders.
- **Override:** Owner has master override capability. Every override logged with timestamp and reason.
- **Offline:** POS-based PIN approvals work offline (PIN validated against local hash). Remote approvals require internet — PIN fallback used.

### 15.2.5 Cross-Module Integration

Invoked by: POS (discounts, credit, price overrides, voids, refunds), Inventory (adjustments, write-offs, high-value transfers), PO Module, Customer Module (credit limits), Settings, E-commerce (promotions, delivery zones).

Every approval generates: (1) notification to approver, (2) audit log entry, (3) status update on originating record.

---

## 15.3 Audit & Compliance System

### 15.3.1 Design Principles

- **Tamper-proof:** Append-only log. No UPDATE/DELETE permissions at application layer. No user (including Owner) can edit/delete audit entries.
- **Complete:** Every state-changing action across every module is logged.
- **Attributable:** Every entry includes: user ID, name, role, device ID, IP, branch, timestamp (UTC + IST), module, action, before-value, after-value.
- **Compliant:** Satisfies GST audit requirements (Section 35 CGST Act — 6 years). Retention: 7 years.

### 15.3.2 Audit Log Schema

| Field | Type | Description |
|---|---|---|
| `audit_id` | UUID | Unique identifier |
| `timestamp_ist` | DateTime | Indian Standard Time |
| `user_name` | String | Display name |
| `user_role` | Enum | Role at time of action |
| `device_id` | String | Registered device identifier |
| `device_type` | Enum | Android tablet, Desktop browser, iOS app |
| `ip_address` | String | IP (null if offline) |
| `branch_id` | UUID | Branch where action occurred |
| `module` | Enum | POS, Inventory, Accounting, Customer, Supplier, PO, SO, Settings, Auth |
| `action` | String | CREATE, UPDATE, DELETE, APPROVE, REJECT, VOID, LOGIN, LOGOUT, SYNC, EXPORT |
| `entity_type` | String | Bill, Item, StockAdjustment, PurchaseOrder, Customer, etc. |
| `entity_id` | UUID | Affected entity ID |
| `description` | String | Human-readable description |
| `before_value` | JSON | Changed fields before action |
| `after_value` | JSON | Changed fields after action |
| `approval_id` | UUID (nullable) | Link to approval record if applicable |
| `sync_status` | Enum | SYNCED, PENDING_SYNC, OFFLINE_CREATED |
| `metadata` | JSON | Additional context (reason codes, linked entities) |

### 15.3.3 Sample Audit Entries

**Price Change:**
```json
{
  "timestamp_ist": "2026-03-26T14:30:22+05:30",
  "user_name": "Rajesh (Owner)",
  "module": "Inventory", "action": "UPDATE",
  "entity_type": "Item", "entity_id": "item-4521",
  "description": "Selling price of 'Aashirvaad Atta 5kg' changed from ₹285 to ₹295",
  "before_value": {"selling_price": 285.00},
  "after_value": {"selling_price": 295.00}
}
```

**Stock Adjustment with Approval:**
```json
{
  "timestamp_ist": "2026-03-26T16:45:10+05:30",
  "user_name": "Devi (Inventory Staff)",
  "module": "Inventory", "action": "UPDATE",
  "entity_type": "StockAdjustment",
  "description": "Stock of 'Dove Soap 100g' reduced by 15 units. Reason: Damaged goods",
  "before_value": {"stock_quantity": 120},
  "after_value": {"stock_quantity": 105},
  "approval_id": "appr-3456",
  "metadata": {"reason_code": "DAMAGED", "adjustment_value": 675.00}
}
```

**Discount Override at POS:**
```json
{
  "timestamp_ist": "2026-03-26T17:12:33+05:30",
  "user_name": "Kumar (Cashier)",
  "module": "POS", "action": "UPDATE",
  "entity_type": "Bill", "entity_id": "bill-78901",
  "description": "Manual bill-level discount of 10% (₹234) applied. Approved by Priya via PIN.",
  "before_value": {"discount_amount": 0, "bill_total": 2340.00},
  "after_value": {"discount_amount": 234.00, "bill_total": 2106.00},
  "approval_id": "appr-7890",
  "metadata": {"discount_type": "MANUAL_BILL_LEVEL", "approver": "Priya", "approval_method": "PIN_ON_TERMINAL"}
}
```

### 15.3.4 Cross-Module Audit Flow: Stock Edit → Audit → Approval → Notification

```
1. Devi edits stock of "Surf Excel 1kg": 200 → 185 (reason: damaged)

2. [Inventory Module] Adjustment value = 15 × ₹125 = ₹1,875
   ₹1,875 > ₹1,000 threshold → routes to Approval Engine

3. [Approval Engine] → Approver: Priya (Manager), SLA: 4 hours

4. [Audit System] → logs: "Stock adjustment request created by Devi.
   Surf Excel 1kg, -15 units (₹1,875). Status: PENDING_APPROVAL"

5. [Notification Service] → push to Priya:
   "📦 Stock adjustment: Surf Excel 1kg, -15 units (₹1,875). [Approve] [Reject]"

6a. Priya APPROVES:
    → Stock updated 200 → 185
    → Accounting: Dr. Damaged Goods ₹1,875, Cr. Inventory ₹1,875
    → Audit: "APPROVED by Priya. Stock updated. Accounting posted."
    → Notification: Devi notified "Your adjustment has been approved."

6b. Priya REJECTS (reason: "Need photo verification"):
    → Stock remains 200
    → Audit: "REJECTED by Priya. Reason: Need photo verification."
    → Notification: Devi notified with rejection reason.

6c. Priya doesn't respond (4 hours):
    → Escalated to Rajesh (Owner)
    → Audit: "Escalated from Priya to Rajesh due to SLA timeout."
```

### 15.3.5 Audit Visibility & Export

| Role | Can View |
|---|---|
| Owner | All audit logs across all branches and modules |
| Manager | Assigned branch(es) only; excludes settings/user management |
| Accountant | Financial audit logs only |
| Cashier | Own actions only (via "My Activity") |
| Auditor (View-Only) | All logs (read-only, configurable scope) |

**Export:** CSV (all fields), PDF (formatted report). Scheduled daily/weekly digest to Owner/Auditor. **Retention:** 7 years (hot: current year, warm: 2–3 years, cold: 4–7 years).

---

## 15.4 Advanced Role-Based Access Control (RBAC)

### 15.4.1 Three-Layer RBAC Architecture

**Layer 1: Role hierarchy**
```
Owner (Level 4 — all permissions, all branches)
  └── Manager (Level 3 — operational, assigned branches)
        └── Senior Cashier (Level 2 — billing + limited overrides)
              └── Cashier (Level 1 — billing only)
        └── Inventory Staff (Level 2 — inventory operations)
  └── Accountant (Level 3 — financial operations, all branches)
  └── Delivery Staff (Level 1 — delivery only)
  └── View-Only / Auditor (Level 0 — read-only)
```

**Layer 2: Granular permission types**

| Granularity | Example |
|---|---|
| **Module-level** | Can this user access Inventory? |
| **Action-level** | Can this user CREATE items? UPDATE? DELETE? APPROVE adjustments? |
| **Field-level** | Can this user see "Purchase Price"? Edit "Discount %"? |
| **Data-level** | Can this user see Branch 2 data? |
| **Value-level** | Can this user approve POs up to ₹50K? Up to ₹10K only? |

**Layer 3: Contextual restrictions**

| Restriction | Description |
|---|---|
| **Time-bound** | Temporary permissions for a defined period. Auto-revoked on expiry. |
| **Device-bound** | POS Terminal 1 bound to Branch 1. Branch 2 users cannot log in on it. |
| **Shift-bound** | Cashiers access POS only during assigned shift hours. |
| **IP/Location** | Web access restricted to store's IP range for sensitive roles. |

### 15.4.2 Maker-Checker Implementation

| Action | Maker | Checker | Enforcement |
|---|---|---|---|
| Stock adjustment > ₹5,000 | Inventory Staff | Manager or Owner | Cannot be same person |
| Stock write-off | Manager | Owner | Cannot be same person |
| Credit limit increase | Manager | Owner | Cannot be same person |
| Price change (selling price) | Manager | Owner | System blocks same user for both |
| Refund > ₹5,000 | Cashier/Manager | Owner | Cannot be same person |

### 15.4.3 Real-World RBAC Scenarios

**Scenario 1: Cashier cannot override price**
Kumar (Cashier) scans "Amul Butter 500g" (₹265). Customer asks for discount. Kumar taps "Price" field → field is read-only for Cashier. Kumar taps "Request Discount" → enters ₹240 → approval to Manager. Priya approves via PIN → price set to ₹240 for this bill only. Audit logged.

**Scenario 2: Temporary festival staff**
Rajesh hires 3 temp cashiers for Pongal week (Jan 10–17). Creates users with Cashier role + time restriction: expires Jan 17, 11:59 PM. On Jan 18, 12:00 AM: accounts auto-deactivated. Transactions remain in audit logs permanently.

**Scenario 3: Device-bound terminal**
POS Terminal 1 (TAB-001) registered to Branch 1. If moved to Branch 2, Branch 2 cashier login → blocked. Owner must re-register device via Settings.

**Scenario 4: Field-level margin protection**
Purchase price visible only to Owner + Accountant. Manager sees selling price + MRP, not purchase price or margin. Cashier sees only selling price + MRP. Staff cannot know supplier costs.

---

## 15.5 Workflow Automation Engine

### 15.5.1 Architecture: Trigger → Condition → Action

```
WHEN [Trigger Event occurs]
  IF [Condition(s) are true]
    THEN [Execute Action(s)]
```

Rules evaluated continuously from Event Bus. Multiple rules can fire from the same event.

### 15.5.2 Pre-Built Rule Templates

| # | Template | Trigger | Condition | Action |
|---|---|---|---|---|
| 1 | **Auto-Reorder** | Stock < reorder point | Preferred supplier assigned | Create draft PO → route to approval |
| 2 | **Expiry Clearance** | Item enters expiry window | Auto-markdown eligible | Reduce price by configured % → notify Manager |
| 3 | **Credit Reminder (Day 7)** | 7 days since credit purchase | Balance > ₹0 | WhatsApp reminder + UPI payment link |
| 4 | **Credit Reminder (Day 15)** | 15 days since credit purchase | Balance > ₹0 AND 1st reminder sent | Firmer WhatsApp → notify Owner |
| 5 | **Credit Freeze** | 30 days overdue | Balance > ₹0 AND 2 reminders sent | Auto-reduce limit 50% → block new credit → notify Owner |
| 6 | **Day-End Report** | Store closing time | Always | Daily sales summary → Owner via WhatsApp/Email |
| 7 | **High-Value Sale** | Bill > threshold (e.g., ₹10,000) | Always | Push notification to Owner |
| 8 | **Void Alert** | Cashier voids > 3 bills in 1 hour | Always | Notify Manager → flag for review |
| 9 | **Supplier Follow-Up** | PO delivery date passed | PO not fully received | WhatsApp to supplier: "Delivery overdue for PO #XXXX" |
| 10 | **New Online Order** | Order received | Always | Notify Manager + picker → auto-print picking list |
| 11 | **Settlement Check** | 10:00 AM daily | T-2 settlement not received | Alert Owner + Accountant |
| 12 | **Birthday Greeting** | Customer birthday | Purchased in last 90 days | WhatsApp greeting + 10% coupon |
| 13 | **Dead Stock Alert** | Weekly Monday 6 AM | Zero sales for 60+ days, stock > 0 | Notify Inventory + Manager |
| 14 | **Shift Reminder** | 15 min before shift | Cashier assigned | Push: "Your shift starts in 15 minutes" |
| 15 | **GST Filing Reminder** | 5 days before due date | Always | Notify Owner + Accountant with readiness status |

### 15.5.3 Custom Rule Builder (No-Code)

Accessible to Owner and Manager via Web:

1. **Select trigger:** Stock change, sale completed, payment received, time-based (cron), customer event, supplier event, system event.
2. **Define conditions** with AND/OR logic: "Item category IS 'Dairy' AND stock quantity < 20."
3. **Define actions:** Send notification, create record (PO, SO), update field (price, credit limit), generate report, send WhatsApp.
4. **Set limits:** Active hours, cooldown (prevent alert fatigue), max executions/day.

### 15.5.4 System Interaction

Automation Engine connects to: Event Bus (triggers), Data Layer (conditions), Notification Service, Approval Engine, Module APIs (actions), and Audit System (logging every rule execution).

---

## 15.6 Offline-First Sync Architecture (Detailed)

### 15.6.1 Local Device Storage

| Device Type | Local DB | Data Scope | Size |
|---|---|---|---|
| POS Tablet (Android) | SQLite (Room ORM) | Item master, customer profiles, bills (7 days), payments, offline queue | 50–200 MB |
| Inventory Mobile | SQLite (Room ORM) | Full item master with batch/expiry, stock quantities, POs, GRNs, count sheets | 100–300 MB |
| Manager Mobile | SQLite (lightweight) | Dashboard aggregates, approval queue, notifications, credit summaries | 20–50 MB |
| Web Browser | IndexedDB (Dexie.js) | Session data, cached reports, config | 10–50 MB |

### 15.6.2 Sync Queue & Batching

**Outbound (device → cloud):**
- All local actions stored in sync queue (SQLite table).
- Online: batch and send every 5 seconds or 10 items (whichever first).
- Offline: queue grows unbounded. Drains on reconnect.
- Priority ordering: Bills first, then payments, then stock changes, then other.
- Compression: gzip (70–80% reduction). ~1,000 bills/day ≈ 5 MB/day.

**Inbound (cloud → device):**
- **Full sync (setup/recovery):** Device registers → cloud sends item master, customers, config. ~15 MB, <60 seconds on 4G.
- **Incremental sync:** Delta token model — cloud returns all changes since last sync.
- **Push sync (real-time):** WebSocket for immediate updates (price changes, promotions, credit updates).

### 15.6.3 Conflict Resolution

| Conflict Type | Strategy | Rationale |
|---|---|---|
| **Stock quantity (concurrent sales)** | Additive merge | Terminal A sells 3, Terminal B sells 2 offline. Cloud: 50 - 3 - 2 = 45. |
| **Stock (sale vs. adjustment)** | Manual resolution flag | Conflicting sources → Manager must confirm net result. |
| **Item price** | Last-write-wins (timestamp) | Later timestamp wins. Overridden party notified. |
| **Customer credit balance** | Additive merge | Credit sale and payment both additive — no conflict. |
| **Customer credit limit** | Role-based override | Owner's value wins over Manager's. |
| **Item master (non-critical)** | Last-write-wins | Description, image, category. |
| **Item master (critical)** | Flag for Owner | HSN, tax rate, UoM changes. |
| **Bills** | No conflict possible | Each bill created on one device only. |

### 15.6.4 Conflict Resolution UI

Dashboard for Manager/Owner shows unresolved conflicts:
- Entity, field, Device A value (user, timestamp) vs. Device B/Cloud value.
- Options: [Accept A] [Accept B] [Custom Value] [View History].
- Mandatory: unresolved conflicts shown as badge until handled.

### 15.6.5 Failure Scenarios

**Network drops during billing:**
Zero impact. Billing is local. Receipt prints. Sync queue accumulates. Resumes automatically.

**Network drops during UPI payment:**
QR generated (required internet). Customer paid but callback can't reach device. Device shows "Payment pending verification" for 120 seconds. On reconnect: queries gateway → confirms or cancels. Fallback: customer shows confirmation screen → manual mark-as-paid (audit logged).

**8-hour offline (full day outage):**
All POS, inventory, credit operations work. ~300–500 records queue. On reconnect: 30–60 seconds full catchup. Cross-branch visibility unavailable during offline.

**Conflicting offline stock adjustments:**
Device A: 100 → 95 (damaged). Device B: 100 → 110 (found stock). On sync: flagged as conflict → Manager decides net result. Until resolved: item shows "⚠️ Pending reconciliation."

### 15.6.6 Sync Monitoring Dashboard

Owner/Manager accessible: device status table (name, branch, last sync, queue depth, connection status), sync health (% devices synced in last 5 min), conflict queue count, bandwidth usage per device.

---

## 15.7 Reporting & Intelligence Layer (Advanced Extension)

*This extends Section 11 with advanced intelligence capabilities.*

### 15.7.1 KPI Definitions

| KPI | Formula | Benchmark | Dashboard |
|---|---|---|---|
| **Daily Sales** | Sum bill totals | Varies | Owner, Manager |
| **Average Basket Size (ABS)** | Sales ÷ Bills | ₹350–₹600 | Owner, Manager |
| **Average Basket Value (ABV)** | Items sold ÷ Bills | 8–15 items/bill | Owner, Manager |
| **Sales per Sq Ft** | Monthly sales ÷ area | ₹800–₹1,500/sq ft/mo | Owner |
| **Inventory Turnover** | COGS ÷ Avg inventory | 12–15x/year | Owner, Inventory |
| **Days Sales of Inventory** | (Avg inventory ÷ COGS) × 365 | 25–30 days | Owner, Inventory |
| **Gross Margin %** | (Sales - COGS) ÷ Sales × 100 | 15–25% | Owner, Accountant |
| **Shrinkage Rate** | (Expected - Actual stock) ÷ Expected × 100 | <2% | Owner |
| **Customer Retention** | Repeat customers ÷ Last month total × 100 | >60% | Owner |
| **Credit Recovery Rate** | Credit received ÷ Opening outstanding × 100 | >85% | Owner |
| **Online Fulfillment Rate** | On-time orders ÷ Total online × 100 | >95% | Owner, Manager |
| **Cashier Speed** | Avg time per bill | <90 sec (15 items) | Manager |
| **Stock-Out Rate** | Zero-stock items ÷ Active items × 100 | <3% | Inventory |
| **Expired Goods Rate** | Write-off value ÷ Stock value × 100 | <1% | Inventory, Owner |

### 15.7.2 Advanced Intelligence

**Demand Forecasting (detailed):**
Model: Prophet (90+ days data) or moving average (newer stores). Features: daily sales, day of week, Indian holiday calendar (Pongal, Diwali, Eid, Holi, etc.), weather (temperature, rainfall via API by PIN code), school calendar. Output: per-SKU daily predicted sales with 80% confidence interval.

**Market Basket Analysis:**
Co-purchase rates: "Bread + Butter (73%)." Used for: shelf placement, combo offers, online "frequently bought together."

**Customer Behavior Segmentation:**
Daily shoppers (milk/bread), weekly (big basket), monthly (bulk buy), seasonal (festivals). Churn prediction: "Lakshmi hasn't visited in 21 days (avg gap: 5). Send ₹50 coupon?"

**Staff Performance:**
Bills/hour, avg time/bill, void rate, manual discount frequency. Weekly ranking: "Top cashier: Kumar (127 bills/day, 72 sec/bill)."

---

## 15.8 Multi-Device & Session Management

### 15.8.1 Device Registration

1. Owner registers device in Settings → Device Management → Add Device.
2. Assigns device name, type, and branch.
3. System generates unique `device_id` bound to branch.
4. Unregistered devices: login blocked ("This device is not registered").
5. Replacement: deregister old → register new. Old device loses access.

### 15.8.2 Session Rules

| Rule | Default |
|---|---|
| Concurrent sessions | Cashier: 1, Manager: 3, Owner: 5 |
| POS inactivity timeout | 15 min → lock (PIN resume). 30 min → full logout. |
| Web inactivity timeout | 30 min → re-authenticate |
| Mobile inactivity | 5 min → biometric/PIN re-auth |
| Forced logout | Owner/Manager can remotely log out any session (immediate via WebSocket) |

### 15.8.3 Security Scenarios

**Suspicious login:** Kumar logs in from unregistered device at 11 PM → blocked. Alert to Manager + Owner.

**Dual-terminal attempt:** Kumar logged in on Terminal 1, tries Terminal 2 → prompted: "Already logged in on Terminal 1. [Switch] or [Cancel]." Switching auto-saves held bills on Terminal 1.

**Lost/stolen tablet:** Owner → Device Management → Remote Wipe. Wipes all SuperStore data on next connection. Device deregistered.

**First-login gate:** Configurable: "Require manager presence for first POS login of the day" (manager authenticates before first cashier shift).

---

## 15.9 Data Backup & Disaster Recovery

### 15.9.1 Backup Strategy

| Type | Frequency | Retention | Storage |
|---|---|---|---|
| Continuous (WAL) | Real-time | 7 days | Same region (Mumbai) |
| Daily full backup | 2:00 AM IST | 30 days | Cross-region (Mumbai → Hyderabad) |
| Weekly archive | Sunday 3:00 AM | 1 year | S3 Glacier |
| Annual archive | Jan 1 | 7 years | S3 Glacier Deep Archive |
| Local device backup | Continuous | Until full sync | Device storage |

**Manual backup:** Owner triggers from Settings → Backup → "Backup Now." <5 min for 10 GB database.

### 15.9.2 Point-in-Time Recovery

PostgreSQL WAL shipping enables recovery to any second within last 7 days. Recovery via support team (not self-service) with desired timestamp.

### 15.9.3 Disaster Recovery Workflow

```
1. [Detection] Mumbai region fails → health checks detect in 2 min
2. [DNS Failover] Route 53 switches to Hyderabad DR in 5 min
3. [DR Promotion] Hyderabad read replica promoted to primary in 10 min
4. [Impact] POS: unaffected (offline-first). Cloud: 5–10 min disruption.
   Max data loss: ~30 seconds (async replication lag)
5. [Recovery] DR serves traffic. Mumbai restored in background.
6. [Post-Incident] Report generated. Gap transactions reconciled.
```

**Key metrics:** RPO <1 minute, RTO <15 minutes (cloud), 0 minutes (POS).

---

## 15.10 Security & Fraud Detection

### 15.10.1 Fraud Detection Rules

| Pattern | Detection Logic | Alert | Auto-Action |
|---|---|---|---|
| **Frequent refunds** | >5 refunds in a shift OR refund value > 10% of sales | Critical → Manager + Owner | Block refund capability until review |
| **High discount cashier** | Avg discount > 2x store average | Warning → Manager | Flagged in daily report |
| **Void-and-re-bill** | Void then immediate new bill with same items, lower total | Critical → Owner | Both bills linked for investigation |
| **Sweetheart dealing** | Same customer-cashier pair, manual discounts >3x/week | Warning → Owner | Pattern report generated |
| **Stock manipulation** | Same item adjusted >3 times in 30 days without stock count | Warning → Owner | Require physical count verification |
| **After-hours access** | POS transaction outside business hours | Critical → Owner | Requires manager override; logged |
| **Ghost billing** | Bills under user not scheduled for shift | Critical → Manager + Owner | Session flagged |
| **Below-cost pricing** | Selling price < purchase price | Critical → Owner | Owner-only approval |
| **Cash variance** | Day-end variance > ₹500 | Warning → Owner | Written explanation required |
| **Large credit write-off** | Write-off > ₹5,000 | Critical → Owner | Owner approval + documentation |
| **Shrinkage spike** | Weekly shrinkage > 2x 30-day average | Critical → Owner | Emergency count suggested |

### 15.10.2 Security Controls

**OTP required for:** Owner login from new device, password change, user role change, bulk price change (>50 items), full data export, credit limit increase > ₹25K.

**Rate limiting:** 5 failed logins → 15-min lockout. 10 in 24 hours → account locked + Owner notified. Max 10 refunds per terminal per shift.

**Data controls:** Financial exports watermarked (user, timestamp, CONFIDENTIAL). Screenshot prevention on POS (Android FLAG_SECURE). No raw database access.

### 15.10.3 Fraud Investigation Workflow

```
1. Alert generated → Manager + Owner notified
2. Investigation Dashboard: flagged pattern, affected transactions, user timeline,
   metrics vs. peer averages
3. Evidence: audit trail, receipt copies, CCTV time windows (if available)
4. Actions: Dismiss (false positive), Issue warning, Restrict permissions,
   Suspend user (forced logout), Terminate access
5. Resolution logged in audit trail with Owner's notes
```

---

# 16. Cross-Module Integration Workflows

These workflows demonstrate how Sections 15.1–15.10 work together across modules.

## 16.1 Workflow: Credit Sale + Approval + Audit + Notification

**Scenario:** Lakshmi (regular customer) makes a ₹3,200 purchase. Wants credit. Her balance is at 90% of limit.

```
STEP 1: [POS] Kumar scans items → ₹3,200 total
        [RBAC] Kumar has billing permission ✅

STEP 2: [Customer Module] Lakshmi identified by phone
        Limit: ₹10,000 | Balance: ₹9,000 | Available: ₹1,000
        Credit score: 45 (Yellow)

STEP 3: Kumar selects "Credit" → shortfall ₹2,200
        [RBAC] Cashier cannot override ❌
        → "Manager approval required"

STEP 4: [Approval Engine] Credit override request
        [Notification] → Push to Priya (Manager):
        "⚠️ Lakshmi wants ₹3,200 credit. Balance: ₹9,000/₹10,000. Score: 45.
         [Approve] [Reject] [Split Payment]"

STEP 5a: Priya APPROVES (PIN on terminal):
         → Bill completed as credit. Inventory decremented. Accounting posted.
         → Credit balance: ₹12,200 (over limit, flagged)
         → [Audit] All actions logged
         → Owner digest: "1 credit override today. Lakshmi: ₹2,200 over."
         → [Automation] Credit reminder scheduled: Day 7 WhatsApp

STEP 5b: Priya REJECTS → Kumar offers split: ₹1,000 credit + ₹2,200 UPI
         Both legs recorded. [Audit] Override rejected, split used.

STEP 5c: 90-second timeout → auto-reject. "Offer cash/UPI?"
```

## 16.2 Workflow: Auto-Reorder + Offline Sync + Conflict Resolution

**Scenario:** POS offline selling Amul Taaza while receiving counter gets a delivery online.

```
STEP 1: [POS — OFFLINE] Kumar sells Amul Taaza: local stock 18 → 15
        Local automation: "⚠️ 15 units remaining"

STEP 2: [Inventory — ONLINE] Devi receives delivery: +48 units
        Cloud stock: 18 + 48 = 66

STEP 3: Internet resumes at POS (30 min later)
        [Sync] Outbound: -3 units pushed. Inbound: +48 received.
        [Conflict Resolution] Additive merge: 66 - 3 = 63 ✅

STEP 4: [Automation] Stock 63 > reorder point 20 → no PO needed ✅

STEP 5: [Audit] Offline sales synced, delivery synced, merge applied
```

## 16.3 Workflow: Fraud Detection + Audit + RBAC + Notification

**Scenario:** Cashier Sanjay processes 6 refunds in 2 hours at Branch 2.

```
STEP 1: [POS] 6 refunds totaling ₹2,080 in 2 hours

STEP 2: [Fraud Detection] Rule: >5 refunds in shift → TRIGGERED
        Anomaly score: HIGH

STEP 3: [Notification] Critical alert to Manager + Owner:
        "🚨 6 refunds (₹2,080) by Sanjay in 2 hrs. Normal: 1.5/shift."

STEP 4: [RBAC] Sanjay's refund permission auto-suspended
        [Audit] Permission change logged

STEP 5: Priya opens Investigation Dashboard:
        → 4 of 6 refunds against yesterday's bills, same customer (Sanjay's relative)
        → Pattern: billing items, next-day refunding to pocket cash

STEP 6: Priya confirms fraud → suspends Sanjay (forced logout via WebSocket)
        [Audit] Full trail: trigger, investigation, evidence, action
        [Accounting] Recovery ₹2,080 logged

STEP 7: Rajesh approves termination on phone
```

---

# 17. Unique & Differentiated Features (Extended — 10 Additional)

*Features 1–6 are in Section 10. The following are Features 7–16.*

## 17.1 Feature 7: Smart Pricing Engine

**Problem:** Owners don't know which items are price-elastic vs. price-inelastic. They leave margin on inelastic items and lose sales by overpricing elastic ones.

**Target user:** Owner, Manager.

**Workflow:** System tracks sales velocity at different price points → calculates price elasticity per item → recommends: "Increase Amul Butter by ₹5. Predicted impact: <2% volume drop. Margin gain: ₹1,500/month." Supports A/B testing across branches.

**Why competitors lack this:** Requires transaction-level price elasticity modeling — a data science capability no Indian billing tool offers. Enterprise retailers have internal teams; SuperStore democratizes it.

**Implementation:** 6 months of data minimum. Start with top 100 items by revenue.

## 17.2 Feature 8: Auto-Expiry Donation Tracker

**Problem:** ₹50K–₹2L/month wasted in expired goods. Items 7–15 days from expiry are consumable but unsellable.

**Target user:** Owner, Inventory Staff.

**Workflow:** System identifies items in "donation window" → generates Donation List → Owner approves → connects with registered NGOs/food banks → donation receipt generated (Section 80G tax deduction) → stock written off as "Donated" (separate accounting) → annual donation summary for tax filing.

**Why competitors lack this:** No Indian POS integrates donation tracking with expiry management + tax deduction documentation.

**Implementation:** Partner with Robin Hood Army, Feeding India for NGO directory.

## 17.3 Feature 9: WhatsApp Supplier Communication Hub

**Problem:** Owners mix business orders with personal WhatsApp chats. POs, negotiations, follow-ups buried in chat history. Zero traceability.

**Target user:** Owner, Inventory Staff.

**Workflow:** All supplier communication via SuperStore's WhatsApp Business API → PO sent, supplier confirms/rejects in WhatsApp → status auto-updated → delivery follow-ups auto-sent → payment confirmations auto-sent → complete history linked to supplier profile. Supplier price list (PDF/message) auto-parsed with change highlights.

**Why competitors lack this:** Two-way WhatsApp business communication with auto-parsing requires NLP + WhatsApp Business API — no Indian competitor has it.

## 17.4 Feature 10: Intelligent Shelf-Space Optimization

**Problem:** High-margin slow movers on premium shelves; fast-selling items buried. Sub-optimal allocation costs 5–10% of potential revenue.

**Target user:** Owner, Manager.

**Workflow:** Calculates "Shelf Profitability Score" per item: (margin × velocity) ÷ shelf space → ranks items → "Move Parle-G to eye-level (score: 95). Move Brand X to bottom (score: 22)." Seasonal adjustments. Simplified planogram grid.

**Why competitors lack this:** Enterprise feature (SAP, Oracle Retail) costing lakhs. SuperStore simplifies it for a 2-aisle store.

## 17.5 Feature 11: Dynamic Combo & Bundle Engine

**Problem:** Combos based on gut feel, not data. Owners don't know which combinations actually drive incremental sales.

**Target user:** Owner, Manager.

**Workflow:** Market basket analysis identifies natural affinities → suggests combos: "Bought together 65% of the time. Offer ₹10 off → predicted ₹3,200/month incremental revenue." One-tap activation at POS + online. Performance tracking. Auto-deactivation if underperforming.

**Why competitors lack this:** Requires transaction mining + ML affinity analysis + real-time POS application pipeline.

## 17.6 Feature 12: Walk-In Footfall Counting

**Problem:** Stores don't know conversion rate (visitors ÷ buyers). 500 walk-ins, 200 bills — why did 300 leave?

**Target user:** Owner.

**Workflow:** Without hardware: IoT door counter (₹500) or manual entry. With camera (optional): person-counting ML (no face recognition). Metric: conversion rate by hour/day/branch. "Conversion drops to 25% during 2–4 PM. Consider: staffing, availability, checkout speed."

**Implementation:** P2. Start manual. Camera integration V3+.

## 17.7 Feature 13: Supplier Invoice OCR Auto-Entry

**Problem:** Manual entry of 30–100 line items from supplier invoices — slow, error-prone.

**Target user:** Inventory Staff.

**Workflow:** Photo of paper invoice → OCR (Google Vision / custom model) → auto-extracts: supplier, invoice number, line items, quantities, rates, GST → populated into Stock-In form → staff reviews (confidence scores highlighted) → confirms → matched against PO.

**Why competitors lack this:** Indian invoice OCR is hard (multiple formats, languages, handwritten). No SMB tool attempts it.

**Implementation:** Start with top 20 supplier templates (~60% coverage). Expand via feedback loop.

## 17.8 Feature 14: WhatsApp Self-Checkout

**Problem:** Peak-hour queues (5–10 min). Customers leave. Extra POS counters cost ₹50K + staff.

**Target user:** End customers (store Owner beneficiary).

**Workflow:** QR code at entry → customer opens WhatsApp → scans item barcodes via phone camera → items added to cart → total calculated → UPI payment link → receipt in WhatsApp → shows receipt to exit staff for verification.

**Why competitors lack this:** Requires WhatsApp API + phone-camera barcode scanning + real-time inventory + payment links — all integrated.

**Implementation:** P2. Pilot with express items (<10 items). Needs exit verification for theft prevention.

## 17.9 Feature 15: Festival Calendar-Driven Promotions

**Problem:** Indian retail is deeply seasonal but owners don't plan promotions systematically. Miss promotional windows.

**Target user:** Owner, Manager.

**Workflow:** Pre-loaded Indian festival calendar mapped to product categories (Pongal → rice, turmeric; Diwali → sweets, dry fruits; Ramadan → dates, biryani ingredients). 30 days before each festival: stock-up suggestions + promotion recommendations. One-tap activation: creates promotion at POS + online + WhatsApp to customers. Post-festival analysis with YoY comparison.

**Why competitors lack this:** End-to-end: regional festival DB + category mapping + demand prediction + promotion engine + analytics.

## 17.10 Feature 16: Neighborhood Price Intelligence

**Problem:** Owners send staff to check competitor prices — manual, inaccurate, infrequent.

**Target user:** Owner.

**Workflow:** Staff enters competitor prices in-app during visits. If multiple SuperStore merchants in neighborhood opt-in: anonymous benchmarking ("Your Amul Butter: ₹275. Neighborhood avg: ₹270. 2% above."). Online tracking: JioMart, BigBasket, Amazon prices for comparison.

**Why competitors lack this:** Requires crowdsourced network or scraping infrastructure. SuperStore's network effect makes community benchmarking viable.

**Implementation:** Start manual. Online tracking V2. Community benchmarking V3.

---

# Appendix A: Glossary

| Term | Definition |
|---|---|
| **HSN** | Harmonized System of Nomenclature — classification code for goods under GST |
| **SAC** | Services Accounting Code — classification code for services under GST |
| **CGST** | Central Goods and Services Tax — central government's share of GST on intra-state supply |
| **SGST** | State Goods and Services Tax — state government's share of GST on intra-state supply |
| **IGST** | Integrated Goods and Services Tax — tax on inter-state supply |
| **ITC** | Input Tax Credit — credit for GST paid on purchases, offset against GST collected on sales |
| **GSTR-1** | Monthly/quarterly return for outward supplies (sales) |
| **GSTR-3B** | Monthly summary return for tax payment |
| **GSTR-2A/2B** | Auto-populated return showing inward supplies (purchases) from supplier's filings |
| **IRN** | Invoice Reference Number — unique number assigned to e-invoices by NIC |
| **NIC** | National Informatics Centre — government body that manages e-invoice/e-way bill systems |
| **GRN** | Goods Receipt Note — document recording goods received from supplier |
| **PO** | Purchase Order |
| **SO** | Sales Order |
| **UoM** | Unit of Measurement |
| **PLU** | Price Look-Up — barcode format that encodes item + weight |
| **Z-Report** | End-of-day POS summary report |
| **Khata** | Informal credit ledger maintained by Indian shopkeepers for trusted customers |
| **MRP** | Maximum Retail Price — legally mandated maximum selling price in India |
| **EAN-13** | International barcode standard (13 digits) used for retail products |
| **ESC/POS** | Epson Standard Code for POS — printer command language for thermal receipt printers |
| **BSP** | Business Solution Provider — authorized WhatsApp Business API partner |
| **VPA** | Virtual Payment Address — UPI identifier (e.g., store@upi) |

---

# Appendix B: Document Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | March 26, 2026 | Product Management | Initial PRD — full document |
| 1.1 | March 26, 2026 | Product Management | Added: Advanced System Capabilities (Sections 15–17) — Notifications, Approval Engine, Audit & Compliance, Advanced RBAC, Workflow Automation, Offline Sync (detailed), Intelligence Layer, Multi-Device Management, Backup & DR, Security & Fraud Detection, Cross-Module Integration Workflows, 10 additional differentiated features (total: 16) |

---

*End of Document*
