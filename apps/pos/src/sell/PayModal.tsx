import { useState } from 'react';
import { computeCheckout, useCheckout } from '../lib/checkout';
import { fmt } from '../lib/format';
import { verifyPassword } from '../lib/password';
import { runRules } from '../lib/rules';
import { CASH, LOYALTY, STORE_CREDIT, giftTender, isCash, isGiftCard, methodOf, tenderShort } from '../lib/tenders';
import { useCart, type SaleLine, type SaleStatus, type Tender, type TenderMethod } from '../store/cartStore';
import { useCustomers } from '../store/customerStore';
import { useGiftCards } from '../store/giftCardStore';
import { useProducts } from '../store/productStore';
import { useRegister } from '../store/registerStore';
import { useSetup } from '../store/setupStore';
import { useUsers } from '../store/userStore';

const uid = (): string => crypto.randomUUID();

/**
 * Take payment. One button per payment type configured in Setup → Payment
 * types (cash keeps its keypad, quick amounts and change), plus the
 * customer's Store credit and Loyalty balances, Layaway and On account. A
 * sale can be split across several; an amount typed on the keypad goes to
 * whichever button is pressed next, otherwise a button takes the balance.
 */
export function PayModal({ onClose }: { onClose: () => void }) {
  const lines = useCart((s) => s.lines);
  const discountBps = useCart((s) => s.orderDiscountBps);
  const discountMinor = useCart((s) => s.orderDiscountMinor);
  const taxRemoved = useCart((s) => s.taxRemoved);
  const openSaleNumber = useCart((s) => s.openSaleNumber);
  const sales = useCart((s) => s.sales);
  const customerName = useCart((s) => s.customerName);
  const orderNote = useCart((s) => s.orderNote);
  const setOrderNote = useCart((s) => s.setOrderNote);
  const completeSale = useCart((s) => s.completeSale);
  const payOpenSale = useCart((s) => s.payOpenSale);
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
  void discountBps;
  void discountMinor;
  const openSale = openSaleNumber ? sales.find((s) => s.orderNumber === openSaleNumber) : undefined;
  const paidSoFar = openSale?.paidMinor ?? 0;
  const totalMinor = Math.max(0, totals.totalMinor - paidSoFar);
  const customer = customers.find((c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === customerName.trim().toLowerCase());

  const [tenders, setTenders] = useState<Tender[]>([]);
  const [entryMinor, setEntryMinor] = useState(0);
  const [askRef, setAskRef] = useState<{ method: TenderMethod; amount: number; name: string } | null>(null);
  const [refText, setRefText] = useState('');
  const [emailReceipt, setEmailReceipt] = useState(!!customer?.email);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftNumber, setGiftNumber] = useState('');
  const [giftMsg, setGiftMsg] = useState('');
  const [approval, setApproval] = useState<{ rules: string[]; status: SaleStatus } | null>(null);
  const [approvalPw, setApprovalPw] = useState('');
  const [approvalErr, setApprovalErr] = useState('');

  const tendered = tenders.reduce((s, t) => s + t.amountMinor, 0);
  const remaining = Math.max(0, totalMinor - tendered);
  const change = Math.max(0, tendered - totalMinor);
  const canComplete = tendered >= totalMinor;

  const addTender = (method: TenderMethod, amount: number, reference?: string) => {
    if (amount <= 0) return;
    setTenders((prev) => [...prev, { id: uid(), method, amountMinor: amount, ...(reference ? { reference } : {}) }]);
    setEntryMinor(0);
  };
  const removeTender = (id: string) => setTenders((prev) => prev.filter((t) => t.id !== id));
  const pressDigit = (d: number) => setEntryMinor((v) => Math.min(v * 10 + d, 99_999_99));
  const backspace = () => setEntryMinor((v) => Math.floor(v / 10));

  const otherTypes = paymentTypes.filter((t) => !isCash(methodOf(t)));
  const amountFor = () => (entryMinor > 0 ? Math.min(entryMinor, remaining) : remaining);

  const creditUsed = tenders.filter((t) => t.method === STORE_CREDIT).reduce((a, t) => a + t.amountMinor, 0);
  const loyaltyUsed = tenders.filter((t) => t.method === LOYALTY).reduce((a, t) => a + t.amountMinor, 0);
  const creditLeft = Math.max(0, (customer?.storeCreditMinor ?? 0) - creditUsed);
  const loyaltyLeft = Math.max(0, (customer?.loyaltyMinor ?? 0) - loyaltyUsed);
  const limitMinor = customer?.onAccountLimitMinor ?? (onAccountLimit ? Math.round(parseFloat(onAccountLimit) * 100) : null);
  const canOnAccount = !!customer && onAccountEnabled && remaining > 0 && (limitMinor === null || (customer.accountMinor + remaining) <= limitMinor);

  const takeType = (t: { method: TenderMethod; name: string; askReference?: boolean }) => {
    const amount = amountFor();
    if (t.askReference) {
      setAskRef({ method: t.method, amount, name: t.name });
      setRefText('');
    } else addTender(t.method, amount);
  };

  /** Deduct store credit / loyalty balances the customer just spent. */
  const settleBalances = () => {
    if (!customer) return;
    const patch: { storeCreditMinor?: number; loyaltyMinor?: number } = {};
    if (creditUsed > 0) patch.storeCreditMinor = Math.max(0, customer.storeCreditMinor - creditUsed);
    if (loyaltyUsed > 0) patch.loyaltyMinor = Math.max(0, customer.loyaltyMinor - loyaltyUsed);
    if (Object.keys(patch).length) updateCustomer(customer.id, patch);
  };

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

  const applyGiftCard = () => {
    const card = findCard(giftNumber);
    if (!card) return setGiftMsg('No gift card with that number.');
    if (card.status !== 'Active' || card.balanceMinor <= 0) return setGiftMsg('That gift card has no balance left.');
    if (card.expiresAt && card.expiresAt < Date.now()) return setGiftMsg('That gift card has expired.');
    const alreadyUsed = tenders.filter((t) => t.method === giftTender(card.number)).reduce((a, t) => a + t.amountMinor, 0);
    const available = card.balanceMinor - alreadyUsed;
    if (available <= 0) return setGiftMsg('That gift card is already used up on this sale.');
    const amount = Math.min(amountFor(), available);
    addTender(giftTender(card.number), amount);
    setGiftOpen(false);
    setGiftNumber('');
    setGiftMsg('');
  };

  // Business rules run before the sale closes: a manager may need to approve, notes get added, messages shown after.
  const startFinish = (status: SaleStatus) => {
    if (status !== 'Completed') return finish(status);
    const user = users.find((u) => u.id === currentUserId)?.name ?? '';
    const outcome = runRules('Sale completed', { totalMinor: totals.totalMinor, items: totals.itemCount, discountMinor: totals.discountMinor, customerName, user });
    if (outcome.notes.length) setOrderNote([orderNote, ...outcome.notes].filter(Boolean).join(' · '));
    useCart.setState({ lastSaleNotices: outcome.messages });
    if (outcome.approvals.length) {
      setApproval({ rules: outcome.approvals.map((r) => r.name), status });
      setApprovalPw('');
      setApprovalErr('');
      return;
    }
    finish(status);
  };

  const approve = async () => {
    const managers = users.filter((u) => u.enabled && /admin|manager|owner/i.test(u.role));
    for (const m of managers) {
      if (await verifyPassword(approvalPw, m.password)) {
        setApproval(null);
        finish(approval?.status ?? 'Completed');
        return;
      }
    }
    setApprovalErr('That isn’t a manager or admin password.');
  };

  const finish = (status: SaleStatus) => {
    settleBalances();
    if (!training) for (const t of tenders) if (isGiftCard(t.method)) redeemCard(t.method.slice(5), t.amountMinor);
    if (openSale) {
      const added = lines.filter((l) => !l.locked);
      const addedTotal = added.length ? computeCheckout(added, { orderDiscountBps: 0, orderDiscountMinor: 0, taxRemoved, customerName, promoCode: '' }).totalMinor : 0;
      payOpenSale(openSale.orderNumber, tenders, change, toSaleLines((l) => !l.locked), addedTotal, status === 'Completed' ? openSale.status ?? 'Layaway' : status);
      // On account: the customer's balance grows by what's still owed.
      if (customer && status === 'On account') updateCustomer(customer.id, { accountMinor: customer.accountMinor + Math.max(0, remaining) });
    } else {
      completeSale({
        totalMinor: totals.totalMinor,
        taxMinor: totals.taxMinor,
        discountMinor: totals.discountMinor,
        tenders,
        changeMinor: change,
        lines: toSaleLines(),
        status,
        ...(status === 'Completed' ? {} : { paidMinor: tendered - change }),
        emailReceipt: emailReceipt && !!customer?.email,
      });
      if (customer && status === 'On account') updateCustomer(customer.id, { accountMinor: customer.accountMinor + remaining });
    }
    onClose();
  };

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <h2>Payment{openSale ? ` · ${openSale.orderNumber}` : ''}</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="pm-body">
          <div className="pm-receipt">
            <div className="pm-receipt-title">Sale summary</div>
            <div className="pm-lines">
              {lines.map((l) => (
                <div key={l.lineId} className="pm-line">
                  <span className="pm-qty">{l.quantity}×</span>
                  <span className="pm-name">{l.name}</span>
                  <span className="pm-amt">{fmt(Math.round(l.unitPriceMinor * l.quantity * (1 - (l.discountPct ?? 0) / 100)))}</span>
                </div>
              ))}
            </div>
            <div className="pm-totals">
              <div className="dtrow">
                <span>Subtotal</span>
                <span>{fmt(totals.subtotalMinor)}</span>
              </div>
              {totals.discountMinor > 0 && (
                <div className="dtrow disc">
                  <span>Discount{totals.promotions.length ? ` · ${totals.promotions.map((p) => p.name).join(', ')}` : ''}</span>
                  <span>−{fmt(totals.discountMinor)}</span>
                </div>
              )}
              {taxRemoved || totals.taxRows.length <= 1 ? (
                <div className="dtrow">
                  <span>Tax{totals.taxInclusive && !taxRemoved ? ' (included)' : ''}</span>
                  <span>{taxRemoved ? 'Removed' : fmt(totals.taxMinor)}</span>
                </div>
              ) : (
                totals.taxRows.map((r) => (
                  <div key={r.id} className="dtrow">
                    <span>{r.name} {(r.rateBps / 100).toFixed(2).replace(/\.?0+$/, '')}%</span>
                    <span>{fmt(r.amountMinor)}</span>
                  </div>
                ))
              )}
              {openSale && (
                <div className="dtrow">
                  <span>Paid so far</span>
                  <span>−{fmt(paidSoFar)}</span>
                </div>
              )}
              <div className="dtrow pm-total">
                <span>Total</span>
                <span>{fmt(totalMinor)}</span>
              </div>
            </div>
            {customer?.email && (
              <label className="reg-check pm-email">
                <input type="checkbox" checked={emailReceipt} onChange={(e) => setEmailReceipt(e.target.checked)} />
                <span>Email receipt to {customer.email}</span>
              </label>
            )}
          </div>

          <div className="pm-card">
            <div className="pm-due">
              <div className="pm-due-label">{canComplete ? 'Change due' : 'Amount due'}</div>
              <div className={`pm-due-amt ${canComplete ? 'is-change' : ''}`}>
                {fmt(canComplete ? change : remaining)}
              </div>
            </div>

            {approval ? (
              <div className="pm-ref">
                <div className="pm-cash-head">Manager approval needed</div>
                <p className="reg-open-text">{approval.rules.join(' · ')}. Ask a manager or admin to enter their password.</p>
                <input className="pm-ref-in" type="password" value={approvalPw} autoFocus onChange={(e) => { setApprovalPw(e.target.value); setApprovalErr(''); }} onKeyDown={(e) => e.key === 'Enter' && approve()} placeholder="Manager password" />
                {approvalErr && <div className="pe-error" role="alert">{approvalErr}</div>}
                <div className="pm-quick">
                  <button onClick={() => setApproval(null)}>Cancel</button>
                  <button className="pm-primary" onClick={approve}>Approve and complete</button>
                </div>
              </div>
            ) : giftOpen ? (
              <div className="pm-ref">
                <div className="pm-cash-head">Gift card</div>
                <input className="pm-ref-in" value={giftNumber} autoFocus onChange={(e) => { setGiftNumber(e.target.value); setGiftMsg(''); }} onKeyDown={(e) => e.key === 'Enter' && applyGiftCard()} placeholder="Scan or type the card number" />
                {giftMsg && <div className="pe-error" role="alert">{giftMsg}</div>}
                <div className="pm-quick">
                  <button onClick={() => { setGiftOpen(false); setGiftMsg(''); }}>Cancel</button>
                  <button className="pm-primary" onClick={applyGiftCard}>Apply gift card</button>
                </div>
              </div>
            ) : askRef ? (
              <div className="pm-ref">
                <div className="pm-cash-head">{askRef.name} reference number</div>
                <input className="pm-ref-in" value={refText} autoFocus onChange={(e) => setRefText(e.target.value)} placeholder="e.g. check number" />
                <div className="pm-quick">
                  <button onClick={() => { addTender(askRef.method, askRef.amount); setAskRef(null); }}>Skip</button>
                  <button className="pm-primary" onClick={() => { addTender(askRef.method, askRef.amount, refText.trim()); setAskRef(null); }}>Add reference</button>
                </div>
              </div>
            ) : (
              <div className="pm-types">
                {otherTypes.map((t) => (
                  <button
                    key={t.id}
                    className="pm-primary"
                    disabled={remaining === 0}
                    onClick={() => takeType({ method: methodOf(t), name: t.name, askReference: t.askReference })}
                    title={entryMinor > 0 ? `Take ${fmt(amountFor())} by ${t.name}` : `Take the full ${fmt(remaining)} by ${t.name}`}
                  >
                    {methodOf(t) === 'CARD' ? '💳 ' : ''}
                    {t.name} <span className="pm-primary-amt">{fmt(amountFor())}</span>
                  </button>
                ))}
                <button className="pm-primary pm-alt" disabled={remaining === 0} onClick={() => { setGiftOpen(true); setGiftMsg(''); }}>
                  Gift card <span className="pm-primary-amt">{fmt(amountFor())}</span>
                </button>
                {storeCreditEnabled && customer && (
                  <button className="pm-primary pm-alt" disabled={remaining === 0 || creditLeft === 0} onClick={() => addTender(STORE_CREDIT, Math.min(amountFor(), creditLeft))}>
                    Store credit <span className="pm-primary-amt">{fmt(Math.min(remaining, creditLeft))} of {fmt(creditLeft)}</span>
                  </button>
                )}
                {loyaltyEnabled && customer && customer.loyaltyEnabled !== false && (
                  <button className="pm-primary pm-alt" disabled={remaining === 0 || loyaltyLeft === 0} onClick={() => addTender(LOYALTY, Math.min(amountFor(), loyaltyLeft))}>
                    Loyalty <span className="pm-primary-amt">{fmt(Math.min(remaining, loyaltyLeft))} of {fmt(loyaltyLeft)}</span>
                  </button>
                )}
                {remaining > 0 && customer && (
                  <div className="pm-later">
                    <button className="pm-primary pm-alt" onClick={() => finish('Layaway')} title="Set the items aside and pay the balance later">
                      Layaway <span className="pm-primary-amt">{fmt(remaining)} to pay later</span>
                    </button>
                    <button className="pm-primary pm-alt" disabled={!canOnAccount} onClick={() => finish('On account')} title={canOnAccount ? 'Invoice the balance to the customer’s account' : 'The customer needs an on-account limit that covers this balance'}>
                      On account <span className="pm-primary-amt">{fmt(remaining)}</span>
                    </button>
                  </div>
                )}
                {otherTypes.length === 0 && (
                  <div className="pm-types-hint">Add card, Venmo or other payment types in Setup → Payment types.</div>
                )}
              </div>
            )}

            <div className="pm-cash">
              <div className="pm-cash-head">Cash</div>
              <div className="pm-entry">{fmt(entryMinor)}</div>
              <div className="pm-quick">
                <button disabled={remaining === 0} onClick={() => addTender(CASH, remaining)}>
                  Exact
                </button>
                <button onClick={() => addTender(CASH, 2000)}>$20</button>
                <button onClick={() => addTender(CASH, 5000)}>$50</button>
              </div>
              <div className="pm-keypad">
                {keys.map((k) => (
                  <button key={k} onClick={() => pressDigit(k)}>
                    {k}
                  </button>
                ))}
                <button onClick={() => setEntryMinor((v) => Math.min(v * 100, 99_999_99))}>00</button>
                <button onClick={() => pressDigit(0)}>0</button>
                <button onClick={backspace}>⌫</button>
              </div>
              <button className="pm-addcash" disabled={entryMinor === 0} onClick={() => addTender(CASH, entryMinor)}>
                Add cash
              </button>
            </div>

            {tenders.length > 0 && (
              <div className="pm-tenders">
                {tenders.map((t) => (
                  <div key={t.id} className="pm-tender">
                    <span>{isCash(t.method) ? '💵 ' : t.method === 'CARD' ? '💳 ' : ''}{tenderShort(t.method, paymentTypes)}{t.reference ? ` · ${t.reference}` : ''}</span>
                    <span className="pm-tender-amt">{fmt(t.amountMinor)}</span>
                    <button onClick={() => removeTender(t.id)} aria-label="Remove">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button className="pm-complete" disabled={!canComplete || !!approval} onClick={() => startFinish('Completed')}>
          {canComplete ? (
            <>
              Complete sale{change > 0 && <span className="pm-change"> · Change {fmt(change)}</span>}
            </>
          ) : (
            <>Remaining {fmt(remaining)}</>
          )}
        </button>
      </div>
    </div>
  );
}
