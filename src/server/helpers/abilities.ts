import { AbilityBuilder, PureAbility } from "@casl/ability";

export type Role = "owner" | "admin" | "member";

export type Actions =
	| "manage"
	| "create"
	| "read"
	| "update"
	| "delete"
	| "invite";

export type Subjects =
	| "Organization"
	| "Member"
	| "Post"
	| "SocialAccount"
	| "all";

export type AppAbility = PureAbility<[Actions, Subjects]>;

export function defineAbilitiesFor(role: Role): AppAbility {
	const { can, build } = new AbilityBuilder<AppAbility>(PureAbility);

	// All authenticated org members can read
	can("read", "Organization");
	can("read", "Post");
	can("read", "SocialAccount");

	if (role === "member") {
		can("create", "Post");
		can("update", "Post");
		can("delete", "Post");
		can("create", "SocialAccount");
		can("delete", "SocialAccount");
	}

	if (role === "admin") {
		can("create", "Post");
		can("update", "Post");
		can("delete", "Post");
		can("create", "SocialAccount");
		can("delete", "SocialAccount");
		can("invite", "Member");
		can("delete", "Member");
		can("update", "Organization");
	}

	if (role === "owner") {
		can("manage", "all");
	}

	return build();
}
