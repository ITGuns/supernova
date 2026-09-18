import { useState } from 'react';

/**
 * Sell → Status: the browser keeps a copy of store data for offline selling;
 * resetting it rebuilds that copy from the cloud (the signed-in user is kept).
 */
export function RegisterStatus() {
  const [confirmReset, setConfirmReset] = useState(false);
  const resetLocalData = () => {
    const keep = new Set(['nova-users-v3', 'nova-theme', 'nova-register-v1']);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('nova-') && !keep.has(key)) localStorage.removeItem(key);
    }
    window.location.reload();
  };
  return (
    <main className="sell-page">
      <h1 className="sell-title">Status</h1>
      <div className="rs-section st-reset">
        <div className="rs-side">
          <div className="cr-h">Reset local data</div>
        </div>
        <div className="rs-main">
          <div className="rs-desc">
            We keep a copy of some of your store data in your web browser so you can keep selling if you lose your Internet
            connection. Sometimes, this gets out of sync. Resetting it can help if you're having trouble with Nova Retail.
          </div>
          {confirmReset ? (
            <div className="st-reset-actions">
              <span>Reset the data kept in this browser and reload? Unsynced changes made while offline are lost.</span>
              <button className="btn-s" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn-danger" onClick={resetLocalData}>Reset data</button>
            </div>
          ) : (
            <button className="btn-primary" onClick={() => setConfirmReset(true)}>Reset data</button>
          )}
        </div>
      </div>
    </main>
  );
}
