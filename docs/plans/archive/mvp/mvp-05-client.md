# MVP-05: Svelte 5 Client (Terminal + Session List + GitHub OAuth + QR Registration)

**Owner**: Client Dev | **Duration**: 3 days | **Depends on**: mvp-02

## Goal
Web app hosted on Cloudflare Pages: GitHub OAuth login → Add Server via QR → Session list → Terminal with agent notifications.

## Do
1. **`packages/client/package.json`**
   ```json
   {
     "name": "termanch-client",
     "version": "0.1.0",
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "tsc && vite build",
       "preview": "vite preview",
       "test": "playwright test"
     },
     "dependencies": {
       "svelte": "^5.0.0",
       "xterm": "^5.3.0",
       "@xterm/addon-fit": "^0.10.0",
       "@xterm/addon-webgl": "^0.17.0",
       "qrcode": "^1.5.3"
     },
     "devDependencies": {
       "@sveltejs/vite-plugin-svelte": "^4.0.0",
       "vite": "^5.0.0",
       "typescript": "^5.0.0",
       "playwright": "^1.40.0",
       "@types/qrcode": "^1.5.5"
     }
   }
   ```

2. **`packages/client/vite.config.ts`** — Basic Vite + Svelte + TS config
   ```typescript
   import { defineConfig } from 'vite';
   import { sveltekit } from '@sveltejs/kit/vite';
   
   export default defineConfig({
     plugins: [sveltekit()],
     build: {
       outDir: 'dist',
       sourcemap: true,
     },
   });
   ```

3. **`packages/client/src/protocol.ts`** — Manual TS mirror of Rust protocol types (from mvp-02)

4. **`packages/client/src/lib/transport.ts`** — WebSocket client:
   - `WebSocketClient` with auto-reconnect (exponential backoff 1s..30s)
   - Message queue during disconnect
   - Typesafe send/recv using protocol types
   - Connect to user-provided `server_url` (from registration)

5. **`packages/client/src/lib/auth.ts`** — GitHub OAuth flow:
   - `login()` → redirect to `https://github.com/login/oauth/authorize?client_id=${VITE_GITHUB_CLIENT_ID}&redirect_uri=https://app.termanch.dev/callback&scope=read:user user:email`
   - Callback page (`/callback`) exchanges code for access token via GitHub API
   - Store JWT in `localStorage`
   - `logout()` → clear storage, redirect to login

6. **`packages/client/src/lib/registration.ts`** — Server registration:
   - `generateToken()` → HMAC token (client-side, same secret derivation)
   - `showQR(token)` → render QR code using `qrcode` library
   - `pollRegister(token)` → GET `/register?token=...` until 200 or timeout
   - Store registered servers in `localStorage`: `{ id, name, url, token }[]`

7. **`packages/client/src/stores/app.ts`** — Svelte 5 runes store:
   - `githubJwt`, `user`, `servers[]`, `activeServer`, `sessions[]`, `activeSession`, `terminalBuffer`, `notifications[]`

8. **Components**:
   - **`Login.svelte`**: "Login with GitHub" button, handles OAuth redirect
   - **`Callback.svelte`**: Handles `?code=...` from GitHub, exchanges for token
   - **`ServerList.svelte`**: Cards showing server name, status, session count; "Add Server" button
   - **`AddServerModal.svelte`**: QR code display + instructions ("Run `docker compose exec termanch-server termanch-server --register` and scan")
   - **`SessionList.svelte`**: Table of sessions (id, name, agent badge), click to attach
   - **`Terminal.svelte`**: xterm.js + WebGL + FitAddon
     - On mount: create terminal, fit to container
     - On data: `term.write(base64Decode(data))`
     - On keystroke: send `Input` message
     - On resize: send `Resize` message
   - **`AgentNotification.svelte`**: Toast/banner for `AgentEvent` (spawned/completed/error)
   - **`Header.svelte`**: User avatar, server selector, logout

9. **`packages/client/src/App.svelte`** — Layout:
   - Auth guard: redirect to Login if no JWT
   - If no servers: show ServerList with "Add Server" prominent
   - If server selected: show SessionList (sidebar) + Terminal (main)
   - Top bar: Server name, user info, disconnect
   - Notifications: AgentNotification stack

10. **`packages/client/src/routes/`** — SvelteKit file routing:
    - `+layout.ts` — Auth guard
    - `+page.svelte` — Main app (ServerList or Terminal)
    - `callback/+page.svelte` — OAuth callback handler

11. **Build config for Cloudflare Pages**:
    - Output: `packages/client/dist`
    - Build command: `pnpm --filter termanch-client build`
    - Env vars: `VITE_GITHUB_CLIENT_ID`

## Check
```bash
pnpm --filter termanch-client build
pnpm --filter termanch-client preview
# Loads, OAuth works, QR registration works, terminal renders, types ls
```

## MVP Scope
- No PWA, no service worker, no IndexedDB
- No mobile keyboard row, gestures, voice
- No chat view, diff viewer, preview
- Desktop Chrome only
- Cross-origin WebSocket (CORS handled by server)