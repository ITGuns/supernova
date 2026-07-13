# Nova — Commerce & Point-of-Sale Suite

Nova is an original, from-scratch commerce platform with functional parity to a full modern POS product line:

- **Nova Retail** — register checkout, barcode scanning, split tender, cash management, purchase orders & receiving, stock transfers, returns/refunds, receipts, gift cards, loyalty.
- **Nova Restaurant** — floor plan & table management, menus with modifiers/combos, open tabs, send-to-kitchen + Kitchen Display System (KDS), course timing, split checks, tips.
- **Nova eCom** — online storefront with catalog/inventory synced to the same core services, feeding the same unified order pipeline.

All three channels share ONE core domain (products, inventory, customers, pricing, tax, orders, payments) and ONE unified order pipeline.

> Independent implementation. It reproduces workflows and features common to modern POS systems — not any vendor's proprietary code, branding, or trademarked assets.

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm + Turborepo, TypeScript everywhere |
| Backend | NestJS · PostgreSQL · Prisma · Redis · WebSockets |
| POS terminal + admin | React (Vite) PWA — offline-first (IndexedDB + sync layer), tablet-first |
| eCom storefront | Next.js |
| Payments | `PaymentProvider` interface — mock (dev) + Stripe / Stripe Terminal adapter |
| Auth | JWT + refresh, role-based access control (owner, manager, cashier, server, kitchen) |
| Local dev | Docker Compose (Postgres + Redis) |

## Monorepo layout

```
apps/
  api/         NestJS core API — serves all three channels
  pos/         React PWA register (Retail + Restaurant terminal)
  admin/       Back-office admin console
  storefront/  Next.js eCom storefront
packages/
  types/       Shared domain types + API client contracts
docs/
  architecture.md   System design + data model (source of truth)
```

## Quickstart

```bash
pnpm install
cp .env.example .env
pnpm db:up      # start Postgres + Redis via Docker
pnpm dev        # run apps in dev
```

## Build phases

- **Phase 0 — Foundation:** monorepo, tooling, CI, Docker Compose, base auth, shared types, DB + migrations.
- **Phase 1 — Core domain:** products/variants, categories, inventory + stock movements, customers, pricing, tax, roles.
- **Phase 2 — Retail POS:** register, cart, checkout, split tender, payments (mock), receipts, cash drawer, returns, POs, transfers.
- **Phase 3 — Restaurant:** floor plan, menus + modifiers, tabs, KDS over WebSocket, split checks, tips.
- **Phase 4 — eCom:** storefront, catalog/inventory sync, cart, online checkout into the shared pipeline.
- **Phase 5 — Cross-cutting:** multi-store partitioning, reporting dashboards, offline sync + conflict resolution, granular roles.
- **Phase 6 — Hardening:** integration/e2e tests, performance, realistic seed/demo data, setup docs.
