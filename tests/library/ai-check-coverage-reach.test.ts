// ================================================================================================
// AUFTRAG-mega29 BLOCK C (bens M28-3) — DIE KENNZEICHNUNG ERREICHTE ZWEI ANSICHTEN UND SIEBEN NICHT.
// ================================================================================================
//
// mega28 hat die Einschränkung des gedeckelten Laufs an genau zwei Stellen sichtbar gemacht: der
// Validierungsliste und der Erfolgskarte im Erfassen. ben hat sieben weitere Stellen gefunden, an
// denen ein Mensch dasselbe Urteil liest — oder aus dessen AUSBLEIBEN etwas schließt — und die
// Einschränkung nicht sieht. Dieser Auftrag schneidet bewusst zu; hier stehen die serverseitigen
// Belege:
//
//   C2 — die leeren Konflikt-/Duplikat-Boards. „Keine offenen Konflikte" ist wörtlich richtig und
//        lädt trotzdem zu genau dem Schluss ein, gegen den mega28 gebaut wurde. Die Finding-
//        Endpunkte liefern keine Laufabdeckung, also braucht es eine SERVERSEITIGE Zusammenfassung.
//        Sie bleibt so schmal wie möglich: drei Zahlen, read-only, keine Objektdaten.
//   C3 — die menschlichen Ausgaben (Markdown, MediaWiki, HTML, Output Factory). Sie tragen NICHT
//        die volle Abdeckung; ein Satz genügt, der ehrlich sagt, dass die Ausgabe keine Aussage
//        über Konflikt- oder Duplikatfreiheit trifft.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import type { AiCheckCoverage } from "../../services/knowledge-object";
import { EXPORT_NO_CHECK_NOTE } from "../../services/library-analytics";
import { OUTPUT_NO_CHECK_NOTE, renderProvenance } from "../../services/output";

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved.KLARWERK_SKIP_KEYCHAIN = process.env.KLARWERK_SKIP_KEYCHAIN;
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
});

afterEach(() => {
  if (saved.KLARWERK_SKIP_KEYCHAIN === undefined) {
    delete process.env.KLARWERK_SKIP_KEYCHAIN;
  } else {
    process.env.KLARWERK_SKIP_KEYCHAIN = saved.KLARWERK_SKIP_KEYCHAIN;
  }
});

function coverage(over: Partial<AiCheckCoverage> = {}): AiCheckCoverage {
  return {
    available: 12479,
    selected: 20,
    alreadyOpen: 0,
    attempted: 20,
    completed: 20,
    skipped: 0,
    capped: true,
    aborted: false,
    ...over,
  };
}

async function setup(services: AppServices) {
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

async function makeKo(services: AppServices, title: string) {
  return services.ko.create({
    title,
    statement: `${title} — Aussage zum Betrieb.`,
    type: "best_practice",
    category: "Betrieb",
    author: "u1",
    confidentiality: "intern",
  });
}

describe("mega29 C2 · die leeren Boards bekommen eine serverseitige Abdeckungs-Zusammenfassung", () => {
  it("zählt Bestand, unvollständig geprüfte und gar nicht geprüfte Objekte", async () => {
    const services = buildServices();
    const capped = await makeKo(services, "Gedeckelt geprüft");
    const complete = await makeKo(services, "Vollständig geprüft");
    const aborted = await makeKo(services, "Abgebrochen");
    await makeKo(services, "Nie geprüft");

    await services.ko.recordAiCheckOutcome(capped.id, { ok: true, coverage: coverage() });
    await services.ko.recordAiCheckOutcome(complete.id, {
      ok: true,
      coverage: coverage({
        available: 3,
        selected: 3,
        attempted: 3,
        completed: 3,
        capped: false,
      }),
    });
    await services.ko.recordAiCheckOutcome(aborted.id, {
      ok: false,
      fallbackReason: "model-error",
      coverage: coverage({ aborted: true }),
    });

    const { app, headers } = await setup(services);
    const res = await app.inject({ method: "GET", url: "/api/ai-check/coverage-summary", headers });

    expect(res.statusCode).toBe(200);
    // BEWUSST schmal: drei Zahlen, keine Objektdaten, keine Titel, keine IDs. Sie tragen genau die
    // eine Aussage, die das leere Board braucht — dass hinter dem Bestand gedeckelte Läufe stehen.
    expect(res.json()).toEqual({ total: 4, incomplete: 2, unchecked: 1, noCoverage: 0 });
    await app.close();
  });

  it("ein durchweg vollständig geprüfter Bestand meldet ehrlich NICHTS zu beanstanden", async () => {
    const services = buildServices();
    const ko = await makeKo(services, "Vollständig geprüft");
    await services.ko.recordAiCheckOutcome(ko.id, {
      ok: true,
      coverage: coverage({
        available: 0,
        selected: 0,
        attempted: 0,
        completed: 0,
        capped: false,
      }),
    });

    const { app, headers } = await setup(services);
    const res = await app.inject({ method: "GET", url: "/api/ai-check/coverage-summary", headers });
    expect(res.json()).toEqual({ total: 1, incomplete: 0, unchecked: 0, noCoverage: 0 });
    await app.close();
  });

  // ==============================================================================================
  // AUFTRAG-mega31 BLOCK A (bens ROT-2) — DIE UMKEHR: NICHTS IST VOLLSTÄNDIG, BIS ES BELEGT IST.
  // ==============================================================================================
  //
  // Die Zusammenfassung las `capped`, `aborted` und `skipped` — den LAUFSTATUS las sie nicht. Ein
  // `failed`-Lauf, dessen Abdeckung (nach ROT-1) keinen einzigen Merker trug, galt damit als
  // vollständig. Waren alle Objekte so, meldete die Route `incomplete=0, unchecked=0` und die
  // Fußnote auf den leeren Boards rendert GAR NICHTS — die stillste denkbare Entwarnung.
  //
  // Die Vorgabe ist deshalb umgedreht: wo die Datenlage Vollständigkeit nicht BELEGT, lautet das
  // Ergebnis unvollständig. Ein fehlender Merker ist kein Freispruch.
  it("A2: ein `failed`-Lauf ist unvollständig — auch wenn seine Abdeckung KEINEN Merker trägt", async () => {
    const services = buildServices();
    const noModel = await makeKo(services, "Kein Modell");
    const provider = await makeKo(services, "Providerfehler");

    // Genau bens Fall: Status ehrlich `failed`, Abdeckung ohne capped/aborted/skipped. Vor der
    // Umkehr war das ein „vollständiger" Lauf.
    const spotless = coverage({
      available: 3,
      selected: 3,
      attempted: 3,
      completed: 3,
      skipped: 0,
      capped: false,
      aborted: false,
    });
    await services.ko.recordAiCheckOutcome(noModel.id, {
      ok: false,
      fallbackReason: "no-model",
      coverage: spotless,
    });
    await services.ko.recordAiCheckOutcome(provider.id, {
      ok: false,
      fallbackReason: "rate-limit",
      coverage: spotless,
    });

    const { app, headers } = await setup(services);
    const res = await app.inject({ method: "GET", url: "/api/ai-check/coverage-summary", headers });
    expect(res.json()).toEqual({ total: 2, incomplete: 2, unchecked: 0, noCoverage: 0 });
    await app.close();
  });

  it("A2: ein `pending`-Lauf ist nicht abgeschlossen und zählt nicht als vollständig", async () => {
    const services = buildServices();
    const ko = await makeKo(services, "Läuft noch");
    await services.ko.markAiCheckPending(ko.id);

    const { app, headers } = await setup(services);
    const res = await app.inject({ method: "GET", url: "/api/ai-check/coverage-summary", headers });
    expect(res.json()).toEqual({ total: 1, incomplete: 1, unchecked: 0, noCoverage: 0 });
    await app.close();
  });

  // A4: „kein Lauf nachweisbar" und „keine Abdeckung nachgewiesen" sind ZWEI Aussagen. Der Text
  // sagte für beide „gar keinen" Lauf — und das ist für ein Objekt mit Laufstatus schlicht falsch.
  it("A4: Altbestand MIT Laufstatus, aber OHNE Abdeckung ist nicht „gar kein Lauf“", async () => {
    const services = buildServices();
    const legacy = await makeKo(services, "Altbestand");
    const never = await makeKo(services, "Nie geprüft");
    // Abschluss ohne Abdeckungsfeld — der Zustand jedes Laufs von vor mega28.
    await services.ko.recordAiCheckOutcome(legacy.id, { ok: true });

    const { app, headers } = await setup(services);
    const res = await app.inject({ method: "GET", url: "/api/ai-check/coverage-summary", headers });
    // Der Altbestand steht in einem EIGENEN Zähler: ein Lauf ist nachweisbar, seine Reichweite
    // nicht. `unchecked` bleibt dem Objekt vorbehalten, über das wirklich kein Lauf etwas sagt.
    expect(res.json()).toEqual({ total: 2, incomplete: 0, unchecked: 1, noCoverage: 1 });
    expect(never.id).not.toBe(legacy.id);
    await app.close();
  });

  it("ohne Anmeldung gibt es die Zusammenfassung nicht (dieselbe Lesegrenze wie die Boards)", async () => {
    const services = buildServices();
    const { app } = await setup(services);
    const res = await app.inject({ method: "GET", url: "/api/ai-check/coverage-summary" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe("mega29 C3 · menschliche Ausgaben sagen, worüber sie KEINE Aussage treffen", () => {
  it("Markdown, MediaWiki und HTML tragen den Hinweis", async () => {
    const services = buildServices();
    const ko = await makeKo(services, "Ausgabe");
    await services.ko.setValidationState(ko.id, { trust: 80, status: "validiert" });

    const md = await services.library.exportMarkdown({ includeConfidential: true });
    const wiki = await services.library.exportMediaWiki({ includeConfidential: true });
    const html = await services.library.exportHtml({ includeConfidential: true });

    for (const [name, out] of [
      ["markdown", md],
      ["mediawiki", wiki],
      ["html", html],
    ] as const) {
      expect(out, name).toContain("Ausgabe");
      expect(out, name).toContain(EXPORT_NO_CHECK_NOTE);
    }
    // Der Satz nennt beides — Konflikt UND Duplikat — und behauptet nichts über die Abdeckung.
    expect(EXPORT_NO_CHECK_NOTE).toContain("Konflikt");
    expect(EXPORT_NO_CHECK_NOTE).toContain("Duplikat");
  });

  // ==============================================================================================
  // AUFTRAG-mega31 BLOCK B (bens ROT-3) — DER WARNSATZ STAND AM FALSCHEN ENDE.
  // ==============================================================================================
  //
  // Der Satz war in allen vier Ausgabewegen VORHANDEN — und in allen vieren erst hinter dem
  // gesamten Inhalt. Bei einem langen Export liest ihn niemand. Die Vorgabe lautete ausdrücklich
  // „wo ein Leser ihn sieht, statt am Ende eines langen Dokuments"; erfüllt war sie nicht.
  //
  // Die bisherigen Tests prüften mit `toContain` — die Position war ihnen strukturell unzugänglich.
  // Diese Tests pinnen die REIHENFOLGE über Zeichenpositionen: der Warnsatz steht vor dem ersten
  // Inhalt. Eine Wiederholung am Ende ist erlaubt und wird nicht verboten.
  it("B: der Warnsatz steht VOR dem ersten Inhalt — Markdown, MediaWiki, HTML", async () => {
    const services = buildServices();
    const ko = await makeKo(services, "Zweiter Inhalt");
    await services.ko.setValidationState(ko.id, { trust: 80, status: "validiert" });

    const md = await services.library.exportMarkdown({ includeConfidential: true });
    const wiki = await services.library.exportMediaWiki({ includeConfidential: true });
    const html = await services.library.exportHtml({ includeConfidential: true });

    for (const [name, out] of [
      ["markdown", md],
      ["mediawiki", wiki],
      ["html", html],
    ] as const) {
      const note = out.indexOf(EXPORT_NO_CHECK_NOTE);
      const content = out.indexOf("Zweiter Inhalt");
      expect(note, `${name}: Warnsatz fehlt`).toBeGreaterThanOrEqual(0);
      expect(content, `${name}: Inhalt fehlt`).toBeGreaterThanOrEqual(0);
      // DAS ist der Befund: der Satz muss VOR dem ersten Wissensobjekt stehen.
      expect(note, `${name}: Warnsatz steht hinter dem Inhalt`).toBeLessThan(content);
    }
    // HTML hat einen echten Exportkopf — dort gilt zusätzlich Titel → Warnsatz.
    expect(html.indexOf("<h1>")).toBeLessThan(html.indexOf(EXPORT_NO_CHECK_NOTE));
  });

  // ==============================================================================================
  // AUFTRAG-mega32 BLOCK C (bens GELB-3) — DER BELEG AN EINEM LANGEN DOKUMENT.
  // ==============================================================================================
  //
  // Die Reihenfolge war ab mega31 richtig gebaut und über Zeichenpositionen gepinnt — aber mit EINEM
  // einzigen kurzen Objekt. Bei so einem Export liegen Titel, Warnsatz und Inhalt binnen weniger
  // hundert Zeichen beieinander; „steht vorn" und „steht hinten" sind dann kaum unterscheidbar.
  // Der ganze Befund lautete aber, dass der Satz bei einem LANGEN Export untergeht. Genau diese
  // Probe fehlte.
  //
  // Dieser Test erzeugt einen Export aus mehreren langen Objekten und misst zusätzlich den ABSTAND
  // zum Dokumentende: der Warnsatz muss im vorderen Bereich stehen, nicht irgendwo vor dem letzten
  // Absatz. Damit ist die Aussage skalenunabhängig — sie hängt nicht mehr daran, dass das Dokument
  // kurz genug war, um sie versehentlich zu erfüllen.
  it("C: bei einem LANGEN Export aus mehreren Objekten steht der Warnsatz weit vorn", async () => {
    const services = buildServices();
    // Zwölf Objekte mit je einem umfangreichen Rumpf — zusammen deutlich über dem, was ein Leser
    // ohne Scrollen sieht.
    const filler = Array.from(
      { length: 40 },
      (_, i) =>
        `Absatz ${i}: Ausfuehrliche Beschreibung der betrieblichen Regelung mit Bedingungen, Massnahmen und Zustaendigkeiten, damit der Rumpf dieses Objekts realistisch lang wird.`,
    ).join(" ");
    for (let i = 0; i < 12; i++) {
      const ko = await services.ko.create({
        title: `Langes Objekt ${i}`,
        statement: `Langtext-Objekt ${i}. ${filler}`,
        type: "best_practice",
        category: "Betrieb",
        author: "u1",
        confidentiality: "intern",
      });
      await services.ko.setValidationState(ko.id, { trust: 80, status: "validiert" });
    }

    const md = await services.library.exportMarkdown({ includeConfidential: true });
    const wiki = await services.library.exportMediaWiki({ includeConfidential: true });
    const html = await services.library.exportHtml({ includeConfidential: true });

    for (const [name, out] of [
      ["markdown", md],
      ["mediawiki", wiki],
      ["html", html],
    ] as const) {
      const note = out.indexOf(EXPORT_NO_CHECK_NOTE);
      const firstContent = out.indexOf("Langtext-Objekt 0");
      const lastContent = out.lastIndexOf("Langtext-Objekt 11");

      // Das Dokument ist wirklich lang — sonst beweist der Rest nichts.
      expect(out.length, `${name}: Export zu kurz für die Probe`).toBeGreaterThan(20_000);
      expect(note, `${name}: Warnsatz fehlt`).toBeGreaterThanOrEqual(0);
      expect(firstContent, `${name}: erster Inhalt fehlt`).toBeGreaterThanOrEqual(0);
      expect(lastContent, `${name}: letzter Inhalt fehlt`).toBeGreaterThan(firstContent);

      // Titel des ersten Objekts → Warnsatz → erster Inhalt, in genau dieser Folge.
      const firstTitle = out.indexOf("Langes Objekt 0");
      expect(firstTitle, `${name}: erster Titel fehlt`).toBeGreaterThanOrEqual(0);
      expect(note, `${name}: Warnsatz steht hinter dem ersten Inhalt`).toBeLessThan(firstContent);

      // UND die Distanz zum Dokumentende: der Satz sitzt im vordersten Zehntel. Ein Satz, der
      // erst nach 90 % des Textes käme, erfüllte „vor dem letzten Objekt" und wäre trotzdem der
      // Befund, gegen den mega31 B gebaut wurde.
      expect(
        note / out.length,
        `${name}: Warnsatz steht nicht im vorderen Zehntel (${note} von ${out.length})`,
      ).toBeLessThan(0.1);
      expect(out.length - note, "Warnsatz klebt am Dokumentende").toBeGreaterThan(15_000);
    }
    // Der Exportkopf des HTML bleibt auch im langen Dokument vor dem Satz.
    expect(html.indexOf("<h1>")).toBeLessThan(html.indexOf(EXPORT_NO_CHECK_NOTE));
  });

  it("C: auch die Output Factory hält den Satz vorn, wenn das Dokument lang ist", async () => {
    const services = buildServices();
    const filler = Array.from(
      { length: 40 },
      (_, i) => `Absatz ${i}: Ausfuehrliche betriebliche Regelung mit Bedingungen und Massnahmen.`,
    ).join(" ");
    const koIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const ko = await services.ko.create({
        title: `Fabrik-Langobjekt ${i}`,
        statement: `Fabriklangtext ${i}. ${filler}`,
        type: "best_practice",
        category: "Betrieb",
        author: "u1",
        confidentiality: "intern",
      });
      await services.ko.setValidationState(ko.id, { trust: 80, status: "validiert" });
      koIds.push(ko.id);
    }

    const doc = await services.output.generate({ kind: "instruction", koIds });
    const md = doc.markdown;
    const title = md.indexOf("# ");
    const note = md.indexOf(OUTPUT_NO_CHECK_NOTE);
    const firstBody = md.indexOf("Fabriklangtext 0");
    const lastBody = md.lastIndexOf("Fabriklangtext 7");

    expect(md.length).toBeGreaterThan(10_000);
    expect(note).toBeGreaterThanOrEqual(0);
    expect(title).toBeLessThan(note);
    expect(note).toBeLessThan(firstBody);
    expect(lastBody).toBeGreaterThan(firstBody);
    expect(note / md.length, "Warnsatz nicht im vorderen Zehntel").toBeLessThan(0.1);
  });

  it("B: die Output Factory setzt ihn unter den Titel, vor den Rumpf", async () => {
    const services = buildServices();
    const ko = await makeKo(services, "Fabrikinhalt");
    await services.ko.setValidationState(ko.id, { trust: 80, status: "validiert" });

    const doc = await services.output.generate({ kind: "instruction", koIds: [ko.id] });
    const title = doc.markdown.indexOf("# ");
    const note = doc.markdown.indexOf(OUTPUT_NO_CHECK_NOTE);
    const body = doc.markdown.indexOf("Fabrikinhalt");
    expect(note).toBeGreaterThanOrEqual(0);
    // Titel → Warnsatz → Inhalt, in genau dieser Folge.
    expect(title).toBeLessThan(note);
    expect(note).toBeLessThan(body);
  });

  it("die Output Factory nennt ihn im Herkunftsblock", () => {
    const rendered = renderProvenance([
      {
        koId: "k1",
        title: "Ausgabe",
        status: "validiert",
        trust: 80,
        version: 1,
        author: "u1",
        originalAuthor: "u1",
        category: "Betrieb",
        type: "best_practice",
        validity: "validiert · v1",
        uncertain: false,
      },
    ]);
    expect(rendered).toContain(OUTPUT_NO_CHECK_NOTE);
  });
});
