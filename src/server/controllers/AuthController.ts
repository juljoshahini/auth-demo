import { Context } from "hono";
import { LuciaError } from "lucia";
import { eq } from "drizzle-orm";
import { isWithinExpiration } from "lucia/utils";
import { google } from "@lucia-auth/oauth/providers";
import { github } from "@lucia-auth/oauth/providers";
import { discord } from "@lucia-auth/oauth/providers";
import { userTable, emailVerificationCodeTable } from "../db/schema";
import { isValidEmail } from "../helpers/validation";
import { sendVerificationEmail, sendPasswordResetEmail } from "../helpers/email";
import {
	generateEmailVerificationCode,
	generatePasswordResetToken,
	validatePasswordResetToken,
} from "../helpers/tokens";
import type { AppEnv } from "../types";

function parseCookie(cookieHeader: string | null, name: string): string | undefined {
	if (!cookieHeader) return undefined;
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : undefined;
}

export async function signup(c: Context<AppEnv>) {
	const { email, password } = await c.req.json<{ email: string; password: string }>();

	if (!isValidEmail(email)) {
		return c.json({ error: "Invalid email" }, 400);
	}
	if (typeof password !== "string" || password.length < 6 || password.length > 255) {
		return c.json({ error: "Invalid password" }, 400);
	}

	const lucia = c.get("lucia");
	const db = c.get("db");

	try {
		const user = await lucia.createUser({
			key: {
				providerId: "email",
				providerUserId: email.toLowerCase(),
				password,
			},
			attributes: {
				email: email.toLowerCase(),
				email_verified: 0,
			},
		});

		const code = await generateEmailVerificationCode(db, user.userId);
		await sendVerificationEmail(email, code);

		const session = await lucia.createSession({ userId: user.userId, attributes: {} });
		const sessionCookie = lucia.createSessionCookie(session);

		c.header("Set-Cookie", sessionCookie.serialize());
		return c.json({ user: { id: user.userId, email: email.toLowerCase(), emailVerified: false } }, 201);
	} catch (e) {
		if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
			return c.json({ error: "Email already in use" }, 400);
		}
		throw e;
	}
}

export async function login(c: Context<AppEnv>) {
	const { email, password } = await c.req.json<{ email: string; password: string }>();

	if (!isValidEmail(email)) {
		return c.json({ error: "Invalid email" }, 400);
	}

	const lucia = c.get("lucia");

	try {
		const key = await lucia.useKey("email", email.toLowerCase(), password);
		const session = await lucia.createSession({ userId: key.userId, attributes: {} });
		const sessionCookie = lucia.createSessionCookie(session);

		c.header("Set-Cookie", sessionCookie.serialize());
		return c.json({ success: true });
	} catch (e) {
		if (e instanceof LuciaError && (e.message === "AUTH_INVALID_KEY_ID" || e.message === "AUTH_INVALID_PASSWORD")) {
			return c.json({ error: "Invalid email or password" }, 400);
		}
		throw e;
	}
}

export async function verifyEmail(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const { code } = await c.req.json<{ code: string }>();

	if (typeof code !== "string" || code.length !== 8) {
		return c.json({ error: "Invalid code" }, 400);
	}

	const db = c.get("db");
	const lucia = c.get("lucia");

	const [stored] = await db
		.select()
		.from(emailVerificationCodeTable)
		.where(eq(emailVerificationCodeTable.userId, user.userId))
		.limit(1);

	if (!stored || stored.code !== code) {
		return c.json({ error: "Invalid verification code" }, 400);
	}

	if (!isWithinExpiration(Number(stored.expires))) {
		return c.json({ error: "Verification code expired" }, 400);
	}

	await db.delete(emailVerificationCodeTable).where(eq(emailVerificationCodeTable.userId, user.userId));
	await db.update(userTable).set({ emailVerified: 1 }).where(eq(userTable.id, user.userId));

	await lucia.invalidateAllUserSessions(user.userId);
	const session = await lucia.createSession({ userId: user.userId, attributes: {} });
	const sessionCookie = lucia.createSessionCookie(session);

	c.header("Set-Cookie", sessionCookie.serialize());
	return c.json({ success: true, user: { id: user.userId, email: user.email, emailVerified: true } });
}

export async function resendVerification(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");

	const code = await generateEmailVerificationCode(db, user.userId);
	await sendVerificationEmail(user.email, code);

	return c.json({ success: true });
}

export async function forgotPassword(c: Context<AppEnv>) {
	const { email } = await c.req.json<{ email: string }>();

	if (!isValidEmail(email)) {
		return c.json({ error: "Invalid email" }, 400);
	}

	const db = c.get("db");

	const [existingUser] = await db
		.select()
		.from(userTable)
		.where(eq(userTable.email, email.toLowerCase()))
		.limit(1);

	if (existingUser) {
		const token = await generatePasswordResetToken(db, existingUser.id);
		const baseUrl = new URL(c.req.url).origin;
		await sendPasswordResetEmail(email, token, baseUrl);
	}

	return c.json({ success: true, message: "If an account exists with that email, a reset link has been sent." });
}

export async function resetPassword(c: Context<AppEnv>) {
	const token = c.req.param("token");
	const { password } = await c.req.json<{ password: string }>();

	if (!token) {
		return c.json({ error: "Token is required" }, 400);
	}
	if (typeof password !== "string" || password.length < 6 || password.length > 255) {
		return c.json({ error: "Invalid password" }, 400);
	}

	const db = c.get("db");
	const lucia = c.get("lucia");

	try {
		const userId = await validatePasswordResetToken(db, token);

		await lucia.invalidateAllUserSessions(userId);
		await lucia.updateKeyPassword("email", (await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1))[0].email, password);

		const session = await lucia.createSession({ userId, attributes: {} });
		const sessionCookie = lucia.createSessionCookie(session);

		c.header("Set-Cookie", sessionCookie.serialize());
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: e instanceof Error ? e.message : "Invalid or expired token" }, 400);
	}
}

export async function me(c: Context<AppEnv>) {
	const user = c.get("user")!;
	return c.json({ user: { id: user.userId, email: user.email, emailVerified: user.emailVerified } });
}

export async function logout(c: Context<AppEnv>) {
	const lucia = c.get("lucia");
	const sessionId = c.get("sessionId")!;

	await lucia.invalidateSession(sessionId);
	const blankCookie = lucia.createSessionCookie(null);

	c.header("Set-Cookie", blankCookie.serialize());
	return c.json({ success: true });
}

// ─── Google OAuth ────────────────────────────────────────────────────────────

export async function googleLogin(c: Context<AppEnv>) {
	const lucia = c.get("lucia");
	const googleAuth = google(lucia, {
		clientId: c.env.GOOGLE_CLIENT_ID,
		clientSecret: c.env.GOOGLE_CLIENT_SECRET,
		redirectUri: `${new URL(c.req.url).origin}/api/auth/login/google/callback`,
		scope: ["email", "profile"],
	});

	const [url, state] = await googleAuth.getAuthorizationUrl();

	c.header("Set-Cookie", `google_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
	return c.redirect(url.toString());
}

export async function googleCallback(c: Context<AppEnv>) {
	const lucia = c.get("lucia");
	const db = c.get("db");
	const googleAuth = google(lucia, {
		clientId: c.env.GOOGLE_CLIENT_ID,
		clientSecret: c.env.GOOGLE_CLIENT_SECRET,
		redirectUri: `${new URL(c.req.url).origin}/api/auth/login/google/callback`,
		scope: ["email", "profile"],
	});

	const cookieHeader = c.req.header("Cookie") ?? null;
	const storedState = parseCookie(cookieHeader, "google_oauth_state");
	const url = new URL(c.req.url);
	const state = url.searchParams.get("state");
	const code = url.searchParams.get("code");

	if (!storedState || !state || storedState !== state || !code) {
		return c.json({ error: "Invalid OAuth state" }, 400);
	}

	try {
		const { existingUser, googleUser, createUser, createKey } = await googleAuth.validateCallback(code);

		if (!googleUser.email_verified) {
			return c.json({ error: "Google email not verified" }, 400);
		}

		let user = existingUser;

		if (!user) {
			const [existingDbUser] = await db
				.select()
				.from(userTable)
				.where(eq(userTable.email, googleUser.email!))
				.limit(1);

			if (existingDbUser) {
				await createKey(existingDbUser.id);
				user = { userId: existingDbUser.id, email: existingDbUser.email, emailVerified: Boolean(existingDbUser.emailVerified) };
			} else {
				user = await createUser({
					attributes: {
						email: googleUser.email!,
						email_verified: 1,
					},
				});
			}
		}

		const session = await lucia.createSession({ userId: user.userId, attributes: {} });
		const sessionCookie = lucia.createSessionCookie(session);

		c.header("Set-Cookie", sessionCookie.serialize());
		return c.redirect("/");
	} catch (e) {
		console.error("Google OAuth callback error:", e);
		return c.json({ error: "OAuth authentication failed" }, 500);
	}
}

// ─── GitHub OAuth ────────────────────────────────────────────────────────────

export async function githubLogin(c: Context<AppEnv>) {
	const lucia = c.get("lucia");
	const githubAuth = github(lucia, {
		clientId: c.env.GITHUB_CLIENT_ID,
		clientSecret: c.env.GITHUB_CLIENT_SECRET,
	});

	const [url, state] = await githubAuth.getAuthorizationUrl();

	c.header("Set-Cookie", `github_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
	return c.redirect(url.toString());
}

export async function githubCallback(c: Context<AppEnv>) {
	const lucia = c.get("lucia");
	const db = c.get("db");
	const githubAuth = github(lucia, {
		clientId: c.env.GITHUB_CLIENT_ID,
		clientSecret: c.env.GITHUB_CLIENT_SECRET,
	});

	const cookieHeader = c.req.header("Cookie") ?? null;
	const storedState = parseCookie(cookieHeader, "github_oauth_state");
	const url = new URL(c.req.url);
	const state = url.searchParams.get("state");
	const code = url.searchParams.get("code");

	if (!storedState || !state || storedState !== state || !code) {
		return c.json({ error: "Invalid OAuth state" }, 400);
	}

	try {
		const { existingUser, githubUser, createUser, createKey } = await githubAuth.validateCallback(code);

		let user = existingUser;

		if (!user) {
			const email = githubUser.email;

			if (email) {
				const [existingDbUser] = await db
					.select()
					.from(userTable)
					.where(eq(userTable.email, email))
					.limit(1);

				if (existingDbUser) {
					await createKey(existingDbUser.id);
					user = { userId: existingDbUser.id, email: existingDbUser.email, emailVerified: Boolean(existingDbUser.emailVerified) };
				}
			}

			if (!user) {
				user = await createUser({
					attributes: {
						email: email ?? `${githubUser.login}@github.noreply`,
						email_verified: email ? 1 : 0,
					},
				});
			}
		}

		const session = await lucia.createSession({ userId: user.userId, attributes: {} });
		const sessionCookie = lucia.createSessionCookie(session);

		c.header("Set-Cookie", sessionCookie.serialize());
		return c.redirect("/");
	} catch (e) {
		console.error("GitHub OAuth callback error:", e);
		return c.json({ error: "OAuth authentication failed" }, 500);
	}
}

// ─── Discord OAuth ───────────────────────────────────────────────────────────

export async function discordLogin(c: Context<AppEnv>) {
	const lucia = c.get("lucia");
	const discordAuth = discord(lucia, {
		clientId: c.env.DISCORD_CLIENT_ID,
		clientSecret: c.env.DISCORD_CLIENT_SECRET,
		redirectUri: `${new URL(c.req.url).origin}/api/auth/login/discord/callback`,
		scope: ["identify", "email"],
	});

	const [url, state] = await discordAuth.getAuthorizationUrl();

	c.header("Set-Cookie", `discord_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
	return c.redirect(url.toString());
}

export async function discordCallback(c: Context<AppEnv>) {
	const lucia = c.get("lucia");
	const db = c.get("db");
	const discordAuth = discord(lucia, {
		clientId: c.env.DISCORD_CLIENT_ID,
		clientSecret: c.env.DISCORD_CLIENT_SECRET,
		redirectUri: `${new URL(c.req.url).origin}/api/auth/login/discord/callback`,
		scope: ["identify", "email"],
	});

	const cookieHeader = c.req.header("Cookie") ?? null;
	const storedState = parseCookie(cookieHeader, "discord_oauth_state");
	const url = new URL(c.req.url);
	const state = url.searchParams.get("state");
	const code = url.searchParams.get("code");

	if (!storedState || !state || storedState !== state || !code) {
		return c.json({ error: "Invalid OAuth state" }, 400);
	}

	try {
		const { existingUser, discordUser, createUser, createKey } = await discordAuth.validateCallback(code);

		let user = existingUser;

		if (!user) {
			const email = discordUser.email;

			if (email) {
				const [existingDbUser] = await db
					.select()
					.from(userTable)
					.where(eq(userTable.email, email))
					.limit(1);

				if (existingDbUser) {
					await createKey(existingDbUser.id);
					user = { userId: existingDbUser.id, email: existingDbUser.email, emailVerified: Boolean(existingDbUser.emailVerified) };
				}
			}

			if (!user) {
				user = await createUser({
					attributes: {
						email: email ?? `${discordUser.username}@discord.noreply`,
						email_verified: email && discordUser.verified ? 1 : 0,
					},
				});
			}
		}

		const session = await lucia.createSession({ userId: user.userId, attributes: {} });
		const sessionCookie = lucia.createSessionCookie(session);

		c.header("Set-Cookie", sessionCookie.serialize());
		return c.redirect("/");
	} catch (e) {
		console.error("Discord OAuth callback error:", e);
		return c.json({ error: "OAuth authentication failed" }, 500);
	}
}
