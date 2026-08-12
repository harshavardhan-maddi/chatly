# Chatly

Real-time, Chat-ID-based communication app. Instagram-inspired UI, WhatsApp-style
messaging, admin-controlled access, voice/video calling via Jitsi.

> **Status: Phase 1–3 foundation (auth + core chat/join system) is real and
> wired end-to-end** — registration, login, JWT + refresh-token sessions,
> Chat ID generation, create/join/approve flows with race-safe member-limit
> enforcement, and an authenticated Socket.IO layer with live messaging,
> typing, presence, and notifications, are implemented against a real
> PostgreSQL schema. Everything below "What's not built yet" is scaffolded
> (routes/tables exist) but not implemented — that's phases 5–9 of the
> original spec and is a lot of additional work (file storage, calling,
> full member management, search, moderation, polish). Treat this as a
solid, running foundation to build on, not the finished product.

## What's real right now

- Postgres schema (Prisma) covering every entity in the spec: users,
  sessions, chats, members, invites, join requests, messages, attachments,
  reactions, reads, calls, call participants, notifications, blocks, reports.
- Auth: register / login / logout / logout-all-devices / refresh /
  forgot-password / reset-password. Argon2 password hashing, JWT access
  tokens in HTTP-only cookies, opaque rotating refresh tokens hashed at rest.
- Chat creation with cryptographically random, non-sequential Chat IDs
  (`CH-XXXXXX`, CSPRNG-backed, collision-checked).
- Join flows: direct join for `PUBLIC` chats, request/approve for
  `APPROVAL_REQUIRED` chats — both enforce the member limit **inside a
  row-locked transaction** so two simultaneous joiners can't both slip past
  a full chat.
- RBAC middleware (`requireChatMembership`, `requireRole`) that every
  chat-scoped route must pass through — nothing trusts a chatId from the
  URL without re-verifying membership server-side.
- Socket.IO: authenticated handshake (same JWT cookie as REST), per-chat
  rooms joined only after a server-side membership check, live
  `message:send/new/delivered/read`, `typing:start/stop`,
  `user:online/offline`, and `notification:new`.
- A functional (not polished) React client: landing page, register/login,
  home chat list, create-chat modal, join-chat modal — all calling the real
  API, no mock data.
- Seed script matching the spec's 5 users / 3 chats / mixed roles &
  access types.

## What's not built yet

Scaffolded (folders, route files, TODO comments) but not implemented:
member management (promote/remove/ban), message file attachments end-to-end
(upload endpoint + Supabase/S3 wiring), voice messages, Jitsi call
integration, group conferencing, privacy settings, blocking, reporting,
global search, the full Instagram-style chat-room UI, dark mode toggle,
and the rest of the polish/animation pass. These are large enough that
building them well means the same file-by-file process as phase 1 — happy
to keep going phase by phase in follow-up messages.

## Getting it running locally

```bash
# 1. Database
createdb chatly   # or use Supabase/Neon/RDS and paste the URL below

# 2. Env
cp .env.example .env
# fill in DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET at minimum

# 3. Server
cd server
npm install
npm run prisma:generate
npm run prisma:migrate      # creates tables from schema.prisma
npm run seed                # optional: sample data
npm run dev                 # http://localhost:4000

# 4. Client (separate terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Seeded login (after `npm run seed`): username `harsha`, password `Password123`.

## Architecture

```
client/   React + Vite + TS + Tailwind + Zustand + TanStack Query
server/   Express + TS + Socket.IO, layered controllers → services → prisma
prisma/   schema.prisma is the single source of truth for the DB
```

Business logic lives in `server/src/services/*`, never in route files or
React components, per the spec's separation-of-concerns requirement.

## Security notes

- Passwords: Argon2id, never stored or logged in plaintext.
- Sessions: short-lived JWT access token (15 min) + rotating opaque refresh
  token, both HTTP-only cookies. Refresh tokens are hashed (SHA-256) before
  storage, so a DB leak alone can't be replayed.
- Secrets (`JWT_SECRET`, storage keys, Jitsi API key) live only in
  `server/.env` and are read via `src/config/env.ts` — never sent to the
  client.
- Authorization is enforced server-side on every chat-scoped route and
  every socket event; the frontend's `RequireAuth` guard is UX-only.
- File access model (once uploads are wired): private bucket + short-lived
  signed URLs, no public file paths.

## Jitsi integration point

Not yet wired. The `Call` / `CallParticipant` tables and `generateCallRoomId()`
util already exist so the next step is: create a call record on
`POST /api/chats/:chatId/calls`, generate a Jitsi JWT scoped to that room
using `JITSI_APP_ID` / `JITSI_API_KEY`, and mount `@jitsi/react-sdk` (or the
IFrame API) in a `CallRoom` component that only chat members can reach.

## Deployment (once more phases are done)

- Frontend → Vercel (`client/`, build command `npm run build`)
- Backend → Railway/Render/Fly/VPS with Docker (`server/`)
- DB → Supabase/Neon/RDS Postgres
- Storage → Supabase Storage or S3-compatible bucket
- Calling → JaaS (Jitsi as a Service) to start, self-hosted Jitsi later
