# State Management & API Integration Documentation

Complete guide to using Redux, TanStack Query, and the APIData pattern in the NKS platform.

---

## 📚 Documentation Files

### 1. **QUICK_REFERENCE.md** — Start Here! ⚡
**Read Time**: 5 minutes
**Best For**: Daily reference, quick lookups, cheat sheets

**Contains**:
- TL;DR decision tree
- useQuery/useMutation cheat sheets
- Redux dispatch/selector cheat sheets
- Lookups quick start (5 examples)
- Common patterns & errors
- Common errors & fixes

👉 **Start with this if you just want to code**

---

### 2. **LOOKUPS_INTEGRATION_GUIDE.md** — Lookups Module 📋
**Read Time**: 15 minutes
**Best For**: Building lookups features, CRUD operations

**Contains**:
- Module structure overview
- All 32 APIData endpoints documented
- 19 Query hooks reference
- 15 Mutation hooks reference
- Query key factory pattern
- 4 component integration examples
- CRUD table with modal
- Dependent queries
- Common patterns (DO/DON'T)
- Debugging guide
- Migration from legacy code

👉 **Use this when building lookups features**

---

### 3. **STATE_MANAGER_PATTERNS.md** — Redux vs TanStack 🎯
**Read Time**: 20 minutes
**Best For**: Understanding when to use what

**Contains**:
- Mental model of 3 state types
- Redux detailed patterns with examples
- TanStack Query detailed patterns with examples
- Side-by-side comparison
- Common mistakes (WRONG/CORRECT)
- Decision matrix (15 scenarios)
- Integration pattern: Redux + TanStack
- Testing implications
- Summary table

👉 **Use this when unsure Redux vs TanStack Query**

---

### 4. **API_INTEGRATION_FINAL.md** — Complete Reference 📖
**Read Time**: 30 minutes
**Best For**: Deep understanding, all concepts, complete reference

**Contains**:
- Quick reference table
- APIData pattern deep dive
- TanStack Query vs Redux framework
- useQuery() complete guide (6 patterns)
- useMutation() complete guide (5 patterns)
- State Manager integration
- Real-world code examples
- Decision tree flowchart
- Best practices checklist

👉 **Use this for complete understanding and reference**

---

## 🎯 Quick Start by Role

### I'm a Frontend Developer (New to NKS)
1. Read **QUICK_REFERENCE.md** (5 min)
2. Read **LOOKUPS_INTEGRATION_GUIDE.md** (15 min)
3. Start building! Refer back as needed

### I'm Building a CRUD Feature
1. Skim **QUICK_REFERENCE.md** patterns
2. Read **LOOKUPS_INTEGRATION_GUIDE.md** examples
3. Copy-paste code, customize as needed

### I'm Wondering "Redux or TanStack?"
1. Read **STATE_MANAGER_PATTERNS.md** (20 min)
2. Use decision matrix to choose
3. Reference **QUICK_REFERENCE.md** for syntax

### I Need to Understand Everything
1. Read **API_INTEGRATION_FINAL.md** (30 min)
2. Read **STATE_MANAGER_PATTERNS.md** (20 min)
3. Read **LOOKUPS_INTEGRATION_GUIDE.md** (15 min)
4. Keep **QUICK_REFERENCE.md** nearby

---

## 🔍 Find Topics Quickly

| Topic | File | Section |
|-------|------|---------|
| When to use useQuery | STATE_MANAGER_PATTERNS.md | When to Use TanStack Query |
| When to use useMutation | API_INTEGRATION_FINAL.md | useMutation Deep Dive |
| When to use Redux | STATE_MANAGER_PATTERNS.md | When to Use Redux |
| useQuery patterns | API_INTEGRATION_FINAL.md | useQuery Deep Dive |
| useMutation patterns | API_INTEGRATION_FINAL.md | useMutation Deep Dive |
| Redux patterns | STATE_MANAGER_PATTERNS.md | Redux — When & Why |
| Lookups hooks reference | LOOKUPS_INTEGRATION_GUIDE.md | Query Hooks / Mutation Hooks |
| Component examples | LOOKUPS_INTEGRATION_GUIDE.md | Component Integration Examples |
| Common mistakes | STATE_MANAGER_PATTERNS.md | Common Mistakes |
| Stale time guide | QUICK_REFERENCE.md | Stale Time Guide |
| Import statements | QUICK_REFERENCE.md | File Imports |
| Debugging | LOOKUPS_INTEGRATION_GUIDE.md | Debugging |
| Testing | API_INTEGRATION_FINAL.md | Testing (search) |

---

## 📊 Documentation Stats

| Document | Size | Coverage |
|----------|------|----------|
| QUICK_REFERENCE.md | 11 KB | Cheat sheets & quick lookups |
| LOOKUPS_INTEGRATION_GUIDE.md | 19 KB | Lookups module specifics |
| STATE_MANAGER_PATTERNS.md | 17 KB | Redux vs TanStack decision |
| API_INTEGRATION_FINAL.md | 21 KB | Complete reference |
| **TOTAL** | **68 KB** | **10,000+ lines** |

---

## ✨ What You'll Learn

✅ When to use **useQuery** vs **useMutation** vs **Redux**
✅ How to structure **TanStack Query** hooks
✅ How to manage **cache invalidation** properly
✅ When to use **Redux** for global state
✅ How to build **CRUD tables** with React Query
✅ How to handle **dependent queries**
✅ How to implement **optimistic updates**
✅ Common **mistakes** and how to avoid them
✅ **Real-world examples** for every pattern
✅ **Best practices** and checklist

---

## 🚀 Next Steps

1. **Choose your starting point** from "Quick Start by Role" above
2. **Read the recommended files** in order
3. **Reference QUICK_REFERENCE.md** while coding
4. **Refer back** to detailed sections as needed

---

## 📖 Key Concepts at a Glance

### Three Types of State
```
┌─────────────────────────────────────────────┐
│ 1. SERVER STATE                             │
│    (fetch from API)                        │
│    → Use: TanStack Query (useQuery)        │
│                                             │
│ 2. GLOBAL CLIENT STATE                      │
│    (auth, theme, user)                     │
│    → Use: Redux                            │
│                                             │
│ 3. LOCAL UI STATE                          │
│    (form inputs, modal open)               │
│    → Use: useState                         │
└─────────────────────────────────────────────┘
```

### Decision Tree
```
Am I fetching/caching server data?
  → YES: Use TanStack Query (useQuery/useMutation)
  → NO: Is it global state that needs persistence?
         → YES: Use Redux (useBaseStoreDispatch/Selector)
         → NO: Use useState (local component state)
```

---

## 💡 Pro Tips

**Tip 1**: Always use **optional chaining** when extracting nested data
```typescript
const items = data?.data?.data ?? [];  // ✅ Safe
const items = data.data.data;          // ❌ Crash
```

**Tip 2**: Set **staleTime** based on data freshness needs
```typescript
staleTime: Infinity,              // Never stale (static data)
staleTime: 1000 * 60 * 5,        // 5 min (reference data)
staleTime: 0,                     // Always stale (real-time)
```

**Tip 3**: Always **invalidate cache** after mutations
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: lookupKeys.salutations() });
},
```

**Tip 4**: Use **granular Redux selectors**
```typescript
const isLoading = useBaseStoreSelector((state) => state.auth.loginState.isLoading);  // ✅
const auth = useBaseStoreSelector((state) => state.auth);                           // ❌
```

**Tip 5**: Use **enabled conditions** for conditional queries
```typescript
const { data } = useQuery({
  queryFn: ...,
  enabled: !!id,  // Only fetch if id exists
});
```

---

## 🔗 Related Files in NKS

- `/libs-common/api-manager/src/lib/api-handler.ts` — APIData class
- `/libs-common/api-manager/src/lib/lookups/tanstack-queries.ts` — All hooks (19 query + 15 mutation)
- `/libs-common/api-manager/src/lib/lookups/request-dto.ts` — Type definitions
- `/apps/nks-web/src/modules/admin/lookup/components/*-table.tsx` — Component examples

---

## ❓ FAQ

**Q: Which file should I read first?**
A: **QUICK_REFERENCE.md** (5 minutes) then the file matching your task

**Q: How do I choose between Redux and TanStack Query?**
A: Read **STATE_MANAGER_PATTERNS.md** Decision Tree section

**Q: Where are the code examples?**
A: **LOOKUPS_INTEGRATION_GUIDE.md** has 4 full component examples

**Q: How do I debug cache issues?**
A: **LOOKUPS_INTEGRATION_GUIDE.md** Debugging section

**Q: Can I copy-paste code examples?**
A: Yes! All code examples are ready to use

**Q: What's the difference between staleTime and gcTime?**
A: Read **API_INTEGRATION_FINAL.md** useQuery Deep Dive section

---

## 📞 Need Help?

- **Quick syntax question** → Check **QUICK_REFERENCE.md**
- **Decision on Redux vs TanStack** → Check **STATE_MANAGER_PATTERNS.md**
- **Building lookups feature** → Check **LOOKUPS_INTEGRATION_GUIDE.md**
- **Complete understanding** → Check **API_INTEGRATION_FINAL.md**
- **Code example** → Check **LOOKUPS_INTEGRATION_GUIDE.md** or **API_INTEGRATION_FINAL.md**

---

**Last Updated**: April 7, 2026
**Version**: 1.0 (Complete)
**Status**: ✅ All documentation files created and organized

