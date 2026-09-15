import type { ReactNode } from 'react';

// Building blocks for the full-page back-office editors (product, supplier):
// a titled section with a hint column on the left and fields on the right.
// Styles live in styles/product-editor.css (the `pe-*` classes).

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="pe-section">
      <div className="pe-section-l">
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
      <div className="pe-section-r">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`pe-field ${wide ? 'wide' : ''}`}>
      <span className="pe-label">
        {label}
        {hint && <span className="pe-hint"> {hint}</span>}
      </span>
      {children}
    </label>
  );
}
