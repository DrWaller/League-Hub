"use client";

import { useState } from "react";
import { BannerColors, BannerKind, readableOn, TeamBanner } from "@/lib/banner-types";
import { suggestColorsFromImage } from "@/lib/logo-colors";
import TeamBannerPennant from "./TeamBannerPennant";

export interface BannerLookItem {
  id: string;
  season: number;
  teamKey: string;
  teamName: string;
  managerName: string | null;
  kinds: BannerKind[];
  logoUrl: string | null;
  primary: string;
  trim: string;
  text: string | null; // lettering colour; null = automatic
  custom: boolean; // a look was saved specifically for this season
}

export default function BannerLooksManager({ items }: { items: BannerLookItem[] }) {
  const [rows, setRows] = useState<BannerLookItem[]>(items);
  const [status, setStatus] = useState<Record<string, string>>({});

  const patch = (id: string, change: Partial<BannerLookItem>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...change } : r)));
  const say = (id: string, msg: string) => setStatus((prev) => ({ ...prev, [id]: msg }));

  async function saveColors(row: BannerLookItem, colors?: BannerColors) {
    const c = colors ?? { primary: row.primary, trim: row.trim };
    say(row.id, "Saving…");
    try {
      const res = await fetch("/api/admin/banner-looks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season: row.season, teamKey: row.teamKey, primary: c.primary, trim: c.trim, text: row.text }),
      });
      const data = await res.json();
      if (data.ok) patch(row.id, { ...c, custom: true });
      say(row.id, data.ok ? "Saved" : data.error ?? "Couldn't save");
    } catch {
      say(row.id, "Couldn't save");
    }
  }

  async function useLogoColors(row: BannerLookItem, source: File | string) {
    const found = await suggestColorsFromImage(source);
    if (!found) {
      say(row.id, "Couldn't read the logo colours — pick them by hand");
      return;
    }
    patch(row.id, found);
    await saveColors(row, found);
  }

  async function upload(row: BannerLookItem, file: File) {
    say(row.id, "Uploading…");
    try {
      const form = new FormData();
      form.append("season", String(row.season));
      form.append("teamKey", row.teamKey);
      form.append("file", file);
      const res = await fetch("/api/admin/banner-looks", { method: "POST", body: form });
      const data = await res.json();
      if (!data.url) {
        say(row.id, data.error ?? "Upload failed");
        return;
      }
      patch(row.id, { logoUrl: data.url, custom: true });
      say(row.id, "Logo saved");
      await useLogoColors(row, file); // a new logo also sets that season's colours
    } catch {
      say(row.id, "Upload failed");
    }
  }

  async function reset(row: BannerLookItem) {
    say(row.id, "Resetting…");
    try {
      const res = await fetch("/api/admin/banner-looks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season: row.season, teamKey: row.teamKey }),
      });
      const data = await res.json();
      patch(row.id, { custom: false });
      say(row.id, data.ok ? "Reset — reload to see the team's general look" : data.error ?? "Couldn't reset");
    } catch {
      say(row.id, "Couldn't reset");
    }
  }

  if (rows.length === 0) {
    return <p className="text-muted">No banners yet. They appear once a season has a champion or standings.</p>;
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {rows.map((r) => {
        const preview: TeamBanner = {
          key: r.id,
          season: r.season,
          kind: r.kinds.includes("champion") ? "champion" : "regular",
          teamName: r.teamName,
          managerId: null,
          managerName: r.managerName,
          teamKey: r.teamKey,
          hasSeasonLook: r.custom,
          logoUrl: r.logoUrl,
          primary: r.primary,
          trim: r.trim,
          text: r.text,
        };
        return (
          <div key={r.id} className="border border-ice-line p-4 flex gap-4">
            <div className="w-[88px] shrink-0 bg-board rounded p-2">
              <TeamBannerPennant banner={preview} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-body text-sm">
                <span className="font-display">{r.season}</span> · {r.teamName}
              </div>
              <div className="text-xs text-muted mb-2">
                {r.kinds.map((k) => (k === "champion" ? "League Champions" : "Regular Season Champions")).join(" + ")}
                {r.managerName ? ` · ${r.managerName}` : ""}
              </div>
              <p className="text-xs text-muted mb-2">
                {r.custom ? "Using this season's own look." : "Using the team's general look."}
              </p>
              <input
                type="file"
                accept="image/*"
                className="text-xs mb-2"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(r, f);
                }}
              />
              <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
                <label className="flex items-center gap-1">
                  <input type="color" value={r.primary} onChange={(e) => patch(r.id, { primary: e.target.value })} aria-label="banner colour" />
                  banner
                </label>
                <label className="flex items-center gap-1">
                  <input type="color" value={r.trim} onChange={(e) => patch(r.id, { trim: e.target.value })} aria-label="trim colour" />
                  outline
                </label>
                <label className="flex items-center gap-1">
                  <input type="color" value={r.text ?? readableOn(r.primary)} onChange={(e) => patch(r.id, { text: e.target.value })} aria-label="text colour" />
                  {r.text ? "text" : "text (auto)"}
                </label>
                {r.text && (
                  <button type="button" onClick={() => patch(r.id, { text: null })} className="border border-ice-line px-2 py-0.5 rounded hover:bg-ice-panel">
                    Auto
                  </button>
                )}
                <button type="button" onClick={() => saveColors(r)} className="border border-ice-line px-2 py-0.5 rounded hover:bg-ice-panel">
                  Save
                </button>
                {r.logoUrl && (
                  <button type="button" onClick={() => useLogoColors(r, r.logoUrl as string)} className="border border-ice-line px-2 py-0.5 rounded hover:bg-ice-panel">
                    Use logo colours
                  </button>
                )}
                {r.custom && (
                  <button type="button" onClick={() => reset(r)} className="border border-ice-line px-2 py-0.5 rounded hover:bg-ice-panel">
                    Reset
                  </button>
                )}
              </div>
              {status[r.id] && <p className="text-xs text-muted mt-1">{status[r.id]}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
