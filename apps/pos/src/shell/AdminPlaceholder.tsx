export function AdminPlaceholder({ title }: { title: string }) {
  return (
    <main className="admin-main">
      <div className="admin-page">
        <h1 className="page-title">{title}</h1>
        <div className="page-subbar">
          <span className="page-subbar-text">
            This back-office section is being built to match Lightspeed X-Series.
          </span>
        </div>
        <div className="placeholder-card">
          <div className="placeholder-icon">🧩</div>
          <div className="placeholder-title">{title} — coming next</div>
          <div className="placeholder-hint">
            The Sell (register) experience is live. Back-office screens (Products, Customers,
            Reporting, Setup…) are being built next, matching the real screens.
          </div>
        </div>
      </div>
    </main>
  );
}
