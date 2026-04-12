# Senior Architect's Complete Architecture Flow

**Document:** Senior-level architecture for NKS Mobile App
**Author:** Architecture Review
**Audience:** Developers implementing Phase 1-6

---

## Part 1: Strategic Vision

### The Problem We're Solving

The current codebase has **business logic scattered everywhere**. As the app scales from 5K LOC → 50K LOC, this becomes:

- 🔴 **Unmaintainable** - Can't find where business logic lives
- 🔴 **Untestable** - Can't test without full app setup
- 🔴 **Fragile** - Changing one thing breaks others
- 🔴 **Slow onboarding** - New devs spend weeks understanding flow

### The Solution: Layered Architecture with Clear Contracts

```
┌────────────────────────────────────────────────────────────────┐
│                      USER (Mobile App)                         │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                  User taps button
                         │
        ┌────────────────▼────────────────┐
        │     UI Layer (Presentation)     │
        │  - PhoneScreen.tsx              │
        │  - OtpScreen.tsx                │
        │  - Render UI                    │
        │  - Handle gestures              │
        └────────────────┬────────────────┘
                         │
                 Call hook with dispatch
                         │
        ┌────────────────▼─────────────────────┐
        │   View Model Layer (Hooks)           │
        │  - usePhoneAuth()                    │
        │  - useOtpVerify()                    │
        │  - Pure state logic                  │
        │  - Form validation                   │
        │  - Error UI mapping                  │
        └────────────────┬─────────────────────┘
                         │
               Call authService method
                         │
        ┌────────────────▼──────────────────────┐
        │   Service Layer (Business Logic)      │
        │  - AuthService                        │
        │  - PhoneService                       │
        │  - Orchestrate operations             │
        │  - Validation rules                   │
        │  - Error transformation               │
        │  - Session management                 │
        └────────────────┬──────────────────────┘
                         │
           Call dispatch(Redux async thunk)
                         │
        ┌────────────────▼──────────────────────┐
        │   API Manager (libs-common)           │
        │  - Redux Thunks: sendOtp, verifyOtp  │
        │  - Type-safe request/response         │
        │  - API contract enforcement           │
        └────────────────┬──────────────────────┘
                         │
          Make HTTP request via Axios
                         │
        ┌────────────────▼──────────────────────┐
        │   HTTP Client Layer                   │
        │  - Axios instance                     │
        │  - Auth interceptor (inject token)    │
        │  - Error interceptor (401/403/5xx)    │
        │  - Retry logic (exponential backoff)  │
        │  - Logging interceptor                │
        └────────────────┬──────────────────────┘
                         │
                      Server
                    /auth/send-otp
```

**Each layer has ONE responsibility:**

| Layer | Responsibility | Example |
|-------|---|---|
| **UI** | Render pixels, handle taps | Show loading spinner |
| **Hook** | Form state, UI state, event handlers | Validate phone, show error |
| **Service** | Business logic, orchestration | Call verifyOtp, save token |
| **API Manager** | HTTP details, request/response | Redux thunk, type safety |
| **HTTP Client** | Network requests, interceptors | Axios, auth headers |

---

## Part 2: Complete Request Flow (Happy Path + Error Cases)

### **Scenario: User enters phone and taps "Send OTP"**

```
1️⃣  USER TAPS "SEND OTP"
    ├─ Location: PhoneScreen.tsx, line 250 (button onPress)
    └─ Action: Call handleSendOtp()

2️⃣  UI LAYER (PhoneScreen.tsx)
    ├─ Location: PhoneScreen.tsx, lines 112-118
    ├─ Action:
    │  ├─ Show loading spinner
    │  ├─ Disable send button
    │  └─ Call hook: const { handleSendOtp } = usePhoneAuth(authService)
    └─ State: { isLoading: true, errorMessage: null }

3️⃣  HOOK LAYER (usePhoneAuth)
    ├─ Location: hooks/usePhoneAuth.ts
    ├─ Validation:
    │  ├─ Phone must be 10 digits (phoneSchema.safeParse)
    │  ├─ If invalid: Set error message and return
    │  └─ If valid: Proceed to service
    ├─ Action: Call authService.sendOtp(phone: "9025863606")
    └─ State: { phone: "9025863606", isLoading: true, errorMessage: null }

4️⃣  SERVICE LAYER (AuthService)
    ├─ Location: services/AuthService.ts
    ├─ Business Logic:
    │  ├─ Add country code: phone = "+91" + phone
    │  ├─ Prepare request: { phone: "+919025863606" }
    │  ├─ Check if phone is already registered (optional validation)
    │  └─ Log: logger.info({ phone, action: 'send_otp' })
    ├─ Action: Call dispatch(sendOtp({ bodyParam: { phone } }))
    └─ Note: Service owns the +91 prefix logic, not the hook

5️⃣  API MANAGER LAYER (Redux Thunk - libs-common)
    ├─ Location: libs-common/api-manager/src/lib/auth/api-thunk.ts
    ├─ Contract:
    │  ├─ Input: { bodyParam: { phone: "+919025863606" } }
    │  └─ Output: { data: { reqId: "req_abc123" } }
    ├─ Action: Dispatch sendOtp thunk
    └─ Return: Promise that resolves to API response

6️⃣  HTTP CLIENT LAYER (Axios)
    ├─ Location: POST /auth/send-otp
    ├─ Request Interceptor:
    │  ├─ Inject auth token from SecureStore
    │  ├─ Set headers: Authorization: Bearer <token>
    │  ├─ Add device ID: X-Device-ID: <device-id>
    │  └─ Add timestamp for sync-time calculation
    ├─ Send: POST /auth/send-otp with { phone: "+919025863606" }
    └─ Server processes request...

7️⃣  RESPONSE: Server returns 200 OK
    ├─ Response: { data: { reqId: "req_abc123" } }
    └─ Response Interceptor:
       ├─ Log successful response
       ├─ No errors, pass through

8️⃣  BACK TO API MANAGER (Redux Thunk)
    ├─ Return response data
    └─ Dispatch action: sendOtp.fulfilled(payload)

9️⃣  BACK TO SERVICE LAYER (AuthService)
    ├─ Receive: { reqId: "req_abc123" }
    ├─ Business Logic:
    │  ├─ Validate reqId exists and is non-empty
    │  ├─ Log: logger.info({ phone, reqId, action: 'otp_sent' })
    │  └─ Return: { reqId: "req_abc123" }
    └─ Action: Return to hook

🔟 BACK TO HOOK LAYER (usePhoneAuth)
    ├─ Receive: { reqId: "req_abc123" }
    ├─ Action:
    │  ├─ Clear error message
    │  ├─ Set loading to false
    │  ├─ Navigate to OTP screen with params:
    │  │  ├─ phone: "+919025863606"
    │  │  └─ reqId: "req_abc123"
    │  └─ Clear form
    └─ State: { isLoading: false, errorMessage: null }

1️⃣1️⃣ BACK TO UI LAYER (PhoneScreen)
    ├─ Hook updates state
    ├─ Re-render component
    ├─ Hide loading spinner
    ├─ Enable send button
    ├─ Show success: Router navigates to OTP screen
    └─ User sees: OtpScreen with phone "+91****3606"

✅ SUCCESS PATH COMPLETE
```

---

### **Error Case 1: Network Error**

```
6️⃣ HTTP CLIENT (Axios)
   └─ Network error: No internet connection

Response Interceptor:
├─ Catch error
├─ Check: error.response is undefined (no response from server)
├─ Action: Throw ErrorHandler.handle(error, { phone })
│  ├─ Creates AppError:
│  │  ├─ code: 'NETWORK_ERROR'
│  │  ├─ message: 'Network error. Please check your connection.'
│  │  ├─ statusCode: undefined
│  │  └─ context: { phone: "+919025863606" }
│  └─ Log error for debugging
└─ Propagate AppError up

8️⃣ API MANAGER (Redux Thunk)
   └─ Catch AppError
   └─ Dispatch action: sendOtp.rejected(error)

9️⃣ SERVICE LAYER (AuthService)
   └─ Catch error in try-catch
   └─ Log: logger.error({ phone, error, action: 'otp_send_failed' })
   └─ Re-throw AppError

🔟 HOOK LAYER (usePhoneAuth)
   └─ Catch AppError
   ├─ Check error.isNetworkError() → true
   ├─ Action:
   │  ├─ setIsLoading(false)
   │  ├─ setErrorMessage(error.getUserMessage())
   │  │  → "Network error. Please check your connection."
   │  └─ Show retry button
   └─ User sees: Error message + Retry button

User can:
├─ Fix internet connection
├─ Tap Retry → Calls handleSendOtp() again
└─ Back → Returns to previous screen
```

---

### **Error Case 2: Validation Error (400 Bad Request)**

```
6️⃣ HTTP CLIENT (Axios)
   └─ Server returns: 400 Bad Request
   └─ Response body: { code: 'INVALID_PHONE', message: 'Phone is invalid' }

Response Interceptor:
├─ Catch error
├─ Check: error.response?.status === 400
├─ Action: Throw ErrorHandler.handle(error, { phone })
│  ├─ Creates AppError:
│  │  ├─ code: 'VALIDATION_ERROR'
│  │  ├─ message: 'Invalid input. Please check your data.'
│  │  ├─ statusCode: 400
│  │  └─ context: { phone, field: 'phone' }
│  └─ Log error
└─ Propagate up

... (same flow as network error)

🔟 HOOK LAYER (usePhoneAuth)
   └─ Catch AppError
   ├─ Check error.isValidationError() → true
   ├─ Action:
   │  ├─ setIsLoading(false)
   │  ├─ setErrorMessage(error.getUserMessage())
   │  │  → "Invalid input. Please check your data."
   │  └─ Set focus to phone field
   └─ User sees: Error message, can fix input and retry
```

---

### **Error Case 3: Auth Error (401 Unauthorized)**

```
6️⃣ HTTP CLIENT (Axios)
   └─ Server returns: 401 Unauthorized (token expired)

Response Interceptor:
├─ Detect 401 status
├─ Action: Attempt token refresh
│  ├─ Load refresh token from SecureStore
│  ├─ Call POST /auth/refresh-token
│  ├─ If success: Update in-memory token
│  ├─ If success: Retry original request with new token
│  └─ If fail: Return null (token can't be refreshed)
├─ If refresh failed:
│  ├─ Throw AppError:
│  │  ├─ code: 'SESSION_EXPIRED'
│  │  ├─ message: 'Your session has expired. Please log in again.'
│  │  └─ statusCode: 401
│  └─ Signal to Redux to clear auth state
└─ Redux dispatch: setUnauthenticated()

🔟 HOOK LAYER (usePhoneAuth)
   └─ Catch AppError
   ├─ Check error.isAuthError() → true
   ├─ Action:
   │  ├─ setIsLoading(false)
   │  ├─ setErrorMessage(error.getUserMessage())
   │  │  → "Your session has expired. Please log in again."
   │  └─ Redirect to login screen
   └─ Redux also triggers: ProtectedLayout sees isLoggedIn=false → redirect

User sees: Login screen, must re-authenticate
```

---

## Part 3: State Management Rules (Critical!)

### **Golden Rule: Right Tool for Right Job**

| State Type | Tool | Where | Why |
|-----------|------|-------|-----|
| **Auth Status** | Redux | `store/authSlice.ts` | Global, needed on every screen |
| **User Profile** | Redux | `store/userProfileSlice.ts` | Persisted, needed app-wide |
| **Permissions** | Redux | `store/authSlice.ts` | Critical for security |
| **Session Token** | SecureStore | `tokenManager.ts` | Sensitive, encrypted on device |
| **Form State** | useState | Component/Hook | Transient, local to feature |
| **Loading Flag** | useState | Component/Hook | Local UI state |
| **Error Message** | useState | Component/Hook | Local UI state |
| **Visible OTP Fields** | useState | Component | UI state only |
| **Countries List** | TanStack Query | Hook | Cacheable reference data |
| **Stores List** | TanStack Query | Hook | Cacheable reference data |

### **Anti-Patterns (Don't Do This!)**

```typescript
// ❌ WRONG: Form state in Redux
const formSlice = createSlice({
  initialState: { phone: '', otp: '', password: '' }
});
// Why? It's transient, only exists during form interaction
// Causes: Bloated Redux store, hard to reset, persists unnecessarily

// ❌ WRONG: API response in useState
const [stores, setStores] = useState([]);
useEffect(() => {
  fetch('/stores').then(data => setStores(data));
}, []);
// Why? Will refetch on every component mount, no caching
// Better: Use TanStack Query with automatic caching

// ❌ WRONG: Sensitive data in Redux
const authSlice = createSlice({
  initialState: { sessionToken: '...' }
});
// Why? Redux state is serializable, can be logged/inspected
// Better: Keep tokens in SecureStore, only keep isAuthenticated in Redux

// ❌ WRONG: Global state in useState
const [globalUser, setGlobalUser] = useState(null);
// Only works in root component, unmounts on navigation
// Better: Use Redux for global state
```

---

## Part 4: Error Handling Architecture (The Secret Sauce)

### **Three-Tier Error Handling**

```
┌─────────────────────────────────────────────┐
│  Layer 1: ERROR CREATION (Where it happens) │
├─────────────────────────────────────────────┤
│ const error = new Error("Something failed") │
│ (thrown from HTTP client, validation, etc.) │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│  Layer 2: ERROR TRANSFORMATION (ErrorHandler)│
├─────────────────────────────────────────────┤
│ throw ErrorHandler.handle(error, { phone })│
│ (transforms to AppError with type & context)│
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│ Layer 3: ERROR HANDLING (Where it's handled) │
├─────────────────────────────────────────────┤
│ catch (error: AppError) {                   │
│   if (error.isNetworkError()) { retry }    │
│   if (error.isValidationError()) { show }  │
│   if (error.isAuthError()) { logout }      │
│ }                                           │
└─────────────────────────────────────────────┘
```

### **Error Flow Through Layers**

```
LAYER 1: HTTP CLIENT (Axios)
  Network error occurred
  └─ response interceptor catches it

LAYER 2: ERROR HANDLER
  ErrorHandler.handle(AxiosError)
  ├─ Check: Is it axios error? Yes
  ├─ Check: Does it have response? No
  ├─ Check: Is it timeout? No
  ├─ Conclusion: Network error
  └─ Create: new AppError('NETWORK_ERROR', 'Network error...', undefined, { phone })

LAYER 3: RESPONSE INTERCEPTOR
  Throw AppError up the chain
  └─ Redux thunk catches it

LAYER 4: REDUX THUNK
  Catch AppError
  ├─ Don't transform again
  ├─ Payload contains AppError
  └─ Dispatch action: sendOtp.rejected(AppError)

LAYER 5: SERVICE LAYER
  Catch AppError from redux thunk
  ├─ Log it: logger.error('OTP send failed', error)
  ├─ Could add retry logic here
  ├─ Don't transform again
  └─ Re-throw AppError

LAYER 6: HOOK LAYER
  Catch AppError from service
  ├─ setIsLoading(false)
  ├─ Check error.code: 'NETWORK_ERROR'
  ├─ Map to UI message: error.getUserMessage()
  └─ setErrorMessage('Network error. Please check your connection.')

LAYER 7: COMPONENT
  Hook state updates
  ├─ Re-render with errorMessage
  └─ User sees: "Network error. Please check your connection."
```

### **Key Principle: Transform Once, Use Many Times**

```typescript
// ✅ GOOD: Transform at HTTP layer, reuse everywhere else
try {
  await api.post('/auth/send-otp', data);
} catch (error) {
  throw ErrorHandler.handle(error); // ← Transform here only
}

// Then everywhere else:
catch (error: AppError) {
  // Already transformed, just use it
  showError(error.getMessage());
  logger.error(error.getDeveloperMessage());
}

// ❌ BAD: Transform at multiple layers
catch (error: AppError) {
  // Try to transform again?
  throw new AppError(error.code, error.message); // Redundant!
}
```

---

## Part 5: Testing Strategy (How We Know It Works)

### **Test Pyramid**

```
        /\
       /  \  E2E Tests (5%)
      /────\  - Full user flows
     /      \ - Real app
    /────────\
   /  Integr.\ Integration Tests (20%)
  /─────────  \ - Service + Repository
 /            \ - Mock API
/──────────────\
/  Unit Tests  \ Unit Tests (75%)
(Services, Hooks,  - Individual functions
 Validators)    - No app setup needed
```

### **Unit Test Example: usePhoneAuth**

```typescript
describe('usePhoneAuth', () => {
  // Setup
  const mockAuthService: AuthService = {
    sendOtp: jest.fn()
  };

  test('sends OTP with valid phone number', async () => {
    // Arrange
    const { result } = renderHook(() => usePhoneAuth(mockAuthService));

    // Act
    act(() => result.current.setPhone('9025863606'));
    await act(() => result.current.handleSendOtp());

    // Assert
    expect(mockAuthService.sendOtp).toHaveBeenCalledWith(
      '+919025863606'
    );
  });

  test('shows error for invalid phone', async () => {
    const { result } = renderHook(() => usePhoneAuth(mockAuthService));

    act(() => result.current.setPhone('123')); // Too short
    await act(() => result.current.handleSendOtp());

    expect(result.current.errorMessage).toBe('Phone must be 10 digits');
    expect(mockAuthService.sendOtp).not.toHaveBeenCalled();
  });

  test('handles network error gracefully', async () => {
    mockAuthService.sendOtp.mockRejectedValueOnce(
      new AppError('NETWORK_ERROR', 'Network error...', undefined, {})
    );

    const { result } = renderHook(() => usePhoneAuth(mockAuthService));

    act(() => result.current.setPhone('9025863606'));
    await act(() => result.current.handleSendOtp());

    expect(result.current.errorMessage).toBe('Network error. Please check your connection.');
    expect(result.current.isLoading).toBe(false);
  });
});
```

---

## Part 6: Scalability & Growth (The Long Game)

### **How the Architecture Scales**

#### **Current: 1 Feature (Auth)**
```
features/
└── auth/
    ├── services/AuthService.ts
    └── hooks/usePhoneAuth.ts
```

#### **After 1 Month: 5 Features**
```
features/
├── auth/
│   ├── services/AuthService.ts
│   ├── services/PhoneService.ts
│   └── hooks/usePhoneAuth.ts
├── store/
│   ├── services/StoreService.ts
│   └── hooks/useStoreSetup.ts
├── personal/
│   ├── services/PersonalService.ts
│   └── hooks/useExpense.ts
├── inventory/
│   ├── services/InventoryService.ts
│   └── hooks/useInventorySync.ts
└── reporting/
    ├── services/ReportingService.ts
    └── hooks/useReportGeneration.ts
```

**Problem?** Services are duplicating logic!

#### **After 6 Months: Extract Core Domain Layer**

```
features/
├── auth/...
├── store/...
shared/
└── domain/
    ├── phone/
    │  └── PhoneValidator.ts
    ├── otp/
    │  ├── OtpValidator.ts
    │  └── OtpTokenManager.ts
    ├── store/
    │  └── StoreValidator.ts
    └── sync/
       └── SyncQueue.ts
```

**Now all features share validators!**

#### **After 1 Year: Stable Architecture**

```
├── features/         (UI + feature-specific logic)
├── shared/
│  ├── domain/       (Business logic + validation)
│  ├── services/     (Cross-cutting services)
│  ├── errors/       (Error handling)
│  └── types/        (Shared types)
├── libs-common/     (Shared with backend)
│  ├── api-manager/  (Redux thunks)
│  └── shared-types/ (Types for API)
└── store/           (Redux)
```

**This structure supports 50+ screens, multiple teams!**

---

## Part 7: The Complete Developer Workflow (Day-to-Day)

### **Adding a New Feature: "Expense Tracking"**

#### **Step 1: Create Feature Structure** (5 min)
```bash
mkdir -p features/expense/screens
mkdir -p features/expense/services
mkdir -p features/expense/hooks
mkdir -p features/expense/schema
touch features/expense/{ExpenseService.ts,useExpenseForm.ts}
```

#### **Step 2: Define Types** (15 min)
```typescript
// features/expense/services/ExpenseService.ts
export interface CreateExpenseRequest {
  amount: number;
  category: string;
  description: string;
  date: string;
}

export class ExpenseService {
  constructor(
    private dispatch: AppDispatch,
    private logger: Logger
  ) {}

  async createExpense(request: CreateExpenseRequest) {
    try {
      this.logger.info({ action: 'create_expense', ...request });

      // Call Redux thunk from libs-common
      const response = await this.dispatch(
        createExpense({ bodyParam: request })
      ).unwrap();

      return response.data;
    } catch (error) {
      throw ErrorHandler.handle(error, {
        action: 'create_expense',
        category: request.category
      });
    }
  }
}
```

#### **Step 3: Create Hook** (20 min)
```typescript
// features/expense/hooks/useExpenseForm.ts
export function useExpenseForm(expenseService: ExpenseService) {
  const [form, setForm] = useState({
    amount: '',
    category: '',
    description: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setError(null);
      setIsLoading(true);

      await expenseService.createExpense({
        ...form,
        date: new Date().toISOString(),
        amount: parseFloat(form.amount)
      });

      // Success - navigate away
      router.back();
    } catch (err: AppError) {
      setError(err.getUserMessage());
    } finally {
      setIsLoading(false);
    }
  };

  return { form, setForm, handleSubmit, error, isLoading };
}
```

#### **Step 4: Create UI** (30 min)
```typescript
// features/expense/screens/ExpenseFormScreen.tsx
export function ExpenseFormScreen() {
  const diContainer = useContext(DIContext);
  const expenseService = diContainer.getExpenseService();

  const { form, setForm, handleSubmit, error, isLoading } =
    useExpenseForm(expenseService);

  return (
    <Container>
      <Header>Add Expense</Header>
      <AmountInput
        value={form.amount}
        onChange={(amount) => setForm({ ...form, amount })}
      />
      <CategoryPicker
        value={form.category}
        onChange={(category) => setForm({ ...form, category })}
      />
      <DescriptionInput
        value={form.description}
        onChange={(desc) => setForm({ ...form, description: desc })}
      />
      {error && <ErrorBanner message={error} />}
      <Button
        onPress={handleSubmit}
        loading={isLoading}
      >
        Create Expense
      </Button>
    </Container>
  );
}
```

#### **Step 5: Add Tests** (45 min)
```typescript
// features/expense/services/ExpenseService.test.ts
describe('ExpenseService', () => {
  test('creates expense successfully', async () => {
    const mockDispatch = jest.fn().mockResolvedValueOnce({
      data: { id: '123', amount: 50 }
    });
    const service = new ExpenseService(mockDispatch, logger);

    const result = await service.createExpense({
      amount: 50,
      category: 'Food',
      description: 'Lunch'
    });

    expect(mockDispatch).toHaveBeenCalled();
    expect(result.id).toBe('123');
  });

  test('handles network error', async () => {
    const mockDispatch = jest.fn().mockRejectedValueOnce(
      new AxiosError('Network error')
    );
    const service = new ExpenseService(mockDispatch, logger);

    await expect(
      service.createExpense({...})
    ).rejects.toThrow(AppError);
  });
});

// features/expense/hooks/useExpenseForm.test.ts
describe('useExpenseForm', () => {
  test('submits form with valid data', async () => {
    const mockService = {
      createExpense: jest.fn().mockResolvedValueOnce({ id: '123' })
    };
    const { result } = renderHook(() => useExpenseForm(mockService));

    act(() => result.current.setForm({
      amount: '50',
      category: 'Food',
      description: 'Lunch'
    }));

    await act(() => result.current.handleSubmit());

    expect(mockService.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50 })
    );
  });
});
```

#### **Step 6: Update DI Container** (5 min)
```typescript
// shared/di/container.ts
export class DIContainer {
  private expenseService: ExpenseService;

  constructor(dispatch: AppDispatch) {
    this.expenseService = new ExpenseService(dispatch, logger);
  }

  getExpenseService() { return this.expenseService; }
}
```

#### **Summary: Adding a feature takes ~2 hours**
- Structure: 5 min
- Types: 15 min
- Service: 15 min
- Hook: 20 min
- UI: 30 min
- Tests: 45 min
- DI: 5 min

**Developer productivity: High!**

---

## Part 8: Production Checklist

### **Before Going to Production**

```
Auth Feature:
☐ Services layer implemented
☐ AppError + ErrorHandler integrated
☐ All API errors handled
☐ Offline error recovery
☐ Session expiry handling
☐ Token refresh working
☐ Unit tests > 70% coverage
☐ Error messages user-friendly
☐ Logging integrated
☐ Crash reporting (Sentry)
☐ Performance monitoring
☐ Load testing done
☐ Security audit passed
```

### **Monitoring in Production**

```typescript
// When errors happen in production
ErrorHandler.handle(error, { phone })
  ├─ Log to console (dev)
  ├─ Log to service: logger.error(error.getDeveloperMessage())
  ├─ Send to Sentry: Sentry.captureException(error)
  ├─ Track analytics: analytics.track('error', { code: error.code })
  ├─ Alert team if critical: alertSlack(error)
  └─ User sees: "Network error. Please try again."
```

---

## Part 9: The Core Principles (Memorize These!)

### **1. Single Responsibility Principle**
```
PhoneScreen = Only render UI
usePhoneAuth = Only form logic
AuthService = Only business logic
Axios = Only HTTP requests

Each does ONE thing well.
```

### **2. Dependency Injection**
```
// ❌ Bad: Hard-coded dependency
function usePhoneAuth() {
  const authService = new AuthService();
}

// ✅ Good: Dependency injected
function usePhoneAuth(authService: AuthService) {
  // Can pass mock in tests
}
```

### **3. Centralized Error Handling**
```
// ❌ Bad: Error handling everywhere
try { ... } catch { ... }  // In hook
try { ... } catch { ... }  // In service
try { ... } catch { ... }  // In component

// ✅ Good: Transform once at HTTP layer
ErrorHandler.handle(error) // Returns AppError
// Use AppError everywhere
```

### **4. Type Safety**
```
// ❌ Bad: Any types
const response: any = await api.post(...);

// ✅ Good: Explicit types
const response: AuthResponse = await api.post(...);
// Compiler catches mistakes
```

### **5. Testability**
```
// ✅ Good architecture = Easy to test
const mockService = { sendOtp: jest.fn(...) };
const hook = usePhoneAuth(mockService);
// That's it! Full test coverage achievable.
```

---

## Summary: The Senior Dev Mindset

As a senior developer, you should think:

1. **Data Flow** - Trace a request from user tap → screen → hook → service → API → back
2. **Error Handling** - Where do errors come from? How are they transformed? How are they handled?
3. **Testability** - Can this be tested in isolation? Do I need the whole app set up?
4. **Scalability** - If I add 10 more features, will this architecture still work?
5. **Maintainability** - Can a junior dev understand this in 1 hour?
6. **Performance** - Will this work on slow networks? Will it handle 1M users?
7. **Security** - Where are tokens stored? Are errors logging sensitive data?
8. **Monitoring** - Can we see errors in production? Can we debug issues?

**This is the mindset. The code is just the implementation of this thinking.**

