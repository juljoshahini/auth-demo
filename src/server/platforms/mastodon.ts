export async function verifyMastodonCredentials(
	instanceUrl: string,
	accessToken: string,
): Promise<{ id: string; username: string; acct: string }> {
	const base = instanceUrl.replace(/\/+$/, "");
	const res = await fetch(`${base}/api/v1/accounts/verify_credentials`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Mastodon auth failed: ${err}`);
	}
	const data = await res.json() as { id: string; username: string; acct: string };
	return data;
}
