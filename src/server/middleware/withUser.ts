import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

export const withUser = createMiddleware<AppEnv>(async (c, next) => {
	const lucia = c.get("lucia");
	const authRequest = lucia.handleRequest(c.req.raw);
	const session = await authRequest.validate();

	if (session) {
		c.set("user", {
			userId: session.user.userId,
			email: session.user.email,
			emailVerified: session.user.emailVerified,
		});
		c.set("sessionId", session.sessionId);
	} else {
		c.set("user", null);
		c.set("sessionId", null);
	}
	await next();
});
