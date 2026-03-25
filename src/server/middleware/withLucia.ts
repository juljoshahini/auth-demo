import { createMiddleware } from "hono/factory";
import { initializeLucia } from "../helpers/lucia";
import type { AppEnv } from "../types";

export const withLucia = createMiddleware<AppEnv>(async (c, next) => {
	c.set("lucia", initializeLucia(c.env.DB));
	await next();
});
