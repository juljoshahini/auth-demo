import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const userTable = sqliteTable("user", {
	id: text("id", { length: 15 }).primaryKey(),
	email: text("email", { length: 255 }).notNull(),
	emailVerified: integer("email_verified").notNull().default(0),
});

export const socialAccountTable = sqliteTable("social_account", {
	id: text("id").primaryKey(),
	userId: text("user_id", { length: 15 }).notNull(),
	platform: text("platform").notNull(),
	platformAccountId: text("platform_account_id").notNull(),
	platformUsername: text("platform_username"),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token"),
	tokenExpiresAt: integer("token_expires_at"),
	createdAt: integer("created_at").notNull(),
});

export const postTable = sqliteTable("post", {
	id: text("id").primaryKey(),
	userId: text("user_id", { length: 15 }).notNull(),
	content: text("content").notNull(),
	mediaUrls: text("media_urls"),
	scheduledAt: integer("scheduled_at").notNull(),
	status: text("status").notNull().default("scheduled"),
	durableObjectId: text("durable_object_id"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const postTargetTable = sqliteTable("post_target", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	postId: text("post_id").notNull(),
	socialAccountId: text("social_account_id").notNull(),
	platformPostId: text("platform_post_id"),
	status: text("status").notNull().default("pending"),
	error: text("error"),
	publishedAt: integer("published_at"),
});
