// Server-side seed catalog (mirrors the register's mock data; becomes the DB-backed source later).

export type TaxGroupId = 'standard' | 'food' | 'exempt';

export interface Category {
  id: string;
  name: string;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  categoryId: string;
  priceMinor: number;
  taxGroupId: TaxGroupId;
  sku: string;
  emoji: string;
}

export const TAX_BASIS_POINTS: Record<TaxGroupId, number> = {
  standard: 825,
  food: 0,
  exempt: 0,
};

export const CATEGORIES: Category[] = [
  { id: 'coffee', name: 'Coffee' },
  { id: 'bakery', name: 'Bakery' },
  { id: 'cold', name: 'Cold Drinks' },
  { id: 'grocery', name: 'Grocery' },
  { id: 'retail', name: 'Retail' },
];

export const VARIANTS: Variant[] = [
  { id: 'v-espresso', productId: 'p-espresso', name: 'Espresso', categoryId: 'coffee', priceMinor: 300, taxGroupId: 'standard', sku: 'COF-ESP', emoji: '☕' },
  { id: 'v-americano', productId: 'p-americano', name: 'Americano', categoryId: 'coffee', priceMinor: 350, taxGroupId: 'standard', sku: 'COF-AME', emoji: '☕' },
  { id: 'v-cappuccino', productId: 'p-cappuccino', name: 'Cappuccino', categoryId: 'coffee', priceMinor: 425, taxGroupId: 'standard', sku: 'COF-CAP', emoji: '☕' },
  { id: 'v-latte', productId: 'p-latte', name: 'Latte', categoryId: 'coffee', priceMinor: 475, taxGroupId: 'standard', sku: 'COF-LAT', emoji: '☕' },
  { id: 'v-flatwhite', productId: 'p-flatwhite', name: 'Flat White', categoryId: 'coffee', priceMinor: 450, taxGroupId: 'standard', sku: 'COF-FLW', emoji: '☕' },
  { id: 'v-mocha', productId: 'p-mocha', name: 'Mocha', categoryId: 'coffee', priceMinor: 500, taxGroupId: 'standard', sku: 'COF-MOC', emoji: '☕' },
  { id: 'v-coldbrew', productId: 'p-coldbrew', name: 'Cold Brew', categoryId: 'coffee', priceMinor: 450, taxGroupId: 'standard', sku: 'COF-CLB', emoji: '🧊' },
  { id: 'v-drip', productId: 'p-drip', name: 'Drip Coffee', categoryId: 'coffee', priceMinor: 275, taxGroupId: 'standard', sku: 'COF-DRP', emoji: '☕' },
  { id: 'v-croissant', productId: 'p-croissant', name: 'Croissant', categoryId: 'bakery', priceMinor: 325, taxGroupId: 'standard', sku: 'BAK-CRS', emoji: '🥐' },
  { id: 'v-muffin', productId: 'p-muffin', name: 'Blueberry Muffin', categoryId: 'bakery', priceMinor: 300, taxGroupId: 'standard', sku: 'BAK-MUF', emoji: '🧁' },
  { id: 'v-bagel', productId: 'p-bagel', name: 'Bagel', categoryId: 'bakery', priceMinor: 250, taxGroupId: 'standard', sku: 'BAK-BGL', emoji: '🥯' },
  { id: 'v-cookie', productId: 'p-cookie', name: 'Choc Chip Cookie', categoryId: 'bakery', priceMinor: 225, taxGroupId: 'standard', sku: 'BAK-CKE', emoji: '🍪' },
  { id: 'v-cinnamon', productId: 'p-cinnamon', name: 'Cinnamon Roll', categoryId: 'bakery', priceMinor: 400, taxGroupId: 'standard', sku: 'BAK-CIN', emoji: '🥮' },
  { id: 'v-water', productId: 'p-water', name: 'Bottled Water', categoryId: 'cold', priceMinor: 200, taxGroupId: 'food', sku: 'CLD-WTR', emoji: '💧' },
  { id: 'v-oj', productId: 'p-oj', name: 'Orange Juice', categoryId: 'cold', priceMinor: 375, taxGroupId: 'food', sku: 'CLD-OJ', emoji: '🧃' },
  { id: 'v-icedtea', productId: 'p-icedtea', name: 'Iced Tea', categoryId: 'cold', priceMinor: 325, taxGroupId: 'standard', sku: 'CLD-ITE', emoji: '🥤' },
  { id: 'v-sparkling', productId: 'p-sparkling', name: 'Sparkling Water', categoryId: 'cold', priceMinor: 275, taxGroupId: 'food', sku: 'CLD-SPK', emoji: '🫧' },
  { id: 'v-granola', productId: 'p-granola', name: 'Granola Bar', categoryId: 'grocery', priceMinor: 175, taxGroupId: 'food', sku: 'GRO-GRN', emoji: '🍫' },
  { id: 'v-trailmix', productId: 'p-trailmix', name: 'Trail Mix', categoryId: 'grocery', priceMinor: 450, taxGroupId: 'food', sku: 'GRO-TRL', emoji: '🥜' },
  { id: 'v-almondmilk', productId: 'p-almondmilk', name: 'Almond Milk', categoryId: 'grocery', priceMinor: 399, taxGroupId: 'food', sku: 'GRO-ALM', emoji: '🥛' },
  { id: 'v-mug', productId: 'p-mug', name: 'Nova Ceramic Mug', categoryId: 'retail', priceMinor: 1200, taxGroupId: 'standard', sku: 'RTL-MUG', emoji: '🍵' },
  { id: 'v-tumbler', productId: 'p-tumbler', name: 'Travel Tumbler', categoryId: 'retail', priceMinor: 2400, taxGroupId: 'standard', sku: 'RTL-TMB', emoji: '🥤' },
  { id: 'v-beans', productId: 'p-beans', name: 'Whole Bean Bag 12oz', categoryId: 'retail', priceMinor: 1600, taxGroupId: 'standard', sku: 'RTL-BNS', emoji: '🫘' },
  { id: 'v-giftcard', productId: 'p-giftcard', name: 'Gift Card $25', categoryId: 'retail', priceMinor: 2500, taxGroupId: 'exempt', sku: 'RTL-GFT', emoji: '🎁' },
];
