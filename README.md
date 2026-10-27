# Invoice Studio

## 1. What it is
A small invoice generator for a small business. You fill in the invoice on the left and a print-ready preview updates on the right as you type.
Invoices are saved to MongoDB so you can come back to them, print them or save them as PDF, and email them through Resend.

## 2. Run locally
```bash
npm install
cp .env.example .env.local   # fill in the values, see sections 3 and 4
npm run dev                  # http://localhost:3000, also reachable from other devices on your local network
npm test                     # unit tests
```
`npm run build`, `npm start` and `npm run lint` work as usual. You need Node 20 or newer.

## 3. Backend and storage setup
You can use either MongoDB Atlas or a local MongoDB.

With **Atlas**, follow these steps:
1. Create a free cluster and add a database user.
2. Allow your IP under Network Access.
3. Copy the driver connection string into `MONGODB_URI`.

For a **local** setup, run `mongod` (or `docker run -p 27017:27017 mongo`) and point `MONGODB_URI` at `mongodb://localhost:27017`.

`MONGODB_DB` is required and has no default. `.env.example` sets it to `invoice_generator`; the app returns an error if it is missing. Everything lives in a single `invoices` collection, which Mongo creates on the first save, so there are no migrations to run. The client is created once in `lib/db.ts` and cached on `globalThis`, so hot reloads in dev don't keep opening new connections.

The API is small:

| Method | Route | What it does |
|---|---|---|
| `GET` | `/api/invoices` | List saved invoices, newest first |
| `POST` | `/api/invoices` | Create an invoice |
| `GET` | `/api/invoices/[id]` | Fetch one invoice |
| `PUT` | `/api/invoices/[id]` | Update an invoice |
| `POST` | `/api/invoices/[id]/send` | Email a saved invoice |

If a payload is invalid, the API returns a `400` with `fieldErrors` keyed by field name. The editor uses those keys to show each message next to the right input.

## 4. Email setup
Sign up at [resend.com](https://resend.com), create an API key and put it in `RESEND_API_KEY`. Leave `EMAIL_FROM` as `onboarding@resend.dev` unless you've verified your own domain. Set `TEST_EMAIL_TO` to an inbox you own. With Resend's test sender, mail only goes to your own account address anyway.

The app always sends to `TEST_EMAIL_TO`, never to the customer address on the invoice. That way I could test sending freely without any risk of emailing a real person. The API key is only ever read on the server.

## 5. Calculation rules and how they are tested
All the money logic sits in `lib/money.ts`. It has no UI code, and the browser preview and the server both use it. The rules follow the brief:

1. Line total = quantity x unit price, rounded to cents
2. Subtotal = sum of the rounded line totals
3. Discounted amount = subtotal - discount
4. Tax = discounted amount x tax rate, rounded to cents
5. Grand total = discounted amount + tax

All the arithmetic uses integers, so there are no floating-point surprises, and rounding is half-up. Amounts are stored in these units:
- Computed amounts are in cents.
- Unit prices are in mills (thousandths of a dollar), so a price like `$0.333` is stored exactly.
- Tax rates are in basis points, so 10% is `1000`.

`tests/money.test.ts` covers the cases the brief asks for:
- 2 x $50.00 with a $10.00 discount and 10% tax comes to $99.00.
- 3 x $0.333 rounds per line to $1.00.
- An invoice with zero items.
- A discount equal to the subtotal.
- Tax rounding.

It also checks that the subtotal adds up the already rounded lines. `tests/invoice.test.ts` checks that new item IDs are valid v4 UUIDs, including over plain HTTP, where `crypto.randomUUID` isn't available. `tests/validation.test.ts` covers negative values, a discount bigger than the subtotal, a due date before the issue date, and invalid dates. `tests/email.test.ts` makes sure hidden custom fields never end up in the email.

## 6. Key decisions
- **Stack.** Next.js with the App Router, TypeScript and Tailwind, with the API routes in the same app. I used the official MongoDB driver, Resend for email and Vitest for tests. That gives one thing to deploy and nothing extra to run.
- **Money in integer cents.** Every stored or computed amount is an integer. The one place I went finer is the unit price, which is in mills. The brief's own example of 3 x $0.333 needs sub-cent prices, otherwise there would be nothing to round.
- **The server recalculates.** The server ignores any totals the client sends. It validates the payload with the same rules the editor uses, recalculates the totals with `lib/money.ts`, and stores only the fields it knows about.
- **Validation.** One module is shared by the editor and the API. The editor keeps exactly what you typed, so typing `-5` shows "Quantity cannot be negative" instead of the input silently refusing it. While there are errors, Save and Send show "Fix N fields". Clicking one reveals every message and moves focus to the first problem.
- **Invoice number.** The app suggests the next number after the highest saved one, in the form `INV-0001`, and you can change it. It isn't forced to be unique, because this is a single-user tool with no login.
- **Dates.** You type and see dates as `DD-MM-YYYY` everywhere: the editor, preview, print, email and the saved list. They're stored as `YYYY-MM-DD` so they sort and compare correctly, with no timezone drift.
- **Local network and plain HTTP.** `next.config.ts` allows the dev server to be opened from `192.168.*.*` and `10.*.*.*` addresses, so you can test on a phone. Because `crypto.randomUUID` only exists on HTTPS or localhost, `newId()` in `lib/invoice.ts` falls back to `getRandomValues`, and then to `Math.random`, so adding line items works on those addresses too.
- **Saved invoices.** The list is a sidebar on desktop and a collapsible list at the top on mobile. Clicking an invoice loads it from the API, so it still works after a page reload.
- **Email format.** The email is table-based HTML with inline styles, since email clients are picky, plus a plain-text version. It's built from the saved copy in the database, not from whatever is on screen.
- **Custom fields.** Visible fields show in a small details block under the invoice number and dates. One helper, `visibleCustomFields()`, does the filtering for both the preview and the email. Hidden fields are never rendered at all, so they can't sneak into print, and they never affect the totals.

## 7. AI tools used and how
I used Claude Code as a coding assistant.
- **What I owned:** the plan, the main decisions and the shared types.
- **What it generated:** most of the implementation.
- **How I checked it:** I reviewed everything and verified it with the tests, the build, curl and a real test email. I also looked at the UI in the browser on mobile and desktop widths and in print.

## 8. Time spent (actual)
About 40 minutes. Roughly 15 to 20 of those went on planning: the requirements checklist, the decisions and the data model. Building, reviewing and fixing took 21 minutes, from 09:06 to 09:27.

## 9. Unfinished work and known limitations
- **No end-to-end browser test suite.** The unit tests cover money, validation and the email. I checked the API with curl and the UI with browser screenshots at 375, 1024 and 1440px wide, plus print preview.
- **No login.** The brief allows this, but it means anyone who can reach the app can see and edit every invoice.
- **Invoice numbers aren't unique.** You can save two invoices with the same number if you type it in.
- **No unsaved-changes warning.** Opening another invoice or starting a new one throws away edits you haven't saved.
- **The saved list shows the latest 100 invoices.** There's no search or pagination.
- **Email only goes to the test inbox.** Sending to real customers would need a verified domain and a deliberate code change.
- **USD only, with one tax rate.** The tax rate applies to the whole invoice, and there's no per-line tax.
- **PDF export uses the browser's print dialog.** Page headers and footers depend on the browser's print settings.
