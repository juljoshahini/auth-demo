import { z } from "zod";
import type { Context } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { socialAccountTable, postTargetTable, postTable } from "../db/schema";
import { verifyCredentials } from "../platforms/bluesky";
import type { AppEnv } from "../types";

function nanoid(len = 21): string {
	const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	const bytes = crypto.getRandomValues(new Uint8Array(len));
	let id = "";
	for (let i = 0; i < len; i++) {
		id += alphabet[bytes[i] % alphabet.length];
	}
	return id;
}

const blueskySchema = z.object({
	platform: z.literal("bluesky"),
	identifier: z.string().min(1),
	appPassword: z.string().min(1),
});

const twitterSchema = z.object({
	platform: z.literal("twitter"),
	accessToken: z.string(),
	accessTokenSecret: z.string(),
	platformAccountId: z.string(),
	platformUsername: z.string().optional(),
});

const instagramSchema = z.object({
	platform: z.literal("instagram"),
	accessToken: z.string(),
	platformAccountId: z.string(),
	platformUsername: z.string().optional(),
});

const linkedinSchema = z.object({
	platform: z.literal("linkedin"),
	accessToken: z.string(),
	refreshToken: z.string().optional(),
	tokenExpiresAt: z.number().optional(),
	platformAccountId: z.string(),
	platformUsername: z.string().optional(),
});

const facebookSchema = z.object({
	platform: z.literal("facebook"),
	accessToken: z.string(),
	platformAccountId: z.string(),
	platformUsername: z.string().optional(),
});

const tiktokSchema = z.object({
	platform: z.literal("tiktok"),
	accessToken: z.string(),
	refreshToken: z.string().optional(),
	tokenExpiresAt: z.number().optional(),
	platformAccountId: z.string(),
	platformUsername: z.string().optional(),
});

export const connectAccountSchema = z.discriminatedUnion("platform", [
	blueskySchema,
	twitterSchema,
	instagramSchema,
	linkedinSchema,
	facebookSchema,
	tiktokSchema,
]);

export async function listAccounts(c: Context<AppEnv>) {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const db = c.get("db");
	const accounts = await db
		.select({
			id: socialAccountTable.id,
			platform: socialAccountTable.platform,
			platformUsername: socialAccountTable.platformUsername,
			platformAccountId: socialAccountTable.platformAccountId,
			createdAt: socialAccountTable.createdAt,
		})
		.from(socialAccountTable)
		.where(eq(socialAccountTable.userId, user.userId));

	return c.json({ accounts });
}

export async function connectAccount(c: Context<AppEnv>) {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const body = await c.req.json();
	const result = connectAccountSchema.safeParse(body);
	if (!result.success) {
		return c.json({ error: "Invalid request", details: result.error.flatten() }, 400);
	}

	const data = result.data;
	const db = c.get("db");
	const now = Math.floor(Date.now() / 1000);

	try {
		if (data.platform === "bluesky") {
			const { did, handle } = await verifyCredentials(data.identifier, data.appPassword);

			await db.insert(socialAccountTable).values({
				id: nanoid(),
				userId: user.userId,
				platform: "bluesky",
				platformAccountId: did,
				platformUsername: handle,
				accessToken: `${data.identifier}:::${data.appPassword}`,
				createdAt: now,
			});

			return c.json({ success: true, platform: "bluesky", platformAccountId: did, platformUsername: handle });
		}

		// Generic OAuth-based platforms
		await db.insert(socialAccountTable).values({
			id: nanoid(),
			userId: user.userId,
			platform: data.platform,
			platformAccountId: data.platformAccountId,
			platformUsername: data.platformUsername ?? null,
			accessToken: data.accessToken,
			refreshToken: "refreshToken" in data ? (data.refreshToken ?? null) : null,
			tokenExpiresAt: "tokenExpiresAt" in data ? (data.tokenExpiresAt ?? null) : null,
			createdAt: now,
		});

		return c.json({
			success: true,
			platform: data.platform,
			platformAccountId: data.platformAccountId,
			platformUsername: data.platformUsername ?? null,
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes("UNIQUE")) {
			return c.json({ error: "This account is already connected" }, 409);
		}
		throw err;
	}
}

export async function disconnectAccount(c: Context<AppEnv>) {
	const user = c.get("user");
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const id = c.req.param("id")!;
	const db = c.get("db");

	const [account] = await db
		.select({ id: socialAccountTable.id })
		.from(socialAccountTable)
		.where(and(eq(socialAccountTable.id, id), eq(socialAccountTable.userId, user.userId)));

	if (!account) {
		return c.json({ error: "Account not found" }, 404);
	}

	// Block if there are scheduled/pending posts using this account
	const pendingTargets = await db
		.select({ id: postTargetTable.id })
		.from(postTargetTable)
		.innerJoin(postTable, eq(postTargetTable.postId, postTable.id))
		.where(
			and(
				eq(postTargetTable.socialAccountId, id),
				inArray(postTable.status, ["scheduled", "pending"]),
			),
		);

	if (pendingTargets.length > 0) {
		return c.json(
			{ error: "Cannot disconnect account with scheduled posts. Cancel them first." },
			409,
		);
	}

	// Nullify socialAccountId on completed/failed post targets
	await db
		.update(postTargetTable)
		.set({ socialAccountId: null })
		.where(eq(postTargetTable.socialAccountId, id));

	await db
		.delete(socialAccountTable)
		.where(and(eq(socialAccountTable.id, id), eq(socialAccountTable.userId, user.userId)));

	return c.json({ success: true });
}
