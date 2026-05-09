/**
 * NetworkMonitor
 *
 * Wraps @react-native-community/netinfo to provide a simple
 * subscribe/unsubscribe API for offline→online transitions.
 *
 * Usage:
 *   networkMonitor.start(onBackOnline);
 *   networkMonitor.stop();
 *   networkMonitor.isOnline();
 */

import NetInfo from '@react-native-community/netinfo';
import { createLogger } from '../utils/logger';

const log = createLogger('NetworkMonitor');

type OnBackOnline = () => void;

let _isOnline = true;
let _wasOffline = false;
let _unsubscribe: (() => void) | null = null;
let _onBackOnline: OnBackOnline | null = null;

/**
 * Start monitoring network state.
 * Calls onBackOnline once each time the device transitions offline → online.
 * Safe to call multiple times — stops previous listener first.
 */
function start(onBackOnline: OnBackOnline): void {
  stop();

  _onBackOnline = onBackOnline;

  _unsubscribe = NetInfo.addEventListener((state) => {
    const isNowOnline = state.isConnected === true && state.isInternetReachable !== false;

    if (!isNowOnline) {
      _isOnline = false;
      _wasOffline = true;
      log.debug('Device offline');
      return;
    }

    _isOnline = true;

    if (_wasOffline) {
      _wasOffline = false;
      log.info('Device back online — triggering callback');
      _onBackOnline?.();
    }
  });

  log.debug('Network monitor started');
}

/**
 * Stop monitoring. Safe to call when not started.
 */
function stop(): void {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
    _onBackOnline = null;
    log.debug('Network monitor stopped');
  }
}

/**
 * Returns the last known online state.
 * Note: this is cached from the last NetInfo event, not a live check.
 */
function isOnline(): boolean {
  return _isOnline;
}

export const networkMonitor = { start, stop, isOnline };
