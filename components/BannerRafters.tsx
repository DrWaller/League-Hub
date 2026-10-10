import { TeamBanner } from "@/lib/banner-types";
import TeamBannerPennant from "./TeamBannerPennant";

// A dark arena strip with banners hung side by side, oldest on the left.
// Used on League History (every team) and on a manager's page (just theirs).
export default function BannerRafters({ banners, title }: { banners: TeamBanner[]; title?: string }) {
  if (banners.length === 0) return null;

  return (
    <section className="mb-10">
      {title && <h2 className="font-display text-xl mb-3">{title}</h2>}
      <div
        className="rounded-md px-4 pt-7 pb-5 border border-board"
        style={{
          background:
            "radial-gradient(ellipse at 15% 0%, rgba(150,180,220,0.30), transparent 45%), radial-gradient(ellipse at 85% 0%, rgba(150,180,220,0.30), transparent 45%), linear-gradient(#0a0e13, #18212e)",
        }}
      >
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-7">
          {banners.map((b) => (
            <figure key={b.key} className="w-[104px] sm:w-[128px] m-0">
              <TeamBannerPennant banner={b} />
              <figcaption className="mt-2 text-center text-[11px] leading-tight text-ice/80">
                {b.teamName}
                {b.managerName && b.managerName.trim().toLowerCase() !== b.teamName.trim().toLowerCase() && (
                  <span className="block text-ice/50">{b.managerName}</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
