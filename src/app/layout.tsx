import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./editor.css";
import "./editor-polish.css";
import { Toaster } from "@/components/ui/sonner";
import { PersistenceRuntime } from "@/components/editor/PersistenceRuntime";
import { QuickOpen } from "@/components/editor/QuickOpen";
import { WikiLinkRenameRuntime } from "@/components/editor/WikiLinkRenameRuntime";

export const metadata: Metadata = {
  title: "MarkFlow - Local-first Markdown Knowledge Workspace",
  description: "A local-first Markdown knowledge workspace with Typora-style WYSIWYG editing, source mode, Wiki links, Mermaid, math, Excalidraw, search, and direct local-folder access.",
  keywords: [
    "Markdown",
    "Editor",
    "WYSIWYG",
    "Local-first",
    "Knowledge Workspace",
    "MarkFlow",
    "Wiki Links",
    "Mermaid",
    "LaTeX",
    "Excalidraw",
  ],
  authors: [{ name: "MarkFlow Team" }],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✍️</text></svg>",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <PersistenceRuntime />
        <WikiLinkRenameRuntime />
        <QuickOpen />
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
