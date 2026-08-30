# rebel-mvp

This repository holds **two separate products** for restaurant purchasing.
They share a domain but not a stack, and neither depends on the other.

| | Where | Stack | Interface |
|---|---|---|---|
| **Invoice Guard** | `/` (this README) | Python 3.11 · FastAPI · PostgreSQL | WhatsApp bot |
| **Restaurant Purchasing Intelligence** | [`/web`](web/README.md) | Next.js 16 · TypeScript · Three.js · Supabase | Hebrew-first web app |

Both read supplier invoices with a vision LLM and compare prices against
purchase history. Invoice Guard replies over WhatsApp; the web app is a
browser SaaS with a 3D landing experience, upload flow, results screen and
dashboard.

### Working in VS Code

Open the multi-root workspace rather than the plain folder, so both stacks get
the right tooling context at once:

```bash
code rebel-mvp.code-workspace
```

Setup for both, from a fresh clone:

```bash
# Python side (repo root)
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

# Web side
cd web && npm install && cp .env.example .env.local && cd ..
```

Then accept the recommended-extensions prompt, and run
`Ctrl/Cmd+Shift+P → Python: Select Interpreter → ./.venv`.

The workspace ships debug configurations for the Next.js dev server, Chrome,
Vitest, uvicorn and pytest (**Run and Debug** panel), plus tasks for the common
commands (`Ctrl/Cmd+Shift+P → Tasks: Run Task`).

Neither `.env` needs real keys just to look around: `pytest` runs on SQLite, and
the web app shows a Hebrew setup notice instead of crashing when Supabase is
unconfigured. For the full web UI with no backend at all, run the
**web: demo mode** task and open `/demo`.

---

## Invoice Guard (this directory)

Invoice Guard is a B2B tool for restaurants that automatically detects
supplier price anomalies from invoices sent over WhatsApp.

**What it does (MVP scope):**
1. A restaurant owner sends a supplier invoice (photo or PDF) on WhatsApp.
2. A vision-capable LLM extracts the structured data (supplier, invoice
   header, line items) as JSON only - it never decides anything financial.
3. The system matches the supplier and each product against what's already
   known for that restaurant (conservative exact-match, restaurant-isolated).
4. Deterministic Python code compares each item's price against that
   product's purchase history for that supplier over the last N days.
5. If a price rose more than a configurable threshold, restaurant owner
   gets a clear WhatsApp alert with the previous price, the new price, the
   percentage change, and the estimated additional cost. Otherwise they get
   a simple confirmation that the invoice was received and looked normal.

This is explicitly **not** an ERP, inventory system, procurement platform,
or accounting system - see "MVP Limitations" below.

## Project Structure

```
app/
  main.py              FastAPI app, startup table creation
  config.py            Settings loaded from environment/.env

  api/
    whatsapp.py        Webhook endpoints (GET verify, POST receive)

  ai/
    prompts.py          System/user prompts for the Vision LLM
    extractor.py         Calls the LLM, parses+validates the JSON response

  guard/
    matching.py          Name/unit normalization, supplier/product matching
    price_guard.py        History lookup, threshold logic, severity, impact

  db/
    database.py           SQLAlchemy engine/session
    models.py              ORM models (restaurants, suppliers, products,
                            invoices, invoice_items, price_alerts)
    repository.py           Data-access helpers (restaurant/duplicate lookups)

  schemas/
    invoice.py               Pydantic schema for the LLM's JSON output

  services/
    invoice_service.py         Orchestrates extract -> match -> save -> guard
    whatsapp_service.py         WhatsApp Cloud API transport (send/receive/media)

tests/                     pytest suite + invoice fixtures (tests/fixtures/)
docker-compose.yml         PostgreSQL for local development
Dockerfile                 Container image for the API
.env.example                Documented environment variables
```

**Critical business rule enforced throughout the code:** the LLM only
*extracts* data. Every financial decision - matching, percentage change,
estimated impact, alert severity - happens in plain deterministic Python in
`app/guard/price_guard.py`, using `Decimal` arithmetic, and is fully unit
tested without ever calling the LLM.

## Installation

Requires Python 3.12+ (tested down to 3.11) and Docker.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLAlchemy Postgres connection string. Defaults match `docker-compose.yml`. |
| `AI_API_KEY` | Anthropic API key for the Vision LLM. Get one at https://console.anthropic.com/ |
| `AI_MODEL` | Claude model id to use for extraction (default `claude-sonnet-4-5`). |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business Cloud API access token. |
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp Business phone number ID. |
| `WHATSAPP_VERIFY_TOKEN` | Any string you choose; must match the "Verify token" configured in the Meta webhook screen. |
| `WHATSAPP_APP_SECRET` | **Required.** Meta app secret, used to verify the `X-Hub-Signature-256` on inbound webhooks. Without it every inbound webhook is rejected. |
| `PRICE_ALERT_THRESHOLD` | Fraction above historical average that triggers an alert (default `0.03` = 3%). |
| `PRICE_ALERT_CRITICAL_THRESHOLD` | Fraction above which severity becomes "critical" instead of "warning" (default `0.10` = 10%). |
| `MIN_CONFIDENCE` | Minimum extraction confidence (0-1) required before an item can trigger an automatic alert (default `0.85`). |
| `PRICE_HISTORY_WINDOW_DAYS` | How many days back to look for price history (default `60`). |

Secrets are never committed, never printed to logs, and only read from
environment variables via `app/config.py` (`pydantic-settings`).

## Database Setup

Start PostgreSQL with Docker Compose:

```bash
docker compose up -d db
```

Tables are created automatically from the SQLAlchemy models on API
startup (`Base.metadata.create_all` in `app/main.py`) - there's no manual
migration step for this MVP. (A production deployment would replace this
with Alembic migrations.)

## Running Locally

```bash
docker compose up -d db     # Postgres
source .venv/bin/activate
uvicorn app.main:app --reload
```

The API is now at `http://localhost:8000` (docs at `/docs`, health check at
`/health`).

Alternatively, run everything (API + Postgres) in Docker:

```bash
docker compose up --build
```

## Testing

```bash
source .venv/bin/activate
pytest
```

The suite (47 tests) runs entirely against an in-memory SQLite database and
never calls the real Vision LLM or WhatsApp API - the Vision LLM call is
monkeypatched with real invoice fixtures from `tests/fixtures/`, so the
whole extract -> match -> price-guard -> WhatsApp-message pipeline is
exercised end-to-end, including a full webhook request via FastAPI's
`TestClient` in `tests/test_webhook_e2e.py`. Covers: extraction schema
validation, supplier/product matching (including restaurant isolation),
first-price/previous-price/average-price comparisons, threshold and
severity logic, estimated-impact math, duplicate invoice detection, and
low-confidence items being excluded from automatic alerts, and webhook
signature verification (valid, wrong-secret, tampered-body, malformed
header and unset-secret cases, each asserting no rows are written).

## WhatsApp Webhook Setup

1. Create a Meta developer app with the WhatsApp product
   (https://developers.facebook.com/apps/).
2. Under WhatsApp -> API Setup, copy the **temporary access token** and
   **phone number ID** into `WHATSAPP_ACCESS_TOKEN` and
   `WHATSAPP_PHONE_NUMBER_ID` in `.env`.
3. Under **Settings -> Basic**, reveal the **App Secret** and copy it into
   `WHATSAPP_APP_SECRET`. Inbound webhooks are rejected without it — this is
   what proves a delivery actually came from Meta rather than from anyone who
   guessed the URL.
4. Expose your local server publicly (e.g. `ngrok http 8000`) since Meta
   needs a public HTTPS URL to call your webhook.
5. Under WhatsApp -> Configuration, set the webhook URL to
   `https://<your-public-url>/webhook/whatsapp` and the verify token to
   whatever you set as `WHATSAPP_VERIFY_TOKEN` in `.env`.
6. Subscribe to the `messages` webhook field.
7. Add your own WhatsApp number as a test recipient (in Meta's sandbox,
   only verified test numbers can message the app).

If messages are delivered but nothing happens, check the logs for
`Rejected WhatsApp webhook with missing or invalid signature` — that means
`WHATSAPP_APP_SECRET` is unset or does not match the app sending the events.

A restaurant is looked up (or auto-created on first contact) by the sending
WhatsApp phone number (`restaurants.whatsapp_phone`).

## AI API Setup

Invoice Guard uses Anthropic's Claude (vision-capable) to read invoice
images/PDFs. Create a key at https://console.anthropic.com/ and set it as
`AI_API_KEY` in `.env`. The model id is configurable via `AI_MODEL` if you
want to point at a different Claude model.

## Sending Your First Invoice

1. Start Postgres and the API (see "Running Locally").
2. Set up the WhatsApp webhook (see above) pointing at your running API.
3. From the WhatsApp number you registered as a test recipient, send a
   photo or PDF of a supplier invoice to your WhatsApp Business number.
4. You'll get back a confirmation message. Since this is the first invoice
   for that supplier/product combination, it registers a price baseline
   ("נרשם מחיר בסיס ראשון").
5. Send a second invoice from the same supplier with the same product but a
   higher unit price. If the increase is above `PRICE_ALERT_THRESHOLD`,
   you'll get a price alert message with the previous price, new price,
   percentage change, and estimated additional cost.

You can exercise the same flow locally without WhatsApp by calling
`app.services.invoice_service.process_invoice(...)` directly (see
`tests/test_invoice_service.py` for a working example against the fixtures
in `tests/fixtures/`).

## MVP Limitations

- **Inbound webhooks require `WHATSAPP_APP_SECRET`.** Every `POST` is verified
  against Meta's `X-Hub-Signature-256` header before the body is parsed, and the
  endpoint **fails closed**: with the secret unset, all inbound webhooks are
  rejected with 403 and an error is logged. This is deliberate — the endpoint
  writes to a restaurant's price history, so an unconfigured deployment must not
  accept unauthenticated requests. Set it from
  *App Dashboard → Settings → Basic → App Secret*.
- **No rate limiting.** A validly-signed flood would still trigger one paid
  vision call per message. Meta's own delivery limits are the only ceiling
  today.
- **Product matching is exact-normalized-name only.** No fuzzy matching.
  "חזה עוף 5 ק"ג", "עוף חזה 5KG" and "חזה עוף טרי" are treated as three
  different products on purpose - the system never guesses that two
  differently-named items are the same to avoid false price alerts.
- **No manual review UI.** Invoices missing critical data are marked
  `needs_review` in the database, but there's no dashboard to review them -
  only the WhatsApp reply and direct DB access.
- **No authentication beyond WhatsApp phone number.** Anyone who can send
  a WhatsApp message to your business number is treated as that restaurant
  (looked up/created by phone number). There's no login system.
- **Single WhatsApp number per deployment**, and one restaurant per phone
  number (no multi-user/multi-location support).
- **Background processing is FastAPI `BackgroundTasks`**, not a durable
  queue - a container restart mid-processing will drop that invoice. Fine
  for proving the concept; not durable enough for production volume.
- **No image/PDF storage.** Uploaded files are processed in memory and not
  persisted (`source_url` in the `invoices` table is present in the schema
  for future use but unpopulated in the MVP).
- **Migrations use `create_all` on startup**, not Alembic - fine for a
  single-developer MVP, not for iterating a shared production schema.
- **Duplicate detection requires an invoice number.** An invoice with no
  printed invoice number can never be flagged as a duplicate (there's
  nothing reliable to compare).

## What I'd Build Next (not built now)

- Fuzzy/aliased product matching with an explicit "confirm this is the same
  product" WhatsApp reply flow, instead of always auto-creating a new
  product on a near-miss.
- Persisted invoice images/PDFs (e.g. S3-compatible storage) linked via
  `source_url`, plus a lightweight review view for `needs_review` invoices.
- Supplier price benchmarking across restaurants (opt-in, anonymized).
- WhatsApp commands (e.g. "show me last month's spend with X supplier").
- Alembic migrations and a durable task queue for background processing.
- A minimal read-only dashboard for browsing invoices/alerts per restaurant.
- Multi-location and multi-user support per restaurant account.
