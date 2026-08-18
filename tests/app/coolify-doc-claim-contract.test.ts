// ================================================================================================
// JOB 1124 · DIE COOLIFY-BETRIEBSDOKUMENTE TRAGEN IHRE UNSICHERHEIT SELBST
// ================================================================================================
//
// WORAUS DAS FOLGT: JOB 947 hat Coolify-Behauptungen im getrackten Baum inventarisiert und acht
// unbelegte gefunden (U1–U8, Rückgabe §2.3). Sieben davon behaupteten Betriebszustände, die
// nirgends geprüft sind — TLS, Backups, Rollback, Webhook, Proxy-Zugangsschutz. Genau EINE Stelle
// machte es richtig: U7 in `docs/TEAM6_UPDATE.md` sagt, was gilt, unter welchem Vorbehalt, mit
// welchem Restrisiko und wer es bestätigen muss. B5 der Bauscheibenliste lautet deshalb wörtlich:
// „U7 als Muster übernehmen … Diese Form auf U1–U6 und U8 anwenden — das ist die Bauform, nicht
// eine neue Erfindung."
//
// WARUM DAS EIN PRODUKTVERTRAG IST UND KEINE KOSMETIK: Eine Betriebsanleitung, die eine
// Möglichkeit wie einen Istzustand liest, führt im Ernstfall in die Irre. „Täglicher pg_dump als
// Coolify-Scheduled-Task" klingt wie eine laufende Sicherung; belegt ist nur, dass jemand das
// Verfahren aufgeschrieben hat. Wer im Wiederherstellungsfall danach greift, greift ins Leere.
//
// WAS DER GUARD ERZWINGT — die vier Elemente des U7-Musters, je Fundort:
//   1. Behauptung   — was überhaupt behauptet wird
//   2. Vorbehalt    — dass und warum es unbestätigt ist
//   3. Restrisiko   — was bricht, wenn die Annahme nicht trägt
//   4. Bestätiger   — wer es bestätigen kann; ein benannter Träger, kein „TBD"
//
// UND — das ist Pflicht 3 des Auftrags — er verhindert WIDERSPRÜCHLICHE PARALLELFORMULIERUNGEN:
// Vier der Behauptungen stehen in ZWEI Dokumenten. Stünde dort zweimal etwas Verschiedenes,
// entstünde genau die Lage, die JOB 947 als W1 beschrieben hat: zwei Seiten des Baums sagen
// Gegensätzliches, und niemand merkt es. Der Guard verlangt deshalb, dass Vorbehalt, Restrisiko
// und Bestätiger derselben Behauptung über alle ihre Fundorte hinweg WORTGLEICH sind.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "../..");

function lies(relativ: string): string {
  return readFileSync(resolve(WURZEL, relativ), "utf8");
}

// ── Die Fundortmatrix aus JOB 947 §2.3, vollständig. ────────────────────────────────────────────
// Sie ist die geschlossene Liste im Sinne von Regelwerk Z. 501: kein offener Sammelbegriff,
// jeder Fundort mit Pfad. Kommt eine Behauptung an zwei Stellen vor, stehen beide hier.
const FUNDORTE: ReadonlyArray<{ id: string; thema: string; dateien: readonly string[] }> = [
  { id: "U2", thema: "Basic Auth auf Proxy-Ebene", dateien: ["apps/web/README.md"] },
  {
    id: "U3",
    thema: "TLS",
    dateien: ["docs/operations/api-auth-readiness.md", "docs/operations/deploy-hetzner.md"],
  },
  {
    id: "U4",
    thema: "Backups",
    dateien: [
      "docs/operations/backup-disaster-recovery.md",
      "docs/operations/maintenance-update-process.md",
    ],
  },
  {
    id: "U5",
    thema: "Rollback",
    dateien: ["docs/operations/deploy-hetzner.md", "docs/operations/maintenance-update-process.md"],
  },
  { id: "U6", thema: "Webhook", dateien: ["docs/operations/deploy-hetzner.md"] },
  {
    id: "U8",
    thema: "Backups",
    dateien: [
      "docs/boss-assistant/contradictions.md",
      "docs/operations/backup-disaster-recovery.md",
    ],
  },
];

// Die fünf Gegenstände, die Pflicht 2 des Auftrags namentlich schützt: sie dürfen nicht als
// Istzustand gelten, solange kein Beleg vorliegt.
// „Backup" statt „Backups": der Wortstamm trifft Einzahl wie Mehrzahl und bindet den Guard an
// das Wort, das in den Dokumenten wirklich steht — nicht an eine Beugung, die der Test erfindet.
const GESCHUETZTE_THEMEN = ["Single-Instanz", "TLS", "Backup", "Rollback", "Webhook"] as const;

interface Vorbehaltsblock {
  behauptung: string;
  vorbehalt: string;
  restrisiko: string;
  bestaetiger: string;
}

// Ein Block sieht so aus (eine Zeile je Element, Blockzitat):
//   > **Unbestätigt (U3) · <Behauptung>**
//   > **Vorbehalt:** <…>
//   > **Restrisiko:** <…>
//   > **Bestätiger:** <…>
function bloeckeFuer(text: string, id: string): Vorbehaltsblock[] {
  const kopf = new RegExp(`^>\\s*\\*\\*Unbestätigt \\(${id}\\)\\s*·\\s*(.+?)\\*\\*\\s*$`, "gm");
  const treffer: Vorbehaltsblock[] = [];

  let m: RegExpExecArray | null = kopf.exec(text);
  while (m !== null) {
    const rest = text.slice(m.index);
    const feld = (name: string): string => {
      const re = new RegExp(`^>\\s*\\*\\*${name}:\\*\\*\\s*(.+?)\\s*$`, "m");
      // Nur innerhalb dieses Blocks suchen: bis zur ersten Zeile, die kein Blockzitat mehr ist.
      const blockEnde = rest.search(/\n(?!>)/);
      const block = blockEnde === -1 ? rest : rest.slice(0, blockEnde);
      const f = re.exec(block);
      return f?.[1]?.trim() ?? "";
    };
    treffer.push({
      behauptung: (m[1] ?? "").trim(),
      vorbehalt: feld("Vorbehalt"),
      restrisiko: feld("Restrisiko"),
      bestaetiger: feld("Bestätiger"),
    });
    m = kopf.exec(text);
  }
  return treffer;
}

describe("JOB 1124 · B5: die Coolify-Betriebsdokumente übernehmen das ehrliche U7-Muster", () => {
  // ── PFLICHT 1 · Je Fundort ein vollständiger Vorbehaltsblock ─────────────────────────────────
  for (const eintrag of FUNDORTE) {
    for (const datei of eintrag.dateien) {
      it(`${eintrag.id} in ${datei}: trägt Behauptung, Vorbehalt, Restrisiko und Bestätiger`, () => {
        const bloecke = bloeckeFuer(lies(datei), eintrag.id);

        const fehlt = `${datei} führt die Behauptung ${eintrag.id} (${eintrag.thema}), aber keinen Vorbehaltsblock nach dem U7-Muster. Eine Möglichkeit steht dort wie ein Istzustand.`;

        expect(bloecke.length, fehlt).toBe(1);

        const block = bloecke[0];
        if (!block) {
          return;
        }

        expect(block.behauptung.length, `${eintrag.id}: Behauptung ist leer.`).toBeGreaterThan(10);
        expect(block.vorbehalt.length, `${eintrag.id}: Vorbehalt fehlt.`).toBeGreaterThan(10);
        expect(block.restrisiko.length, `${eintrag.id}: Restrisiko fehlt.`).toBeGreaterThan(10);
        expect(block.bestaetiger.length, `${eintrag.id}: Bestätiger fehlt.`).toBeGreaterThan(2);
      });
    }
  }

  // ── PFLICHT 1 · Der Bestätiger ist ein benannter Träger, kein Platzhalter ────────────────────
  for (const eintrag of FUNDORTE) {
    it(`${eintrag.id}: der Bestätiger ist namentlich benannt, kein Platzhalter`, () => {
      for (const datei of eintrag.dateien) {
        const block = bloeckeFuer(lies(datei), eintrag.id)[0];
        expect(block, `${eintrag.id} fehlt in ${datei}.`).toBeDefined();
        if (!block) {
          continue;
        }
        // „TBD", „offen", „noch unklar", „—" sind kein Bestätiger. Ein Vorbehalt ohne Adressaten
        // ist eine Ausrede: er sagt, dass etwas ungeklärt ist, aber nicht, wer es klären kann.
        expect(
          /^(tbd|offen|unklar|noch offen|—|-|\?+)$/i.test(block.bestaetiger),
          `${eintrag.id} in ${datei}: „${block.bestaetiger}" benennt niemanden.`,
        ).toBe(false);
      }
    });
  }

  // ── PFLICHT 3 · Keine widersprüchlichen Parallelformulierungen ───────────────────────────────
  for (const eintrag of FUNDORTE.filter((e) => e.dateien.length > 1)) {
    it(`${eintrag.id}: alle ${eintrag.dateien.length} Fundorte formulieren wortgleich`, () => {
      const bloecke = eintrag.dateien.map((d) => ({
        datei: d,
        block: bloeckeFuer(lies(d), eintrag.id)[0],
      }));

      for (const { datei, block } of bloecke) {
        expect(block, `${eintrag.id} fehlt in ${datei}.`).toBeDefined();
      }

      const ersterEintrag = bloecke[0];
      if (!ersterEintrag?.block) {
        return;
      }
      const erster = ersterEintrag.block;

      for (const { datei, block } of bloecke.slice(1)) {
        if (!block) {
          continue;
        }
        const meldung = `${eintrag.id} steht in ${ersterEintrag.datei} und ${datei} unterschiedlich. Zwei Seiten desselben Baums sagen Verschiedenes über dieselbe Sache — genau der Widerspruch, den JOB 947 als W1 beschrieben hat.`;
        expect(block.vorbehalt, meldung).toBe(erster.vorbehalt);
        expect(block.restrisiko, meldung).toBe(erster.restrisiko);
        expect(block.bestaetiger, meldung).toBe(erster.bestaetiger);
      }
    });
  }

  // ── PFLICHT 2 · Die fünf geschützten Gegenstände sind namentlich als unbestätigt geführt ─────
  it("Single-Instanz, TLS, Backups, Rollback und Webhook stehen als unbestätigt, nicht als Istzustand", () => {
    const alleDateien = [...new Set(FUNDORTE.flatMap((e) => e.dateien))];
    const gesamttext = alleDateien.map(lies).join("\n");

    for (const thema of GESCHUETZTE_THEMEN) {
      if (thema === "Single-Instanz") {
        // Der Single-Instanz-Vertrag lebt in `services/auth/src/repo-pg.ts` und liegt damit
        // AUSSERHALB der Lease dieses Auftrags. Er wird hier deshalb nicht geprüft, sondern in
        // der Rückgabe als offener Rest benannt. Diese Zeile hält fest, dass die Auslassung
        // bewusst ist und nicht übersehen wurde.
        continue;
      }
      expect(
        gesamttext,
        `Der geschützte Gegenstand „${thema}" taucht in keinem Vorbehaltsblock auf.`,
      ).toMatch(new RegExp(`Unbestätigt \\(U\\d\\)[^\\n]*${thema}`, "i"));
    }
  });

  // ── PFLICHT 4 · Der Guard hängt am echten Dokument, nicht an einer Kopie ─────────────────────
  it("das U7-Vorbild steht unverändert im Baum und ist die Quelle der vier Elemente", () => {
    // Wäre das Muster nur im Test beschrieben, könnte das Vorbild verschwinden, ohne dass etwas
    // rot wird — und die Bauform hätte keinen Anker mehr.
    const team6 = lies("docs/TEAM6_UPDATE.md");
    expect(team6).toContain(
      "auf managed/Coolify-Postgres üblich, aber durch Ops/Pedi zu bestätigen",
    );
    expect(team6).toContain("als Restrisiko dokumentiert");
  });

  // ── PFLICHT 3 · Der Einstiegspunkt behauptet keinen bestätigten Betriebszustand ──────────────
  it("SETUP.md nennt Coolify als Hosting-Entscheidung, ohne dessen Betriebszustand zu behaupten", () => {
    // SETUP.md ist für viele die erste gelesene Datei. Die Hosting-WAHL ist belegt; würde sie
    // dort unkommentiert neben den Betriebsversprechen stehen, läse sich beides als gleich sicher.
    const setup = lies("SETUP.md");
    expect(setup).toContain("als unbestätigt gekennzeichnet");
    expect(setup).toContain("die Hosting-Entscheidung ist belegt, ihr Betriebszustand nicht");
  });

  // ── PFLICHT 3 · Der Guard deckt wirklich alle inventarisierten Fundorte ab ───────────────────
  it("die Fundortmatrix deckt U2–U6 und U8 vollständig ab", () => {
    const ids = FUNDORTE.map((e) => e.id);
    expect(ids).toEqual(["U2", "U3", "U4", "U5", "U6", "U8"]);
    // U1 fehlt bewusst: sein Fundort liegt außerhalb der Lease (siehe Rückgabe, Restgrenze 1).
    expect(ids).not.toContain("U1");
    // U7 ist das Vorbild, keine offene Behauptung.
    expect(ids).not.toContain("U7");
  });
});
