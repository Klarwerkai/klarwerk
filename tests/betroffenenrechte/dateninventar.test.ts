// ================================================================================================
// BETROFFENENRECHTE · DAS DATENINVENTAR IST AN DIE MIGRATION GEBUNDEN (R-0583, R-0667).
// ================================================================================================
//
//   I1  Jede Tabelle, die `migrate()` anlegt, steht in GENAU EINER Datenart — und das Inventar führt
//       keine Tabelle, die keine Migration anlegt. Gegenprobe: eine neue Stufe ohne Eintrag wird rot.
//   I2  Jede Datenart sagt, was sie enthält, ob ein Personenbezug möglich ist, wo sie liegt, wie sie
//       heute gelöscht wird und welche Frist gilt — „nicht in der Auskunft" immer mit Grund.
//   I3  Die ehrlichen Befunde stehen darin: KI-Läufe speichern keine Inhalte (und der Datensatz hat
//       kein Inhaltsfeld), Wissenslücken speichern den Fragetext.
//   I4  Das Verzeichnis entsteht aus Inventar und Betriebslage; Empfänger folgen der Lage, nichts
//       ist erfunden (Rechtsgrundlage, Verantwortlicher: „vom Betreiber einzutragen").
//   I5  Die neue Tabelle `loeschantraege` ist migriert, additiv und im Restore-Drill.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DATENINVENTAR,
  erzeugeVerarbeitungsverzeichnis,
  inventarTabellen,
  verzeichnisAlsMarkdown,
} from "../../services/app/src/dateninventar";
import { schemas } from "../../services/app/src/db";
import { LOESCHANTRAG_SCHEMA } from "../../services/app/src/loeschantraege";
import { MIGRATIONS_SOLLLISTE, klassifiziereStufe } from "../../services/app/src/migrationsbeleg";
import { pflichttabellenAusDrill, tabellenAusSchemas } from "../backup-drill/pflichtsatz";

const WURZEL = join(__dirname, "..", "..");
const migriert = tabellenAusSchemas(schemas);

describe("I1 · jede migrierte Tabelle steht in genau einer Datenart", () => {
  it("Kalibrierung: die Erhebung trägt überhaupt etwas", () => {
    expect(migriert.length).toBeGreaterThanOrEqual(50);
    expect(DATENINVENTAR.length).toBeGreaterThanOrEqual(25);
  });

  it("keine migrierte Tabelle fehlt im Inventar", () => {
    const fehlend = migriert.filter((t) => !inventarTabellen().includes(t));
    expect(fehlend, `ohne Datenart: ${fehlend.join(", ")}`).toEqual([]);
  });

  it("das Inventar führt keine Tabelle, die keine Migration anlegt", () => {
    const fremd = inventarTabellen().filter((t) => !migriert.includes(t));
    expect(fremd, `nicht migriert: ${fremd.join(", ")}`).toEqual([]);
  });

  it("keine Tabelle steht in zwei Datenarten, keine Kennung doppelt", () => {
    const tabellen = inventarTabellen();
    expect(tabellen.filter((t, i) => tabellen.indexOf(t) !== i)).toEqual([]);
    const ids = DATENINVENTAR.map((d) => d.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("Gegenprobe: eine neue Migrationsstufe ohne Inventareintrag wird erkannt", () => {
    const morgen = tabellenAusSchemas([
      ...schemas,
      "CREATE TABLE IF NOT EXISTS neue_tabelle_ohne_datenart (id text PRIMARY KEY);",
    ]);
    expect(morgen.filter((t) => !inventarTabellen().includes(t))).toEqual([
      "neue_tabelle_ohne_datenart",
    ]);
  });
});

describe("I2 · jede Datenart ist vollständig beschrieben", () => {
  it("Inhalt, Personenbezug, Ablage, Löschweg und Frist sind gesetzt", () => {
    for (const d of DATENINVENTAR) {
      expect(d.inhalt.length, `${d.id}: Inhalt`).toBeGreaterThan(10);
      expect(["ja", "moeglich", "nein"], `${d.id}: Personenbezug`).toContain(d.personenbezug);
      expect(d.personenbezugGrund.length, `${d.id}: Grund des Personenbezugs`).toBeGreaterThan(5);
      expect(d.ablage.ort.length, `${d.id}: Ort`).toBeGreaterThan(3);
      expect(d.loeschung.length, `${d.id}: Löschweg`).toBeGreaterThan(5);
      expect(d.frist.length, `${d.id}: Frist`).toBeGreaterThan(5);
      if (!d.selbstauskunft.enthalten) {
        expect(d.selbstauskunft.grund.length, `${d.id}: Grund des Fehlens`).toBeGreaterThan(5);
      }
    }
  });

  it("die sechs Bereiche aus R-0663 stehen in der Selbstauskunft", () => {
    // Konto, eigene Objekte (mit Kommentaren), Fragen, Antworten, Protokollzeilen.
    // Nacharbeit 4 (BEN): dazu die KI-Läufe und die Klara-Sitzungen samt Zustimmungen.
    for (const id of [
      "konten",
      "wissensobjekte",
      "wissensluecken",
      "antwortbelege",
      "protokoll",
      "modelllaeufe",
      "klara",
    ]) {
      const d = DATENINVENTAR.find((x) => x.id === id);
      expect(d?.selbstauskunft.enthalten, `${id} fehlt in der Selbstauskunft`).toBe(true);
    }
  });

  it("auch Daten ausserhalb der Datenbank sind erfasst (Sicherungen, Server-Protokolle, Endgerät)", () => {
    for (const id of ["sicherungen", "serverprotokolle", "endgeraet"]) {
      const d = DATENINVENTAR.find((x) => x.id === id);
      expect(d, id).toBeDefined();
      expect(d?.ablage.tabellen).toEqual([]);
    }
  });
});

describe("I3 · die ehrlichen Befunde", () => {
  // Nacharbeit 1: die erste Fassung behauptete „kein Personenbezug" und prüfte, der Datensatz habe
  // kein Personenfeld. Der Prüflauf hat das widerlegt — `ModelRunRecord` trägt `actor` (die Kennung
  // der anfragenden Person aus `ModelRunContext`). Gemessen wird jetzt beides getrennt: KEIN
  // Inhaltsfeld (der ehrliche Befund aus R-0583), und das vorhandene Personenfeld steht im Inventar.
  const quelle = readFileSync(join(WURZEL, "services/model-runs/src/types.ts"), "utf8");
  const start = quelle.indexOf("export interface ModelRunRecord");
  const rumpf = quelle.slice(start, quelle.indexOf("\n}", start));
  const felder = [...rumpf.matchAll(/^ {2}([a-zA-Z]+)\??:/gm)].map((m) => m[1]);

  it("der Datensatz eines KI-Laufs hat wirklich kein Feld für Prompt, Antwort oder Inhalt", () => {
    expect(felder.length).toBeGreaterThan(5);
    for (const verboten of ["prompt", "answer", "antwort", "text", "content", "inhalt", "body"]) {
      expect(felder, `ModelRunRecord trägt ${verboten}`).not.toContain(verboten);
    }
  });

  it("KI-Läufe: keine Inhalte, aber die Kennung der anfragenden Person — so steht es im Inventar", () => {
    // Gegenprobe zur widerlegten Fassung: das Personenfeld ist da …
    expect(felder).toContain("actor");
    const d = DATENINVENTAR.find((x) => x.id === "modelllaeufe");
    // … und deshalb darf das Inventar keinen fehlenden Personenbezug behaupten.
    expect(d?.personenbezug).toBe("ja");
    expect(d?.personenbezugGrund).toMatch(/actor/);
    expect(d?.befund).toMatch(/keine Inhalte/);
    expect(d?.ablage.tabellen).toEqual(["model_runs"]);
    // Nacharbeit 4 (BEN): personenbezogen heisst hier auch „in der Auskunft" — nicht ausgeschlossen.
    expect(d?.selbstauskunft.enthalten).toBe(true);
  });

  it("Wissenslücken: der Fragetext wird gespeichert und steht als Befund im Inventar", () => {
    const d = DATENINVENTAR.find((x) => x.id === "wissensluecken");
    expect(d?.befund).toMatch(/Fragetext/);
    expect(d?.personenbezug).toBe("ja");
    const typen = readFileSync(join(WURZEL, "services/ask/src/types.ts"), "utf8");
    expect(typen).toMatch(/export interface Gap \{\s*id: string;\s*question: string;/);
  });

  it("Antwortbelege: weder Frage- noch Antworttext im Datensatz", () => {
    const d = DATENINVENTAR.find((x) => x.id === "antwortbelege");
    expect(d?.befund).toMatch(/weder der Fragetext noch der Antworttext/);
    const typen = readFileSync(join(WURZEL, "services/ask/src/types.ts"), "utf8");
    const start = typen.indexOf("export interface AnswerRecord {");
    const rumpf = typen.slice(start, typen.indexOf("\n}", start));
    expect(rumpf).not.toMatch(/question|answerText|text:/);
  });
});

describe("I4 · das Verarbeitungsverzeichnis entsteht aus dem System", () => {
  const ohneExtern = {
    modellAnbieter: [],
    lokalesModell: false,
    externeSuche: false,
    mailVersand: false,
  };
  const mitExtern = {
    modellAnbieter: ["anthropic"],
    lokalesModell: false,
    externeSuche: true,
    mailVersand: true,
  };
  const zeit = new Date("2026-10-07T10:00:00.000Z");

  it("jede Tätigkeit trägt Zweck, Datenkategorien, Speicherorte, Empfänger und Fristen", () => {
    const v = erzeugeVerarbeitungsverzeichnis(ohneExtern, zeit);
    expect(v.erzeugtAm).toBe("2026-10-07T10:00:00.000Z");
    expect(v.taetigkeiten.length).toBeGreaterThanOrEqual(8);
    for (const t of v.taetigkeiten) {
      expect(t.zweck.length, t.id).toBeGreaterThan(10);
      expect(t.datenkategorien.length, t.id).toBeGreaterThan(0);
      expect(t.speicherorte.length, t.id).toBeGreaterThan(0);
      expect(t.empfaenger.length, t.id).toBeGreaterThan(0);
      expect(t.loeschfristen.length, t.id).toBe(t.datenkategorien.length);
      // Nichts erfunden: die Rechtsgrundlage legt der Betreiber fest.
      expect(t.rechtsgrundlage).toBe("Vom Betreiber einzutragen.");
    }
    expect(v.verantwortlicher).toBe("Vom Betreiber einzutragen.");
    expect(v.datenarten).toBe(DATENINVENTAR);
  });

  it("Datenarten ohne Personenbezug erscheinen in keiner Tätigkeit — im Inventar aber schon", () => {
    // Nacharbeit 1: im Produktinventar trägt seit der Korrektur keine Datenart mehr „nein"; die
    // Regel wird deshalb an einem erweiterten Inventar gemessen, nicht an einer Behauptung.
    const ohneBezug = {
      ...(DATENINVENTAR[0] as (typeof DATENINVENTAR)[number]),
      id: "probe_ohne_bezug",
      name: "Probe ohne Personenbezug",
      personenbezug: "nein" as const,
      ablage: { ort: "Probe", tabellen: [] },
    };
    const v = erzeugeVerarbeitungsverzeichnis(ohneExtern, zeit, [...DATENINVENTAR, ohneBezug]);
    const inTaetigkeiten = v.taetigkeiten.flatMap((t) => t.datenkategorien.map((d) => d.datenart));
    expect(inTaetigkeiten).not.toContain("probe_ohne_bezug");
    expect(v.datenarten.map((d) => d.id)).toContain("probe_ohne_bezug");
    // Und die KI-Läufe stehen MIT ihrem Personenbezug in der KI-Tätigkeit.
    const ki = erzeugeVerarbeitungsverzeichnis(ohneExtern, zeit).taetigkeiten.find(
      (t) => t.id === "ki",
    );
    expect(ki?.datenkategorien.map((d) => d.datenart)).toContain("modelllaeufe");
  });

  it("die Empfänger folgen der Betriebslage — ohne externe KI wird keiner behauptet", () => {
    const ohne = erzeugeVerarbeitungsverzeichnis(ohneExtern, zeit);
    const mit = erzeugeVerarbeitungsverzeichnis(mitExtern, zeit);
    const empf = (v: typeof ohne, id: string) =>
      v.taetigkeiten.find((t) => t.id === id)?.empfaenger.join(" | ") ?? "";
    expect(empf(ohne, "ki")).not.toMatch(/anthropic/);
    expect(empf(mit, "ki")).toMatch(/Externer Modellanbieter „anthropic"/);
    expect(empf(mit, "fragen")).toMatch(/Externer Suchdienst/);
    expect(empf(mit, "konten")).toMatch(/SMTP/);
    expect(empf(ohne, "konten")).not.toMatch(/SMTP/);
    expect(mit.taetigkeiten.find((t) => t.id === "ki")?.drittland).toMatch(/Möglich/);
    expect(ohne.taetigkeiten.find((t) => t.id === "ki")?.drittland).toMatch(/Keine Übermittlung/);
  });

  it("die Markdown-Fassung trägt jede Tätigkeit und jede Datenart", () => {
    const v = erzeugeVerarbeitungsverzeichnis(mitExtern, zeit);
    const md = verzeichnisAlsMarkdown(v);
    expect(md).toMatch(/^# Verzeichnis der Verarbeitungstätigkeiten \(Art\. 30 DSGVO\)/);
    for (const t of v.taetigkeiten) {
      expect(md).toContain(`## ${t.name}`);
    }
    for (const d of DATENINVENTAR) {
      expect(md, d.name).toContain(d.name);
    }
    // Gleiche Eingabe, gleiches Verzeichnis.
    expect(verzeichnisAlsMarkdown(erzeugeVerarbeitungsverzeichnis(mitExtern, zeit))).toBe(md);
  });
});

describe("I5 · die Tabelle der Löschanträge", () => {
  it("ist migriert, als ADDITIV in der Sollliste und im Restore-Drill", () => {
    expect(schemas).toContain(LOESCHANTRAG_SCHEMA);
    expect(tabellenAusSchemas([LOESCHANTRAG_SCHEMA])).toEqual(["loeschantraege"]);
    expect(klassifiziereStufe(LOESCHANTRAG_SCHEMA)).toBe("ADDITIV");
    expect(MIGRATIONS_SOLLLISTE.find((s) => s.stufe === "LOESCHANTRAG_SCHEMA")?.risiko).toBe(
      "ADDITIV",
    );
    expect(pflichttabellenAusDrill()).toContain("loeschantraege");
  });
});
