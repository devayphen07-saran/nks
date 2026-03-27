# Mobile Store Selection Screens

Complete implementation of store selection screens following mobile architecture rules.

## 📁 File Structure

```
apps/nks-mobile/app/(store)/
├── select.tsx                     ← Main store selection screen
├── select/
│   ├── components/
│   │   └── StoreCard.tsx         ← Store list item component
│   └── hooks/
│       └── useStoreSelection.ts  ← Data fetching + state logic
└── detail/
    └── [storeId].tsx            ← Store detail screen (dynamic route)
```

## 🎯 Screens Overview

### 1. Store Selection List (`select.tsx`)

**Purpose**: Display accessible stores and allow user to select one

**Route**: `/(store)/select`

**Features**:
- ✅ List of accessible stores with pagination
- ✅ Real-time store selection with loading state
- ✅ Error handling and retry capability
- ✅ Empty state when no stores available
- ✅ Uses TanStack Query for auto-caching
- ✅ Uses Redux for selection state
- ✅ Follows mobile UI component library

**Key Props/State**:
```typescript
stores[]          // Array of StoreItemDto
total            // Total number of accessible stores
page             // Current pagination page
selectedStoreId  // ID of selected store
isLoadingStores  // Loading state for fetching stores
isSelectingStore // Loading state for selecting
storesError      // Error object from TanStack Query
selectError      // Error object from Redux
```

**Navigation**:
- On continue: `router.replace("/(store)/(main)")` → App main screens
- Back: Handled by Expo Router

### 2. Store Card Component (`select/components/StoreCard.tsx`)

**Purpose**: Individual store card in the list

**Props**:
```typescript
store: StoreItemDto        // Store data
isSelected: boolean        // Selection state
isLoading: boolean        // Loading state
onPress: (storeId) => void // Selection handler
```

**Features**:
- ✅ Visual selection indicator (CheckCircle2 icon)
- ✅ Store name and code display
- ✅ Inactive badge for non-active stores
- ✅ Border color changes on selection
- ✅ Theme token usage throughout
- ✅ Proper styling with styled-components

### 3. Store Detail Screen (`detail/[storeId].tsx`)

**Purpose**: Show detailed view of a specific store before selection

**Route**: `/(store)/detail/:storeId`

**Features**:
- ✅ Store header with name and code
- ✅ Active/inactive status indicator
- ✅ Created and updated timestamps
- ✅ Direct selection from detail view
- ✅ Uses TanStack Query for detail fetching
- ✅ Loading and error states
- ✅ Back navigation support

**Note**: This is optional but useful for users who want to verify store details before selecting.

## 🔌 API Integration

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/store` | GET | Fetch accessible stores with pagination |
| `/store/:storeId` | GET | Fetch store detail by ID |

### Data Flow

```
TanStack Query (useStores)
    ↓
  GET /store (with pagination params)
    ↓
  StoreListResponse { items[], total, page, pageSize }
    ↓
  Store selection screen renders list
    ↓
Redux Action: storeSelect
    ↓
  POST /auth/store/select { storeId }
    ↓
  Updates auth state with selected store
    ↓
  Navigate to main app
```

## 📋 Implementation Checklist

### Before Using These Screens

- [ ] Ensure `useStores` hook is properly exported from `@nks/api-handler`
- [ ] Ensure `storeSelect` thunk is properly exported from `@nks/api-manager`
- [ ] Redux auth slice is registered with `storeSelectState`
- [ ] TanStack Query `QueryClientProvider` is set up in app root
- [ ] Mobile UI components library is available (`@nks/mobile-ui-components`)
- [ ] Mobile theme is set up (`@nks/mobile-theme`)

### Integration Steps

1. **Copy the screen files** from above paths to your mobile app
2. **Update your app/(store)/_layout.tsx** to include store selection routes:
   ```tsx
   <Stack.Screen
     name="select"
     options={{
       title: "Select Store",
       headerBackVisible: true,
     }}
   />
   <Stack.Screen
     name="detail/[storeId]"
     options={{
       title: "Store Details",
       headerBackVisible: true,
     }}
   />
   ```
3. **Call the selection screen** after authentication:
   ```tsx
   // In your auth flow, after login
   router.push("/(store)/select");
   ```

## 🎨 Design System Compliance

### Colors Used
- `theme.colorBgLayout` - Screen background
- `theme.colorBgContainer` - Card backgrounds
- `theme.colorPrimary` - Selection indicator
- `theme.colorText` - Main text
- `theme.colorTextSecondary` - Secondary text
- `theme.colorSuccess` - Active status
- `theme.colorDanger` - Error messages
- `theme.colorBorder` - Dividers and borders

### Spacing
- All padding/margins use `theme.sizing.*` tokens
- Consistent spacing with `Gap` prop on Row/Column

### Typography
- `Typography.H2/H4/H5` - Headings
- `Typography.Body` - Regular text
- `Typography.Caption` - Secondary text
- `weight="semiBold"` for emphasis (not `"regular"`)

### Components Used
- `AppLayout` - Screen wrapper
- `Header` - Top bar with back button
- `Row` / `Column` - Flex layouts
- `Button` - Interactive actions
- `LucideIcon` - Icons (PascalCase names)
- `FlatList` - Store list rendering
- `FlatListLoading` - Loading indicator
- `NoDataContainer` - Empty state

## 🔄 State Management

### Redux Integration

Store selection updates Redux auth state:

```typescript
// In auth/slice.ts - storeSelect.fulfilled handler
if (state.user && access) {
  state.user.access = access;
}
```

The `access` object includes `activeStoreId` which is set after successful selection.

### TanStack Query Integration

Store listing uses TanStack Query with:
- **Cache time**: 60 seconds (configurable)
- **Pagination**: Supported via `page` and `pageSize` params
- **Query keys**: `["stores", { page, pageSize }]`
- **Auto-refetch**: On window focus (can be disabled)

## 🚨 Error Handling

### Network Errors

**Fetching stores fails**:
```
isLoadingStores = true
storesError populated
→ Show error banner with retry button
```

**Selecting store fails**:
```
storeSelectState.hasError = true
storeSelectState.errors populated
→ Show error banner below list
Selection button disabled
```

### Empty States

**No stores available**:
```
→ NoDataContainer with message
→ "No stores available. Contact your administrator."
```

**Store detail not found**:
```
→ NoDataContainer on detail screen
→ "Store not found. Please try again."
```

## 📱 Mobile-Specific Considerations

### Pagination

The list uses FlatList with `onEndReached` for infinite scroll:
- Threshold: 50% (loads more when 50% from bottom)
- Shows "Loading more stores..." indicator
- Disables loading if all items are loaded

### Keyboard Handling

No search input on selection screen (kept simple for auth flow).
For future enhancement, add SearchInput with debounced search.

### Screen-Specific Hooks

`useStoreSelection` hook encapsulates:
- TanStack Query fetching (useStores)
- Redux dispatch for selection (storeSelect)
- State management (selectedStoreId, page)
- Error handling
- Loading states

**Why separate hook?**: Keeps screen file thin and testable per architecture rules.

## 🧪 Testing Guide

### Unit Tests (useStoreSelection hook)

```typescript
describe("useStoreSelection", () => {
  it("should fetch stores on mount", () => { });
  it("should handle store selection", () => { });
  it("should handle selection error", () => { });
  it("should support pagination", () => { });
});
```

### Component Tests (StoreCard)

```typescript
describe("StoreCard", () => {
  it("should render store name and code", () => { });
  it("should show selection indicator when selected", () => { });
  it("should call onPress when tapped", () => { });
  it("should show inactive badge for inactive stores", () => { });
});
```

### Integration Tests

```typescript
describe("Store Selection Flow", () => {
  it("should load stores and allow selection", async () => { });
  it("should navigate to main app after selection", async () => { });
  it("should show error when selection fails", async () => { });
});
```

## 🔐 Permission Checks

Store selection is part of auth flow and doesn't require specific permissions.

However, verify in your auth logic:
- User is AUTHENTICATED (can be done in app/_layout.tsx)
- User has at least one accessible store (STORE_OWNER or STAFF role)

## 📝 Customization Guide

### Add Search to Store List

```tsx
// In select.tsx
const [search, setSearch] = useState("");

// Modify hook call
const { ... } = useStoreSelection({ search });

// Add SearchInput above FlatList
<SearchInput
  value={search}
  onChangeText={setSearch}
  placeholder="Search stores..."
/>
```

### Add Store Count Badge

```tsx
// In StoreCard.tsx
<StoreCountBadge>
  <Typography.Caption>{memberCount} staff</Typography.Caption>
</StoreCountBadge>
```

### Add Store Region/Category

If backend provides these fields, display in card:

```tsx
<Typography.Caption color={theme.colorTextSecondary}>
  {store.region} • {store.category}
</Typography.Caption>
```

## 🐛 Common Issues

### Issue: Stores not loading
**Cause**: TanStack Query not initialized
**Fix**: Ensure `QueryClientProvider` in app root

### Issue: Selection doesn't update UI
**Cause**: Redux state not connected properly
**Fix**: Verify `storeSelectState` is in auth slice

### Issue: Pagination not working
**Cause**: Page state not triggering refetch
**Fix**: Add `refetch()` call when page changes (TanStack Query)

### Issue: Theme colors not applied
**Cause**: `useMobileTheme()` not called or `ThemeProvider` missing
**Fix**: Ensure app root wraps with ThemeProvider

## 📊 Architecture Diagram

```
User authenticates
    ↓
app/_layout.tsx routes to /(store)/select
    ↓
StoreSelectionScreen mounts
    ↓
useStoreSelection hook:
  ├─ useStores() → TanStack Query → GET /store
  ├─ Handles pagination
  └─ Manages selectedStoreId state
    ↓
FlatList renders StoreCard components
    ↓
User taps store
    ↓
handleSelectStore():
  └─ dispatch(storeSelect())
    ├─ Redux action
    ├─ POST /auth/store/select
    └─ Updates auth.user.access.activeStoreId
    ↓
On success:
  └─ router.replace("/(store)/(main)")
    ├─ Navigates to main app
    └─ Auth guard in _layout confirms AUTHENTICATED + STORE_SELECTED
```

## ✅ Done!

All mobile store selection screens are ready to use. Follow the mobile architecture rules from `docs/mobile-architecture.md` and ensure proper TypeScript types from API integrations.
