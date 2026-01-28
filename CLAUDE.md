# TubePlanner

AI-guided YouTube video planning app.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: NextAuth v5 with GitHub/Google OAuth
- **AI**: Vercel AI SDK with Claude (Anthropic)
- **Hosting**: Vercel (frontend) + Railway (database)

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm db:generate      # Generate Drizzle migrations
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Drizzle Studio
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Auth pages (login)
│   ├── (main)/           # Protected app pages
│   │   ├── page.tsx      # Dashboard / plans list
│   │   └── plans/
│   │       ├── new/      # AI intake chat
│   │       └── [id]/     # Plan viewer
│   └── api/
│       ├── auth/         # NextAuth routes
│       ├── chat/         # AI chat endpoints
│       └── plans/        # CRUD endpoints
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── sidebar.tsx       # App sidebar
│   └── plan-viewer.tsx   # Plan view/edit
├── db/
│   ├── schema.ts         # Drizzle schema
│   └── index.ts          # DB connection
├── lib/
│   └── utils.ts          # Utilities (cn, etc.)
└── auth.ts               # NextAuth config
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret
- `AUTH_GITHUB_ID/SECRET` - GitHub OAuth
- `AUTH_GOOGLE_ID/SECRET` - Google OAuth
- `ANTHROPIC_API_KEY` - Claude API key

## Architecture Notes

### Video Plan Flow
1. User starts new plan → AI intake chat (3-4 questions)
2. AI generates full plan from answers
3. User views/edits sections inline
4. Per-section AI refinement available

### AI Context
- AI always sees current plan state (including user edits)
- Section conversations are persisted for continuity
- Intake messages stored for reference
