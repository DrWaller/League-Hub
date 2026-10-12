"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { BannerColors, DEFAULT_BANNER_COLORS, readableOn, TeamBanner } from "@/lib/banner-types";
import { suggestColorsFromImage } from "@/lib/logo-colors";
import { prepareImage, readResult } from "@/lib/admin-upload";
import TeamBannerPennant from "./TeamBannerPennant";

type TeamOption = { id: number; name: string };

// Logos only ever show small, but every graphic and page downloads them, so they are kept small:
// anything over about 120 KB is reduced to 512px (transparency kept).
const LOGO_SIZE_LIMITS = { maxSide: 512, skipBelowBytes: 120 * 1024 };
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

export default function LogosManager({
  teams,
  initialLogos,
  initialColors,
}: {
  teams: TeamOption[];
  initialLogos: Record<number, string>;
  initialColors?: Record<number, BannerColors>;
}) {
  const [logos, setLogos] = useState<Record<number, string>>(initialLogos);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<Record<number, string>>({});
  const [colors, setColors] = useState<Record<number, BannerColors>>(initialColors ?? {});
  const [colorStatus, setColorStatus] = useState<Record<number, string>>({});
  // Colour picks save by themselves a moment after the last change.
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const saveSeq = useRef<Record<number, number>>({});

  const colorsFor = (id: number): BannerColors => colors[id] ?? DEFAULT_BANNER_COLORS;

  // One tap: shrink every big logo already saved. Each is read through the server, reduced in the
  // browser, and saved back as that team's logo (colours are left alone). Old files stay in storage
  // but nothing uses them any more.
  const [shrinkStatus, setShrinkStatus] = useState("");
  const [shrinking, setShrinking] = useState(false);
  async function shrinkAll() {
    setShrinking(true);
    let before = 0;
    let after = 0;
    let done = 0;
    const withLogo = teams.filter((t) => logos[t.id]);
    try {
      for (let i = 0; i < withLogo.length; i++) {
        const t = withLogo[i];
        setShrinkStatus(`Checking ${i + 1} of ${withLogo.length}: ${t.name}…`);
        const res = await fetch(`/api/admin/logos/file?teamId=${t.id}`, { cache: "no-store" });
        if (!res.ok) continue;
        const blob = await res.blob();
        if (blob.type === "image/gif") continue; // would lose its animation
        const original = new File([blob], `team-${t.id}`, { type: blob.type });
        const shrunk = await prepareImage(original, LOGO_SIZE_LIMITS);
        if (shrunk === original || shrunk.size > original.size * 0.85) continue; // already small enough
        const form = new FormData();
        form.append("teamId", String(t.id));
        form.append("file", shrunk);
        const up = await readResult(await fetch("/api/admin/logos", { method: "POST", body: form }));
        if (!up.url) {
          setUploadStatus((prev) => ({ ...prev, [t.id]: up.error ?? "Couldn't save the smaller logo" }));
          continue;
        }
        setLogos((prev) => ({ ...prev, [t.id]: up.url as string }));
        setUploadStatus((prev) => ({ ...prev, [t.id]: `Logo saved, shrunk (${kb(original.size)} to ${kb(shrunk.size)})` }));
        before += original.size;
        after += shrunk.size;
        done++;
      }
      setShrinkStatus(done === 0 ? "Every logo is already small. Nothing to do." : `Shrunk ${done} logo${done === 1 ? "" : "s"}: ${kb(before)} down to ${kb(after)}.`);
    } catch {
      setShrinkStatus("Something went wrong part way through. Reload to see which logos were saved.");
    } finally {
      setShrinking(false);
    }
  }

  // A sample banner with this team's logo and the colours currently picked.
  const previewFor = (t: TeamOption): TeamBanner => {
    const c = colorsFor(t.id);
    return {
      key: `preview-${t.id}`,
      season: 2026,
      kind: "champion",
      teamName: t.name,
      managerId: null,
      managerName: null,
      teamKey: "",
      hasSeasonLook: false,
      logoUrl: logos[t.id] ?? null,
      primary: c.primary,
      trim: c.trim,
      text: c.text ?? null,
    };
  };

  function pickColor(teamId: number, field: keyof BannerColors, value: string | null) {
    const next: BannerColors = { ...colorsFor(teamId), [field]: value };
    setColors((prev) => ({ ...prev, [teamId]: next }));
    setColorStatus((prev) => ({ ...prev, [teamId]: "Unsaved…" }));
    clearTimeout(saveTimers.current[teamId]);
    saveTimers.current[teamId] = setTimeout(() => saveColors(teamId, next), 700);
  }

  async function saveColors(teamId: number, override?: BannerColors) {
    clearTimeout(saveTimers.current[teamId]);
    const c = override ?? colorsFor(teamId);
    const seq = (saveSeq.current[teamId] = (saveSeq.current[teamId] ?? 0) + 1);
    const say = (msg: string) => {
      if (saveSeq.current[teamId] === seq) setColorStatus((prev) => ({ ...prev, [teamId]: msg }));
    };
    say("Saving…");
    try {
      const res = await fetch("/api/admin/logos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, primary: c.primary, trim: c.trim, text: c.text ?? null }),
      });
      const data = await readResult(res);
      say(data.ok ? "Saved" : data.error ?? "Couldn't save");
    } catch {
      say("Couldn't save — check your connection and press Save");
    }
  }

  async function autoColors(teamId: number, source: File | string) {
    const found = await suggestColorsFromImage(source);
    if (!found) {
      setColorStatus((prev) => ({ ...prev, [teamId]: "Couldn't read the logo colours — pick them below" }));
      return;
    }
    // New colours from the logo; a lettering colour already chosen is kept.
    const merged: BannerColors = { ...found, text: colorsFor(teamId).text ?? null };
    setColors((prev) => ({ ...prev, [teamId]: merged }));
    await saveColors(teamId, merged);
  }

  async function handleUpload(teamId: number, original: File) {
    const say = (msg: string) => setUploadStatus((prev) => ({ ...prev, [teamId]: msg }));
    setUploadingId(teamId);
    say("Uploading…");
    try {
      const file = await prepareImage(original, LOGO_SIZE_LIMITS);
      const form = new FormData();
      form.append("teamId", String(teamId));
      form.append("file", file);
      const res = await fetch("/api/admin/logos", { method: "POST", body: form });
      const data = await readResult(res);
      if (!data.url) {
        say(data.error ?? "Upload failed");
        return;
      }
      setLogos((prev) => ({ ...prev, [teamId]: data.url as string }));
      say("Logo saved");
      // A new logo sets the banner colours too, unless colours were already chosen.
      if (!colors[teamId]) await autoColors(teamId, file);
    } catch {
      say("Upload failed — check your connection and try again");
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div>
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <button type="button" onClick={shrinkAll} disabled={shrinking || uploadingId !== null} className="border border-ice-line px-3 py-2 text-sm hover:bg-ice-panel disabled:opacity-40">
        Shrink all logos
      </button>
      <span className="text-xs text-muted max-w-prose">{shrinkStatus || "Big logos slow down every graphic and use up Vercel storage bandwidth. This reduces them to 512px; they look the same on the site and graphics."}</span>
    </div>
    <div className="grid sm:grid-cols-2 gap-4">
      {teams.map((t) => (
        <div key={t.id} className="border border-ice-line p-4 flex items-center gap-4">
          <div className="w-16 h-16 border border-ice-line flex items-center justify-center overflow-hidden shrink-0 bg-ice-panel">
            {logos[t.id] ? (
              <Image src={logos[t.id]} alt={t.name} width={64} height={64} className="object-cover w-full h-full" unoptimized />
            ) : (
              <span className="text-xs text-muted text-center px-1">No logo</span>
            )}
          </div>
          <div className="flex-1">
            <div className="font-body text-sm mb-2">{t.name}</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // lets the same file be picked again to retry
                if (file) handleUpload(t.id, file);
              }}
              disabled={uploadingId === t.id}
              className="text-xs"
            />
            {uploadStatus[t.id] && (
              <p className={`text-xs mt-1 ${/saved|uploading/i.test(uploadStatus[t.id]) ? "text-muted" : "text-red-700"}`}>{uploadStatus[t.id]}</p>
            )}
            <div className="flex items-center gap-2 mt-3 text-xs text-muted flex-wrap">
              <span>Colours</span>
              <label className="flex items-center gap-1">
                <input
                  type="color"
                  value={colorsFor(t.id).primary}
                  onChange={(e) => pickColor(t.id, "primary", e.target.value)}
                  aria-label={`${t.name} banner colour`}
                />
                banner
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="color"
                  value={colorsFor(t.id).trim}
                  onChange={(e) => pickColor(t.id, "trim", e.target.value)}
                  aria-label={`${t.name} banner trim colour`}
                />
                outline
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="color"
                  value={colorsFor(t.id).text ?? readableOn(colorsFor(t.id).primary)}
                  onChange={(e) => pickColor(t.id, "text", e.target.value)}
                  aria-label={`${t.name} banner text colour`}
                />
                {colorsFor(t.id).text ? "text" : "text (auto)"}
              </label>
              {colorsFor(t.id).text && (
                <button type="button" onClick={() => pickColor(t.id, "text", null)} className="border border-ice-line px-2 py-0.5 rounded hover:bg-ice-panel">
                  Auto
                </button>
              )}
              <button type="button" onClick={() => saveColors(t.id)} className="border border-ice-line px-2 py-0.5 rounded hover:bg-ice-panel">
                Save
              </button>
              {logos[t.id] && (
                <button type="button" onClick={() => autoColors(t.id, logos[t.id])} className="border border-ice-line px-2 py-0.5 rounded hover:bg-ice-panel">
                  Use logo colours
                </button>
              )}
              {colorStatus[t.id] && <span>{colorStatus[t.id]}</span>}
            </div>
          </div>
          <div className="w-14 shrink-0 bg-board rounded p-1.5" title="Banner preview">
            <TeamBannerPennant banner={previewFor(t)} />
          </div>
        </div>
      ))}
    </div>
    </div>
  );
}
