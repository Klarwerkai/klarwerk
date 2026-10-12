import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import {
  FIRMENRESET_ERHALTEN,
  FIRMENRESET_ZEILE,
  type JournalEntry,
  JournalSchreibsperre,
  VORGANG_ZEILE,
  firmenresetZeilen,
  readJournalLines,
} from "./dev-persist";
import {
  type FactoryReset,
  FirmenresetFehler,
  type JournalMengen,
  factoryResetUnavailable,
} from "./factory-reset";

// ================================================================================================
// PETER-20261011-P08 · DER FIRMENRESET AM DESKTOP-JOURNAL.
// ================================================================================================
//
// Bis hierher leerte der Werksreset das ganze Journal — Konten eingeschlossen — und beendete den
// Prozess; der nächste Start begann mit der Ersteinrichtung. Peters Entscheidung vom 11.10.: Konten
// und Firmenwörterbuch bleiben erhalten (P08-AC03). Deshalb wird das Journal nicht mehr geleert,
// sondern durch die Zeilen ersetzt, die `firmenresetZeilen` stehen lässt (Konten samt zweitem
// Faktor, Firmenwörterbuch, Prüfprotokoll), plus EINER Spurzeile des Resets.
//
// WIE DIE AUSFÜHRUNG KONSISTENT BLEIBT (P08-AC06/AC07) — alles in EINEM synchronen Block, in dem
// kein anderer Schreibvorgang dieses Prozesses dazwischenkommen kann:
//   1. läuft schon ein Reset → `RESET_LAEUFT`, nichts geändert;
//   2. Prüfsumme des Journals ≠ Kennung der bestätigten Vorschau → `VORSCHAU_VERALTET`, nichts
//      geändert (jemand hat seit der Vorschau geschrieben: der Admin hätte etwas anderes bestätigt);
//   3. Schreibsperre setzen — ab hier weist jede journalierte Ablage Schreibvorgänge ab;
//   4. neues Journal in eine Nachbardatei schreiben und per `rename` atomar ersetzen. Scheitert das,
//      steht das alte Journal unverändert, die Sperre wird gelöst und der Fehler gemeldet.
//   5. Prozess beenden; der Neustart spielt nur noch die erhaltenen Zeilen zurück.

function inhaltVon(journal: string): string {
  return existsSync(journal) ? readFileSync(journal, "utf8") : "";
}

function kennungVon(inhalt: string): string {
  return createHash("sha256").update(inhalt).digest("hex");
}

/** Verwaltungszeilen des Journals selbst — sie sind kein Bestand und werden nicht gezählt. */
const VERWALTUNG: readonly string[] = [VORGANG_ZEILE.repo, FIRMENRESET_ZEILE.repo];

/** Journaleinträge je Ablage, getrennt nach „entfällt" und „bleibt". */
export function firmenresetMengen(journal: string): {
  entfernt: JournalMengen;
  erhalten: JournalMengen;
} {
  const entfernt: JournalMengen = {};
  const erhalten: JournalMengen = {};
  for (const { entry } of readJournalLines(journal)) {
    const teile =
      entry.repo === VORGANG_ZEILE.repo && entry.method === VORGANG_ZEILE.method
        ? (entry.args as JournalEntry[])
        : [entry];
    for (const teil of teile) {
      if (typeof teil?.repo !== "string" || VERWALTUNG.includes(teil.repo)) {
        continue;
      }
      const ziel = FIRMENRESET_ERHALTEN.includes(teil.repo) ? erhalten : entfernt;
      ziel[teil.repo] = (ziel[teil.repo] ?? 0) + 1;
    }
  }
  return { entfernt, erhalten };
}

/** Der Firmenreset an genau EINER Journaldatei. */
export function journalFirmenreset(opts: {
  journal: string;
  sperre: JournalSchreibsperre;
  beenden: () => void;
}): FactoryReset {
  const { journal, sperre, beenden } = opts;
  let laeuft = false;
  return {
    available: true,
    vorschau: async () => {
      // Prüfsumme und Mengen aus DEMSELBEN synchronen Block — dazwischen schreibt niemand.
      const kennung = kennungVon(inhaltVon(journal));
      return { kennung, ...firmenresetMengen(journal) };
    },
    run: async (auftrag) => {
      if (laeuft || sperre.gesperrt) {
        throw new FirmenresetFehler(
          "RESET_LAEUFT",
          "Es läuft bereits ein Firmenreset. Ein zweiter wurde nicht ausgeführt.",
        );
      }
      if (kennungVon(inhaltVon(journal)) !== auftrag.kennung) {
        throw new FirmenresetFehler(
          "VORSCHAU_VERALTET",
          "Der Bestand hat sich seit der Vorschau geändert. Es wurde nichts gelöscht — bitte die Vorschau neu laden und erneut bestätigen.",
        );
      }
      const { entfernt } = firmenresetMengen(journal);
      const bleibt = firmenresetZeilen(readJournalLines(journal));
      const spur: JournalEntry = {
        repo: FIRMENRESET_ZEILE.repo,
        method: FIRMENRESET_ZEILE.method,
        args: [{ am: new Date().toISOString(), durch: auftrag.durch, entfernt }],
      };
      laeuft = true;
      sperre.setzen();
      try {
        const neu = `${journal}.firmenreset-${process.pid}`;
        writeFileSync(neu, [...bleibt, spur].map((e) => `${JSON.stringify(e)}\n`).join(""), "utf8");
        renameSync(neu, journal);
      } catch (error) {
        sperre.loesen();
        laeuft = false;
        throw error;
      }
      beenden();
    },
  };
}

// R-1154 / R-0537: die Betriebsmodus-Entscheidung als EINE prüfbare Funktion. Mit DATABASE_URL ist
// der Werksreset IMMER unverfügbar — auch wenn zusätzlich ein Journal konfiguriert ist —, ohne
// Journal (reiner In-Memory-Betrieb) ebenso. Nur der Desktop/Dev-Journal-Modus bekommt die
// Fähigkeit. `beenden` ist injizierbar, damit der Test den Weg ohne echtes process.exit
// durchlaufen kann; `sperre` teilt server.ts mit `buildDevPersistServices` (P08-AC07).
export function waehleWerksreset(opts: {
  databaseUrl: string | undefined;
  journal: string | undefined;
  beenden?: () => void;
  sperre?: JournalSchreibsperre;
}): FactoryReset {
  const { databaseUrl, journal } = opts;
  if (databaseUrl || !journal) {
    return factoryResetUnavailable;
  }
  // Kurzer Aufschub, damit die HTTP-Antwort noch flusht, dann den Prozess beenden.
  const beenden = opts.beenden ?? (() => setTimeout(() => process.exit(0), 250));
  return journalFirmenreset({
    journal,
    sperre: opts.sperre ?? new JournalSchreibsperre(),
    beenden,
  });
}
