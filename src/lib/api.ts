let currentOrgId: string | null = null;

export function setCurrentOrg(orgId: string | null) {
	currentOrgId = orgId;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...options?.headers as Record<string, string>,
	};

	if (currentOrgId) {
		headers["X-Org-Id"] = currentOrgId;
	}

	const res = await fetch(`/api${path}`, {
		...options,
		credentials: "include",
		headers,
	});

	const data = await res.json();

	if (!res.ok) {
		throw new Error((data as { error?: string }).error || "Request failed");
	}

	return data as T;
}

// Auth
export const auth = {
	signup: (email: string, password: string) =>
		request<{ user: { userId: string; email: string }; message: string }>("/auth/signup", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		}),

	login: (email: string, password: string) =>
		request<{ user: { userId: string } }>("/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		}),

	me: () =>
		request<{ user: { userId: string; email: string; emailVerified: boolean } }>("/auth/me"),

	logout: () =>
		request<{ success: boolean }>("/auth/logout", { method: "POST" }),

	verifyEmail: (code: string) =>
		request<{ message: string }>("/auth/verify-email", {
			method: "POST",
			body: JSON.stringify({ code }),
		}),

	resendVerification: () =>
		request<{ message: string }>("/auth/resend-verification", { method: "POST" }),
};

// Organizations
export const orgs = {
	list: () =>
		request<{ organizations: Array<{ orgId: string; role: string; name: string; createdAt: number }> }>("/orgs"),

	create: (name: string) =>
		request<{ org: { id: string; name: string } }>("/orgs", {
			method: "POST",
			body: JSON.stringify({ name }),
		}),

	get: () =>
		request<{
			org: { id: string; name: string; createdAt: number };
			members: Array<{ userId: string; role: string; email: string; joinedAt: number }>;
		}>("/orgs/current"),

	update: (name: string) =>
		request<{ success: boolean }>("/orgs/current", {
			method: "PUT",
			body: JSON.stringify({ name }),
		}),

	invite: (email: string, role?: string) =>
		request<{ invite: { id: string; email: string; role: string; expires: number } }>("/orgs/current/invite", {
			method: "POST",
			body: JSON.stringify({ email, role }),
		}),

	listInvites: () =>
		request<{ invites: Array<{ id: string; email: string; role: string; expires: number }> }>("/orgs/current/invites"),

	removeMember: (userId: string) =>
		request<{ success: boolean }>(`/orgs/current/members/${userId}`, { method: "DELETE" }),
};

// Invites (user-level)
export const invites = {
	list: () =>
		request<{ invites: Array<{ id: string; orgId: string; orgName: string; role: string; expires: number }> }>("/invites"),

	accept: (inviteId: string) =>
		request<{ success: boolean; orgId: string }>(`/invites/${inviteId}/accept`, { method: "POST" }),
};

// Social Accounts
export const accounts = {
	list: () =>
		request<{ accounts: Array<{ id: string; platform: string; platformUsername: string | null; platformAccountId: string }> }>("/accounts"),

	connect: (data: { platform: string; [key: string]: unknown }) =>
		request<{ account: { id: string; platform: string; platformAccountId: string; platformUsername: string | null } }>("/accounts/connect", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	disconnect: (id: string) =>
		request<{ message: string }>(`/accounts/${id}`, { method: "DELETE" }),
};

// Posts
export const posts = {
	list: (status?: string) =>
		request<{ posts: Array<{ id: string; content: string; scheduledAt: number; status: string; mediaUrls: string | null; createdAt: number }> }>(
			`/posts${status ? `?status=${status}` : ""}`
		),

	get: (id: string) =>
		request<{ post: { id: string; content: string; scheduledAt: number; status: string; mediaUrls: string[]; targets: Array<{ platform: string; platformUsername: string | null; status: string; error: string | null }> } }>(
			`/posts/${id}`
		),

	create: (data: { content: string; scheduledAt: number; socialAccountIds: string[]; mediaUrls?: string[] }) =>
		request<{ post: { id: string; content: string; scheduledAt: number; status: string } }>("/posts", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	update: (id: string, data: { content?: string; scheduledAt?: number; socialAccountIds?: string[]; mediaUrls?: string[] }) =>
		request<{ message: string }>(`/posts/${id}`, {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	cancel: (id: string) =>
		request<{ message: string }>(`/posts/${id}/cancel`, { method: "POST" }),

	delete: (id: string) =>
		request<{ message: string }>(`/posts/${id}`, { method: "DELETE" }),
};
