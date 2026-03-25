import { Hono } from "hono";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withDb, withLucia, withUser, requireAuth } from "./middleware";
import * as AuthController from "./controllers/AuthController";
import * as PostController from "./controllers/PostController";
import * as SocialAccountController from "./controllers/SocialAccountController";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>().basePath("/api");

// Inject Cloudflare bindings (D1, DO, secrets) into Hono's c.env
app.use("*", async (c, next) => {
	const { env } = await getCloudflareContext();
	c.env = env as unknown as CloudflareEnv;
	await next();
});

const pub = [withDb, withLucia] as const;
const authed = [withDb, withLucia, withUser, requireAuth] as const;

// Auth (public)
app.post("/auth/signup", ...pub, AuthController.signup);
app.post("/auth/login", ...pub, AuthController.login);
app.post("/auth/forgot-password", ...pub, AuthController.forgotPassword);
app.post("/auth/reset-password/:token", ...pub, AuthController.resetPassword);

// OAuth
app.get("/auth/login/google", ...pub, AuthController.googleLogin);
app.get("/auth/login/google/callback", ...pub, AuthController.googleCallback);
app.get("/auth/login/github", ...pub, AuthController.githubLogin);
app.get("/auth/login/github/callback", ...pub, AuthController.githubCallback);
app.get("/auth/login/discord", ...pub, AuthController.discordLogin);
app.get("/auth/login/discord/callback", ...pub, AuthController.discordCallback);

// Auth (protected)
app.get("/auth/me", ...authed, AuthController.me);
app.post("/auth/logout", ...authed, AuthController.logout);
app.post("/auth/verify-email", ...authed, AuthController.verifyEmail);
app.post("/auth/resend-verification", ...authed, AuthController.resendVerification);

// Social Accounts
app.get("/accounts", ...authed, SocialAccountController.listAccounts);
app.post("/accounts/connect", ...authed, SocialAccountController.connectAccount);
app.delete("/accounts/:id", ...authed, SocialAccountController.disconnectAccount);

// Posts
app.post("/posts", ...authed, PostController.createPost);
app.get("/posts", ...authed, PostController.listPosts);
app.get("/posts/:id", ...authed, PostController.getPost);
app.put("/posts/:id", ...authed, PostController.updatePost);
app.post("/posts/:id/cancel", ...authed, PostController.cancelPost);
app.delete("/posts/:id", ...authed, PostController.deletePost);

export default app;
