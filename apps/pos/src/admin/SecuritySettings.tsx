import { useState } from 'react';
import { useSecurity } from '../store/securityStore';
import { RadioRow } from './controls';

const LOGIN_OPTIONS = [
  { value: 'default', label: 'Default setting' },
  { value: 'has', label: 'Has access to log in' },
  { value: 'switch', label: 'Only has access to log in through user switching' },
];

const AUTH_OPTIONS = [
  { value: 'default', label: 'Default setting' },
  { value: 'userpass', label: 'Username and password' },
  { value: 'mfa', label: 'Username and password with multi-factor authentication' },
];

function RoleDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '240px' }}>
      <div
        className="role-sel"
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>{options.find((o) => o.value === value)?.label || 'Default setting'}</span>
        <span>▾</span>
      </div>
      {open && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10,
            }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              zIndex: 20,
              overflow: 'hidden',
            }}
          >
            {options.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: opt.value === value ? 'var(--primary)' : 'var(--text)',
                  background: opt.value === value ? 'rgba(75, 61, 245, 0.08)' : 'transparent',
                  fontWeight: opt.value === value ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (opt.value !== value) {
                    e.currentTarget.style.background = 'var(--panel-2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (opt.value !== value) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SecuritySettings() {
  const sec = useSecurity();
  const { loginAccess, switching, authMethod, inactivity, managerLogin, managerAuth, cashierLogin, cashierAuth } = sec;
  const setLoginAccess = (v: string) => sec.set({ loginAccess: v });
  const setSwitching = (v: string) => sec.set({ switching: v });
  const setAuthMethod = (v: string) => sec.set({ authMethod: v });
  const setManagerLogin = (v: string) => sec.set({ managerLogin: v });
  const setManagerAuth = (v: string) => sec.set({ managerAuth: v });
  const setCashierLogin = (v: string) => sec.set({ cashierLogin: v });
  const setCashierAuth = (v: string) => sec.set({ cashierAuth: v });

  return (
    <>
      <h1 className="page-title">Security</h1>
      <div className="page-subbar">Manage access and authentication settings for your store</div>

      <div className="setwrap">
        <div className="setrow">
          <div>
            <div className="set-h">Default settings</div>
            <div className="set-desc">
              These settings will apply to all users. Settings applied to specific roles will override
              default settings. <span className="rlink">Learn more</span> about keeping your Nova Retail
              account secure.
            </div>
          </div>
          <div className="set-fields sec-fields">
            <div className="sec-group">
              <div className="sec-group-h">LOG IN ACCESS</div>
              <div className="sec-group-d">
                Ensure your account is secure by restricting access to roles you trust. Users who don’t
                have access will be able to use Nova Retail by switching users once someone has logged in.
              </div>
              <RadioRow value="has" current={loginAccess} onSelect={setLoginAccess} label="Has access to log in" />
              <RadioRow
                value="switch"
                current={loginAccess}
                onSelect={setLoginAccess}
                label="Only has access to log in through user switching"
              />
            </div>

            <div className="sec-group">
              <div className="sec-group-h">SWITCHING USER ACCOUNTS</div>
              <div className="sec-group-d">
                Select a requirement for switching user accounts once someone has logged in.
              </div>
              <RadioRow
                value="never"
                current={switching}
                onSelect={setSwitching}
                label="Never require a password when switching between users"
              />
              <RadioRow
                value="barcode"
                current={switching}
                onSelect={setSwitching}
                label="Don’t require a password when switching with a barcode"
              />
              <RadioRow
                value="privileges"
                current={switching}
                onSelect={setSwitching}
                label="Require a password when switching to a user with more privileges"
              />
              <RadioRow
                value="always"
                current={switching}
                onSelect={setSwitching}
                label="Always require a password when switching between users"
              />
            </div>

            <div className="sec-group">
              <div className="sec-group-h">AUTHENTICATION METHOD</div>
              <div className="sec-group-d">
                Manage your authentication method when users enter their password to access Nova Retail.
              </div>
              <RadioRow value="userpass" current={authMethod} onSelect={setAuthMethod} label="Username and password" />
              <RadioRow
                value="mfa"
                current={authMethod}
                onSelect={setAuthMethod}
                label="Username and password with multi-factor authentication"
              />
            </div>

            <div className="sec-group">
              <div className="sec-group-h">INACTIVITY RE-AUTHENTICATION</div>
              <div className="sec-group-d">
                After a period of inactivity the session will be paused. You can require users to
                re-authenticate to resume working.
              </div>
              <div className="chk-row" onClick={() => sec.set({ inactivity: !inactivity })}>
                <span className={`chk ${inactivity ? 'on' : ''}`}>{inactivity ? '✓' : ''}</span>
                <div className="chk-label">Require logging in after inactivity</div>
              </div>
            </div>
          </div>
        </div>

        <div className="setrow">
          <div>
            <div className="set-h">Role specific settings</div>
            <div className="set-desc">Ensure your account is secure by restricting access to specific roles.</div>
          </div>
          <div className="set-fields">
            <div className="role-table">
              <div className="role-head">
                <span>Role</span>
                <span>Log in access</span>
                <span>Authentication method</span>
              </div>
              <div className="role-row">
                <span>Admin</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)', paddingLeft: '12px' }}>Has access to log in</span>
                <span />
              </div>
              <div className="role-row">
                <span>Manager</span>
                <RoleDropdown value={managerLogin} onChange={setManagerLogin} options={LOGIN_OPTIONS} />
                <RoleDropdown value={managerAuth} onChange={setManagerAuth} options={AUTH_OPTIONS} />
              </div>
              <div className="role-row">
                <span>Cashier</span>
                <RoleDropdown value={cashierLogin} onChange={setCashierLogin} options={LOGIN_OPTIONS} />
                <RoleDropdown value={cashierAuth} onChange={setCashierAuth} options={AUTH_OPTIONS} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
