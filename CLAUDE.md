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

## Design Philosophy

### Core Principle
**Simple or they won't use it.** Every feature should reduce friction, not add it.

### UX Patterns

**AI-First, Not Form-First**
- Don't present empty forms. Start with conversation.
- AI asks questions → generates draft → user refines.
- Quick intake (3-4 questions) gets to a tangible artifact fast.

**Progressive Disclosure**
- Show the minimum needed at each step.
- Details expand on demand, not by default.
- Complexity is earned through user intent.

**Feedback is Mandatory**
- Never leave users wondering if something is happening.
- Thinking indicators (animated dots) before AI responds.
- Streaming responses so users see progress immediately.
- Optimistic UI updates where safe.

**Context is King**
- AI always works with current state, not stale data.
- User edits are visible to AI when refining.
- Conversation history persists for continuity.

### Visual Design

**Aesthetic**: Modern, minimal, confident. Not playful, not corporate.

**Palette**: Zinc/neutral base with red-500 accent. Dark mode supported.

**Typography**: Clean sans-serif (Inter). Generous line height. Clear hierarchy.

**Spacing**: Breathable. Don't cram. White space is a feature.

**Components**: Rounded corners (xl/2xl). Subtle shadows. Smooth transitions.

**Avatars**: Always use real user photos from OAuth. AI gets a consistent brand mark (Sparkles icon on red).

### Anti-Patterns (Don't Do This)
- Empty states with no guidance
- Loading spinners with no context
- Forms that could be conversations
- Features hidden behind settings
- Confirmation dialogs for reversible actions
- Placeholder avatars when real ones exist
