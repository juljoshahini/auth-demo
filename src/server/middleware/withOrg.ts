import { createMiddleware } from "hono/factory";
import { eq, and } from "drizzle-orm";
import { organizationMemberTable } from "../db/schema";
import { defineAbilitiesFor } from "../helpers/abilities";
import type { AppEnv } from "../types";
import type { Role } from "../helpers/abilities";

export const withOrg = createMiddleware<AppEnv>(async (c, next) => {
	const user = c.get("user");
	if (!user) {
		c.set("org", null);
		c.set("ability", null);
		await next();
		return;
	}

	const db = c.get("db");

	// Get org from header or query param, or fall back to user's first org
	const orgId = c.req.header("X-Org-Id") || c.req.query("orgId");

	let membership;
	if (orgId) {
		const [m] = await db
			.select()
			.from(organizationMemberTable)
			.where(
				and(
					eq(organizationMemberTable.orgId, orgId),
					eq(organizationMemberTable.userId, user.userId),
				),
			);
		membership = m;
	} else {
		// Default to user's first org (personal org)
		const [m] = await db
			.select()
			.from(organizationMemberTable)
			.where(eq(organizationMemberTable.userId, user.userId))
			.limit(1);
		membership = m;
	}

	if (!membership) {
		c.set("org", null);
		c.set("ability", null);
		await next();
		return;
	}

	const role = membership.role as Role;

	c.set("org", { orgId: membership.orgId, role });
	c.set("ability", defineAbilitiesFor(role));

	await next();
});

export const requireOrg = createMiddleware<AppEnv>(async (c, next) => {
	if (!c.get("org")) {
		return c.json({ error: "Organization not found or you are not a member" }, 403);
	}
	await next();
});
