const TUMBLR_API = "https://api.tumblr.com/v2";

interface TumblrPostResult {
	id: string;
}

export async function publishToTumblr(
	accessToken: string,
	blogName: string,
	content: string,
	mediaUrls: string[],
): Promise<TumblrPostResult> {
	const contentBlocks: Array<Record<string, unknown>> = [
		{ type: "text", text: content },
	];

	for (const url of mediaUrls) {
		contentBlocks.push({
			type: "image",
			media: [{ type: "image/jpeg", url }],
		});
	}

	const blogIdentifier = blogName.includes(".") ? blogName : `${blogName}.tumblr.com`;
	const res = await fetch(`${TUMBLR_API}/blog/${blogIdentifier}/posts`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			content: contentBlocks,
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Tumblr publish failed: ${err}`);
	}

	const data = await res.json() as { response: { id: string } };
	return { id: data.response.id };
}
