// Original inline-SVG illustrations for the dashboard cards (no external assets).

export function PaymentsGraphic() {
  return (
    <svg viewBox="0 0 128 96" className="ill ill-pay" role="img" aria-label="Payments">
      <rect x="6" y="20" width="70" height="46" rx="8" fill="#e11d48" transform="rotate(-9 41 43)" />
      <rect x="12" y="30" width="26" height="5" rx="2.5" fill="#fff" opacity="0.85" transform="rotate(-9 25 32)" />
      <rect x="12" y="41" width="40" height="4" rx="2" fill="#fff" opacity="0.55" transform="rotate(-9 32 43)" />
      <rect x="60" y="14" width="46" height="78" rx="10" fill="#0f0f12" />
      <rect x="65" y="20" width="36" height="58" rx="4" fill="#20222b" />
      <rect x="72" y="40" width="22" height="4" rx="2" fill="#4b3df5" />
      <rect x="72" y="49" width="16" height="4" rx="2" fill="#6b6f7d" />
      <circle cx="83" cy="84" r="3" fill="#3a3d47" />
      <path d="M104 34a12 12 0 0 1 0 20" stroke="#4b3df5" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M110 28a20 20 0 0 1 0 32" stroke="#4b3df5" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function ClipboardGraphic() {
  return (
    <svg viewBox="0 0 80 80" className="ill ill-clip" role="img" aria-label="To-do">
      <rect x="20" y="14" width="40" height="52" rx="5" fill="none" stroke="#b7b0e0" strokeWidth="2.5" />
      <rect x="31" y="9" width="18" height="10" rx="3" fill="var(--panel)" stroke="#b7b0e0" strokeWidth="2.5" />
      <path
        d="M27 31l3.5 3.5 6-7M27 45l3.5 3.5 6-7"
        stroke="#4b3df5"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M42 31h11M42 45h11M27 58h20" stroke="#cfc9ec" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M52 54l11-11 6 6-11 11-7.5 1.5z"
        fill="#eaa23b"
        stroke="#b7b0e0"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InventoryGraphic() {
  return (
    <svg viewBox="0 0 128 92" className="ill ill-inv" role="img" aria-label="Inventory">
      <rect x="8" y="14" width="48" height="60" rx="5" fill="var(--panel)" stroke="#d8d8de" strokeWidth="2" />
      <path
        d="M17 33l4 4 7-8M17 48l4 4 7-8M17 63l4 4 7-8"
        stroke="#16a34a"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M34 33h13M34 48h13M34 63h13" stroke="#e2e2e8" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M62 42l25-11 25 11-25 11z" fill="#e3b884" />
      <path d="M62 42v25l25 11V53z" fill="#c9a06a" />
      <path d="M112 42v25l-25 11V53z" fill="#d6aa74" />
      <path d="M74 36.5l25 11" stroke="#a97e4e" strokeWidth="1.6" />
      <path d="M87 53v25" stroke="#b98f5e" strokeWidth="1.6" />
    </svg>
  );
}

export function LicensesGraphic() {
  return (
    <svg viewBox="0 0 96 60" className="ill ill-lic" role="img" aria-label="Licenses">
      <path d="M8 33h7v22H8z" fill="#dfe3ea" />
      <path
        d="M15 35c3-1 5-3 6-7 .6-2 .6-5 3-5 1.7 0 2.5 1.6 1.9 4.1l-.8 3.4h7.7a2.7 2.7 0 0 1 2.6 3.3l-1.6 9.2A3.5 3.5 0 0 1 37 49H15z"
        fill="#f0b45a"
        stroke="#d89838"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <g transform="translate(52,8)">
        <path d="M0 3a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v41l-8.5-6.5L0 44z" fill="#3fae6b" />
        <rect x="4" y="9" width="9" height="2.6" rx="1.3" fill="#fff" opacity="0.85" />
      </g>
      <g transform="translate(72,8)">
        <path d="M0 3a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v41l-8.5-6.5L0 44z" fill="#5b8fd6" />
        <rect x="4" y="9" width="9" height="2.6" rx="1.3" fill="#fff" opacity="0.85" />
      </g>
    </svg>
  );
}

export function PartnerLogo() {
  return (
    <div className="partner-logo">
      <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
        <path d="M15 2l11 6v13l-11 6-11-6V8z" fill="#7c3aed" />
        <path d="M11 20V11l4 2.3 4-2.3v9" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
      </svg>
      <span className="partner-word">shiftly</span>
    </div>
  );
}

export function CatalogTShirt() {
  return (
    <svg viewBox="0 0 120 100" className="ill ill-onb" role="img" aria-label="Import catalog">
      <path
        d="M42 22 L30 32 L20 44 L31 55 L39 49 V82 H81 V49 L89 55 L100 44 L90 32 L78 22 C74 29 68 33 60 33 C52 33 46 29 42 22 Z"
        fill="none"
        stroke="#a9a0d8"
        strokeWidth="2"
        strokeDasharray="5 4"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="56" r="11" fill="none" stroke="#7c6ff0" strokeWidth="2" />
      <path d="M60 50v12M54 56h12" stroke="#7c6ff0" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 16l1.6 4.4 4.4 1.6-4.4 1.6L24 28l-1.6-4.4L18 22l4.4-1.6z" fill="#c8c3e6" />
      <path d="M98 58l1.1 3 3 1.1-3 1.1L98 66l-1.1-3-3-1.1 3-1.1z" fill="#c8c3e6" />
    </svg>
  );
}

export function Rocket() {
  return (
    <svg viewBox="0 0 120 100" className="ill ill-onb" role="img" aria-label="Start selling">
      <path
        d="M70 18c15 7 23 22 21 42l-11 6H60l-11-6c-2-20 6-35 21-42z"
        fill="#e4dff8"
        stroke="#7c6ff0"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="70" cy="45" r="7" fill="#fff" stroke="#7c6ff0" strokeWidth="2" />
      <path d="M59 60l-13 11 5-19z" fill="#a9a0d8" />
      <path d="M81 60l13 11-5-19z" fill="#a9a0d8" />
      <path d="M64 72c4 12 8 12 12 0 0 7-2 12-6 16-4-4-6-9-6-16z" fill="#f2a23b" />
      <path d="M34 28l1.5 4.2 4.2 1.5-4.2 1.5L34 39l-1.5-4.2-4.2-1.5 4.2-1.5z" fill="#c8c3e6" />
      <circle cx="42" cy="60" r="2" fill="#c8c3e6" />
      <circle cx="98" cy="26" r="2" fill="#c8c3e6" />
    </svg>
  );
}

export function CatBox() {
  return (
    <svg viewBox="0 0 120 112" className="ill ill-catbox" role="img" aria-label="No results">
      <path d="M32 58l-13-17 23-3z" fill="var(--panel)" stroke="#b7b2bd" strokeWidth="2" strokeLinejoin="round" />
      <path d="M88 58l13-17-23-3z" fill="var(--panel)" stroke="#b7b2bd" strokeWidth="2" strokeLinejoin="round" />
      <path d="M50 58l3-13 7 6 7-6 3 13" fill="var(--panel)" stroke="#8b8690" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="56" cy="52" r="1.7" fill="#6b6670" />
      <circle cx="64" cy="52" r="1.7" fill="#6b6670" />
      <path d="M30 58h60v44a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4z" fill="var(--panel)" stroke="#b7b2bd" strokeWidth="2" strokeLinejoin="round" />
      <path d="M54 76v11M51 80l3-4 3 4" stroke="#b7b2bd" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M66 76v11M63 80l3-4 3 4" stroke="#b7b2bd" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BagClock() {
  return (
    <svg viewBox="0 0 132 116" className="ill ill-bag" role="img" aria-label="No sales">
      <path d="M40 40h52l6 62a6 6 0 0 1-6 6.6H40a6 6 0 0 1-6-6.6z" fill="var(--panel)" stroke="#b7b2bd" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M52 44V32a14 14 0 0 1 28 0v12" fill="none" stroke="#b7b2bd" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="86" cy="86" r="20" fill="var(--panel)" stroke="#8b8690" strokeWidth="2.4" />
      <path d="M86 74v13l9 5" fill="none" stroke="#8b8690" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BagPhone() {
  return (
    <svg viewBox="0 0 140 116" className="ill ill-bag" role="img" aria-label="No fulfillments">
      <path d="M34 40h50l6 62a6 6 0 0 1-6 6.6H34a6 6 0 0 1-6-6.6z" fill="var(--panel)" stroke="#b7b2bd" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M46 44V32a13 13 0 0 1 26 0v12" fill="none" stroke="#b7b2bd" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="86" y="52" width="34" height="56" rx="6" fill="var(--panel)" stroke="#8b8690" strokeWidth="2.4" />
      <g stroke="#8b8690" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M94 66l3 3 5-5" />
        <path d="M94 80l3 3 5-5" />
        <path d="M94 94l3 3 5-5" />
        <path d="M106 67h8M106 82h8M106 96h8" />
      </g>
    </svg>
  );
}

export function GiftCardArt() {
  return (
    <svg viewBox="0 0 200 150" className="ill ill-gc" role="img" aria-label="Sell and track cards">
      <rect x="44" y="40" width="112" height="72" rx="8" fill="#4b3df5" transform="rotate(-8 100 76)" opacity="0.85" />
      <rect x="40" y="42" width="116" height="74" rx="8" fill="var(--panel)" stroke="#c9c5d0" strokeWidth="2" />
      <path d="M96 42c-8-10-22-2-14 8 3 4 10 6 14 6 4 0 11-2 14-6 8-10-6-18-14-8z" fill="none" stroke="#111" strokeWidth="2" />
      <path d="M96 56v50M62 74h68" stroke="#111" strokeWidth="2" opacity="0.15" />
      <text x="140" y="102" textAnchor="end" fontSize="17" fontWeight="700" fill="#111">100</text>
    </svg>
  );
}

export function RevenueChart() {
  return (
    <svg viewBox="0 0 200 150" className="ill ill-gc" role="img" aria-label="Boost your revenue">
      <rect x="30" y="30" width="140" height="92" rx="10" fill="var(--panel)" stroke="#e5e2e9" strokeWidth="2" />
      <g fill="#e0483f">
        <rect x="58" y="92" width="12" height="18" rx="2" />
        <rect x="80" y="80" width="12" height="30" rx="2" />
        <rect x="102" y="66" width="12" height="44" rx="2" />
        <rect x="124" y="50" width="12" height="60" rx="2" />
      </g>
      <path d="M54 96l24-16 22-12 30-22" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M122 46h16v16" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="58" cy="46" r="13" fill="#4b3df5" />
      <text x="58" y="51" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">$</text>
    </svg>
  );
}

export function CustomizeCard() {
  return (
    <svg viewBox="0 0 200 150" className="ill ill-gc" role="img" aria-label="Customize your cards">
      <rect x="34" y="34" width="112" height="80" rx="8" fill="var(--panel)" stroke="#c9c5d0" strokeWidth="2" />
      <text x="46" y="58" fontSize="15" fontWeight="700" fill="#111">100</text>
      <g transform="translate(78 62)">
        <rect x="0" y="8" width="34" height="24" rx="2" fill="#e0483f" />
        <rect x="-3" y="4" width="40" height="9" rx="2" fill="#c23b32" />
        <path d="M17 4c-5-8-16-2-10 5M17 4c5-8 16-2 10 5" fill="none" stroke="#c23b32" strokeWidth="2.4" />
        <path d="M17 4v28" stroke="#fff" strokeWidth="2.4" />
      </g>
      <g transform="translate(150 40)" fill="none" stroke="#111" strokeWidth="1.8">
        <rect x="-4" y="-6" width="28" height="80" rx="6" fill="var(--panel)" stroke="#e5e2e9" />
        <path d="M4 2l8 8-3 1 2 4-2 1-2-4-3 3z" fill="#111" stroke="none" />
        <circle cx="10" cy="26" r="4" />
        <path d="M13 29l3 3" />
        <rect x="6" y="42" width="9" height="9" />
        <path d="M6 62h9M10.5 62v8" strokeWidth="2.2" />
      </g>
      <g transform="translate(40 96)">
        <rect x="0" y="0" width="11" height="11" rx="2" fill="#4b3df5" />
        <rect x="15" y="0" width="11" height="11" rx="2" fill="#e0483f" />
        <rect x="30" y="0" width="11" height="11" rx="2" fill="#111" />
        <rect x="45" y="0" width="11" height="11" rx="2" fill="#e5e2e9" />
      </g>
    </svg>
  );
}

export function MessengerBird() {
  return (
    <svg viewBox="0 0 250 200" className="ill ill-bird" role="img" aria-label="No notifications">
      <path
        d="M150 62c-6-16 6-34 26-34 16 0 28 12 28 28 0 6-2 11-5 16 22 4 41 18 47 40 3 12-4 22-18 24-34 6-80 6-108-10-22-12-20-46 12-58 8-3 16-5 18-6z"
        fill="var(--panel)"
        stroke="var(--text)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle cx="176" cy="50" r="2.8" fill="var(--text)" />
      <path d="M150 62c-8-2-16 0-20 6" fill="none" stroke="var(--text)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M150 98c22-4 44 4 58 22" fill="none" stroke="var(--text)" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M236 112c9 3 15 9 18 17-8 0-16-2-23-8M231 120c6 8 8 16 6 25-6-4-11-11-13-19"
        fill="var(--panel)"
        stroke="var(--text)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <g stroke="#e0271f" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M150 150l-9 22M150 150l4 22M150 172l-13 4M150 172l11 4" />
        <path d="M168 150l-2 22M168 150l11 20M166 172l-13 2M179 170l11 6" />
      </g>
      <g>
        <path d="M108 44h22v16a6 6 0 0 1-6 6h-10a6 6 0 0 1-6-6z" fill="#e0271f" stroke="var(--text)" strokeWidth="2" />
        <path d="M130 48a7 7 0 0 1 0 12" fill="none" stroke="var(--text)" strokeWidth="2" />
        <path d="M112 40c3-4 14-4 15 0" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function ScannerGraphic() {
  return (
    <svg viewBox="0 0 132 100" className="ill ill-scan" role="img" aria-label="Scanner app">
      <path d="M16 28l28-9 36 32-28 28-36-32z" fill="#dfe0f5" stroke="#8b86c8" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="29" cy="32" r="3.6" fill="var(--panel)" stroke="#8b86c8" strokeWidth="2" />
      <g stroke="#4b3df5" strokeWidth="1.5">
        <path d="M36 46l16 14M41 42l16 14M46 39l15 13" />
      </g>
      <rect x="72" y="34" width="44" height="62" rx="7" fill="#0f0f12" />
      <rect x="77" y="41" width="34" height="46" rx="3" fill="#fff" />
      <g stroke="#111" strokeWidth="1.7">
        <path d="M83 52v24M87 52v24M91 52v24M96 52v24M100 52v24M105 52v24" />
      </g>
    </svg>
  );
}
