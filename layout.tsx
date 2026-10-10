import type { Metadata } from "next";
import { Oswald, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { getLeagueMeta } from "@/lib/espn";

const display = Oswald({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Fantasy Hockey League",
  description: "Standings, matchups, rosters, power rankings, and history.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const meta = await getLeagueMeta();

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Nav leagueName={meta.name} />
        <main className="max-w-content mx-auto px-4 sm:px-6 py-10">{children}</main>
        <footer className="border-t border-ice-line mt-16">
          <div className="max-w-content mx-auto px-4 sm:px-6 py-6 text-sm text-muted flex justify-between items-center flex-wrap gap-2">
            <span>{meta.name}</span>
            <span className="flex items-center gap-4">
              <span>
                {meta.liveDataConnected ? "Live data from ESPN" : "Preview data — connect ESPN to go live"}
              </span>
              <a href="/admin" className="hover:text-rink">
                Commissioner
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
