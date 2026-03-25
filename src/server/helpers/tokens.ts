import { eq } from "drizzle-orm";
import { generateRandomString, isWithinExpiration } from "lucia/utils";
import { emailVerificationCodeTable, passwordResetTokenTable } from "../db/schema";
import type { Database } from "../db";

export async function generateEmailVerificationCode(db: Database, userId: string): Promise<string> {
	const code = generateRandomString(8, "0123456789");
	const expires = Date.now() + 1000 * 60 * 5;
	await db.delete(emailVerificationCodeTable).where(eq(emailVerificationCodeTable.userId, userId));
	await db.insert(emailVerificationCodeTable).values({ userId, code, expires });
	return code;
}

const RESET_TOKEN_EXPIRES_IN = 1000 * 60 * 60 * 2;

export async function generatePasswordResetToken(db: Database, userId: string): Promise<string> {
	const existing = await db.select().from(passwordResetTokenTable).where(eq(passwordResetTokenTable.userId, userId));
	if (existing.length > 0) {
		const reusable = existing.find((t) => isWithinExpiration(Number(t.expires) - RESET_TOKEN_EXPIRES_IN / 2));
		if (reusable) return reusable.id;
	}
	const token = generateRandomString(63);
	await db.insert(passwordResetTokenTable).values({ id: token, userId, expires: Date.now() + RESET_TOKEN_EXPIRES_IN });
	return token;
}

export async function validatePasswordResetToken(db: Database, token: string): Promise<string> {
	const [stored] = await db.select().from(passwordResetTokenTable).where(eq(passwordResetTokenTable.id, token)).limit(1);
	if (!stored) throw new Error("Invalid token");
	await db.delete(passwordResetTokenTable).where(eq(passwordResetTokenTable.id, token));
	if (!isWithinExpiration(Number(stored.expires))) throw new Error("Expired token");
	return stored.userId;
}
