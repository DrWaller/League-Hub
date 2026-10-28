// Team names that should always display differently from what ESPN / old entries say.
// Add a line here to rename a team everywhere ESPN is the source (matching ignores case and extra spaces).
// Names already saved in the database are fixed by the one-time migration in lib/db.ts.
const RENAMES: Record<string, string> = {
  "pastaless party": "Pasta Party",
};

const norm = (n: string) => n.replace(/\s+/g, " ").trim().toLowerCase();

export function fixTeamName<T extends string | null | undefined>(name: T): T {
  if (!name) return name;
  return (RENAMES[norm(name)] ?? name) as T;
}
