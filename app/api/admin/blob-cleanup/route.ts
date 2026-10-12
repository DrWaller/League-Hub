import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { scanUnusedLogos } from "@/lib/blob-cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lists logo files nothing uses any more. Changes nothing.
export async function GET() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN isn't set." }, { status: 500 });
    }
    return NextResponse.json(await scanUnusedLogos());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Deletes the unused files. The list is worked out again here, so only a file that is still
// unused right now can be removed, whatever the page sends.
export async function POST() {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN isn't set." }, { status: 500 });
    }
    const scan = await scanUnusedLogos();
    const urls = scan.unused.map((b) => b.url);
    for (let i = 0; i < urls.length; i += 100) {
      await del(urls.slice(i, i + 100));
    }
    return NextResponse.json({ ok: true, deleted: urls.length, freedBytes: scan.unusedBytes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Blob cleanup failed", err);
    return NextResponse.json({ error: `Cleanup failed: ${message}` }, { status: 500 });
  }
}
