// ================================================================================================
// AUFTRAG-BASIC-W1-KLARA-VERTRAUENSKOPF-08 — DER ERSTE SICHTBARE W1-SCHNITT (BASIC-0).
// ================================================================================================
//
// WAS HIER GEPINNT WIRD, UND WARUM ES NICHT SCHON WOANDERS STEHT.
//
// mega75/77/79/81 pinnen den KI-Zustand nach TEXT und ABLEITUNG: welche Zustaende es gibt, dass
// „laedt" kein Befund ist, dass kein Satz ein Modell fuer Klaras Antwort behauptet. Keiner von
// ihnen pinnt den ORT — und genau der war der Befund des Ist-Deltas 05: dieselbe wahre Auskunft
// sass IM Fragen-Reiter UNTER dem Eingabefeld und verschwand beim Reiterwechsel, obwohl
// `KW-S4-01 §2` sie „immer ganz oben im Kopf" verlangt.
//
// Dazu kommt Buendel B: der Server liefert seit mega34 FUENF unterscheidbare Pruefvorbehalte samt
// Zaehlung und die Konfliktlage in ZWEI Feldern. Das Aufgabenfenster las davon nur `grade` und
// zeigte ZWEI Texte. Die Konfliktwarnung, die W1 ausdruecklich verlangt, war von jedem anderen
// Vorbehalt ununterscheidbar.
//
// DIE BASIC-0-GRENZE (KW-W1-13) IST SELBST GEGENSTAND DIESER DATEI: es wird ausdruecklich geprueft,
// dass NICHTS erfunden wird, was der Server heute nicht liefert — kein Provider, kein Modell, kein
// Admin-Soll, keine Abweichung, keine `resolutionId`, keine Sitzung, kein Consent.
//
// Muster wie in den Nachbardateien (KLARA-2): DOM-freie Helfer + ausgefuehrter Inline-Spiegel +
// Quelltext-Pins auf die WIRKLICH ausgelieferte Datei.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ReasonerStatus } from "../../apps/web/src/api/types";
import {
  type AskFetchFn,
  type AskOutcome,
  type KlaraAiPhase,
  askEvidenceDetail,
  askGradeOf,
  askSnippetWorthShowing,
  askSourceRole,
  composeAnswerOutput,
  klaraAiLage,
  klaraTrustHead,
  performAsk,
} from "../../apps/web/src/lib/wordAddin";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

// ------------------------------------------------------------------------------------------------
// Werkzeug
// ------------------------------------------------------------------------------------------------

/** Der ausgefuehrte Inline-Spiegel — das WIRKLICH ausgelieferte Aufgabenfenster, nicht sein Zwilling. */
function spiegel(): {
  klaraTrustHead: typeof klaraTrustHead;
  klaraAiLage: typeof klaraAiLage;
  askEvidenceDetail: typeof askEvidenceDetail;
  askSourceRole: typeof askSourceRole;
  askSnippetWorthShowing: typeof askSnippetWorthShowing;
  performAsk: typeof performAsk;
} {
  const start = HTML.indexOf("// KW-WORDADDIN-HELPERS-START");
  const end = HTML.indexOf("// KW-WORDADDIN-HELPERS-END");
  expect(start, `${TASKPANE}: Helfer-Block fehlt`).toBeGreaterThan(0);
  expect(end, `${TASKPANE}: Helfer-Block ohne Ende`).toBeGreaterThan(start);
  const factory = new Function(
    `${HTML.slice(start, end)}; return { klaraTrustHead: klaraTrustHead, klaraAiLage: klaraAiLage, askEvidenceDetail: askEvidenceDetail, askSourceRole: askSourceRole, askSnippetWorthShowing: askSnippetWorthShowing, performAsk: performAsk };`,
  );
  return factory() as ReturnType<typeof spiegel>;
}

function woerterbuch(sprache: Sprache): string {
  const start = HTML.indexOf(`      ${sprache}: {`);
  expect(start, `${TASKPANE}: Woerterbuch ${sprache} fehlt`).toBeGreaterThan(0);
  const ende = HTML.indexOf("\n      },", start);
  expect(ende, `${TASKPANE}: Woerterbuch ${sprache} ohne Ende`).toBeGreaterThan(start);
  return HTML.slice(start, ende);
}

function text(sprache: Sprache, key: string): string {
  const treffer = new RegExp(`^\\s*${key}:\\s*"([^"]*)"`, "m").exec(woerterbuch(sprache));
  expect(treffer, `${sprache}.${key} fehlt`).not.toBeNull();
  return treffer?.[1] ?? "";
}

/**
 * Der volle Zustandsraum — Kreuzprodukt aus dem VERTRAG, nicht ein paar Beispiele.
 *
 * Die Werte stehen NICHT hier hingeschrieben, sondern kommen aus `interface ReasonerStatus`
 * (apps/web/src/api/types.ts). Waechst der Vertrag um einen Modus oder einen
 * Erreichbarkeits-Zustand, waechst dieser Zustandsraum mit — genau die Bauart, die mega75 fuer
 * denselben Vertrag gewaehlt hat. `reachable` ist optional; `undefined` ist deshalb ein
 * eigenstaendiger, echter Punkt des Raums.
 */
function alleStatus(): (ReasonerStatus | undefined)[] {
  const modes: ReasonerStatus["mode"][] = ["cloud", "local", "deterministic"];
  const reachables: ReasonerStatus["reachable"][] = [
    undefined,
    "none",
    "unverified",
    "active",
    "unreachable",
  ];
  const karten: (Record<string, boolean> | undefined)[] = [
    undefined,
    { answer: true },
    { answer: false },
  ];
  const out: (ReasonerStatus | undefined)[] = [undefined];
  for (const mode of modes) {
    for (const reachable of reachables) {
      for (const tasks of karten) {
        for (const active of [true, false]) {
          out.push({
            active,
            mode,
            ...(reachable ? { reachable } : {}),
            ...(tasks ? { tasks } : {}),
          });
        }
      }
    }
  }
  return out;
}

const PHASEN: KlaraAiPhase[] = ["laedt", "da", "unerreichbar"];

// ================================================================================================
// BLOCK A — DER PERMANENTE KOPF: DER ORT IST DIE LIEFERUNG.
// ================================================================================================
// JOB 3056 K1 (Pedi 04.09., Mockups design/klara — „Text über Text über Text … absolut unmöglich"):
// der ORT des Vertrauenskopfs ist umgezogen. Er stand seit BASIC-0 im <header>, dauerhaft im
// Sichtfeld; nach Pages-Massstab gehoert Erklaertext hinter das Zahnrad. Der Kopf lebt deshalb —
// mit denselben Kennungen, derselben Ableitung (klaraTrustHead/klaraAiLage), demselben Abruf
// /api/reasoner/status und denselben dreisprachigen Texten — unter „Wie Klara antwortet"
// (#kw-hilfe, erreichbar ueber Zahnrad → Einstellungen). Die Zusagen dieses Blocks bleiben: EIN
// Kopf, ausserhalb beider Reiter, ab dem ersten Bildaufbau gefuellt, Zustand als Text.
describe("W1-VERTRAUENSKOPF-08 BLOCK A: der Kopf hat EINEN Ort — hinter dem Zahnrad, ausserhalb der Reiter", () => {
  it("der Kopf liegt in „Wie Klara antwortet“ (#kw-hilfe) — nicht im Fragen-Abschnitt, nicht im <header>", () => {
    const header = HTML.indexOf("<header");
    const headerEnde = HTML.indexOf("</header>");
    const hilfe = HTML.indexOf('id="kw-hilfe"');
    const kopf = HTML.indexOf('id="klara-trust-head"');
    const sectionAsk = HTML.indexOf('id="section-ask"');
    expect(header, "kein <header>").toBeGreaterThan(0);
    expect(hilfe, "die Hilfe-Flaeche fehlt").toBeGreaterThan(0);
    expect(kopf, "der Vertrauenskopf fehlt").toBeGreaterThan(0);
    // Die Reihenfolge im Quelltext IST die Reihenfolge im Dokument: der Kopf steht NACH dem
    // Fragen-Abschnitt und INNERHALB der Hilfe-Flaeche; im <header> steht er nicht mehr.
    expect(kopf).toBeGreaterThan(hilfe);
    expect(kopf).toBeGreaterThan(sectionAsk);
    expect(HTML.slice(header, headerEnde)).not.toContain("klara-trust-head");
  });

  it("der Kopf haengt an KEINEM Reiter — er ueberlebt den Wechsel zu „Erfassen“", () => {
    const kopf = HTML.indexOf('id="klara-trust-head"');
    const sectionAsk = HTML.indexOf('id="section-ask"');
    const sectionCapture = HTML.indexOf('id="section-capture"');
    expect(sectionCapture, "kein Erfassen-Abschnitt").toBeGreaterThan(0);
    // Ausserhalb BEIDER Abschnitte: die Reiterumschaltung setzt deren className, sie kann den Kopf
    // damit weder verstecken noch loeschen. (Der Erfassen-Abschnitt endet vor den Einstellungen.)
    const einstellungen = HTML.indexOf('id="kw-einstellungen"');
    expect(kopf).toBeGreaterThan(sectionAsk);
    expect(kopf).toBeGreaterThan(sectionCapture);
    expect(kopf).toBeGreaterThan(einstellungen);
  });

  it("GENAU EIN Kopf — BASIC-1 erweitert ihn, statt einen zweiten zu bauen (KW-W1-13)", () => {
    const treffer = HTML.match(/id="klara-trust-head"/g) ?? [];
    expect(treffer.length, "es gibt nicht genau einen Vertrauenskopf").toBe(1);
    // Die alte Zeile im Fragen-Reiter ist WEG — sonst stuenden zwei Fassungen derselben Auskunft
    // nebeneinander und koennten auseinanderlaufen.
    expect(HTML.includes('id="ask-ai-lage"'), "die alte KI-Zeile steht noch im Fragen-Reiter").toBe(
      false,
    );
  });

  it("der Kopf ist ab dem ERSTEN Bildaufbau gefuellt — nicht erst nach einem Netzabruf", () => {
    // `renderStatics` laeuft beim Start und bei jedem Sprachwechsel. Haengt der Kopf dort, ist er
    // da, bevor irgendein Statusabruf zurueckkommt — im ehrlichen Zustand „wird geprueft".
    const start = HTML.indexOf("function renderStatics()");
    expect(start, "renderStatics fehlt").toBeGreaterThan(0);
    const block = HTML.slice(start, HTML.indexOf("\n    }", start));
    expect(block, "renderStatics fuellt den Kopf nicht").toContain("renderAiLage()");
  });

  it("der Kopf meldet sich als Statusbereich mit Namen (Tastatur-/Screenreader-Weg)", () => {
    const stelle = HTML.indexOf('id="klara-trust-head"');
    const umfeld = HTML.slice(stelle - 200, stelle + 200);
    expect(umfeld).toContain('role="status"');
    expect(umfeld).toContain('aria-live="polite"');
    // Der Name kommt aus dem Woerterbuch, nicht aus einer festen Zeichenkette.
    const render = HTML.slice(HTML.indexOf("function renderAiLage()"));
    expect(render.slice(0, 900)).toContain('t("trustHeadLabel")');
  });
});

describe("W1-VERTRAUENSKOPF-08 BLOCK A: der Zustand hat EINEN Besitzer", () => {
  it("klaraTrustHead leitet NICHTS ab — es uebersetzt klaraAiLage, ueber den vollen Zustandsraum", () => {
    let geprueft = 0;
    for (const phase of PHASEN) {
      for (const status of alleStatus()) {
        const kopf = klaraTrustHead(phase, status);
        expect(kopf.lage, `${phase}/${JSON.stringify(status)}`).toBe(klaraAiLage(phase, status));
        geprueft += 1;
      }
    }
    expect(geprueft, "kein einziger Zustand durchlaufen").toBeGreaterThan(50);
  });

  it("Inline-Spiegel == Modul auf JEDEM Punkt des Zustandsraums", () => {
    const s = spiegel();
    for (const phase of PHASEN) {
      for (const status of alleStatus()) {
        expect(s.klaraTrustHead(phase, status), `${phase}/${JSON.stringify(status)}`).toEqual(
          klaraTrustHead(phase, status),
        );
      }
    }
  });

  it("„lädt“ und „nicht erreichbar“ sind NIE „keine KI“ — und tragen eigene Etiketten", () => {
    const laedt = klaraTrustHead("laedt", undefined);
    const weg = klaraTrustHead("unerreichbar", undefined);
    // Ein Status, der eine echte „keine KI"-Lage ergibt.
    const keine = klaraTrustHead("da", {
      active: false,
      mode: "deterministic",
      reachable: "active",
    });
    expect(keine.lage).toBe("keine");
    expect(laedt.lage).toBe("laedt");
    expect(weg.lage).toBe("unerreichbar");
    // Drei Zustaende, drei UNTERSCHIEDLICHE Kurzetiketten — in jeder Sprache. Waeren zwei gleich,
    // waere der A22-Fehler zurueck (ein Ladezustand, der wie ein Befund aussieht).
    for (const sprache of SPRACHEN) {
      const etiketten = [laedt, weg, keine].map((k) => text(sprache, k.modeKey));
      expect(new Set(etiketten).size, `${sprache}: Etiketten nicht unterscheidbar`).toBe(3);
    }
  });

  it("jeder erreichbare Kopf-Zustand hat Kurzetikett UND ausfuehrlichen Satz in DE/EN/NL", () => {
    const gesehen = new Set<string>();
    for (const phase of PHASEN) {
      for (const status of alleStatus()) {
        gesehen.add(klaraTrustHead(phase, status).lage);
      }
    }
    expect(gesehen.size, "kein Zustand gesammelt").toBeGreaterThan(0);
    const fehlend: string[] = [];
    for (const lage of gesehen) {
      const modeKey = `trustMode${lage.charAt(0).toUpperCase()}${lage.slice(1)}`;
      const detailKey = `aiLage${lage.charAt(0).toUpperCase()}${lage.slice(1)}`;
      for (const sprache of SPRACHEN) {
        if (text(sprache, modeKey).trim().length === 0) {
          fehlend.push(`${sprache}.${modeKey}`);
        }
        if (text(sprache, detailKey).trim().length === 0) {
          fehlend.push(`${sprache}.${detailKey}`);
        }
      }
    }
    expect(fehlend.join("\n")).toBe("");
  });

  it("der Zustand steht als TEXT in der Pille — die Farbe allein genuegt NICHT", () => {
    // Die Pille bekommt IMMER einen Textinhalt aus dem Woerterbuch; die Tonklasse kommt zusaetzlich.
    const block = HTML.slice(HTML.indexOf("function renderAiLage()")).slice(0, 900);
    expect(block, "die Pille traegt keinen Text").toContain("pill.textContent = t(kopf.modeKey)");
    expect(block, "der Ton wird nicht gesetzt").toContain("trust-pill-");

    // Der eigentliche Beweis: die Farbe KANN die Information gar nicht tragen, weil sich mehrere
    // Zustaende einen Ton teilen. Waere jeder Zustand ein eigener Ton, waere dieser Test truegerisch
    // gruen — deshalb wird die Mehrfachbelegung ausdruecklich erhoben, nicht angenommen.
    const proTon = new Map<string, Set<string>>();
    for (const phase of PHASEN) {
      for (const status of alleStatus()) {
        const kopf = klaraTrustHead(phase, status);
        const menge = proTon.get(kopf.tone) ?? new Set<string>();
        menge.add(kopf.lage);
        proTon.set(kopf.tone, menge);
      }
    }
    expect(
      [...proTon.values()].some((lagen) => lagen.size > 1),
      "jeder Zustand haette einen eigenen Ton — dann waere Farbe doch die Kodierung",
    ).toBe(true);

    // Und trotzdem sind die Zustaende je Ton am TEXT unterscheidbar — in jeder Sprache.
    for (const [ton, lagen] of proTon) {
      for (const sprache of SPRACHEN) {
        const etiketten = [...lagen].map((lage) =>
          text(sprache, `trustMode${lage.charAt(0).toUpperCase()}${lage.slice(1)}`),
        );
        expect(new Set(etiketten).size, `${sprache}/${ton}: Etiketten nicht unterscheidbar`).toBe(
          lagen.size,
        );
      }
    }
  });
});

// ================================================================================================
// BLOCK A — DIE BASIC-0-GRENZE: WAS NICHT ERFUNDEN WIRD.
// ================================================================================================
describe("W1-VERTRAUENSKOPF-08: BASIC-0 erfindet nichts (KW-W1-13)", () => {
  it("kein Kopf-Text nennt Anbieter, Modell, Admin-Soll, Abweichung oder Sitzung", () => {
    const lagen = ["Laedt", "Unerreichbar", "Extern", "Intern", "Keine"];
    // Nur die eigentlichen Anbieter-/Modell-/Vertragsbegriffe. „KI"/„AI" ist erlaubt und noetig —
    // der Kopf sagt ja gerade, ob eine KI arbeitet; verboten ist WELCHE.
    const verboten = [
      /\banthropic\b/i,
      /\bopenai\b/i,
      /\bclaude\b/i,
      /\bgpt\b/i,
      /\bllama\b/i,
      /\bmistral\b/i,
      /\bsonnet\b/i,
      /\bmodellname\b/i,
      /\bmodel name\b/i,
      /resolutionId/i,
      /\bconsent\b/i,
      /\bzustimmung\b/i,
      /\bsitzung\b/i,
      /\bsession\b/i,
      /policyVersion/i,
    ];
    const verstoesse: string[] = [];
    for (const sprache of SPRACHEN) {
      for (const lage of lagen) {
        for (const key of [`trustMode${lage}`, `aiLage${lage}`]) {
          const wert = text(sprache, key);
          for (const muster of verboten) {
            if (muster.test(wert)) {
              verstoesse.push(`${sprache}.${key} nennt ${muster}`);
            }
          }
        }
      }
      const label = text(sprache, "trustHeadLabel");
      for (const muster of verboten) {
        if (muster.test(label)) {
          verstoesse.push(`${sprache}.trustHeadLabel nennt ${muster}`);
        }
      }
    }
    expect(verstoesse.join("\n")).toBe("");
  });

  it("die BASIC-1-Erweiterungsstelle ist vorhanden und heute LEER — kein Platzhalter", () => {
    for (const phase of PHASEN) {
      for (const status of alleStatus()) {
        const kopf = klaraTrustHead(phase, status);
        expect(Array.isArray(kopf.detailKeys)).toBe(true);
        expect(kopf.detailKeys.length, "detailKeys traegt einen erfundenen Wert").toBe(0);
      }
    }
  });

  // FORTGESCHRIEBEN IN AUFTRAG-BASIC-W1-KLARA-KOPF-CONSENT-06 (BASIC-1).
  //
  // VORHERHASH dieser Datei: 620866b8a37ebbae1bcb09b1cb26220c241e45da46f73330e2ec45ba24733da3
  //
  // EINZELBEGRUENDUNG — genau EIN Fall, und nur seine zwei letzten Zeilen. Der Fall pinnte
  // ursprueglich, dass BASIC-0 KEINEN Sitzungs-/Consent-Endpunkt hinzugefuegt hat. Das war fuer
  // BASIC-0 die richtige Zusage und ist es nicht mehr: BASIC-1 ist genau der Schnitt, der die
  // Sitzung eroeffnet und die Zustimmung serverseitig erteilt (KW-W1-S4-R2-KOPF-FREEZE-17).
  // Die Zeilen unveraendert stehen zu lassen hiesse, den erledigten Auftrag gegen den naechsten
  // auszuspielen; sie ersatzlos zu streichen hiesse, eine Grenze zu verlieren.
  //
  // Deshalb wird der Fall NICHT abgeschwaecht, sondern umgehaengt: die Grenze, die weiter gilt
  // (keine Admin-Sicht, kein zweiter abstrakter Statusweg), bleibt Wort fuer Wort stehen. Die
  // sitzungsgebundenen Klara-Endpunkte sind ab jetzt erlaubt — und werden nicht hier lose
  // zugelassen, sondern in `tests/app/klara-session-consent-ui.test.ts` gegen die eingefrorene
  // Vertragsdatei gemessen: Pfad, Methode, Header und Reihenfolge jedes einzelnen Aufrufs.
  // Der Rest dieser Datei ist unberuehrt.
  it("das Add-in holt den oeffentlichen Status weiterhin ueber den vorhandenen Weg", () => {
    expect(HTML).toContain('"/api/reasoner/status"');
    // Die Admin-Sicht und der zweite abstrakte Statusweg bleiben draussen (vip2-gate, mega75 A).
    expect(HTML).not.toContain("/api/reasoner/config");
    expect(HTML).not.toContain("/api/ai-status");
    // Der Hausstand (BASIC-0) haengt weiter am OEFFENTLICHEN Weg — der sitzungsgebundene Vertrag
    // fuellt den zweiten, eigens etikettierten Teil des Kopfes und nicht diese Pille.
    const lade = HTML.slice(
      HTML.indexOf("function ladeAiLage()"),
      HTML.indexOf("// KW-KLARA-AISTATE-FETCH-END"),
    );
    expect(lade.length, "der Statusabruf von BASIC-0 ist nicht auffindbar").toBeGreaterThan(0);
    expect(lade, "BASIC-0 darf nicht am Sitzungsvertrag haengen").not.toContain("/api/klara/");
  });
});

// ================================================================================================
// BLOCK B — DIE VORHANDENE EVIDENZ, ENTFALTET.
// ================================================================================================
describe("W1-VERTRAUENSKOPF-08 BLOCK B: Konflikt steht GETRENNT vom Pruefvorbehalt", () => {
  it("eine tragende Quelle im offenen Konflikt ergibt eine EIGENE, erkennbare Lage", () => {
    const d = askEvidenceDetail({
      grade: "unverified",
      checkCaveat: null,
      sourcesConflicted: true,
      conflictsUnproven: false,
    });
    expect(d.conflict).toBe("conflicted");
    // Kein Pruefvorbehalt — die Konfliktwarnung steht also ALLEIN und ist nicht mit ihm verwechselbar.
    expect(d.caveat).toBeNull();
    for (const sprache of SPRACHEN) {
      const konflikt = text(sprache, "askConflictConflicted");
      expect(konflikt.trim().length, `${sprache}: Konflikttext fehlt`).toBeGreaterThan(0);
      // Er unterscheidet sich von JEDEM Vorbehaltstext — sonst waere die Trennung nur behauptet.
      for (const grund of [
        "askCaveatUnknown",
        "askCaveatUnchecked",
        "askCaveatNoCoverage",
        "askCaveatIncomplete",
        "askCaveatUnattributed",
        "askCaveatOther",
      ]) {
        expect(konflikt, `${sprache}: Konflikt == ${grund}`).not.toBe(text(sprache, grund));
      }
    }
  });

  it("unbekannte Konfliktlage ist NICHT „keine Konflikte“", () => {
    const d = askEvidenceDetail({
      grade: "unverified",
      checkCaveat: null,
      sourcesConflicted: false,
      conflictsUnproven: true,
    });
    expect(d.conflict).toBe("unproven");
    for (const sprache of SPRACHEN) {
      expect(text(sprache, "askConflictUnproven")).not.toBe(text(sprache, "askConflictClear"));
    }
  });

  it("„keine offenen Konflikte“ NUR, wenn der Server beide Felder ausdruecklich verneint hat", () => {
    expect(askEvidenceDetail({ sourcesConflicted: false, conflictsUnproven: false }).conflict).toBe(
      "clear",
    );
    // Jede Unvollstaendigkeit faellt auf „nicht geprueft" — nie auf eine Entwarnung.
    for (const teil of [
      { sourcesConflicted: false },
      { conflictsUnproven: false },
      { sourcesConflicted: false, conflictsUnproven: true },
      {},
      null,
      undefined,
      "kaputt",
      42,
    ]) {
      expect(askEvidenceDetail(teil).conflict, JSON.stringify(teil)).toBe("unproven");
    }
  });
});

describe("W1-VERTRAUENSKOPF-08 BLOCK B: der Vorbehalt wird BENANNT, nie verschwiegen", () => {
  it("alle fuenf Servergruende ergeben fuenf unterscheidbare Texte — in jeder Sprache", () => {
    const gruende = ["unknown", "unchecked", "noCoverage", "incomplete", "unattributed"] as const;
    for (const grund of gruende) {
      const d = askEvidenceDetail({ checkCaveat: { reason: grund, unproven: 1, total: 2 } });
      expect(d.caveat?.key, `Grund ${grund} wurde nicht durchgereicht`).toBe(grund);
      expect(d.caveat?.unproven).toBe(1);
      expect(d.caveat?.total).toBe(2);
    }
    for (const sprache of SPRACHEN) {
      const texte = gruende.map(
        (g) => `askCaveat${g.charAt(0).toUpperCase()}${g.slice(1)}` as const,
      );
      const werte = texte.map((k) => text(sprache, k));
      expect(new Set(werte).size, `${sprache}: Gruende nicht unterscheidbar`).toBe(gruende.length);
    }
  });

  it("ein UNBEKANNTER Grund wird generischer Vorbehalt — nie Schweigen", () => {
    const d = askEvidenceDetail({ checkCaveat: { reason: "brandneu", unproven: 3, total: 3 } });
    expect(d.caveat?.key).toBe("other");
    expect(d.caveat?.unproven).toBe(3);
    for (const sprache of SPRACHEN) {
      expect(text(sprache, "askCaveatOther").trim().length).toBeGreaterThan(0);
    }
  });

  it("kaputte Zahlen werden zu 0 statt zu NaN — die Zeile bleibt lesbar", () => {
    const d = askEvidenceDetail({
      checkCaveat: { reason: "incomplete", unproven: "viele", total: -3 },
    });
    expect(d.caveat).toEqual({ key: "incomplete", unproven: 0, total: 0 });
  });

  it("`checkCaveat: null` ist eine ECHTE Aussage — kein Vorbehalt, und das ist kein Schweigen", () => {
    const d = askEvidenceDetail({
      grade: "verified",
      checkCaveat: null,
      sourcesConflicted: false,
      conflictsUnproven: false,
    });
    expect(d.caveat).toBeNull();
    expect(d.conflict).toBe("clear");
    // Die Einstufung selbst bleibt der bestehende, fail-safe Weg.
    expect(askGradeOf({ grade: "verified" })).toBe("verified");
    expect(askGradeOf(undefined)).toBe("unverified");
  });
});

describe("W1-VERTRAUENSKOPF-08 BLOCK B: Quelle und Ausschnitt", () => {
  it("die tragende Quelle ist von der bloss herangezogenen unterscheidbar", () => {
    expect(askSourceRole("ko-1", ["ko-1"])).toBe("carrying");
    expect(askSourceRole("ko-2", ["ko-1"])).toBe("consulted");
    for (const sprache of SPRACHEN) {
      expect(text(sprache, "askRoleCarrying")).not.toBe(text(sprache, "askRoleConsulted"));
    }
  });

  it("ohne `citedSources` wird KEINE Rolle behauptet — die Liste sieht aus wie bisher", () => {
    expect(askSourceRole("ko-1", undefined)).toBe("unknown");
    expect(askSourceRole("ko-1", [])).toBe("unknown");
  });

  it("der Ausschnitt erscheint NUR, wenn er nicht die Antwort selbst ist (mega39-D2-Schutz)", () => {
    const aussage = "Ventil vor der Wartung entlasten und den Druck pruefen.";
    // Der heutige retrieval-only-Weg: Antwort UND Ausschnitt sind derselbe Satz.
    expect(askSnippetWorthShowing(aussage, aussage)).toBe(false);
    expect(askSnippetWorthShowing(aussage, `  ${aussage}\n `)).toBe(false);
    // Leer/fehlend erfindet nichts.
    expect(askSnippetWorthShowing(aussage, undefined)).toBe(false);
    expect(askSnippetWorthShowing(aussage, "   ")).toBe(false);
    // Ein WIRKLICH anderer Ausschnitt lohnt die Zeile.
    expect(askSnippetWorthShowing(aussage, "Zusaetzlicher Kontext aus der Quelle.")).toBe(true);
  });

  it("der Ausschnitt ist als ZITAT bezeichnet — keine Begruendungskette, kein W3-Versprechen", () => {
    for (const sprache of SPRACHEN) {
      const label = text(sprache, "askSnippetLabel");
      expect(label.trim().length).toBeGreaterThan(0);
      // Kein Wort, das eine Herleitung oder Argumentation verspricht (KW-W1-13).
      for (const verboten of [
        /argument/i,
        /herleitung/i,
        /begr(ü|ue)ndung/i,
        /reasoning/i,
        /rationale/i,
        /redenering/i,
        /schritt/i,
        /\bsteps?\b/i,
        /stappen/i,
      ]) {
        expect(label, `${sprache}.askSnippetLabel verspricht eine Herleitung`).not.toMatch(
          verboten,
        );
      }
    }
    // Und es bleibt bei HOECHSTENS einem: das Aufgabenfenster liest `steps[0]`, nie eine Liste.
    expect(HTML).toContain("result.steps[0]");
    expect(HTML).not.toContain("result.steps.map");
  });
});

// ================================================================================================
// BLOCK B — DER ECHTE ANTWORTVERTRAG: GELESEN, NICHT ANGENOMMEN.
// ================================================================================================
describe("W1-VERTRAUENSKOPF-08 BLOCK B: performAsk liest die neuen Felder real", () => {
  const fakeRes = (body: unknown) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });

  it("`citedSources` und `steps[0].snippet` reisen mit — beide aus dem echten Antwortkoerper", async () => {
    const fetchFn: AskFetchFn = async () =>
      fakeRes({
        result: {
          answered: true,
          answer: "Ventil entlasten.",
          sources: ["ko-1", "ko-2"],
          citedSources: ["ko-1"],
          steps: [{ description: "Quelle A", sourceId: "ko-1", snippet: "Der tragende Satz." }],
          trust: 70,
          evidence: {
            grade: "verified",
            checkCaveat: null,
            sourcesConflicted: false,
            conflictsUnproven: false,
          },
        },
        gap: null,
      });
    const out = await performAsk("Frage", "de", fetchFn, 1000);
    expect(out.kind).toBe("answered");
    expect(out.sources).toEqual(["ko-1", "ko-2"]);
    expect(out.citedSources).toEqual(["ko-1"]);
    expect(out.snippet).toBe("Der tragende Satz.");
    expect(askSourceRole("ko-2", out.citedSources)).toBe("consulted");
  });

  it("FAIL-SAFE: ein Server ohne die Felder fuehrt in „keine Aussage“, nie in eine falsche", async () => {
    const fetchFn: AskFetchFn = async () =>
      fakeRes({
        result: { answered: true, answer: "A", sources: ["ko-1"], trust: 5 },
        gap: null,
      });
    const out = await performAsk("Frage", "de", fetchFn, 1000);
    expect(out.citedSources).toBeUndefined();
    expect(out.snippet).toBeUndefined();
    expect(askSourceRole("ko-1", out.citedSources)).toBe("unknown");
    // Und die Konfliktlage bleibt ehrlich unbekannt statt entwarnt.
    expect(askEvidenceDetail(out.evidence).conflict).toBe("unproven");
  });

  it("unbrauchbare Felder werden verworfen statt geraten", async () => {
    const fetchFn: AskFetchFn = async () =>
      fakeRes({
        result: {
          answered: true,
          answer: "A",
          sources: ["ko-1"],
          citedSources: ["  ", 42, "ko-1"],
          steps: [{ snippet: "   " }],
          trust: 5,
        },
        gap: null,
      });
    const out = await performAsk("Frage", "de", fetchFn, 1000);
    expect(out.citedSources).toEqual(["ko-1"]);
    expect(out.snippet).toBeUndefined();
  });

  it("Inline-Spiegel == Modul, auch fuer die neuen Felder", async () => {
    const s = spiegel();
    const koerper = {
      result: {
        answered: true,
        answer: "A",
        sources: ["ko-1", "ko-2"],
        citedSources: ["ko-2"],
        steps: [{ snippet: "Ausschnitt." }],
        trust: 9,
        evidence: {
          grade: "unverified",
          checkCaveat: { reason: "incomplete", unproven: 1, total: 2 },
          sourcesConflicted: true,
          conflictsUnproven: false,
        },
      },
      gap: null,
    };
    const fetchFn: AskFetchFn = async () => fakeRes(koerper);
    expect(await s.performAsk("Frage", "de", fetchFn, 1000)).toEqual(
      await performAsk("Frage", "de", fetchFn, 1000),
    );
    // …und fuer die drei Ableitungen darauf.
    for (const ev of [
      koerper.result.evidence,
      { sourcesConflicted: false, conflictsUnproven: false },
      { checkbogus: 1 },
      null,
      undefined,
    ]) {
      expect(s.askEvidenceDetail(ev)).toEqual(askEvidenceDetail(ev));
    }
    for (const [id, cited] of [
      ["ko-1", ["ko-1"]],
      ["ko-1", ["ko-2"]],
      ["ko-1", undefined],
    ] as const) {
      expect(s.askSourceRole(id, cited)).toBe(askSourceRole(id, cited));
    }
    for (const [a, sn] of [
      ["A", "A"],
      ["A", "B"],
      ["A", undefined],
    ] as const) {
      expect(s.askSnippetWorthShowing(a, sn)).toBe(askSnippetWorthShowing(a, sn));
    }
  });
});

// ================================================================================================
// BESTANDSSCHUTZ — WAS DAS HAUS VERLAESST, AENDERT SICH NICHT.
// ================================================================================================
describe("W1-VERTRAUENSKOPF-08: der Kopier-/Einfuegetext bleibt unveraendert", () => {
  it("composeAnswerOutput traegt WEDER Vorbehaltsgrund NOCH Konfliktlage NOCH Ausschnitt", () => {
    const out = composeAnswerOutput({
      body: "Ventil entlasten.",
      sourceTitles: ["Quelle A"],
      sourceDates: ["2026-07-01T10:00:00.000Z"],
      truncated: false,
      grade: "unverified",
      now: new Date("2026-08-02T09:00:00.000Z"),
      texts: {
        verified: "Belegt.",
        unverified: "Nicht belegt.",
        sourceLine: "Quelle: {titles} (KLARWERK, Stand {date})",
        sourceLineRetrieved: "Quelle: {titles} (KLARWERK, abgerufen {date})",
        truncatedNote: "Gekuerzt.",
      },
    });
    expect(out).toContain("Ventil entlasten.");
    expect(out).toContain("Nicht belegt.");
    // Die neuen Angaben sind ANZEIGE — sie wandern nicht ins Dokument (mega34 B2/mega35 A1 gelten
    // unveraendert; eine Konfliktwarnung IM eingefuegten Text waere eine eigene Produktentscheidung).
    for (const sprache of SPRACHEN) {
      expect(out).not.toContain(text(sprache, "askConflictConflicted"));
      expect(out).not.toContain(text(sprache, "askCaveatIncomplete"));
      expect(out).not.toContain(text(sprache, "askSnippetLabel"));
    }
  });

  it("der Antwortweg ist unveraendert retrieval-only — kein neuer Modus, kein Egress", async () => {
    let roh = "";
    const fetchFn: AskFetchFn = (_url, init) => {
      roh = init.body;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: null }),
      });
    };
    await performAsk("Frage", "de", fetchFn, 1000);
    expect(JSON.parse(roh)).toEqual({ question: "Frage", locale: "de", mode: "retrieval-only" });
  });

  it("die Evidenz-Anzeige wird an EINER Stelle gebaut — auch nach einem Sprachwechsel", () => {
    // Zwei Aufrufstellen waeren zwei Gelegenheiten auseinanderzulaufen; der Sprachwechsel ruft
    // dieselbe Funktion wie der Antworteingang und wie das Zuruecksetzen.
    expect(HTML).toContain("function renderAskEvidence()");
    const setLang = HTML.slice(HTML.indexOf("function setLang(next)"));
    expect(setLang.slice(0, 900), "Sprachwechsel baut die Evidenz nicht neu").toContain(
      "renderAskEvidence()",
    );
    const reset = HTML.slice(HTML.indexOf("function resetAskResult()"));
    expect(reset.slice(0, 1600), "Zuruecksetzen raeumt die Evidenz nicht").toContain(
      "renderAskEvidence()",
    );
  });
});

// ================================================================================================
// KALIBRIERUNG — waere dieser Wächter auch am ALTEN Stand rot?
// ================================================================================================
describe("W1-VERTRAUENSKOPF-08: Kalibrierung", () => {
  it("die geprueften Flaechen existieren ueberhaupt — sonst waere jede Zusicherung oben blind", () => {
    expect(HTML.length, "das Aufgabenfenster ist leer").toBeGreaterThan(10000);
    expect(HTML).toContain('id="klara-trust-mode"');
    expect(HTML).toContain('id="klara-trust-detail"');
    expect(HTML).toContain('id="ask-evidence-detail"');
    expect(HTML).toContain('id="ask-snippet-block"');
    // Der Zustandsraum ist nicht leer, und die Woerterbuecher werden wirklich gelesen.
    expect(alleStatus().length).toBeGreaterThan(20);
    expect(text("de", "trustModeLaedt").length).toBeGreaterThan(0);
  });

  it("ein AskOutcome ohne Antwort erzeugt keine Evidenzzeile (kein Geisterzustand)", () => {
    const leer: AskOutcome = { kind: "gap" };
    expect(leer.evidence).toBeUndefined();
    expect(askSnippetWorthShowing(leer.answer, leer.snippet)).toBe(false);
  });
});
