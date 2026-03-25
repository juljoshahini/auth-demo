export function isValidEmail(email: unknown): email is string {
	return typeof email === "string" && email.length >= 3 && email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
