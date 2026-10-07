# CDPHWIC

Nuxt 4 application configured for Cloudflare Workers and D1, following the
structure and operational conventions of StepThrough.

## Local setup

```bash
npm install
npm run dev
```

The local development environment uses the `dev` Cloudflare environment and
the `CDPHWIC` D1 binding. The app includes seeded products, agencies, requests,
and the closed B2B access-flow schema.

## Project structure

```text
app/       Nuxt pages, layouts, components, and client assets
server/    Server routes, API handlers, and server-only utilities
shared/    Types and utilities safe for client and server use
db/        D1 migrations and local reset/seed SQL
public/    Static assets
```

## D1 workflows

Create and inspect the databases with Wrangler:

```bash
npm run db:create
npm run db:info
npm run db:info:dev
```

Apply local migrations and reset/seed local data:

```bash
npm run db:migrate:local:dev
npm run db:fresh
```

The production and development database IDs in `wrangler.jsonc` are explicit
zero UUID placeholders. Replace them with real Cloudflare D1 IDs after running
the database creation command. Do not commit credentials or local secret files.

## Build and preview

```bash
npm test
npm run build
npm run preview
```

`npm run build` produces the Cloudflare Worker entrypoint under `.output/`.
`npm run preview` builds the app and starts Wrangler with the dev environment.

## Deployment

After replacing the placeholder D1 IDs and authenticating Wrangler:

```bash
npm run deploy
```

The deployment command runs the test suite, builds the Cloudflare Worker, and
deploys the top-level production environment.

Product features should keep client code in `app/`, server-only code in
`server/`, shared contracts in `shared/`, and database changes in numbered D1
migrations. Authentication, R2, queues, and other Cloudflare resources should
be added only when a product requirement needs them.

## Style guide

Use braces for every control-flow statement, even when its body contains only
one line. Put a blank line after a completed control-flow block when another
statement follows it; do not add one when the block is the last thing in the
function. Keep continuation clauses such as `else`, `catch`, and `finally`
on the next line without an intervening blank line.

```ts
if (ready) {
    start();
} else {
    wait();
}

continueWork();

try {
    save();
} catch (error) {
    report(error);
}
```

Put each attribute on its own line when an element has multiple attributes,
and put each field of a multiline object on its own line. Use a dangling comma
in multiline objects and other multiline comma-separated lists.

```vue
<img
    src="/logo.svg"
    alt="CDPHWIC"
    width="32"
    height="32"
/>
```

```ts
return {
    foo: 'bar',
    baz: 'buz',
};
```

## Dashboard demo

The home page is sign-in only. People without an account can use `Request an
invitation` to submit an access request. Admins review those requests under
`Signup Requests`, where admins can review requests or send direct invitations. Invitation URLs
are intentionally not linked from the public app: they first show an email
verification step, then reveal the role-specific signup form after the code is
verified. Local development returns the verification code and invitation URL
in the response/UI as a delivery stub; production should replace this with a
real email adapter before deployment.

Seeded sign-in emails are `frank@cdphwic.org`, `maria@mendocino.example`, and
`james@cdphwic.org`. The development password check accepts any non-empty
password.

The current dashboard uses a local demo session so the role and navigation
flows can be explored before production authentication is connected. Use the
`View as` selector in the top bar to switch between:

- Admin: all agencies, reports, product/accounting fields, and signup requests.
- Agency member: all requests for the agency plus rep-specific My Requests.
- FPU analyst: all agencies with filters plus handled-agency/rep My Requests.

The role is `admin` or `member`; member type is `agency` or `internal`. Agency
members can set a preferred FPU analyst, and internal staff can set the agencies
and reps they handle from Profile & assignments. These are development stubs
backed by typed seed data and can be replaced with real sessions and D1 queries.
