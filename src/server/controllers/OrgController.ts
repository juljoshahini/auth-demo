import type { Context } from "hono";
import { eq, and } from "drizzle-orm";
import {
	organizationTable,
	organizationMemberTable,
	organizationInviteTable,
	userTable,
} from "../db/schema";
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

export async function createOrg(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");
	const { name } = await c.req.json<{ name: string }>();

	if (!name || name.trim().length === 0) {
		return c.json({ error: "Name is required" }, 400);
	}

	const now = Date.now();
	const orgId = nanoid();

	await db.insert(organizationTable).values({
		id: orgId,
		name: name.trim(),
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(organizationMemberTable).values({
		orgId,
		userId: user.userId,
		role: "owner",
		createdAt: now,
	});

	return c.json({ org: { id: orgId, name: name.trim() } }, 201);
}

export async function listOrgs(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");

	const memberships = await db
		.select({
			orgId: organizationMemberTable.orgId,
			role: organizationMemberTable.role,
			name: organizationTable.name,
			createdAt: organizationTable.createdAt,
		})
		.from(organizationMemberTable)
		.innerJoin(organizationTable, eq(organizationMemberTable.orgId, organizationTable.id))
		.where(eq(organizationMemberTable.userId, user.userId));

	return c.json({ organizations: memberships });
}

export async function getOrg(c: Context<AppEnv>) {
	const org = c.get("org")!;
	const db = c.get("db");

	const [orgData] = await db
		.select()
		.from(organizationTable)
		.where(eq(organizationTable.id, org.orgId));

	const members = await db
		.select({
			userId: organizationMemberTable.userId,
			role: organizationMemberTable.role,
			email: userTable.email,
			joinedAt: organizationMemberTable.createdAt,
		})
		.from(organizationMemberTable)
		.innerJoin(userTable, eq(organizationMemberTable.userId, userTable.id))
		.where(eq(organizationMemberTable.orgId, org.orgId));

	return c.json({ org: orgData, members });
}

export async function updateOrg(c: Context<AppEnv>) {
	const ability = c.get("ability")!;
	if (!ability.can("update", "Organization")) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const org = c.get("org")!;
	const db = c.get("db");
	const { name } = await c.req.json<{ name: string }>();

	if (!name || name.trim().length === 0) {
		return c.json({ error: "Name is required" }, 400);
	}

	await db
		.update(organizationTable)
		.set({ name: name.trim(), updatedAt: Date.now() })
		.where(eq(organizationTable.id, org.orgId));

	return c.json({ success: true });
}

export async function inviteMember(c: Context<AppEnv>) {
	const ability = c.get("ability")!;
	if (!ability.can("invite", "Member")) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const org = c.get("org")!;
	const db = c.get("db");
	const user = c.get("user")!;
	const { email, role } = await c.req.json<{ email: string; role?: string }>();

	if (!email) {
		return c.json({ error: "Email is required" }, 400);
	}

	const memberRole = role === "admin" ? "admin" : "member";

	// Check if already a member
	const [existingUser] = await db
		.select()
		.from(userTable)
		.where(eq(userTable.email, email.toLowerCase()));

	if (existingUser) {
		const [existingMembership] = await db
			.select()
			.from(organizationMemberTable)
			.where(
				and(
					eq(organizationMemberTable.orgId, org.orgId),
					eq(organizationMemberTable.userId, existingUser.id),
				),
			);

		if (existingMembership) {
			return c.json({ error: "User is already a member" }, 409);
		}
	}

	const inviteId = nanoid();
	const now = Date.now();
	const expires = now + 7 * 24 * 60 * 60 * 1000; // 7 days

	try {
		await db.insert(organizationInviteTable).values({
			id: inviteId,
			orgId: org.orgId,
			email: email.toLowerCase(),
			role: memberRole,
			invitedBy: user.userId,
			expires,
			createdAt: now,
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes("UNIQUE")) {
			return c.json({ error: "Invite already sent to this email" }, 409);
		}
		throw err;
	}

	return c.json({ invite: { id: inviteId, email: email.toLowerCase(), role: memberRole, expires } }, 201);
}

export async function acceptInvite(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");
	const inviteId = c.req.param("inviteId")!;

	const [invite] = await db
		.select()
		.from(organizationInviteTable)
		.where(
			and(
				eq(organizationInviteTable.id, inviteId),
				eq(organizationInviteTable.email, user.email.toLowerCase()),
			),
		);

	if (!invite) {
		return c.json({ error: "Invite not found" }, 404);
	}

	if (invite.expires < Date.now()) {
		await db.delete(organizationInviteTable).where(eq(organizationInviteTable.id, inviteId));
		return c.json({ error: "Invite has expired" }, 400);
	}

	const now = Date.now();
	try {
		await db.insert(organizationMemberTable).values({
			orgId: invite.orgId,
			userId: user.userId,
			role: invite.role,
			createdAt: now,
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes("UNIQUE")) {
			return c.json({ error: "Already a member of this organization" }, 409);
		}
		throw err;
	}

	await db.delete(organizationInviteTable).where(eq(organizationInviteTable.id, inviteId));

	return c.json({ success: true, orgId: invite.orgId });
}

export async function removeMember(c: Context<AppEnv>) {
	const ability = c.get("ability")!;
	if (!ability.can("delete", "Member")) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const org = c.get("org")!;
	const db = c.get("db");
	const targetUserId = c.req.param("userId")!;

	// Can't remove the owner
	const [targetMember] = await db
		.select()
		.from(organizationMemberTable)
		.where(
			and(
				eq(organizationMemberTable.orgId, org.orgId),
				eq(organizationMemberTable.userId, targetUserId),
			),
		);

	if (!targetMember) {
		return c.json({ error: "Member not found" }, 404);
	}

	if (targetMember.role === "owner") {
		return c.json({ error: "Cannot remove the organization owner" }, 403);
	}

	await db
		.delete(organizationMemberTable)
		.where(
			and(
				eq(organizationMemberTable.orgId, org.orgId),
				eq(organizationMemberTable.userId, targetUserId),
			),
		);

	return c.json({ success: true });
}

export async function listInvites(c: Context<AppEnv>) {
	const ability = c.get("ability")!;
	if (!ability.can("invite", "Member")) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const org = c.get("org")!;
	const db = c.get("db");

	const invites = await db
		.select({
			id: organizationInviteTable.id,
			email: organizationInviteTable.email,
			role: organizationInviteTable.role,
			expires: organizationInviteTable.expires,
			createdAt: organizationInviteTable.createdAt,
		})
		.from(organizationInviteTable)
		.where(eq(organizationInviteTable.orgId, org.orgId));

	return c.json({ invites });
}

export async function myPendingInvites(c: Context<AppEnv>) {
	const user = c.get("user")!;
	const db = c.get("db");

	const invites = await db
		.select({
			id: organizationInviteTable.id,
			orgId: organizationInviteTable.orgId,
			orgName: organizationTable.name,
			role: organizationInviteTable.role,
			expires: organizationInviteTable.expires,
		})
		.from(organizationInviteTable)
		.innerJoin(organizationTable, eq(organizationInviteTable.orgId, organizationTable.id))
		.where(eq(organizationInviteTable.email, user.email.toLowerCase()));

	return c.json({ invites });
}
