import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
	variable: "--font-sans",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "PostScheduler",
	description: "Schedule posts to social networks",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={cn("h-full antialiased", inter.variable)}>
			<body className="min-h-full font-sans bg-background text-foreground">
				{children}
			</body>
		</html>
	);
}
