import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { postTable, postTargetTable, socialAccountTable } from "./schema";
import { publishToBluesky } from "./bluesky";
import { publishToTumblr } from "./tumblr";

interface Env {
	DB: D1Database;
}

interface SchedulePayload {
	postId: string;
	scheduledAt: number;
}

export class PostScheduler extends DurableObject<Env> {
	async schedule(payload: SchedulePayload): Promise<void> {
		await this.ctx.storage.put("postId", payload.postId);
		await this.ctx.storage.setAlarm(new Date(payload.scheduledAt));
	}

	async cancel(): Promise<void> {
		await this.ctx.storage.deleteAlarm();
		await this.ctx.storage.deleteAll();
	}

	async alarm(): Promise<void> {
		const postId = await this.ctx.storage.get<string>("postId");
		if (!postId) return;

		const db = drizzle(this.env.DB);

		await db.update(postTable)
			.set({ status: "publishing", updatedAt: Date.now() })
			.where(eq(postTable.id, postId));

		const [post] = await db.select()
			.from(postTable)
			.where(eq(postTable.id, postId))
			.limit(1);

		if (!post) {
			await this.ctx.storage.deleteAll();
			return;
		}

		const targets = await db.select({
			target: postTargetTable,
			account: socialAccountTable,
		})
			.from(postTargetTable)
			.innerJoin(socialAccountTable, eq(postTargetTable.socialAccountId, socialAccountTable.id))
			.where(eq(postTargetTable.postId, postId));

		const results = await Promise.allSettled(
			targets.map(async ({ target, account }) => {
				try {
					const platformPostId = await this.publishToPlatform(
						account.platform,
						account.accessToken,
						post.content,
						post.mediaUrls ? JSON.parse(post.mediaUrls) : []
					);
					await db.update(postTargetTable)
						.set({ status: "published", platformPostId, publishedAt: Date.now() })
						.where(eq(postTargetTable.id, target.id));
				} catch (err) {
					const errorMsg = err instanceof Error ? err.message : "Unknown error";
					await db.update(postTargetTable)
						.set({ status: "failed", error: errorMsg })
						.where(eq(postTargetTable.id, target.id));
					throw err;
				}
			})
		);

		const allSucceeded = results.every((r) => r.status === "fulfilled");
		const allFailed = results.every((r) => r.status === "rejected");

		await db.update(postTable)
			.set({
				status: allFailed ? "failed" : allSucceeded ? "published" : "published",
				updatedAt: Date.now(),
			})
			.where(eq(postTable.id, postId));

		await this.ctx.storage.deleteAll();
	}

	private async publishToPlatform(
		platform: string, accessToken: string, content: string, mediaUrls: string[]
	): Promise<string> {
		switch (platform) {
			case "bluesky": {
				const [identifier, appPassword] = accessToken.split(":::");
				if (!identifier || !appPassword) throw new Error("Invalid Bluesky credentials");
				const result = await publishToBluesky({ identifier, appPassword }, content, mediaUrls);
				return result.uri;
			}
			case "tumblr": {
				const [blogName, token] = accessToken.split(":::");
				if (!blogName || !token) throw new Error("Invalid Tumblr credentials");
				const result = await publishToTumblr(token, blogName, content, mediaUrls);
				return result.id;
			}
			default:
				throw new Error(`Platform "${platform}" not yet implemented`);
		}
	}
}
