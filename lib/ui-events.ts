/** Dispatched after login/signup stores token + user (see auth-modal). */
export const BETVERS_AUTH_SUCCESS_EVENT = 'betvers_auth_success';

/** Dispatched when wallet balance should refresh everywhere (e.g. after bet). */
export const BETVERS_WALLET_UPDATED_EVENT = 'betvers_wallet_updated';

/** Dispatched after a bet is placed so bet history can refresh in the background. */
export const BETVERS_BET_PLACED_EVENT = 'betvers_bet_placed';

/** Dispatched after a deposit proof is submitted so upload history can refresh. */
export const BETVERS_DEPOSIT_PROOF_SUBMITTED_EVENT = 'betvers_deposit_proof_submitted';

/** Same-origin tabs (e.g. admin approves deposit, user home open) can listen for instant wallet refresh. */
export const BETVERS_WALLET_BROADCAST_CHANNEL = 'betvers_wallet_broadcast';

export function broadcastWalletSyncAcrossTabs(): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const bc = new BroadcastChannel(BETVERS_WALLET_BROADCAST_CHANNEL);
    bc.postMessage({ type: 'wallet_sync' });
    bc.close();
  } catch {
    /* private mode / unsupported */
  }
}
