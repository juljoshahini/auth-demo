import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
	return (
		<main className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
			<div className="text-center space-y-3">
				<h1 className="text-4xl font-bold tracking-tight">PostScheduler</h1>
				<p className="text-lg text-muted-foreground max-w-md">
					Schedule posts to Bluesky and other social networks. Powered by
					Cloudflare Workers and Durable Objects.
				</p>
			</div>
			<div className="flex gap-3">
				<Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
					Log in
				</Link>
				<Link href="/signup" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
					Sign up
				</Link>
			</div>
		</main>
	);
}
