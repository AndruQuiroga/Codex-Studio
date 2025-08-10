## Summary
Describe the change and why it’s needed.

## Changes
- [ ] API: …
- [ ] Web: …
- [ ] Infra/CI: …

## Testing
Steps to verify locally:
1. Create `.env` under `apps/api` (see `.env.example` if present)
2. API: `cd apps/api && source .venv/bin/activate && uvicorn main:app --reload --port 5050`
3. Web: `cd apps/web && pnpm dev`
4. Open http://localhost:3000 — use the Sidebar to open a file, edit, save

## Screenshots / Demos
<!-- paste images or terminal output -->

## Checklist
- [ ] No secrets committed
- [ ] Conventional commit message
- [ ] CI green
