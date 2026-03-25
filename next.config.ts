import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development") {
	const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
	initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
	images: {
		unoptimized: true,
	},
};

export default nextConfig;
