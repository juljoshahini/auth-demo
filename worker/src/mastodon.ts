interface MastodonPostResult {
	id: string;
	url: string;
}

export async function publishToMastodon(
	instanceUrl: string,
	accessToken: string,
	content: string,
	mediaUrls: string[],
): Promise<MastodonPostResult> {
	const base = instanceUrl.replace(/\/+$/, "");

	// Upload media attachments if any
	const mediaIds: string[] = [];
	for (const url of mediaUrls.slice(0, 4)) {
		const imgRes = await fetch(url);
		if (!imgRes.ok) throw new Error(`Failed to fetch image: ${url}`);

		const blob = await imgRes.blob();
		const form = new FormData();
		form.append("file", blob);

		const uploadRes = await fetch(`${base}/api/v2/media`, {
			method: "POST",
			headers: { Authorization: `Bearer ${accessToken}` },
			body: form,
		});
		if (!uploadRes.ok) {
			const err = await uploadRes.text();
			throw new Error(`Mastodon media upload failed: ${err}`);
		}
		const media = await uploadRes.json() as { id: string };
		mediaIds.push(media.id);
	}

	// Create status
	const body: Record<string, unknown> = { status: content };
	if (mediaIds.length > 0) {
		body.media_ids = mediaIds;
	}

	const res = await fetch(`${base}/api/v1/statuses`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const err = await res.text();
		throw new Error(`Mastodon publish failed: ${err}`);
	}

	const data = await res.json() as { id: string; url: string };
	return { id: data.id, url: data.url };
}
