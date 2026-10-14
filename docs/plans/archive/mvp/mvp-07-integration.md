# MVP-07: End-to-End Integration & Testing

**Owner**: Integration Dev | **Duration**: 2 days | **Depends on**: mvp-03, mvp-04, mvp-05, mvp-06

## Goal
Verify full flow works: GitHub OAuth → Server registration (QR) → WebSocket → Terminal → Agent notifications.

## Do
1. **Local integration test script** (`scripts/integration-test.sh`):
   ```bash
   #!/bin/bash
   set -e
   
   # 1. Build Docker image
   docker build -t termanch:mvp -f docker/Dockerfile ..
   
   # 2. Start services (with TryCloudflare)
   docker compose up -d
   
   # 3. Wait for cloudflared to get URL
   sleep 10
   TUNNEL_URL=$(docker compose logs cloudflared 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1)
   echo "Tunnel URL: $TUNNEL_URL"
   
   # 4. Register server
   REG_OUTPUT=$(docker compose exec termanch-server termanch-server --register)
   TOKEN=$(echo "$REG_OUTPUT" | grep "Registration Token:" | cut -d' ' -f3)
   echo "Registration token: $TOKEN"
   
   # 5. Poll registration endpoint
   for i in {1..30}; do
       RESP=$(curl -s -X POST "$TUNNEL_URL/register" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN\"}")
       if echo "$RESP" | grep -q "server_url"; then
           SERVER_URL=$(echo "$RESP" | jq -r .server_url)
           echo "Server registered: $SERVER_URL"
           break
       fi
       sleep 2
   done
   
   # 6. Run Playwright E2E test
   cd ../packages/client
   VITE_SERVER_URL="$SERVER_URL" VITE_REG_TOKEN="$TOKEN" pnpm test:e2e
   ```

2. **Playwright E2E test** (`packages/client/tests/e2e.spec.ts`):
   ```typescript
   import { test, expect } from '@playwright/test';
   
   test('full MVP flow', async ({ page }) => {
     // 1. Navigate to hosted client
     await page.goto('https://app.termanch.dev');
     
     // 2. Login with GitHub (use test account or mock)
     await page.click('text=Login with GitHub');
     // ... complete OAuth flow (may need test GitHub app)
     
     // 3. Add server (if not already registered)
     await page.click('text=Add Server');
     // QR code should be visible
     
     // 4. Wait for server to appear in list
     await expect(page.locator('.server-card')).toBeVisible({ timeout: 30000 });
     await page.click('.server-card:first-child');
     
     // 5. Session list should appear
     await expect(page.locator('.session-list')).toBeVisible();
     await page.click('.session-row:first-child');
     
     // 6. Terminal should render
     await expect(page.locator('.xterm')).toBeVisible();
     
     // 7. Type command and verify output
     await page.keyboard.type('echo hello\n');
     await expect(page.locator('.xterm')).toContainText('hello', { timeout: 5000 });
     
     // 8. Test agent notification (requires tmux + codex on server)
     // This part runs against real VPS in CI
   });
   ```

3. **Manual test checklist** (execute on test VPS):
   - [ ] Docker compose starts, all 3 services healthy
   - [ ] Cloudflared gets tunnel URL (trycloudflare or named)
   - [ ] `termanch-server --register` prints token + QR
   - [ ] Scan QR in `https://app.termanch.dev` → server appears
   - [ ] GitHub OAuth completes, user logged in
   - [ ] Click server → session list shows tmux sessions
   - [ ] Click session → terminal renders prompt
   - [ ] Type `ls` → output appears
   - [ ] In another terminal: `tmux new-session -s test && codex` → notification appears
   - [ ] Type prompt in UI → appears in agent's tmux pane
   - [ ] Disconnect/reconnect browser → session persists
   - [ ] Restart VPS → tunnel reconnects, server re-registers (if trycloudflare)

4. **Performance baseline**:
   - `docker stats` → memory < 300MB total
   - `time curl -k https://tunnel-url/health` → < 200ms
   - WebSocket round-trip latency < 100ms (via tunnel)
   - Terminal keystroke → render < 50ms

5. **Security checks**:
   - CORS headers present on `/register` and WS upgrade
   - GitHub JWT validation rejects invalid/expired tokens
   - Registration token single-use, expires in 10 min
   - Rate limiting active on `/register` and WS auth
   - No secrets in logs

6. **Documentation**:
   - `docs/mvp-test-report.md` with results
   - `docs/mvp-known-issues.md` for post-MVP backlog

## Check
```bash
# Run in CI
./scripts/integration-test.sh

# Manual verification on test VPS
```

## Go/No-Go Criteria for MVP Release
- All manual checklist items pass
- Playwright test passes in CI (against staging VPS)
- Docker image < 150MB
- Runs on 512MB VPS (total container memory < 400MB)
- Cloudflare Tunnel connects successfully (both trycloudflare and named)
- GitHub OAuth works for new users
- No critical security issues (TLS, auth validation, rate limiting)
- Cross-origin WebSocket works from app.termanch.dev