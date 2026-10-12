import Image from "next/image";
import { isBlobUrl } from "@/lib/blob-url";

export default function TeamLogo({
  url,
  name,
  size = 32,
}: {
  url?: string;
  name: string;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        // Stored logos are served resized by Next's optimizer. Any other host isn't on the allowed
        // list in next.config.js, so it is shown as-is rather than breaking the page.
        unoptimized={!isBlobUrl(url) && !/^https:\/\/([a-z0-9-]+\.)*espncdn\.com\//i.test(url)}
        className="rounded-sm object-cover shrink-0 border border-ice-line"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="rounded-sm bg-rink text-ice flex items-center justify-center shrink-0 font-display"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}
