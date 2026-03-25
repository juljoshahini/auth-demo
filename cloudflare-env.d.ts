interface PostSchedulerStub {
	schedule(payload: { postId: string; scheduledAt: number }): Promise<void>;
	cancel(): Promise<void>;
}

interface CloudflareEnv {
	DB: D1Database;
	ASSETS: Fetcher;
	POST_SCHEDULER: DurableObjectNamespace<PostSchedulerStub>;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	DISCORD_CLIENT_ID: string;
	DISCORD_CLIENT_SECRET: string;
}
