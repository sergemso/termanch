# MVP-01: Repository Setup

**Owner**: Architect | **Duration**: 0.5 days | **Depends on**: None

## Goal
Minimal monorepo structure for Cargo + pnpm workspaces, CI, Docker, Cloudflare Pages deploy.

## Do
1. **Root `Cargo.toml`**
   ```toml
   [workspace]
   members = ["packages/*"]
   resolver = "2"
   ```

2. **Root `pnpm-workspace.yaml`**
   ```yaml
   packages:
     - packages/client
   ```

3. **Directories**: `packages/{server,agent,core,client}` (no `hook` for MVP)

4. **`.github/workflows/ci.yaml`**: cargo check, cargo test, pnpm install, pnpm build

5. **`.github/workflows/deploy-pages.yaml`**: Deploy client to Cloudflare Pages on push to master
   ```yaml
   name: Deploy to Cloudflare Pages
   on:
     push:
       branches: [master]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v2
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: 'pnpm'
         - run: pnpm install --frozen-lockfile
         - run: pnpm --filter termanch-client build
         - uses: cloudflare/pages-action@v1
           with:
             apiToken: ${{ secrets.CF_PAGES_API_TOKEN }}
             accountId: ${{ secrets.CF_PAGES_ACCOUNT_ID }}
             projectName: termanch
             directory: packages/client/dist
             branch: master
   ```

6. **`docker/Dockerfile`**: Multi-stage (builder + runner, server-only)

7. **Root files**: `.gitignore`, `.editorconfig`, `LICENSE` (MIT), `README.md`

## Check
```bash
cargo check --workspace && pnpm install
# CI passes on empty project
```

## Output
- Working monorepo skeleton
- CI green on empty project
- Cloudflare Pages deploy workflow configured