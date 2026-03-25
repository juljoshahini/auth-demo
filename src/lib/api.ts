async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`/api${path}`, {
		...options,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
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
