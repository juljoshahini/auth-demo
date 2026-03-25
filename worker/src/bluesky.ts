import { AtpAgent, RichText } from "@atproto/api";

interface BlueskyCredentials {
	identifier: string;
	appPassword: string;
}

export async function publishToBluesky(
	credentials: BlueskyCredentials, content: string, mediaUrls: string[] = []
): Promise<{ uri: string; cid: string }> {
	const agent = new AtpAgent({ service: "https://bsky.social" });
	await agent.login({ identifier: credentials.identifier, password: credentials.appPassword });

	const rt = new RichText({ text: content });
	await rt.detectFacets(agent);

	const record: Record<string, unknown> = {
		$type: "app.bsky.feed.post",
		text: rt.text,
		facets: rt.facets,
		createdAt: new Date().toISOString(),
	};

	if (mediaUrls.length > 0) {
		const images = await Promise.all(
			mediaUrls.slice(0, 4).map(async (url) => {
				const res = await fetch(url);
				if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
				const contentType = res.headers.get("content-type") ?? "image/jpeg";
				const uint8 = new Uint8Array(await res.arrayBuffer());
				const uploadRes = await agent.uploadBlob(uint8, { encoding: contentType });
				return { alt: "", image: uploadRes.data.blob };
			})
		);
		record.embed = { $type: "app.bsky.embed.images", images };
	}

	return await agent.post(record as Parameters<typeof agent.post>[0]);
}
