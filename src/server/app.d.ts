/// <reference types="lucia" />
declare namespace Lucia {
	type Auth = import("./helpers/lucia").Auth;
	type DatabaseUserAttributes = { email: string; email_verified: number };
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	type DatabaseSessionAttributes = {};
}
