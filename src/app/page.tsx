import Link from "next/link";

export default function Home() {
	return (
		<main className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
			<h1 className="text-4xl font-bold">PostScheduler</h1>
			<p className="text-lg text-gray-600 text-center max-w-md">
				Schedule posts to Bluesky and other social networks. Powered by
				Cloudflare Workers and Durable Objects.
			</p>
			<div className="flex gap-4">
				<Link
					href="/login"
					className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
				>
					Log in
				</Link>
				<Link
					href="/signup"
					className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
				>
					Sign up
				</Link>
			</div>
		</main>
	);
}
