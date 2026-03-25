import { AtpAgent } from "@atproto/api";

export async function verifyCredentials(identifier: string, appPassword: string) {
	const agent = new AtpAgent({ service: "https://bsky.social" });
	await agent.login({ identifier, password: appPassword });
	if (!agent.session) throw new Error("Failed to authenticate with Bluesky");
	return { did: agent.session.did, handle: agent.session.handle };
}
