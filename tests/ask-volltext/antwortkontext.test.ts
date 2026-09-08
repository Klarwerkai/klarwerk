// ================================================================================================
// JOB 3298 · ASK-VOLLTEXT — DIE REGEL AUS DEM DOKUMENTTEXT ERREICHT DEN ANTWORTKONTEXT.
// ================================================================================================
//
// DER BEFUND (Codex b65c00b4, Freitagsvorführung A02/A06/W1): Pedi fragt „How many days does the
// customer have to report a defect?". Die Quelle ist die importierte Confluence-Seite C02, deren
// Kernaussage nur der DEMO-Hinweis ist und deren Regel („30 calendar days") im Dokumenttext steht.
// Seit G27 findet Klara die Quelle — und verliert die Regel genau eine Zeile vor dem Modellaufruf:
// `provider-model.ts` baute den Antwortkontext aus `Titel: Aussage` und aus sonst nichts.
//
// WAS HIER GEMESSEN WIRD, und zwar am ECHTEN Prompt (der Modell-Client schreibt mit, was ihm
// vorgelegt wird — mehr Nähe zum Cloud-Modell gibt es ohne Cloud nicht):
//
//   A · DIE AUSWAHL     der Auszug besteht aus GANZEN Sätzen des Dokumenttexts, ausgewählt nach
//                       Wortüberdeckung mit der Frage — und er ist segmenttreu (A0).
//   B · DER PROMPT      der Satz mit der Regel steht im Modell-Prompt, unter der Nummer der Quelle.
//                       Die Gegenprobe ohne Dokumenttext zeigt denselben Prompt OHNE ihn.
//   C · DIE DECKEL      drei Quellen mit sehr langen Texten sprengen weder den Quelldeckel noch
//                       den Gesamtdeckel.
//   D · DAS ZITAT       ein Zitat aus dem Auszug besteht die Deckungsprüfung; eines über eine
//                       Satzgrenze hinweg fällt weiterhin durch (die Segmentregel D4 bleibt).
//
// GEGENPROBE ZUM MECHANISMUS (Auftrag §6): wird der Auszug aus dem Grounding entfernt, fällt B1.
// Der Fall B0 misst genau diese Differenz mit: er hält fest, dass die Kernaussage der Quelle den
// Satz NICHT enthält — ohne ihn wäre B1 auch dann grün, wenn der Satz zufällig anderswo stünde.
import { describe, expect, it } from "vitest";
import { type KnowledgeRef, type ModelClient, queryTokens } from "../../services/reasoner";
import {
  AUSZUG_MAX_SAETZE,
  AUSZUG_MAX_ZEICHEN_GESAMT,
  AUSZUG_MAX_ZEICHEN_JE_QUELLE,
  ModelProvider,
  dokumentAuszuege,
  dokumentAuszug,
  pruefeDeckung,
  quellSegmente,
  saetze,
  zitatWoerter,
} from "../../services/reasoner/src/provider-model";

const FRAGE = "How many days does the customer have to report a defect?";

// Der Dokumenttext der Seite C02, wie ihn die Suchprojektion liefert: Klartext, mehrere Sätze,
// die Regel MITTEN darin (nicht am Anfang — ein Präfixschnitt fände sie nicht).
const REGELSATZ = "The customer must report a defect within 30 calendar days after delivery.";
const C02_BODY = [
  "This page was imported from Confluence for the demonstration.",
  "It describes the general terms agreed with the partner network.",
  REGELSATZ,
  "Invoices are settled by the finance team once a quarter.",
].join(" ");

function c02(): KnowledgeRef {
  return {
    id: "c02",
    // Der Titel trägt bewusst Frageworte: so bleibt die Quelle AUCH OHNE Dokumenttext ein
    // Kandidat (B2 misst sonst nur, dass gar kein Modellaufruf stattfand — das wäre keine
    // Gegenprobe, sondern eine leere Menge).
    title: "Customer defect reporting",
    statement: "DEMO notice: content imported for the demonstration.",
    status: "validiert",
    trust: 90,
    bodyText: C02_BODY,
  };
}

/** Dieselbe Quelle OHNE Dokumenttext — der Stand vor diesem Auftrag (das Feld fehlt, es ist nicht leer). */
function c02OhneBody(): KnowledgeRef {
  const { bodyText: _weg, ...rest } = c02();
  return rest;
}

/** Ein Modell-Client, der mitschreibt, was ihm vorgelegt wurde, und eine feste Antwort gibt. */
function mitschreiber(antwort: string): {
  client: ModelClient;
  prompts: () => string[];
} {
  const prompts: string[] = [];
  return {
    client: {
      name: "mitschreiber",
      complete: async (_system: string, user: string) => {
        prompts.push(user);
        return antwort;
      },
    },
    prompts: () => prompts,
  };
}

describe("JOB 3298 A · die Auswahl: ganze Sätze des Dokumenttexts, nach Wortüberdeckung", () => {
  it("A0 · KALIBRIERUNG: Frage und Regelsatz teilen Inhaltstoken — sonst misst B nichts", () => {
    const frageWoerter = new Set(queryTokens(FRAGE));
    const gemeinsam = queryTokens(REGELSATZ).filter((w) => frageWoerter.has(w));
    expect(new Set(gemeinsam).size).toBeGreaterThanOrEqual(2);
  });

  it("A1 · der Auszug enthält den Regelsatz und nur Sätze mit Wortüberdeckung", () => {
    const auszug = dokumentAuszug(FRAGE, c02());
    expect(auszug).toContain(REGELSATZ);
    expect(auszug.length).toBeLessThanOrEqual(AUSZUG_MAX_SAETZE);
    // Kein Satz ohne gemeinsames Wort — der Auszug ist eine Auswahl, keine Abschrift.
    const frageWoerter = new Set(queryTokens(FRAGE));
    for (const satz of auszug) {
      expect(queryTokens(satz).some((w) => frageWoerter.has(w))).toBe(true);
    }
  });

  it("A2 · SEGMENTTREUE: jeder Auszug-Satz ist WÖRTLICH ein Segment derselben Quelle", () => {
    // Das ist die tragende Zusage des ganzen Auftrags: weil der Auszug aus GANZEN Sätzen desselben
    // Feldes besteht, ist alles, was das Modell daraus zitiert, ein Ausschnitt EINES Segments —
    // die Zitatprüfung D4 wird nicht gelockert, sie bekommt nur Material.
    const ref = c02();
    const segmente = quellSegmente(ref).map((s) => s.join(" "));
    for (const satz of dokumentAuszug(FRAGE, ref)) {
      expect(segmente).toContain(zitatWoerter(satz).join(" "));
    }
  });

  it("A3 · ohne Dokumenttext und ohne Wortüberdeckung gibt es keinen Auszug", () => {
    expect(dokumentAuszug(FRAGE, c02OhneBody())).toEqual([]);
    // Eine Frage ohne ein einziges Wort aus dem Text liefert nichts — es wird nichts „mitgegeben,
    // weil Platz ist".
    expect(dokumentAuszug("Welche Farbe hat das Schutzventil?", c02())).toEqual([]);
  });

  it("A4 · die Reihenfolge ist die des Dokuments und bei gleicher Eingabe immer dieselbe", () => {
    const einmal = dokumentAuszug(FRAGE, c02());
    const nochmal = dokumentAuszug(FRAGE, c02());
    expect(nochmal).toEqual(einmal);
    const stellen = einmal.map((s) => C02_BODY.indexOf(s));
    expect(stellen).toEqual([...stellen].sort((a, b) => a - b));
  });
});

describe("JOB 3298 B · der Prompt: der Regelsatz erreicht das Modell", () => {
  it("B0 · KALIBRIERUNG: die Kernaussage der Quelle enthält die Regel NICHT", () => {
    const ref = c02();
    expect(`${ref.title}: ${ref.statement}`).not.toContain("30 calendar days");
  });

  it("B1 · der Modell-Prompt trägt den Regelsatz unter der Nummer der Quelle", async () => {
    const { client, prompts } = mitschreiber(`${REGELSATZ} [1]`);
    const res = await new ModelProvider(client).answer(FRAGE, [c02()], "en");
    const prompt = prompts()[0] ?? "";
    expect(prompt).toContain("[1] Customer defect reporting:");
    expect(prompt).toContain("Document text (excerpt):");
    expect(prompt).toContain(REGELSATZ);
    // Und die Antwort geht MIT der Regel und MIT der Quelle hinaus — nicht als Absage,
    // nicht als Rückfall auf den DEMO-Hinweis.
    expect(res.answered).toBe(true);
    expect(res.answer).toContain("30 calendar days");
    expect(res.citedSources).toEqual(["c02"]);
  });

  it("B2 · GEGENPROBE: ohne Dokumenttext steht der Satz NICHT im Prompt, und die Antwort fällt zurück", async () => {
    const { client, prompts } = mitschreiber(`${REGELSATZ} [1]`);
    const ohneBody = c02OhneBody();
    const res = await new ModelProvider(client).answer(FRAGE, [ohneBody], "en");
    // Das Modell wurde WIRKLICH gefragt — sonst wäre „der Satz steht nicht im Prompt" die
    // Feststellung, dass es keinen Prompt gibt.
    expect(prompts()).toHaveLength(1);
    const prompt = prompts()[0] ?? "";
    expect(prompt).not.toContain(REGELSATZ);
    expect(prompt).not.toContain("Document text (excerpt):");
    // Der Modelltext ist jetzt ungedeckt — hinaus geht der Wortlaut der Quelle (Stand JOB 2659).
    expect(res.answer).toBe(ohneBody.statement);
  });

  it("B3 · die Beschriftung ist sprachbewusst (DE/EN/NL) und steht als eigenes Feld", async () => {
    for (const [locale, wort] of [
      ["de", "Dokumenttext (Auszug):"],
      ["en", "Document text (excerpt):"],
      ["nl", "Documenttekst (fragment):"],
    ] as const) {
      const { client, prompts } = mitschreiber("KEINE_DECKUNG");
      await new ModelProvider(client).answer(FRAGE, [c02()], locale);
      const prompt = prompts()[0] ?? "";
      expect(prompt).toContain(wort);
      // Eigenes Feld heißt: eigene Zeile, nicht an die Aussage angehängt.
      expect(prompt).toContain(`\n    ${wort}`);
    }
  });
});

describe("JOB 3298 C · die Deckel halten", () => {
  // ==============================================================================================
  // KORREKTURPFLICHT 2 (ben, Runde 1): DER GESAMTDECKEL BRAUCHT MATERIAL, DAS IHN SPRENGEN KANN.
  // ==============================================================================================
  // Runde 1 maß mit drei Quellen aus KURZEN Sätzen (~85 Zeichen). Je Quelle kamen so höchstens
  // ~255 Zeichen zusammen, drei Quellen also ~765 — der Gesamtdeckel von 2400 war nie in Reichweite,
  // und ben's Mutation (Entfernen von `uebrig -= text.length` in `dokumentAuszuege`) blieb grün. Ein
  // Deckel, den keine Eingabe erreicht, ist kein geprüfter Deckel.
  // Jetzt: LANGE Sätze (~270 Zeichen), sodass je Quelle zwei davon das 600-Zeichen-Budget fast
  // ausfüllen und der dritte nicht mehr hineinpasst, und FÜNF Quellen, sodass die Summe der einzeln
  // zulässigen Auszüge den Gesamtdeckel sicher überschreitet. C0 misst genau diese Voraussetzung,
  // statt sie zu behaupten.
  const langerSatz = (i: number) =>
    `The customer must report a defect number ${i} within 30 calendar days after delivery, in the agreed written form, addressed to the responsible contact person named in annex ${i} of the framework agreement, otherwise the claim lapses and the supplier confirms receipt in writing.`;
  // Ein Text, in dem JEDER Satz zur Frage passt — der ungünstigste Fall für einen Deckel.
  const langerText = Array.from({ length: 40 }, (_, i) => langerSatz(i)).join(" ");
  const QUELLEN_ZAHL = 5;

  function langeQuelle(id: string): KnowledgeRef {
    return {
      id,
      // Der Titel trägt bewusst Frageworte: so bleibt die Quelle AUCH OHNE Dokumenttext ein
      // Kandidat (B2 misst sonst nur, dass gar kein Modellaufruf stattfand — das wäre keine
      // Gegenprobe, sondern eine leere Menge).
      title: "Customer defect reporting",
      statement: "DEMO notice.",
      status: "validiert",
      trust: 90,
      bodyText: langerText,
    };
  }

  const vieleQuellen = () =>
    Array.from({ length: QUELLEN_ZAHL }, (_, i) => langeQuelle(`q${i + 1}`));

  it("C0 · KALIBRIERUNG: die Summe der EINZELN zulässigen Auszüge sprengt den Gesamtdeckel", () => {
    expect(langerText.length).toBeGreaterThan(AUSZUG_MAX_ZEICHEN_GESAMT);
    // Jede Quelle allein, ohne Gesamtbudget: das ist das Material, das C2/C3 zu deckeln haben.
    const einzeln = vieleQuellen().map((q) => dokumentAuszug(FRAGE, q).join(" ").length);
    for (const laenge of einzeln) {
      expect(laenge).toBeGreaterThan(0);
      expect(laenge).toBeLessThanOrEqual(AUSZUG_MAX_ZEICHEN_JE_QUELLE);
    }
    // OHNE Gesamtdeckel käme mehr heraus, als der Gesamtdeckel zulässt — sonst misst C2 nichts.
    expect(einzeln.reduce((s, n) => s + n, 0)).toBeGreaterThan(AUSZUG_MAX_ZEICHEN_GESAMT);
  });

  it("C1 · je Quelle höchstens N Sätze und M Zeichen", () => {
    const auszug = dokumentAuszug(FRAGE, langeQuelle("q1"));
    expect(auszug.length).toBeLessThanOrEqual(AUSZUG_MAX_SAETZE);
    expect(auszug.join(" ").length).toBeLessThanOrEqual(AUSZUG_MAX_ZEICHEN_JE_QUELLE);
  });

  it("C2 · fünf Quellen mit langem Text bleiben unter dem GESAMTdeckel", () => {
    const auszuege = dokumentAuszuege(FRAGE, vieleQuellen());
    const gesamt = [...auszuege.values()].reduce((s, t) => s + t.length, 0);
    expect(gesamt).toBeLessThanOrEqual(AUSZUG_MAX_ZEICHEN_GESAMT);
    for (const text of auszuege.values()) {
      expect(text.length).toBeLessThanOrEqual(AUSZUG_MAX_ZEICHEN_JE_QUELLE);
    }
    // Der Deckel greift wirklich: die hinteren Quellen bekommen weniger als die vorderen — und
    // wer gar nichts mehr bekommt, steht weiterhin mit Titel und Aussage im Grounding.
    expect(auszuege.size).toBeLessThanOrEqual(QUELLEN_ZAHL);
  });

  it("C3 · auch im Prompt: der Auszug-Anteil überschreitet den Gesamtdeckel nicht", async () => {
    const quellen = vieleQuellen();
    const { client, prompts } = mitschreiber("KEINE_DECKUNG");
    await new ModelProvider(client).answer(FRAGE, quellen, "en");
    const prompt = prompts()[0] ?? "";
    const anteil = prompt
      .split("\n")
      .filter((z) => z.trim().startsWith("Document text (excerpt):"))
      .map((z) => z.trim().replace("Document text (excerpt): ", ""))
      .reduce((s, t) => s + t.length, 0);
    expect(anteil).toBeGreaterThan(0);
    expect(anteil).toBeLessThanOrEqual(AUSZUG_MAX_ZEICHEN_GESAMT);
  });

  it("C4 · ein einzelner überlanger Satz wird an der Wortgrenze gekürzt, nicht verworfen", () => {
    const einSatz = `The customer must report a defect ${"in the agreed written form ".repeat(40)}within 30 calendar days`;
    const auszug = dokumentAuszug(FRAGE, {
      id: "lang",
      title: "T",
      statement: "S",
      status: "validiert",
      trust: 50,
      bodyText: einSatz,
    });
    expect(auszug).toHaveLength(1);
    expect((auszug[0] as string).length).toBeLessThanOrEqual(AUSZUG_MAX_ZEICHEN_JE_QUELLE);
    // An der Wortgrenze: das letzte Wort des Auszugs ist ein ganzes Wort des Quellsatzes.
    expect(einSatz.split(/\s+/)).toContain((auszug[0] as string).split(/\s+/).at(-1));
  });
});

describe("JOB 3298 D · die Zitatprüfung bleibt, was sie war", () => {
  it("D1 · ein Zitat aus dem Auszug ist gedeckt", () => {
    const befund = pruefeDeckung(`${REGELSATZ} [1]`, [c02()]);
    expect(befund.gedeckt).toBe(true);
    expect(befund.aussagen[0]?.zitatVon).toBe("c02");
  });

  it("D2 · ein Teilsatz aus dem Auszug ist gedeckt", () => {
    expect(pruefeDeckung("report a defect within 30 calendar days [1]", [c02()]).gedeckt).toBe(
      true,
    );
  });

  it("D3 · ein Zitat ÜBER die Satzgrenze des Dokumenttexts fällt weiterhin durch", () => {
    // Ende von Satz 3 und Anfang von Satz 4 — beide stehen im Auszugsbereich derselben Quelle,
    // zusammengesetzt ergeben sie eine Aussage, die niemand geschrieben hat.
    const zwei = `${saetze(C02_BODY)[2]?.replace(/\.$/, "")} Invoices are settled [1]`;
    expect(pruefeDeckung(zwei, [c02()]).gedeckt).toBe(false);
  });

  it("D4 · eine erfundene Zahl mit Marke fällt durch", () => {
    expect(
      pruefeDeckung("The customer must report a defect within 60 calendar days [1]", [c02()])
        .gedeckt,
    ).toBe(false);
  });
});
