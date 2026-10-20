import { mkdir, open, readFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

/** Keine Inhalte und keine Kontokennung; Korrekturmarken verwerfen nur ältere Fassungen. */
export interface GedaechtnisLoeschmarke {
  id: string;
  mindestFassung: number | null;
  am: string;
}

export class GedaechtnisLoeschjournal {
  constructor(readonly pfad: string) {
    if (!isAbsolute(pfad)) throw new Error("Gedächtnis-Löschjournal braucht einen absoluten Pfad.");
  }

  async anhaengen(marken: readonly GedaechtnisLoeschmarke[]): Promise<void> {
    await mkdir(dirname(this.pfad), { recursive: true, mode: 0o700 });
    const f = await open(this.pfad, "a", 0o600);
    try {
      await f.writeFile(`${JSON.stringify(marken)}\n`);
      await f.sync();
    } finally {
      await f.close();
    }
    // Auch die erstmalige Anlage muss einen Rechnerausfall überstehen können.
    const d = await open(dirname(this.pfad), "r");
    try {
      await d.sync();
    } finally {
      await d.close();
    }
  }

  async lesen(): Promise<GedaechtnisLoeschmarke[]> {
    let text: string;
    try {
      text = await readFile(this.pfad, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        throw new Error(
          "Konfiguriertes Gedächtnis-Löschjournal fehlt; Start vor Restore-Prüfung abgebrochen.",
        );
      throw e;
    }
    const alle: GedaechtnisLoeschmarke[] = [];
    for (const zeile of text.split("\n").filter(Boolean)) {
      const marken: unknown = JSON.parse(zeile);
      if (!Array.isArray(marken)) throw new Error("Ungültiges Gedächtnis-Löschjournal.");
      for (const m of marken) {
        if (
          !m ||
          typeof m.id !== "string" ||
          m.id.length > 200 ||
          !(
            m.mindestFassung === null ||
            (Number.isSafeInteger(m.mindestFassung) && m.mindestFassung > 1)
          ) ||
          typeof m.am !== "string" ||
          !Number.isFinite(Date.parse(m.am))
        )
          throw new Error("Ungültige Gedächtnis-Löschmarke.");
        alle.push({ id: m.id, mindestFassung: m.mindestFassung, am: m.am });
      }
    }
    return alle;
  }
}
