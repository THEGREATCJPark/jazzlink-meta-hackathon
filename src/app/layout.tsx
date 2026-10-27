import type { Metadata } from "next";
export const metadata: Metadata = { title: "JazzLink AI", description: "Bring gig details together for a clear agreement." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
