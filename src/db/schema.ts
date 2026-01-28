import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  pgEnum,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// NextAuth tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  // Creator context for AI personalization
  userContext: text("user_context"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
);

// Video plan status enum
export const planStatusEnum = pgEnum("plan_status", [
  "intake",
  "generating",
  "draft",
  "refining",
  "complete",
]);

// Video Plans table
export const videoPlans = pgTable("video_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: planStatusEnum("status").default("intake").notNull(),

  // Intake conversation
  intakeMessages: jsonb("intake_messages").$type<Message[]>().default([]),

  // Generated plan sections
  idea: text("idea"),
  targetAudience: text("target_audience"),
  hook: text("hook"),
  outline: jsonb("outline").$type<OutlineItem[]>(),
  thumbnailConcepts: jsonb("thumbnail_concepts").$type<string[]>(),
  titleOptions: jsonb("title_options").$type<string[]>(),

  // Section refinement conversations (keyed by section name)
  sectionConversations: jsonb("section_conversations")
    .$type<Record<string, Message[]>>()
    .default({}),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// Types
export type Message = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type OutlineItem = {
  id: string;
  title: string;
  content: string;
  duration?: string;
};

export type VideoPlan = typeof videoPlans.$inferSelect;
export type NewVideoPlan = typeof videoPlans.$inferInsert;
export type User = typeof users.$inferSelect;
