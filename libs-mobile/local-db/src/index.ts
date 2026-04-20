// ── Schema & Database ────────────────────────────────────
export { schema } from './schema';
export { initializeDatabase, getDatabase, resetDatabase, getDatabaseStats } from './database';

// ── Models ───────────────────────────────────────────────
export { AuthUser, AuthSession, AuthRoles, AuthFlags } from './models';
export { PendingSync } from './models/PendingSync';

// ── Hooks ────────────────────────────────────────────────
export { useAuth } from './hooks/useAuth';
