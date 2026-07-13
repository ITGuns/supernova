# Nova UI spec — matching Lightspeed Retail (X-Series), from real screenshots

Ground truth: 47 real screenshots of Lightspeed Retail X-Series (in `docs/reference/screens/`). Nova reproduces this UX with original code + our own brand. Key facts:

## Theme split
- **Sell / register section = DARK** (Sell, Open/Close, Sales history, Cash management, Status, Settings, Quotes) — docs 43–47, 26–27.
- **Back office = LIGHT** (Home, Reporting, Catalog, Inventory, Customers, Finance, Setup) — most docs.
- **Top bar = always near-black** in both.
- (Lightspeed also has a global dark toggle; some admin captures are dark. We default admin=light, sell=dark; a toggle can come later.)

## Global chrome
- **Top bar** (~48px, `#0a0a0a`): flame logo + lowercase wordmark (white) left; centered rounded search (`#2e2e32`, placeholder "Search", `⌘/` hint); right = Help · bell · username.
- **Icon rail** (~56px): Home, Sell (cart), Online, ─divider─, Reporting (bars), Catalog (tag), Inventory (boxes), Customers (people), Finance (briefcase), Setup (gear). Bottom = collapse toggle. Active = indigo `#4B3DF5`. Light in admin, dark in sell.
- **Context / sub-nav panel** (~200px): section sub-items; active item indigo with a right indigo bar. In the register it shows "Main Register / Main Outlet / Switch ⌄" then Sell·Open/Close·Sales history·Cash management·Status·Settings·Quotes.

## Palette
- Primary/action: **indigo `#4B3DF5`** (Pay bar, primary buttons, active nav, links). Secondary buttons: white + grey border (admin) / dark (sell).
- Admin: bg `#f3f1f5`, cards white, text `#1a1a1a`, muted `#6a6a70`, borders `#e4e4e8`.
- Sell (dark): bg `#1c1c1e`, panels `#232326`/`#2a2a2c`, text `#e8e8ea`, muted `#9a9aa0`, borders `rgba(255,255,255,.08)`. Empty Pay bar = dark grey.
- Quick-key category folders = solid saturated color; product tiles = dark card + colored top stripe.

## Sell screen (register) — docs 43, 44
- Left column: "Search for products" label + search input, then **Quick Keys** grid. Category folder tiles (solid color) drill into products (colored header bar with × + product tiles). Search filters across all.
- Right column header: "↗ Retrieve sale · 🕐 Park sale · ▾ More actions…".
- Right column: cart panel — "Add a customer" field, line items, then "ADD  🔒 Discount  🔒 Promo code  Note" row, then the **Pay  N items  $X** bar (indigo when items, grey when empty).

## Other Sell screens
- **Sales history** (26/27): tabs All · Process return · Continue sale; filter row; results table Receipt·Customer·Sold by·Note·Sale total·Status(+return arrow); empty = bag icon.
- **Cash management** (45): "Remove cash" (red) / "Add cash" (indigo); table Date·User·Types·Transactions($).
- **Close register** (46): Register details; Count cash denomination table ($0.01…$100 + custom → CASH TOTAL); Payments summary (Expected·Counted·Differences per type); Note + "Close register".

## Admin screens (light) — build next
- **Home dashboard** (5): greeting + Today/Week/Month; sales chart; Things to know / Things to do; top products; report links.
- **Reporting** (15/16): 8 KPI cards (Revenue, Sale count, Customer count, Gross profit, Discounted, Discounted %, Avg sale value, Avg items/sale) w/ mini area charts; Products sold + Top sales people tables.
- **Products** (9): Products/Promotions/Price books/Brands/Suppliers/Tags/Categories/Adjustment reasons/Gift cards context; Import + Add product; filter row; table Product·Brand·Supplier·Available·Retail price·Active·Created.
- **Customers** (4): Import + Add customer; search + group + more filters; table Customer·Location·Store credit·Loyalty·Account; expandable row w/ Details/Store credit/Loyalty/Account/Notes.
- **Users** (42): Users·Roles·Activity tabs; table User·Role·Outlet·Daily/Weekly/Monthly target·Last active·Enabled.
- **Setup** (29–41): General/Billing/Outlets/Inventory/Devices/Payment types/On-account/Sales taxes/Loyalty/Users/Security/Apps/Store credit/Saved payment methods — settings forms.

## Build order
1. Shell (top bar + icon rail + theming) + routing ✅ this pass
2. Sell section (register, sales history, cash management, close register) ✅ this pass
3. Admin: Home, Reporting, Products, Customers, Users, Setup — next passes
