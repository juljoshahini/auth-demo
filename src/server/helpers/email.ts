export async function sendVerificationEmail(email: string, code: string) {
	console.log(`[DEV] Verification code for ${email}: ${code}`);
}

export async function sendPasswordResetEmail(email: string, token: string, baseUrl: string) {
	console.log(`[DEV] Password reset link for ${email}: ${baseUrl}/auth/reset-password/${token}`);
}
