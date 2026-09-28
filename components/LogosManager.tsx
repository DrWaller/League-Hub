"use client";

import { useState } from "react";
import Image from "next/image";

type TeamOption = { id: number; name: string };

export default function LogosManager({
  teams,
  initialLogos,
}: {
  teams: TeamOption[];
  initialLogos: Record<number, string>;
}) {
  const [logos, setLogos] = useState<Record<number, string>>(initialLogos);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

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
          </div>
        </div>
      ))}
    </div>
  );
}
