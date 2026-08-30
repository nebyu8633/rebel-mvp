# בינת רכש למסעדות — Restaurant Purchasing Intelligence

A Hebrew-first SaaS web app for Israeli restaurants. A restaurant owner uploads
supplier invoices in the browser, watches them being read, and gets a purchasing
analysis showing where prices have risen and what that may be costing them
annually.

The interface is Hebrew (`he-IL`) and right-to-left throughout. Code, database
identifiers and this README are in English by convention.

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Setup](#setup)
- [Supabase setup](#supabase-setup)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Testing](#testing)
- [AI provider configuration](#ai-provider-configuration)
- [Production deployment](#production-deployment)
- [Known limitations](#known-limitations)
- [Future roadmap](#future-roadmap)

---

## What it does

1. **Home (`/`)** — a real-time 3D scene built with Three.js, with the primary
   action (`בדיקת החיסכון שלי`) always obvious.
2. **Upload (`/analyze`)** — drag-and-drop or camera capture, up to 10 files of
   10MB each (PDF, JPG, PNG).
3. **Analysis (`/analysis/[id]`)** — six processing steps, each with its own
   live status.
4. **Results (`/results/[id]`)** — the headline potential annual saving, a
   sortable table of opportunities, per-product detail, and a
   "how was this calculated?" section.
5. **Dashboard (`/dashboard`)** — invoices, products, savings and settings, with
   price history over time.

### The rule that shapes the whole system

**The LLM extracts data. The code decides what it means.**

The vision model is only ever asked to read what is printed on a document into
a fixed schema. It never supplies a market price, never judges whether a price
is high, and never computes a saving. Every financial figure comes from
deterministic TypeScript in `lib/savings/`, using integer minor units, and is
covered by unit tests that never call the model.

Two consequences worth knowing before you run it:

- **Benchmarks ship empty on purpose.** The spec forbids inventing a market
  price, so `benchmarks` has no rows. Comparisons therefore run against *your
  own* purchase history, and the UI says `אין מספיק נתוני השוואה` rather than
  showing a number it cannot support. Populate that table only from a real,
  citable source.
- **A first analysis of a single invoice honestly reports no price changes.**
  There is nothing to compare it against. Upload invoices from several months
  in one go and the very first analysis has real comparisons — the upload
  screen says so. Or set `NEXT_PUBLIC_DEMO_MODE=true` and open `/demo` to see
  the fully-populated experience with clearly-labelled fictional data.

---

## Architecture

```
web/
  app/
    page.tsx                        /              3D home
    analyze/                        /analyze       upload
    analysis/[analysisId]/          processing, polls the analysis row
    results/[analysisId]/           savings results
    login/  signup/                 Supabase Auth
    demo/                           labelled fictional data (gated)
    dashboard/
      page.tsx                      overview
      invoices/  invoices/[id]/     list, detail, delete
      products/  savings/  settings/
    api/
      analyses/                     POST create + run pipeline
      analyses/[id]/                GET status (polled)
      invoices/[id]/                DELETE
  components/
    3d/        Scene, InvoiceDocument, FloatingData, SceneStage
    ui/        Button Card EmptyState SetupNotice DemoBadge Ltr
    upload/    Dropzone FileRow UploadForm
    analysis/  ProcessingSteps
    results/   SavingsHero SavingsTable ProductDetailPanel
               TopOpportunitiesChart HowWasThisCalculated
    dashboard/ DashboardNav StatCard OpportunityList InvoiceList
               PriceTrendChart SettingsForm DeleteInvoiceButton
    auth/      AuthForm
  lib/
    ai/        provider (interface) · anthropic · schema · prompts
    invoices/  normalizeName · normalizeUnit · parsePackSize
               normalizeProduct · validateFile · pipeline
    savings/   money · calculateSavings · confidence
    supabase/  client · server · admin · middleware · storage
    auth/      session · actions
    dashboard/ queries
    i18n/      he.ts (active) · en.ts (scaffold) · units
    format/    currency · date
    analytics/ track
    demo/      demoData
  supabase/migrations/0001_init.sql
  types/  hooks/  scripts/
```

Layers are kept apart: nothing in `components/` imports the AI or database
layer directly, and `server-only` makes it a build error to pull a server
module into a client bundle.

### Hebrew and RTL

- `<html lang="he" dir="rtl">`, Heebo (Hebrew + Latin subsets).
- Every user-visible string comes from `lib/i18n/he.ts`. There are no
  hardcoded strings in components.
- Layout uses logical properties (`ms-*`, `pe-*`, `border-s`, `text-start`)
  throughout, so RTL is structural rather than a right-aligned afterthought.
- **Currency does not use `Intl`'s `style: "currency"`.** For `he-IL` that
  produces `12,394 ₪` — symbol after the number, with embedded directional
  marks. `lib/format/currency.ts` formats the number and prepends `₪`, giving
  `₪12,394`, and tests lock that down.
- Invoice numbers, SKUs, filenames and env var names are wrapped in `<Ltr>`,
  which applies `dir="ltr"` plus `unicode-bidi: isolate`. Without it,
  `.env.local` renders as `env.local.`.

---

## Setup

Requires **Node.js 22+**.

```bash
cd web
npm install
cp .env.example .env.local
```

Then fill in `.env.local` — see [Environment variables](#environment-variables).

---

## Supabase setup

The app needs a Supabase project for its database, authentication and file
storage.

1. Create a project at <https://supabase.com/dashboard>.
2. Open **SQL Editor** and run the entire contents of
   `supabase/migrations/0001_init.sql`. This creates the nine tables, their
   indexes, all Row Level Security policies, the private `invoices` storage
   bucket and its policies.
3. Under **Project Settings → API**, copy:
   - *Project URL* → `NEXT_PUBLIC_SUPABASE_URL`
   - *anon public* key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - *service_role* key → `SUPABASE_SERVICE_ROLE_KEY`
4. Under **Authentication → Providers**, enable **Anonymous sign-ins**. This is
   required: a visitor gets an anonymous session before uploading, so their
   rows have a real owner and are covered by RLS from the first write. Signing
   up later upgrades that same user in place, so the pre-signup analysis
   carries over with no data migration.
5. *(Optional)* enable the **Google** provider for OAuth sign-in.

### Verify Row Level Security before putting real data in

RLS is written but has not been executed against a live project. Before
trusting it with real invoices, check isolation by hand:

1. Sign up as two separate users in two browser profiles.
2. Upload an invoice as user A.
3. As user B, request user A's analysis id directly:
   `/results/<user-A-analysis-id>`. It must render **not found**, not data.
4. In the SQL editor, confirm `select * from invoices` returns only the calling
   user's rows when run with that user's JWT.

---

## Environment variables

Copy `.env.example` to `.env.local`.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL. Public; protected by RLS. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key. Public; protected by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server only.** Bypasses RLS. Never prefix with `NEXT_PUBLIC_`. |
| `AI_API_KEY` | yes | Anthropic API key, from <https://console.anthropic.com/>. |
| `AI_PROVIDER` | no | Default `anthropic`. |
| `AI_MODEL` | no | Default `claude-opus-5`. |
| `MIN_CONFIDENCE` | no | Default `0.85`. Below this, a line item never drives an automatic savings opportunity. |
| `PRICE_HISTORY_WINDOW_DAYS` | no | Default `365`. How far back comparisons look. |
| `NEXT_PUBLIC_DEMO_MODE` | no | Default `false`. `true` enables `/demo`. Never enable in production. |

> `NEXT_PUBLIC_*` variables are inlined into the bundle **at build time**, not
> read at runtime. Setting `NEXT_PUBLIC_DEMO_MODE=true` in front of
> `npm run start` has no effect — it has to be set for `npm run build` (or for
> `npm run dev`, which compiles on demand). The server-only variables above are
> read at runtime as normal.

`.env.local` is gitignored. No secret is ever read in client code: the
service-role key and the AI key are only reachable from modules that import
`server-only`.

---

## Local development

```bash
cd web
npm run dev            # http://localhost:3000
```

Other scripts:

```bash
npm run build          # production build
npm run start          # serve the production build
npm run typecheck      # tsc --noEmit
npm test               # vitest
```

### Seeing the product without any setup

```bash
NEXT_PUBLIC_DEMO_MODE=true npm run dev
# or, to check it in a production build:
NEXT_PUBLIC_DEMO_MODE=true npm run build && npm run start
```

Then open `/demo`. It reads only from `lib/demo/demoData.ts` — no database, no
AI key — and every screen carries the `נתוני דמו` badge. Without the flag the
route returns 404.

### Sending your first real invoice

1. Complete the Supabase and AI setup above.
2. Open `/`, click `בדיקת החיסכון שלי`.
3. Upload a supplier invoice (photo or PDF). Ideally upload several from
   different months at once — that gives the first analysis something to
   compare.
4. Watch the six processing steps, then the results.
5. Click `יצירת חשבון חינם` to keep the analysis, then open `/dashboard`.

---

## Testing

```bash
npm test
```

103 tests, all running against pure functions with no network, no database and
no AI calls. They cover the parts where a mistake would be silent and
expensive:

- **Name normalization** — formatting differences collapse (`10KG` = `10 kg`),
  but word order and specification do not (`חזה עוף טרי` ≠ `חזה עוף קפוא`).
- **Unit normalization** — Hebrew and English variants; unknown units return
  `null` rather than being guessed; a carton never converts to a piece.
- **Pack size parsing** — `₪100 / 10kg` → `₪10/kg`; a name carrying two
  different pack sizes is refused as ambiguous.
- **Money** — symmetric half-up rounding, integer minor units, no float drift.
- **Savings** — the worked example (109 → 120 over 10kg = ₪110); returns
  `null` when the price did not rise; refuses to annualize from a window too
  short to support it.
- **Currency formatting** — the symbol is always before the number.
- **File validation** — size, type, count, and executables rejected even when
  they declare a PDF MIME type.
- **Storage paths** — a crafted filename cannot escape its business folder.

Rendering is verified separately in a real browser:

```bash
npm run build && npm run start
node scripts/screenshot.mjs http://localhost:3000 ./screenshots / /analyze /demo
```

This reports, per breakpoint, whether the WebGL canvas actually painted,
the document direction and language, horizontal overflow, and any failed
request — the things a type-check cannot tell you.

---

## AI provider configuration

`lib/ai/provider.ts` defines the interface; `lib/ai/anthropic.ts` implements it.
Nothing downstream knows which model runs.

The Anthropic implementation uses `messages.parse()` with a Zod output format,
so the schema is enforced at the API level rather than merely requested in the
prompt. A response that does not parse is an error, not a best-effort salvage.
PDFs are sent as `document` blocks and images as `image` blocks, chosen from
the file's actual bytes rather than its declared type.

To add another provider, implement `InvoiceExtractionProvider`, register it in
`lib/ai/extractInvoiceData.ts`, and set `AI_PROVIDER`.

---

## Production deployment

Any Node host that runs Next.js works; Vercel needs no extra configuration.

```bash
npm run build
npm run start
```

Before going live:

- Set all environment variables in the host's dashboard, not in a file.
- Leave `NEXT_PUBLIC_DEMO_MODE` unset or `false`.
- Run the migration against the production project and complete the
  [RLS verification](#verify-row-level-security-before-putting-real-data-in).
- Confirm the `invoices` storage bucket is **private**.
- Note the analysis route sets `maxDuration = 300`; on a serverless host,
  check that limit is allowed on your plan.

---

## Known limitations

- **RLS is written but unverified against a live database.** It has never been
  executed. Test isolation with two accounts before storing real invoices.
- **Benchmark mode is inactive.** The `benchmarks` table is empty by design, so
  every comparison is against your own history. The code path exists in
  `lib/invoices/pipeline.ts` and needs a real data source.
- **A first analysis with one invoice yields no opportunities.** There is
  nothing to compare it to. This is honest, not a bug.
- **Product matching is exact-normalized-name only.** No fuzzy matching, so
  `חזה עוף 5 ק"ג` and `עוף חזה 5KG` are two products until a supplier is
  consistent. Deliberate: a wrong merge invents a price change that never
  happened.
- **The pipeline runs in the request process after the response.** A restart
  mid-analysis loses that analysis; the row stays in `processing`. A durable
  queue is the fix.
- **No category assignment.** `products.category` exists but nothing populates
  it, so "savings by category" groups everything under `ללא קטגוריה`.
- **One business per user.** No multi-location or multi-user support.
- **English locale is a scaffold**, not a translation. `lib/i18n/en.ts` is
  typed `Partial` so an incomplete dictionary cannot compile as complete.
- **No billing.** Settings has no subscription management.
- **Analytics has no sink.** `lib/analytics/track.ts` defines the event
  vocabulary and call sites; wiring a provider is one function body.

---

## Future roadmap

Not built, but the architecture leaves room:

- Supplier benchmarking from a real, citable price source (Mode B).
- Fuzzy product matching with a "is this the same product?" confirmation step,
  rather than auto-merging on a near miss.
- Supplier marketplace, bidding and group purchasing.
- Anonymized cross-restaurant benchmarks.
- Automated alerts on price movements.
- Multi-location and multi-user accounts.
- English locale.
