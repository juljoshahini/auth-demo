import type { Auth } from "./helpers/lucia";
import type { Database } from "./db";
import type { AppAbility, Role } from "./helpers/abilities";

export type AppEnv = {
	Bindings: CloudflareEnv;
	Variables: {
		db: Database;
		lucia: Auth;
		user: { userId: string; email: string; emailVerified: boolean } | null;
		sessionId: string | null;
		org: { orgId: string; role: Role } | null;
		ability: AppAbility | null;
	};
};
