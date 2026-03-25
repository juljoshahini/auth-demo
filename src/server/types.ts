import type { Auth } from "./helpers/lucia";
import type { Database } from "./db";

export type AppEnv = {
	Bindings: CloudflareEnv;
	Variables: {
		db: Database;
		lucia: Auth;
		user: { userId: string; email: string; emailVerified: boolean } | null;
		sessionId: string | null;
	};
};
