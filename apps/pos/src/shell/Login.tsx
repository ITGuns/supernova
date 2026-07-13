import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUsers } from '../store/userStore';

function Sneaker() {
  // Clean side-profile athletic sneaker, toe pointing right (~226 x 116 local units).
  return (
    <g>
      <path d="M12 92 C6 92 3 82 8 72 C13 45 30 33 58 31 C66 30 70 34 71 42 C73 54 82 59 98 63 L152 78 C186 86 208 90 213 99 C216 106 209 110 197 110 L30 110 C18 110 12 100 12 92 Z" fill="#ffffff" stroke="#cfd2dc" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M10 96 C8 106 18 110 30 110 L197 110 C209 110 216 106 213 99 C150 104 60 102 10 96 Z" fill="#eef1f6" stroke="#cfd2dc" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M31 45 C41 36 54 35 64 41 C58 49 44 51 34 59 Z" fill="#e7eaf1" stroke="#cbcfd9" strokeWidth="1.8" strokeLinejoin="round" />
      <g stroke="#c2c6d2" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M70 46 l26 12" />
        <path d="M78 41 l26 12" />
        <path d="M86 38 l24 12" />
      </g>
      <g fill="#b7bbc8">
        <circle cx="70" cy="46" r="1.7" /><circle cx="78" cy="41" r="1.7" /><circle cx="86" cy="38" r="1.7" />
        <circle cx="96" cy="58" r="1.7" /><circle cx="104" cy="53" r="1.7" /><circle cx="110" cy="50" r="1.7" />
      </g>
      <path d="M152 78 C178 84 200 90 210 98" fill="none" stroke="#d3d6df" strokeWidth="2" />
      <g fill="#dde1e9">
        <circle cx="168" cy="82" r="1.6" /><circle cx="182" cy="86" r="1.6" /><circle cx="196" cy="90" r="1.6" />
      </g>
      <path d="M14 84 C11 76 13 68 20 62" fill="none" stroke="#4b3df5" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function LoginHero() {
  return (
    <svg viewBox="0 0 820 820" className="login-hero" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Nova POS terminal and sneakers">
      {/* ---- POS terminal ---- */}
      <ellipse cx="336" cy="666" rx="196" ry="32" fill="#2a30cf" opacity="0.5" />
      <path d="M264 636h140a15 15 0 0 1 15 15v10a15 15 0 0 1-15 15H264a15 15 0 0 1-15-15v-10a15 15 0 0 1 15-15z" fill="#131318" />
      <path d="M316 566h36l8 72h-52z" fill="#23232c" />
      <g transform="rotate(-8 344 452)">
        <rect x="170" y="300" width="348" height="256" rx="22" fill="#0e0e13" />
        <rect x="186" y="316" width="316" height="224" rx="12" fill="#1a1a22" />
        <rect x="186" y="316" width="316" height="22" rx="12" fill="#050507" />
        <rect x="208" y="354" width="150" height="15" rx="4" fill="#26262f" />
        <g>
          <rect x="208" y="380" width="45" height="35" rx="6" fill="#a855f7" />
          <rect x="259" y="380" width="45" height="35" rx="6" fill="#e6a817" />
          <rect x="310" y="380" width="45" height="35" rx="6" fill="#2dd4bf" />
          <rect x="208" y="421" width="45" height="35" rx="6" fill="#2b2b38" />
          <rect x="259" y="421" width="45" height="35" rx="6" fill="#e0483f" />
          <rect x="310" y="421" width="45" height="35" rx="6" fill="#3fae6b" />
          <rect x="208" y="462" width="45" height="35" rx="6" fill="#2b2b38" />
          <rect x="259" y="462" width="45" height="35" rx="6" fill="#5b8fd6" />
          <rect x="310" y="462" width="45" height="35" rx="6" fill="#2b2b38" />
        </g>
        <rect x="368" y="354" width="116" height="156" rx="7" fill="#101017" />
        <rect x="380" y="366" width="92" height="12" rx="4" fill="#2a2a36" />
        <rect x="380" y="388" width="70" height="9" rx="3" fill="#20202a" />
        <rect x="380" y="490" width="92" height="18" rx="5" fill="#4b3df5" />
      </g>
      <g transform="translate(304 664)">
        <rect x="0" y="-8" width="12" height="12" rx="3" fill="#4b3df5" transform="rotate(45 6 -2)" />
        <text x="19" y="2" fill="#eef0f4" fontSize="13" fontWeight="700">nova</text>
      </g>

      {/* ---- Sneakers ---- */}
      <ellipse cx="600" cy="694" rx="188" ry="28" fill="#2a30cf" opacity="0.5" />
      <g transform="translate(524 578) scale(0.97)" opacity="0.92">
        <Sneaker />
      </g>
      <g transform="translate(476 606)">
        <Sneaker />
      </g>
    </svg>
  );
}

export function Login() {
  const nav = useNavigate();
  const authenticate = useUsers((s) => s.authenticate);
  const setCurrentUser = useUsers((s) => s.setCurrentUser);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const login = () => {
    const user = authenticate(username, password);
    if (!user) {
      setError('Incorrect username or password.');
      return;
    }
    setCurrentUser(user.id);
    nav('/sell');
  };

  return (
    <div className="login">
      <header className="login-top">
        <div className="login-brand">
          <span className="topbar-logo">◆</span>
          <span>nova</span>
        </div>
        <span className="login-help">Help</span>
      </header>
      <div className="login-body">
        <div className="login-left">
          <div className="login-card">
            <h1>Log in to Nova Retail</h1>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                login();
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
          <LoginHero />
        </div>
      </div>
    </div>
  );
}
