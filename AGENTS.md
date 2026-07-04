# AGENTS.md

## Cursor Cloud specific instructions

This repo is a Vendor Risk Assessment Agent with two services. Standard commands live in `readme.md`; the notes below are the non-obvious caveats.

### Services

| Service | Dir | Dev command | Port |
| --- | --- | --- | --- |
| Backend (FastAPI) | repo root | `. .venv/bin/activate && uvicorn api.main:app --reload --port 8000` | 8000 |
| Frontend (Next.js) | `frontend/` | `npm run dev` | 3000 |

- The backend must run with the venv activated (`. .venv/bin/activate`). Python is `python3` on this box (there is no bare `python` outside the venv).
- The frontend calls the backend at `http://localhost:8000` by default; override with `NEXT_PUBLIC_API_BASE_URL`. Start the backend before exercising the UI's "Generate risk brief" flow.
- Tests: `pytest` from the repo root with the venv active.

### Non-obvious caveats

- `npm run lint` is broken: `package.json` pins `next@latest`, which resolves to Next.js 16 where the `next lint` command was removed, and there is no ESLint config in the repo. Use `npm run build` (which runs the TypeScript typecheck) as the frontend check instead.
- Vultr Serverless Inference is optional and **advisory only** — it never assigns risk scores. It activates only when BOTH `VULTR_API_KEY` and `VULTR_INFERENCE_ENDPOINT` (e.g. `https://api.vultrinference.com/v1/chat/completions`) are set. Provide these as Cloud Agent secrets; never commit keys. A failed/invalid inference call is caught in `agent/planner.py` and does not break the deterministic `/assess` flow.
- For a quick end-to-end check without the UI, `POST /assess` with `vendor_name` (form field) plus `soc2_report` (PDF), `questionnaire` (JSON/CSV), and optional `breach_history` file uploads.
