"use client";

import { useState } from "react";

interface Unused {
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
}
interface Scan {
  unused: Unused[];
  unusedBytes: number;
  keptCount: number;
  keptBytes: number;
}

const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

// Old logo files pile up in storage because every upload leaves the previous one behind. This lists
// the ones nothing on the site uses and deletes them after you confirm.
export default function BlobCleanup() {
  const [scan, setScan] = useState<Scan | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function find() {
    setBusy(true);
    setMessage("Looking through storage…");
    try {
      const res = await fetch("/api/admin/blob-cleanup", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setScan(null);
        setMessage(data.error ?? `Couldn't check storage (${res.status}).`);
        return;
      }
      setScan(data as Scan);
      setMessage(data.unused.length === 0 ? "Nothing to clean up. Every file is in use." : "");
    } catch {
      setMessage("Couldn't check storage. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!scan || scan.unused.length === 0) return;
    if (!window.confirm(`Delete ${scan.unused.length} unused file${scan.unused.length === 1 ? "" : "s"} (${mb(scan.unusedBytes)})? This can't be undone.`)) return;
    setBusy(true);
    setMessage("Deleting…");
    try {
      const res = await fetch("/api/admin/blob-cleanup", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? `Couldn't delete (${res.status}).`);
        return;
      }
      setScan(null);
      setMessage(`Deleted ${data.deleted} file${data.deleted === 1 ? "" : "s"}, freeing ${mb(data.freedBytes)}.`);
    } catch {
      setMessage("Couldn't delete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={find} disabled={busy} className="border border-ice-line px-3 py-2 text-sm hover:bg-ice-panel disabled:opacity-40">
          Find unused files
        </button>
        <span className="text-xs text-muted max-w-prose">
          {message || "Every upload leaves the old file behind in storage. This finds the ones no logo or banner uses. Nothing is deleted until you confirm."}
        </span>
      </div>
      {scan && scan.unused.length > 0 && (
        <div className="mt-3 border border-ice-line p-3 max-w-2xl">
          <p className="text-sm mb-2">
            {scan.unused.length} unused file{scan.unused.length === 1 ? "" : "s"}, {mb(scan.unusedBytes)}. {scan.keptCount} file{scan.keptCount === 1 ? "" : "s"} in use ({mb(scan.keptBytes)}) stay.
          </p>
          <ul className="text-xs text-muted max-h-48 overflow-auto mb-3 space-y-0.5">
            {scan.unused.map((b) => (
              <li key={b.url} className="flex justify-between gap-3">
                <span className="truncate">{b.name}</span>
                <span className="shrink-0">{mb(b.size)}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={remove} disabled={busy} className="border border-red-700 text-red-700 px-3 py-2 text-sm hover:bg-ice-panel disabled:opacity-40">
            Delete these {scan.unused.length} files
          </button>
        </div>
      )}
    </div>
  );
}
