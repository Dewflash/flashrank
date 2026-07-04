import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlashRank — ASO Studio",
  description:
    "App Store Optimization Tool for Apple Developers. Track keywords, check popularity and difficulty, and grow your app's visibility.",
  openGraph: {
    title: "FlashRank: App Store Optimization Studio for iOS developers",
    description:
      "FlashRank helps you improve the visibility of your app and grow your revenue. Track keywords, check the popularity and difficulty of each keyword, and get suggestions on the best keywords to add.",
    siteName: "FlashRank",
  },
  twitter: {
    card: "summary_large_image",
    title: "FlashRank: App Store Optimization Studio for iOS developers",
    description:
      "FlashRank helps you improve the visibility of your app and grow your revenue.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
