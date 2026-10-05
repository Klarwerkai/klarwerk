// FE-003 · E8 — baut und startet den Kandidaten EINMAL für beide Integrationsdateien und räumt ihn am
// Ende auf. Nennt `FE003_KANDIDAT_URL` schon einen laufenden Kandidaten, wird nichts gestartet; die
// Testdateien prüfen ihn trotzdem hart (`pruefeKandidat`). Beschreibung in `kandidat.ts`.
import type { GlobalSetupContext } from "vitest/node";
import { MARKE, starteKandidat } from "./kandidat";

export default async function vorschauGlobal({
  provide,
}: GlobalSetupContext): Promise<(() => Promise<void>) | undefined> {
  const genannt = process.env.FE003_KANDIDAT_URL;
  if (genannt) {
    provide("fe003KandidatUrl", genannt);
    return undefined;
  }
  const kandidat = await starteKandidat();
  provide("fe003KandidatUrl", kandidat.url);
  return async () => {
    if (!(await kandidat.beenden())) {
      throw new Error(`${MARKE}: der Kandidat auf ${kandidat.url} liess sich nicht beenden.`);
    }
  };
}
