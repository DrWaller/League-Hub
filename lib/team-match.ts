// Playoff results (champion, runner-up, 3rd) are typed in as plain text, so
// they have to be matched back to a real team. Be forgiving: the typed text can
// be the team name, "Team (Manager)", or just the manager's name.

export const normTeam = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

const stripManagerNote = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, "").trim();

export function findTeamByText<T>(
  rows: T[],
  text: string,
  nameOf: (r: T) => string,
  managerOf: (r: T) => string | null | undefined
): T | undefined {
  const full = normTeam(text);
  const base = normTeam(stripManagerNote(text));
  return (
    rows.find((r) => normTeam(nameOf(r)) === full) ??
    rows.find((r) => normTeam(nameOf(r)) === base) ??
    rows.find((r) => {
      const m = managerOf(r);
      return m ? normTeam(m) === base : false;
    })
  );
}
