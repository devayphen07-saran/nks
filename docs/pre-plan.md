# System Design Protocol: Senior Architect Framework
## Implementation Template for Enterprise Features

**Protocol Version:** 1.0
**Framework:** Senior Architect Authority
**Usage:** Attach to any feature request to guide comprehensive implementation

---

## I. THE INTENT AUDIT

### A. Clarify Problem Space & Business Value

**Define Core Requirements:**
1. What problem does this solve? (Be specific)
2. Who are the users? (Roles/personas)
3. What's the business value?
4. What are success criteria?

**Document:**
- User journeys (happy path + error cases)
- Performance requirements (latency, throughput)
- Scale requirements (concurrent users, data volume)
- Timeline & deployment constraints

---

## II. THE AMBIGUITY FILTER

### A. Identify Gaps & Contradictions

**Questions to Answer:**
- What assumptions are we making?
- Where are the technical contradictions?
- What decisions haven't been made?
- What data flows are unclear?

**Create Decision Table:**

| Ambiguity | Options | Recommended | Tradeoff |
|-----------|---------|-------------|----------|
| Example: State persistence | localStorage vs Redux vs Backend | Backend | Complexity vs reliability |
| | | | |
| | | | |

### B. List Edge Cases

**For each major flow, ask:**
1. What if the operation fails halfway?
2. What if two users do this simultaneously?
3. What if the user closes the tab mid-operation?
4. What if the network disconnects?
5. What if the user lacks permissions?

**Document each edge case:**
- Scenario
- Current behavior (if system exists)
- Decision: Silent fail, retry, or show error?

---

## III. INDUSTRY BENCHMARKING: 2026 GOLD STANDARDS

### A. Research Applicable Patterns

**For this feature, what are the industry standards?**

Examples:
- **Authentication:** JWT + refresh tokens, session stores, MFA
- **State Management:** Redux, Zustand, Jotai, Server State (React Query)
- **Caching:** Redis, Varnish, edge caches, TTL strategies
- **Data Sync:** Optimistic updates, conflict resolution, eventual consistency
- **Error Handling:** Retry logic, circuit breakers, exponential backoff

**Document for each:**
1. Pattern name
2. Use case
3. Pros / Cons
4. Recommended choice
5. Alternative if choice fails

### B. Reference Architecture

**Create a simple diagram showing:**
- Data flow (Frontend → Backend → Database)
- State locations (Redux, sessionStorage, Redis, DB)
- Cache invalidation points
- Error paths

---

## IV. STRATEGIC DESIGN CONSTRAINTS

### A. The "Must-Have" Pillar

**Define non-negotiable architectural decisions:**

#### 1. **Data Integrity**
- Source of truth: (Frontend/Backend/Database?)
- Concurrency model: (Optimistic locking? Pessimistic? Last-write-wins?)
- Conflict resolution: (How do we handle simultaneous updates?)

#### 2. **Security Posture**
- Authentication requirement: (Every request? Cache token?)
- Authorization: (Frontend only? Backend validation? Both?)
- Data isolation: (Cross-tenant risks?)
- Audit trail: (What needs logging?)

#### 3. **Performance Constraints**
- Latency target: (p50, p95, p99?)
- Throughput: (Requests/sec?)
- Cache strategy: (TTL? Invalidation?)
- Network usage: (Minimize payload size?)

#### 4. **Availability**
- Uptime SLA: (99%? 99.9%? 99.95%?)
- Fallback behavior: (Fail open or closed?)
- Offline capability: (Required? Nice-to-have?)

### B. The "Anti-Pattern" Guardrail

**List patterns to AVOID and why:**

| Anti-Pattern | Why It Fails | Prevention |
|--------------|-------------|-----------|
| Example | Example reason | Example guard |
| | | |

**After implementation, verify:**
- ✅ No client-side-only security checks
- ✅ No secrets in logs or Redux
- ✅ No synchronous blocking operations
- ✅ No hard-coded role/permission checks

---

## V. OPERATIONAL EXCELLENCE STRATEGY

### A. Data Integrity Framework

**Define concurrency and consistency:**
- Source of truth location: (Database? Backend cache? Frontend?)
- How do concurrent updates get handled?
- What's the conflict resolution strategy?
- How is stale data detected and refreshed?

**Design state flow diagram:**
```
User Action
  ↓
Frontend state update (optimistic)
  ↓
API call to backend
  ↓
Backend validation + DB transaction
  ↓
Response to frontend (accept/reject)
  ↓
Reconcile frontend state with server truth
```

### B. Security Posture

**Zero Trust Checklist:**

For every request/mutation, verify:
- ✅ Valid authentication (JWT? Session?)
- ✅ Resource ownership (Does this user own this resource?)
- ✅ Permission check (Does this user have this action?)
- ✅ Audit logged (Who? What? When?)

**Template:**
```typescript
// Backend validation template
async function handleRequest(req, res) {
  // 1. Authenticate
  const user = verifyJWT(req.headers.authorization)
  if (!user) return 401 Unauthorized

  // 2. Authorize
  const resource = await getResource(req.params.id)
  if (resource.owner_id !== user.id) return 403 Forbidden

  // 3. Validate permission
  if (!user.permissions.includes('edit_resource')) return 403 Forbidden

  // 4. Execute
  const result = await updateResource(...)

  // 5. Audit log
  log({ user_id: user.id, action: 'edit_resource', resource_id: ..., timestamp: now })

  return result
}
```

### C. Observability & Monitoring

**What should be logged?**
- Auth events (login, logout, failed auth)
- Authorization events (access denied)
- Data changes (who changed what, when)
- Errors (stack traces, context)
- Performance (slow queries, API latency)

**Alerting rules to define:**
- API latency thresholds
- Error rate thresholds
- Cache hit rate targets
- Database connection limits

---

## VI. IMPLEMENTATION ROADMAP

**Break feature into phases:**

| Phase | Duration | Tasks | Acceptance Criteria |
|-------|----------|-------|-------------------|
| Foundation | Week 1-2 | List core tasks | Core feature working |
| Integration | Week 3-4 | List integration tasks | Works with existing systems |
| Polish | Week 5 | Bugs, UX, performance | Production ready |

---

## VII. SUCCESS METRICS

**Define measurable success:**

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Example: API Latency | p99 < 500ms | Monitor in production |
| Example: Cache Hit Rate | > 80% | Log hits/misses |
| Example: Error Rate | < 0.1% | Count errors in logs |

---

## VIII. RISK REGISTER

**Identify risks and mitigations:**

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Example: Data loss on network error | HIGH | Implement offline queue + sync |
| Example: Concurrent updates conflict | MEDIUM | Use optimistic locking + versioning |

---

## CHECKLIST FOR IMPLEMENTATION

**Before starting code:**
- [ ] Intent is clear (problem, users, business value)
- [ ] Ambiguities documented and decisions made
- [ ] Industry pattern chosen
- [ ] Must-have pillars defined (Data Integrity, Security, Performance)
- [ ] Anti-patterns identified and guardrails set
- [ ] Concurrency model chosen
- [ ] Security validation points defined
- [ ] Logging/monitoring strategy outlined
- [ ] Roadmap created
- [ ] Success metrics defined
- [ ] Risks identified and mitigated

**During implementation:**
- [ ] Follow the chosen architecture patterns
- [ ] Validate security constraints at every step
- [ ] Add logging for observability
- [ ] Handle edge cases defined in Ambiguity Filter
- [ ] Test concurrent scenarios
- [ ] Implement error handling per design

**After implementation:**
- [ ] Review against must-have pillars
- [ ] Verify no anti-patterns introduced
- [ ] Audit security validation points
- [ ] Validate success metrics
- [ ] Load test for performance
- [ ] Operational runbook created

---

**Protocol Owner:** Senior Architect
**Last Updated:** March 26, 2026
**Next Review:** When attaching to new feature request
