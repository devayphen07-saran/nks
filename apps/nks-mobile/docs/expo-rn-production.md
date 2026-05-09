# Enterprise Production Checklist: React Native + Expo + Expo Router

A senior-engineer reference covering hidden production issues, real-world edge cases, and enterprise-grade solutions that teams routinely miss. Every item is something I've personally seen blow up in production or in pre-launch reviews of large RN apps.

**Severity legend**: 🔴 Critical (blocks release / data loss / security) · 🟠 High (degrades experience or reliability for many users) · 🟡 Medium (affects subset, recoverable) · 🟢 Low (polish / hygiene)

---

## 1. Expo Router Architecture

### 1.1 `_layout.tsx` files re-mount entire subtrees on prop changes
- **Commonly Missed Problem**: Putting providers, query clients, or auth state derivations *inside* a `_layout.tsx` that itself depends on changing state.
- **Why It Happens**: Devs treat `_layout` like a regular component. When the layout's parent re-renders (e.g. auth state flips), the entire route subtree under it unmounts and remounts.
- **Production Impact**: Lost form state, refetched queries, dropped websocket subscriptions, broken in-progress flows.
- **Real Scenario**: User in the middle of a multi-step onboarding form. Auth context refreshes the JWT in the background, root `_layout` re-evaluates, and the user is teleported back to step 1 with all input lost.
- **Severity**: 🔴
- **Enterprise Solution**: Hoist all stable providers (QueryClient, Redux/Zustand store, theme, i18n) above the router in the root `app/_layout.tsx` and ensure they only construct once via module-level singletons or `useMemo` with empty deps. Keep `_layout` files dumb.
- **Best Practice**: Use `(group)` segments to scope auth-gated subtrees. Auth gating should be a `<Redirect>` inside the gated group's layout, never a conditional render of `<Stack>` itself.

### 1.2 Typed routes are opt-in and silently broken
- **Commonly Missed Problem**: Not enabling `experiments.typedRoutes` in `app.config.ts`, so every `router.push('/profile/123')` is a stringly-typed footgun.
- **Why It Happens**: Default is off. Teams forget after upgrading.
- **Production Impact**: Refactors silently break navigation. Renaming `app/order/[id].tsx` doesn't trigger TS errors at call sites.
- **Real Scenario**: A route renamed from `/checkout` to `/cart/checkout`, three deep links continued pointing to `/checkout`, users saw a blank not-found screen for two weeks before someone noticed in Sentry.
- **Severity**: 🟠
- **Enterprise Solution**: Enable typed routes, fail CI on `any` in router calls, wrap `router.push` in a project-local helper that takes a discriminated union of route names.
- **Best Practice**: Codegen a `Routes.ts` constants file from the file system tree; ban string-literal routes via ESLint custom rule.

### 1.3 Initial URL is dropped when the app cold-starts from a deep link before JS is ready
- **Commonly Missed Problem**: Splash screen hidden too early, or `Linking.getInitialURL()` not awaited before navigation tree mounts.
- **Why It Happens**: Expo Router handles initial URL automatically *most* of the time, but custom auth gates or hydration logic that calls `router.replace()` during mount race with the linking handler.
- **Production Impact**: Users tap a notification → app opens → land on home instead of the deep-linked screen.
- **Real Scenario**: Marketing campaign sends 100K push notifications with deep links to a sale page. Cold-start users see home; warm-start users see the page. Conversion data is corrupted, attribution broken.
- **Severity**: 🔴
- **Enterprise Solution**: Gate `SplashScreen.hideAsync()` behind a state machine that includes "auth resolved", "initial data hydrated", AND "initial URL processed". Defer your own `router.replace` calls until after `useRootNavigationState()` reports ready.
- **Best Practice**: Centralize startup orchestration in a single `<RootGate>` component above `<Slot />`; never call navigation imperatively during the first render pass.

### 1.4 Modals stacked on tabs lose presentation context
- **Commonly Missed Problem**: Declaring modal routes inside a tab's stack instead of the root stack.
- **Why It Happens**: File system layout maps to navigator hierarchy more rigidly than people expect.
- **Production Impact**: Modal appears constrained to a tab, tab bar leaks through, swipe-to-dismiss fights with tab gestures, presentation styles silently degrade.
- **Real Scenario**: Payment confirmation modal under a tab — user accidentally swipes the tab bar mid-transaction, modal dismisses with a half-completed state.
- **Severity**: 🟠
- **Enterprise Solution**: Modals always live in the root `app/_layout.tsx` stack with `presentation: 'modal'` (or `'formSheet'` on iOS for the new sheet detents). Use `(modals)` group convention.
- **Best Practice**: Document in your routing README a "where do new modals go" decision tree. Enforce in code review.

---

## 2. React Native Performance

### 2.1 FlatList misuse: anonymous renderItem and missing `getItemLayout`
- **Commonly Missed Problem**: `renderItem={({item}) => <Card item={item} />}` defined inline; no `getItemLayout`; `keyExtractor` returning index.
- **Why It Happens**: Looks fine in dev with 20 items. Production lists have 5,000.
- **Production Impact**: Janky scroll, dropped frames, scroll-to-index broken, virtualization thrashing.
- **Real Scenario**: Activity feed with 2K rows. Users on Android One devices report "the app freezes when I scroll fast." Crash analytics show RAM pressure kills.
- **Severity**: 🟠
- **Enterprise Solution**: Migrate hot lists to `@shopify/flash-list` with `estimatedItemSize`. Memoize row components with `React.memo` and stable prop equality. Stable keys from server IDs, never index. Hoist `renderItem` out of the parent.
- **Best Practice**: Lint rule banning inline `renderItem`. Performance budget: any list >50 items must use FlashList with measured `estimatedItemSize`.

### 2.2 Hermes assumed enabled, actually disabled in one platform
- **Commonly Missed Problem**: Hermes flipped on for iOS but JSC quietly stays on Android (or vice versa) after a bare-workflow eject or a misconfigured `app.config.ts`.
- **Why It Happens**: Plugin/config drift between platforms isn't surfaced.
- **Production Impact**: 2-3x worse cold start on the broken platform, larger bundle, broken source maps for one OS in Sentry.
- **Real Scenario**: Engineering team optimizes for iOS; Android startup is 4 seconds; PM blames "Android being slow"; nobody checks `global.HermesInternal != null`.
- **Severity**: 🟠
- **Enterprise Solution**: Add a startup invariant logging `engine: hermes|jsc` to your observability tool. Fail CI if it's not Hermes.
- **Best Practice**: Codify engine choice in `app.config.ts` and in EAS build profiles, not in native files.

### 2.3 Reanimated worklets accidentally crossing the JS thread
- **Commonly Missed Problem**: Capturing JS-thread state inside a worklet without `runOnJS` / `useSharedValue`, or reading shared values outside the worklet causing implicit sync.
- **Why It Happens**: API looks like normal closures.
- **Production Impact**: Animations stutter, UI thread blocks, gestures lag, especially on lower-end Android.
- **Real Scenario**: Bottom sheet drag gesture reads from Zustand store inside `useAnimatedStyle` — every frame the worklet bridges to JS, dragging at 15fps on mid-tier Pixels.
- **Severity**: 🟠
- **Enterprise Solution**: Treat worklet boundaries as a hard architectural seam. State that animations need lives in shared values; mutations from JS go through `runOnUI`. Add `'worklet'` directive explicitly even when inferable.
- **Best Practice**: Code review checklist item: "Does this worklet touch any closure variable from JS?" If yes, refactor.

### 2.4 Image loading without dimensions, caching policy, or priority
- **Commonly Missed Problem**: Using bare `<Image source={{uri}}>` for remote images with no width/height props, no caching headers respected, no priority hints.
- **Why It Happens**: Works in dev where one image loads at a time.
- **Production Impact**: Layout thrash, scroll jank, double-fetches, unbounded memory cache, cellular data burn.
- **Real Scenario**: Product grid with 100 thumbnails — first scroll is fine, scroll back up and every image refetches because the cache evicted under pressure on a 3GB-RAM device.
- **Severity**: 🟠
- **Enterprise Solution**: Standardize on `expo-image`. Set explicit `contentFit`, `transition`, `cachePolicy='memory-disk'`, and `priority`. Always provide dimensions or aspect ratio.
- **Best Practice**: Wrapper component `<AppImage>` enforcing all defaults. Server returns image dimensions in the API response so layout is stable before load.

---

## 3. Offline-First Architecture

### 3.1 Optimistic updates without rollback on failure
- **Commonly Missed Problem**: UI updates immediately; network request fails; UI never reverts; no reconciliation when sync eventually retries.
- **Why It Happens**: Happy-path coding. Mutation libraries make optimism easy and rollback an afterthought.
- **Production Impact**: Local state diverges from server; user sees ghost data; subsequent sync overwrites real changes.
- **Real Scenario**: Field service tech marks a job complete offline. The mutation fails silently when connectivity returns due to a stale token. Tech goes home. Next day, dispatcher sees the job still open. Customer charged twice.
- **Severity**: 🔴
- **Enterprise Solution**: Every mutation has (a) optimistic apply, (b) durable queue entry, (c) explicit rollback handler that re-runs invariant checks, (d) user-visible "out of sync" indicator if the queue can't drain. Rollbacks must be idempotent.
- **Best Practice**: Use a CRDT-friendly model where possible (Yjs, Automerge) or a well-tested queue like WatermelonDB / PowerSync / Replicache rather than rolling your own.

### 3.2 Last-write-wins as the default conflict policy
- **Commonly Missed Problem**: Two devices edit the same record offline; whoever syncs last wins; the other user's edits silently disappear.
- **Why It Happens**: Easiest to implement. Often the only thing the team thinks through.
- **Production Impact**: Data loss, user trust collapse.
- **Real Scenario**: Two nurses on the same shift edit a patient note offline. One wins, the other's clinical observation is lost. Compliance incident.
- **Severity**: 🔴
- **Enterprise Solution**: Field-level merge with vector clocks, server-authoritative conflict detection that returns a 409 with both versions, and an explicit user-facing resolver UI for non-mergeable conflicts. Or use CRDTs for collaborative fields.
- **Best Practice**: Document conflict policy *per entity type* in your data model. Some entities can be LWW (user preferences); some need merge (notes); some need server reconciliation (financials).

### 3.3 Client-generated IDs not used for new records
- **Commonly Missed Problem**: Creating new records offline that need server IDs to reference.
- **Why It Happens**: Devs default to "the server assigns IDs."
- **Production Impact**: Can't link related records offline (e.g. line items to an order that hasn't synced); foreign key chaos when sync resolves.
- **Real Scenario**: User creates an order with 5 line items offline. Order syncs, gets ID 1234. Line items still reference temp ID -1, now orphaned.
- **Severity**: 🟠
- **Enterprise Solution**: Use UUIDv7 or ULID generated client-side. Server accepts the client ID as canonical. Store an `id_remote` column for server's ID if it differs (avoid this if possible).
- **Best Practice**: All primary keys are client-generated UUIDs. Period.

### 3.4 Storage quota and backup behavior unmanaged
- **Commonly Missed Problem**: Local DB grows unbounded; iOS backs it up to iCloud (counts against user quota); Android may purge it under pressure.
- **Why It Happens**: Defaults are wrong for offline-first apps.
- **Production Impact**: Apple/Google warnings, user 1-star reviews about iCloud space, unexpected data wipes.
- **Real Scenario**: Field app stores 800MB of cached photos. iCloud backups balloon. User deletes the app to free space, loses all unsynced work.
- **Severity**: 🟠
- **Enterprise Solution**: Mark cache directories with `NSURLIsExcludedFromBackupKey` (iOS) and use `cacheDir` not `filesDir` (Android). LRU eviction policy with hard ceiling. Warn user before they hit it.
- **Best Practice**: Separate `data` (synced, backed up) from `cache` (regenerable, never backed up) at the filesystem level from day one.

---

## 4. Sync Engine Design

### 4.1 No idempotency keys on mutations
- **Commonly Missed Problem**: Retries create duplicates because the server treats the second POST as a new operation.
- **Why It Happens**: Most REST tutorials don't mention idempotency.
- **Production Impact**: Duplicate orders, duplicate charges, duplicate notifications.
- **Real Scenario**: Phone loses signal mid-payment, retries on reconnect, server processes both. Customer charged twice. Refund + manual reconciliation + churn.
- **Severity**: 🔴
- **Enterprise Solution**: Every mutation carries a UUID `Idempotency-Key` header. Server stores key+result for 24-72h, returns cached result on replay. Client persists the key with the queued mutation.
- **Best Practice**: API contract requires idempotency key on every non-GET. Reject without it in staging. Strip and warn in prod for backwards compat.

### 4.2 Sync storms after long offline periods
- **Commonly Missed Problem**: User offline for a week reconnects → app fires 3,000 queued requests in parallel → server rate-limits → retries pile up → exponential meltdown.
- **Why It Happens**: Naive "drain the queue" loop with no concurrency control.
- **Production Impact**: Server-side incidents, user-side battery drain and freeze, sync never completes.
- **Real Scenario**: Field crew returns from a week in a no-signal zone. 50 trucks reconnect simultaneously, 150K queued operations hit the API in 30 seconds, autoscaler can't keep up, cascading failure.
- **Severity**: 🔴
- **Enterprise Solution**: Bounded concurrency (e.g. 4 parallel), exponential backoff with jitter on 429/5xx, server-side bulk endpoints for sync drains, client-side priority lanes (auth/critical first, telemetry last).
- **Best Practice**: Load-test sync with a worst-case backlog × peak users. Have a server-side kill switch to throttle sync globally during incidents.

### 4.3 Tombstones missing for deletions
- **Commonly Missed Problem**: Deleting a record locally just removes the row; sync engine has no way to tell server "this was deleted."
- **Why It Happens**: Delete-as-DELETE is the obvious model and obviously wrong for offline.
- **Production Impact**: Deleted records resurrect on next pull; user deletes again; cycle continues.
- **Real Scenario**: User deletes a sensitive note offline. Sync pulls fresh data from server, note reappears. User assumes it never deleted, deletes again. Repeat. Eventually the user complains the app is "broken."
- **Severity**: 🟠
- **Enterprise Solution**: Soft-delete with `deleted_at` timestamps and `version` numbers. Sync engine reconciles by comparing versions. Hard delete only after server confirms.
- **Best Practice**: Every syncable table has `created_at`, `updated_at`, `deleted_at`, `version`, `client_id`, `server_id`.

### 4.4 Order of operations not preserved
- **Commonly Missed Problem**: Queue replays mutations in arrival order, not causal order, so "create then update" can become "update then create" → 404.
- **Why It Happens**: Queue is a flat FIFO without dependency tracking.
- **Production Impact**: Mutation failures, partial state, manual cleanup.
- **Real Scenario**: User creates a project, adds three tasks, deletes one task. Network returns. Task delete syncs first (fails, project doesn't exist on server), then create project, then create tasks (one orphaned).
- **Severity**: 🟠
- **Enterprise Solution**: Queue entries declare dependencies (e.g. "this PATCH depends on POST X"). Sync runner topologically sorts before draining. On failure, dependent operations fail-fast and re-queue together.
- **Best Practice**: Model the queue as a DAG, not a list.

---

## 5. State Management

### 5.1 Persisted state hydration races first render
- **Commonly Missed Problem**: Zustand/Redux persist hydrates async; first render uses defaults; UI flickers; navigation decisions made on stale state.
- **Why It Happens**: Hydration is async, render is sync.
- **Production Impact**: Flash of logged-out UI for logged-in users; redirect loops; analytics events for "logged out → logged in" that never happened.
- **Real Scenario**: Splash hides → root layout sees `isAuthenticated: false` (default) → redirects to /login → hydration completes 50ms later with `isAuthenticated: true` → redirects back. User sees a flash and analytics records a fake login.
- **Severity**: 🟠
- **Enterprise Solution**: Block render (or stay on splash) until persist `onFinishHydration` fires. Provide a `useHydrated()` hook used by the root gate.
- **Best Practice**: Splash screen state machine includes "store hydrated" as a required precondition.

### 5.2 Persisted state migrations not versioned
- **Commonly Missed Problem**: Shape of persisted state changes; old users hit a deserialization error on next app open; app crashes on launch.
- **Why It Happens**: Tests use fresh state. QA wipes their app between builds. Real users have last year's state shape.
- **Production Impact**: Cold-start crash for users who skipped a few versions; only fix is uninstall + reinstall = lost local data.
- **Real Scenario**: Renamed `user.profile.avatar` to `user.profile.avatarUrl`. Selectors crash on undefined. 8% of installs crash on launch. App Store rating collapses.
- **Severity**: 🔴
- **Enterprise Solution**: Versioned persist with explicit migration functions for every shape change. Migrations chained for users on very old versions. Schema validation on load with safe fallback to defaults + bug report.
- **Best Practice**: Store schema version with the state. Reject and reset (with telemetry) any state that fails schema validation rather than crashing.

### 5.3 Context API used as global state
- **Commonly Missed Problem**: Stuffing app-wide state in Context; every consumer re-renders on every change.
- **Why It Happens**: Context is built-in and looks free.
- **Production Impact**: Wide re-render cascades, frame drops, lists re-rendering on unrelated state changes.
- **Real Scenario**: Theme + auth + user prefs + cart all in one Context. Toggle dark mode → entire app re-renders → 10K-row list re-renders → 2-second freeze.
- **Severity**: 🟠
- **Enterprise Solution**: Use Context for *stable* values only (DI containers, theme tokens). Use Zustand/Jotai for reactive state with selector-level subscriptions.
- **Best Practice**: One rule: if the value changes more than once per session, it doesn't go in Context.

---

## 6. Authentication & Security

### 6.1 Tokens stored in AsyncStorage
- **Commonly Missed Problem**: JWTs / refresh tokens in `AsyncStorage` (or `expo-secure-store` on a misconfigured platform).
- **Why It Happens**: It's the first storage devs reach for.
- **Production Impact**: On a rooted/jailbroken device, tokens are trivially extracted. On iOS, AsyncStorage is unencrypted plist files.
- **Real Scenario**: Penetration test surfaces tokens via `adb pull` on a debug-installed Android build. Audit fails. Compliance blocks launch.
- **Severity**: 🔴
- **Enterprise Solution**: `expo-secure-store` (Keychain/Keystore-backed) for all credentials. Never log them. Never write them to AsyncStorage even for migration — re-auth instead.
- **Best Practice**: Add a startup assertion that scans AsyncStorage keys for known token-shaped strings and clears + reports.

### 6.2 Token refresh race conditions
- **Commonly Missed Problem**: Five parallel API calls all hit a 401, all fire a refresh, server invalidates the refresh token after first use → four out of five subsequent requests fail → user logged out.
- **Why It Happens**: Each request handles 401 in isolation.
- **Production Impact**: Random forced logouts, especially on screens that fan out requests (dashboards).
- **Real Scenario**: Dashboard fires 6 widgets → token has just expired → all see 401 → 6 refresh attempts → 5 get HTTP 401 (refresh token already burned) → user kicked.
- **Severity**: 🟠
- **Enterprise Solution**: Single-flight refresh — the first 401 starts a refresh promise, all other 401s await it, then retry. Use a mutex. Refresh tokens should ideally be reusable within a short window or use rotating refresh with grace period.
- **Best Practice**: Build refresh logic into the HTTP client (interceptor), never per-feature.

### 6.3 Deep links bypass authentication
- **Commonly Missed Problem**: Deep link to `/order/123` opens the screen even when not logged in; screen calls API; API returns 401; user sees broken state instead of login.
- **Why It Happens**: Auth gate only protects the navigator's initial route.
- **Production Impact**: Confusing UX, error screens, lost intent on login (they never get back to /order/123).
- **Real Scenario**: Push notification deep link to a chat. User logged out. Chat screen renders empty, errors, user closes app, never logs in.
- **Severity**: 🟠
- **Enterprise Solution**: Auth guard at the layout level intercepts unauthenticated access, persists the intended deep link, redirects to login, then resumes original navigation post-auth.
- **Best Practice**: All deep links route through a single `IntendedDestination` queue. Login flow always pops it on success.

### 6.4 No certificate / public-key pinning
- **Commonly Missed Problem**: App trusts any cert in the device trust store, including user-installed ones (corporate proxies, MITM tooling).
- **Why It Happens**: SSL pinning is non-default and breaks easily.
- **Production Impact**: API responses can be intercepted/modified; custom auth flows hijacked; data exfiltration on compromised networks.
- **Real Scenario**: Conference WiFi runs a MITM proxy with a fake cert; users see app "working normally" while requests go through attacker's server.
- **Severity**: 🟠 (Critical for finance/health)
- **Enterprise Solution**: Public-key pinning (not cert pinning — keys rotate slower) via native modules or react-native-ssl-pinning, with a backup pin and a remote kill-switch in case of emergency rotation.
- **Best Practice**: Pin the intermediate CA's public key, not the leaf cert. Test the rotation procedure quarterly.

---

## 7. API Layer

### 7.1 Requests not cancelled on unmount
- **Commonly Missed Problem**: Component unmounts mid-fetch; response arrives; setState on unmounted component; or worse, navigation happens during the response handler.
- **Why It Happens**: Devs don't wire AbortController consistently.
- **Production Impact**: Memory leaks, "can't update unmounted component" warnings, stale data overwriting fresh data after fast navigation.
- **Real Scenario**: User taps profile A, then quickly profile B. Profile A's response arrives last, overwriting profile B's data. User sees A's info under B's name.
- **Severity**: 🟠
- **Enterprise Solution**: Use TanStack Query (handles this automatically with query keys) or wire AbortController + cleanup in every effect. Race-safe by query key, not by component.
- **Best Practice**: No raw `fetch` in components. All network through a query layer with first-class cancellation.

### 7.2 No network-aware request strategy
- **Commonly Missed Problem**: Same retry/timeout policy on cellular and WiFi. Same image quality. Same prefetch aggressiveness.
- **Why It Happens**: Network detection is a separate concern that gets bolted on later (or never).
- **Production Impact**: Background prefetches eat cellular data; users hit data cap; reviews complain about data usage.
- **Real Scenario**: Image-heavy app prefetches HD thumbnails on cellular. Users on metered plans see 1GB/day usage. Carrier complaints, app pulled in some regions.
- **Severity**: 🟡
- **Enterprise Solution**: `expo-network` / NetInfo to detect connection type. Throttle prefetches and degrade image quality on cellular. User setting for "data saver mode."
- **Best Practice**: Treat network type as first-class state in a global context; UI components react to it.

### 7.3 No request deduplication
- **Commonly Missed Problem**: Two components mount, both call `getUserProfile()`, two requests fly.
- **Why It Happens**: Each component is "self-contained."
- **Production Impact**: Doubled API load, doubled latency, race conditions on the response handlers.
- **Real Scenario**: A header avatar and a profile card both render on home. Both request user. Server cost doubles for no gain.
- **Severity**: 🟡
- **Enterprise Solution**: TanStack Query / SWR / Apollo handle this via query keys / normalized cache. If hand-rolling, an in-flight request map keyed by URL+method+body.
- **Best Practice**: Never have two code paths fetch the same resource directly; both go through the same query.

---

## 8. Mobile App Lifecycle

### 8.1 No handling of "killed by OS" state restoration
- **Commonly Missed Problem**: iOS suspends, then evicts the app under memory pressure. User taps icon, app cold-starts, all in-memory state lost. App does not restore where the user was.
- **Why It Happens**: Devs test by force-quitting, not by waiting hours.
- **Production Impact**: User on step 4 of 7 form returns from a phone call → restart → back to home → abandons.
- **Real Scenario**: Long-form medical intake. Patient gets a call mid-form. App is evicted (it was using a lot of memory for camera capture). Patient returns, sees blank form, gives up.
- **Severity**: 🟠
- **Enterprise Solution**: Persist navigation state and form drafts continuously (debounced) to encrypted storage. On cold start, detect "was the previous session unfinished?" and offer to resume.
- **Best Practice**: Every multi-step flow has a draft autosave layer. Always.

### 8.2 AppState transitions not used to refresh stale data
- **Commonly Missed Problem**: User backgrounds the app for 4 hours, returns to a stale screen. No revalidation triggered.
- **Why It Happens**: Devs only think "mount = fetch."
- **Production Impact**: Stale prices, stale availability, stale notifications, decisions made on old data.
- **Real Scenario**: Travel app, user opens flight prices, locks phone for 2 hours, returns and books — price has changed but UI still shows old. Refund + complaint.
- **Severity**: 🟠
- **Enterprise Solution**: Listen to `AppState` `active` transitions; mark queries stale based on time-since-background; let TanStack Query refetch on focus.
- **Best Practice**: Configure global `staleTime` per query type. Critical real-time data has near-zero stale time.

### 8.3 iOS memory warnings ignored
- **Commonly Missed Problem**: No handler for low-memory notifications; app gets killed silently.
- **Why It Happens**: RN doesn't expose this prominently.
- **Production Impact**: Users perceive crashes; analytics show "app exited normally" but UX is broken.
- **Real Scenario**: Photo-heavy gallery, user scrolls through 200 photos, OS sends memory warning, app evicted, user returns to home.
- **Severity**: 🟡
- **Enterprise Solution**: Native module bridge for `didReceiveMemoryWarning` (iOS) / `onTrimMemory` (Android). On warning: drop image caches, abort prefetches, GC observable buffers.
- **Best Practice**: Memory pressure is a first-class signal. Cache layers must subscribe to it.

---

## 9. Deep Linking

### 9.1 Universal Links / App Links not properly hosted
- **Commonly Missed Problem**: AASA (`apple-app-site-association`) or `assetlinks.json` files served with wrong content type, behind a redirect, or without HTTPS.
- **Why It Happens**: Hosted by web/marketing team without coordination.
- **Production Impact**: Deep links open in Safari/Chrome instead of the app, killing every campaign and email link.
- **Real Scenario**: Email campaign with deep links — every click opens the website not the app — conversion drops 40% — engineering tells marketing "must be a server config issue" — finger pointing for two weeks.
- **Severity**: 🔴
- **Enterprise Solution**: Validate AASA via Apple's tool and `assetlinks.json` via Google's. Add automated CI check that hits the production URLs and validates the JSON + headers. Add to release checklist.
- **Best Practice**: Own the hosting in your own infra (not marketing CMS). Treat AASA/assetlinks as code, version-controlled, deployed alongside the app.

### 9.2 Cold-start vs warm-start deep link routing diverges
- **Commonly Missed Problem**: Warm-start deep links work; cold-start fires before nav tree is ready and is dropped.
- **Why It Happens**: Different code paths handle them.
- **Production Impact**: Inconsistent UX, untraceable user reports.
- **Real Scenario**: QA tests warm-start (tap notification while app is in foreground), works fine. Real users tap notifications from cold-start, lands on home.
- **Severity**: 🟠
- **Enterprise Solution**: One deep link handler, fed by both `Linking.getInitialURL()` and the `Linking` event. Buffer until nav tree is ready, then drain.
- **Best Practice**: QA matrix includes: cold start, warm start (foreground), warm start (background), background-then-killed.

### 9.3 Deferred deep links and install attribution missing
- **Commonly Missed Problem**: User clicks a marketing link, gets sent to the App Store, installs the app, opens it — no context about why they installed.
- **Why It Happens**: iOS/Android don't natively support deferred deep links.
- **Production Impact**: Onboarding can't personalize, marketing attribution broken, referral codes lost.
- **Real Scenario**: Influencer campaign sends users to download with a personalized welcome flow. App opens to generic onboarding. Conversion drops.
- **Severity**: 🟠
- **Enterprise Solution**: Branch.io, AppsFlyer, or build with a "hold the URL on the web → match by IP+UA fingerprint on first open" approach. Apple's SKAdNetwork / Google's Install Referrer for clean attribution.
- **Best Practice**: Choose a single attribution provider and integrate from day one — retrofitting is painful.

---

## 10. Push Notifications

### 10.1 Push token rotation not handled
- **Commonly Missed Problem**: Token sent to server on first launch; never updated when it rotates (FCM rotates on app reinstall, restore, or token refresh events).
- **Why It Happens**: Devs see token registration as one-time.
- **Production Impact**: Users silently stop receiving notifications. Re-engagement drops with no error visible to the team.
- **Real Scenario**: User restores phone from backup → FCM token regenerates → app never re-registers → user assumes notifications are off and disables them in settings.
- **Severity**: 🟠
- **Enterprise Solution**: Subscribe to token-refresh events; sync token on every app foreground if last sync >24h; deduplicate server-side.
- **Best Practice**: Server-side cleanup job removes tokens that have failed to deliver N times.

### 10.2 Notification permission decline path neglected
- **Commonly Missed Problem**: Permission asked at launch, user declines, app behaves as if user will eventually accept; no path to re-prompt.
- **Why It Happens**: First-prompt UX is the only path tested.
- **Production Impact**: Permanent loss of notification channel for a large user segment; iOS will never re-prompt; user must go to Settings.
- **Real Scenario**: 60% decline rate at first launch; engagement metrics tank; team realizes there's no in-app prompt to send users to Settings.
- **Severity**: 🟠
- **Enterprise Solution**: Don't ask at launch — ask after a value moment (priming screen). If declined, surface a soft re-engagement banner at the right moment with a deep link to Settings.
- **Best Practice**: Track permission state changes; segment cohorts by permission state; have a re-engagement strategy for declined users.

### 10.3 Silent push limits and reliability assumed
- **Commonly Missed Problem**: Treating silent push (`content-available`) as a reliable background trigger.
- **Why It Happens**: It works in dev. In prod, iOS throttles aggressively (no more than 2-3/hour, less in low-power mode).
- **Production Impact**: Sync-on-push doesn't fire; users see stale data until they open the app.
- **Real Scenario**: Real-time chat relies on silent push to wake the app and pull. iOS throttles → users miss messages → competitor wins.
- **Severity**: 🟠
- **Enterprise Solution**: Don't rely on silent push for delivery — use it as a hint. Combine with in-app polling on focus. For urgent delivery, use visible notifications + tap-to-sync.
- **Best Practice**: Architecture assumes silent push is best-effort. Always have a foreground sync path that catches missed updates.

### 10.4 Notification tap handling drops the deep link payload
- **Commonly Missed Problem**: Notification handler fires before navigator is mounted, payload is lost; or handler fires twice (once from `onNotificationOpenedApp`, once from cold start).
- **Why It Happens**: Multiple delivery paths, devs only handle one.
- **Production Impact**: Tapping the notification opens the app to home, not the relevant screen.
- **Real Scenario**: Order-update notification, tap, app opens home, user has to navigate to orders manually. Engagement metric for "notification → action" drops.
- **Severity**: 🟠
- **Enterprise Solution**: Single notification-routing module that handles both initial-notification and tap events, dedupes by notification ID, queues until nav is ready.
- **Best Practice**: Notifications have a `route` field in their data payload. Routing module is dumb: read field, navigate. No business logic.

---

## 11. Background Tasks

### 11.1 Treating `expo-background-fetch` as reliable
- **Commonly Missed Problem**: Scheduling a 15-minute background fetch and assuming it runs every 15 minutes.
- **Why It Happens**: API names imply scheduling. Reality is "best effort, OS decides."
- **Production Impact**: Sync runs once a day on iOS in low-power mode; never runs on Android with battery optimization on; user data feels stale.
- **Real Scenario**: Inventory sync supposed to run hourly. Actually runs ~2x/day. Stock data is wrong. Sales rep sells items that aren't in stock.
- **Severity**: 🟠
- **Enterprise Solution**: Background fetch is a hint, not a contract. For required work, use server-driven push wakeups + foreground sync on focus. Telemetry on actual fetch execution to set realistic expectations.
- **Best Practice**: Never tell users "data syncs every X minutes." Tell them when it last synced.

### 11.2 Android battery optimization breaking foreground services
- **Commonly Missed Problem**: Long-running tracking (location, audio) killed silently when device enters Doze or battery optimization is on for the app.
- **Why It Happens**: Doze and OEM-specific battery savers (Xiaomi, Huawei, Oppo are notorious) aggressively kill background work.
- **Production Impact**: Run-tracking apps lose route data; delivery apps lose driver location; users blame the app.
- **Real Scenario**: Delivery driver's app stops reporting location after 20 min on a Xiaomi device. Dispatcher loses visibility. Customer complains about late delivery.
- **Severity**: 🔴 (for tracking apps)
- **Enterprise Solution**: Foreground service with persistent notification (Android), guide users through OEM-specific battery whitelist setup with `dontkillmyapp.com`-style instructions. iOS: significant location changes API + region monitoring.
- **Best Practice**: Detect OEM, surface OEM-specific instructions in onboarding for known-bad devices.

### 11.3 iOS BGTask quotas and registration timing
- **Commonly Missed Problem**: BGTask identifiers must be declared in Info.plist and registered before `application:didFinishLaunching` returns. Miss the timing → tasks never run.
- **Why It Happens**: Subtle, easy to miss in EAS config.
- **Production Impact**: Background tasks silently never execute in production builds even though they work in dev.
- **Real Scenario**: BGTask works in TestFlight (debug-signed), doesn't work in App Store build. No errors. Engineering loses days chasing it.
- **Severity**: 🟠
- **Enterprise Solution**: Identifiers in `app.config.ts` under `ios.infoPlist.BGTaskSchedulerPermittedIdentifiers`, registration in the native module's earliest entry. Smoke test BG tasks in TestFlight before every release.
- **Best Practice**: Add a hidden debug screen showing "last BG task run" timestamp for QA verification.

---

## 12. OTA Updates

### 12.1 OTA pushed with native code mismatch
- **Commonly Missed Problem**: JS bundle published via EAS Update references a native module added in the latest build; users on previous build get a runtime crash.
- **Why It Happens**: `runtimeVersion` policy not set or set incorrectly.
- **Production Impact**: Mass crash on launch for users whose binary is one version behind.
- **Real Scenario**: Engineer adds a native module, ships JS via OTA, doesn't bump binary. Anyone who hadn't updated the App Store version sees an instant crash.
- **Severity**: 🔴
- **Enterprise Solution**: `runtimeVersion: { policy: "appVersion" }` or fingerprinted runtime versions. EAS Update will only deliver to compatible binaries.
- **Best Practice**: Adding any native dep must bump runtime version. Codify in PR template.

### 12.2 No staged rollout / canary for OTA
- **Commonly Missed Problem**: OTA published to 100% of users immediately; bad bundle = instant global brick.
- **Why It Happens**: EAS Update defaults are easy and unsafe.
- **Production Impact**: A bad JS bundle is far more dangerous than a bad binary because every user gets it within hours.
- **Real Scenario**: OTA shipped with a typo'd auth header. Every user who launches the app in the next 6 hours is logged out. Support overwhelmed.
- **Severity**: 🔴
- **Enterprise Solution**: Publish to a `canary` channel first → 5% of users via channel rollout → monitor crash + error rates for 2-4h → promote to full rollout. Or use EAS Update's rollout feature.
- **Best Practice**: Define a SLO for OTA rollouts: "if crash rate > X% above baseline within 30 min, automatic rollback."

### 12.3 Apple's compliance line for OTA
- **Commonly Missed Problem**: Pushing significantly new functionality via OTA in violation of App Store guideline 4.7.
- **Why It Happens**: It's tempting and there's no automatic enforcement.
- **Production Impact**: App pulled from store on detection. Reviews can take weeks.
- **Real Scenario**: Team uses OTA to ship a brand-new feature post-review to skip review queue. Apple notices on next submission, app gets a warning + extended review.
- **Severity**: 🟠
- **Enterprise Solution**: OTA only for bug fixes and tweaks within the scope of what the binary does. New features go through review.
- **Best Practice**: Document OTA-eligible vs binary-only changes in release process.

---

## 13. Android-Specific Problems

### 13.1 Hardware back button not handled in modals/forms
- **Commonly Missed Problem**: Hardware back closes modals abruptly without confirming unsaved changes; or exits app from a deep navigation stack.
- **Why It Happens**: Devs work on iOS first.
- **Production Impact**: Lost user input, abrupt exits, dirty form data discarded.
- **Real Scenario**: User filling a 10-field form, hits hardware back, form gone. Rage-uninstall.
- **Severity**: 🟠
- **Enterprise Solution**: `BackHandler.addEventListener` per screen with dirty-state guards; double-tap-to-exit on root tabs.
- **Best Practice**: Reusable `useUnsavedChangesGuard()` hook that intercepts both hardware back and gesture back.

### 13.2 Android 13+ notification permission not requested
- **Commonly Missed Problem**: Targeting SDK 33+ requires explicit `POST_NOTIFICATIONS` permission; without it, no notifications.
- **Why It Happens**: Older RN/Expo guides predate this.
- **Production Impact**: Push notifications silently disabled for Android 13+ users (now the majority).
- **Real Scenario**: Update raises target SDK, push delivery rate drops 50% on Android, takes a week to diagnose.
- **Severity**: 🟠
- **Enterprise Solution**: Request permission post-onboarding via `expo-notifications`; handle decline gracefully.
- **Best Practice**: Telemetry on notification permission state per OS version; alarm when delivery rate drops.

### 13.3 KeyboardAvoidingView behaves differently
- **Commonly Missed Problem**: `behavior="padding"` works on iOS, breaks on Android; `behavior="height"` works on Android, broken on iOS; soft keyboard with adjustResize vs adjustPan.
- **Why It Happens**: Cross-platform abstraction is leaky.
- **Production Impact**: Inputs hidden behind keyboard, broken layouts.
- **Real Scenario**: Login form works on iOS, on Android the password field is hidden behind the keyboard.
- **Severity**: 🟡
- **Enterprise Solution**: Use `react-native-keyboard-controller` for consistent cross-platform keyboard behavior. Set `windowSoftInputMode="adjustResize"` in AndroidManifest.
- **Best Practice**: Centralize keyboard handling in a `<KeyboardAwareScreen>` wrapper component.

### 13.4 ProGuard/R8 stripping needed code in release
- **Commonly Missed Problem**: Reflection-based libraries (some serializers, native module bridges) stripped in release builds.
- **Why It Happens**: Debug builds skip shrinking.
- **Production Impact**: Crashes only in release, never in dev.
- **Real Scenario**: Internal QA passes (debug). Production release crashes on JSON parsing because data classes were obfuscated.
- **Severity**: 🟠
- **Enterprise Solution**: ProGuard rules for every native dep that uses reflection; smoke-test release builds in CI.
- **Best Practice**: Always test the actual release variant in EAS internal distribution before submitting.

---

## 14. iOS-Specific Problems

### 14.1 Safe area insets handled inconsistently
- **Commonly Missed Problem**: Some screens use `SafeAreaView`, some hardcode padding, some forget — different devices show layout drift.
- **Why It Happens**: Every device has different insets; engineers test on one model.
- **Production Impact**: Notch/Dynamic Island/home indicator overlap; cropped buttons.
- **Real Scenario**: New iPhone Pro releases with Dynamic Island; status bar overlaps app header on every screen.
- **Severity**: 🟡
- **Enterprise Solution**: `react-native-safe-area-context` everywhere. Wrapper screen component that always applies insets correctly.
- **Best Practice**: QA matrix includes smallest device (SE) and largest with Dynamic Island.

### 14.2 App Tracking Transparency prompt missing or wrong copy
- **Commonly Missed Problem**: Not requesting ATT before initializing analytics SDKs that use IDFA.
- **Why It Happens**: ATT is a separate prompt from notifications, easy to overlook.
- **Production Impact**: All IDFA-based attribution dies, ad spend metrics go dark.
- **Real Scenario**: App ships, marketing notices conversion attribution dropped to zero on iOS, two weeks of campaign spend wasted.
- **Severity**: 🟠
- **Enterprise Solution**: Request ATT at the right moment (post-onboarding, not at launch — Apple may reject either timing if not justified). Block analytics SDK init until response.
- **Best Practice**: Clear, value-explaining ATT prompt copy. Test both grant and deny flows.

### 14.3 iCloud backup of unwanted data
- **Commonly Missed Problem**: Cache directories, large media, and SQLite WAL files all get backed up by default.
- **Why It Happens**: iOS defaults.
- **Production Impact**: Users hit iCloud quota; restore takes forever; reviews complain about iCloud usage.
- **Real Scenario**: Photo-heavy app caches 2GB. New phone restore takes 6 hours. User blames the app.
- **Severity**: 🟡
- **Enterprise Solution**: `NSURLIsExcludedFromBackupKey` for caches. Verify with iCloud size reporter in Settings.
- **Best Practice**: Add a "what gets backed up" doc; review on every new feature that writes to disk.

### 14.4 iPad multitasking / split view broken
- **Commonly Missed Problem**: App declares iPad support but layout breaks in split view, slide-over, stage manager.
- **Why It Happens**: Devs test full-screen.
- **Production Impact**: 1-star reviews from iPad users; rejection if Apple notices.
- **Real Scenario**: Submitted to App Store, rejected for "broken layout in 1/3 split view."
- **Severity**: 🟡
- **Enterprise Solution**: Either properly support adaptive layouts (use `useWindowDimensions` and design responsive screens) or declare iPhone-only and disable iPad.
- **Best Practice**: Decide iPad support intentionally. If yes, test all 4 split sizes.

---

## 15. Accessibility

### 15.1 Dynamic type ignored
- **Commonly Missed Problem**: Hardcoded font sizes; user enables Larger Text in Settings; layouts overflow or text is unreadable.
- **Why It Happens**: Designers spec in pixels.
- **Production Impact**: Excludes users with vision impairment; legal exposure in accessibility-mandated jurisdictions (US Section 508, EU EAA).
- **Real Scenario**: Healthcare app fails accessibility audit; major hospital won't deploy.
- **Severity**: 🟠
- **Enterprise Solution**: `allowFontScaling` defaults true; design for 200% scale; use `PixelRatio.getFontScale()` to clamp at extremes; never hardcode line height — use ratios.
- **Best Practice**: Accessibility settings emulated in CI screenshot tests.

### 15.2 No `accessibilityLabel` on icon-only buttons
- **Commonly Missed Problem**: Icon-only navigation/action buttons read as "button" by VoiceOver.
- **Why It Happens**: Visual-first development.
- **Production Impact**: Screen reader users can't navigate.
- **Real Scenario**: Hamburger menu reads "button button button button button"; visually impaired user can't use the app.
- **Severity**: 🟠
- **Enterprise Solution**: Lint rule requiring `accessibilityLabel` on `Pressable`/`TouchableOpacity` with no text children. Design system components require it as a prop.
- **Best Practice**: Audit with VoiceOver/TalkBack monthly. Include accessibility checks in PR template.

### 15.3 Reduce Motion ignored
- **Commonly Missed Problem**: Animations play at full intensity for users with motion sensitivity.
- **Why It Happens**: Animations are added late, accessibility considered after.
- **Production Impact**: Users with vestibular disorders can't use the app comfortably.
- **Real Scenario**: User leaves a 1-star review citing motion sickness from parallax scroll.
- **Severity**: 🟡
- **Enterprise Solution**: `AccessibilityInfo.isReduceMotionEnabled()` checked; animations gated by it. Reanimated provides utilities.
- **Best Practice**: All non-essential animations have a `respectReduceMotion` prop defaulting to true.

---

## 16. Animations & Gestures

### 16.1 Gesture handler conflicts in nested scroll views
- **Commonly Missed Problem**: Bottom sheet inside a scroll view, scroll view inside a horizontal pager — gestures fight.
- **Why It Happens**: RN's gesture system requires explicit composition.
- **Production Impact**: Drag the wrong thing; sheets close unexpectedly; pages don't swipe.
- **Real Scenario**: Bottom sheet drag also scrolls the list inside it; user can't drag the sheet down without scrolling the list to top first.
- **Severity**: 🟠
- **Enterprise Solution**: `react-native-gesture-handler` with explicit `simultaneousHandlers`/`waitFor` composition. Test on real devices.
- **Best Practice**: One library for all gestures (RNGH); never mix legacy PanResponder.

### 16.2 Animations not cleaned up on unmount
- **Commonly Missed Problem**: `Animated.timing(...).start()` runs on unmounted component; or Reanimated shared values not reset, retained in memory.
- **Why It Happens**: API doesn't force cleanup.
- **Production Impact**: Memory leaks, "can't update unmounted component" warnings, animations playing on hidden screens.
- **Real Scenario**: Loading spinner on a screen left during navigation continues to consume resources, contributing to slow scroll.
- **Severity**: 🟡
- **Enterprise Solution**: Always store animation handles in refs, cancel on unmount. Reanimated v3 handles this better but worklets capturing JS state can still leak.
- **Best Practice**: Custom hook `useAnimatedValue` that handles cleanup automatically.

---

## 17. Memory Management

### 17.1 Unbounded image cache
- **Commonly Missed Problem**: Image cache grows until OS kills the app.
- **Why It Happens**: Default cache policies in many libraries are aggressive.
- **Production Impact**: Crashes on long sessions, especially on low-RAM Android devices.
- **Real Scenario**: User browses 500 product images; cache grows to 400MB; app evicted; user blames slow phone.
- **Severity**: 🟠
- **Enterprise Solution**: `expo-image` with explicit cache size limits; LRU eviction; clear on memory warning.
- **Best Practice**: Cache size budget per app section; monitor cache size in telemetry.

### 17.2 Event listeners and subscriptions not cleaned up
- **Commonly Missed Problem**: `EventEmitter`, `NetInfo`, `AppState`, `Keyboard` listeners added in `useEffect` without cleanup; subscriptions accumulate on every navigation.
- **Why It Happens**: Easy to forget the cleanup function return.
- **Production Impact**: Multiple handlers fire for the same event; memory grows; old screen state mutated.
- **Real Scenario**: Push notification handler added on every screen mount; after navigating to 10 screens, one notification fires 10 handlers, navigation chaos.
- **Severity**: 🟠
- **Enterprise Solution**: ESLint `react-hooks/exhaustive-deps` plus a custom rule flagging known subscription APIs without returned cleanup.
- **Best Practice**: All subscriptions go through a hook that handles cleanup; never raw inside components.

### 17.3 WebView memory not released
- **Commonly Missed Problem**: WebView screens keep memory after navigation away; multiple WebViews stacked = OOM.
- **Why It Happens**: WebView is a heavy native view, not freed until the JS reference is GC'd, which may take a while.
- **Production Impact**: Crashes after browsing several embedded web pages.
- **Real Scenario**: SaaS app embedding documents — user opens 5 docs, app crashes.
- **Severity**: 🟡
- **Enterprise Solution**: Single shared WebView instance, navigated rather than recreated; explicit `incognito` mode; clear cache on unmount; never stack WebView screens.
- **Best Practice**: Treat WebView as a singleton resource.

---

## 18. Navigation Edge Cases

### 18.1 Back during async operation
- **Commonly Missed Problem**: User taps a button that fires async work, then immediately backs out. Async resolves, tries to navigate / show modal on a screen that's gone.
- **Why It Happens**: No cancellation of the work or guard before UI updates.
- **Production Impact**: Crashes, ghost modals, navigation stack corruption.
- **Real Scenario**: User taps "submit," screen does API call, user backs out, response arrives, modal pushed onto a different screen mid-transition.
- **Severity**: 🟠
- **Enterprise Solution**: Cancel pending work on screen blur; check `isMounted` / use AbortController; navigation actions guarded by `useNavigation` ref existence.
- **Best Practice**: All UI side effects after async ops check screen liveness first.

### 18.2 Tab state preservation expectations wrong
- **Commonly Missed Problem**: Devs assume each tab preserves its scroll/state forever; in reality, tab navigators may unmount under memory pressure or `unmountOnBlur` is set.
- **Why It Happens**: Defaults differ between Expo Router versions.
- **Production Impact**: Unpredictable state loss on tab switch.
- **Real Scenario**: User scrolls deep in a tab, switches tabs, comes back, scroll reset.
- **Severity**: 🟡
- **Enterprise Solution**: Persist scroll position in Zustand keyed by route; restore on focus. Don't rely on view state.
- **Best Practice**: For lists where scroll position matters, save it explicitly.

---

## 19. Error Handling

### 19.1 Unhandled promise rejections crash silently
- **Commonly Missed Problem**: A `.then()` without `.catch()`, or `await` outside try/catch, fires "unhandled rejection" — Hermes may swallow, Sentry may miss.
- **Why It Happens**: Async error paths are easy to skip.
- **Production Impact**: Silent failures, stale UI, hard-to-diagnose bugs.
- **Real Scenario**: Profile fetch fails, no catch, UI stays in loading state forever.
- **Severity**: 🟠
- **Enterprise Solution**: Global unhandled rejection handler (`global.HermesInternal?.enablePromiseRejectionTracker`), wired to Sentry. ESLint rule requiring `await` in try/catch.
- **Best Practice**: Single error boundary architecture: per-screen boundaries that report and offer retry, not one top-level boundary.

### 19.2 Native crashes not symbolicated
- **Commonly Missed Problem**: Native crashes show up as hex addresses, not stack traces.
- **Why It Happens**: dSYMs (iOS) and ProGuard mappings (Android) not uploaded to crash reporter.
- **Production Impact**: Production crashes are unfixable; can't tell where they come from.
- **Real Scenario**: App crashes 1% of sessions; Sentry shows "0x000018ac" frames; engineering can't reproduce.
- **Severity**: 🔴
- **Enterprise Solution**: EAS post-build hook to upload dSYMs to Sentry/Bugsnag/Crashlytics; same for ProGuard mappings. Verify upload succeeded.
- **Best Practice**: Symbolication smoke test in staging before every prod release: trigger a known crash, confirm it shows up symbolicated.

---

## 20. Monitoring & Observability

### 20.1 Source maps not uploaded to crash reporter
- **Commonly Missed Problem**: JS errors in Sentry show minified bundle paths like `index.android.bundle:1:382011`.
- **Why It Happens**: Source map upload is a separate step often forgotten in CI.
- **Production Impact**: Cannot triage JS errors in production.
- **Real Scenario**: Crash spike post-OTA. Stack traces are unreadable. Time-to-rollback is hours instead of minutes.
- **Severity**: 🔴
- **Enterprise Solution**: Source map upload as a required step in EAS Update / EAS Build. Sentry CLI in CI verifies upload succeeded.
- **Best Practice**: Make source map upload failure block the release.

### 20.2 No cold-start / TTI metric
- **Commonly Missed Problem**: No measurement of how long it takes from icon tap to interactive UI.
- **Why It Happens**: It's not in default RN tooling.
- **Production Impact**: Performance regressions ship unnoticed; users complain "the app got slow" with no data to back it up or fix it.
- **Real Scenario**: New dependency added that adds 800ms to startup; nobody notices for 2 months until users start complaining.
- **Severity**: 🟠
- **Enterprise Solution**: Native marker at app launch (Application.onCreate / didFinishLaunchingWithOptions) → JS marker when first screen interactive → log delta to telemetry. Sentry has performance tracing for this.
- **Best Practice**: Cold start TTI is a release-blocking metric. Set a budget (e.g. < 2s on mid-tier Android) and enforce.

### 20.3 No tracking of network failures by endpoint
- **Commonly Missed Problem**: API success/failure logged as a single event type, no endpoint dimension.
- **Why It Happens**: Telemetry added as an afterthought.
- **Production Impact**: When sync starts failing for a specific endpoint, dashboards don't surface it.
- **Real Scenario**: Auth refresh endpoint starts returning 502 for 5% of users; total failure rate looks normal; nobody catches it for days.
- **Severity**: 🟠
- **Enterprise Solution**: Per-endpoint success rate, latency p50/p95/p99, error code distribution. Alarms on regression.
- **Best Practice**: HTTP client middleware emits structured telemetry for every request; dashboards built from that.

---

## 21. CI/CD & Release Management

### 21.1 Version code/build number not auto-incremented
- **Commonly Missed Problem**: Engineer forgets to bump `versionCode`/`buildNumber`; submission rejected; release blocked.
- **Why It Happens**: Manual step.
- **Production Impact**: Hours of release lag for trivial reason.
- **Real Scenario**: Hotfix submission rejected at 11pm because build number wasn't bumped; on-call has to fix and resubmit.
- **Severity**: 🟡
- **Enterprise Solution**: EAS Build's `autoIncrement: true` per-platform; or compute from CI build number.
- **Best Practice**: No manual version management. Ever.

### 21.2 No release / staging / dev separation in EAS
- **Commonly Missed Problem**: One bundle ID for all environments; testers and prod users coexist; accidental APIs hit.
- **Why It Happens**: Easier to set up.
- **Production Impact**: Test data in prod DB; users discover staging features; unable to distinguish builds in crash reports.
- **Real Scenario**: QA writes test orders to production payment provider; compliance incident.
- **Severity**: 🔴
- **Enterprise Solution**: Distinct bundle IDs per env (`com.app.dev`, `com.app.staging`, `com.app`); icon overlays per env; env baked into build via `app.config.ts` profiles.
- **Best Practice**: Engineers can install all three side-by-side. Crash reports tagged by env.

### 21.3 Secrets in `app.config.ts` checked into git
- **Commonly Missed Problem**: API keys, Sentry DSNs, push credentials committed to repo.
- **Why It Happens**: `app.config.ts` is JS, so it tempts inlining.
- **Production Impact**: Leaked credentials, abuse of paid APIs, security incidents.
- **Real Scenario**: Public repo accidentally exposes Maps API key, attacker spends $30K against the team's GCP account in a weekend.
- **Severity**: 🔴
- **Enterprise Solution**: All secrets in EAS Secrets, accessed via `process.env` only at build time. Never log secrets. Git scan in CI.
- **Best Practice**: Pre-commit hook + CI scan for high-entropy strings.

---

## 22. Feature Flags

### 22.1 No default values when remote config fails
- **Commonly Missed Problem**: Feature flag SDK doesn't load (network, init race), code branches read undefined and either crash or silently fall through.
- **Why It Happens**: Devs treat flags as always-available.
- **Production Impact**: Cold start with no network = broken app.
- **Real Scenario**: User opens app on plane mode; flag SDK times out; conditional features not rendered; app appears broken.
- **Severity**: 🟠
- **Enterprise Solution**: Every flag has a baked-in default value; flag accessor function never returns undefined; cache last known values to disk between sessions.
- **Best Practice**: Flag definitions in code, with explicit defaults, types, and ownership. Generate from a schema.

### 22.2 No kill switch for hot bugs
- **Commonly Missed Problem**: Bug discovered post-release; no remote way to disable the broken feature; must wait for OTA / store review.
- **Why It Happens**: Flags treated as feature toggles, not safety mechanisms.
- **Production Impact**: Long blast radius for any bug.
- **Real Scenario**: A new checkout flow breaks for 10% of users; team spends 6 hours shipping an OTA fix when a flag flip would have been instant.
- **Severity**: 🟠
- **Enterprise Solution**: Every non-trivial new feature wrapped in a kill-switch flag, default on, can be flipped off remotely.
- **Best Practice**: Define which flags are "kill switches" (binary safety) vs "experiments" (rollout %); separate dashboards.

---

## 23. Environment Management

### 23.1 Mixing env vars at runtime vs build time
- **Commonly Missed Problem**: `process.env.API_URL` works in dev (Metro injects it) but is `undefined` in production (Hermes bundle has no `process.env`).
- **Why It Happens**: Devs assume Node-like env behavior.
- **Production Impact**: Production app can't reach the API.
- **Real Scenario**: First production build hits localhost or undefined; nothing works.
- **Severity**: 🔴
- **Enterprise Solution**: Use `expo-constants` extras populated from `app.config.ts` at build time, or `babel-plugin-transform-inline-environment-variables` to inline at build.
- **Best Practice**: One config module that exposes all env-derived values, validated against a schema (Zod) at module load time.

---

## 24. App Startup Optimization

### 24.1 Splash screen race conditions
- **Commonly Missed Problem**: `SplashScreen.hideAsync()` called too early — hides while app is still hydrating — flash of wrong UI. Or called in error path that doesn't fire.
- **Why It Happens**: Hide call put in the first effect that runs.
- **Production Impact**: White flash, wrong-state flash, or stuck splash forever.
- **Real Scenario**: Hydration error → `hideAsync` never called → users see splash for 30 seconds then force-quit.
- **Severity**: 🟠
- **Enterprise Solution**: State machine controls splash hide: requires (hydrated AND auth resolved AND initial URL processed) OR (timeout fired AND error logged). Always guarantee splash hides.
- **Best Practice**: Hard 5-second timeout that hides splash regardless and reports error to Sentry. User sees error UI rather than infinite splash.

### 24.2 Loading too much synchronously at startup
- **Commonly Missed Problem**: Initial render imports a giant feature module, dragging in 10MB of JS that the user doesn't need on first screen.
- **Why It Happens**: Static imports look free.
- **Production Impact**: Multi-second startup on lower-end devices.
- **Real Scenario**: Home screen imports a chart library it doesn't use because a sibling screen does; cold start adds 1.5s.
- **Severity**: 🟠
- **Enterprise Solution**: Dynamic `import()` for heavy/optional modules; `React.lazy` with Suspense for non-critical screens; route-level code splitting (Expo Router supports this).
- **Best Practice**: Bundle analyzer in CI; budget for initial bundle size.

---

## 25. Battery & Network Optimization

### 25.1 Polling instead of websockets / SSE
- **Commonly Missed Problem**: Frontend polls every 5s for "live" updates; battery and bandwidth burn.
- **Why It Happens**: Polling is simpler.
- **Production Impact**: User reports app drains battery; uninstalls.
- **Real Scenario**: Chat app polls for messages every 3s; battery drops 20%/hour with app in foreground.
- **Severity**: 🟠
- **Enterprise Solution**: WebSocket / SSE for real-time; polling only as fallback. Polling intervals adapt to AppState (slow when backgrounded) and network type.
- **Best Practice**: Document data freshness requirements per feature; choose transport accordingly.

### 25.2 Geolocation polling at high accuracy
- **Commonly Missed Problem**: Continuous high-accuracy GPS used when significant-change would suffice.
- **Why It Happens**: Defaults are convenient but expensive.
- **Production Impact**: Massive battery drain; users disable location permission.
- **Real Scenario**: Run-tracking app drains 30% battery per hour even when user isn't actively running.
- **Severity**: 🟠
- **Enterprise Solution**: High accuracy only during active sessions; significant-change API otherwise; geofencing for region triggers.
- **Best Practice**: Document the location strategy per feature; review with battery telemetry.

---

## 26. SQLite / Storage Concerns

### 26.1 No WAL mode
- **Commonly Missed Problem**: Default journal mode is DELETE; reads block writes; concurrent access slow.
- **Why It Happens**: Default settings used as-is.
- **Production Impact**: UI freezes during sync writes; jank during list rendering with concurrent DB access.
- **Real Scenario**: Background sync writes 500 rows; foreground list query blocks for 800ms; user sees frozen scroll.
- **Severity**: 🟠
- **Enterprise Solution**: `PRAGMA journal_mode = WAL` on DB open. Tune `synchronous` and `cache_size` based on workload.
- **Best Practice**: DB initialization in one place; pragma settings versioned and reviewed.

### 26.2 No encryption-at-rest for sensitive data
- **Commonly Missed Problem**: SQLite file readable on a rooted/jailbroken device; tokens, PII, financial data exposed.
- **Why It Happens**: Default SQLite isn't encrypted.
- **Production Impact**: Data exfiltration on lost/stolen devices; compliance violations (HIPAA, GDPR Art. 32).
- **Real Scenario**: Health app stores patient data in plain SQLite; lost phone audit triggers HIPAA breach reporting.
- **Severity**: 🔴 (sensitive verticals)
- **Enterprise Solution**: SQLCipher or `op-sqlite` with encryption, key stored in Keychain/Keystore. Encrypt sensitive columns even within encrypted DB for defense in depth.
- **Best Practice**: Threat model on storage; classify each data type; encrypt anything above class 1.

### 26.3 Schema migration failure not handled
- **Commonly Missed Problem**: Migration script fails halfway; DB left in inconsistent state; app crashes on launch forever.
- **Why It Happens**: Migrations not transactional or not tested with real production-shaped data.
- **Production Impact**: Subset of users can't open the app; only fix is reinstall = data loss.
- **Real Scenario**: Migration adds NOT NULL column without default; rows with NULLs cause failure; user stuck.
- **Severity**: 🔴
- **Enterprise Solution**: Every migration in a transaction; pre-flight schema check; on failure, restore previous schema and report; never crash.
- **Best Practice**: Test migrations against snapshots of real production DBs; chained migration test (v1 → v2 → v3 → ... → vN).

---

## 27. Large Scale Maintainability

### 27.1 No module boundaries — everything imports from everything
- **Commonly Missed Problem**: Feature folders have circular imports; refactoring one feature touches twenty files.
- **Why It Happens**: Free-for-all in early stages, never disciplined later.
- **Production Impact**: Slow build, slow test, slow onboarding, fragile changes.
- **Real Scenario**: Year-old codebase: changing the auth model touches 40 files in unrelated features.
- **Severity**: 🟡 (compounding)
- **Enterprise Solution**: Enforce module boundaries via ESLint-plugin-boundaries or NX. Feature folders expose a single index; cross-feature imports forbidden except through "shared" packages.
- **Best Practice**: Enforce architecture in CI, not in code review.

### 27.2 No design system / component library
- **Commonly Missed Problem**: Buttons re-implemented 30 times with slightly different padding; accessibility props missing on most.
- **Why It Happens**: Faster to copy-paste than to abstract.
- **Production Impact**: Visual inconsistency; impossible to roll out brand updates; accessibility holes.
- **Real Scenario**: Brand refresh requires updating 200 buttons; takes a quarter.
- **Severity**: 🟡
- **Enterprise Solution**: From day one, primitives (`<Button>`, `<Text>`, `<Input>`, `<Screen>`) with design tokens. No raw RN components used directly in features (lint rule).
- **Best Practice**: Storybook or Ladle for the component library, reviewed by designers.

---

## 28. Enterprise Production Readiness

### 28.1 No force-update mechanism
- **Commonly Missed Problem**: Critical security fix or breaking API change ships, but old app versions keep running.
- **Why It Happens**: Force update needs server cooperation and isn't built early.
- **Production Impact**: Long tail of vulnerable / broken clients indefinitely.
- **Real Scenario**: API contract changes; 30% of users on old version see broken UI; can't be coerced to update.
- **Severity**: 🟠
- **Enterprise Solution**: Server returns minimum supported version; client checks on launch; if below, blocking screen with deep link to store. OTA can ship a patched client even on legacy binaries.
- **Best Practice**: Minimum-supported-version response on a known endpoint; client respects it before any other API call.

### 28.2 No maintenance-mode response
- **Commonly Missed Problem**: When backend goes down for migration, app retries forever and shows confusing errors.
- **Why It Happens**: Maintenance mode is a server concept, not propagated to client.
- **Production Impact**: User assumes the app is broken; uninstalls; support tickets flood.
- **Real Scenario**: Planned 30-min DB maintenance; app users see "Network Error" everywhere; thousands of bad reviews.
- **Severity**: 🟡
- **Enterprise Solution**: Backend returns `503` with `Retry-After` header and a structured maintenance message; client shows a clean maintenance screen; auto-recovers.
- **Best Practice**: Maintenance UX prototyped and tested before any planned downtime.

### 28.3 Compliance: no audit log on the client
- **Commonly Missed Problem**: Regulated apps (health, finance) must log user actions for audit; team logs only on the server but offline actions never make it.
- **Why It Happens**: Audit requirements added late.
- **Production Impact**: Compliance audit failure.
- **Real Scenario**: Healthcare app audit notices that offline-edited records have no audit trail of who edited when; remediation costs 3 months.
- **Severity**: 🔴 (regulated industries)
- **Enterprise Solution**: Append-only local audit log of significant user actions; signed with device identity; synced to server with idempotency.
- **Best Practice**: Define "significant action" early with compliance team. Log capture is a hook, not per-feature code.

---

## 29. App Store / Play Store Release Issues

### 29.1 iOS Privacy Manifest (PrivacyInfo.xcprivacy) missing or incomplete
- **Commonly Missed Problem**: Apple requires Privacy Manifests declaring data collection, tracking domains, and use of "Required Reason APIs" (e.g. UserDefaults, file timestamps). Apps without complete manifests rejected.
- **Why It Happens**: Requirement is recent; many libraries don't ship manifests.
- **Production Impact**: Submission rejected; release delayed.
- **Real Scenario**: Submission rejected mentioning a third-party SDK that uses a "Required Reason API" without a declared reason; takes a week to identify and update.
- **Severity**: 🟠
- **Enterprise Solution**: Privacy manifest declared in Expo config plugins; verify all native deps ship their manifests; CI check using Apple's tooling.
- **Best Practice**: Whenever adding a native dep, check it ships a Privacy Manifest. If not, file an issue / contribute one.

### 29.2 Encryption export compliance not declared
- **Commonly Missed Problem**: `ITSAppUsesNonExemptEncryption` not set; every TestFlight build prompts for encryption disclosure.
- **Why It Happens**: Default is unset.
- **Production Impact**: Slows TestFlight releases; may delay App Store releases.
- **Real Scenario**: Hotfix delayed because release manager has to fill out the encryption form.
- **Severity**: 🟢
- **Enterprise Solution**: Declare `ITSAppUsesNonExemptEncryption` correctly in `app.config.ts` (`infoPlist`). Most apps using only HTTPS qualify as exempt.
- **Best Practice**: Set once, verify with legal once, never touch again.

### 29.3 Android Data Safety form / iOS Privacy "nutrition label" outdated
- **Commonly Missed Problem**: Form filled at launch, never updated when new SDKs added.
- **Why It Happens**: It's invisible to engineers after the first time.
- **Production Impact**: False declarations are policy violations; app can be removed.
- **Real Scenario**: Analytics SDK added that collects location; data safety form not updated; spotted by Google review, app pulled.
- **Severity**: 🟠
- **Enterprise Solution**: Maintain a "data inventory" doc updated whenever a SDK is added; reviewed before every release.
- **Best Practice**: SDK additions require a privacy impact entry in the PR template.

---

## 30. Disaster Recovery & Rollback Strategy

### 30.1 No rollback path for bad OTA
- **Commonly Missed Problem**: Bad OTA is shipped; no documented or rehearsed procedure to roll back.
- **Why It Happens**: "It won't happen to us."
- **Production Impact**: Hours of broken UX while team scrambles.
- **Real Scenario**: OTA breaks login flow on Android; team takes 2 hours to figure out how to publish a previous bundle as the new latest; meanwhile, every Android user is locked out.
- **Severity**: 🔴
- **Enterprise Solution**: One-command (or one-click) rollback via EAS Update channels; runbook on the wall; rehearsed quarterly.
- **Best Practice**: Treat OTA like a deploy: every release gets a versioned manifest; rollback is just re-pointing the channel.

### 30.2 No client-side recovery for corrupted local DB
- **Commonly Missed Problem**: SQLite gets corrupted (rare but real on Android); app crash loops forever.
- **Why It Happens**: Devs assume DB is reliable.
- **Production Impact**: Affected users effectively bricked; uninstall is the only recourse.
- **Real Scenario**: Power-loss during sync corrupts WAL; next launch crashes in DB open; user reinstalls and loses local state.
- **Severity**: 🟠
- **Enterprise Solution**: Wrap DB open in try/catch; on corruption, back up the file (for forensics), recreate fresh, mark "needs full resync." Never crash the app on DB issues.
- **Best Practice**: Periodic integrity check (`PRAGMA integrity_check`) on launch, with telemetry.

### 30.3 No incident response runbook
- **Commonly Missed Problem**: Crash spike post-release; nobody knows who to page or what levers exist (rollback, kill switch, force-update bump).
- **Why It Happens**: Mobile teams often skip the SRE-style discipline web teams have.
- **Production Impact**: Long mean time to recovery; user trust eroded.
- **Real Scenario**: 10x crash rate post-release at 9pm; on-call paged, doesn't know the rollback procedure; spends 4 hours figuring it out while users suffer.
- **Severity**: 🔴
- **Enterprise Solution**: Documented runbook covering: how to roll back OTA, how to flip kill switches, how to publish a hotfix to the store, how to communicate to users in-app. Quarterly fire drills.
- **Best Practice**: Treat mobile ops with the same rigor as backend ops. Mobile on-call is real.

---

## Appendix: Things to add to your release checklist

A short, copyable list extracted from the above:

1. Source maps uploaded to crash reporter
2. dSYMs / ProGuard mappings uploaded
3. Cold-start TTI within budget
4. Crash-free sessions ≥ 99.5% on previous release
5. Privacy manifest declared and complete
6. Data safety form / privacy nutrition label up to date
7. Build version and runtime version bumped correctly
8. OTA staged rollout configured
9. Force-update minimum version reviewed
10. Notification permission flow tested on cold start, warm start, declined
11. Deep link cold/warm/background tested
12. AASA / assetlinks.json validated against production
13. Migration tested against snapshot of production DB
14. Hardware back / gesture back tested on Android
15. Safe area insets verified on smallest and largest device
16. Accessibility audit (VoiceOver + TalkBack)
17. Reduce Motion / Larger Text behavior verified
18. Idempotency keys present on all mutations
19. Sync queue concurrency capped, backoff verified
20. Kill switches in place for new features
21. Rollback runbook reviewed and reachable
22. Telemetry dashboards green for 24h before release
23. Internal distribution (TestFlight / Play Internal) signed off
24. Release notes accurate
25. Post-release monitoring on-call assigned

---

*The shortest summary I can give: in mobile, defaults are wrong, edge cases are common, and the OS is hostile. Build accordingly.*
