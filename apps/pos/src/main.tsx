import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';

// ── Supabase bootstrap ────────────────────────────────────────────────────────
// Pull the latest data from all tables before the first render.
// Each store already has localStorage as the fallback, so this is non-blocking:
// if Supabase is unreachable the app still works in offline mode.
import { useSettings } from './store/settingsStore';
import { useSetup } from './store/setupStore';
import { useUsers } from './store/userStore';
import { useProducts } from './store/productStore';
import { useCustomers } from './store/customerStore';
import { useCart } from './store/cartStore';
import { useInventory } from './store/inventoryStore';
import { useRegisterSession } from './store/registerSessionStore';
import { useRegister } from './store/registerStore';
import { useQuotes } from './store/quotesStore';
import { useCatalogMeta } from './store/catalogMetaStore';
import { useAdjustmentReasons } from './store/adjustmentReasonsStore';
import { useProductTags } from './store/tagStore';
import { usePromotions } from './store/promotionStore';
import { usePriceBooks } from './store/priceBookStore';
import { useFulfillments } from './store/fulfillmentStore';
import { startSyncQueue } from './lib/syncQueue';

async function bootstrapDb() {
  try {
    await Promise.all([
      useSettings.getState().syncFromDb(),
      useSetup.getState().syncFromDb(),
      useUsers.getState().syncFromDb(),
      useProducts.getState().syncFromDb(),
      useCustomers.getState().syncFromDb(),
      useCart.getState().syncFromDb(),
      useInventory.getState().syncFromDb(),
      useRegisterSession.getState().syncFromDb(),
      useRegister.getState().syncFromDb(),
      useQuotes.getState().syncFromDb(),
      useCatalogMeta.getState().syncFromDb(),
      useAdjustmentReasons.getState().syncFromDb(),
      useProductTags.getState().syncFromDb(),
      usePromotions.getState().syncFromDb(),
      usePriceBooks.getState().syncFromDb(),
      useFulfillments.getState().syncFromDb(),
    ]);
  } catch (err) {
    console.warn('[bootstrap] Supabase sync failed, using cached data.', err);
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// Bootstrap first, then mount. Both happen quickly (<200 ms on a good connection).
bootstrapDb().finally(() => {
  // Replay any writes that failed while offline, now and on every reconnect.
  startSyncQueue();
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
});

