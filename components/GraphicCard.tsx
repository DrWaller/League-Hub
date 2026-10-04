"use client";

import { useEffect, useState } from "react";

type State =
  | { status: "loading" }
  | { status: "ok"; src: string }
  | { status: "error"; message: string };

// Loads the image itself (rather than a bare <img>) so that when the server
// answers with an error instead of a picture -- "no final matchups yet",
// "ESPN isn't connected", a crash -- the actual message shows up here
// instead of a blank broken-image icon.
export default function GraphicCard({ title, url, portrait, fresh = true }: { title: string; url: string; portrait?: boolean; fresh?: boolean }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [copied, setCopied] = useState<"idle" | "ok" | "error">("idle");

  async function copyCaption() {
    try {
      const res = await fetch(`${url}&caption=1`);
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("error");
    }
    setTimeout(() => setCopied("idle"), 2500);
  }

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: "loading" });

    fetch(url, fresh ? { cache: "no-store" } : undefined)
      .then(async (res) => {
        const type = res.headers.get("content-type") || "";
        if (res.ok && type.startsWith("image/")) {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setState({ status: "ok", src: objectUrl });
          return;
        }
        let message: string;
        if (res.redirected) {
          message = "Your admin login has expired -- reload the page and log in again.";
        } else if (type.includes("text/html")) {
          message = `The server crashed while making this image (HTTP ${res.status}). The details are in Vercel's function logs.`;
        } else {
          message = (await res.text()).slice(0, 1500) || `Couldn't generate this image (HTTP ${res.status}).`;
        }
        if (!cancelled) setState({ status: "error", message });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Network error while loading this image." });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg">{title}</h2>
        {state.status === "ok" && (
          <div className="flex items-center gap-4 text-sm">
            <button onClick={copyCaption} className="text-rink hover:underline">
              {copied === "ok" ? "Copied!" : copied === "error" ? "Couldn't copy" : "Copy caption"}
            </button>
            <a href={url} download className="text-rink hover:underline">
              Download
            </a>
          </div>
        )}
      </div>
      {state.status === "loading" && <p className="text-sm text-muted border border-ice-line p-4">Generating…</p>}
      {state.status === "error" && (
        <p className="text-sm border border-center-red/40 bg-ice-panel p-4 whitespace-pre-wrap">{state.message}</p>
      )}
      {state.status === "ok" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={state.src} alt={title} className={`w-full border border-ice-line ${portrait ? "max-w-sm" : ""}`} />
      )}
    </div>
  );
}
