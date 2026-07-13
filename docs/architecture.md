# Nova POS — Architecture & Data Model

**Status:** Implementation-ready design artifact · **Scope:** Retail register · Restaurant · eCom on one core domain
**Stack (fixed):** pnpm + Turborepo · TypeScript · NestJS + PostgreSQL + Prisma + Redis + WebSockets · React PWA (offline) + Next.js storefront · `PaymentProvider` interface · JWT+refresh RBAC

> This document is the source of truth for the data model and module boundaries. It was produced by the up-front [COMPLEX] architecture pass. The Prisma schema in `packages/db/prisma/schema.prisma` implements this design (with `cuid(2)` IDs; a few back-relations were added for Prisma validity).

**Global conventions used throughout this document**
- **IDs:** `cuid2` string PKs, client-generatable (see §3).
- **Money:** integer **minor units** (`Int`) in a field suffixed `...Minor`, always paired with an ISO-4217 `currency` on the aggregate root. No floats, ever.
- **Tenancy:** every tenant-owned row carries `orgId`; store-scoped rows also carry `storeId`. These lead every composite index.
- **Sync/audit columns:** `createdAt`, `updatedAt`, `version Int` (optimistic-lock + sync vector), and `deletedAt` (soft delete) on mutable entities.

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Monorepo layout

```
apps/
  api            NestJS backend (all modules below)
  pos            React PWA — Retail register + Restaurant + back-office admin (offline)
  storefront     Next.js eCom
packages/
  domain         framework-free domain types, enums, the Pricing/Tax engines (pure TS, runs on server AND in PWA)
  db             Prisma schema + generated client + migrations
  sdk            typed API client (REST + WS contracts) shared by pos & storefront
  ui             shared React component library
  sync           offline outbox/replay client (Phase 5, but consumes schema built now)
```

The **Pricing engine** and **Tax engine** live in `packages/domain` as pure functions so the exact same code prices a line on the server and inside the offline PWA. This is the single most important architectural rule: *no pricing/tax logic in NestJS services or React components — only in `domain`.*

### 1.2 NestJS module boundaries

**Shared core (channel-agnostic — the "one core domain"):**

| Module | Responsibility |
|---|---|
| `IdentityModule` | JWT access/refresh, device registration, RBAC guard, permission resolution |
| `TenancyModule` | Organization, Store, Register lifecycle; injects the tenant scope into every request |
| `CatalogModule` | Product, ProductVariant, Category, ModifierGroup/Modifier (canonical sellables) |
| `PricingModule` | PriceBook, PricingRule, Discount CRUD; wraps `domain` pricing engine |
| `TaxModule` | TaxRate, TaxGroup, exemptions; wraps `domain` tax engine |
| `InventoryModule` | InventoryLevel, StockMovement ledger, Supplier, PurchaseOrder, StockTransfer |
| `CustomerModule` | Customer, CustomerGroup, LoyaltyAccount, GiftCard |
| `OrderModule` | **The unified order pipeline** — Order/OrderLine, state machine, applies pricing+tax, emits domain events |
| `PaymentModule` | `PaymentProvider` interface, Payment/Tender, Refund/Return, provider transaction records |
| `CashModule` | CashDrawerSession, CashMovement, X/Z reports |
| `RealtimeModule` | WebSocket gateway + Redis adapter (see §1.4) |
| `AuditModule` | Append-only AuditLog interceptor |
| `SyncModule` | OutboxEvent dispatch, pull/push sync endpoints (Phase 5; schema exists now) |

**Channel surfaces (thin orchestrators over the core — the "channel-specific" parts):**

| Module | Owns | Delegates to core |
|---|---|---|
| `RetailModule` | Register UX flows, park/resume sale, drawer open, receipt | `OrderModule` (channel=RETAIL), `CashModule`, `PaymentModule` |
| `RestaurantModule` | Floor/Table/Seat, Menu/MenuItem/Combo, KitchenTicket routing, course firing, split checks | `OrderModule` (channel=RESTAURANT), `RealtimeModule` (KDS) |
| `EcomModule` | Cart→order, storefront read API, shipping/fulfillment, webhooks | `OrderModule` (channel=ECOM), `PaymentModule` |

**Rule of thumb for shared-vs-specific:** anything touching money, inventory, tax, customer identity, or the order record is **core and shared**. Anything about *how a human interacts with the order* (a table, a kitchen station, a shipping label, a cash drawer) is **channel-specific** and lives in the surface module. Channel modules never write `Order`/`Payment`/`StockMovement` directly — they call `OrderModule`/`PaymentModule` so all three channels flow through one validated pipeline.

### 1.3 Three channels → ONE `Order`

All three channels create the **same `Order` aggregate**, discriminated by `channel` and carrying a `metadata` JSON envelope plus optional 1:1 channel extension rows for structured channel data.

```
Order (shared spine)
 ├─ channel:            RETAIL | RESTAURANT | ECOM        ← discriminator
 ├─ shared fields:      orgId, storeId, customerId, currency, lines[],
 │                      discounts[], taxLines[], payments[], totals, state, fulfillmentState
 ├─ RESTAURANT ext →    tableId, seatMap, coverCount, serverId, checkNumber, kitchenTickets[]
 ├─ ECOM ext →          shippingAddress, billingAddress, shippingMethod, fulfillmentShipments[]
 └─ RETAIL ext →        registerId, cashDrawerSessionId
```

**Shared fields** (identical semantics across channels): `orgId`, `storeId`, `channel`, `customerId?`, `currency`, `state`, `fulfillmentState`, all monetary totals, `lines`, `discounts`, `taxLines`, `payments`, audit/version columns.

**Channel-specific specializations** are *never* new columns bolted onto shared logic — they are: (a) nullable FKs meaningful to one channel (`tableId`, `registerId`), (b) the `RestaurantOrder`/`EcomOrder` 1:1 extension rows for typed channel data, and (c) the `metadata Json` escape hatch for truly free-form bits. This keeps the hot query path (`Order` + `OrderLine`) narrow.

#### Order state machine

Two **orthogonal axes** — payment and fulfillment — plus terminal states. Keeping them separate is what lets one machine serve a register (pay-then-hand-over), a restaurant tab (fulfill-then-pay), and eCom (pay-then-fulfill-async).

**`OrderState` (payment/lifecycle axis):**
```
DRAFT ──▶ OPEN ──▶ PARTIALLY_PAID ──▶ PAID ──▶ COMPLETED
  │        │             │              │
  ▼        ▼             ▼              ▼
CANCELLED  CANCELLED   (refund) ──▶ PARTIALLY_REFUNDED / REFUNDED
                                       │
                                     VOIDED (same-session reversal of a PAID order)
```

**`FulfillmentState` (fulfillment axis, orthogonal):**
```
UNFULFILLED ──▶ IN_PROGRESS ──▶ FULFILLED     (+ RETURNED / PARTIALLY_RETURNED)
```

**Channel transition semantics (same states, different order of traversal):**

| Channel | Typical path |
|---|---|
| **Retail** | `DRAFT` (ring items, offline OK) → `OPEN` → tender → `PAID` → drawer/receipt → `COMPLETED`; fulfillment `UNFULFILLED→FULFILLED` at handover, same transaction. |
| **Restaurant** | `DRAFT` (tab) → `OPEN` (check); fires kitchen tickets moving `FulfillmentState UNFULFILLED→IN_PROGRESS→FULFILLED` while `OrderState` stays `OPEN`; settle check → `PARTIALLY_PAID`/`PAID` → `COMPLETED`. Supports split checks (child Orders) and re-open. |
| **eCom** | `DRAFT` (cart) → `OPEN` (placed) → authorize/capture → `PAID`; then async `FulfillmentState IN_PROGRESS` (pick/pack) → `FULFILLED` (shipped/delivered). |

State is guarded server-side by an `OrderStateMachine` in `OrderModule` (allowed-transition table + invariants: e.g. cannot `PAID`→`COMPLETED` while `fulfillmentState≠FULFILLED` for retail; cannot `VOID` after settlement day close). Every accepted transition appends an `OutboxEvent` and an `AuditLog` row (§3).

### 1.4 Real-time (WebSocket + Redis pub/sub)

Socket.IO gateway in `RealtimeModule` with the **Redis adapter** so any API instance can broadcast to a room regardless of which instance holds the socket. Domain events published to Redis channels fan out to socket rooms.

**Room naming (hierarchical, tenant-scoped):**
```
org:{orgId}:store:{storeId}:floor                floor/table status (Restaurant host + servers)
org:{orgId}:store:{storeId}:kds:{stationId}      per kitchen station ticket feed (KDS)
org:{orgId}:store:{storeId}:expo                  expediter — all stations aggregated
org:{orgId}:store:{storeId}:register:{registerId} register-scoped events (drawer, offline peer)
org:{orgId}:store:{storeId}:inventory            live stock deltas for a store
org:{orgId}:store:{storeId}:orders               new/updated order feed (back office)
```

**Flows:**
- **KDS tickets:** `OrderModule` fires a course → creates `KitchenTicket` (routed to station by menu-item station tag) → publishes `kitchen.ticket.created` → Redis → `kds:{stationId}` room. Bump/recall from KDS emits back to `expo` + `floor`.
- **Floor status:** table state changes (`SEATED`, `ORDERED`, `CHECK_DROPPED`, `DIRTY`) publish to `:floor`.
- **Inventory sync:** every committed `StockMovement` publishes a delta to `:inventory`; PWA registers reconcile their IndexedDB cache. This is *notification only* — the ledger + `InventoryLevel` in Postgres remains source of truth.
- **Auth/scoping:** on connect, the JWT is verified and the socket is auto-joined only to rooms its RBAC permissions + store memberships allow. No cross-tenant room joins.

Redis also backs: refresh-token/session denylist, pricing/tax rule cache, and the socket adapter.

---

## 2. CORE DATA MODEL

See `packages/db/prisma/schema.prisma` for the authoritative, validated implementation. Model groups: Tenancy & Identity (RBAC), Catalog, Pricing & Discounts, Tax engine, Customer/Loyalty/Gift Cards, Inventory & Supply, unified Order pipeline & Payments, Cash management, Restaurant, Audit & Sync.

---

## 3. KEY DECISIONS

- **Primary keys — `cuid2` strings.** Offline registers/tabs must mint IDs with zero server round-trip and zero collision risk on later sync; auto-increment `bigint` can't do that and UUIDv4 index-fragments. `cuid2` is collision-resistant, k-sortable enough, and URL-safe. Exception: purely server-side append logs (`AuditLog`, `OutboxEvent.sequence`) use `bigint autoincrement` because strict global ordering matters and they're never client-generated.

- **Money — integer minor units, no floats, ever.** All amounts are `Int` fields suffixed `...Minor`, paired with an ISO-4217 `currency` on the aggregate root (`Order`, `Payment`, `GiftCard`, `PriceBook`, `PurchaseOrder`). Rates are integers too (`rateBasisPoints`, e.g. 825 = 8.25%). **Multi-currency scope:** each Order/Payment is single-currency (store's currency); the org may operate stores in different currencies, but we do **not** do FX conversion inside an order in v1 — cross-currency reporting is a rollup concern, not a transactional one.

- **Multi-tenant partitioning — single DB, row-scoped by `orgId` (+ `storeId`).** Every tenant-owned row carries `orgId`; store-scoped rows also carry `storeId`, and both lead every composite index. Scoping threads through queries via a **Prisma Client extension** that injects `where: { orgId }` from an AsyncLocalStorage request context populated by a NestJS `TenantContextInterceptor`. Postgres **Row-Level Security** as defense-in-depth. Sharding by org is a later, non-breaking evolution because the scope column already exists.

- **Inventory — materialized `InventoryLevel.onHand` + immutable `StockMovement` ledger (hybrid).** The ledger is the source of truth; `InventoryLevel.onHand` is a materialized projection updated in the **same transaction** as the movement, guarded by its `version` optimistic lock. A periodic reconcile job replays the ledger; `balanceAfter` enables cheap point-in-time audits.

- **Tax — resolved in the `domain` engine, computed at order time, stored as immutable `OrderTaxLine`.** Resolution: `store → TaxJurisdiction` chain × `variant.product.taxGroupId → TaxRule` → applicable `TaxRate[]`, minus matching `TaxExemption`/`Customer.taxExempt`. Tax computed **per line, per rate** and persisted as snapshots so receipts stay historically exact.

- **Pricing/discount resolution — ONE ordered pipeline in `domain`.** Fixed order: **(1) PriceBook** → **(2) PricingRule** (auto promos) → **(3) Discount** (manual/coupon) → **(4) Tax**. Pure function → offline PWA and server produce byte-identical totals.

- **Offline-sync schema baked in NOW.** Every mutable entity has client-generatable `cuid2` id, `updatedAt`, `version`; order-path rows carry `deviceId`; infra tables `OutboxEvent`, `OrderEvent` (idempotent by `[orderId, deviceId, clientSeq]`), `SyncCursor`. **Event-sourced writes for financial/order data, last-write-wins for reference data.**

- **Audit log — append-only, server-side, diff-structured.** `bigint` PK for strict ordering; `before`/`after` JSON diffs; complemented by the immutable financial ledgers.
