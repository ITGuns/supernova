import { useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUsers } from '../store/userStore';
import { NovaLogo } from './NovaLogo';

// ── Outer-space hero ─────────────────────────────────────────────────────────
// A nova — a star flaring in deep space — built from plain shapes and
// gradients only (no SVG filters), so the constant animation stays cheap on a
// tablet register. Every position is seeded, so the sky is identical on each
// render and nothing jumps when React re-renders the form.

const W = 1000;
const H = 1000;

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  tw?: { dur: number; delay: number };
}

const makeStars = (seed: number, count: number, rMin: number, rMax: number, oMax: number, twinkleEvery: number): Star[] => {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => ({
    x: Math.round(rand() * W),
    y: Math.round(rand() * H),
    r: +(rMin + rand() * (rMax - rMin)).toFixed(2),
    o: +(0.35 + rand() * (oMax - 0.35)).toFixed(2),
    tw: i % twinkleEvery === 0 ? { dur: +(2 + rand() * 4).toFixed(1), delay: +(rand() * 6).toFixed(1) } : undefined,
  }));
};

// Three depths of starfield. Nearer layers are bigger, brighter and drift
// faster, which reads as parallax — the camera slowly gliding through space.
const LAYERS = [
  { key: 'far', stars: makeStars(11, 90, 0.5, 1.1, 0.6, 5), dur: 260 },
  { key: 'mid', stars: makeStars(23, 50, 0.9, 1.7, 0.85, 4), dur: 170 },
  { key: 'near', stars: makeStars(37, 22, 1.5, 2.6, 1, 3), dur: 105 },
];

interface Ember {
  dx: number;
  dy: number;
  r: number;
  dur: number;
  delay: number;
  hue: string;
}

// Material thrown off the nova: each ember flies out on its own bearing,
// shrinking and fading, then respawns at the core.
const EMBERS: Ember[] = (() => {
  const rand = seeded(53);
  return Array.from({ length: 26 }, () => {
    const a = rand() * Math.PI * 2;
    const d = 180 + rand() * 260;
    return {
      dx: Math.round(Math.cos(a) * d),
      dy: Math.round(Math.sin(a) * d),
      r: +(1.2 + rand() * 2.2).toFixed(1),
      dur: +(4.5 + rand() * 4.5).toFixed(1),
      delay: +(rand() * 9).toFixed(1),
      hue: rand() > 0.5 ? '#fff1c2' : '#c9b8ff',
    };
  });
})();

function StarLayer({ stars, dur, cls }: { stars: Star[]; dur: number; cls: string }) {
  // Drawn twice, one viewport apart, and slid one viewport per loop so the
  // drift never shows a seam.
  return (
    <g className={`nv-stars ${cls}`} style={{ animationDuration: `${dur}s` }}>
      {[0, W].map((off) => (
        <g key={off} transform={`translate(${off} 0)`}>
          {stars.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#fff"
              className={s.tw ? 'nv-tw' : undefined}
              style={
                s.tw
                  ? ({ '--o': s.o, animationDuration: `${s.tw.dur}s`, animationDelay: `${s.tw.delay}s` } as CSSProperties)
                  : { opacity: s.o }
              }
            />
          ))}
        </g>
      ))}
    </g>
  );
}

/** Tapered diffraction spike, centred on the origin, pointing along x. */
const Spike = ({ len, half, rotate }: { len: number; half: number; rotate: number }) => (
  <path d={`M${-len} 0 L0 ${-half} L${len} 0 L0 ${half} Z`} fill="url(#nv-spike)" transform={`rotate(${rotate})`} />
);

function LoginHero() {
  return (
    <svg className="login-hero" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="nv-space" cx="66%" cy="42%" r="75%">
          <stop offset="0" stopColor="#1b1758" />
          <stop offset="0.45" stopColor="#0b0d2e" />
          <stop offset="1" stopColor="#04050f" />
        </radialGradient>
        <radialGradient id="nv-neb-a">
          <stop offset="0" stopColor="#6d4cff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#6d4cff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nv-neb-b">
          <stop offset="0" stopColor="#e13ec9" stopOpacity="0.32" />
          <stop offset="1" stopColor="#e13ec9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nv-neb-c">
          <stop offset="0" stopColor="#2dd4bf" stopOpacity="0.26" />
          <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nv-halo">
          <stop offset="0" stopColor="#fff7dc" stopOpacity="0.95" />
          <stop offset="0.18" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#8b7bff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#4b3df5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nv-core">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#fff3c4" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="nv-spike" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="nv-planet" cx="35%" cy="25%" r="80%">
          <stop offset="0" stopColor="#1c1f4a" />
          <stop offset="0.6" stopColor="#0c0e2a" />
          <stop offset="1" stopColor="#05060f" />
        </radialGradient>
        <linearGradient id="nv-shoot" gradientUnits="userSpaceOnUse" x1="0" x2="160" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill="url(#nv-space)" />

      {/* Nebulae: slow, breathing colour clouds behind everything. */}
      <g className="nv-nebula">
        <ellipse className="nv-neb nv-neb-a" cx="640" cy="380" rx="420" ry="300" fill="url(#nv-neb-a)" />
        <ellipse className="nv-neb nv-neb-b" cx="300" cy="700" rx="360" ry="220" fill="url(#nv-neb-b)" />
        <ellipse className="nv-neb nv-neb-c" cx="880" cy="180" rx="300" ry="200" fill="url(#nv-neb-c)" />
      </g>

      {LAYERS.map((l) => (
        <StarLayer key={l.key} stars={l.stars} dur={l.dur} cls={`nv-stars-${l.key}`} />
      ))}

      {/* Shooting stars: a streak every so often, from two different corners. */}
      <g className="nv-shoot nv-shoot-1">
        <line x1="0" y1="0" x2="160" y2="0" stroke="url(#nv-shoot)" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="nv-shoot nv-shoot-2">
        <line x1="0" y1="0" x2="120" y2="0" stroke="url(#nv-shoot)" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* The nova. */}
      <g className="nv-nova" transform="translate(640 400)">
        <g className="nv-waves">
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              className="nv-wave"
              r="60"
              fill="none"
              stroke="#c7bbff"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              style={{ animationDelay: `${i * 2.7}s` }}
            />
          ))}
        </g>
        <circle className="nv-halo" r="250" fill="url(#nv-halo)" />
        <g className="nv-spikes nv-spikes-soft">
          <Spike len={230} half={1.4} rotate={22.5} />
          <Spike len={230} half={1.4} rotate={67.5} />
          <Spike len={230} half={1.4} rotate={112.5} />
          <Spike len={230} half={1.4} rotate={157.5} />
        </g>
        <g className="nv-spikes nv-spikes-main">
          <Spike len={360} half={2.2} rotate={0} />
          <Spike len={360} half={2.2} rotate={90} />
          <Spike len={240} half={1.6} rotate={45} />
          <Spike len={240} half={1.6} rotate={135} />
        </g>
        <circle className="nv-core" r="48" fill="url(#nv-core)" />
        <circle r="13" fill="#fff" />
        <g className="nv-embers">
          {EMBERS.map((e, i) => (
            <circle
              key={i}
              className="nv-ember"
              r={e.r}
              fill={e.hue}
              style={
                {
                  '--dx': `${e.dx}px`,
                  '--dy': `${e.dy}px`,
                  animationDuration: `${e.dur}s`,
                  animationDelay: `${e.delay}s`,
                } as CSSProperties
              }
            />
          ))}
        </g>
      </g>

      {/* Planet horizon, bottom right, lit by the nova. */}
      <g className="nv-planet">
        <circle cx="1060" cy="1180" r="486" fill="#5b4dff" opacity="0.08" />
        <circle cx="1060" cy="1180" r="472" fill="#6d5cff" opacity="0.16" />
        <circle cx="1060" cy="1180" r="460" fill="url(#nv-planet)" />
        <circle cx="1060" cy="1180" r="460" fill="none" stroke="#a293ff" strokeWidth="1.5" opacity="0.7" />
      </g>
    </svg>
  );
}

export function Login() {
  const nav = useNavigate();
  // RequireUser records where an unauthenticated visitor was headed.
  const from = (useLocation().state as { from?: string } | null)?.from;
  const authenticate = useUsers((s) => s.authenticate);
  const setCurrentUser = useUsers((s) => s.setCurrentUser);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    const user = await authenticate(username, password);
    if (!user) {
      setError('Incorrect username or password.');
      return;
    }
    setCurrentUser(user.id);
    nav(from && from !== '/login' ? from : '/sell', { replace: true });
  };

  return (
    <div className="login">
      <header className="login-top">
        <div className="login-brand">
          <span className="topbar-logo"><NovaLogo size={26} /></span>
          <span>nova</span>
        </div>
        <span className="login-help">Help</span>
      </header>
      <div className="login-body">
        <LoginHero />
        <div className="login-left">
          <div className="login-card">
            <h1>Log in to Nova Retail</h1>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void login();
              }}
            >
              <div className="login-field">
                <label htmlFor="lg-user">Username</label>
                <input id="lg-user" value={username} onChange={(e) => { setUsername(e.target.value); setError(''); }} placeholder="Enter your email" autoComplete="username" />
              </div>
              <div className="login-field">
                <label htmlFor="lg-pass">Password</label>
                <div className="login-pass">
                  <input id="lg-pass" type={show ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoComplete="current-password" />
                  <button type="button" className="login-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                    {show ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              {error && <div className="login-error">{error}</div>}
              <div className="login-actions">
                <span className="rlink">Forgot your password?</span>
                <button type="submit" className="login-btn">Log in</button>
              </div>
            </form>
          </div>
        </div>
        <div className="login-right">
          <div className="login-tagline">
            <div className="login-tagline-k">Nova Retail</div>
            <h2>Sell anywhere.<br />Sync everywhere.</h2>
            <p>The register keeps selling when the connection drops, and catches the cloud up the moment it’s back.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
