import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
	variable: "--font-inter",
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
		<html lang="en" className={cn("h-full", "antialiased", inter.variable, "font-sans", geist.variable)}>
			<body className="min-h-full flex flex-col bg-gray-50 text-gray-900 font-sans">
				{children}
			</body>
		</html>
	);
}
