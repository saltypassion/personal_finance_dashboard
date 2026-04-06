# Personal Finance Dashboard

A personal finance dashboard for uploading bank statement PDFs, parsing transactions, reviewing categories, and exploring spending over time.

## Stack

- Next.js + TypeScript + Tailwind CSS
- Recharts for dashboard visualizations
- PostgreSQL + Prisma
- FastAPI + `pdfplumber` + OCR fallback for PDF parsing

## What the app does

- Upload and parse bank statement PDFs
- Persist statement imports and transactions in PostgreSQL
- View raw transactions by year and month
- Mark reimbursements or pass-through transactions so they do not distort analytics
- Split transactions with `Count This Much`
- Teach categories with one-off or permanent rules
- Browse transactions by category
- Review upload history
- See spending breakdowns and cash-flow trends across months

## Current pages

- `/` dashboard overview
- `/transactions` raw transaction table with adjustment controls
- `/categories` teach table for unresolved category labels
- `/category-transactions` browse transactions by chosen category
- `/uploads` statement upload history
- `/reset` clear browser-side app state for testing

## Project structure

```text
app/                     Next.js App Router pages and API routes
components/              Dashboard UI components
lib/                     Shared client and server utilities
prisma/                  Prisma schema and migrations
services/pdf_parser/     FastAPI parser service
```

## Local setup

1. Install Node dependencies:

   ```bash
   npm install
   ```

2. Create your env files:

   ```bash
   cp .env.example .env
   cp .env.example .env.local
   ```

3. Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

4. Generate Prisma client and run migrations:

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

5. Set up the parser service once:

   ```bash
   cd services/pdf_parser
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

6. Start the app:

   ```bash
   cd ../..
   npm run dev:all
   ```

## Local URLs

- App: `http://localhost:3000`
- Parser service: `http://127.0.0.1:8001`

## Daily workflow

Start development:

```bash
docker compose up -d
npm run dev:all
```

Stop the Next.js app and parser:

- press `Ctrl+C` in the terminal running `npm run dev:all`

Stop PostgreSQL too:

```bash
docker compose down
```

## Notes

- This project currently uses a local dev user for persisted data because auth is not wired yet.
- Browser-side testing state can be cleared at `/reset`.
- Statement parsing works best when tuned against the exact PDF format of the target bank.

## Next ideas

- Add authentication and user-scoped data
- Add stronger duplicate-import protection in the UI
- Add transaction search and filters
- Add category reports and budget views
- Improve parser tuning for more statement layouts
