import { Hono } from "hono";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withDb, withLucia, withUser, requireAuth, withOrg, requireOrg } from "./middleware";
import * as AuthController from "./controllers/AuthController";
import * as PostController from "./controllers/PostController";
import * as SocialAccountController from "./controllers/SocialAccountController";
import * as OrgController from "./controllers/OrgController";
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
const orgScoped = [withDb, withLucia, withUser, requireAuth, withOrg, requireOrg] as const;

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

// Organizations
app.post("/orgs", ...authed, OrgController.createOrg);
app.get("/orgs", ...authed, OrgController.listOrgs);
app.get("/orgs/current", ...orgScoped, OrgController.getOrg);
app.put("/orgs/current", ...orgScoped, OrgController.updateOrg);
app.post("/orgs/current/invite", ...orgScoped, OrgController.inviteMember);
app.get("/orgs/current/invites", ...orgScoped, OrgController.listInvites);
app.delete("/orgs/current/members/:userId", ...orgScoped, OrgController.removeMember);
app.get("/invites", ...authed, OrgController.myPendingInvites);
app.post("/invites/:inviteId/accept", ...authed, OrgController.acceptInvite);

// Social Accounts (org-scoped)
app.get("/accounts", ...orgScoped, SocialAccountController.listAccounts);
app.post("/accounts/connect", ...orgScoped, SocialAccountController.connectAccount);
app.get("/accounts/tumblr/connect", ...orgScoped, SocialAccountController.tumblrConnect);
app.get("/accounts/tumblr/callback", ...orgScoped, SocialAccountController.tumblrCallback);
app.delete("/accounts/:id", ...orgScoped, SocialAccountController.disconnectAccount);

// Posts (org-scoped)
app.post("/posts", ...orgScoped, PostController.createPost);
app.get("/posts", ...orgScoped, PostController.listPosts);
app.get("/posts/:id", ...orgScoped, PostController.getPost);
app.put("/posts/:id", ...orgScoped, PostController.updatePost);
app.post("/posts/:id/cancel", ...orgScoped, PostController.cancelPost);
app.delete("/posts/:id", ...orgScoped, PostController.deletePost);

export default app;
