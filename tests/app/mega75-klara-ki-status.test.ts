// AUFTRAG-mega75 (Pedi 30.07.) — KLARA SAGT, MIT WELCHER KI SIE ARBEITET, NACH DENSELBEN REGELN.
//
// Pedis Widerspruch: in KLARWERK steht an jeder KI-Fläche eine Auskunft darüber, WOMIT gearbeitet
// wird (AiModelInfo → deriveAiAvailable/aiTaskInfoPublic am öffentlichen Status). Dieselbe Fläche
// im Word-Add-in trug davon NICHTS — der KI-Satz stand dort als fester Text ohne jede Verbindung
// zum tatsächlichen Zustand. Wer in KLARWERK eine KI arbeiten sah und in Klara „Keine belastbare
// Grundlage" las, bekam nirgends gesagt, warum das kein Widerspruch ist.
//
// Diese Datei trägt BLOCK B (dieselbe Ableitung, nicht eine zweite) und BLOCK E (der Wächter gegen
// das Auseinanderlaufen). Sie ist bewusst KEINE gepflegte Liste erwarteter Zustände: der
// Zustandsraum wird aus dem VERTRAG (apps/web/src/api/types.ts, interface ReasonerStatus) gelesen
// und die Verzweigungs-Literale werden auf BEIDEN Seiten eingesammelt. Findet der Sammler nichts,
// ist das ein Fehler und kein Erfolg.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReasonerStatus } from "../../apps/web/src/api/types";
import { deriveAiAvailable } from "../../apps/web/src/lib/aiAvailability";
import { KLARA_AI_TASK, type KlaraAiPhase, klaraAiLage } from "../../apps/web/src/lib/wordAddin";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const TYPES = "apps/web/src/api/types.ts";
const AI_AVAILABILITY = "apps/web/src/lib/aiAvailability.ts";
const TASK_INFO = "apps/web/src/lib/reasonerTaskInfo.ts";
const KLARA_ASSISTANT = "apps/web/src/components/KlaraAssistant.tsx";

// Die beiden Marker des mega75-Spiegels im buildlosen Taskpane. Eigene Marker INNERHALB des
// bestehenden Helfer-Blocks, damit der Sammler unten genau die KI-Zustands-Ableitung liest und
// nicht zufällig gleichlautende Zeichenketten aus anderen Helfern (z. B. "document").
const KLARA_START = "// KW-KLARA-AISTATE-START";
const KLARA_END = "// KW-KLARA-AISTATE-END";

// ------------------------------------------------------------------------------------------------
// Werkzeug: Kommentare entfernen. Der Sammler darf nur ECHTE Verzweigungen zählen — ein Vertragswert,
// der bloß in einer Begründung erwähnt wird, ist kein gekannter Zustand.
// ------------------------------------------------------------------------------------------------
function stripComments(source: string): string {
  // Zeilenumbrüche bleiben erhalten — die Zeilennummern unten müssen auf die Originaldatei zeigen.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

interface Fundstelle {
  datei: string;
  zeile: number;
}

// Sammelt jede Stelle, an der auf "wert" WIRKLICH VERZWEIGT wird — mit Datei und Zeile.
//
// Bewusst nur Vergleichs-Positionen (=== / !== / == / != / case), nicht „Zeichenkette kommt vor":
// der erste Entwurf dieses Sammlers zählte auch die Typ-Schlüssel aus
// `Pick<ReasonerStatus, "active" | "mode" | ...>` (aiAvailability.ts:30,82) und meldete deshalb
// „active" als Zustand, den nur KLARWERK kennt. Das war ein Fehlalarm des Sammlers, kein Befund —
// ein Typ-Schlüssel ist keine Verzweigung.
function sammleLiteral(datei: string, quelle: string, wert: string): Fundstelle[] {
  const zeilenRoh = quelle.split("\n");
  const zeilenOhneKommentar = stripComments(quelle).split("\n");
  const vergleich = new RegExp(`(?:[=!]==?\\s*|\\bcase\\s+)"${wert}"`);
  const treffer: Fundstelle[] = [];
  for (let i = 0; i < zeilenOhneKommentar.length; i += 1) {
    if (vergleich.test(zeilenOhneKommentar[i] ?? "")) {
      treffer.push({ datei, zeile: i + 1 });
    }
  }
  // Zeilennummern beziehen sich auf die Originaldatei — stripComments ersetzt nur zeilenintern,
  // Blockkommentare können jedoch Zeilen leeren. Beides erhält die Zeilenzahl, weil wir nur
  // Zeichen entfernen und keine Zeilenumbrüche. Absichern:
  expect(zeilenRoh.length, `${datei}: Zeilenzahl muss beim Kommentar-Strip erhalten bleiben`).toBe(
    zeilenOhneKommentar.length,
  );
  return treffer;
}

// Den Zustandsraum aus dem VERTRAG lesen (keine gepflegte Liste).
function reasonerStatusVertrag(): string {
  const src = read(TYPES);
  const start = src.indexOf("export interface ReasonerStatus {");
  expect(start, `${TYPES}: interface ReasonerStatus nicht gefunden`).toBeGreaterThan(0);
  const end = src.indexOf("\n}", start);
  expect(end, `${TYPES}: Ende von ReasonerStatus nicht gefunden`).toBeGreaterThan(start);
  return src.slice(start, end);
}

function vertragsWerte(feld: string): string[] {
  const block = stripComments(reasonerStatusVertrag());
  const treffer = new RegExp(`^\\s*${feld}\\??:\\s*([^;]+);`, "m").exec(block);
  expect(treffer, `${TYPES}: Feld ${feld} in ReasonerStatus nicht gefunden`).not.toBeNull();
  return [...(treffer?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);
}

// Den mega75-Spiegel aus dem Taskpane holen und ausführen.
function spiegelQuelle(): { block: string; startZeile: number } {
  const html = read(TASKPANE);
  const start = html.indexOf(KLARA_START);
  const end = html.indexOf(KLARA_END);
  // BLOCK E, Kalibrierung: an der heutigen Fassung (Add-in kennt gar keinen KI-Status) schlägt
  // GENAU DIESE Zusicherung an — der Wächter ist dann rot, nicht grün.
  expect(
    start,
    `${TASKPANE}: ${KLARA_START} fehlt — Klara kennt keinen KI-Status, KLARWERK schon`,
  ).toBeGreaterThan(0);
  expect(end, `${TASKPANE}: ${KLARA_END} fehlt`).toBeGreaterThan(start);
  return {
    block: html.slice(start, end),
    startZeile: html.slice(0, start).split("\n").length,
  };
}

interface Spiegel {
  klaraAiLage: (phase: string, status: unknown) => string;
  deriveAiAvailable: (status: unknown, task: string) => boolean;
  KLARA_AI_TASK: string;
}

function ladeSpiegel(): Spiegel {
  const { block } = spiegelQuelle();
  const factory = new Function(
    `${block}; return { klaraAiLage: klaraAiLage, deriveAiAvailable: deriveAiAvailable, KLARA_AI_TASK: KLARA_AI_TASK };`,
  );
  return factory() as Spiegel;
}

// Der volle Zustandsraum als Kreuzprodukt — nicht ein paar Beispiele.
function alleZustaende(): { status: ReasonerStatus | undefined; name: string }[] {
  const modes = vertragsWerte("mode");
  const reachables = vertragsWerte("reachable");
  expect(modes.length, `${TYPES}: mode-Union ist leer — der Sammler fände nichts`).toBeGreaterThan(
    0,
  );
  expect(
    reachables.length,
    `${TYPES}: reachable-Union ist leer — der Sammler fände nichts`,
  ).toBeGreaterThan(0);
  const taskKarten: { wert: Record<string, boolean> | undefined; name: string }[] = [
    { wert: undefined, name: "ohne-karte" },
    { wert: {}, name: "leere-karte" },
    { wert: { [KLARA_AI_TASK]: true }, name: "aufgabe-true" },
    { wert: { [KLARA_AI_TASK]: false }, name: "aufgabe-false" },
    { wert: { andereAufgabe: true }, name: "fremde-aufgabe" },
  ];
  const raum: { status: ReasonerStatus | undefined; name: string }[] = [
    { status: undefined, name: "status-fehlt" },
  ];
  for (const mode of modes) {
    for (const reachable of [...reachables, undefined]) {
      for (const active of [true, false]) {
        for (const karte of taskKarten) {
          // Schrittweise gesetzt statt gespreizt: mit `exactOptionalPropertyTypes` ist ein
          // weggelassenes Feld etwas anderes als ein Feld mit `undefined` — und genau der
          // Unterschied (alte Antwort ohne Karte) gehört zum geprüften Zustandsraum.
          const status: ReasonerStatus = { active, mode: mode as ReasonerStatus["mode"] };
          if (reachable) {
            status.reachable = reachable as NonNullable<ReasonerStatus["reachable"]>;
          }
          if (karte.wert) {
            status.tasks = karte.wert;
          }
          raum.push({
            status,
            name: `${mode}/${reachable ?? "ohne-reachable"}/active=${active}/${karte.name}`,
          });
        }
      }
    }
  }
  return raum;
}

// ================================================================================================
// BLOCK B — DIESELBE ABLEITUNG, NICHT EINE ZWEITE.
// ================================================================================================
//
// Die eine Wahrheit lebt in apps/web/src/lib/wordAddin.ts: `klaraAiLage` IMPORTIERT `deriveAiAvailable`
// (aiAvailability.ts) und `aiTaskInfoPublic` (reasonerTaskInfo.ts) und ruft sie auf — im TypeScript-
// Modul gibt es also gar keine Kopie, sondern echte Wiederverwendung genau der Funktionen, an denen
// auch AiModelInfo hängt. Nur das buildlose Taskpane muss spiegeln (kein Modulsystem, kein Build).
// Dieser Test pinnt den Spiegel gegen das Modul über den VOLLEN Zustandsraum — damit ist der Spiegel
// transitiv gegen KLARWERKs echte Ableitung gepinnt.
describe("AUFTRAG-mega75 BLOCK B: Klara und KLARWERK leiten IDENTISCH ab", () => {
  it('gleiche Aufgabe wie die Fläche in der Anwendung (KlaraAssistant: task="answer")', () => {
    const assistant = read(KLARA_ASSISTANT);
    expect(assistant, `${KLARA_ASSISTANT}: AiModelInfo-Einbindung fehlt`).toContain(
      '<AiModelInfo task="answer" />',
    );
    // Klara im Word-Add-in fragt nach DERSELBEN Aufgabe — sonst verglichen wir zwei Dinge.
    expect(KLARA_AI_TASK).toBe("answer");
    expect(ladeSpiegel().KLARA_AI_TASK).toBe(KLARA_AI_TASK);
  });

  it("deriveAiAvailable: Spiegel == KLARWERK-Modul auf JEDEM Punkt des Vertrags-Zustandsraums", () => {
    const spiegel = ladeSpiegel();
    const raum = alleZustaende();
    let geprueft = 0;
    for (const { status, name } of raum) {
      expect(spiegel.deriveAiAvailable(status, KLARA_AI_TASK), `deriveAiAvailable @ ${name}`).toBe(
        deriveAiAvailable(status, KLARA_AI_TASK),
      );
      geprueft += 1;
    }
    // Unabhängiger Zähler: ein leerer Raum wäre ein grüner Test ohne Aussage.
    expect(geprueft, "Zustandsraum ist leer — der Vergleich hätte nichts geprüft").toBe(
      raum.length,
    );
    expect(geprueft).toBeGreaterThan(100);
  });

  it("klaraAiLage: Spiegel == Modul für extern, intern, keine, lädt und nicht erreichbar", () => {
    const spiegel = ladeSpiegel();
    const phasen: KlaraAiPhase[] = ["laedt", "da", "unerreichbar"];
    const raum = alleZustaende();
    const gesehen = new Set<string>();
    let geprueft = 0;
    for (const phase of phasen) {
      for (const { status, name } of raum) {
        const erwartet = klaraAiLage(phase, status);
        expect(spiegel.klaraAiLage(phase, status), `klaraAiLage @ ${phase}/${name}`).toBe(erwartet);
        gesehen.add(erwartet);
        geprueft += 1;
      }
    }
    expect(geprueft).toBe(phasen.length * raum.length);
    // Die fünf ehrlichen Zustände aus dem Auftrag müssen im Raum WIRKLICH vorkommen — sonst wäre
    // ein Zustand nur behauptet und nie durchlaufen.
    for (const lage of ["extern", "intern", "keine", "laedt", "unerreichbar"]) {
      expect(gesehen.has(lage), `Zustand "${lage}" wurde vom Zustandsraum nie erreicht`).toBe(true);
    }
    // Und kein SECHSTER, unbenannter Zustand.
    expect([...gesehen].sort()).toEqual(["extern", "intern", "keine", "laedt", "unerreichbar"]);
  });

  it("„lädt“ ist NICHT „keine KI“ — der A22-Fehler wird nicht wiederholt", () => {
    const spiegel = ladeSpiegel();
    // Derselbe Status, drei Phasen: der Ladezustand darf nie wie ein Befund aussehen.
    const status: ReasonerStatus = { active: true, mode: "cloud", reachable: "active" };
    expect(klaraAiLage("laedt", status)).toBe("laedt");
    expect(klaraAiLage("laedt", undefined)).toBe("laedt");
    expect(klaraAiLage("unerreichbar", status)).toBe("unerreichbar");
    expect(klaraAiLage("da", status)).toBe("extern");
    expect(spiegel.klaraAiLage("laedt", undefined)).toBe("laedt");
    expect(spiegel.klaraAiLage("unerreichbar", status)).toBe("unerreichbar");
  });
});

// ================================================================================================
// BLOCK E — DER WÄCHTER GEGEN DAS AUSEINANDERLAUFEN.
// ================================================================================================
//
// Ein SAMMLER mit unabhängigem Zähler: er liest die Vertragswerte aus types.ts, sammelt auf beiden
// Seiten die Zeilen, in denen wirklich auf sie verzweigt wird, und wird rot, sobald eine Seite einen
// Zustand kennt, den die andere nicht kennt — mit Datei und Zeile. Findet er gar nichts, ist das
// ein Fehler.
describe("AUFTRAG-mega75 BLOCK E: kein Zustand, den nur eine der beiden Flächen kennt", () => {
  it("jeder Vertragswert wird auf BEIDEN Seiten verzweigt oder auf keiner", () => {
    const werte = [...vertragsWerte("mode"), ...vertragsWerte("reachable")];
    expect(werte.length, "Vertrags-Zustandsraum leer — der Sammler hätte nichts zu sammeln").toBe(
      new Set(werte).size,
    );
    expect(werte.length).toBeGreaterThan(0);

    const { block, startZeile } = spiegelQuelle();
    // KLARWERK-Seite: die ECHTEN Ableitungsmodule, ganz und ungefiltert (keine markierte Region —
    // eine markierte Region wäre eine gepflegte Liste).
    const klarwerkQuellen: [string, string][] = [
      [AI_AVAILABILITY, read(AI_AVAILABILITY)],
      [TASK_INFO, read(TASK_INFO)],
    ];

    const abweichungen: string[] = [];
    let beidseitig = 0;
    for (const wert of werte) {
      const inKlarwerk = klarwerkQuellen.flatMap(([datei, quelle]) =>
        sammleLiteral(datei, quelle, wert),
      );
      const inKlara = sammleLiteral(TASKPANE, block, wert).map((f) => ({
        datei: f.datei,
        zeile: f.zeile + startZeile - 1,
      }));
      if (inKlarwerk.length > 0 && inKlara.length === 0) {
        abweichungen.push(
          `Zustand "${wert}": KLARWERK verzweigt darauf (${inKlarwerk
            .map((f) => `${f.datei}:${f.zeile}`)
            .join(", ")}), Klara kennt ihn NICHT (${TASKPANE}, Block ab Zeile ${startZeile}).`,
        );
      } else if (inKlara.length > 0 && inKlarwerk.length === 0) {
        abweichungen.push(
          `Zustand "${wert}": Klara verzweigt darauf (${inKlara
            .map((f) => `${f.datei}:${f.zeile}`)
            .join(", ")}), KLARWERK kennt ihn NICHT.`,
        );
      } else if (inKlarwerk.length > 0) {
        beidseitig += 1;
      }
    }
    expect(abweichungen.join("\n")).toBe("");
    // Unabhängiger Zähler: hätte der Sammler auf KEINER Seite je ein Literal gefunden (z. B. weil
    // ein Umbau die Dateien verschoben hat), wäre die leere Abweichungsliste eine Lüge.
    expect(
      beidseitig,
      "Der Sammler hat auf keiner Seite einen verzweigten Vertragswert gefunden — Fehlalarm-frei, aber blind",
    ).toBeGreaterThan(0);
  });

  it("jeder Anzeige-Zustand hat Text in ALLEN drei Sprachen (DE/EN/NL)", () => {
    const spiegel = ladeSpiegel();
    const html = read(TASKPANE);
    // Die Zustände werden GESAMMELT (durchlaufener Zustandsraum), nicht aufgezählt.
    const gesehen = new Set<string>();
    for (const phase of ["laedt", "da", "unerreichbar"]) {
      for (const { status } of alleZustaende()) {
        gesehen.add(spiegel.klaraAiLage(phase, status));
      }
    }
    expect(gesehen.size, "Kein einziger Anzeige-Zustand gesammelt").toBeGreaterThan(0);

    const woerterbuecher = ["de", "en", "nl"] as const;
    const fehlend: string[] = [];
    for (const lage of gesehen) {
      const key = `aiLage${lage.charAt(0).toUpperCase()}${lage.slice(1)}`;
      for (const sprache of woerterbuecher) {
        const start = html.indexOf(`      ${sprache}: {`);
        expect(start, `${TASKPANE}: Wörterbuch ${sprache} nicht gefunden`).toBeGreaterThan(0);
        const ende = html.indexOf("\n      },", start);
        const woerterbuch = html.slice(start, ende);
        const treffer = new RegExp(`^\\s*${key}:\\s*"([^"]*)"`, "m").exec(woerterbuch);
        if (!treffer || (treffer[1] ?? "").trim().length === 0) {
          fehlend.push(`${sprache}.${key} fehlt oder ist leer (Zustand "${lage}")`);
        }
      }
    }
    expect(fehlend.join("\n")).toBe("");
  });
});

// ================================================================================================
// BLOCK A + C — WAS DIE TESTERIN WIRKLICH SIEHT.
// ================================================================================================
describe("AUFTRAG-mega75 BLOCK A: Klara holt den öffentlichen Status über den vorhandenen Vertrag", () => {
  it("same-origin GET /api/reasoner/status mit derselben Sitzung — kein neuer Endpunkt", () => {
    const html = read(TASKPANE);
    expect(html).toContain('"/api/reasoner/status"');
    // Dieselbe Sitzung wie /api/ask und /api/drafts.
    const stelle = html.indexOf('"/api/reasoner/status"');
    const umfeld = html.slice(stelle, stelle + 400);
    expect(umfeld, "Statusabruf muss die Same-Origin-Sitzung mitführen").toContain(
      'credentials: "include"',
    );
    // Kein Add-in-eigener Modellaufruf, kein zweiter Statusweg.
    expect(html).not.toContain("/api/reasoner/config");
    expect(html).not.toContain("/api/ai-status");
  });

  it("der Modellname bleibt draußen — der öffentliche Status ist bewusst abstrahiert", () => {
    const { block } = spiegelQuelle();
    for (const verboten of ["model", "provider", "modelName", "localProvider"]) {
      expect(
        block.includes(`.${verboten}`),
        `Der Spiegel darf ${verboten} nicht auswerten (vip2-gate)`,
      ).toBe(false);
    }
  });
});

describe("AUFTRAG-mega75 BLOCK C: Klara sagt, unter welcher Regel sie steht", () => {
  it("die Regel steht dreisprachig im Wörterbuch und nennt beide Hälften", () => {
    const html = read(TASKPANE);
    const erwartet: Record<string, string[]> = {
      // wörtlich zitieren statt formulieren + der markierte Text verlässt das Haus nicht
      de: ["wörtlich", "nicht an eine externe KI"],
      en: ["word for word", "not sent to an external AI"],
      nl: ["woordelijk", "niet naar een externe AI"],
    };
    for (const [sprache, teile] of Object.entries(erwartet)) {
      const start = html.indexOf(`      ${sprache}: {`);
      const ende = html.indexOf("\n      },", start);
      const woerterbuch = html.slice(start, ende);
      const treffer = /^\s*askRuleNote:\s*"([^"]*)"/m.exec(woerterbuch);
      expect(treffer, `${sprache}: askRuleNote fehlt`).not.toBeNull();
      for (const teil of teile) {
        expect(treffer?.[1] ?? "", `${sprache}.askRuleNote muss "${teil}" nennen`).toContain(teil);
      }
    }
  });

  it("die Regel ist bei JEDER Antwort UND jeder Absage sichtbar", () => {
    const html = read(TASKPANE);
    // Dauerhaft sichtbar in der Frage-Karte (gilt damit vor, während und nach jeder Antwort) …
    expect(html).toContain('id="ask-rule-note"');
    // … und ausdrücklich in der Absage-Karte, wo der Mensch fragt „warum nicht?".
    const gap = html.slice(
      html.indexOf('id="ask-gap-block"'),
      html.indexOf('id="ask-gap-send-btn"'),
    );
    expect(gap, "Die Absage-Karte muss die Regel nennen").toContain('data-t="askRuleNote"');
  });
});
