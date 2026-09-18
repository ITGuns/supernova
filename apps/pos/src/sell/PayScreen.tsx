import { useEffect, useState } from 'react';
import { MoneyInput } from '../admin/NumInput';
import { computeCheckout, useCheckout } from '../lib/checkout';
import { fmt } from '../lib/format';
import { verifyPassword } from '../lib/password';
import { runRules } from '../lib/rules';
import { CASH, LOYALTY, STORE_CREDIT, giftTender, isCash, isGiftCard, methodOf } from '../lib/tenders';
import { useCart, type SaleLine, type SaleStatus, type Tender, type TenderMethod } from '../store/cartStore';
import { useCustomers } from '../store/customerStore';
import { useGiftCards } from '../store/giftCardStore';
import { useProducts } from '../store/productStore';
import { useRegister } from '../store/registerStore';
import { useSetup } from '../store/setupStore';
import { useUsers } from '../store/userStore';

const uid = (): string => crypto.randomUUID();

/**
 * The Pay screen. It takes the place of the product panel (like Lightspeed):
 * an editable Amount to pay, a tile per payment type, and a small panel for
 * cash tendered, gift card numbers, reference numbers or manager approval.
 * Payments accumulate on the sale panel; when the balance reaches zero the
 * sale completes and the Sale complete screen takes over this area.
 */
export function PayScreen({ onBack }: { onBack: () => void }) {
  const lines = useCart((s) => s.lines);
  const taxRemoved = useCart((s) => s.taxRemoved);
  const openSaleNumber = useCart((s) => s.openSaleNumber);
  const sales = useCart((s) => s.sales);
  const customerName = useCart((s) => s.customerName);
  const orderNote = useCart((s) => s.orderNote);
  const setOrderNote = useCart((s) => s.setOrderNote);
  const completeSale = useCart((s) => s.completeSale);
  const payOpenSale = useCart((s) => s.payOpenSale);
  const tenders = useCart((s) => s.pendingTenders);
  const addPending = useCart((s) => s.addPendingTender);
  const paymentTypes = useSetup((s) => s.paymentTypes);
  const training = useRegister((s) => s.trainingMode);
  const users = useUsers((s) => s.users);
  const currentUserId = useUsers((s) => s.currentUserId);
  const findCard = useGiftCards((s) => s.find);
  const redeemCard = useGiftCards((s) => s.redeem);
  const storeCreditEnabled = useSetup((s) => s.storeCreditEnabled);
  const loyaltyEnabled = useSetup((s) => s.loyaltyEnabled);
  const onAccountEnabled = useSetup((s) => s.onAccountEnabled);
  const onAccountLimit = useSetup((s) => s.onAccountLimit);
  const products = useProducts((s) => s.products);
  const customers = useCustomers((s) => s.customers);
  const updateCustomer = useCustomers((s) => s.updateCustomer);

  const totals = useCheckout();
  const openSale = openSaleNumber ? sales.find((s) => s.orderNumber === openSaleNumber) : undefined;
  const paidSoFar = openSale?.paidMinor ?? 0;
  const totalMinor = Math.max(0, totals.totalMinor - paidSoFar);
  const customer = customers.find((c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === customerName.trim().toLowerCase());

  const tendered = tenders.reduce((s, t) => s + t.amountMinor, 0);
  const balance = Math.max(0, totalMinor - tendered);
  const change = Math.max(0, tendered - totalMinor);

  // The amount the next payment takes; it follows the balance until the cashier edits it.
  const [amount, setAmount] = useState(balance);
  const [amountEdited, setAmountEdited] = useState(false);
  useEffect(() => {
    if (!amountEdited) setAmount(balance);
  }, [balance, amountEdited]);
  const amountFor = () => Math.max(0, Math.min(amount || balance, balance));

  const [panel, setPanel] = useState<null | { kind: 'cash' } | { kind: 'gift' } | { kind: 'ref'; method: TenderMethod; name: string; amount: number } | { kind: 'approval'; rules: string[]; status: SaleStatus }>(null);
  const [tenderedText, setTenderedText] = useState(0);
  const [giftNumber, setGiftNumber] = useState('');
  const [msg, setMsg] = useState('');
  const [refText, setRefText] = useState('');
  const [approvalPw, setApprovalPw] = useState('');
  const [emailReceipt, setEmailReceipt] = useState(!!customer?.email);
  const [finishing, setFinishing] = useState(false);

  const creditUsed = tenders.filter((t) => t.method === STORE_CREDIT).reduce((a, t) => a + t.amountMinor, 0);
  const loyaltyUsed = tenders.filter((t) => t.method === LOYALTY).reduce((a, t) => a + t.amountMinor, 0);
  const creditLeft = Math.max(0, (customer?.storeCreditMinor ?? 0) - creditUsed);
  const loyaltyLeft = Math.max(0, (customer?.loyaltyMinor ?? 0) - loyaltyUsed);
  const limitMinor = customer?.onAccountLimitMinor ?? (onAccountLimit ? Math.round(parseFloat(onAccountLimit) * 100) : null);
  const canOnAccount = !!customer && onAccountEnabled && balance > 0 && (limitMinor === null || customer.accountMinor + balance <= limitMinor);

  const toSaleLines = (only?: (l: (typeof lines)[number]) => boolean): SaleLine[] =>
    lines.filter((l) => (only ? only(l) : true)).map((l) => ({
      name: l.name,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      variantId: l.variantId,
      // Lock in today's supplier cost so gross profit stays right even if the cost changes later.
      costMinor: products.find((p) => p.id === l.variantId)?.supplierPriceMinor ?? 0,
      ...(l.discountPct ? { discountPct: l.discountPct } : {}),
      ...(l.note ? { note: l.note } : {}),
      ...(l.soldBy ? { soldBy: l.soldBy } : {}),
      ...(l.serial ? { serial: l.serial } : {}),
      ...(l.giftCard ? { giftCard: l.giftCard } : {}),
    }));

  /** Deduct store credit / loyalty balances the customer just spent. */
  const settleBalances = (all: Tender[]) => {
    if (!customer) return;
    const credit = all.filter((t) => t.method === STORE_CREDIT).reduce((a, t) => a + t.amountMinor, 0);
    const loyalty = all.filter((t) => t.method === LOYALTY).reduce((a, t) => a + t.amountMinor, 0);
    const patch: { storeCreditMinor?: number; loyaltyMinor?: number } = {};
    if (credit > 0) patch.storeCreditMinor = Math.max(0, customer.storeCreditMinor - credit);
    if (loyalty > 0) patch.loyaltyMinor = Math.max(0, customer.loyaltyMinor - loyalty);
    if (Object.keys(patch).length) updateCustomer(customer.id, patch);
  };

  const finish = (status: SaleStatus, all: Tender[]) => {
    const paid = all.reduce((s, t) => s + t.amountMinor, 0);
    const chg = Math.max(0, paid - totalMinor);
    const owing = Math.max(0, totalMinor - paid);
    settleBalances(all);
    if (!training) for (const t of all) if (isGiftCard(t.method)) redeemCard(t.method.slice(5), t.amountMinor);
    if (openSale) {
      const added = lines.filter((l) => !l.locked);
      const addedTotal = added.length ? computeCheckout(added, { orderDiscountBps: 0, orderDiscountMinor: 0, taxRemoved, customerName, promoCode: '' }).totalMinor : 0;
      payOpenSale(openSale.orderNumber, all, chg, toSaleLines((l) => !l.locked), addedTotal, status === 'Completed' ? openSale.status ?? 'Layaway' : status);
      if (customer && status === 'On account') updateCustomer(customer.id, { accountMinor: customer.accountMinor + owing });
    } else {
      completeSale({
        totalMinor: totals.totalMinor,
        taxMinor: totals.taxMinor,
        discountMinor: totals.discountMinor,
        tenders: all,
        changeMinor: chg,
        lines: toSaleLines(),
        status,
        ...(status === 'Completed' ? {} : { paidMinor: paid - chg }),
        emailReceipt: emailReceipt && !!customer?.email,
      });
      if (customer && status === 'On account') updateCustomer(customer.id, { accountMinor: customer.accountMinor + owing });
    }
  };

  // Business rules run before the sale closes: a manager may need to approve, notes get added, messages shown after.
  const tryFinish = (status: SaleStatus, all: Tender[]) => {
    if (finishing) return;
    if (status !== 'Completed') return finish(status, all);
    const user = users.find((u) => u.id === currentUserId)?.name ?? '';
    const outcome = runRules('Sale completed', { totalMinor: totals.totalMinor, items: totals.itemCount, discountMinor: totals.discountMinor, customerName, user });
    if (outcome.notes.length) setOrderNote([orderNote, ...outcome.notes].filter(Boolean).join(' · '));
    useCart.setState({ lastSaleNotices: outcome.messages });
    if (outcome.approvals.length) {
      setPanel({ kind: 'approval', rules: outcome.approvals.map((r) => r.name), status });
      setApprovalPw('');
      setMsg('');
      return;
    }
    setFinishing(true);
    finish(status, all);
  };

  /** Record a payment; once the balance is covered the sale completes. */
  const take = (method: TenderMethod, amountMinor: number, reference?: string) => {
    if (amountMinor <= 0) return;
    const t: Tender = { id: uid(), method, amountMinor, ...(reference ? { reference } : {}) };
    const all = [...tenders, t];
    addPending(t);
    setAmountEdited(false);
    setPanel(null);
    setMsg('');
    if (all.reduce((s, x) => s + x.amountMinor, 0) >= totalMinor) tryFinish('Completed', all);
  };

  const approve = async () => {
    if (panel?.kind !== 'approval') return;
    const managers = users.filter((u) => u.enabled && /admin|manager|owner/i.test(u.role));
    for (const m of managers) {
      if (await verifyPassword(approvalPw, m.password)) {
        const status = panel.status;
        setPanel(null);
        setFinishing(true);
        finish(status, tenders);
        return;
      }
    }
    setMsg('That isn’t a manager or admin password.');
  };

  const applyGiftCard = () => {
    const card = findCard(giftNumber);
    if (!card) return setMsg('No gift card with that number.');
    if (card.status !== 'Active' || card.balanceMinor <= 0) return setMsg('That gift card has no balance left.');
    if (card.expiresAt && card.expiresAt < Date.now()) return setMsg('That gift card has expired.');
    const used = tenders.filter((t) => t.method === giftTender(card.number)).reduce((a, t) => a + t.amountMinor, 0);
    const available = card.balanceMinor - used;
    if (available <= 0) return setMsg('That gift card is already used up on this sale.');
    take(giftTender(card.number), Math.min(amountFor(), available));
    setGiftNumber('');
  };

  // Cash: the notes a customer is likely to hand over for this amount.
  const suggestions = (() => {
    const a = amountFor();
    const notes = [500, 1000, 2000, 5000, 10000];
    const out = [a];
    for (const n of notes) {
      const up = Math.ceil(a / n) * n;
      if (up > a && !out.includes(up)) out.push(up);
    }
    return out.slice(0, 4);
  })();

  const openType = (t: { method: TenderMethod; name: string; askReference?: boolean }) => {
    const a = amountFor();
    if (a <= 0) return;
    if (isCash(t.method)) {
      setTenderedText(a);
      setPanel({ kind: 'cash' });
    } else if (t.askReference) {
      setRefText('');
      setPanel({ kind: 'ref', method: t.method, name: t.name, amount: a });
    } else take(t.method, a);
  };

  const cashType = paymentTypes.find((t) => isCash(methodOf(t)));
  const otherTypes = paymentTypes.filter((t) => !isCash(methodOf(t)));

  return (
    <div className="pay">
      <button className="pay-back" onClick={onBack}>‹ Back to sale</button>
      <div className="pay-amount">
        <label className="pay-amount-label" htmlFor="pay-amount">Amount to pay</label>
        <MoneyInput
          id="pay-amount"
          className="pay-amount-in"
          minor={amount}
          onChange={(v) => {
            setAmount(v);
            setAmountEdited(v !== balance);
          }}
          disabled={!!panel && panel.kind !== 'cash'}
        />
        <div className="pay-amount-sub">
          {amountFor() < balance ? <>Part payment · balance after this payment {fmt(balance - amountFor())}</> : <>Balance {fmt(balance)}</>}
          {paidSoFar > 0 && <> · {fmt(paidSoFar)} already paid on this sale</>}
        </div>
      </div>

      {panel?.kind === 'approval' ? (
        <div className="pay-panel">
          <div className="pay-panel-h">Manager approval needed</div>
          <p className="pay-panel-t">{panel.rules.join(' · ')}. Ask a manager or admin to enter their password to complete the sale.</p>
          <input className="pay-in" type="password" value={approvalPw} autoFocus onChange={(e) => { setApprovalPw(e.target.value); setMsg(''); }} onKeyDown={(e) => e.key === 'Enter' && approve()} placeholder="Manager password" />
          {msg && <div className="pe-error" role="alert">{msg}</div>}
          <div className="pay-panel-actions">
            <button className="btn-s" onClick={() => { setPanel(null); useCart.getState().removePendingTender(tenders[tenders.length - 1]?.id ?? ''); }}>Cancel last payment</button>
            <button className="pay-btn" onClick={approve}>Approve and complete</button>
          </div>
        </div>
      ) : panel?.kind === 'cash' ? (
        <div className="pay-panel">
          <div className="pay-panel-h">Cash tendered</div>
          <div className="pay-suggest">
            {suggestions.map((v) => (
              <button key={v} className={`pay-tile small ${tenderedText === v ? 'active' : ''}`} onClick={() => setTenderedText(v)}>{fmt(v)}</button>
            ))}
          </div>
          <label className="pay-panel-field">
            <span>Amount tendered</span>
            <MoneyInput className="pay-in" minor={tenderedText} onChange={setTenderedText} autoFocus />
          </label>
          <div className="pay-panel-t">
            {tenderedText >= amountFor() ? <>Change to give: <b>{fmt(tenderedText - amountFor())}</b></> : <>Short by {fmt(amountFor() - tenderedText)} — the rest can be paid another way.</>}
          </div>
          <div className="pay-panel-actions">
            <button className="btn-s" onClick={() => setPanel(null)}>Cancel</button>
            <button className="pay-btn" disabled={tenderedText <= 0} onClick={() => take(CASH, Math.min(tenderedText, amountFor()) + Math.max(0, tenderedText - amountFor()))}>Take {fmt(tenderedText)}</button>
          </div>
        </div>
      ) : panel?.kind === 'gift' ? (
        <div className="pay-panel">
          <div className="pay-panel-h">Gift card</div>
          <label className="pay-panel-field">
            <span>Card number</span>
            <input className="pay-in" value={giftNumber} autoFocus onChange={(e) => { setGiftNumber(e.target.value); setMsg(''); }} onKeyDown={(e) => e.key === 'Enter' && applyGiftCard()} placeholder="Scan or type the card number" />
          </label>
          {giftNumber.trim() && findCard(giftNumber) && <div className="pay-panel-t">Balance on card: <b>{fmt(findCard(giftNumber)!.balanceMinor)}</b></div>}
          {msg && <div className="pe-error" role="alert">{msg}</div>}
          <div className="pay-panel-actions">
            <button className="btn-s" onClick={() => { setPanel(null); setMsg(''); }}>Cancel</button>
            <button className="pay-btn" onClick={applyGiftCard}>Apply {fmt(amountFor())}</button>
          </div>
        </div>
      ) : panel?.kind === 'ref' ? (
        <div className="pay-panel">
          <div className="pay-panel-h">{panel.name} reference</div>
          <label className="pay-panel-field">
            <span>Reference number</span>
            <input className="pay-in" value={refText} autoFocus onChange={(e) => setRefText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && take(panel.method, panel.amount, refText.trim())} placeholder="e.g. check number" />
          </label>
          <div className="pay-panel-actions">
            <button className="btn-s" onClick={() => setPanel(null)}>Cancel</button>
            <button className="pay-btn" onClick={() => take(panel.method, panel.amount, refText.trim())}>Take {fmt(panel.amount)}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="pay-tiles">
            {cashType && (
              <button className="pay-tile" disabled={balance === 0} onClick={() => openType({ method: CASH, name: cashType.name })}>
                <span className="pay-tile-ic">💵</span>{cashType.name}
              </button>
            )}
            {otherTypes.map((t) => (
              <button key={t.id} className="pay-tile" disabled={balance === 0} onClick={() => openType({ method: methodOf(t), name: t.name, askReference: t.askReference })}>
                <span className="pay-tile-ic">{methodOf(t) === 'CARD' ? '💳' : '▣'}</span>{t.name}
              </button>
            ))}
            <button className="pay-tile" disabled={balance === 0} onClick={() => { setPanel({ kind: 'gift' }); setMsg(''); }}>
              <span className="pay-tile-ic">🎁</span>Gift card
            </button>
            {storeCreditEnabled && (
              <button className="pay-tile" disabled={!customer || balance === 0 || creditLeft === 0} title={!customer ? 'Add a customer to use their store credit' : ''} onClick={() => take(STORE_CREDIT, Math.min(amountFor(), creditLeft))}>
                <span className="pay-tile-ic">◎</span>Store credit
                <span className="pay-tile-sub">{customer ? `${fmt(creditLeft)} available` : 'No customer'}</span>
              </button>
            )}
            {loyaltyEnabled && (
              <button className="pay-tile" disabled={!customer || customer.loyaltyEnabled === false || balance === 0 || loyaltyLeft === 0} onClick={() => take(LOYALTY, Math.min(amountFor(), loyaltyLeft))}>
                <span className="pay-tile-ic">★</span>Loyalty
                <span className="pay-tile-sub">{customer ? `${fmt(loyaltyLeft)} available` : 'No customer'}</span>
              </button>
            )}
            <button className="pay-tile" disabled={!customer || balance === 0} title={!customer ? 'Add a customer to put a sale on layaway' : 'Set the items aside and take the balance later'} onClick={() => finish('Layaway', tenders)}>
              <span className="pay-tile-ic">◷</span>Layaway
              <span className="pay-tile-sub">{customer ? `${fmt(balance)} to pay later` : 'No customer'}</span>
            </button>
            <button className="pay-tile" disabled={!canOnAccount} title={!customer ? 'Add a customer to sell on account' : !onAccountEnabled ? 'On-account sales are turned off in Setup' : !canOnAccount ? 'Over the customer’s on-account limit' : 'Invoice the balance to the customer’s account'} onClick={() => finish('On account', tenders)}>
              <span className="pay-tile-ic">▤</span>On account
              <span className="pay-tile-sub">{customer ? (canOnAccount ? `${fmt(balance)} to account` : 'Not available') : 'No customer'}</span>
            </button>
          </div>
          {customer?.email && (
            <label className="reg-check pay-email">
              <input type="checkbox" checked={emailReceipt} onChange={(e) => setEmailReceipt(e.target.checked)} />
              <span>Email receipt to {customer.email}</span>
            </label>
          )}
          {change > 0 && <div className="pay-panel-t">Change to give: <b>{fmt(change)}</b></div>}
        </>
      )}
    </div>
  );
}
