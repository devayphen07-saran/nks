# Expo Drawer Implementation - Senior Architect Plan

**Date:** March 28, 2026
**Framework:** Senior Architect Authority (from pre-plan.md)
**Feature:** Side Drawer in Store Stack with Avatar Trigger

---

## I. THE INTENT AUDIT

### A. Problem Space & Business Value

**Core Requirements:**
1. **What problem does this solve?**
   - Store owners/staff need quick access to profile and settings
   - Currently no navigation menu in store section
   - Avatar click should trigger meaningful navigation

2. **Who are the users?**
   - Store owners (primary)
   - Store staff (secondary)
   - All authenticated users in store context

3. **What's the business value?**
   - Better UX (consistent navigation like modern apps)
   - Easy access to logout, settings, profile
   - Reduced navigation friction
   - Professional appearance

4. **Success criteria?**
   - Drawer opens when avatar tapped
   - Drawer shows user profile section
   - Logout works correctly
   - Gesture swipe opens drawer (optional but nice)
   - All nav items properly styled

### B. User Journeys

**Happy Path:**
```
User in store list
  ↓
Taps avatar in header
  ↓
Drawer slides in from left
  ↓
User sees: Avatar + Name + Email + Logout
  ↓
User taps logout → Logs out and redirects to auth
```

**Error Cases:**
```
1. Drawer opens but user not loaded → Show fallback/skeleton
2. Logout fails → Show error message
3. Gesture conflict → Prioritize drawer over other gestures
```

### C. Performance & Scale Requirements

- **Latency:** Drawer should open < 300ms
- **Throughput:** Single user interaction (no concurrent issues)
- **Data Volume:** Just user name/email (minimal)
- **Scale:** Handles 1-10k concurrent store users

---

## II. THE AMBIGUITY FILTER

### A. Key Decisions

| Ambiguity | Options | Recommended | Tradeoff |
|-----------|---------|-------------|----------|
| **Drawer Type** | Custom animated vs Expo drawer | Expo drawer (from request) | Pre-built vs custom control |
| **Layout Strategy** | Replace Stack with Drawer vs Nest Drawer in Stack | Replace Stack with Drawer | Cleaner architecture vs nesting complexity |
| **Drawer Position** | Left vs Right | Left (standard) | Consistency with modern apps |
| **Drawer Content** | Minimal (profile + logout) vs Full menu | Minimal for Phase 1 | MVP vs feature-complete |
| **Gesture Support** | Swipe enabled vs button only | Swipe enabled | Native feel vs simplicity |
| **Avatar Integration** | OpenDrawer action vs navigation | OpenDrawer action | Clear semantics |
| **Other Screens** | Dashboard, select, setup → hidden from drawer | Yes, hide via drawerItemStyle | Clean nav vs explicit items |

### B. Edge Cases

1. **User not authenticated**
   - Scenario: Session expires while drawer open
   - Decision: Auto-close drawer, redirect to auth

2. **Logout while drawer open**
   - Scenario: User taps logout in drawer
   - Decision: Close drawer, clear state, redirect

3. **Rapid avatar clicks**
   - Scenario: User rapidly taps avatar
   - Decision: Drawer state manages single open (no double-open)

4. **Screen rotation while drawer open**
   - Scenario: User rotates device
   - Decision: Drawer closes (standard behavior)

5. **Deep linking to store stack**
   - Scenario: Deep link opens dashboard but no drawer
   - Decision: Drawer available but not open (normal state)

---

## III. INDUSTRY BENCHMARKING: 2026 GOLD STANDARDS

### A. Applicable Patterns

**Navigation Drawer Pattern:**
- Used in: Gmail, Google Maps, Twitter, Airbnb, Uber
- Best Practice: Slide-in drawer from left, swipe-to-open gesture
- State: Toggle open/closed, not persistent
- Content: User profile, navigation menu, logout

**Expo Router Drawer:**
- Pattern: DrawerNavigator from @react-navigation/drawer
- Integrates with: Expo Router (expo-router/drawer)
- Gesture: Requires react-native-gesture-handler + reanimated
- Customization: Custom drawer content component

**Recommended Choice:**
✅ Expo Router Drawer (already have dependencies)
- Clean integration with expo-router
- Built-in gesture support
- Custom content via DrawerContent component
- Consistent with mobile app standards

---

## IV. STRATEGIC DESIGN CONSTRAINTS

### A. Must-Have Pillars

#### 1. **Data Integrity**
- Source of truth: Redux auth state (user profile already loaded)
- No concurrent issues (single user viewing own profile)
- No new data mutations needed

#### 2. **Security Posture**
- Authentication: Already handled by AuthGuard in protected layout
- Authorization: Drawer shows only to authenticated users
- Data isolation: User sees only own profile
- Logout: Should clear all Redux state + clear storage

#### 3. **Performance Constraints**
- Latency target: Drawer open < 300ms (gesture to visual response)
- Animation: 200-250ms slide duration (standard)
- No blocking operations on open
- Lazy load: Content already in Redux (no fetch needed)

#### 4. **Availability**
- Uptime: Same as app (no new backend calls)
- Fallback: If user data missing, show "User" with skeleton
- Offline: Works offline (no network calls)

### B. Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | Prevention |
|--------------|-------------|-----------​|
| Nested Drawer in Stack | Gesture conflicts, complexity | Replace Stack with Drawer |
| Custom drawer animation | Reinventing the wheel | Use Expo drawer |
| Multiple drawer instances | Navigation confusion | Single drawer at top level |
| Drawer shows all screens | UX clutter | Hide dashboard, select, setup |
| Logout without clearing state | Memory leaks, auth bugs | Clear Redux + async storage |
| No gesture support | Poor UX vs industry standard | Enable swipe gesture |

**Guardrails:**
- ✅ Use Expo's DrawerNavigator, not custom solution
- ✅ Drawer at (store) level, not nested deeper
- ✅ All drawer items use DrawerActions
- ✅ Logout action wipes Redux + storage
- ✅ No hardcoded role checks (permissions already handled)

---

## V. OPERATIONAL EXCELLENCE STRATEGY

### A. State Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│ Redux Auth State (user profile already loaded)      │
├─────────────────────────────────────────────────────┤
│ ├─ user: { id, name, email, ... }                   │
│ ├─ token: string                                    │
│ └─ isAuthenticated: boolean                         │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ StoreListScreen Avatar                              │
├─────────────────────────────────────────────────────┤
│ User taps Avatar                                    │
│   ↓                                                 │
│ Dispatch DrawerActions.openDrawer()                 │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ Drawer Navigator (opened)                           │
├─────────────────────────────────────────────────────┤
│ Renders StoreDrawerContent component                │
│   ├─ User avatar + name + email                     │
│   ├─ Divider                                        │
│   ├─ "My Stores" link                               │
│   ├─ Divider                                        │
│   └─ Sign Out button                                │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│ User Actions in Drawer                              │
├─────────────────────────────────────────────────────┤
│ 1. Tap background → Close drawer                    │
│ 2. Swipe left → Close drawer                        │
│ 3. Tap "My Stores" → Navigate to list, close        │
│ 4. Tap "Sign Out" → Dispatch logout action          │
│    ├─ Clear Redux auth state                        │
│    ├─ Clear async storage token                     │
│    ├─ Close drawer                                  │
│    └─ Redirect to auth stack                        │
└─────────────────────────────────────────────────────┘
```

### B. Security Validation Points

**Drawer Opening:**
```
1. Check AuthGuard passes (already done at (protected) level)
   → User cannot access (store) stack without auth

2. Verify Redux auth state has user
   → UI fallback if missing (show "User")

3. No additional auth check needed
   → Already in protected context
```

**Logout Action:**
```
1. Validate auth token before logout API call
2. Clear token from async storage
3. Clear Redux auth state
4. Clear all app state (store, userProfile)
5. Dispatch auth/logout thunk (clears everything)
6. Redirect to auth stack (navigation guard handles)
```

**No New Authorization Needed:**
- Drawer is already behind AuthGuard
- All nav items are public (for authenticated users)
- No role-based drawer items (same for all users)

### C. Logging & Monitoring

**Events to Log:**
```
1. Drawer opened → timestamp, user_id
2. Logout initiated → timestamp, user_id
3. Logout success → timestamp, user_id
4. Logout failed → timestamp, error, user_id
```

**Optional: Performance Metrics**
```
1. Drawer open duration (gesture → visual)
2. Animation frames (should be 60fps)
3. Logout latency
```

---

## VI. IMPLEMENTATION ROADMAP

### Phase 1: Setup (30 min)
- [ ] Add GestureHandlerRootView to root layout (already there?)
- [ ] Convert (store)/_layout.tsx: Stack → Drawer

### Phase 2: Drawer Content (1 hour)
- [ ] Create StoreDrawerContent.tsx component
- [ ] Style: Profile section (avatar + name + email)
- [ ] Style: Menu items (My Stores, Sign Out)
- [ ] Integrate Redux auth state

### Phase 3: Avatar Integration (30 min)
- [ ] Update StoreListScreen avatar onPress
- [ ] Dispatch DrawerActions.openDrawer()
- [ ] Test drawer opens when avatar tapped

### Phase 4: Logout Integration (1 hour)
- [ ] Implement logout in drawer
- [ ] Hook to existing logout action (clear Redux)
- [ ] Verify token cleared from async storage
- [ ] Test redirect to auth stack

### Phase 5: Polish & Testing (1 hour)
- [ ] Test gesture swipe open/close
- [ ] Test on different screen sizes
- [ ] Test landscape/portrait rotation
- [ ] Verify no gesture conflicts

**Total Effort:** ~4 hours

---

## VII. SUCCESS METRICS

| Metric | Target | Measurement |
|--------|--------|-------------|
| Drawer open latency | < 300ms | Time gesture → visual |
| Animation smoothness | 60 fps | Frame count during slide |
| Gesture recognition | 95%+ success | Test 10+ swipes |
| Logout time | < 1s | Time click → auth screen |
| Error handling | 100% | All edge cases handled |
| UX polish | 8/10+ | User feedback |

---

## VIII. RISK REGISTER

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Gesture conflicts with list swipe | MEDIUM | Test thoroughly, adjust gesture sensitivity |
| User state missing | LOW | Show fallback avatar ("User") |
| Logout doesn't clear all state | HIGH | Use existing logout thunk (ensure complete) |
| Drawer doesn't close after navigation | MEDIUM | Use DrawerActions, test all nav items |
| Performance regression | LOW | Monitor: don't add expensive operations |

---

## IMPLEMENTATION CHECKLIST

### Before Starting Code
- [x] Intent is clear (drawer for quick access + logout)
- [x] Business value documented (UX improvement)
- [x] Ambiguities resolved (Expo drawer, replace Stack)
- [x] Industry pattern chosen (Expo drawer from mobile standards)
- [x] Must-have pillars defined (Data, Security, Performance)
- [x] Anti-patterns identified (nested drawer, custom animation)
- [x] State flow diagrammed
- [x] Security validation points defined
- [x] Logging strategy outlined
- [x] Roadmap created (4 hours)
- [x] Success metrics defined
- [x] Risks identified

### During Implementation
- [ ] Follow Expo drawer pattern exactly
- [ ] Test avatar click → drawer open
- [ ] Test all logout flows
- [ ] Handle edge cases (missing user, logout errors)
- [ ] Test gesture support (swipe)
- [ ] Verify no gesture conflicts

### After Implementation
- [ ] Review against must-have pillars
- [ ] Verify no anti-patterns
- [ ] Test security validation (auth required)
- [ ] Verify success metrics (latency, smoothness)
- [ ] Load test with multiple opens/closes
- [ ] User feedback on UX

---

## ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────┐
│ Root (_layout.tsx)                              │
│ ├─ GestureHandlerRootView                       │
│ ├─ Redux Provider                               │
│ └─ AuthProvider                                 │
└──────────────────┬──────────────────────────────┘
                   ↓
        ┌──────────────────────┐
        │ Protected (_layout)   │
        │ (AuthGuard checks)    │
        └──────────────┬────────┘
                       ↓
        ┌──────────────────────┐
        │ Workspace (_layout)   │
        └──────────────┬────────┘
                       ↓
        ┌──────────────────────┐
        │ App (_layout)         │
        └──────────────┬────────┘
                       ↓
        ┌─────────────────────────────┐
        │ Store (_layout) - DRAWER ✅  │
        │ ├─ DrawerNavigator          │
        │ ├─ StoreDrawerContent       │
        │ └─ Screens:                 │
        │    ├─ list                  │
        │    ├─ (dashboard)           │
        │    ├─ select                │
        │    └─ setup                 │
        └─────────────────────────────┘
```

---

## DECISION SUMMARY

✅ **APPROVED FOR IMPLEMENTATION**

- **Use:** Expo Router Drawer (expo-router/drawer)
- **Replace:** Stack with Drawer at (store)/_layout.tsx
- **Content:** StoreDrawerContent.tsx (custom component)
- **Trigger:** Avatar click in StoreListScreen
- **Logout:** Use existing Redux logout action
- **Gesture:** Enable swipe-to-open (left edge)
- **Hidden Screens:** dashboard, select, setup (drawerItemStyle: { display: "none" })

---

**Status:** ✅ Ready for implementation
**Estimated Duration:** 4 hours
**Next Step:** Code implementation (Phase 1)
