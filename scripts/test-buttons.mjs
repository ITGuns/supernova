import { chromium } from 'playwright';

const base = process.env.BASE ?? 'http://localhost:5173';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
let pass = 0;
let fail = 0;
const check = (name, cond) => {
  if (cond) {
    pass++;
    console.log('PASS', name);
  } else {
    fail++;
    console.log('FAIL', name);
  }
};

// ---- Loyalty ----
await p.goto(base + '/setup', { waitUntil: 'networkidle' });
await p.getByText('Loyalty', { exact: true }).first().click();
await p.waitForTimeout(300);
// loyaltyEnabled syncs from Supabase, so it may start off — turn it on first.
const loyaltyOff = p.getByText('Enable Loyalty', { exact: true });
if (await loyaltyOff.count()) {
  await loyaltyOff.click();
  await p.waitForTimeout(300);
}
const chk = p.locator('.chk').first();
const before = await chk.evaluate((el) => el.classList.contains('on'));
await chk.click();
const after = await chk.evaluate((el) => el.classList.contains('on'));
check('loyalty checkbox toggles', before !== after);
await p.getByText('Expiry based on last purchase date').first().click();
await p.waitForTimeout(200);
const activeChoice = await p.locator('.set-choice.active b').first().innerText();
check('loyalty expiry selects last-purchase', activeChoice.includes('Expiry based'));
await p.getByText('Disable Loyalty', { exact: true }).click();
await p.waitForTimeout(200);
check('loyalty disable -> Enable button', await p.getByText('Enable Loyalty').isVisible());
await p.getByText('Enable Loyalty').click();
await p.waitForTimeout(200);
check('loyalty re-enable works', await p.getByText('Earning percentage').isVisible());

// ---- Billing ----
await p.goto(base + '/setup', { waitUntil: 'networkidle' });
await p.getByText('Billing', { exact: true }).first().click();
await p.waitForTimeout(200);
await p.getByText('View our pricing plans').click();
await p.waitForTimeout(200);
check('billing "view pricing plans" -> Upgrade', await p.getByText('Your current plan', { exact: true }).isVisible());
await p.getByText('Manage plan', { exact: true }).click();
await p.waitForTimeout(200);
check('billing Manage tab', await p.getByText('All of your licenses are being used').isVisible());
await p.getByText('Edit licenses').click();
await p.waitForTimeout(200);
check('billing "Edit licenses" -> Upgrade', await p.getByText('Your current plan', { exact: true }).isVisible());
// The total is computed from the current plan, so compare the two frequencies
// rather than hard-coding a price.
await p.getByText('Monthly billing').click();
await p.waitForTimeout(200);
const monthlyTotal = await p.locator('.freq-total span').last().innerText();
await p.getByText('Annual billing').click();
await p.waitForTimeout(200);
const annualTotal = await p.locator('.freq-total span').last().innerText();
check(
  'billing annual toggle updates total',
  annualTotal !== monthlyTotal && /^\$[\d,]+\.\d{2}$/.test(annualTotal),
);

// ---- Outlets & registers ----
await p.goto(base + '/setup', { waitUntil: 'networkidle' });
await p.getByText('Outlets and registers', { exact: true }).first().click();
await p.waitForTimeout(300);
const outBefore = await p.locator('.arow.out').count();
await p.getByText('Add outlet').click();
await p.waitForTimeout(200);
check('outlets "Add outlet" appends row', (await p.locator('.arow.out').count()) === outBefore + 1);
await p.locator('.arow.out').first().click();
await p.waitForTimeout(200);
check('outlet row expands to registers', await p.locator('.out-expand').first().isVisible());
await p.getByText('Receipts', { exact: true }).click();
await p.waitForTimeout(200);
// Template names come from persisted setup, so assert the table, not a seed name.
check('receipts tab loads', await p.locator('.athead.rcpt').isVisible());
const rcptBefore = await p.locator('.arow.rcpt').count();
await p.getByText('Add receipt template').click();
await p.waitForTimeout(200);
check('receipts "Add template" appends', (await p.locator('.arow.rcpt').count()) === rcptBefore + 1);

// ---- Payment types ----
await p.goto(base + '/setup', { waitUntil: 'networkidle' });
await p.getByText('Payment types', { exact: true }).first().click();
await p.waitForTimeout(300);
const payBefore = await p.locator('.payrow').count();
await p.getByText('Add payment type').click();
await p.waitForTimeout(200);
check('payment types "Add payment type" appends', (await p.locator('.payrow').count()) === payBefore + 1);

// ---- Store credit ----
await p.goto(base + '/setup', { waitUntil: 'networkidle' });
await p.getByText('Store credit', { exact: true }).first().click();
await p.waitForTimeout(300);
const sw = p.locator('.switch').first();
const scBefore = await sw.evaluate((el) => el.classList.contains('on'));
await sw.click();
check('store credit switch toggles', (await sw.evaluate((el) => el.classList.contains('on'))) !== scBefore);

// ---- Saved payment methods ----
await p.goto(base + '/setup', { waitUntil: 'networkidle' });
await p.getByText('Saved payment methods', { exact: true }).first().click();
await p.waitForTimeout(300);
const sw2 = p.locator('.switch').first();
const spBefore = await sw2.evaluate((el) => el.classList.contains('on'));
await sw2.click();
check('saved-payment switch toggles', (await sw2.evaluate((el) => el.classList.contains('on'))) !== spBefore);

// ---- Security ----
await p.goto(base + '/setup', { waitUntil: 'networkidle' });
await p.getByText('Security', { exact: true }).first().click();
await p.waitForTimeout(300);
const secRow = p.locator('.radio-row', { hasText: 'Always require a password when switching between users' });
await secRow.click();
await p.waitForTimeout(200);
check('security radio selects', await secRow.locator('.radio.on').isVisible());
const inact = p.locator('.chk-row', { hasText: 'Require logging in after inactivity' });
const cbBefore = await inact.locator('.chk').evaluate((el) => el.classList.contains('on'));
await inact.click();
await p.waitForTimeout(200);
check('security checkbox toggles', (await inact.locator('.chk').evaluate((el) => el.classList.contains('on'))) !== cbBefore);

// ---- Sales tax ----
await p.goto(base + '/setup', { waitUntil: 'networkidle' });
await p.getByText('Sales taxes', { exact: true }).first().click();
await p.waitForTimeout(300);
const txBefore = await p.locator('.tax-row').count();
await p.getByText('Add Sales Tax').click();
await p.waitForTimeout(200);
check('sales tax "Add Sales Tax" appends', (await p.locator('.tax-row').count()) === txBefore + 1);

// ---- Users ----
await p.goto(base + '/setup', { waitUntil: 'networkidle' });
await p.getByText('Users', { exact: true }).first().click();
await p.waitForTimeout(300);
const uBefore = await p.locator('.arow.usr2').count();
await p.getByText('Add user').click();
await p.waitForTimeout(200);
check('users "Add user" appends', (await p.locator('.arow.usr2').count()) === uBefore + 1);
const usw = p.locator('.arow.usr2 .switch').last();
const uswBefore = await usw.evaluate((el) => el.classList.contains('on'));
await usw.click();
check('user enabled toggle works', (await usw.evaluate((el) => el.classList.contains('on'))) !== uswBefore);

// ---- Customers ----
await p.goto(base + '/customers', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
check('customers fresh empty', (await p.locator('.arow.cust2').count()) === 0);
await p.getByText('Add customer').click();
await p.waitForTimeout(200);
check('customers "Add customer" opens modal', await p.locator('.pm-head', { hasText: 'Add customer' }).isVisible());
await p.locator('.pm .set-input').nth(0).fill('Casey');
await p.locator('.pm .set-input').nth(1).fill('Rivera');
await p.locator('.pm .btn-p').click();
await p.waitForTimeout(300);
check('customers "Add customer" appends', (await p.locator('.arow.cust2').count()) === 1);
await p.locator('.filter-row input').first().fill('zzz-nomatch');
await p.waitForTimeout(200);
check('customers search filters', (await p.locator('.arow.cust2').count()) === 0);
await p.locator('.filter-row input').first().fill('');
await p.waitForTimeout(200);
await p.locator('.arow.cust2').first().click();
await p.waitForTimeout(200);
await p.locator('.cust-expand .sh-tab').filter({ hasText: 'Loyalty' }).click();
await p.waitForTimeout(200);
check('customer detail tab switches', await p.locator('.cust-expand .sh-tab.active').filter({ hasText: 'Loyalty' }).isVisible());
const delBefore = await p.locator('.arow.cust2').count();
await p.getByText('Delete', { exact: true }).click();
await p.waitForTimeout(200);
check('customer delete removes row', (await p.locator('.arow.cust2').count()) === delBefore - 1);

// ---- Stock control ----
await p.goto(base + '/inventory', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
const invBefore = await p.locator('.inv-row').count();
// Purchase orders persist to Supabase, so the list is empty only until the first run.
check('stock control renders its orders list', (await p.locator('.inv-row, .astate').count()) >= 1);
await p.getByText('Order stock', { exact: true }).click();
await p.waitForTimeout(200);
check('stock control "Order stock" opens PO edit modal', await p.locator('.pm-head', { hasText: 'Edit Purchase Order' }).isVisible());
await p.getByText('Save changes', { exact: true }).click();
await p.waitForTimeout(200);
check('stock control "Order stock" appends a PO row', (await p.locator('.inv-row').count()) === invBefore + 1);
await p.locator('.sc-frow input').first().fill('zzz-nomatch');
await p.waitForTimeout(200);
check('stock control search filters orders', (await p.locator('.inv-row').count()) === 0);
await p.getByText('Clear filters', { exact: true }).click();
await p.waitForTimeout(150);
check('stock control "Clear filters" restores list', (await p.locator('.inv-row').count()) >= 1);
await p.locator('.inv-row .rlink').first().click();
await p.waitForTimeout(200);
check('stock control order number opens edit modal', await p.locator('.pm-head', { hasText: 'Edit' }).isVisible());
await p.locator('.pm-close').click();
await p.waitForTimeout(150);

// ---- Inventory counts ----
await p.getByText('Inventory counts', { exact: true }).first().click();
await p.waitForTimeout(300);
check('inventory counts scanner promo visible', await p.getByText('Get the job done faster with our free mobile app, Scanner').isVisible());
await p.getByText('OK, got it', { exact: true }).click();
await p.waitForTimeout(200);
check('inventory counts "OK, got it" dismisses scanner', !(await p.locator('.scanner-card').count()));
const cntBefore = await p.locator('.cnt2-row').count();
await p.getByText('Add inventory count', { exact: true }).click();
await p.waitForTimeout(200);
check('inventory counts "Add inventory count" appends', (await p.locator('.cnt2-row').count()) === cntBefore + 1);

// ---- Products ----
await p.goto(base + '/catalog', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
const prodBefore = await p.locator('.arow.prod2').count();
await p.getByText('Add product', { exact: true }).click();
await p.waitForTimeout(200);
check('products "Add product" opens edit modal', await p.locator('.pm-head', { hasText: 'Edit Product Profile' }).isVisible());
await p.getByText('Save changes', { exact: true }).click();
await p.waitForTimeout(200);
check('products "Add product" appends a row', (await p.locator('.arow.prod2').count()) === prodBefore + 1);
const psw = p.locator('.arow.prod2 .switch').first();
const pswBefore = await psw.evaluate((el) => el.classList.contains('on'));
await psw.click();
await p.waitForTimeout(100);
check('product Active toggle works', (await psw.evaluate((el) => el.classList.contains('on'))) !== pswBefore);
// Products persist to Supabase and accumulate, so match the row we just added
// by its exact name rather than assuming it is the only one.
await p.locator('.sc-frow input').first().fill('zzz-nomatch');
await p.waitForTimeout(200);
check('products search filters out non-matches', (await p.locator('.arow.prod2').count()) === 0);
await p.locator('.sc-frow input').first().fill(`New Product ${prodBefore + 1}`);
await p.waitForTimeout(200);
check('products search finds the added row', (await p.locator('.arow.prod2').count()) >= 1);
await p.locator('.sc-frow input').first().fill('');
await p.waitForTimeout(150);
const cardBefore = await p.locator('.onb-card').count();
await p.locator('.onb-card .rlink', { hasText: 'Dismiss' }).first().click();
await p.waitForTimeout(150);
check('products onboarding card dismisses', (await p.locator('.onb-card').count()) === cardBefore - 1);
await p.getByText('Import', { exact: true }).click();
await p.waitForTimeout(200);
check('products Import opens import modal', await p.locator('.pm-head', { hasText: 'Import Products' }).isVisible());
await p.locator('.pm-close').click();
await p.waitForTimeout(150);

// ---- Brands ----
await p.goto(base + '/catalog', { waitUntil: 'networkidle' });
await p.getByText('Brands', { exact: true }).first().click();
await p.waitForTimeout(300);
const brBefore = await p.locator('.arow.brand').count();
await p.getByText('Add brand', { exact: true }).click();
await p.waitForTimeout(200);
check('brands "Add brand" opens modal', await p.locator('.pm-head', { hasText: 'Add Brand' }).isVisible());
await p.locator('.pm .set-input').first().fill('Zephyr Labs');
await p.getByText('Save changes', { exact: true }).click();
await p.waitForTimeout(200);
check('brands add appends row', (await p.locator('.arow.brand').count()) === brBefore + 1);
check('brand new name visible', await p.getByText('Zephyr Labs', { exact: true }).first().isVisible());

// ---- Product categories ----
await p.getByText('Product categories', { exact: true }).first().click();
await p.waitForTimeout(300);
const catBefore = await p.locator('.arow.pcat').count();
await p.getByText('Add category', { exact: true }).click();
await p.waitForTimeout(200);
check('categories "Add category" opens modal', await p.locator('.pm-head', { hasText: 'Add Product Category' }).isVisible());
await p.locator('.pm .set-input').first().fill('Seasonal');
await p.getByText('Save changes', { exact: true }).click();
await p.waitForTimeout(200);
check('categories add appends row', (await p.locator('.arow.pcat').count()) === catBefore + 1);

// ---- Adjustment reasons ----
await p.getByText('Adjustment reasons', { exact: true }).first().click();
await p.waitForTimeout(300);
check('adjustment reasons page renders', await p.locator('.athead.adj4').isVisible());

// ---- Retail dashboard ----
await p.goto(base + '/reporting', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
// Assert every KPI card has a chart rather than pinning the card count.
const kpiCards = await p.locator('.kpi-card').count();
check('dashboard renders KPI cards', kpiCards >= 6);
check('dashboard KPI charts render', (await p.locator('.kchart').count()) === kpiCards);
await p.locator('.dash-seg-btn', { hasText: 'Week' }).click();
await p.waitForTimeout(150);
check('dashboard View seg switches to Week', await p.locator('.dash-seg-btn.active', { hasText: 'Week' }).isVisible());
const dateBefore = await p.locator('.date-box').innerText();
await p.locator('.date-arrow').last().click();
await p.waitForTimeout(150);
check('dashboard date next-arrow advances date', (await p.locator('.date-box').innerText()) !== dateBefore);

// ---- Register closures ----
await p.getByText('Register closures', { exact: true }).first().click();
await p.waitForTimeout(300);
check('register closures renders table header', await p.locator('.rc-head').isVisible());
check('register closures fresh empty state', await p.getByText('No register closures for this period.', { exact: true }).isVisible());
check('register closures footer shows zero', await p.getByText('DISPLAYING 0 TO 0 OF 0.', { exact: true }).isVisible());
await p.getByText('Update', { exact: true }).click();
await p.waitForTimeout(150);
check('register closures Update keeps fresh', (await p.locator('.rc-row').count()) === 0);

// ---- Cash movement report ----
await p.getByText('Cash movement reports', { exact: true }).first().click();
await p.waitForTimeout(300);
// Cash movements persist, so the report is only empty on a brand-new account.
check('cash movement report renders', await p.locator('.cm-table').isVisible());
check('cash movement TOTAL super-header', await p.locator('.cm-total', { hasText: 'TOTAL' }).isVisible());
await p.locator('.rep-fg select').first().selectOption('Cash added');
await p.waitForTimeout(100);
check('cash movement Type select changes', (await p.locator('.rep-fg select').first().inputValue()) === 'Cash added');

// ---- Gift card report ----
await p.getByText('Gift card reports', { exact: true }).first().click();
await p.waitForTimeout(200);
check('gift card Apply filter disabled when empty', await p.locator('.gc-searchcard .btn-p').isDisabled());
check('gift card stats render', await p.getByText('Gift cards in circulation', { exact: true }).isVisible());
await p.locator('.gc-search input').fill('GC-1001');
await p.waitForTimeout(100);
check('gift card Apply filter enabled after typing', !(await p.locator('.gc-searchcard .btn-p').isDisabled()));
await p.waitForTimeout(1100);
check('gift card table resolves to empty', await p.getByText('No gift cards found for this period', { exact: true }).isVisible());

// ---- Inventory report ----
await p.getByText('Inventory reports', { exact: true }).first().click();
await p.waitForTimeout(300);
check('inventory report renders totals rows', (await p.locator('.ir-row').count()) >= 2);
check('inventory report HISTORICAL header', await p.locator('.ir-hist', { hasText: 'HISTORICAL' }).isVisible());
await p.locator('.sh-tab', { hasText: 'Replenishment' }).click();
await p.waitForTimeout(200);
check('inventory report tab switches', await p.locator('.sh-tab.active', { hasText: 'Replenishment' }).isVisible());
await p.locator('.sh-tab', { hasText: 'Summary' }).click();
await p.waitForTimeout(150);
check('inventory report returns to Summary table', (await p.locator('.ir-row').count()) >= 2);

// ---- Sales report ----
await p.getByText('Sales reports', { exact: true }).first().click();
await p.waitForTimeout(300);
check('sales report pivot renders', await p.locator('.sr-row.totals').isVisible());
check('sales report breakdown renders', await p.locator('.sr-breakdown').isVisible());
await p.locator('.drf-field').click();
await p.waitForTimeout(200);
check('sales date picker opens', await p.locator('.drf-pop').isVisible());
const rangeBefore = await p.locator('.drf-field').innerText();
await p.locator('.drf-sub.range input').first().fill('4');
await p.getByText('Apply', { exact: true }).click();
await p.waitForTimeout(200);
check('sales date picker Apply updates range', (await p.locator('.drf-field').innerText()) !== rangeBefore);

// ---- Payment report ----
await p.getByText('Payment reports', { exact: true }).first().click();
await p.waitForTimeout(300);
check('payment report pivot renders', (await p.locator('.pm-row, .rpt-empty').count()) >= 1);
check('payment report year/total headers', (await p.locator('.rpt-year').isVisible()) && (await p.locator('.rpt-total').first().isVisible()));

// ---- Adjustment report ----
await p.getByText('Adjustment reports', { exact: true }).first().click();
await p.waitForTimeout(300);
check('adjustment report Totals row', await p.locator('.adjr-row.totals').isVisible());
await p.locator('.adj-filter select').selectOption('Exclude');
await p.waitForTimeout(100);
check('adjustment Include/Exclude select works', (await p.locator('.adj-filter select').inputValue()) === 'Exclude');

// ---- Store credit report ----
await p.getByText('Store credit reports', { exact: true }).first().click();
await p.waitForTimeout(300);
check('store credit stats render', await p.getByText('Outstanding balance', { exact: true }).isVisible());
check('store credit empty table', await p.getByText('No store credit data available', { exact: true }).isVisible());

// ---- User reports ----
await p.getByText('User reports', { exact: true }).first().click();
await p.waitForTimeout(300);
check('user reports lists users from the shared store', (await p.locator('.ur-row').count()) >= 1);
check('user reports shiftly partner card', await p.getByText('Simplify your team management with shiftly', { exact: true }).isVisible());
await p.locator('.partner-dismiss').click();
await p.waitForTimeout(150);
check('user reports Dismiss removes partner card', !(await p.locator('.partner-card').count()));
await p.locator('.ur-filter input').fill('zzz-nomatch');
await p.waitForTimeout(150);
check('user reports search filters', (await p.locator('.ur-row').count()) === 0);
await p.locator('.ur-filter input').fill('');
await p.waitForTimeout(100);

// ---- Sales history ----
await p.goto(base + '/sell/sales-history', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
// Sales persist to Supabase, so drive the empty state with a filter instead of
// assuming a fresh account.
const shBefore = await p.locator('.sh-row2').count();
await p.getByPlaceholder('Receipt or note').fill('zzz-nomatch');
await p.waitForTimeout(250);
check('sales history search finds no match', await p.getByText('No sales found.', { exact: true }).isVisible());
await p.getByText('Clear filters', { exact: true }).click();
await p.waitForTimeout(250);
check('sales history Clear filters restores the list', (await p.locator('.sh-row2').count()) === shBefore);
await p.getByText('More filters', { exact: true }).click();
await p.waitForTimeout(150);
check('sales history More filters expands', await p.getByText('Payment type', { exact: true }).isVisible());
await p.getByText('Less filters', { exact: true }).click();
await p.waitForTimeout(120);
check('sales history Less filters collapses', !(await p.getByText('Payment type', { exact: true }).isVisible()));
await p.getByText('Clear filters', { exact: true }).click();
await p.waitForTimeout(120);
check('sales history Clear filters works', (await p.locator('.sh-row2').count()) === shBefore);

// ---- Fulfillments ----
await p.goto(base + '/inventory', { waitUntil: 'networkidle' });
await p.getByText('Fulfillments', { exact: true }).first().click();
await p.waitForTimeout(300);
check('fulfillments empty state', await p.getByText('No fulfillments found. Try a different search or update your filters.', { exact: true }).isVisible());
check('fulfillments table header', await p.getByText('Sale receipt', { exact: true }).isVisible());
await p.locator('.sh-tab', { hasText: 'Pack orders' }).click();
await p.waitForTimeout(150);
check('fulfillments tab switches', await p.locator('.sh-tab.active', { hasText: 'Pack orders' }).isVisible());

// ---- General setup ----
await p.goto(base + '/setup', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
check('general setup renders sections', await p.getByText('Barcode and SKU settings', { exact: true }).isVisible());
const gchk = p.locator('.set-chk-box').first();
const gchkOn = await gchk.evaluate((el) => el.classList.contains('on'));
await gchk.click();
await p.waitForTimeout(100);
check('general setup checkbox toggles', (await gchk.evaluate((el) => el.classList.contains('on'))) !== gchkOn);

// ---- Devices and label printing ----
await p.getByText('Devices and label printing', { exact: true }).first().click();
await p.waitForTimeout(300);
check('devices label-printing tab default', await p.getByText('Custom label templates unavailable.', { exact: true }).isVisible());
check('devices label type setting select', await p.getByText('Default label type setting', { exact: true }).isVisible());
await p.locator('.sh-tab', { hasText: 'Devices' }).click();
await p.waitForTimeout(200);
check('devices tab shows Nova Hub', await p.getByText('Nova Hub is not connected', { exact: true }).isVisible());
await p.locator('.sh-tab', { hasText: 'Label printing' }).click();
await p.waitForTimeout(150);
check('devices back to Label printing', await p.getByText('Custom label templates unavailable.', { exact: true }).isVisible());

// ---- Inventory settings ----
await p.locator('.ctxnav-item', { hasText: 'Inventory' }).click();
await p.waitForTimeout(300);
check('inventory settings PO section', await p.getByText('Purchase orders', { exact: true }).isVisible());
check('inventory settings replenish select', await p.getByText('Default replenish method', { exact: true }).isVisible());
const invChk = p.locator('.set-chk-box').first();
const invChkOn = await invChk.evaluate((el) => el.classList.contains('on'));
await invChk.click();
await p.waitForTimeout(100);
check('inventory settings checkbox toggles', (await invChk.evaluate((el) => el.classList.contains('on'))) !== invChkOn);

// ---- On-account settings ----
await p.locator('.ctxnav-item', { hasText: 'On-account' }).click();
await p.waitForTimeout(300);
check('on-account 3 radios render', (await p.locator('.oa-radios .radio-row').count()) === 3);
check('on-account one selected by default', (await p.locator('.oa-radios .radio.on').count()) === 1);
await p.getByText('Yes, but with a balance limit', { exact: true }).click();
await p.waitForTimeout(150);
check('on-account limit shows balance field', await p.getByText('Default balance limit ($)', { exact: true }).isVisible());
await p.getByText('No', { exact: true }).click();
await p.waitForTimeout(120);
check('on-account No hides balance field', !(await p.getByText('Default balance limit ($)', { exact: true }).isVisible()));

// ---- Apps (setup) ----
await p.locator('.ctxnav-item', { hasText: 'Apps' }).click();
await p.waitForTimeout(300);
check('apps grid renders 6 cards', (await p.locator('.app-card').count()) === 6);
const app0 = p.locator('.app-card').first().locator('.app-btn');
// The connected state persists, so assert the label flips rather than its start value.
const appLabelBefore = (await app0.innerText()).trim();
check('app connect button has a label', /connect/i.test(appLabelBefore));
await app0.click();
await p.waitForTimeout(120);
check('app connect toggles state', (await app0.innerText()).trim() !== appLabelBefore);

// ---- Register status (sell) ----
await p.goto(base + '/sell/status', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
check('status lists 6 services', (await p.locator('.st-row').count()) === 6);
await p.getByText('Run diagnostics', { exact: true }).click();
await p.waitForTimeout(120);
check('status run diagnostics shows checking', await p.getByText('Checking…', { exact: true }).isVisible());

// ---- Quotes (sell) ----
await p.goto(base + '/sell/quotes', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
// Quotes persist, so measure the delta rather than assuming an empty list.
const qtBefore = await p.locator('.qt-row').count();
await p.getByText('New quote', { exact: true }).click();
await p.waitForTimeout(150);
check('quotes New quote appends row', (await p.locator('.qt-row').count()) === qtBefore + 1);
await p.locator('.qt-filter input').fill('Walk');
await p.waitForTimeout(150);
check('quotes search matches added quote', (await p.locator('.qt-row').count()) >= 1);
await p.locator('.qt-filter input').fill('zzz-none');
await p.waitForTimeout(150);
check('quotes search no-match shows empty', await p.getByText('No quotes found.', { exact: true }).isVisible());

// ---- Gift cards ----
await p.goto(base + '/catalog', { waitUntil: 'networkidle' });
await p.getByText('Gift cards', { exact: true }).first().click();
await p.waitForTimeout(300);
check('gift cards hero renders', await p.getByText('Sell gift cards to boost revenue', { exact: true }).isVisible());
check('gift cards 3 feature columns', (await p.locator('.gc-feature').count()) === 3);

// ---- Cash management ----
await p.goto(base + '/sell/cash-management', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
const cashBefore = await p.locator('.csm-row').count();
await p.getByText('Add cash', { exact: true }).click();
await p.waitForTimeout(150);
check('cash management Add cash opens form', await p.locator('.csm-form').isVisible());
await p.locator('.csm-form input[type=number]').fill('50');
await p.getByText('Confirm', { exact: true }).click();
await p.waitForTimeout(150);
check('cash management Add cash appends row', (await p.locator('.csm-row').count()) === cashBefore + 1);

// ---- Close register ----
await p.goto(base + '/sell/open-close', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
check('close register denominations render', (await p.locator('.cr-count-row').count()) >= 11);
check('close register payments summary', await p.getByText('Payment types', { exact: true }).isVisible());
await p.locator('.cr-count-row input').first().fill('3');
await p.waitForTimeout(150);
check('close register cash total updates', !(await p.locator('.cr-count-total .r').innerText()).includes('$0.00'));
check('close register has Close button', await p.locator('.cr-close').isVisible());

// ---- Register settings ----
await p.goto(base + '/sell/settings', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
const layBefore = await p.locator('.rs-layout').count();
await p.getByText('Add layout', { exact: true }).click();
await p.waitForTimeout(150);
check('settings Add layout appends', (await p.locator('.rs-layout').count()) === layBefore + 1);
await p.locator('.rs-layout', { hasText: 'New Layout' }).first().getByText('Set as current layout').click();
await p.waitForTimeout(150);
check('settings Set as current layout works', (await p.locator('.rs-current').count()) === 1);
const tsw = p.locator('.rs-toggle-row .switch').first();
const tswBefore = await tsw.evaluate((el) => el.classList.contains('on'));
await tsw.click();
await p.waitForTimeout(150);
check('settings quick keys toggle works', (await tsw.evaluate((el) => el.classList.contains('on'))) !== tswBefore);

// ---- Sell register ----
// Products persist to Supabase, so the grid shows the empty prompt only on a
// brand-new account — assert it renders one state or the other.
await p.goto(base + '/sell', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
check('sell renders the quick keys grid', (await p.locator('.qk-tile, .qk-folder, .qk-empty').count()) >= 1);

// ---- Suppliers ----
await p.goto(base + '/catalog', { waitUntil: 'networkidle' });
await p.getByText('Suppliers', { exact: true }).first().click();
await p.waitForTimeout(300);
// Suppliers persist, so measure the delta rather than assuming an empty list.
const supBefore = await p.locator('.ctrow.sup3').count();
await p.getByText('Add supplier', { exact: true }).click();
await p.waitForTimeout(200);
check('suppliers "Add supplier" opens modal', await p.locator('.pm-head', { hasText: 'Add Supplier' }).isVisible());
await p.locator('.pm .set-input').first().fill('Northwind Goods');
await p.getByText('Save changes', { exact: true }).click();
await p.waitForTimeout(200);
check('suppliers add appends row', (await p.locator('.ctrow.sup3').count()) === supBefore + 1);
await p.locator('.ctrow.sup3 .ic-edit').first().click();
await p.waitForTimeout(200);
check('supplier edit modal opens', await p.locator('.pm-head', { hasText: 'Edit Supplier' }).isVisible());
await p.locator('.pm-close').click();

// ---- Cross-page wiring: Products -> Sell (shared product store) ----
await p.goto(base + '/catalog', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
await p.getByText('Add product', { exact: true }).click();
await p.waitForTimeout(200);
await p.getByPlaceholder('Product Name').fill('Zzappy Widget');
await p.getByText('Save changes', { exact: true }).click();
await p.waitForTimeout(200);
await p.locator('a[title="Sell"]').click(); // client-side nav keeps the store
await p.waitForTimeout(300);
await p.locator('.reg-search input').fill('Zzappy');
await p.waitForTimeout(200);
check('product added in Products appears in Sell', (await p.getByText('Zzappy Widget', { exact: true }).count()) >= 1);
await p.locator('.qk-tile').first().click();
await p.waitForTimeout(200);
check('sell add product to cart', !(await p.getByText('Add products to start a sale').isVisible()));
check('checkout tax follows Default sales tax setting (No Tax = $0.00)', (await p.locator('.dtrow', { hasText: 'Tax' }).first().innerText()).includes('$0.00'));
// complete the sale -> success confirmation + stock draw-down
await p.locator('button:has-text("Pay")').first().click();
await p.waitForTimeout(300);
await p.locator('.pm-primary').click();
await p.waitForTimeout(200);
await p.locator('.pm-complete').click();
await p.waitForTimeout(300);
check('payment shows "Payment successful"', await p.getByText('Payment successful', { exact: true }).isVisible());
await p.getByText('New sale', { exact: true }).click();
await p.waitForTimeout(200);
await p.locator('a[title="Catalog"]').click();
await p.waitForTimeout(300);
check('sale draws down product stock (10 -> 9)', (await p.locator('.arow.prod2 .r').first().innerText()).trim() === '9');

// ---- Login page ----
await p.goto(base + '/', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
check('root redirects to login', p.url().endsWith('/login'));
check('login title renders', (await p.locator('.login-card h1').innerText()).includes('Log in to Nova Retail'));
check('login password masked by default', (await p.locator('#lg-pass').getAttribute('type')) === 'password');
await p.locator('.login-eye').click();
await p.waitForTimeout(100);
check('login eye reveals password', (await p.locator('#lg-pass').getAttribute('type')) === 'text');
// wrong credentials are rejected
await p.locator('#lg-user').fill('jade.tatom@nova.local');
await p.locator('#lg-pass').fill('wrongpass');
await p.locator('.login-btn').click();
await p.waitForTimeout(150);
check('login rejects wrong password', (await p.locator('.login-error').isVisible()) && p.url().endsWith('/login'));
// correct credentials log in
await p.locator('#lg-pass').fill('jade1234');
await p.locator('.login-btn').click();
await p.waitForTimeout(300);
check('login with valid password enters register', p.url().endsWith('/sell'));

// ---- Icon rail logout ----
await p.goto(base + '/catalog', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
await p.locator('.rail-collapse').click();
await p.waitForTimeout(300);
check('icon rail logout returns to login', p.url().endsWith('/login'));

// ---- Profile drawer ----
await p.goto(base + '/catalog', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
await p.locator('.topbar-user').click();
await p.waitForTimeout(200);
check('profile drawer opens', await p.locator('.pd-panel').isVisible());
check('profile clocked out by default', (await p.locator('.pd-clock-status').innerText()).includes('clocked out'));
await p.getByText('Clock in', { exact: true }).click();
await p.waitForTimeout(150);
check('profile Clock in toggles state', (await p.locator('.pd-clock-status').innerText()).includes('clocked in'));
await p.getByText('Switch user', { exact: true }).click();
await p.waitForTimeout(150);
check('profile Switch user honors security gate (password prompt)', await p.locator('.pd-authprompt').isVisible());
await p.getByText('Cancel', { exact: true }).click();
await p.waitForTimeout(100);
await p.locator('.pd-close').click();
await p.waitForTimeout(150);
check('profile drawer closes', !(await p.locator('.pd-panel').count()));

// ---- Notifications drawer ----
await p.locator('.topbar-bell').click();
await p.waitForTimeout(200);
check('notifications drawer opens', await p.locator('.nd-panel').isVisible());
check('notifications empty state renders', (await p.locator('.nd-title').innerText()).includes('no new notifications'));
await p.locator('.nd-close').click();
await p.waitForTimeout(150);
check('notifications drawer closes', !(await p.locator('.nd-panel').count()));

// ---- Quick key layout editor ----
await p.goto(base + '/sell/settings', { waitUntil: 'networkidle' });
await p.waitForTimeout(300);
const qsw = p.locator('.rs-toggle-row .switch').first();
if (!(await qsw.evaluate((el) => el.classList.contains('on')))) await qsw.click();
await p.waitForTimeout(200);
// Match the row holding the "Current Layout" badge — hasText would also match
// the other rows' "Set as current layout" button.
await p.locator('.rs-layout', { has: p.locator('.rs-current') }).first().locator('.ic-edit').click();
await p.waitForTimeout(400);
check('settings pencil opens layout editor', /\/sell\/settings\/layout\//.test(p.url()));
check('layout editor renders the 40-slot grid', (await p.locator('.qkl-slot').count()) === 40);
await p.locator('#qkl-search').fill('Zzappy');
await p.waitForTimeout(300);
check('layout editor search finds a product', (await p.locator('.qkl-result').count()) >= 1);
await p.locator('.qkl-result').first().click();
await p.waitForTimeout(300);
check('layout editor places a quick key', (await p.locator('.qkl-key').count()) === 1);
await p.locator('.qkl-key').first().click();
await p.waitForTimeout(300);
check('edit quick key modal opens', await p.locator('.qkl-modal').isVisible());
await p.locator('#qkl-key-label').fill('Widget');
await p.locator('.qkl-swatch').first().click();
await p.locator('.qkl-modal-foot .btn-primary').click();
await p.waitForTimeout(300);
check(
  'edit quick key saves label and colour',
  (await p.locator('.qkl-key-label').first().innerText()) === 'Widget' &&
    (await p.locator('.qkl-key-stripe').count()) === 1,
);
await p.locator('.qkl-key').first().dragTo(p.locator('.qkl-slot').nth(6));
await p.waitForTimeout(300);
check('quick key drags to another slot', (await p.locator('.qkl-slot').nth(6).locator('.qkl-key').count()) === 1);
await p.locator('#qkl-name').fill('Front counter');
await p.waitForTimeout(200);
check('layout name edit updates the title', (await p.locator('.sell-title').innerText()) === 'Front counter');
await p.locator('.qkl-check input').check();
await p.waitForTimeout(150);
check('quick key behavior checkbox toggles', await p.locator('.qkl-check input').isChecked());
await p.getByText('Done', { exact: true }).click();
await p.waitForTimeout(400);
check('layout editor Done returns to settings', p.url().endsWith('/sell/settings'));
check('renamed layout appears in the list', (await p.locator('.rs-layout', { hasText: 'Front counter' }).count()) === 1);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(300);
check('built layout survives refresh', (await p.locator('.rs-layout', { hasText: 'Front counter' }).count()) === 1);
await p.goto(base + '/sell', { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
check('built layout drives the Sell register', (await p.locator('.qk-tile-name').first().innerText()) === 'Widget');
await p.locator('.qk-tile').first().click();
await p.waitForTimeout(300);
check('layout quick key adds to the cart', (await p.locator('.dline-name').first().innerText()) === 'Zzappy Widget');

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
