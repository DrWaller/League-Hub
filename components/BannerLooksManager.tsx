"use client";

import { useRef, useState } from "react";
import { BANNER_LABELS, BannerColors, BannerKind, readableOn, TeamBanner } from "@/lib/banner-types";
import { suggestColorsFromImage } from "@/lib/logo-colors";
import { prepareImage, readResult, isGif, LOGO_SIZE_LIMITS } from "@/lib/admin-upload";
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

  // Colour picks save by themselves a moment after the last change.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const seqs = useRef<Record<string, number>>({});

  function pick(row: BannerLookItem, change: Partial<BannerLookItem>) {
    const next = { ...row, ...change };
    patch(row.id, change);
    say(row.id, "Unsaved…");
    clearTimeout(timers.current[row.id]);
    timers.current[row.id] = setTimeout(() => saveColors(next), 700);
  }

  async function saveColors(row: BannerLookItem, colors?: BannerColors) {
    clearTimeout(timers.current[row.id]);
    const c = colors ?? { primary: row.primary, trim: row.trim };
    const seq = (seqs.current[row.id] = (seqs.current[row.id] ?? 0) + 1);
    const tell = (msg: string) => {
      if (seqs.current[row.id] === seq) say(row.id, msg);
    };
    tell("Saving…");
    try {
      const res = await fetch("/api/admin/banner-looks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season: row.season, teamKey: row.teamKey, primary: c.primary, trim: c.trim, text: row.text }),
      });
      const data = await readResult(res);
      if (data.ok) patch(row.id, { ...c, custom: true });
      tell(data.ok ? "Saved" : data.error ?? "Couldn't save");
    } catch {
      tell("Couldn't save — check your connection and press Save");
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

  async function upload(row: BannerLookItem, original: File) {
    say(row.id, "Uploading…");
    try {
      const file = await prepareImage(original, LOGO_SIZE_LIMITS);
      const form = new FormData();
      form.append("season", String(row.season));
      form.append("teamKey", row.teamKey);
      form.append("file", file);
      const res = await fetch("/api/admin/banner-looks", { method: "POST", body: form });
      const data = await readResult(res);
      if (!data.url) {
        say(row.id, data.error ?? "Upload failed");
        return;
      }
      patch(row.id, { logoUrl: data.url, custom: true });
      say(row.id, "Logo saved");
      // A new logo also sets that season's colours, unless this season already has colours you chose.
      if (!row.custom) await useLogoColors(row, file);
    } catch {
      say(row.id, "Upload failed — check your connection and try again");
    }
  }

  // One tap: shrink every season logo that is big. Each is read through the server, reduced in the
  // browser, and saved back as that season's logo (colours are left alone).
  const [shrinkStatus, setShrinkStatus] = useState("");
  const [shrinking, setShrinking] = useState(false);
  async function shrinkAll() {
    setShrinking(true);
    let before = 0;
    let after = 0;
    let done = 0;
    const own = rows.filter((r) => r.custom && r.logoUrl);
    try {
      for (let i = 0; i < own.length; i++) {
        const r = own[i];
        setShrinkStatus(`Checking ${i + 1} of ${own.length}: ${r.season} ${r.teamName}…`);
        const res = await fetch(`/api/admin/logos/file?season=${r.season}&teamKey=${encodeURIComponent(r.teamKey)}`, { cache: "no-store" });
        if (!res.ok) continue; // this season uses the team's general logo, nothing of its own to shrink
        const blob = await res.blob();
        if (await isGif(blob)) continue;
        const original = new File([blob], `season-${r.season}`, { type: blob.type });
        const shrunk = await prepareImage(original, LOGO_SIZE_LIMITS);
        if (shrunk === original || shrunk.size > original.size * 0.85) continue; // already small enough
        const form = new FormData();
        form.append("season", String(r.season));
        form.append("teamKey", r.teamKey);
        form.append("file", shrunk);
        const up = await readResult(await fetch("/api/admin/banner-looks", { method: "POST", body: form }));
        if (!up.url) {
          say(r.id, up.error ?? "Couldn't save the smaller logo");
          continue;
        }
        patch(r.id, { logoUrl: up.url });
        before += original.size;
        after += shrunk.size;
        done++;
      }
      const kb = (n: number) => `${Math.round(n / 1024)} KB`;
      setShrinkStatus(done === 0 ? "Every season logo is already small. Nothing to do." : `Shrunk ${done} season logo${done === 1 ? "" : "s"}: ${kb(before)} down to ${kb(after)}.`);
    } catch {
      setShrinkStatus("Something went wrong part way through. Reload to see which logos were saved.");
    } finally {
      setShrinking(false);
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
      const data = await readResult(res);
      if (data.ok) patch(row.id, { custom: false });
      say(row.id, data.ok ? "Reset — reload to see the team's general look" : data.error ?? "Couldn't reset");
    } catch {
      say(row.id, "Couldn't reset");
    }
  }

  if (rows.length === 0) {
    return <p className="text-muted">No banners yet. They appear once a season has a champion or standings.</p>;
  }

  return (
    <div>
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <button type="button" onClick={shrinkAll} disabled={shrinking} className="border border-ice-line px-3 py-2 text-sm hover:bg-ice-panel disabled:opacity-40">
        Shrink all season logos
      </button>
      <span className="text-xs text-muted max-w-prose">{shrinkStatus || "Season logos can be a few MB each and every banner downloads one. This reduces them to 512px; the banners look the same."}</span>
    </div>
    <div className="grid sm:grid-cols-2 gap-4">
      {rows.map((r) => {
        const preview: TeamBanner = {
          key: r.id,
          season: r.season,
          kind: r.kinds.includes("champion") ? "champion" : r.kinds.includes("regular") ? "regular" : "runnerUp",
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
                {r.kinds.map((k) => BANNER_LABELS[k]).join(" + ")}
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
                  e.target.value = ""; // lets the same file be picked again to retry
                  if (f) upload(r, f);
                }}
              />
              <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
                <label className="flex items-center gap-1">
                  <input type="color" value={r.primary} onChange={(e) => pick(r, { primary: e.target.value })} aria-label="banner colour" />
                  banner
                </label>
                <label className="flex items-center gap-1">
                  <input type="color" value={r.trim} onChange={(e) => pick(r, { trim: e.target.value })} aria-label="trim colour" />
                  outline
                </label>
                <label className="flex items-center gap-1">
                  <input type="color" value={r.text ?? readableOn(r.primary)} onChange={(e) => pick(r, { text: e.target.value })} aria-label="text colour" />
                  {r.text ? "text" : "text (auto)"}
                </label>
                {r.text && (
                  <button type="button" onClick={() => pick(r, { text: null })} className="border border-ice-line px-2 py-0.5 rounded hover:bg-ice-panel">
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
              {status[r.id] && <p className={`text-xs mt-1 ${/^(saved|saving|unsaved|uploading|logo saved|resetting|reset)/i.test(status[r.id]) ? "text-muted" : "text-red-700"}`}>{status[r.id]}</p>}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
