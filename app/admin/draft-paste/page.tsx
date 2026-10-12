"use client";

import { useState } from "react";

interface Reply {
  mode?: string;
  saved?: number;
  picks?: { overall: number; team: string; player: string; position: string; keeper: boolean }[];
  warnings?: string[];
  errors?: string[];
  error?: string;
}

export default function DraftPastePage() {
  const [season, setSeason] = useState("2025");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);

  async function go(apply: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/draft-paste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ season: Number(season), text, apply }) });
      setReply(await res.json());
    } catch {
      setReply({ error: "Network error." });
    }
    setBusy(false);
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Paste a Draft</h1>
      <p className="text-muted mb-4 max-w-prose">
        For a season whose draft isn&apos;t on ESPN (like the 2025 Fantrax draft). Paste one pick per line, in draft order:{" "}
        <b>pick, team, player, position, keeper</b>. Tabs or commas both work. Pick, position and keeper are optional, and a header row is skipped.
        Mark a keeper with &quot;K&quot;. Preview first; nothing is saved until you press Save.
      </p>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-sm">Season</label>
        <input value={season} onChange={(e) => setSeason(e.target.value)} className="border border-ice-line px-2 py-1 w-24" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder={"1, Brady Bunch, Connor McDavid, C\n2, Team Name, Nathan MacKinnon, C\n3, Team Name, Cale Makar, D, K"}
        className="w-full max-w-3xl border border-ice-line p-2 font-mono text-sm mb-2"
      />
      <div className="flex gap-2 mb-4">
        <button disabled={busy || !text.trim()} onClick={() => go(false)} className="px-4 py-2 border border-ice-line bg-white disabled:opacity-50">Preview</button>
        <button disabled={busy || !text.trim()} onClick={() => go(true)} className="px-4 py-2 bg-ink text-white disabled:opacity-50">Save draft</button>
      </div>
      {reply && (
        <div className="text-sm max-w-3xl">
          {reply.error && <p className="text-red-700 mb-2">{reply.error}</p>}
          {reply.mode && <p className="mb-2"><b>{reply.mode}</b>{reply.saved ? `: ${reply.saved} picks` : ""}</p>}
          {reply.errors?.map((e) => <p key={e} className="text-red-700">{e}</p>)}
          {reply.warnings?.map((w) => <p key={w} className="text-muted">{w}</p>)}
          {reply.picks && (
            <table className="w-full mt-2">
              <tbody>
                {reply.picks.slice(0, 40).map((p) => (
                  <tr key={p.overall} className="border-t border-ice-line">
                    <td className="py-1 pr-2 w-10">{p.overall}</td>
                    <td className="py-1 pr-2">{p.team || "?"}</td>
                    <td className="py-1 pr-2">{p.player}</td>
                    <td className="py-1 pr-2">{p.position}</td>
                    <td className="py-1">{p.keeper ? "keeper" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {reply.picks && reply.picks.length > 40 && <p className="text-muted mt-1">Showing the first 40 of {reply.picks.length}.</p>}
        </div>
      )}
    </div>
  );
}
