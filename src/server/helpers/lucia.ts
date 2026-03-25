import { lucia } from "lucia";
import { web } from "lucia/middleware";
import { d1 } from "@lucia-auth/adapter-sqlite";

export function initializeLucia(db: D1Database) {
	return lucia({
		adapter: d1(db, { user: "user", key: "user_key", session: "user_session" }),
		env: "DEV",
		middleware: web(),
		sessionCookie: { expires: false },
		getUserAttributes: (data) => ({
			email: data.email,
			emailVerified: Boolean(data.email_verified),
		}),
	});
}

export type Auth = ReturnType<typeof initializeLucia>;
