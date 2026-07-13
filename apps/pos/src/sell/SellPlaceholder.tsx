export function SellPlaceholder({ title }: { title: string }) {
  return (
    <main className="sell-page">
      <h1 className="sell-title">{title}</h1>
      <div className="sell-subbar">Manage {title.toLowerCase()} for this register.</div>
      <div className="sell-placeholder">
        <div className="sell-placeholder-icon">🧩</div>
        <div>{title} is being built to match Lightspeed X-Series.</div>
      </div>
    </main>
  );
}
