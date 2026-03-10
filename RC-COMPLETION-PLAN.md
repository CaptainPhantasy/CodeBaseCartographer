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

- [ ] **Implement authentication**
  - File: server/src/middleware/auth.ts (create) + src/components/Login.tsx (create)
  - Approach: JWT-based auth with refresh tokens, OR integrate Clerk/Auth0 for faster path
  - Fast path: npm install @clerk/clerk-react + Clerk dashboard (1 day vs 3 days custom)
  - Validation: All API routes return 401 without valid token
  - Effort: 1-3 days

- [ ] **Move API keys server-side — remove from localStorage**
  - File: server/src/config/keys.ts (create) + update all client-side key usage
  - Command: grep -r "localStorage" src/ --include="*.ts" --include="*.tsx"
  - Validation: Browser devtools shows no API keys in localStorage
  - Effort: 2 days

- [ ] **Add rate limiting**
  - File: server/src/middleware/rateLimit.ts (create)
  - Package: npm install express-rate-limit
  - Config: 100 req/15min general; 10 req/min LLM proxy endpoints
  - Validation: 11th LLM request in 60s returns 429
  - Effort: 4 hours

- [ ] **Fix CORS — replace wildcard with explicit origin list**
  - File: server/src/app.ts
  - Change: origin: "*" to origin: process.env.ALLOWED_ORIGINS?.split(",")
  - Validation: Cross-origin request from unlisted domain blocked
  - Effort: 1 hour

- [ ] **Add security headers via helmet**
  - Package: npm install helmet
  - File: server/src/app.ts — add app.use(helmet())
  - Validation: curl -I http://localhost:3000 shows X-Frame-Options header
  - Effort: 30 min

### CI/CD
- [ ] **Add CI workflow for every push**
  - File: .github/workflows/ci.yml (create)
  - Steps: npm run lint && npm run typecheck && npm run test
  - Effort: 1 hour

### Testing
- [ ] **Expand test coverage to 60%+**
  - Command: npm run test:coverage
  - Add tests for: auth middleware, API proxy, LLM routing, key management
  - Effort: 2-3 days

### Documentation
- [ ] **Create .env.example**
  - Content: JWT_SECRET=, ANTHROPIC_API_KEY=, OPENAI_API_KEY=, ALLOWED_ORIGINS=, ELEVENLABS_API_KEY=
  - Effort: 15 min

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
