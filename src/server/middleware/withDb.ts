import { createMiddleware } from "hono/factory";
import { createDb } from "../db";
import type { AppEnv } from "../types";

export const withDb = createMiddleware<AppEnv>(async (c, next) => {
	c.set("db", createDb(c.env.DB));
	await next();
});
