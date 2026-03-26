"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth, accounts, posts, orgs, invites, setCurrentOrg } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type User = { userId: string; email: string; emailVerified: boolean };
type Org = { orgId: string; role: string; name: string; createdAt: number };
type Member = { userId: string; role: string; email: string; joinedAt: number };
type Account = { id: string; platform: string; platformUsername: string | null; platformAccountId: string };
type Post = { id: string; content: string; scheduledAt: number; status: string; mediaUrls: string | null; createdAt: number };
type Invite = { id: string; email: string; role: string; expires: number };
type PendingInvite = { id: string; orgId: string; orgName: string; role: string; expires: number };

export default function DashboardPage() {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [userOrgs, setUserOrgs] = useState<Org[]>([]);
	const [currentOrg, setCurrentOrgState] = useState<Org | null>(null);
	const [members, setMembers] = useState<Member[]>([]);
	const [orgInvites, setOrgInvites] = useState<Invite[]>([]);
	const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
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

	// Invite form
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState("member");
	const [inviteError, setInviteError] = useState("");
	const [inviting, setInviting] = useState(false);
	const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

	// Create org form
	const [newOrgName, setNewOrgName] = useState("");
	const [creatingOrg, setCreatingOrg] = useState(false);
	const [orgDialogOpen, setOrgDialogOpen] = useState(false);

	const loadOrgData = useCallback(async () => {
		try {
			const [accountsRes, postsRes, orgRes] = await Promise.all([
				accounts.list(),
				posts.list(),
				orgs.get(),
			]);
			setSocialAccounts(accountsRes.accounts);
			setScheduledPosts(postsRes.posts);
			setMembers(orgRes.members);

			// Load invites if owner/admin
			try {
				const invitesRes = await orgs.listInvites();
				setOrgInvites(invitesRes.invites);
			} catch {
				setOrgInvites([]);
			}
		} catch {
			// org data load failed
		}
	}, []);

	useEffect(() => {
		async function init() {
			try {
				const [userRes, orgsRes, pendingRes] = await Promise.all([
					auth.me(),
					orgs.list(),
					invites.list(),
				]);
				setUser(userRes.user);
				setUserOrgs(orgsRes.organizations);
				setPendingInvites(pendingRes.invites);

				if (orgsRes.organizations.length > 0) {
					const firstOrg = orgsRes.organizations[0];
					setCurrentOrg(firstOrg.orgId);
					setCurrentOrgState(firstOrg);
				}
			} catch {
				router.push("/login");
			} finally {
				setLoading(false);
			}
		}
		init();
	}, [router]);

	useEffect(() => {
		if (currentOrg) {
			loadOrgData();
		}
	}, [currentOrg, loadOrgData]);

	function switchOrg(org: Org) {
		setCurrentOrg(org.orgId);
		setCurrentOrgState(org);
		setSelectedAccounts([]);
	}

	async function handleCreateOrg(e: React.FormEvent) {
		e.preventDefault();
		setCreatingOrg(true);
		try {
			const res = await orgs.create(newOrgName);
			const orgsRes = await orgs.list();
			setUserOrgs(orgsRes.organizations);
			const newOrg = orgsRes.organizations.find((o: Org) => o.orgId === res.org.id);
			if (newOrg) switchOrg(newOrg);
			setNewOrgName("");
			setOrgDialogOpen(false);
		} catch {
			// creation failed
		} finally {
			setCreatingOrg(false);
		}
	}

	async function handleAcceptInvite(inviteId: string) {
		try {
			await invites.accept(inviteId);
			const [orgsRes, pendingRes] = await Promise.all([orgs.list(), invites.list()]);
			setUserOrgs(orgsRes.organizations);
			setPendingInvites(pendingRes.invites);
		} catch {
			// accept failed
		}
	}

	async function handleConnectBluesky(e: React.FormEvent) {
		e.preventDefault();
		setConnectError("");
		setConnecting(true);
		try {
			await accounts.connect({ platform: "bluesky", identifier: bskyIdentifier, appPassword: bskyAppPassword });
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
		if (selectedAccounts.length === 0) { setPostError("Select at least one account"); return; }
		const scheduledAt = new Date(`${postDate}T${postTime}`).getTime();
		if (scheduledAt <= Date.now()) { setPostError("Scheduled time must be in the future"); return; }
		setScheduling(true);
		try {
			await posts.create({ content: postContent, scheduledAt, socialAccountIds: selectedAccounts });
			setPostContent(""); setPostDate(""); setPostTime(""); setSelectedAccounts([]);
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

	async function handleInvite(e: React.FormEvent) {
		e.preventDefault();
		setInviteError("");
		setInviting(true);
		try {
			await orgs.invite(inviteEmail, inviteRole);
			setInviteEmail("");
			setInviteRole("member");
			setInviteDialogOpen(false);
			const res = await orgs.listInvites();
			setOrgInvites(res.invites);
		} catch (err) {
			setInviteError(err instanceof Error ? err.message : "Failed to invite");
		} finally {
			setInviting(false);
		}
	}

	async function handleRemoveMember(userId: string) {
		try {
			await orgs.removeMember(userId);
			setMembers((prev) => prev.filter((m) => m.userId !== userId));
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to remove member");
		}
	}

	async function handleLogout() {
		await auth.logout();
		router.push("/login");
	}

	if (loading) {
		return (
			<main className="flex items-center justify-center min-h-screen">
				<p className="text-muted-foreground">Loading...</p>
			</main>
		);
	}

	const isOwnerOrAdmin = currentOrg && (currentOrg.role === "owner" || currentOrg.role === "admin");

	const statusVariant = (status: string) => {
		switch (status) {
			case "published": return "default" as const;
			case "failed": return "destructive" as const;
			case "cancelled": return "secondary" as const;
			default: return "outline" as const;
		}
	};

	return (
		<div className="min-h-screen bg-background">
			{/* Top bar */}
			<header className="border-b bg-card">
				<div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<h1 className="font-semibold text-lg">PostScheduler</h1>
						<Separator orientation="vertical" className="h-6" />
						<DropdownMenu>
							<DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-lg px-2.5 h-7 text-sm font-medium hover:bg-muted transition-colors">
								{currentOrg?.name || "Select org"}
								<Badge variant="outline" className="text-xs font-normal">{currentOrg?.role}</Badge>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								<DropdownMenuGroup>
									<DropdownMenuLabel>Organizations</DropdownMenuLabel>
									{userOrgs.map((org) => (
										<DropdownMenuItem key={org.orgId} onClick={() => switchOrg(org)}>
											<span className="flex-1">{org.name}</span>
											{org.orgId === currentOrg?.orgId && (
												<Badge variant="secondary" className="ml-2 text-xs">current</Badge>
											)}
										</DropdownMenuItem>
									))}
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => setOrgDialogOpen(true)}>
									+ New organization
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-sm text-muted-foreground">{user?.email}</span>
						<Button variant="ghost" size="sm" onClick={handleLogout}>Log out</Button>
					</div>
				</div>
			</header>

			<main className="max-w-5xl mx-auto p-6 space-y-6">
				{/* Pending Invites Banner */}
				{pendingInvites.length > 0 && (
					<Card className="border-primary/20 bg-primary/5">
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Pending Invites</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							{pendingInvites.map((inv) => (
								<div key={inv.id} className="flex items-center justify-between">
									<span className="text-sm">
										<strong>{inv.orgName}</strong> as <Badge variant="outline">{inv.role}</Badge>
									</span>
									<Button size="sm" onClick={() => handleAcceptInvite(inv.id)}>Accept</Button>
								</div>
							))}
						</CardContent>
					</Card>
				)}

				<Tabs defaultValue="posts" className="space-y-6">
					<TabsList>
						<TabsTrigger value="posts">Posts</TabsTrigger>
						<TabsTrigger value="accounts">Accounts</TabsTrigger>
						<TabsTrigger value="team">Team</TabsTrigger>
					</TabsList>

					{/* ─── Posts Tab ─── */}
					<TabsContent value="posts" className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Schedule a Post</CardTitle>
								<CardDescription>Create a new post to publish later</CardDescription>
							</CardHeader>
							<CardContent>
								<form onSubmit={handleSchedulePost} className="space-y-4">
									{postError && (
										<div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{postError}</div>
									)}
									<div className="space-y-2">
										<Label htmlFor="post-content">Content</Label>
										<Textarea
											id="post-content"
											placeholder="What do you want to post?"
											value={postContent}
											onChange={(e) => setPostContent(e.target.value)}
											required
											rows={3}
										/>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div className="space-y-2">
											<Label htmlFor="post-date">Date</Label>
											<Input id="post-date" type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)} required />
										</div>
										<div className="space-y-2">
											<Label htmlFor="post-time">Time</Label>
											<Input id="post-time" type="time" value={postTime} onChange={(e) => setPostTime(e.target.value)} required />
										</div>
									</div>
									{socialAccounts.length > 0 ? (
										<div className="space-y-2">
											<Label>Post to</Label>
											<div className="space-y-2">
												{socialAccounts.map((account) => (
													<label key={account.id} className="flex items-center gap-2 text-sm cursor-pointer">
														<Checkbox
															checked={selectedAccounts.includes(account.id)}
															onCheckedChange={(checked) => {
																if (checked) {
																	setSelectedAccounts((prev) => [...prev, account.id]);
																} else {
																	setSelectedAccounts((prev) => prev.filter((id) => id !== account.id));
																}
															}}
														/>
														<Badge variant="secondary">{account.platform}</Badge>
														{account.platformUsername || account.platformAccountId}
													</label>
												))}
											</div>
										</div>
									) : (
										<p className="text-sm text-muted-foreground">Connect a social account first in the Accounts tab.</p>
									)}
									<Button type="submit" disabled={scheduling || socialAccounts.length === 0}>
										{scheduling ? "Scheduling..." : "Schedule Post"}
									</Button>
								</form>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Posts</CardTitle>
								<CardDescription>{scheduledPosts.length} total</CardDescription>
							</CardHeader>
							<CardContent>
								{scheduledPosts.length === 0 ? (
									<p className="text-sm text-muted-foreground">No posts yet.</p>
								) : (
									<div className="space-y-3">
										{scheduledPosts.map((post) => (
											<div key={post.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border">
												<div className="flex-1 min-w-0">
													<p className="text-sm">{post.content}</p>
													<p className="text-xs text-muted-foreground mt-1">
														{new Date(post.scheduledAt).toLocaleString()}
													</p>
												</div>
												<div className="flex items-center gap-2 shrink-0">
													<Badge variant={statusVariant(post.status)}>{post.status}</Badge>
													{post.status === "scheduled" && (
														<Button variant="ghost" size="sm" className="text-destructive h-7 px-2" onClick={() => handleCancelPost(post.id)}>
															Cancel
														</Button>
													)}
												</div>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>

					{/* ─── Accounts Tab ─── */}
					<TabsContent value="accounts" className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Connected Accounts</CardTitle>
								<CardDescription>Social accounts shared across your organization</CardDescription>
							</CardHeader>
							<CardContent>
								{socialAccounts.length === 0 ? (
									<p className="text-sm text-muted-foreground">No accounts connected yet.</p>
								) : (
									<div className="space-y-2">
										{socialAccounts.map((account) => (
											<div key={account.id} className="flex items-center justify-between p-3 rounded-lg border">
												<div className="flex items-center gap-2">
													<Badge variant="secondary">{account.platform}</Badge>
													<span className="text-sm">{account.platformUsername || account.platformAccountId}</span>
												</div>
												<Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDisconnect(account.id)}>
													Disconnect
												</Button>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Connect Bluesky</CardTitle>
								<CardDescription>Use your handle and an app password</CardDescription>
							</CardHeader>
							<CardContent>
								<form onSubmit={handleConnectBluesky} className="space-y-4">
									{connectError && (
										<div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{connectError}</div>
									)}
									<div className="space-y-2">
										<Label htmlFor="bsky-handle">Handle</Label>
										<Input id="bsky-handle" placeholder="user.bsky.social" value={bskyIdentifier} onChange={(e) => setBskyIdentifier(e.target.value)} required />
									</div>
									<div className="space-y-2">
										<Label htmlFor="bsky-password">App Password</Label>
										<Input id="bsky-password" type="password" placeholder="App password" value={bskyAppPassword} onChange={(e) => setBskyAppPassword(e.target.value)} required />
									</div>
									<Button type="submit" disabled={connecting}>
										{connecting ? "Connecting..." : "Connect"}
									</Button>
								</form>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Connect Tumblr</CardTitle>
								<CardDescription>Authorize with Tumblr to schedule posts to your blog</CardDescription>
							</CardHeader>
							<CardContent>
								<Button onClick={() => { window.location.href = "/api/accounts/tumblr/connect"; }}>
									Connect Tumblr
								</Button>
							</CardContent>
						</Card>
					</TabsContent>

					{/* ─── Team Tab ─── */}
					<TabsContent value="team" className="space-y-6">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between">
								<div>
									<CardTitle>Team Members</CardTitle>
									<CardDescription>{members.length} member{members.length !== 1 && "s"}</CardDescription>
								</div>
								{isOwnerOrAdmin && (
									<>
									<Button size="sm" onClick={() => setInviteDialogOpen(true)}>Invite member</Button>
									<Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
										<DialogContent>
											<DialogHeader>
												<DialogTitle>Invite a team member</DialogTitle>
												<DialogDescription>Send an invite by email. They can accept it when they log in.</DialogDescription>
											</DialogHeader>
											<form onSubmit={handleInvite} className="space-y-4">
												{inviteError && (
													<div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{inviteError}</div>
												)}
												<div className="space-y-2">
													<Label htmlFor="invite-email">Email</Label>
													<Input id="invite-email" type="email" placeholder="colleague@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
												</div>
												<div className="space-y-2">
													<Label htmlFor="invite-role">Role</Label>
													<select
														id="invite-role"
														value={inviteRole}
														onChange={(e) => setInviteRole(e.target.value)}
														className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
													>
														<option value="member">Member</option>
														<option value="admin">Admin</option>
													</select>
												</div>
												<DialogFooter>
													<Button type="submit" disabled={inviting}>
														{inviting ? "Sending..." : "Send Invite"}
													</Button>
												</DialogFooter>
											</form>
										</DialogContent>
									</Dialog>
									</>
								)}
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{members.map((member) => (
										<div key={member.userId} className="flex items-center justify-between p-3 rounded-lg border">
											<div className="flex items-center gap-3">
												<div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
													{member.email[0].toUpperCase()}
												</div>
												<div>
													<p className="text-sm font-medium">{member.email}</p>
													<Badge variant="outline" className="text-xs">{member.role}</Badge>
												</div>
											</div>
											{isOwnerOrAdmin && member.role !== "owner" && member.userId !== user?.userId && (
												<Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemoveMember(member.userId)}>
													Remove
												</Button>
											)}
										</div>
									))}
								</div>
							</CardContent>
						</Card>

						{isOwnerOrAdmin && orgInvites.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle>Pending Invites</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										{orgInvites.map((inv) => (
											<div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
												<div>
													<p className="text-sm">{inv.email}</p>
													<p className="text-xs text-muted-foreground">
														Expires {new Date(inv.expires).toLocaleDateString()}
													</p>
												</div>
												<Badge variant="outline">{inv.role}</Badge>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						)}
					</TabsContent>
				</Tabs>
			</main>

			{/* Create Org Dialog */}
			<Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create organization</DialogTitle>
						<DialogDescription>Create a new workspace for your team.</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleCreateOrg} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="org-name">Name</Label>
							<Input id="org-name" placeholder="My Team" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required />
						</div>
						<DialogFooter>
							<Button type="submit" disabled={creatingOrg}>
								{creatingOrg ? "Creating..." : "Create"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
