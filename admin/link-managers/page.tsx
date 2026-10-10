import LinkManagers from "@/components/LinkManagers";

export const dynamic = "force-dynamic";

export default function LinkManagersPage() {
  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Link Managers to Teams</h1>
      <p className="text-muted mb-8 max-w-prose">
        The Records page adds up each <em>manager&apos;s</em> history, so every past team needs a manager. Pick a year, and
        that year&apos;s team names are listed for you to match up.
      </p>
      <LinkManagers />
    </div>
  );
}
