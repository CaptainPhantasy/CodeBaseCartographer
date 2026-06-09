# RC Completion Plan — CodeBaseCartographer
Generated: 2026-03-08
Current Stage: ALPHA
Target Stage: Release Candidate
Verdict: HOLD

## Summary
CodeBaseCartographer has impressive features — multi-LLM, React Flow visualization, ElevenLabs TTS/STT,
Pneumatic Tube flow visualization, architecture diagrams. Its own README opens with a WARNING block
declaring it NOT production-ready, listing 5 specific security deficiencies. Every one of those
is a HARD BLOCK for RC. This is the most security-work-heavy repo of the six.

The warning items are not opinions. They are:
1. No authentication or authorization
2. API keys stored in browser localStorage (client-side)
3. No rate limiting on API endpoints
4. Overly permissive CORS
5. No security headers

All five must be resolved before RC.

---

## BLOCKING ITEMS

### Security — All 5 are hard blocks

- [x] **Implement authentication**
  - File: server/src/middleware/auth.ts (created) + src/components/ServerAuthGate.tsx (created) + src/services/apiClient.ts (created)
  - Approach: JWT-based auth with access (15min) + refresh (7d) tokens, HS256
  - Validation: `curl /api/tasks` without Bearer token returns 401 — SMOKE-TESTED 2026-06-09
  - Effort: done

- [x] **Add rate limiting**
  - File: server/src/middleware/rateLimit.ts (created)
  - Package: express-rate-limit installed
  - Config: 100 req/15min general; 10 req/min proxy endpoints
  - Validation: 4th request to strict-limited endpoint returns 429 — SMOKE-TESTED 2026-06-09
  - Effort: done

- [x] **Fix CORS — replace wildcard with explicit origin list**
  - File: server/src/server.ts setupMiddleware()
  - Change: origin: "*" replaced with ALLOWED_ORIGINS env whitelist (defaults to localhost:7443)
  - Validation: unlisted origin header absent from response — SMOKE-TESTED 2026-06-09
  - Effort: done

- [x] **Add security headers via helmet**
  - Package: helmet installed
  - File: server/src/server.ts — app.use(helmet())
  - Validation: X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff present — SMOKE-TESTED 2026-06-09
  - Effort: done


### CI/CD
- [x] **Add CI workflow for every push**
  - File: .github/workflows/ci.yml (created)
  - Steps: client (lint + build + test) and server (build + test) in parallel
  - Effort: done

### Testing
- [ ] **Expand test coverage to 60%+**
  - Command: npm run test:coverage
  - Add tests for: auth middleware, API proxy, LLM routing, key management
  - Effort: 2-3 days

### Documentation
- [x] **Create .env.example**
  - Content: JWT_SECRET, AUTH_PASSWORD, AUTH_DISABLED, ALLOWED_ORIGINS, RATE_LIMIT_*, ELEVENLABS_API_KEY + all client keys
  - Effort: done — file exists with server section added 2026-06-09

- [ ] **Update README — replace NOT PRODUCTION READY warning with resolved checklist**
  - Only after all 5 security items complete
  - Effort: 30 min

---

## ORDERED EXECUTION SEQUENCE

1. Add helmet() — 30 min, zero risk
2. Fix CORS — 1 hour
3. Add rate limiting — 4 hours
4. Move API keys server-side — 2 days
5. Implement authentication — 1-3 days
6. Create .env.example
7. Add CI workflow
8. Expand test coverage to 60%
9. Update README warning block
10. git tag -a v1.0.0-rc1 -m "Release Candidate 1"

---

## RISK REGISTER

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| API keys in localStorage | Critical | Confirmed | Server-side proxy only fix |
| No auth exposes LLM API credits | Critical | Confirmed | Auth before any deployment |
| Path traversal via file input | High | Possible | Input sanitization middleware |
| CORS wildcard enables CSRF | High | Confirmed | Explicit origin whitelist |

---

## VALIDATION GATE

- [ ] Zero API keys visible in browser devtools localStorage
- [ ] curl /api/analyze without auth returns 401
- [ ] 11th LLM request in 60s returns 429
- [ ] CORS unlisted origin blocked
- [ ] helmet headers present on all responses
- [ ] npm run test:coverage >= 60%
- [ ] npm run lint clean
- [ ] npm run typecheck clean
- [ ] .env.example exists, no real keys
- [ ] README warning replaced with checklist
