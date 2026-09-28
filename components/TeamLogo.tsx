import Image from "next/image";

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
        unoptimized
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
