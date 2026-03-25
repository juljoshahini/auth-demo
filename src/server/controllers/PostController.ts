import type { Context } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { postTable, postTargetTable, socialAccountTable } from "../db/schema";
import type { AppEnv } from "../types";

function getSchedulerStub(env: CloudflareEnv, doIdString: string): PostSchedulerStub {
	const doId = env.POST_SCHEDULER.idFromString(doIdString);
	return env.POST_SCHEDULER.get(doId) as unknown as PostSchedulerStub;
}

function nanoid(len = 21): string {
	const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	const bytes = crypto.getRandomValues(new Uint8Array(len));
	let id = "";
	for (let i = 0; i < len; i++) {
		id += alphabet[bytes[i] % alphabet.length];
	}
	return id;
}

export async function createPost(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");
	const body = await c.req.json<{
		content: string;
		mediaUrls?: string[];
		scheduledAt: number;
		socialAccountIds: string[];
	}>();

	if (!body.content || body.content.trim().length === 0) {
		return c.json({ error: "Content must not be empty" }, 400);
	}

	if (body.scheduledAt <= Date.now()) {
		return c.json({ error: "scheduledAt must be in the future" }, 400);
	}

	if (!body.socialAccountIds || body.socialAccountIds.length === 0) {
		return c.json({ error: "At least one social account is required" }, 400);
	}

	const accounts = await db
		.select()
		.from(socialAccountTable)
		.where(
			and(
				eq(socialAccountTable.userId, user.userId),
			),
		);

	const accountIds = new Set(accounts.map((a) => a.id));
	for (const id of body.socialAccountIds) {
		if (!accountIds.has(id)) {
			return c.json({ error: `Social account ${id} not found or does not belong to you` }, 403);
		}
	}

	const postId = nanoid();
	const now = Date.now();

	const doId = c.env.POST_SCHEDULER.newUniqueId();
	const stub = c.env.POST_SCHEDULER.get(doId) as unknown as PostSchedulerStub;
	await stub.schedule({ postId, scheduledAt: body.scheduledAt });

	await db.insert(postTable).values({
		id: postId,
		userId: user.userId,
		content: body.content.trim(),
		mediaUrls: body.mediaUrls ? JSON.stringify(body.mediaUrls) : null,
		scheduledAt: body.scheduledAt,
		status: "scheduled",
		durableObjectId: doId.toString(),
		createdAt: now,
		updatedAt: now,
	});

	for (const accountId of body.socialAccountIds) {
		await db.insert(postTargetTable).values({
			postId,
			socialAccountId: accountId,
			status: "pending",
		});
	}

	return c.json({ id: postId, status: "scheduled" }, 201);
}

export async function listPosts(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");

	const status = c.req.query("status");
	const limit = Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 100);
	const offset = parseInt(c.req.query("offset") || "0", 10) || 0;

	const conditions = [eq(postTable.userId, user.userId)];
	if (status) {
		conditions.push(eq(postTable.status, status));
	}

	const posts = await db
		.select()
		.from(postTable)
		.where(and(...conditions))
		.orderBy(desc(postTable.scheduledAt))
		.limit(limit)
		.offset(offset);

	return c.json({ posts });
}

export async function getPost(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");
	const postId = c.req.param("id")!;

	const [post] = await db
		.select()
		.from(postTable)
		.where(and(eq(postTable.id, postId), eq(postTable.userId, user.userId)));

	if (!post) {
		return c.json({ error: "Post not found" }, 404);
	}

	const targets = await db
		.select({
			id: postTargetTable.id,
			socialAccountId: postTargetTable.socialAccountId,
			platformPostId: postTargetTable.platformPostId,
			status: postTargetTable.status,
			error: postTargetTable.error,
			publishedAt: postTargetTable.publishedAt,
			platform: socialAccountTable.platform,
			platformUsername: socialAccountTable.platformUsername,
		})
		.from(postTargetTable)
		.innerJoin(socialAccountTable, eq(postTargetTable.socialAccountId, socialAccountTable.id))
		.where(eq(postTargetTable.postId, postId));

	return c.json({ ...post, targets });
}

export async function updatePost(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");
	const postId = c.req.param("id")!;

	const [existing] = await db
		.select()
		.from(postTable)
		.where(and(eq(postTable.id, postId), eq(postTable.userId, user.userId)));

	if (!existing) {
		return c.json({ error: "Post not found" }, 404);
	}

	if (existing.status !== "scheduled") {
		return c.json({ error: "Only scheduled posts can be updated" }, 400);
	}

	const body = await c.req.json<{
		content?: string;
		mediaUrls?: string[];
		scheduledAt?: number;
		socialAccountIds?: string[];
	}>();

	const updates: Record<string, unknown> = { updatedAt: Date.now() };

	if (body.content !== undefined) {
		if (!body.content || body.content.trim().length === 0) {
			return c.json({ error: "Content must not be empty" }, 400);
		}
		updates.content = body.content.trim();
	}

	if (body.mediaUrls !== undefined) {
		updates.mediaUrls = JSON.stringify(body.mediaUrls);
	}

	if (body.scheduledAt !== undefined) {
		if (body.scheduledAt <= Date.now()) {
			return c.json({ error: "scheduledAt must be in the future" }, 400);
		}
		updates.scheduledAt = body.scheduledAt;

		if (existing.durableObjectId) {
			const stub = getSchedulerStub(c.env, existing.durableObjectId);
			await stub.schedule({ postId, scheduledAt: body.scheduledAt });
		}
	}

	if (body.socialAccountIds !== undefined) {
		if (body.socialAccountIds.length === 0) {
			return c.json({ error: "At least one social account is required" }, 400);
		}

		const accounts = await db
			.select()
			.from(socialAccountTable)
			.where(eq(socialAccountTable.userId, user.userId));

		const accountIds = new Set(accounts.map((a) => a.id));
		for (const id of body.socialAccountIds) {
			if (!accountIds.has(id)) {
				return c.json({ error: `Social account ${id} not found or does not belong to you` }, 403);
			}
		}

		await db.delete(postTargetTable).where(eq(postTargetTable.postId, postId));

		for (const accountId of body.socialAccountIds) {
			await db.insert(postTargetTable).values({
				postId,
				socialAccountId: accountId,
				status: "pending",
			});
		}
	}

	await db.update(postTable).set(updates).where(eq(postTable.id, postId));

	return c.json({ id: postId, status: "updated" });
}

export async function cancelPost(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");
	const postId = c.req.param("id")!;

	const [post] = await db
		.select()
		.from(postTable)
		.where(and(eq(postTable.id, postId), eq(postTable.userId, user.userId)));

	if (!post) {
		return c.json({ error: "Post not found" }, 404);
	}

	if (post.status !== "scheduled") {
		return c.json({ error: "Only scheduled posts can be cancelled" }, 400);
	}

	if (post.durableObjectId) {
		const stub = getSchedulerStub(c.env, post.durableObjectId);
		await stub.cancel();
	}

	await db
		.update(postTable)
		.set({ status: "cancelled", updatedAt: Date.now() })
		.where(eq(postTable.id, postId));

	return c.json({ id: postId, status: "cancelled" });
}

export async function deletePost(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");
	const postId = c.req.param("id")!;

	const [post] = await db
		.select()
		.from(postTable)
		.where(and(eq(postTable.id, postId), eq(postTable.userId, user.userId)));

	if (!post) {
		return c.json({ error: "Post not found" }, 404);
	}

	if (post.status === "scheduled" && post.durableObjectId) {
		const stub = getSchedulerStub(c.env, post.durableObjectId);
		await stub.cancel();
	}

	await db.delete(postTargetTable).where(eq(postTargetTable.postId, postId));
	await db.delete(postTable).where(eq(postTable.id, postId));

	return c.json({ id: postId, status: "deleted" });
}
