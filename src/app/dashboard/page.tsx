"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, accounts, posts } from "@/lib/api";

type User = { userId: string; email: string; emailVerified: boolean };
type Account = { id: string; platform: string; platformUsername: string | null; platformAccountId: string };
type Post = { id: string; content: string; scheduledAt: number; status: string; mediaUrls: string | null; createdAt: number };

export default function DashboardPage() {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [socialAccounts, setSocialAccounts] = useState<Account[]>([]);
	const [scheduledPosts, setScheduledPosts] = useState<Post[]>([]);
	const [loading, setLoading] = useState(true);

	// Connect Bluesky form
	const [bskyIdentifier, setBskyIdentifier] = useState("");
	const [bskyAppPassword, setBskyAppPassword] = useState("");
	const [connectError, setConnectError] = useState("");
	const [connecting, setConnecting] = useState(false);

	// New post form
	const [postContent, setPostContent] = useState("");
	const [postDate, setPostDate] = useState("");
	const [postTime, setPostTime] = useState("");
	const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
	const [postError, setPostError] = useState("");
	const [scheduling, setScheduling] = useState(false);

	useEffect(() => {
		loadData();
	}, []);

	async function loadData() {
		try {
			const [userRes, accountsRes, postsRes] = await Promise.all([
				auth.me(),
				accounts.list(),
				posts.list(),
			]);
			setUser(userRes.user);
			setSocialAccounts(accountsRes.accounts);
			setScheduledPosts(postsRes.posts);
		} catch {
			router.push("/login");
		} finally {
			setLoading(false);
		}
	}

	async function handleConnectBluesky(e: React.FormEvent) {
		e.preventDefault();
		setConnectError("");
		setConnecting(true);

		try {
			await accounts.connect({
				platform: "bluesky",
				identifier: bskyIdentifier,
				appPassword: bskyAppPassword,
			});
			setBskyIdentifier("");
			setBskyAppPassword("");
			const res = await accounts.list();
			setSocialAccounts(res.accounts);
		} catch (err) {
			setConnectError(err instanceof Error ? err.message : "Failed to connect");
		} finally {
			setConnecting(false);
		}
	}

	async function handleDisconnect(id: string) {
		try {
			await accounts.disconnect(id);
			setSocialAccounts((prev) => prev.filter((a) => a.id !== id));
			setSelectedAccounts((prev) => prev.filter((a) => a !== id));
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to disconnect");
		}
	}

	async function handleSchedulePost(e: React.FormEvent) {
		e.preventDefault();
		setPostError("");

		if (selectedAccounts.length === 0) {
			setPostError("Select at least one account");
			return;
		}

		const scheduledAt = new Date(`${postDate}T${postTime}`).getTime();
		if (scheduledAt <= Date.now()) {
			setPostError("Scheduled time must be in the future");
			return;
		}

		setScheduling(true);

		try {
			await posts.create({
				content: postContent,
				scheduledAt,
				socialAccountIds: selectedAccounts,
			});
			setPostContent("");
			setPostDate("");
			setPostTime("");
			setSelectedAccounts([]);
			const res = await posts.list();
			setScheduledPosts(res.posts);
		} catch (err) {
			setPostError(err instanceof Error ? err.message : "Failed to schedule");
		} finally {
			setScheduling(false);
		}
	}

	async function handleCancelPost(id: string) {
		await posts.cancel(id);
		const res = await posts.list();
		setScheduledPosts(res.posts);
	}

	async function handleLogout() {
		await auth.logout();
		router.push("/login");
	}

	if (loading) {
		return (
			<main className="flex items-center justify-center min-h-screen">
				<p className="text-gray-500">Loading...</p>
			</main>
		);
	}

	return (
		<main className="max-w-3xl mx-auto p-6 space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Dashboard</h1>
					<p className="text-gray-500 text-sm">{user?.email}</p>
				</div>
				<button
					onClick={handleLogout}
					className="text-sm text-gray-500 hover:text-gray-900 transition"
				>
					Log out
				</button>
			</div>

			{/* Connected Accounts */}
			<section className="space-y-4">
				<h2 className="text-lg font-semibold">Connected Accounts</h2>

				{socialAccounts.length > 0 && (
					<div className="space-y-2">
						{socialAccounts.map((account) => (
							<div
								key={account.id}
								className="flex items-center justify-between p-3 bg-white border rounded-lg"
							>
								<div>
									<span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded mr-2">
										{account.platform}
									</span>
									<span className="text-sm">{account.platformUsername || account.platformAccountId}</span>
								</div>
								<button
									onClick={() => handleDisconnect(account.id)}
									className="text-xs text-red-600 hover:text-red-800"
								>
									Disconnect
								</button>
							</div>
						))}
					</div>
				)}

				<form onSubmit={handleConnectBluesky} className="p-4 bg-white border rounded-lg space-y-3">
					<h3 className="text-sm font-medium">Connect Bluesky</h3>
					{connectError && (
						<div className="p-2 text-xs text-red-700 bg-red-50 rounded">{connectError}</div>
					)}
					<input
						type="text"
						placeholder="Handle (e.g. user.bsky.social)"
						value={bskyIdentifier}
						onChange={(e) => setBskyIdentifier(e.target.value)}
						required
						className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
					/>
					<input
						type="password"
						placeholder="App Password"
						value={bskyAppPassword}
						onChange={(e) => setBskyAppPassword(e.target.value)}
						required
						className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
					/>
					<button
						type="submit"
						disabled={connecting}
						className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
					>
						{connecting ? "Connecting..." : "Connect"}
					</button>
				</form>
			</section>

			{/* Schedule Post */}
			<section className="space-y-4">
				<h2 className="text-lg font-semibold">Schedule a Post</h2>

				<form onSubmit={handleSchedulePost} className="p-4 bg-white border rounded-lg space-y-3">
					{postError && (
						<div className="p-2 text-xs text-red-700 bg-red-50 rounded">{postError}</div>
					)}

					<textarea
						placeholder="What do you want to post?"
						value={postContent}
						onChange={(e) => setPostContent(e.target.value)}
						required
						rows={3}
						className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
					/>

					<div className="flex gap-3">
						<input
							type="date"
							value={postDate}
							onChange={(e) => setPostDate(e.target.value)}
							required
							className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
						/>
						<input
							type="time"
							value={postTime}
							onChange={(e) => setPostTime(e.target.value)}
							required
							className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
						/>
					</div>

					{socialAccounts.length > 0 && (
						<div className="space-y-1">
							<p className="text-xs text-gray-500">Post to:</p>
							{socialAccounts.map((account) => (
								<label key={account.id} className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={selectedAccounts.includes(account.id)}
										onChange={(e) => {
											if (e.target.checked) {
												setSelectedAccounts((prev) => [...prev, account.id]);
											} else {
												setSelectedAccounts((prev) => prev.filter((id) => id !== account.id));
											}
										}}
										className="rounded"
									/>
									<span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
										{account.platform}
									</span>
									{account.platformUsername || account.platformAccountId}
								</label>
							))}
						</div>
					)}

					<button
						type="submit"
						disabled={scheduling || socialAccounts.length === 0}
						className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
					>
						{scheduling ? "Scheduling..." : "Schedule Post"}
					</button>
				</form>
			</section>

			{/* Posts List */}
			<section className="space-y-4">
				<h2 className="text-lg font-semibold">Posts</h2>

				{scheduledPosts.length === 0 ? (
					<p className="text-sm text-gray-500">No posts yet.</p>
				) : (
					<div className="space-y-2">
						{scheduledPosts.map((post) => (
							<div key={post.id} className="p-4 bg-white border rounded-lg">
								<div className="flex items-start justify-between gap-4">
									<p className="text-sm flex-1">{post.content}</p>
									<span
										className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded ${
											post.status === "published"
												? "bg-green-100 text-green-800"
												: post.status === "failed"
													? "bg-red-100 text-red-800"
													: post.status === "cancelled"
														? "bg-gray-100 text-gray-600"
														: "bg-yellow-100 text-yellow-800"
										}`}
									>
										{post.status}
									</span>
								</div>
								<div className="flex items-center justify-between mt-2">
									<p className="text-xs text-gray-400">
										{new Date(post.scheduledAt).toLocaleString()}
									</p>
									{post.status === "scheduled" && (
										<button
											onClick={() => handleCancelPost(post.id)}
											className="text-xs text-red-600 hover:text-red-800"
										>
											Cancel
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		</main>
	);
}
