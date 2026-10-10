"use client";

import { useState } from "react";
import Image from "next/image";
import { BannerColors, DEFAULT_BANNER_COLORS } from "@/lib/banner-types";
import { suggestColorsFromImage } from "@/lib/logo-colors";

type TeamOption = { id: number; name: string };

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
  const [colors, setColors] = useState<Record<number, BannerColors>>(initialColors ?? {});
  const [colorStatus, setColorStatus] = useState<Record<number, string>>({});

  const colorsFor = (id: number): BannerColors => colors[id] ?? DEFAULT_BANNER_COLORS;

  function pickColor(teamId: number, field: keyof BannerColors, value: string) {
    setColors((prev) => ({ ...prev, [teamId]: { ...colorsFor(teamId), [field]: value } }));
    setColorStatus((prev) => ({ ...prev, [teamId]: "" }));
  }

  async function saveColors(teamId: number, override?: BannerColors) {
    const c = override ?? colorsFor(teamId);
    setColorStatus((prev) => ({ ...prev, [teamId]: "Saving…" }));
    try {
      const res = await fetch("/api/admin/logos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, primary: c.primary, trim: c.trim }),
      });
      const data = await res.json();
      setColorStatus((prev) => ({ ...prev, [teamId]: data.ok ? "Saved" : data.error ?? "Couldn't save" }));
    } catch {
      setColorStatus((prev) => ({ ...prev, [teamId]: "Couldn't save" }));
    }
  }

  async function autoColors(teamId: number, source: File | string) {
    const found = await suggestColorsFromImage(source);
    if (!found) {
      setColorStatus((prev) => ({ ...prev, [teamId]: "Couldn't read the logo colours — pick them below" }));
      return;
    }
    setColors((prev) => ({ ...prev, [teamId]: found }));
    await saveColors(teamId, found);
  }

  async function handleUpload(teamId: number, file: File) {
    setUploadingId(teamId);
    try {
      const form = new FormData();
      form.append("teamId", String(teamId));
      form.append("file", file);
      const res = await fetch("/api/admin/logos", { method: "POST", body: form });
      const data = await res.json();
      if (data.url) {
        setLogos((prev) => ({ ...prev, [teamId]: data.url }));
        // A new logo sets the banner colours too, unless colours were already chosen.
        if (!colors[teamId]) await autoColors(teamId, file);
      }
    } finally {
      setUploadingId(null);
    }
  }

  return (
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
                if (file) handleUpload(t.id, file);
              }}
              disabled={uploadingId === t.id}
              className="text-xs"
            />
            {uploadingId === t.id && <p className="text-xs text-muted mt-1">Uploading…</p>}
            <div className="flex items-center gap-2 mt-3 text-xs text-muted flex-wrap">
              <span>Banner</span>
              <label className="flex items-center gap-1">
                <input
                  type="color"
                  value={colorsFor(t.id).primary}
                  onChange={(e) => pickColor(t.id, "primary", e.target.value)}
                  aria-label={`${t.name} banner colour`}
                />
                colour
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="color"
                  value={colorsFor(t.id).trim}
                  onChange={(e) => pickColor(t.id, "trim", e.target.value)}
                  aria-label={`${t.name} banner trim colour`}
                />
                trim
              </label>
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
        </div>
      ))}
    </div>
  );
}
