import { z } from "zod";
import type { Context } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { socialAccountTable, postTargetTable, postTable } from "../db/schema";
import { verifyCredentials } from "../platforms/bluesky";
import { verifyTumblrToken } from "../platforms/tumblr";
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

const tumblrSchema = z.object({
	platform: z.literal("tumblr"),
	accessToken: z.string().min(1),
});

export const connectAccountSchema = z.discriminatedUnion("platform", [
	blueskySchema,
	twitterSchema,
	instagramSchema,
	linkedinSchema,
	facebookSchema,
	tiktokSchema,
	tumblrSchema,
]);

export async function listAccounts(c: Context<AppEnv>) {
	const org = c.get("org")!;
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
		.where(eq(socialAccountTable.orgId, org.orgId));

	return c.json({ accounts });
}

export async function connectAccount(c: Context<AppEnv>) {
	const ability = c.get("ability")!;
	if (!ability.can("create", "SocialAccount")) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const user = c.get("user")!;
	const org = c.get("org")!;
	const db = c.get("db");

	const body = await c.req.json();
	const result = connectAccountSchema.safeParse(body);
	if (!result.success) {
		return c.json({ error: "Invalid request", details: result.error.flatten() }, 400);
	}

	const data = result.data;
	const now = Math.floor(Date.now() / 1000);

	try {
		if (data.platform === "bluesky") {
			const { did, handle } = await verifyCredentials(data.identifier, data.appPassword);

			await db.insert(socialAccountTable).values({
				id: nanoid(),
				userId: user.userId,
				orgId: org.orgId,
				platform: "bluesky",
				platformAccountId: did,
				platformUsername: handle,
				accessToken: `${data.identifier}:::${data.appPassword}`,
				createdAt: now,
			});

			return c.json({ success: true, platform: "bluesky", platformAccountId: did, platformUsername: handle });
		}

		if (data.platform === "tumblr") {
			const { blogName, blogUuid } = await verifyTumblrToken(data.accessToken);

			await db.insert(socialAccountTable).values({
				id: nanoid(),
				userId: user.userId,
				orgId: org.orgId,
				platform: "tumblr",
				platformAccountId: blogUuid,
				platformUsername: blogName,
				accessToken: `${blogName}:::${data.accessToken}`,
				createdAt: now,
			});

			return c.json({ success: true, platform: "tumblr", platformAccountId: blogUuid, platformUsername: blogName });
		}

		// Generic OAuth-based platforms
		await db.insert(socialAccountTable).values({
			id: nanoid(),
			userId: user.userId,
			orgId: org.orgId,
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

// ─── Tumblr OAuth2 Connect (for posting, not login) ─────────────────────────

export async function tumblrConnect(c: Context<AppEnv>) {
	const origin = new URL(c.req.url).origin;
	const state = nanoid(32);

	const params = new URLSearchParams({
		client_id: "7ix2naYPBg152RWc987UgpXrD4rkOeTqp56g5FModyfyUq03pC",
		redirect_uri: `${origin}/api/accounts/tumblr/callback`,
		response_type: "code",
		scope: "basic write",
		state,
	});

	c.header("Set-Cookie", `tumblr_connect_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
	return c.redirect(`https://www.tumblr.com/oauth2/authorize?${params.toString()}`);
}

export async function tumblrCallback(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const org = c.get("org")!;
	const db = c.get("db");
	const origin = new URL(c.req.url).origin;

	const cookieHeader = c.req.header("Cookie") ?? null;
	const storedState = cookieHeader?.match(/(?:^|;\s*)tumblr_connect_state=([^;]*)/)?.[1];
	const url = new URL(c.req.url);
	const state = url.searchParams.get("state");
	const code = url.searchParams.get("code");

	if (!storedState || !state || storedState !== state || !code) {
		return c.redirect("/dashboard?error=tumblr_invalid_state");
	}

	try {
		// Exchange code for access token
		const tokenRes = await fetch("https://api.tumblr.com/v2/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				client_id: "7ix2naYPBg152RWc987UgpXrD4rkOeTqp56g5FModyfyUq03pC",
				client_secret: "9GyUTIak15Sl1gybDs2ktStfNfCDMF4WPf87oBjRg4N3yk0rDA",
				redirect_uri: `${origin}/api/accounts/tumblr/callback`,
			}),
		});

		if (!tokenRes.ok) {
			console.error("Tumblr token exchange failed:", await tokenRes.text());
			return c.redirect("/dashboard?error=tumblr_token_failed");
		}

		const tokenData = await tokenRes.json() as {
			access_token: string;
			refresh_token?: string;
			expires_in?: number;
		};

		// Verify token and get blog info
		const { blogName, blogUuid } = await verifyTumblrToken(tokenData.access_token);

		await db.insert(socialAccountTable).values({
			id: nanoid(),
			userId: user.userId,
			orgId: org.orgId,
			platform: "tumblr",
			platformAccountId: blogUuid,
			platformUsername: blogName,
			accessToken: `${blogName}:::${tokenData.access_token}`,
			refreshToken: tokenData.refresh_token ?? null,
			tokenExpiresAt: tokenData.expires_in
				? Math.floor(Date.now() / 1000) + tokenData.expires_in
				: null,
			createdAt: Math.floor(Date.now() / 1000),
		});

		return c.redirect("/dashboard?tumblr=connected");
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes("UNIQUE")) {
			return c.redirect("/dashboard?error=tumblr_already_connected");
		}
		console.error("Tumblr connect error:", err);
		return c.redirect("/dashboard?error=tumblr_failed");
	}
}

export async function disconnectAccount(c: Context<AppEnv>) {
	const ability = c.get("ability")!;
	if (!ability.can("delete", "SocialAccount")) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const org = c.get("org")!;
	const id = c.req.param("id")!;
	const db = c.get("db");

	const [account] = await db
		.select({ id: socialAccountTable.id })
		.from(socialAccountTable)
		.where(and(eq(socialAccountTable.id, id), eq(socialAccountTable.orgId, org.orgId)));

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
		.where(and(eq(socialAccountTable.id, id), eq(socialAccountTable.orgId, org.orgId)));

	return c.json({ success: true });
}
