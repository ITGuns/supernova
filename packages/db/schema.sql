-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('RETAIL', 'RESTAURANT', 'ECOM');

-- CreateEnum
CREATE TYPE "OrderState" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'COMPLETED', 'CANCELLED', 'VOIDED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FulfillmentState" AS ENUM ('UNFULFILLED', 'IN_PROGRESS', 'FULFILLED', 'PARTIALLY_RETURNED', 'RETURNED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'GIFT_CARD', 'STORE_CREDIT', 'LOYALTY', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('SALE', 'RETURN', 'PO_RECEIVE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'COUNT', 'WASTAGE');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('STANDARD', 'SERVICE', 'GIFT_CARD', 'COMBO', 'BUNDLE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ModifierSelection" AS ENUM ('SINGLE', 'MULTI');

-- CreateEnum
CREATE TYPE "PricingRuleType" AS ENUM ('PERCENT_OFF', 'AMOUNT_OFF', 'BUY_X_GET_Y', 'BUNDLE');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('ORDER', 'LINE');

-- CreateEnum
CREATE TYPE "DiscountMethod" AS ENUM ('PERCENT', 'FIXED_AMOUNT', 'PRICE_OVERRIDE');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PriceBookStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LoyaltyTxnType" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'EXPIRE');

-- CreateEnum
CREATE TYPE "GiftCardStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'VOID');

-- CreateEnum
CREATE TYPE "GiftCardTxnType" AS ENUM ('ISSUE', 'RELOAD', 'REDEEM', 'REFUND', 'ADJUST');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DrawerStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('SALE', 'REFUND', 'PAYOUT', 'PAYIN', 'DROP', 'TIP');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'SEATED', 'ORDERED', 'CHECK_DROPPED', 'DIRTY');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'READY', 'SERVED', 'RECALLED', 'VOID');

-- CreateEnum
CREATE TYPE "MenuStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RegisterStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseCurrency" CHAR(3) NOT NULL,
    "country" CHAR(2) NOT NULL,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "channelTypes" "Channel"[],
    "currency" CHAR(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "taxJurisdictionId" TEXT,
    "status" "StoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Register" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceId" TEXT,
    "paymentTerminalId" TEXT,
    "status" "RegisterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "pin" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productType" "ProductType" NOT NULL DEFAULT 'STANDARD',
    "taxGroupId" TEXT,
    "brand" TEXT,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "optionValues" JSONB NOT NULL DEFAULT '{}',
    "basePriceMinor" INTEGER NOT NULL,
    "costMinor" INTEGER,
    "weightGrams" INTEGER,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selectionType" "ModifierSelection" NOT NULL DEFAULT 'SINGLE',
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modifier" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDeltaMinor" INTEGER NOT NULL DEFAULT 0,
    "linkedVariantId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Modifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModifierGroup" (
    "productId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductModifierGroup_pkey" PRIMARY KEY ("productId","groupId")
);

-- CreateTable
CREATE TABLE "PriceBook" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "channel" "Channel",
    "storeId" TEXT,
    "customerGroupId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "PriceBookStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PriceBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBookEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "priceBookId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PriceBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruleType" "PricingRuleType" NOT NULL,
    "channel" "Channel",
    "storeId" TEXT,
    "customerGroupId" TEXT,
    "conditions" JSONB NOT NULL,
    "effect" JSONB NOT NULL,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "usageLimit" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "RuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "scope" "DiscountScope" NOT NULL,
    "method" "DiscountMethod" NOT NULL,
    "value" INTEGER NOT NULL,
    "requiresPermission" TEXT,
    "minSubtotalMinor" INTEGER,
    "usageLimit" INTEGER,
    "perCustomerLimit" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "RuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxJurisdiction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL,
    "region" TEXT,
    "parentId" TEXT,

    CONSTRAINT "TaxJurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateBasisPoints" INTEGER NOT NULL,
    "compound" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "inclusive" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxGroup" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TaxGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taxGroupId" TEXT NOT NULL,
    "taxRateId" TEXT NOT NULL,
    "overrideRateBasisPoints" INTEGER,
    "exempt" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxExemption" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "jurisdictionId" TEXT,
    "certificateNo" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "TaxExemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerGroup" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultPriceBookId" TEXT,

    CONSTRAINT "CustomerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "groupId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "addresses" JSONB NOT NULL DEFAULT '[]',
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "LoyaltyTxnType" NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT,
    "currency" CHAR(3) NOT NULL,
    "balanceMinor" INTEGER NOT NULL DEFAULT 0,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardTransaction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "orderId" TEXT,
    "paymentId" TEXT,
    "type" "GiftCardTxnType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLevel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER,
    "reorderQty" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostMinor" INTEGER,
    "balanceAfter" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" JSONB,
    "currency" CHAR(3),
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "expectedAt" TIMESTAMP(3),
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "qtyOrdered" INTEGER NOT NULL,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,
    "unitCostMinor" INTEGER NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fromStoreId" TEXT NOT NULL,
    "toStoreId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "qtySent" INTEGER NOT NULL,
    "qtyReceived" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "state" "OrderState" NOT NULL DEFAULT 'DRAFT',
    "fulfillmentState" "FulfillmentState" NOT NULL DEFAULT 'UNFULFILLED',
    "currency" CHAR(3) NOT NULL,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "discountTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "taxTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "tipMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "paidMinor" INTEGER NOT NULL DEFAULT 0,
    "refundedMinor" INTEGER NOT NULL DEFAULT 0,
    "registerId" TEXT,
    "cashDrawerSessionId" TEXT,
    "tableId" TEXT,
    "serverId" TEXT,
    "parentOrderId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "placedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "lineDiscountMinor" INTEGER NOT NULL DEFAULT 0,
    "lineSubtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "costMinor" INTEGER,
    "taxGroupId" TEXT,
    "courseNo" INTEGER,
    "seatNo" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineModifier" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "modifierId" TEXT,
    "name" TEXT NOT NULL,
    "priceDeltaMinor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLineModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDiscount" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "appliedByUserId" TEXT,

    CONSTRAINT "OrderDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTaxLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "taxRateId" TEXT,
    "taxName" TEXT NOT NULL,
    "rateBasisPoints" INTEGER NOT NULL,
    "taxableBaseMinor" INTEGER NOT NULL,
    "taxAmountMinor" INTEGER NOT NULL,
    "inclusive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrderTaxLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "state" "PaymentState" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "tipMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "cashDrawerSessionId" TEXT,
    "giftCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderRecord" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cardBrand" TEXT,
    "last4" TEXT,
    "rawPayload" JSONB NOT NULL,
    "idempotencyKey" TEXT,

    CONSTRAINT "PaymentProviderRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "reason" TEXT,
    "providerRef" TEXT,
    "state" "PaymentState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "restock" BOOLEAN NOT NULL DEFAULT true,
    "amountMinor" INTEGER NOT NULL,

    CONSTRAINT "ReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashDrawerSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "openingFloatMinor" INTEGER NOT NULL,
    "countedCloseMinor" INTEGER,
    "expectedCloseMinor" INTEGER,
    "overShortMinor" INTEGER,
    "currency" CHAR(3) NOT NULL,
    "status" "DrawerStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CashDrawerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "paymentId" TEXT,
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "posX" INTEGER,
    "posY" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "seatNo" INTEGER NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT,
    "name" TEXT NOT NULL,
    "activeFrom" TEXT,
    "activeTo" TEXT,
    "status" "MenuStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "displayName" TEXT,
    "priceOverrideMinor" INTEGER,
    "stationTag" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "comboId" TEXT,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Combo" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,

    CONSTRAINT "Combo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComboComponent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "choiceVariantIds" JSONB NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 1,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ComboComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenTicket" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stationTag" TEXT NOT NULL,
    "courseNo" INTEGER NOT NULL DEFAULT 1,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bumpedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KitchenTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenTicketItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "modifiers" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',

    CONSTRAINT "KitchenTicketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tableId" TEXT,
    "coverCount" INTEGER NOT NULL DEFAULT 1,
    "checkNumber" INTEGER,
    "seatMap" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "RestaurantOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcomOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "billingAddress" JSONB,
    "shippingMethod" TEXT,
    "shippingMinor" INTEGER NOT NULL DEFAULT 0,
    "trackingNumber" TEXT,
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "EcomOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT,
    "actorUserId" TEXT,
    "actorDeviceId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "correlationId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "storeId" TEXT,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "deviceId" TEXT,
    "clientSeq" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "lastPulledAt" TIMESTAMP(3) NOT NULL,
    "lastVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Store_orgId_status_idx" ON "Store"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Store_orgId_code_key" ON "Store"("orgId", "code");

-- CreateIndex
CREATE INDEX "Register_orgId_storeId_idx" ON "Register"("orgId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Register_orgId_storeId_name_key" ON "Register"("orgId", "storeId", "name");

-- CreateIndex
CREATE INDEX "User_orgId_status_idx" ON "User"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_orgId_email_key" ON "User"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_orgId_name_key" ON "Role"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Membership_orgId_storeId_idx" ON "Membership"("orgId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_storeId_roleId_key" ON "Membership"("userId", "storeId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "Category_orgId_parentId_idx" ON "Category"("orgId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_orgId_slug_key" ON "Category"("orgId", "slug");

-- CreateIndex
CREATE INDEX "Product_orgId_categoryId_status_idx" ON "Product"("orgId", "categoryId", "status");

-- CreateIndex
CREATE INDEX "Product_orgId_taxGroupId_idx" ON "Product"("orgId", "taxGroupId");

-- CreateIndex
CREATE INDEX "ProductVariant_orgId_barcode_idx" ON "ProductVariant"("orgId", "barcode");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_orgId_sku_key" ON "ProductVariant"("orgId", "sku");

-- CreateIndex
CREATE INDEX "ModifierGroup_orgId_idx" ON "ModifierGroup"("orgId");

-- CreateIndex
CREATE INDEX "Modifier_orgId_groupId_idx" ON "Modifier"("orgId", "groupId");

-- CreateIndex
CREATE INDEX "PriceBook_orgId_channel_storeId_customerGroupId_priority_idx" ON "PriceBook"("orgId", "channel", "storeId", "customerGroupId", "priority");

-- CreateIndex
CREATE INDEX "PriceBookEntry_orgId_variantId_idx" ON "PriceBookEntry"("orgId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBookEntry_priceBookId_variantId_minQty_key" ON "PriceBookEntry"("priceBookId", "variantId", "minQty");

-- CreateIndex
CREATE INDEX "PricingRule_orgId_channel_storeId_status_priority_idx" ON "PricingRule"("orgId", "channel", "storeId", "status", "priority");

-- CreateIndex
CREATE INDEX "Discount_orgId_status_idx" ON "Discount"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_orgId_code_key" ON "Discount"("orgId", "code");

-- CreateIndex
CREATE INDEX "TaxJurisdiction_orgId_country_region_idx" ON "TaxJurisdiction"("orgId", "country", "region");

-- CreateIndex
CREATE INDEX "TaxRate_orgId_jurisdictionId_idx" ON "TaxRate"("orgId", "jurisdictionId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxGroup_orgId_name_key" ON "TaxGroup"("orgId", "name");

-- CreateIndex
CREATE INDEX "TaxRule_orgId_idx" ON "TaxRule"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_taxGroupId_taxRateId_key" ON "TaxRule"("taxGroupId", "taxRateId");

-- CreateIndex
CREATE INDEX "TaxExemption_orgId_customerId_idx" ON "TaxExemption"("orgId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerGroup_orgId_name_key" ON "CustomerGroup"("orgId", "name");

-- CreateIndex
CREATE INDEX "Customer_orgId_email_idx" ON "Customer"("orgId", "email");

-- CreateIndex
CREATE INDEX "Customer_orgId_phone_idx" ON "Customer"("orgId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_customerId_key" ON "LoyaltyAccount"("customerId");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_orgId_idx" ON "LoyaltyAccount"("orgId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_orgId_accountId_createdAt_idx" ON "LoyaltyTransaction"("orgId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "GiftCard_orgId_status_idx" ON "GiftCard"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_orgId_code_key" ON "GiftCard"("orgId", "code");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_orgId_giftCardId_createdAt_idx" ON "GiftCardTransaction"("orgId", "giftCardId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryLevel_orgId_storeId_idx" ON "InventoryLevel"("orgId", "storeId");

-- CreateIndex
CREATE INDEX "InventoryLevel_orgId_variantId_idx" ON "InventoryLevel"("orgId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLevel_storeId_variantId_key" ON "InventoryLevel"("storeId", "variantId");

-- CreateIndex
CREATE INDEX "StockMovement_orgId_storeId_variantId_createdAt_idx" ON "StockMovement"("orgId", "storeId", "variantId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_refType_refId_idx" ON "StockMovement"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_orgId_name_key" ON "Supplier"("orgId", "name");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orgId_storeId_status_idx" ON "PurchaseOrder"("orgId", "storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_orgId_poNumber_key" ON "PurchaseOrder"("orgId", "poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "StockTransfer_orgId_fromStoreId_status_idx" ON "StockTransfer"("orgId", "fromStoreId", "status");

-- CreateIndex
CREATE INDEX "StockTransfer_orgId_toStoreId_status_idx" ON "StockTransfer"("orgId", "toStoreId", "status");

-- CreateIndex
CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");

-- CreateIndex
CREATE INDEX "Order_orgId_storeId_channel_state_idx" ON "Order"("orgId", "storeId", "channel", "state");

-- CreateIndex
CREATE INDEX "Order_orgId_customerId_idx" ON "Order"("orgId", "customerId");

-- CreateIndex
CREATE INDEX "Order_storeId_updatedAt_idx" ON "Order"("storeId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orgId_storeId_orderNumber_key" ON "Order"("orgId", "storeId", "orderNumber");

-- CreateIndex
CREATE INDEX "OrderLine_orgId_orderId_idx" ON "OrderLine"("orgId", "orderId");

-- CreateIndex
CREATE INDEX "OrderLine_variantId_idx" ON "OrderLine"("variantId");

-- CreateIndex
CREATE INDEX "OrderLineModifier_orderLineId_idx" ON "OrderLineModifier"("orderLineId");

-- CreateIndex
CREATE INDEX "OrderDiscount_orgId_orderId_idx" ON "OrderDiscount"("orgId", "orderId");

-- CreateIndex
CREATE INDEX "OrderTaxLine_orgId_orderId_idx" ON "OrderTaxLine"("orgId", "orderId");

-- CreateIndex
CREATE INDEX "Payment_orgId_orderId_idx" ON "Payment"("orgId", "orderId");

-- CreateIndex
CREATE INDEX "Payment_orgId_state_idx" ON "Payment"("orgId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderRecord_paymentId_key" ON "PaymentProviderRecord"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderRecord_idempotencyKey_key" ON "PaymentProviderRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentProviderRecord_orgId_provider_providerRef_idx" ON "PaymentProviderRecord"("orgId", "provider", "providerRef");

-- CreateIndex
CREATE INDEX "Refund_orgId_orderId_idx" ON "Refund"("orgId", "orderId");

-- CreateIndex
CREATE INDEX "ReturnLine_refundId_idx" ON "ReturnLine"("refundId");

-- CreateIndex
CREATE INDEX "CashDrawerSession_orgId_storeId_registerId_status_idx" ON "CashDrawerSession"("orgId", "storeId", "registerId", "status");

-- CreateIndex
CREATE INDEX "CashMovement_orgId_sessionId_createdAt_idx" ON "CashMovement"("orgId", "sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Floor_orgId_storeId_idx" ON "Floor"("orgId", "storeId");

-- CreateIndex
CREATE INDEX "RestaurantTable_orgId_storeId_status_idx" ON "RestaurantTable"("orgId", "storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_orgId_storeId_label_key" ON "RestaurantTable"("orgId", "storeId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_tableId_seatNo_key" ON "Seat"("tableId", "seatNo");

-- CreateIndex
CREATE INDEX "Menu_orgId_storeId_idx" ON "Menu"("orgId", "storeId");

-- CreateIndex
CREATE INDEX "MenuItem_orgId_menuId_idx" ON "MenuItem"("orgId", "menuId");

-- CreateIndex
CREATE INDEX "MenuItem_productId_idx" ON "MenuItem"("productId");

-- CreateIndex
CREATE INDEX "Combo_orgId_idx" ON "Combo"("orgId");

-- CreateIndex
CREATE INDEX "ComboComponent_comboId_idx" ON "ComboComponent"("comboId");

-- CreateIndex
CREATE INDEX "KitchenTicket_orgId_storeId_stationTag_status_idx" ON "KitchenTicket"("orgId", "storeId", "stationTag", "status");

-- CreateIndex
CREATE INDEX "KitchenTicket_orderId_idx" ON "KitchenTicket"("orderId");

-- CreateIndex
CREATE INDEX "KitchenTicketItem_ticketId_idx" ON "KitchenTicketItem"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOrder_orderId_key" ON "RestaurantOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "EcomOrder_orderId_key" ON "EcomOrder"("orderId");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_entityType_entityId_idx" ON "AuditLog"("orgId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_orgId_publishedAt_idx" ON "OutboxEvent"("orgId", "publishedAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "OrderEvent_orgId_orderId_createdAt_idx" ON "OrderEvent"("orgId", "orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderEvent_orderId_deviceId_clientSeq_key" ON "OrderEvent"("orderId", "deviceId", "clientSeq");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_deviceId_entity_key" ON "SyncCursor"("deviceId", "entity");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Register" ADD CONSTRAINT "Register_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modifier" ADD CONSTRAINT "Modifier_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ModifierGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModifierGroup" ADD CONSTRAINT "ProductModifierGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModifierGroup" ADD CONSTRAINT "ProductModifierGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ModifierGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookEntry" ADD CONSTRAINT "PriceBookEntry_priceBookId_fkey" FOREIGN KEY ("priceBookId") REFERENCES "PriceBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookEntry" ADD CONSTRAINT "PriceBookEntry_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxJurisdiction" ADD CONSTRAINT "TaxJurisdiction_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TaxJurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_taxGroupId_fkey" FOREIGN KEY ("taxGroupId") REFERENCES "TaxGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "TaxRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxExemption" ADD CONSTRAINT "TaxExemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CustomerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineModifier" ADD CONSTRAINT "OrderLineModifier_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTaxLine" ADD CONSTRAINT "OrderTaxLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTaxLine" ADD CONSTRAINT "OrderTaxLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProviderRecord" ADD CONSTRAINT "PaymentProviderRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashDrawerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboComponent" ADD CONSTRAINT "ComboComponent_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Combo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTicketItem" ADD CONSTRAINT "KitchenTicketItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "KitchenTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcomOrder" ADD CONSTRAINT "EcomOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

