import type { StyleTag } from "@/lib/manager-style";

const TONE = { good: "border-rink-bright", bad: "border-center-red", neutral: "border-ice-line" } as const;

// Style tags with the numbers behind each one.
export default function StyleTagsView({ tags }: { tags: StyleTag[] }) {
  if (tags.length === 0) return null;
  return (
    <section className="mb-12">
      <div className="mb-4">
        <h2 className="font-display text-2xl leading-tight">Style</h2>
        <p className="text-sm text-muted max-w-prose">Labels earned from the numbers, with the numbers shown.</p>
      </div>
      <ul className="flex flex-wrap gap-3">
        {tags.map((t) => (
          <li key={t.tag} className={`border-l-4 ${TONE[t.tone]} bg-ice-panel px-4 py-2`}>
            <p className="font-display text-xl leading-tight">{t.tag}</p>
            <p className="text-xs text-muted font-tabular">{t.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
