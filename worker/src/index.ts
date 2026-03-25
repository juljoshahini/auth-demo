export { PostScheduler } from "./PostScheduler";

export default {
	async fetch(): Promise<Response> {
		return new Response("Scheduler worker — Durable Objects only", { status: 200 });
	},
};
