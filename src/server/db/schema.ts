import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const userTable = sqliteTable("user", {
	id: text("id", { length: 15 }).primaryKey(),
	email: text("email", { length: 255 }).notNull(),
	emailVerified: integer("email_verified").notNull().default(0),
}, (table) => [uniqueIndex("idx_user_email").on(table.email)]);

export const userKeyTable = sqliteTable("user_key", {
	id: text("id", { length: 255 }).primaryKey(),
	userId: text("user_id", { length: 15 }).notNull().references(() => userTable.id),
	hashedPassword: text("hashed_password", { length: 255 }),
});

export const userSessionTable = sqliteTable("user_session", {
	id: text("id", { length: 127 }).primaryKey(),
	userId: text("user_id", { length: 15 }).notNull().references(() => userTable.id),
	activeExpires: integer("active_expires").notNull(),
	idleExpires: integer("idle_expires").notNull(),
});

export const emailVerificationCodeTable = sqliteTable("email_verification_code", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: text("user_id", { length: 15 }).notNull().references(() => userTable.id),
	code: text("code", { length: 8 }).notNull(),
	expires: integer("expires").notNull(),
}, (table) => [uniqueIndex("idx_verification_user").on(table.userId)]);

export const passwordResetTokenTable = sqliteTable("password_reset_token", {
	id: text("id", { length: 63 }).primaryKey(),
	userId: text("user_id", { length: 15 }).notNull().references(() => userTable.id),
	expires: integer("expires").notNull(),
});

// ─── Organizations ───────────────────────────────────────────────────────────

export const organizationTable = sqliteTable("organization", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const organizationMemberTable = sqliteTable("organization_member", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	orgId: text("org_id").notNull().references(() => organizationTable.id),
	userId: text("user_id", { length: 15 }).notNull().references(() => userTable.id),
	role: text("role").notNull().default("member"),
	createdAt: integer("created_at").notNull(),
}, (table) => [
	uniqueIndex("idx_org_member_unique").on(table.orgId, table.userId),
	index("idx_org_member_user").on(table.userId),
	index("idx_org_member_org").on(table.orgId),
]);

export const organizationInviteTable = sqliteTable("organization_invite", {
	id: text("id").primaryKey(),
	orgId: text("org_id").notNull().references(() => organizationTable.id),
	email: text("email").notNull(),
	role: text("role").notNull().default("member"),
	invitedBy: text("invited_by").notNull().references(() => userTable.id),
	expires: integer("expires").notNull(),
	createdAt: integer("created_at").notNull(),
}, (table) => [
	index("idx_org_invite_email").on(table.email),
	uniqueIndex("idx_org_invite_unique").on(table.orgId, table.email),
]);

// ─── Social Accounts & Posts (org-scoped) ────────────────────────────────────

export const socialAccountTable = sqliteTable("social_account", {
	id: text("id").primaryKey(),
	userId: text("user_id", { length: 15 }).notNull().references(() => userTable.id),
	orgId: text("org_id").notNull().references(() => organizationTable.id),
	platform: text("platform").notNull(),
	platformAccountId: text("platform_account_id").notNull(),
	platformUsername: text("platform_username"),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token"),
	tokenExpiresAt: integer("token_expires_at"),
	createdAt: integer("created_at").notNull(),
}, (table) => [
	index("idx_social_user").on(table.userId),
	index("idx_social_org").on(table.orgId),
	uniqueIndex("idx_social_platform_account").on(table.orgId, table.platform, table.platformAccountId),
]);

export const postTable = sqliteTable("post", {
	id: text("id").primaryKey(),
	userId: text("user_id", { length: 15 }).notNull().references(() => userTable.id),
	orgId: text("org_id").notNull().references(() => organizationTable.id),
	content: text("content").notNull(),
	mediaUrls: text("media_urls"),
	scheduledAt: integer("scheduled_at").notNull(),
	status: text("status").notNull().default("scheduled"),
	durableObjectId: text("durable_object_id"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
}, (table) => [
	index("idx_post_user").on(table.userId),
	index("idx_post_org").on(table.orgId),
	index("idx_post_status").on(table.status),
	index("idx_post_scheduled").on(table.scheduledAt),
]);

export const postTargetTable = sqliteTable("post_target", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	postId: text("post_id").notNull().references(() => postTable.id),
	socialAccountId: text("social_account_id").references(() => socialAccountTable.id, { onDelete: "set null" }),
	platformPostId: text("platform_post_id"),
	status: text("status").notNull().default("pending"),
	error: text("error"),
	publishedAt: integer("published_at"),
}, (table) => [
	index("idx_target_post").on(table.postId),
	uniqueIndex("idx_target_post_account").on(table.postId, table.socialAccountId),
]);
