import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "MarkFlow - WYSIWYG Markdown Editor",
  description: "A beautiful, distraction-free WYSIWYG Markdown editor. Features live rendering, LaTeX math support, and PDF export.",
  keywords: ["Markdown", "Editor", "WYSIWYG", "MarkFlow", "LaTeX", "Math", "PDF"],
  authors: [{ name: "MarkFlow Team" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✍️</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground"
      >
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
