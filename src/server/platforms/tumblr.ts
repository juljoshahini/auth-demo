const TUMBLR_API = "https://api.tumblr.com/v2";

export async function verifyTumblrToken(accessToken: string): Promise<{ blogName: string; blogUuid: string }> {
	const res = await fetch(`${TUMBLR_API}/user/info`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Tumblr auth failed: ${err}`);
	}
	const data = await res.json() as {
		response: { user: { name: string; blogs: Array<{ uuid: string; name: string; primary: boolean }> } };
	};
	const primary = data.response.user.blogs.find((b) => b.primary) ?? data.response.user.blogs[0];
	if (!primary) throw new Error("No Tumblr blog found");
	return { blogName: primary.name, blogUuid: primary.uuid };
}
