# Lightspeed POS Product Line — Public-Source Functional & UX Reference Spec

**Purpose:** Reference for building an original, independently-coded functional clone (own code, own branding) of Lightspeed's three POS product lines. Compiled entirely from public sources — Lightspeed's marketing pages, public help-center articles, live public storefronts, and third-party reviews (G2, Capterra, TrustRadius, Merchant Maverick). No proprietary source code, admin panels, or private systems were accessed.

**Research date:** 2026-07-12. **Method:** three independent research passes (one per product), each running 10–15+ targeted web searches and fetching 10–15+ primary sources, cross-checked where conflicts appeared. Significant claims carry inline source URLs; unconfirmed items are flagged `[inferred]` / `[not directly confirmed]`.

> **Clone-targeting note.** Lightspeed is a roll-up of acquired POS companies; each product line exists in multiple differently-coded "Series" generations under one marketing name. This document targets the **current flagship generation of each**: **X-Series** (Retail, ex-Vend), **K-Series** (Restaurant, iPad-based), **E-Series** (eCom, ex-Ecwid). Nova should likewise pick ONE paradigm per product rather than blend eras.

| Product | Generations | Origin |
|---|---|---|
| Retail | **X-Series** (flagship, ex-Vend), R-Series (legacy), S-Series (ex-ShopKeep) | vendhq → x-series-support |
| Restaurant | **K-Series** (flagship, iPad), L-Series (older), O-Series (ex-Kounta), G-Series (ex-Gastrofix, low-confidence name) | acquisitions 2019–2021 |
| eCom | **E-Series** (Ecwid re-integrated with Retail), C-Series (standalone Ecwid) | Ecwid, acquired 2021 |

---

## Part 1 — Retail (X-Series)

### 1.1 Screen inventory (Sell / cash / customers / products / purchasing / reporting)

**Sell screen** (`Sell > Sell`): field-forward header with a product **search field** (name / barcode / Quick Key) + a separate **"Add a customer"** field. Body = scrollable line-item cart; rows collapse by default, expand inline to reveal Quantity, a **percentage-only** discount field, Note, and "Sold by [staff]". Action row: **Park sale**, sale-wide **Discount**, **Promo code**, **Tax**, **"More actions…"** (Quote / Service sale / Mark unfulfilled / Assign all items / Discard), **Pay**. Outlet/register switcher labeled **"Switch"** (top-left).

**Pay screen**: a distinct page (not an overlay). Amount input upper-right; tender-type buttons fill the body (Cash, Card, Gift card, Store credit, Loyalty, On account, Layaway). Alt/Option+1–9 shortcuts. Completion: **"Complete sale."**

**Sales History** (`Sell > Sales history`): tabs **All / Process return / Continue sale** (open sales — parked/on-account/layaway — each with a ">" resume arrow); layered filters.

**Return/Exchange**: reuses the Sell screen; returned items render as **negative** quantity/value, price locked. Primary button relabels **red "Refund"** (store owes customer) ↔ **blue/indigo "Exchange"** (new items exceed returned value). Only fully-paid sales are returnable.

**Quick Keys**: drag-drop tile grid, one-level folders; per-tile Label/Color/image toggle.

**Cash management**: Open Register (Switch → outlet → register → **Opening Float** → Open); Cash Management hub (**Add Cash**: Cash in / Petty cash in; **Remove Cash**: Cash out / Petty cash out); Close Register (per-payment-type **Expected / Counted / Differences**, denomination mode browser-only, **shortfall/overpayment** auto-classified); Register Closure + Cash Movement reports (filters, export, 25-month lookback). Float is immutable after set — corrections go via cash movements.

**Customers**: list (search by name/customer code, inline store-credit column, bulk group reassignment); create/edit form with **Contact** + **Details** tabs; Customer Groups (single-membership, drives pricing/promos); Loyalty ("Loyalty dollars" — dollar-denominated, not points); Gift Cards (enable-once creates catalog product + payment type; up to 4 preset amounts; status Active/Redeemed/Partial/Canceled/Transferred).

**Products/Inventory**: Products list (Add / Export CSV / Import); product types **Standard / Variant / Composite (bundle)**; single-page section-anchored product form (Basic Info, Sales Channels, Images, Inventory + "Add Variants", SKU Codes, multi-Supplier, tracking min/max per outlet, Weight, Tax, Pricing/Loyalty with price points + Landed cost/Markup/Margin). Variant editor: attribute + values → "Add First Variant" per combination (≤3 attributes). Inventory Count (start/pause/resume, quick-scan, review tabs Uncounted/Unmatched/Matched/Excluded/All, PDF/CSV).

**Purchasing**: Purchase Order (`Inventory > Stock control > Order stock`) — supplier/outlet/deliver-to/date, 4 add methods (search-scan / recommendations / CSV / catalog), order-level Discount/Shipping/Duty; status **Open → Sent → Dispatched → Partially Received → Received** (Cancelled anytime). Receive Delivery (ordered vs. editable received qty, shipping/duty distribution, partial receiving, multi-location auto-transfers). Suppliers (multi-supplier, primary orders). Stock Transfers (source/dest outlet, save/send/receive, own status lifecycle). Price Books (scoped by group+outlet+channel+date, min/max unit tiers). Promotions (Basic %/$ or Advanced conditional buy-X-get-Y / spend-threshold).

**Reporting/Settings**: Home Dashboard (period+outlet filter, comparison tiles, "Things to do" feed); Advanced Dashboard (8 KPI cards deep-linking to reports); Outlets & Registers setup wizard; Users & Roles (default **Cashier/Manager/Admin** + custom-role permission checkboxes).

### 1.2 Key workflows (click paths)

- **Ring up a sale (scan):** Sell → scan barcode (keyboard-emulated) → repeat/expand rows to edit qty/discount/note → **Pay** → tender button + amount → **Complete sale** → print/email.
- **Line discount:** expand row → type **%** (fixed-$ line discounts NOT supported) → note → complete. (Sale-wide discount supports %/fixed.)
- **Park/retrieve:** **Park sale** (inventory-neutral) → retrieve via "Retrieve sale" or Sales history → Continue sale ">". Layaway/on-account resumed items show a **padlock** (locked).
- **Split tender:** Pay screen → amount field → enter first tender amount → tender type → remaining auto-adjusts → repeat → auto-closes when covered (no documented split cap for X-Series).
- **Open register:** Sell → Switch → Switch Register → outlet → register → Opening Float → Open.
- **Close register:** Sell > Close Register → review Expected → enter Counted (denomination mode on browser) → Differences live → Close (shortfall/overpayment recorded).
- **Return/refund:** Sales history (Process return tab) → reverse-arrow → add customer or Skip → returned items negative/locked → **Refund** → method → Complete. Exchange = add replacement items into same return.
- **PO create+receive:** Stock control → Order stock → supplier/outlet/deliver-to → add products → discount/shipping/duty → Save and send (Sent) → Dispatched → receive → enter received qty → Receive / Receive and distribute.
- **Stock transfer:** Transfers → Transfer stock → source/dest → add products+qty → Save/Save and send → destination Receive transfer → received qty → Receive (irreversible).
- **Variant product:** Catalog > Products → Add product → Inventory → Add Variants → attribute + values → Add First Variant → per-variant SKU/tax/price → Save.

### 1.3 Terminology → Nova equivalent (adopt our own names knowingly)

Outlet=Store/Location · Register=Register · Quick Keys=quick-add tiles · Park sale=park/hold · On account=house account (BNPL) · Layaway=layaway · Store credit≠On account (two ledgers) · Float=drawer float · Cash in/out vs Petty cash in/out · Expected/Counted/Differences · Shortfall/Overpayment · Customer code=flexible lookup ID · Customer group=pricing/promo segment · Loyalty dollars=$-denominated loyalty · Consignment=(API) umbrella for POs/transfers/returns · Composite=bundle · Landed cost/Markup/Margin · Reorder point/Restock level · Price Book/Price point · Promotion.

### 1.4 Feature parity checklist (condensed)

Sell: search+scan, Quick Keys, customer attach + create, line %-discount + note + staff attribution, sale-wide discount + promo code, park/retrieve, quote/service-sale types, multi/split tender, return/exchange with signed lines, Sales History tabs+filters. Cash: open-with-float, close with Expected/Counted/Differences + denomination mode + shortfall/overpayment, Add/Remove Cash (bank vs petty), spot-check, closure + movement reports, immutable float. Customers: list + inline store credit + bulk group, Contact/Details form, groups, store-credit vs on-account ledgers, loyalty earn/redeem. Products/Inventory: Standard/Variant/Composite, attribute-value variant SKUs, multi-barcode, multi-supplier, reorder/restock feeding smart-add, full counts, CSV I/O. Purchasing: PO with 4 add methods + order-level discount/shipping/duty + status lifecycle, receive with distribution + partial, multi-location auto-transfers, transfers, suppliers. Pricing: price books scoped+tiered, promotions basic+advanced. Gift cards: enable-once, presets, redeem-as-payment + fallback tender, status lifecycle. Reporting: home + advanced dashboards deep-linking to filtered reports. Settings: outlet wizard, register config, users + custom roles.

### 1.5 UX conventions (verified)

1. Field-forward Sell screen (top search fields, scrollable cart with inline-expanding rows) — not per-item modals.
2. **Payment is a dedicated page**, amount-due upper-right, tender buttons fill body.
3. **One universal cart** serves sale/return/exchange; one dynamically-relabeling **red Refund ↔ blue Exchange** button.
4. Locked (padlock) vs editable line items as a state signal.
5. List → **full-page detail** (not modals) for back-office CRUD (composite product is the modal exception).
6. CSV import/export as a first-class repeated input across products/price books/POs/transfers.
7. Status-badge state machine for PO/Transfer.
8. "Search or scan to add a product" is a reused universal widget (POs, transfers, counts).
9. Reorder-point-aware "smart add" recurs in POs and transfers.
10. Dashboards always deep-link into filtered reports via "View report".
11. Tablet and desktop are two distinct treatments (denomination mode browser-only; Quick Keys can't disable on iPad).
12. Feature-flag progressive disclosure ("Enable"/"Get started" for Loyalty, Gift Cards, Cash Management; the latter can't be disabled once on).
13. Full desktop keyboard-shortcut layer (Esc, Tab, F5=park, F6=history, F7=close register, Alt+1–9=tender).
14. No documented cash-variance color-coding — red/green variance is a reasonable Nova addition `[inferred]`.
15. Nav groups by function: Catalog / Inventory / Sell / Setup / Reporting.

---

## Part 2 — Restaurant (K-Series)

### 2.1 Screen inventory

**Floor plan / Tables**: round/square tables freely placed on a canvas, optional background image. Occupied tables show a colored **ownership** tag — **green** = mine, **orange** = other/accessible, **red** = other/restricted (NOT availability). Bottom-left toggle switches per-table overlay: **Covers / Total / Time (red band when long-open) / Status (coursing)**. Multiple switchable plans. (Newer nav renames "Tables" → "Floor plan.")

**Register — Direct Sale mode**: item-button menu on the **right**, ticket panel elsewhere, **Pay** routes to Payment.

**Register — Table Service mode**: order grouped **by course** (default first course + "Add a course") or **by seat** (display-mode toggle collapses keypad). Numeric keypad → punch table # → tap **Tables** to assign. **"Send – x items"** fires to kitchen.

**Modifier popup**: modal on tapping a modifier-enabled item; tap group → tap options → **Done**.

**KDS bump screen**: tickets as a **horizontal FIFO queue** (earliest left). Modes: **Direct line view** (full vertical ticket) vs **Equal view** (equal grid). Status chips **New / Preparing / Ready to collect / Completed**; order-type chips Dine-In/Delivery/Pickup; per-item action icons; 5-second **Undo (↺)**; hub+station routing (KDS 2.0, category-based). Status **color** = stage; orange/red **pulsing** = SLA-breach urgency (separate channels).

**Order management**: tabs Dine-in / Pickup-Delivery / Bar tabs; sortable/filterable columns. **Payment screen**: left order summary (splittable by items/covers/seats), Total + Total selected, tender buttons + condensed toggle, Received amount (overpay → tip), Add tip, Print Receipt toggle, Pay. **Split-check**: Split check button → Distribute by seat (even/per-seat) + per-item Split → Print/Pay/Done (enable once in Back Office). Reservations (Upcoming/All tabs, Scheduled/Seated/Unsuccessful, Seat button). ODS (Apple-TV order board). Self-Order kiosk. Back Office: Dashboard (date-range compare, gross/net, orders+AOV, covers+avg/cover, Best Sellers, Top Payment Methods), Sales Summary, Reports index, **Tempo** table-pacing analytics, Floor-plan builder (≤150 tables/plan), Menu management (Menu > Screen(category) > Item; item types **Single/Combo/Item group**), Combo builder, Order profiles (takeaway/gratuity/schedule), Void/refund reason setup (per-reason Reverse-stock/Print toggles), KDS station setup.

### 2.2 Key workflows

- **Seat a table:** Floor plan → tap available table (or keypad table# → Tables) → enter covers if prompted → green ownership tag.
- **Add items + modifiers:** tap item → modifier popup auto-opens → tap group → tap options → Done.
- **Course firing:** items default course 1 → "Send – x items" → "Add a course" → add course-2 items → Send. Move item: Edit > Transfer to another course.
- **Bump on KDS:** double-tap ticket (or hold → pick status) to advance whole ticket; tap item icon to bump one item; 5s Undo.
- **Bar tab:** Register → Open a tab → Continue (pre-auth card) or Skip → name → add items → Send → pay via Order management > Bar tabs.
- **Move/merge table:** Actions > Transfer to another table (only **sent** orders transferable); choose occupied destination → Merge.
- **Split check:** enable advanced splitting once → Split check → Distribute by seat (even) or per-item selection on Payment screen → Print/Pay/Done. By-seat auto-distributes tagged items; a shared item can be split across seats (must be sent first); split receipts can recombine.
- **Tips:** Cash → Pay → Cash → received → Add tip. Card → Pay → provider → Add tip → Confirm → card. Auto-gratuity via order profile (large party).
- **Void with reason:** setup reasons in Back Office (Reverse stock / Print toggles). POS: unsent item → Remove; sent item → **Void line** → choose reason (logged with user/table/item/date).
- **Comp** `[inferred]`: no dedicated article — use a 100% discount, tracked in "Discounts and comps".
- **Day-part menu:** menus scoped to device/time; in-house day-parting/happy-hour via **order profiles with a schedule**.

### 2.3 Terminology

Floor plan · Table Service vs Direct Sale · Covers (guests) · Seats · Courses (fired independently) · Bar tab/Tab (card pre-auth) · Order profile (takeaway/service-charge/gratuity/schedule preset) · Accounting group (tax/routing) · Statistics group (reporting) · Screen (POS menu category) · Production instruction (prep note, exclusive of modifiers) · Sub-item · Modifier group · Combo / Combo-with-choices(Option Set) · Void reason · Void line · "Discount indicates wastage" · Back Office · KDS · Bump · Hub / Station (KDS 2.0) · ODS · Order Anywhere (QR/kiosk/web) · Tempo (pacing analytics) · Tableside (iPhone handheld).

### 2.4 Feature parity checklist (condensed)

Floor: multiple named plans, freeform placement + background, shape/seats/code, **ownership** color (not availability), toggleable overlay (covers/total/time-overdue/coursing), prompt-cover-count, ≤150 tables/plan. Order taking: Direct/Table-Service, course grouping + per-course Send, seat grouping toggle, modifier popup, production instructions, sub-items, combos + combos-with-choices, item/allergen notes on tickets+KDS, remove(unsent) vs void-with-reason(sent), tableside handheld, QR/kiosk/web. Tabs: open-a-tab + pre-auth, rename/transfer/close-pay, bar-tabs list. Transfer/merge (sent-only). Splitting: even by covers, by seat auto-distribute, per-item edit, split single item across seats, recombine. Payments/tips: multi-method + condensed toggle, cash tip, card tip-then-charge, on-terminal vs on-device, auto-gratuity via profile, overpay-as-tip. Discounts/voids/comps: back-office discounts (%/fixed, item/order), multiple entry points, deactivatable not deletable, wastage flag, reason list with per-reason behaviors, void-line logged. KDS: multi-station routing, FIFO horizontal, direct-line vs equal view, status colors + late pulse, bump (double-tap/hold/per-item), 5s undo, status+order-type filters. Menu: Menu>Screen>Item, bulk-create grid, menu-to-device/time, combo builder, order profiles + scheduling. Manager: dashboard w/ date-range compare + KPIs, sales summary breakdowns, staff/fiscal/location/order/discount reports, table-pacing analytics, role-scoped POS permissions, reservations.

### 2.5 UX conventions

Tablet-first core POS + iPhone Tableside companion (≥1 iPad required). **Color = ownership, not availability.** Menu-on-the-**right** / ticket-panel split. Course/seat view is a **toggle**, not two screens. KDS FIFO horizontal + two density modes; status color and urgency pulsing are **separate channels**. Repeated **Actions → sub-action → confirm** shape (void/discount/transfer/rename). Unified **Split check** entry point. Config is **profile-driven** (day-part/happy-hour/gratuity/takeaway = order-profile attributes). Legacy and new navigation coexist within K-Series — pick one.

---

## Part 3 — eCom (E-Series, ex-Ecwid)

### 3.1 Screen inventory

**Storefront**: Home built from stackable **Instant Site** sections (hero/bestseller sliders/testimonials). Category pages: **Product-type** (grid/list, default grid + list toggle) vs **Overview-type** (subcategory tiles only, to nest beyond the 3-level nav cap); left sidebar sort (most viewed/newest/price/name) + price slider + brand + attribute filters. **PDP**: Title + Full title, description, brand, image gallery, price, SKU, **Options** (no new SKU) vs **Variations/Variants** (true SKUs, own price/stock, rendered as **per-attribute dropdowns** by default), related products (≤5), quantity discounts, delivery-time text, multi-location stock when pickup enabled. **Cart**: product list + total, qty adjust, discount code, gift certificate; stays visible through checkout for live price updates (drawer vs page is theme-dependent `[inferred]`). **Checkout**: legacy 6-stage (New/Registered → Info → Shipping → Payment → Confirmation → Thank You) with selectable **Multi-step / One-page / One-step** layouts; new eCom checkout opt-in (Lightspeed Payments/PayPal/Stripe/Mollie + shipping integrations). **Customer account** ("My account"): My Orders (+ "Buy again"), addresses, wishlist, support tickets, Rewards tab; **passwordless** login (one-time code / magic link).

**Admin**: Dashboard. Left-nav 3 groups — **Store Management** (Dashboard, My Sales [Orders/Abandoned Carts/Customers], Catalog [Products/Categories/Gift Cards], Marketing, Reports), **Sales Channels** (Website/Instagram/Facebook/TikTok/Other), **Configuration** (Design, Payment, Shipping & Pickup, Settings, Apps). Orders list → order dashboard (Payment / Shipment / Products [green/orange stock dots] / Returns / Notes / Customer / History + "More" menu). Abandoned Carts (recovery email 2h after). Catalog > Products (Title/Full title, visibility, Inventory & Variants, categories, tags, filters, product-set bundles ≤100, quantity discounts, related). Categories tree (multi-category, disable not delete). Design (native toggles + Instant Site + Twig/HTML/CSS or proprietary **Rain** templating: `index.rain`, `product.rain`, `collection.rain`, snippets). Checkout config (permissions Disabled/Forced-guest/Registered-only, layouts, T&Cs, Thank-You) + Checkout Dashboard funnel (Leads/Conversion/Bounce/Abandonment). Payment (70–100+ gateways). Shipping & Pickup (self-pickup + date/time). Marketing > Discount codes (%/fixed/free-ship, scoped, **max 1 per order**). Reports/Analytics + GA. Reviews moderation. Mobile app.

### 3.2 Key workflows

- **Browse + add variant:** category grid → sort/filter → PDP → per-attribute dropdowns resolve a variant → Add to Cart → stay-on-PDP or go to cart.
- **Discount code:** merchant enables globally → shopper enters code in cart/checkout → validates scope → total updates → **1 code per order**.
- **Guest checkout:** Checkout as guest → Info → Shipping → Payment → Confirmation (comment/newsletter/T&Cs) → Buy → Thank You (auto-creates account by email).
- **Returning customer:** passwordless login → prefilled info → same flow → order in My Orders + loyalty; "Buy again" later.
- **Online↔in-store sync:** on registration inventory pulls from Retail POS (**source of truth**); sale on either channel decrements both. Field map: Description↔Name, SKU↔SKU, Categories↔Categories, Attributes↔Options, Active↔Availability, Inventory↔Qty, Online Price↔Pricing. Bi-directional **except images** (POS→eCom one-way). Tags/vendor/defaults don't sync.
- **Fulfill order (ship):** My Sales > Orders → Processing → packing slip → label → Assign tracking → Mark as Shipped (auto-email). **Pickup:** flagged to outlet → Ready for pickup (auto-email) → handover. Multi-location: single-location first, else split by location keeping line items intact, last resort split both.

### 3.3 Terminology

eCom E-Series (Retail-integrated) vs C-Series (standalone Ecwid) · Instant Site (no-code builder) · Rain (theme templating) · Overview/Product/Text category types · Variant/Variation (SKU) vs Options (no SKU) · Product set (bundle ≤100) · Custom fields · Discount code · Self Pickup/BOPIS · Ready-for-pickup / Processing statuses · Abandoned cart · Leads/Conversion/Bounce/Abandonment · Checkout Permissions · Multi-step/One-page/One-step checkout · My Sales / Sales Channels · Multi-outlet inventory · Source of truth (Retail POS) · Omnichannel loyalty · Legal mode (DE).

### 3.4 Feature parity checklist (condensed)

Storefront: section-built home, 3 category types, grid/list toggle, sort + price/brand/attribute filters, true-SKU variants (dropdowns) vs no-SKU options, bundles ≤100, quantity discounts, related, reviews + moderation, wishlist, multi-currency/language, digital/subscription products, online gift cards redeemable in-store. Cart/checkout: persistent cart w/ live totals, qty + discount in cart, guest checkout + registered-only lock, passwordless login, multi/one-page/one-step layouts, discount codes (max 1), funnel analytics, abandoned-cart recovery (2h), multi gateways, multi shipping + pickup/delivery, stock reservation. Accounts: auto-created on first order, omni order history, buy-again, saved addresses, loyalty rewards tab, support tickets. Order mgmt: list + filters, order dashboard (payment/shipment/products/returns/notes/customer/history + More), packing slips + bulk labels, tracking + carrier auto-fill, hold/custom statuses, returns + credit notes, split fulfillment line-item-preserving, pickup statuses + auto-notify. Sync: bi-directional field sync (mapping), one-way image sync, real-time stock decrement, multi-outlet pooling, per-location PDP stock. Admin/theme: 3-group left nav, no-code section builder, native design toggles, full theme code, reports + GA, mobile app + push, app marketplace.

### 3.5 UX conventions

Responsive grid-first catalog with left-clustered sort/filter. Cart-as-companion during checkout (live price updates). **Three interchangeable checkout topologies** as a merchant setting. Progressive disclosure via "Overview" categories to fake deeper nav. Admin 3-group left rail. Unified-commerce signaled via **stock-status color dots** + sync-field language, not a dedicated sync screen. Variant selection defaults to **dropdowns, not swatches**. Pickup location proximity-ranked. Design layered by skill (no-code toggles → Instant Site → theme code). Live stores: logo-left / center category nav / search+cart top-right; out-of-stock = text badge on card, not disabled.

---

## Part 4 — Cross-product integration

- **Retail ↔ eCom** is the one deeply-documented integration (field-level sync map, one-way image exception, "Retail POS is source of truth"). Treat as a hard requirement for unified-commerce parity — this matches Nova's shared-core `Order`/`Product`/`Inventory` design.
- **Restaurant (K-Series) integration with Retail/eCom was NOT confirmed** — K-Series has its own Back Office, reporting, and no confirmed shared customer/inventory/loyalty pipeline. Practical implication: model Retail+eCom sharing one customer/product/inventory domain; treat Restaurant as architecturally separate for menu/floor/order specifics **while still writing through the shared unified `Order`** (Nova's design already does this via the `channel` discriminator).

## Part 5 — Source reliability

Most reliable: directly-fetched official `*.lightspeedhq.com` help articles + live merchant storefronts (cited by URL). Medium: search-engine snippets where pages 403'd (x-series-support, g2.com) — marked "(search snippet)". Lowest / explicit inference: items marked `[inferred]` (e.g. eCom Add-to-Cart label, K-Series comp workflow, cash-variance colors) — free design choices, not facts to replicate. No proprietary code/admin/private APIs were accessed. For pixel-level fidelity, product screenshots/screen-recordings (Lightspeed YouTube, G2/Capterra galleries) would be the next step.
