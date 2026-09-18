import '../styles/reporting.css';

/** Wholesale: B2B ordering. Lightspeed connects this to NuORDER; Nova explains the option. */
export function WholesalePage() {
  return (
    <main className="admin-main">
      <div className="admin-page">
        <h1 className="page-title">Wholesale</h1>
        <div className="page-subbar">Sell to other businesses with wholesale ordering.</div>
        <div className="om-cards">
          <div className="om-card">
            <div className="om-ic">🏬</div>
            <div className="om-h">Take wholesale orders</div>
            <div className="om-t">Let retailers and resellers browse your catalog at trade prices and place orders you fulfil from the same inventory.</div>
            <ul className="om-list">
              <li>Wholesale price book per customer group (Catalog → Price books)</li>
              <li>Orders arrive as on-account sales with invoices under Customers</li>
              <li>Fulfil from Inventory → Fulfillments like any other order</li>
            </ul>
            <a className="btn-p" href="/catalog" style={{ textDecoration: 'none' }}>Set up a wholesale price book</a>
          </div>
          <div className="om-card">
            <div className="om-ic">🔗</div>
            <div className="om-h">Connect a wholesale marketplace</div>
            <div className="om-t">Lightspeed pairs this section with the NuORDER marketplace. Nova doesn’t include a marketplace connection; wholesale customers order through your online store or by invoice.</div>
          </div>
        </div>
      </div>
    </main>
  );
}
