# Production-Grade React Native + Expo Router: The Complete Hidden-Pitfalls Reference

**Audience:** Senior/Principal engineers building enterprise-scale offline-first mobile apps  
**Stack:** React Native · Expo · Expo Router · TypeScript · SQLite (Drizzle) · EAS Build/Update  
**Date compiled:** 2026-05-07

---

## Format per item

> **Category → Problem** | Why It Happens | Production Impact | Real Scenario | Severity | Enterprise Solution | Best Practice

---

## 1. EXPO ROUTER ARCHITECTURE

### 1.1 Layout remount on every group switch

- **Problem:** Placing heavy providers (Redux, ReactQuery, Theme, i18n, DB) inside `(group)/_layout.tsx` instead of the root `_layout.tsx`.
- **Why it happens:** Devs treat group layouts like nested React routes. Expo Router **unmounts the entire subtree** when navigating across groups (`(auth)` → `(protected)`).
- **Production impact:** DB connection re-opens, Redux store recreated, in-flight requests aborted, websocket disconnects, splash flicker.
- **Real scenario:** User logs in → auth group unmounts → `QueryClient` recreated → all caches lost → cold home screen.
- **Severity:** HIGH
- **Solution:** Keep all global state, DB, theme, query client, and nav-independent providers in **root `app/_layout.tsx`**. Group layouts only own UI chrome.
- **Best practice:** Root layout = providers + boot sequence. Group layouts = headers, drawers, guards.

### 1.2 `router.replace` doesn't clear stack on Android back

- **Problem:** Assuming `router.replace("/login")` after logout prevents back-navigation.
- **Why:** Android hardware back can still pop into protected screens if any modal/screen was rendered before replace finished.
- **Impact:** Logged-out user sees a flash of authenticated screens.
- **Solution:** After logout, call `router.dismissAll()` then `router.replace()`. Gate every protected screen with a guard that re-checks auth on focus via `useFocusEffect`.

### 1.3 `useLocalSearchParams` returns stale values during transitions

- **Problem:** Reading params at top of component and not reacting to navigation updates.
- **Impact:** User opens product A → navigates to product B via deep link → screen still shows A's data.
- **Solution:** Always destructure params inside `useEffect` deps, or use `useGlobalSearchParams` for cross-screen reads. Treat params as **derived state**, not constants.

### 1.4 Typed routes break silently on rename

- **Problem:** Routes are string-based; renaming a folder doesn't fail at compile time unless `experiments.typedRoutes` is enabled.
- **Solution:** Enable `experiments.typedRoutes: true` in `app.json`, **and** centralize routes in a `ROUTES` constant. Never hand-write paths inline.

### 1.5 Modal/sheet routing pitfalls

- **Problem:** Modals as siblings to tabs cause hardware back on Android to dismiss modal but also pop tab state.
- **Solution:** Modals belong in their own group with `presentation: "modal"`. On Android, intercept hardware back via `BackHandler` inside the modal.

### 1.6 Initial route flicker

- **Problem:** Splash screen hides before auth state resolves → shows auth screen for 80ms then jumps to home.
- **Solution:** Keep `SplashScreen.preventAutoHideAsync()` until **boot orchestrator** finishes (auth restore + DB ready + critical lookups loaded). Hide splash only after first protected screen mounts.

### 1.7 Drawer/Tabs `unmountOnBlur` defaults

- **Problem:** Tabs keep all children mounted forever → memory grows linearly with tabs visited.
- **Solution:** For heavy screens (maps, lists with 1000s of rows), set `lazy: true` and `unmountOnBlur: true` selectively. Profile before applying globally — re-mounting kills perceived performance.

### 1.8 No boot orchestrator state machine

- **Problem:** Boot logic is a `useEffect` chain instead of explicit states.
- **Solution:** Model boot as: `cold` → `db-ready` → `auth-restored` → `lookups-loaded` → `ready`. Each transition has retry + failure UX. Never show app content until state is `ready`.

---

## 2. REACT NATIVE PERFORMANCE

### 2.1 Re-render storms from context

- **Problem:** One giant `AppContext` providing user + theme + cart + settings. Any change re-renders the entire tree.
- **Solution:** Split contexts by **change frequency**. Move to Zustand/Redux with selector subscriptions. Never put rapidly-changing values (timers, scroll position) in Context.

### 2.2 FlatList without `getItemLayout` / `keyExtractor` stability

- **Impact:** Janky scroll on Android with 500+ rows; blank cells on fast scroll.
- **Solution:** Always provide `keyExtractor`, `getItemLayout` for fixed-height rows, `removeClippedSubviews`, `windowSize=5`, `maxToRenderPerBatch=10`. For very large lists, switch to **FlashList** (`@shopify/flash-list`) — measurably 5-10× faster on Android.

### 2.3 Inline functions and styles in lists

- **Problem:** `<Item onPress={() => …} />` creates a new function each render, breaking `React.memo`.
- **Solution:** `useCallback` + memoized item component. Pull `StyleSheet.create` to module scope.

### 2.4 styled-components / emotion runtime cost

- **Problem:** Every render computes styles via JS. On low-end Android this dominates frame time.
- **Solution:** Use `StyleSheet.create` for hot paths (lists, animations). Reserve styled-components for layout chrome.

### 2.5 Bridge crossings on the JS thread

- **Problem:** Animating layout via `setState` causes bridge traffic per frame → drops to 20fps on mid-tier Android.
- **Solution:** **Reanimated 3 + Gesture Handler** for any animation touching layout, opacity, or transform. Worklets run on the UI thread.

### 2.6 Image performance

- **Problem:** Default `<Image>` keeps full-resolution decoded bitmap in memory; 30 product images = 200MB RAM.
- **Solution:** Use `expo-image` (disk + memory cache, downsampling, blurhash placeholders). Always provide explicit `width`/`height`. Pre-resize on backend — never let mobile downscale 4K assets.

### 2.7 Fast Refresh hides perf bugs

- **Problem:** Dev mode has slow renders, no Hermes optimizations, `console.log` overhead.
- **Solution:** Always profile in **release builds on physical mid-tier Android** (Pixel 4a, Redmi Note). Never trust simulator perf.

### 2.8 Inline requires not enabled

- **Problem:** Metro loads all modules synchronously on startup, even unused ones.
- **Solution:** Metro `inlineRequires: true`. Massively cuts initial JS execution time.

### 2.9 Hermes not verified

- **Problem:** Hermes might be disabled or not verified in release builds.
- **Solution:** Confirm Hermes in release; it gives 20-40% faster startup and lower memory on Android.

---

## 3. OFFLINE-FIRST ARCHITECTURE

### 3.1 Treating offline as "show cached UI"

- **Problem:** Offline-first ≠ caching. It's a write strategy: every mutation must enqueue locally, optimistic-update UI, then sync.
- **Impact:** Users lose work on flaky networks. App feels broken on subway/elevator.
- **Solution:** Single **mutation queue** with idempotency keys (UUIDv7), priorities, retries with jittered backoff, dead-letter for poison messages.

### 3.2 No idempotency keys

- **Problem:** Network drops mid-request → retry creates duplicate orders/payments.
- **Solution:** Generate UUIDv7 client-side per mutation. Server treats it as primary dedup key. **Never** use auto-increment IDs as dedup.

### 3.3 Last-write-wins on entire records

- **Problem:** Two devices edit different fields of same row → one overwrites the other's change.
- **Solution:** Field-level merge with `changedFields` array, or CRDTs for collaborative data. At minimum, use `baseVersion` (optimistic concurrency) and surface conflicts explicitly.

### 3.4 Clock skew

- **Problem:** Devices have wrong system time → sync ordering breaks; tokens expire incorrectly.
- **Solution:** Detect drift via server-time header on every response; reject if drift > 5 min. Never use `Date.now()` as a sync ordering key — use server-assigned monotonic version.

### 3.5 Pull cursors that aren't unique

- **Problem:** Cursor = `updated_at` only; two rows updated in same millisecond → one missed forever.
- **Solution:** Composite cursor `<ms>:<uuid>` and server-side keyset pagination. Mobile must persist cursor **atomically** with the rows it gates.

### 3.6 Sync engine without backpressure

- **Problem:** First login pulls 500K rows, blocks UI thread, OOMs Android Go devices.
- **Solution:** Streamed pagination, batch size tied to device RAM, **staging table** + transactional commit, progress per entity, resumable via persisted cursor. Background priority when app foregrounds.

### 3.7 Queue grows unbounded

- **Problem:** App stuck offline for a week generates 100K mutations; DB hits SQLite limits, sync chokes on reconnect.
- **Solution:** Cap queue size. Expose "you have N pending changes" UI. Prevent further edits past threshold. TTL on stale mutations.

### 3.8 No conflict UX

- **Problem:** Server rejects mutation → app silently swallows it → user's work disappears.
- **Solution:** Quarantine table (`failed_operations`) + UI surface ("3 changes need your attention") with retry/discard affordance.

### 3.9 Optimistic updates that lie

- **Problem:** UI shows order created, sync fails, order vanishes 3 minutes later.
- **Solution:** Visual "pending" state on every optimistic record (badge, reduced opacity). Don't show it as confirmed until server acks.

---

## 4. SYNC ENGINE DESIGN

### 4.1 No mutation dependency ordering

- **Problem:** Create user → create order referencing user. Network drops between. On reconnect, order syncs first → FK violation on server.
- **Solution:** Topological sort by FK dependencies before send. Or include parent payloads inline (denormalized).

### 4.2 Push and pull racing

- **Problem:** App pulls server state while local mutations are pending → overwrites local changes.
- **Solution:** Push-then-pull strict ordering. Or version-vectors per entity. Never merge by timestamp alone.

### 4.3 Sync on every keystroke

- **Problem:** Eager sync floods server, drains battery, hits rate limits.
- **Solution:** Debounced + batched. Sync triggers: (a) explicit user action, (b) connectivity restored, (c) periodic background, (d) push-triggered pull.

### 4.4 Cursor persistence not atomic with data

- **Problem:** Save 1000 rows → app crashes before saving cursor → next sync redownloads all 1000. Or vice versa: cursor saved, rows not → permanent gap.
- **Solution:** Single `db.transaction(() => { insertRows(); updateCursor(); })`. Always, without exception.

### 4.5 No tombstones

- **Problem:** Server deletes a row; mobile keeps it forever because pull only returns "updated since X".
- **Solution:** Soft-delete with `deleted_at`; pull includes tombstones. Mobile prunes locally on observation.

### 4.6 Auth refresh inside sync loop

- **Problem:** Token expires mid-batch → 401s cascade → all batches fail → mutations quarantined as poison.
- **Solution:** Single-flight refresh lock. Pause sync during refresh. Distinguish `401 token expired` (retry) from `401 invalid grant` (logout).

### 4.7 No entity type validation on pull

- **Problem:** Unknown entity type arrives in sync response → crash or silent corruption.
- **Solution:** Strict allowlist of known entity types. Unknown types logged + skipped, never silently written.

---

## 5. STATE MANAGEMENT

### 5.1 Server state in Redux

- **Problem:** Treating React Query / RTK Query data as Redux state → manual cache invalidation hell.
- **Solution:** Server state → React Query / RTK Query. Client state → Redux/Zustand. Don't mix.

### 5.2 Persisting too much

- **Problem:** `redux-persist` whitelists everything → 5MB of cached lookups, 200ms cold-start parse.
- **Solution:** Persist only auth + user prefs + draft mutations. Server data goes to SQLite, not redux-persist.

### 5.3 Persist rehydration race

- **Problem:** Components render before redux-persist rehydrates → flicker / wrong UI / wrong locale.
- **Solution:** Gate root component on `PersistGate` (or equivalent boot orchestrator) before showing any content.

### 5.4 AsyncStorage is not a database

- **Problem:** Storing structured data in AsyncStorage; reads are full-string-parse on every access.
- **Solution:** AsyncStorage = key-value flags only. Use SQLite (Drizzle/Op-SQLite) for structured data. Use **MMKV** for hot key-value reads (10× faster than AsyncStorage, synchronous).

### 5.5 Zustand/Redux selector granularity

- **Problem:** Selecting entire slice objects → component re-renders on any field change.
- **Solution:** Atomic selectors selecting only the specific field needed. Memoize derived selectors with `reselect`.

---

## 6. AUTHENTICATION & SECURITY

### 6.1 Tokens in AsyncStorage

- **Problem:** AsyncStorage is plaintext on disk, accessible via rooted/jailbroken devices and ADB backup.
- **Solution:** `expo-secure-store` for tokens (Keychain/Keystore-backed). Mind the **2KB value limit on Android** — chunk or compress large tokens.

### 6.2 No device binding

- **Problem:** Stolen refresh token works on attacker's device with no detection.
- **Solution:** HMAC over `{deviceId, installationId}` bound into token claims. Server rejects refresh from unbound devices.

### 6.3 No JWKS rotation handling

- **Problem:** Server rotates signing key → all sessions invalidated → users logged out en masse.
- **Solution:** Cache JWKS with TTL + grace period for old keys. Mobile JWT verification must accept either key during rotation window.

### 6.4 Refresh-token reuse not detected

- **Problem:** Stolen refresh token used in parallel with legitimate app → both succeed → silent compromise.
- **Solution:** Refresh-token rotation with reuse detection: if same RT presented twice, invalidate the entire session family.

### 6.5 Biometric prompt without fallback

- **Problem:** User changes fingerprint → biometric fails → app unusable until reinstall.
- **Solution:** PIN/password fallback always. Re-enroll prompt on biometric change (`expo-local-authentication` exposes enrolled state).

### 6.6 Logging tokens / PII

- **Problem:** `console.log(response)` ships to Sentry/Datadog with bearer tokens in the payload.
- **Solution:** Mandatory log sanitizer wrapping ALL log calls. Allowlist safe fields; never blocklist sensitive ones.

### 6.7 Deep links bypass auth

- **Problem:** `myapp://order/123` opens order screen even when logged out.
- **Solution:** Every screen checks auth at mount. Pending deep links queued until auth completes, then replayed.

### 6.8 SSL pinning skipped

- **Problem:** MITM via corporate proxy or malicious WiFi reads all traffic.
- **Solution:** `react-native-ssl-pinning` or platform-native pinning. Pin to **leaf + backup intermediate**, not root. Maintain a key-rotation playbook.

### 6.9 Root/jailbreak detection missing

- **Problem:** Finance/health apps run on rooted devices that can hook native calls.
- **Solution:** `jail-monkey` or commercial RASP (Approov, Talsec). Define risk tiers: warn vs hard block.

### 6.10 No app integrity attestation

- **Problem:** Tampered/repackaged APK still talks to your API.
- **Solution:** **Play Integrity API** (Android), **App Attest / DeviceCheck** (iOS). Server requires attestation token on sensitive endpoints.

---

## 7. API LAYER

### 7.1 No request deduplication

- **Problem:** User taps "Pay" twice quickly → two charges.
- **Solution:** Idempotency-Key header on every mutation. Disable button on press until response or timeout.

### 7.2 No timeout

- **Problem:** Default fetch hangs forever on captive portals.
- **Solution:** `AbortController` with sane timeouts (10s mutations, 30s uploads). Distinguish "timeout" from "offline" in UX copy.

### 7.3 Treating 5xx as terminal

- **Problem:** Single 503 quarantines a payment mutation forever.
- **Solution:** Retryable error taxonomy: `408/429/5xx` → retry with backoff. `4xx` (except 408/429) → terminal.

### 7.4 No request budget per screen

- **Problem:** Home screen makes 14 API calls on focus → drains battery, hits rate limits.
- **Solution:** Aggregate endpoints (BFF pattern) or batch with GraphQL. Audit network waterfall in Flipper/Reactotron.

### 7.5 Cache-Control ignored

- **Problem:** Mobile re-downloads static lookups (states, currencies) on every launch.
- **Solution:** ETag + If-None-Match; persistent cache layer at HTTP level, not just React Query.

### 7.6 No Zod/schema validation at API boundary

- **Problem:** Backend returns a different shape → silent decode failure, type errors at runtime.
- **Solution:** Zod schemas at every API boundary. Fail loud on contract mismatch with versioned error.

---

## 8. MOBILE APP LIFECYCLE

### 8.1 No state restoration

- **Problem:** OS kills backgrounded app to reclaim memory → user returns to login screen instead of where they were.
- **Solution:** Persist nav state via `initialState` + `onStateChange`. Hydrate on boot. Test by Force-Stopping app on Android.

### 8.2 AppState transitions not handled

- **Problem:** Returning from background after 2 hours doesn't refresh stale data; auth might be expired.
- **Solution:** On `AppState` → `active`: revalidate critical queries, re-check auth, resume sync, reconnect websockets.

### 8.3 `setInterval` as background timer

- **Problem:** Devs use `setInterval` for periodic sync — dies when app backgrounds.
- **Solution:** `expo-background-fetch` / `expo-task-manager` for true background work. Accept iOS's strict limits (OS-decided, typically 15+ min between firings).

### 8.4 OS killing during long boot

- **Problem:** Long synchronous boot (DB migration + sync + lookup load) → user backgrounds → OS kills → app appears broken.
- **Solution:** Non-blocking boot. Show UI ASAP with "syncing" indicators rather than blocking on data.

### 8.5 Memory warnings ignored

- **Problem:** No `memoryWarning` handler → iOS kills app silently after repeated warnings.
- **Solution:** Listen for memory warnings. Drop image caches, close unused DB cursors, reduce in-memory list windows.

---

## 9. DEEP LINKING

### 9.1 Universal/App Links not configured

- **Problem:** Devs only handle `myapp://` scheme; share-sheet / web links don't open app.
- **Solution:** Set up Universal Links (iOS — `apple-app-site-association`) and App Links (Android — `assetlinks.json`, `autoVerify=true`). Test on real devices, not simulator.

### 9.2 Deep link before app is ready

- **Problem:** Cold-start deep link arrives before auth/DB ready → navigation throws or routes to error screen.
- **Solution:** Deep link **queue** consumed only after boot orchestrator completes.

### 9.3 Deep links opening duplicate stacks

- **Problem:** Deep link from notification while app is foregrounded creates a second instance of the target screen.
- **Solution:** Idempotent navigation: if already on target route, no-op or update params only.

### 9.4 Back from deep-linked screen has nowhere to go

- **Problem:** Notification opens detail screen → back press exits app.
- **Solution:** Synthesize parent stack on deep link entry.

### 9.5 Magic-link auth on different device

- **Problem:** User opens email magic link on desktop; falls back to web; loses mobile session.
- **Solution:** Server-side detection + QR fallback, or session handoff via short-lived code.

---

## 10. PUSH NOTIFICATIONS

### 10.1 No token refresh handling

- **Problem:** FCM/APNs token rotates → backend keeps sending to dead token → silent delivery failure at scale.
- **Solution:** Listen for token refresh event, re-register with backend. Server prunes on `410 Gone` / `NotRegistered`.

### 10.2 Permission asked on boot

- **Problem:** Cold first-launch prompt = 70%+ deny rate.
- **Solution:** Pre-permission UI explaining value. Ask at the moment of demonstrated value (after user completes first meaningful action).

### 10.3 iOS notification settings not re-synced

- **Problem:** User disables notifications in iOS settings → app still thinks it has permission.
- **Solution:** Re-check permission on every `AppState` → `active`. Update server and UI accordingly.

### 10.4 Background data notifications killed by Android battery optimizer

- **Problem:** Doze mode / App Standby suppresses silent data pushes on Android.
- **Solution:** Use high-priority FCM only when truly user-visible. For data sync, design **eventual consistency**, not push-driven.

### 10.5 Notification routing on cold start vs warm

- **Problem:** Tap notification → routes correctly when app warm; cold start ignores payload.
- **Solution:** Read `getInitialNotification()` in boot sequence AND `addNotificationResponseReceivedListener` for warm state. Handle both paths explicitly.

### 10.6 No quiet hours / notification preferences

- **Problem:** Users get spammed at 3am → uninstall.
- **Solution:** Per-category preferences synced server-side. Respect user timezone.

---

## 11. BACKGROUND TASKS

### 11.1 Assuming reliable execution

- **Problem:** "Sync every 15 minutes" — iOS gives you maybe 30s/day, opportunistically scheduled.
- **Solution:** Background tasks are **best-effort**. Critical work runs in foreground. Background = opportunistic catch-up only.

### 11.2 Long-running uploads

- **Problem:** User backgrounds app mid-upload → upload dies on iOS after ~30s.
- **Solution:** `URLSession` background config (iOS) / `WorkManager` (Android) via native module. `expo-background-fetch` is NOT sufficient for long uploads.

### 11.3 Battery drain from always-on connections

- **Problem:** Always-on websocket → ~4% battery/hour overnight while backgrounded.
- **Solution:** Disconnect on background; reconnect on foreground; rely on push for real-time triggers.

---

## 12. OTA UPDATES (EAS Update / Expo Updates)

### 12.1 Native code change pushed as OTA

- **Problem:** Dev adds a native module then pushes OTA update → app crashes on launch for all users.
- **Solution:** Strict process: any change to `package.json` native deps or `app.json` plugins requires a **store binary release**. CI must block OTA if bundle fingerprint differs.

### 12.2 No rollback strategy

- **Problem:** Bad OTA ships → 30% of users see white screen → no fast revert path.
- **Solution:** Phased rollout (1% → 10% → 100%) with crash-rate gating. Auto-rollback to previous embedded bundle on N consecutive launch failures.

### 12.3 Update fetch blocks splash screen

- **Problem:** Default config blocks splash on update fetch → 5s perceived hang on slow networks.
- **Solution:** `checkAutomatically: 'ON_LOAD'` with timeout, OR fetch in background and apply on next launch (`fallbackToCacheTimeout: 0`).

### 12.4 Stale OTA channels

- **Problem:** Channel mismatch between store binary and update channel → users on old builds never get updates.
- **Solution:** Channel scheme tied to build number. Document channel-runtime-version matrix.

### 12.5 No update integrity verification

- **Problem:** Compromised update server could push malicious bundle.
- **Solution:** EAS Update code signing (`expo-updates` code-signing). Mandatory for finance/health apps.

### 12.6 No OTA killswitch

- **Problem:** Critical bug in OTA, no way to stop delivery.
- **Solution:** Boot-time check against server killswitch endpoint; if killed, show maintenance screen. Maintain a live "enabled OTA channels" config on server.

---

## 13. ANDROID-SPECIFIC PROBLEMS

### 13.1 Doze mode / App Standby

- **Problem:** Background sync stops, push delayed up to hours, alarms deferred.
- **Solution:** High-priority FCM for critical pushes. Request battery optimization whitelist only when genuinely justified and with user explanation.

### 13.2 OEM aggressive killers (Xiaomi, Oppo, Huawei)

- **Problem:** Apps get killed within minutes despite following Android guidelines.
- **Solution:** Guide users to OEM-specific battery settings (reference `dontkillmyapp.com`). Don't rely on background work for these OEMs at all.

### 13.3 Scoped storage migration

- **Problem:** SDK 30+ requires scoped storage; legacy file path access fails silently.
- **Solution:** `expo-document-picker` + `expo-file-system` with content URIs; never assume direct filesystem paths.

### 13.4 Hardware back button

- **Problem:** Default behavior pops nav even from forms with unsaved changes.
- **Solution:** `BackHandler` per screen for form guards; integrate with React Navigation's `beforeRemove` event.

### 13.5 KeyboardAvoidingView broken on Android

- **Problem:** `behavior="padding"` fails on Android with translucent status bar.
- **Solution:** `behavior="height"` on Android, `"padding"` on iOS, plus `android:windowSoftInputMode="adjustResize"` in manifest.

### 13.6 SafeArea OEM differences

- **Problem:** Android cutouts/notches handled differently per OEM (Samsung, Xiaomi, Oppo).
- **Solution:** `react-native-safe-area-context` with `edges` per screen. Test on Pixel + Samsung + Xiaomi minimum.

### 13.7 Android 14 foreground service types

- **Problem:** SDK 34 requires explicit foreground service type declaration → app crashes if missing.
- **Solution:** Declare `foregroundServiceType` in `AndroidManifest.xml`; align with permission set.

---

## 14. iOS-SPECIFIC PROBLEMS

### 14.1 ATT (App Tracking Transparency) breaking analytics

- **Problem:** Default-deny IDFA → analytics attribution degraded or destroyed.
- **Solution:** Server-side attribution via SKAN 4. Don't rely on IDFA for analytics.

### 14.2 Background fetch quotas

- **Problem:** iOS reduces background fetch frequency for apps users don't open often.
- **Solution:** Push-triggered sync (silent push hint), not pure periodic. Design for eventual consistency.

### 14.3 Privacy manifests (iOS 17+)

- **Problem:** Missing `PrivacyInfo.xcprivacy` → App Store rejection.
- **Solution:** Audit all third-party SDKs for required-reasons APIs; bundle privacy manifests for each.

### 14.4 Universal Links downgrade to Safari

- **Problem:** User long-presses link → "Open in Safari" → permanently disables Universal Links for your domain on that device.
- **Solution:** Provide explicit "Open in App" button on web fallback page; educate users.

### 14.5 In-app purchase sandbox quirks

- **Problem:** Sandbox subscriptions renew every 5 min; testers think billing is broken.
- **Solution:** Document sandbox behavior in test guide; always use server-side receipt validation.

---

## 15. ACCESSIBILITY

### 15.1 No `accessibilityLabel` on icons

- **Impact:** VoiceOver/TalkBack users hear only "button" with no context.
- **Solution:** Mandatory ESLint rule. Every `Pressable`/`TouchableOpacity` needs role + label.

### 15.2 Dynamic type ignored

- **Problem:** Users at 200% font size → UI breaks, text clips.
- **Solution:** Test at max accessibility sizes. Use `allowFontScaling` thoughtfully; prefer flexible layouts.

### 15.3 Color-only state indication

- **Problem:** Red/green for success/error → invisible to color-blind users.
- **Solution:** Always: icon + color + text together. Never color as the sole indicator.

### 15.4 Touch targets < 44pt / 48dp

- **Solution:** Minimum 44×44 (iOS HIG) / 48dp (Material). Use `hitSlop` for tight designs.

### 15.5 Screen reader focus order wrong

- **Problem:** Visual order ≠ accessibility traversal order.
- **Solution:** Test with VoiceOver + TalkBack. Use `accessibilityElementsHidden` and `importantForAccessibility` deliberately.

---

## 16. ANIMATIONS & GESTURES

### 16.1 Animated API on JS thread

- **Problem:** `Animated.timing` with `useNativeDriver: false` blocks on JS work → janky on heavy screens.
- **Solution:** Reanimated 3 worklets; always `useNativeDriver: true` for opacity/transform.

### 16.2 Gesture conflicts

- **Problem:** Pan inside scroll inside drawer → all three fight for the gesture.
- **Solution:** `react-native-gesture-handler` with `simultaneousHandlers` / `waitFor`. Plan gesture hierarchy upfront.

### 16.3 Layout animations on Android

- **Problem:** `LayoutAnimation` is unreliable on Android, causes visual glitches.
- **Solution:** Use Reanimated layout transitions instead.

---

## 17. MEMORY MANAGEMENT

### 17.1 setState on unmounted component

- **Problem:** Async fetch resolves after unmount → setState on unmounted component.
- **Solution:** `AbortController` + cleanup in `useEffect`. React Query handles this automatically.

### 17.2 Listener leaks

- **Problem:** `AppState.addEventListener`, `Linking.addEventListener`, `NetInfo.addEventListener` not removed → multiple subscriptions accumulate.
- **Solution:** Always return cleanup from `useEffect`. Audit with Flipper memory snapshots.

### 17.3 Large Redux state retained forever

- **Problem:** Loaded 5K product list once; never cleared; held in memory for entire session.
- **Solution:** TTL on cache slices; manual eviction on navigation away from heavy screens.

### 17.4 SQLite cursors not closed

- **Problem:** Native crashes on Android from leaked cursors after thousands of queries.
- **Solution:** Always use the ORM's transaction/query helpers. Never use raw cursors without explicit `.close()`.

---

## 18. NAVIGATION EDGE CASES

### 18.1 Double-tap pushes duplicate screens

- **Solution:** Disable button while navigating, or guard against duplicate route at top of stack.

### 18.2 Back from deep-linked screen exits app

- **Problem:** Notification opens detail screen → back press exits app with no parent in stack.
- **Solution:** Synthesize parent stack on deep link entry using `router.replace` chain.

### 18.3 Modal dismissed by swipe loses unsaved data

- **Solution:** `gestureEnabled={false}` on dirty forms; or confirm dialog on `beforeRemove`.

### 18.4 Tab state preserved through logout

- **Problem:** Re-login shows stale tab state from previous session.
- **Solution:** Reset nav fully on auth transitions; don't try to preserve cross-session state.

---

## 19. ERROR HANDLING

### 19.1 No error boundary

- **Problem:** One render crash → entire RN app shows red box (dev) or white screen (prod).
- **Solution:** Root error boundary with fallback UI + crash report. Per-screen boundaries for resilience.

### 19.2 Unhandled Promise rejections swallowed

- **Solution:** Global `unhandledrejection` handler reporting to Sentry. ESLint rule for missing `.catch`.

### 19.3 Silent native crashes

- **Problem:** Native module crash → JS thinks API call just hung forever.
- **Solution:** Sentry/Crashlytics native crash reporting **separate** from JS error boundary.

### 19.4 Generic "Something went wrong" messages

- **Solution:** Error taxonomy with user-facing copy, machine-readable code, retry affordance, support reference ID. Users need to know if they should retry, wait, or contact support.

---

## 20. MONITORING & OBSERVABILITY

### 20.1 No release health tracking

- **Solution:** Sentry release health tracks crash-free sessions/users per release. Gate phased rollout on crash-free session rate.

### 20.2 No business-event telemetry

- **Problem:** Engineering tracks crashes; product team has no insight into "checkout abandoned at step 3".
- **Solution:** Funnel events with consistent schema; split by platform and app version.

### 20.3 Sourcemaps not uploaded

- **Problem:** Sentry shows minified stack traces → unreadable, unactionable.
- **Solution:** EAS Build hooks upload sourcemaps + dSYMs automatically. Verify on every release build.

### 20.4 No performance monitoring

- **Solution:** Track TTI (time-to-interactive), screen render times, API latency p50/p95/p99 per endpoint per app version. Alert on regressions.

### 20.5 No log levels in production

- **Problem:** Verbose debug logs ship to backend, blow up storage costs.
- **Solution:** Tiered logging; production = `warn`+`error` only; debug logs gated behind feature flag.

---

## 21. CI/CD & RELEASE MANAGEMENT

### 21.1 Manual store uploads

- **Solution:** EAS Submit + Fastlane. Tag-driven releases. No human in the upload loop.

### 21.2 No staging build channel

- **Solution:** Three channels minimum: `dev`, `staging`, `production`. Each with its own backend environment and feature flag set.

### 21.3 Version drift between platforms

- **Problem:** iOS at 1.4.2, Android at 1.4.5 → support nightmare for bug reports.
- **Solution:** Single source of truth for `version` + `runtimeVersion`. CI enforces parity on every build.

### 21.4 No changelog automation

- **Solution:** Conventional commits + `release-please` generates store release notes automatically.

### 21.5 No pre-flight checks

- **Solution:** CI gates: TypeScript clean, lint clean, tests pass, bundle size within budget, no banned deps, native module fingerprint matches current binary.

### 21.6 Long build times blocking velocity

- **Solution:** Self-hosted EAS runners for dev; aggressively cache Pods/Gradle; profile build steps with `--profile`.

---

## 22. FEATURE FLAGS

### 22.1 No remote kill switch

- **Problem:** Bad feature ships, no way to disable without OTA or store release.
- **Solution:** Server-side flags fetched on boot + on `AppState` active. Default-off for all new features.

### 22.2 Flag drift

- **Problem:** Old flags never cleaned up → flag spaghetti after 6 months.
- **Solution:** Every flag has owner, expiry date, and removal ticket. Quarterly audit.

### 22.3 Flag evaluation flicker

- **Problem:** Feature flag async-loads → UI flickers between states before flag resolves.
- **Solution:** Hydrate flags before first render or use stable, conservative defaults.

---

## 23. ENVIRONMENT MANAGEMENT

### 23.1 API URL hardcoded

- **Solution:** `expo-constants` + `app.config.ts` reading from `.env.*` per environment. Never commit production URLs to repo.

### 23.2 Secrets in JS bundle

- **Problem:** API keys in `process.env` end up in the bundle, extractable from APK/IPA.
- **Solution:** Public-safe keys only client-side. Real secrets live behind your own backend proxy.

### 23.3 Multi-tenant config not handled

- **Solution:** Variant builds via `app.config.ts` per tenant + EAS profiles. Don't ship one binary for all tenants if branding, endpoints, or permissions differ.

---

## 24. APP STARTUP OPTIMIZATION

### 24.1 Synchronous boot waterfall

- **Problem:** DB open → migrations → fetch user → fetch lookups → fetch flags → render. Total: 4s cold start.
- **Solution:** Parallelize independent steps. Render shell immediately with skeleton UI. Lazy-load lookups after first paint.

### 24.2 Boot-blocking analytics SDK initialization

- **Problem:** 5 analytics SDKs initialized synchronously on boot → 800ms added to cold start.
- **Solution:** Lazy-init non-critical SDKs after first user interaction. Only initialize crash reporters synchronously.

### 24.3 RAM bundle not used for large apps

- **Solution:** For apps with >5MB JS bundle, consider RAM bundle (Android) for lazy module loading.

---

## 25. BATTERY & NETWORK OPTIMIZATION

### 25.1 Polling instead of pushing

- **Problem:** 30s polling drains battery and bandwidth; wastes server resources.
- **Solution:** WebSocket or push-triggered cache invalidation; fall back to polling only as last resort.

### 25.2 No NetInfo gating

- **Problem:** App makes heavy requests on metered cellular data without user consent.
- **Solution:** `expo-network` type checks; respect "WiFi only" setting for large downloads (catalog sync, image prefetch).

### 25.3 No request coalescing

- **Problem:** Multiple components trigger same request simultaneously.
- **Solution:** React Query deduplicates automatically. For raw fetch, use in-flight map keyed by URL.

### 25.4 Image downloads unthrottled

- **Solution:** `expo-image` priority queue; defer loading of offscreen images; cancel requests on unmount.

---

## 26. SQLITE / STORAGE CONCERNS

### 26.1 No WAL mode

- **Problem:** Default journal_mode = DELETE → readers block writers → UI jank during sync.
- **Solution:** `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;` — ~10× better concurrency.

### 26.2 Foreign keys disabled

- **Problem:** SQLite default has FK off; cascades silently don't run; orphaned rows accumulate.
- **Solution:** `PRAGMA foreign_keys=ON;` on every connection open.

### 26.3 Migrations without integrity check

- **Problem:** Failed migration leaves DB partially upgraded → app crashes on every launch.
- **Solution:** Wrap migration in transaction; run `PRAGMA integrity_check` post-migration; backup-and-restore on failure.

### 26.4 SQLCipher with weak key derivation

- **Solution:** SQLCipher with PBKDF2 600K+ iterations. Key derived per-device from `expo-secure-store` secret.

### 26.5 No DB size cap / eviction policy

- **Problem:** Sync brings 500MB of history → low-storage device fails silently.
- **Solution:** Eviction by recency (LRU per entity). Warn user before running out of storage. Alert at 80% capacity.

### 26.6 No periodic vacuum

- **Problem:** Heavy delete activity → bloated DB file → slow queries over time.
- **Solution:** Periodic `PRAGMA incremental_vacuum` during app idle. Full `VACUUM` during scheduled maintenance window.

### 26.7 Schema change without backward-compatible reads

- **Problem:** Need to roll back app version → new DB schema incompatible with old binary.
- **Solution:** Forward-only schema with backward-compatible reads for N-1 app versions. Additive changes only until old version is EOL.

---

## 27. LARGE-SCALE MAINTAINABILITY

### 27.1 No module boundaries

- **Problem:** 800-file flat `src/` folder; anything imports anything; changes have unbounded blast radius.
- **Solution:** Feature-sliced design: `features/*` (self-contained), `lib/*` (shared), `app/*` (routes only). Enforce with ESLint import boundaries.

### 27.2 Circular imports

- **Solution:** ESLint `import/no-cycle` as an error. Refactor using dependency inversion when cycles are found.

### 27.3 No runtime API contracts

- **Problem:** Backend returns different shape → silent decode failure; type errors surface at runtime, not compile time.
- **Solution:** Zod schemas at every API boundary. Fail loud on contract mismatch.

### 27.4 Magic strings everywhere

- **Solution:** Centralized const objects for routes, event names, query keys, storage keys, entity types. No inline string literals for cross-cutting concerns.

### 27.5 No code ownership

- **Solution:** `CODEOWNERS` per feature directory; PRs auto-assign reviewers.

---

## 28. ENTERPRISE PRODUCTION READINESS

### 28.1 No incident runbook

- **Solution:** Runbooks for: (a) mass login failure, (b) sync engine stall, (c) token compromise, (d) bad OTA. On-call rotation with paging.

### 28.2 No SOC2/GDPR controls

- **Solution:** Data classification table; PII inventory; right-to-deletion endpoints; data export endpoints; consent screens with version tracking.

### 28.3 No mass session revocation tooling

- **Problem:** Compromised credentials → no way to force-logout all sessions quickly.
- **Solution:** Mass session revocation by user, by device, by tenant. Push notification to affected users.

### 28.4 No load test before launch

- **Solution:** Synthetic launch traffic simulation; CDN/origin scaling tested; circuit breakers verified under load.

### 28.5 No fraud detection at edge

- **Solution:** Velocity checks (N actions per minute), device fingerprinting, anomaly detection on auth endpoints. Especially critical for payments and onboarding.

---

## 29. APP STORE / PLAY STORE RELEASE ISSUES

### 29.1 Privacy nutrition labels wrong

- **Solution:** Audit data collection per SDK every release; reconcile with App Store Connect labels.

### 29.2 Permission descriptions vague

- **Problem:** `NSCameraUsageDescription = "to use camera"` → App Store rejection.
- **Solution:** Specific, user-benefit-framed: "to scan barcodes for product lookup."

### 29.3 In-app purchases bypassed

- **Problem:** Adding Stripe for digital goods → Apple/Google rejection or 30% backbill.
- **Solution:** Apple/Google IAP for all digital goods. External payments OK only for physical goods/services with exemption.

### 29.4 Test account missing in submission

- **Problem:** Reviewer can't log in → immediate rejection.
- **Solution:** Standing test account with known credentials documented in submission notes; protected from auto-cleanup.

### 29.5 Crash on Play Console pre-launch report

- **Problem:** Automated robot-tester finds device-specific crash → rollout blocked.
- **Solution:** Run through Firebase Test Lab locally before submission on every release.

### 29.6 Localized metadata missing

- **Problem:** English-only metadata for all locales → loss of conversions in non-English markets.
- **Solution:** Localized title/description/screenshots for each primary market.

### 29.7 Content rating / data safety form outdated

- **Solution:** Include data safety form review in release checklist. Re-audit on every new SDK added.

---

## 30. DISASTER RECOVERY & ROLLBACK STRATEGY

### 30.1 No phased rollout

- **Solution:** 1% → 5% → 20% → 50% → 100% with crash-rate gates between each tier. Automate promotion.

### 30.2 Server-side breaking API change

- **Problem:** Backend deploys breaking change → 30% of users on old app version instantly broken.
- **Solution:** API versioning; backend supports N-2 app versions minimum. Deploy mobile binary before backend change.

### 30.3 No force-update mechanism

- **Solution:** Min-version check on every launch. Soft-block (banner warn) and hard-block (modal) tiers with configurable thresholds.

### 30.4 Local DB corruption with no recovery path

- **Problem:** Bad write → SQLite corrupt → app crashes on every launch → only fix is reinstall.
- **Solution:** `PRAGMA integrity_check` on boot. On failure: wipe + re-sync from server automatically. Surface as "we're refreshing your data" — never show raw error.

### 30.5 Unsynced mutations lost on device reset

- **Problem:** Device factory-reset or reinstall → days of offline edits lost permanently.
- **Solution:** Critical mutations replicated to encrypted backup file or pushed to server as durable drafts before device-side deletion.

### 30.6 No post-incident telemetry baseline

- **Solution:** Define alert thresholds for: crash-free session rate, sync success rate, login success rate, p99 API latency. Alert before users notice, not after.

---

## Bonus: Architectural Principles Most Teams Miss

### The two-clock rule

Never use device `Date.now()` for sync ordering. Device clocks are wrong. Use **server-assigned monotonic version/sequence** for ordering anything that matters. Use device time only for display.

### The boot orchestrator as a state machine

Not a `useEffect` chain. Explicit states: `cold` → `db-ready` → `auth-restored` → `lookups-loaded` → `ready`. Each transition owns its error case. App renders only at `ready`. Guards re-check on focus.

### Mutation queue as single source of truth for writes

Optimistic UI reads from it. Sync engine consumes from it. Conflict UI surfaces from it. One queue, one truth. No dual writes.

### "Never trust the device" principle

Validation, authorization, business rules → server-side. Mobile is a thin presentation + offline cache layer. The mobile app is always hostile territory.

### OTA = production deploy

Same scrutiny as a binary release. Staged rollout. Crash-rate gating. Rollback plan. Signed bundles. Teams have been burned by OTA pushes treating this as "just a JS change."

### Test on airplane mode + 50% packet loss

Use Network Link Conditioner (iOS) and `tc netem` on Android emulator. Real offline behavior can't be simulated by just turning off WiFi — lossy connections are the real killer.

### The first 100ms after splash dismiss is your most-watched moment

Profile and obsess over it. It sets the perceived quality of the entire app.

---

_Compiled for: NKS Mobile — Enterprise offline-first POS application_  
_Covers: Expo Router v3+, EAS Build/Update, Drizzle ORM/SQLite, React Native 0.73+_
