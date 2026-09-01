// ================================================================================================
// JOB 2916 · D2 — STATION 6: DER ANTWORTERFOLG UND DER VERTRAUENSSTEMPEL SIND ZWEI DINGE
// ================================================================================================
//
// DIESE FASSUNG ERSETZT DIE VON D1 (gleicher Pfad, ROT beurteilt, nie eingebaut). Was BEN an D1
// zu Recht geruegt hat: S2 waehlte seine Erwartung anhand des VORGEFUNDENEN `checkCaveat`-Zustands.
// Ein solcher Fall bleibt auch dann gruen, wenn der Erfolgszweig nie erreicht wird — er belegt die
// Kopplung, aber nicht, dass beide Zustaende tatsaechlich eintreten koennen. Und er unterschied
// nicht, was hier die eigentliche Frage ist:
//
//   (A) STATION-6-ERFOLG          — `answered`, tragende Quelle, woertliche Fundstelle, keine Luecke.
//   (B) VERTRAUENSKENNZEICHNUNG   — `evidence.grade` und die angezeigte Wissensklasse.
//
// (B) haengt am Pruefvorbehalt der tragenden Quelle (`answerCheckState`,
// services/ask/src/answer-evidence.ts:59-75). (A) haengt daran NICHT. Genau das misst diese Datei:
// beide aiCheck-Zustaende werden DETERMINISTISCH hergestellt — nicht vorgefunden — und in beiden
// wird (A) SEPARAT von (B) geprueft. Faellt (A) je aus, ist das ein Station-6-Defekt; wechselt nur
// (B), ist es eine orthogonale Betriebsbedingung.
//
// WAS DIESER TEST ANDERES MISST ALS DIE VORHANDENEN.
//   · `tests/app/job2614-bodytext-kette.test.ts` K1 faehrt einen FRISCHEN Import bis zur Antwort —
//     aber ueber den KONSOLENWEG (`POST /api/ask` OHNE `mode`), also den Weg der Web-Oberflaeche.
//   · Derselbe Test K5 faehrt den PANELWEG (`mode: "retrieval-only"`, der Weg des Word-Add-ins)
//     bis zur Fundstelle — aber an einem REPARIERTEN ALTBESTAND (Fassung-1-Zeile, per Werkzeug
//     nachgezogen).
//   Die Kombination, die der Pedi-Pfad tatsaechlich geht — FRISCH IMPORTIERT **und** ueber das
//   PANEL gefragt — ist bis hierher an keiner Stelle gemessen. Genau sie steht hier.
//
// DER PRUEFFALL FOLGT DERSELBEN REGEL WIE K1: das Suchwort steht AUSSCHLIESSLICH im Fliesstext —
// nicht in Titel, Kernaussage, Kategorie oder Schlagwoertern. Nur dann misst der Fall wirklich die
// Kette Station 2 → Station 6 und nicht einen Titeltreffer.
import { describe, expect, it } from "vitest";
import type { AppServices } from "../../services/app/src/build-app";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { answerEvidence } from "../../services/ask";

const FLIESSTEXTWORT = "Splitterschutzverriegelung";
const BODY_HTML = `<h2>Kapitel 4 — Schutzeinrichtungen</h2><p>Die ${FLIESSTEXTWORT} wird vor jedem
Schichtbeginn auf freien Lauf geprüft und erst nach dem Prüfvermerk wieder freigegeben.</p>`;
const TITEL = "BAADER Wartungshandbuch Kapitel 4";
const KERNAUSSAGE = "Schutzeinrichtungen vor Schichtbeginn nach Handbuch prüfen.";

// ================================================================================================
// DIE ZWEI DETERMINISTISCHEN ZUSTAENDE — UND WARUM DER HINTERGRUNDLAUF DAFUER STILLSTEHEN MUSS.
// ================================================================================================
//
// Die Uebernahme stoesst den KI-Prueflauf an (`markAiCheckPending` + `aiCheckWorker.enqueue`,
// capture-routes.ts:718/722). Was dieser Lauf ergibt, haengt daran, ob ein Modell erreichbar ist —
// im hermetischen Tor `status=failed grund=no-model`, mit Modell `status=done`. Ein Fall, der
// seinen aiCheck-Zustand VORFINDET, misst deshalb die Umgebung und nicht den Code. Der Stub legt
// den Hintergrundlauf still (build-app.ts:1621 gibt einem vorab gesetzten Worker Vorrang); den
// Zustand setzt danach der Test selbst — beide, an DEMSELBEN Objekt.
function stillerPruefjob(): NonNullable<AppServices["aiCheckWorker"]> {
  return {
    enqueue: () => {},
    has: () => false,
    queuedCount: () => 0,
    idle: async () => {},
  };
}

// Ein Abdeckungsprotokoll, das `isCompleteRun` erfuellt (conflicts/src/coverage.ts:203): alles
// Vorhandene ausgewaehlt, jeder Versuch abgeschlossen, nichts uebersprungen, nicht gedeckelt,
// nicht abgebrochen. Nur so ergibt `answerCheckState` den Zustand `proven`.
const VOLLSTAENDIGER_LAUF = {
  available: 1,
  selected: 1,
  alreadyOpen: 0,
  attempted: 1,
  completed: 1,
  skipped: 0,
  capped: false,
  aborted: false,
} as const;

/** Station 1 bis 4 am Stueck: Import → Uebernahme → Validierung. Liefert die Kennung des Objekts. */
async function frischesValidiertesObjekt() {
  const services = buildServices();
  services.aiCheckWorker = stillerPruefjob();
  const app = buildApp(services);
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job2916.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@job2916.test", password: "geheim12345" },
  });
  const headers = { authorization: `Bearer ${login.json().token as string}` };

  // STATION 1 · IMPORT — die Form, die das Word-Add-in sendet.
  const draft = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers,
    payload: { title: TITEL, statement: KERNAUSSAGE, bodyHtml: BODY_HTML, origin: "word_addin" },
  });
  expect(draft.statusCode, draft.body).toBe(201);

  // STATION 2 · UEBERNAHME — der Mensch ergaenzt die Pflichtfelder.
  const promote = await app.inject({
    method: "POST",
    url: `/api/drafts/${draft.json().id as string}/promote`,
    headers,
    payload: { draftPayload: { type: "best_practice", category: "Wartung", neededValidations: 1 } },
  });
  expect(promote.statusCode, promote.body).toBe(201);
  const koId = promote.json().id as string;

  // STATION 4 · VALIDIERUNG — ohne sie sperrt `validatedOnly`, und zwar zu Recht (K6-Pin in 2614).
  const rate = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  expect(rate.statusCode, rate.body).toBe(200);
  expect((await services.ko.get(koId))?.status).toBe("validiert");

  return { app, services, headers, koId };
}

/** STATION 5 · IN WORD FRAGEN — genau der Modus, den `taskpane.html` faehrt. */
async function fragenWieDasPanel(
  app: Awaited<ReturnType<typeof frischesValidiertesObjekt>>["app"],
  headers: Record<string, string>,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers,
    payload: { question: `Wie wird die ${FLIESSTEXTWORT} geprüft?`, mode: "retrieval-only" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

// (A) STATION-6-ERFOLG. Vier Zusagen, alle ohne jeden Bezug auf Evidenzgrad oder Wissensklasse.
// Als Funktion, damit derselbe Massstab auf jeden Zustand UND auf die Gegenmutation passt.
function pruefeBelegteAntwort(
  antwort: { result: Record<string, unknown>; gap: unknown },
  koId: string,
) {
  expect(antwort.result.answered, "es wird ueberhaupt geantwortet").toBe(true);
  expect(antwort.result.sources, "die herangezogene Quelle ist DIESES Objekt").toEqual([koId]);
  expect(antwort.result.citedSources, "und sie TRAEGT die Antwort").toContain(koId);
  expect(
    String(antwort.result.answer),
    "die Fundstelle ist woertlich da (retrieval-only zitiert die validierte Aussage)",
  ).toContain(KERNAUSSAGE);
  expect(antwort.gap, "eine belegte Antwort vermerkt keine Wissensluecke").toBeNull();
}

// (B) VERTRAUENSKENNZEICHNUNG. Sie sagt NICHTS darueber, ob Station 6 geantwortet hat — sie sagt,
// ob die Einstufung belegt ist. `rawKnowledgeClass` bleibt in beiden Faellen die Herkunft.
function pruefeStempel(evidence: Record<string, unknown>, erwartet: "verified" | "unverified") {
  expect(evidence, "der Evidenzblock reist mit").toBeDefined();
  expect(evidence.rawKnowledgeClass, "die Herkunft bleibt unangetastet").toBe("gesichert");
  expect(evidence.sourcesConflicted, "kein offener Konflikt").toBe(false);
  expect(evidence.conflictsUnproven, "und die Konfliktlage ist BELEGT, nicht unbekannt").toBe(
    false,
  );
  expect(evidence.grade).toBe(erwartet);
  if (erwartet === "verified") {
    expect(evidence.checkCaveat, "belegter Lauf ⇒ kein Vorbehalt").toBeNull();
    expect(evidence.knowledgeClass, "und die Klasse darf stehen bleiben").toBe("gesichert");
  } else {
    expect(evidence.knowledgeClass, "abgesenkt, nicht behauptet").toBe("ungeprueft");
    expect(
      (evidence.checkCaveat as { reason?: string } | null)?.reason,
      "und der Grund wird BENANNT, nicht verschwiegen",
    ).toBe("incomplete");
  }
}

describe("JOB 2916 · D2 — Station 6 am frisch angelegten Objekt, ueber den Panelweg", () => {
  it("S1 — das Panel fragt (retrieval-only) und bekommt die Antwort MIT Quelle und Fundstelle", async () => {
    const { app, services, headers, koId } = await frischesValidiertesObjekt();

    // DER PRUEFFALL TRAEGT: das Wort steht NUR im Fliesstext.
    const ko = await services.ko.get(koId);
    expect(ko?.title).not.toContain(FLIESSTEXTWORT);
    expect(ko?.statement).not.toContain(FLIESSTEXTWORT);
    expect(ko?.category).not.toContain(FLIESSTEXTWORT);
    expect((ko?.tags ?? []).join(" ")).not.toContain(FLIESSTEXTWORT);
    // Und die Projektionszeile traegt ihn — die Voraussetzung von Station 6, nicht ihr Gegenstand.
    const zeile = await services.ko.searchProjectionOf(koId);
    expect(zeile?.bodyText).toContain(FLIESSTEXTWORT);

    const antwort = await fragenWieDasPanel(app, headers);
    pruefeBelegteAntwort(antwort, koId);

    console.info(
      `JOB 2916 · S1 · answered=${antwort.result.answered} · sources=${JSON.stringify(antwort.result.sources)} · citedSources=${JSON.stringify(antwort.result.citedSources)} · knowledgeClass=${antwort.result.knowledgeClass} · evidence=${JSON.stringify(antwort.result.evidence)}`,
    );
  });

  it("S2 — BEIDE aiCheck-Zustaende am SELBEN Objekt: die Antwort bleibt gleich, nur der Stempel wechselt", async () => {
    const { app, services, headers, koId } = await frischesValidiertesObjekt();

    // ---- ZUSTAND 1: der Prueflauf ist vollstaendig belegt (`proven`). ---------------------------
    expect(
      await services.ko.recordAiCheckOutcome(koId, { ok: true, coverage: VOLLSTAENDIGER_LAUF }),
      "der Zustand wird HERGESTELLT, nicht vorgefunden",
    ).toBe(true);
    expect((await services.ko.get(koId))?.aiCheck?.status).toBe("done");
    const mitBeleg = await fragenWieDasPanel(app, headers);

    pruefeBelegteAntwort(mitBeleg, koId); //  (A)
    pruefeStempel(mitBeleg.result.evidence, "verified"); //  (B)

    // ---- ZUSTAND 2: derselbe Fall, der Prueflauf ist gescheitert (`failed` ⇒ `incomplete`). -----
    // Das ist der Zustand, den die Anlage ohne erreichbares Modell tatsaechlich einnimmt: der
    // Worker vermerkt `status=failed`, Grund `no-model` (ai-check-worker → markAiCheckFailed).
    expect(
      await services.ko.markAiCheckFailed(koId, "no-model"),
      "auch dieser Zustand: gesetzt",
    ).toBe(true);
    expect((await services.ko.get(koId))?.aiCheck?.status).toBe("failed");
    const ohneBeleg = await fragenWieDasPanel(app, headers);

    pruefeBelegteAntwort(ohneBeleg, koId); //  (A) — UNVERAENDERT
    pruefeStempel(ohneBeleg.result.evidence, "unverified"); //  (B) — abgesenkt

    // ---- DER KERN DIESES DURCHGANGS, ALS EINE ZUSICHERUNG. -------------------------------------
    // Antwort, tragende Quelle und Fundstelle sind in beiden Zustaenden BYTEGLEICH; getauscht hat
    // ausschliesslich die Vertrauenskennzeichnung. Ein Antwortausfall von Station 6 laesst sich
    // aus dem fehlenden Prueflauf damit NICHT ableiten.
    expect(ohneBeleg.result.answer, "die Antwort selbst ist dieselbe").toEqual(
      mitBeleg.result.answer,
    );
    expect(ohneBeleg.result.citedSources, "die tragende Quelle ist dieselbe").toEqual(
      mitBeleg.result.citedSources,
    );
    expect(ohneBeleg.result.sources).toEqual(mitBeleg.result.sources);
    expect(ohneBeleg.gap).toBeNull();
    expect(
      (mitBeleg.result.evidence as { grade: string }).grade,
      "und NUR der Stempel unterscheidet die beiden Laeufe",
    ).not.toBe((ohneBeleg.result.evidence as { grade: string }).grade);

    console.info(
      `JOB 2916 · S2 · proven → grade=${(mitBeleg.result.evidence as { grade: string }).grade}/klasse=${(mitBeleg.result.evidence as { knowledgeClass: string }).knowledgeClass} · failed → grade=${(ohneBeleg.result.evidence as { grade: string }).grade}/klasse=${(ohneBeleg.result.evidence as { knowledgeClass: string }).knowledgeClass} · Antwort identisch=${ohneBeleg.result.answer === mitBeleg.result.answer}`,
    );
  });

  it("S3 — GEGENMUTATION: faellt das Antwortkriterium aus, wird (A) rot — und (B) merkt es nicht", async () => {
    const { app, services, headers, koId } = await frischesValidiertesObjekt();
    await services.ko.recordAiCheckOutcome(koId, { ok: true, coverage: VOLLSTAENDIGER_LAUF });
    const echt = await fragenWieDasPanel(app, headers);
    pruefeBelegteAntwort(echt, koId);

    // Ohne diese Probe waere (A) eine Behauptung: ein Massstab, der nie anschlaegt, misst nichts.
    // Mutation 1 — die tragende Quelle faellt weg (Station 6 ohne Beleg).
    const ohneTragendeQuelle = { ...echt, result: { ...echt.result, citedSources: [] } };
    expect(() => pruefeBelegteAntwort(ohneTragendeQuelle, koId)).toThrow();
    // Mutation 2 — die woertliche Fundstelle faellt weg.
    const ohneFundstelle = { ...echt, result: { ...echt.result, answer: "Dazu liegt etwas vor." } };
    expect(() => pruefeBelegteAntwort(ohneFundstelle, koId)).toThrow();
    // Mutation 3 — es wird gar nicht geantwortet.
    const ohneAntwort = { ...echt, result: { ...echt.result, answered: false } };
    expect(() => pruefeBelegteAntwort(ohneAntwort, koId)).toThrow();

    // UND DIE GEGENPROBE ZUR GEGENPROBE: derselbe mutierte Fall laesst (B) voellig kalt. Genau das
    // ist der Unterschied, den D1 nicht gezogen hat — ein echter Antwortausfall und eine blosse
    // Klassenabsenkung sind an verschiedenen Zusicherungen sichtbar, nicht an derselben.
    pruefeStempel(ohneTragendeQuelle.result.evidence as Record<string, unknown>, "verified");
    pruefeStempel(ohneFundstelle.result.evidence as Record<string, unknown>, "verified");
  });

  it("S4 — der dritte Zustand `unchecked` an der Regel selbst: kein Prueflauf ⇒ Vorbehalt, Antwort unberuehrt", async () => {
    const { app, services, headers, koId } = await frischesValidiertesObjekt();
    await services.ko.recordAiCheckOutcome(koId, { ok: true, coverage: VOLLSTAENDIGER_LAUF });
    const echt = await fragenWieDasPanel(app, headers);
    const ko = await services.ko.get(koId);
    expect(ko, "das gemessene Objekt liegt vor").toBeDefined();

    // `unchecked` heisst: GAR KEIN Vermerk. Ueber die Kette ist er nicht herstellbar — die
    // Uebernahme setzt immer einen pending-Vermerk (capture-routes.ts:718), und keine Fassade
    // loescht ihn wieder. Deshalb hier an der Regel, mit dem ECHTEN Objekt und der ECHTEN Antwort:
    // entfernt wird ausschliesslich das aiCheck-Feld (weggelassen, nicht auf `undefined` gesetzt —
    // `answerCheckState` fragt zwar nur nach Wahrheitswert, aber der Typ traegt kein `undefined`).
    const { aiCheck: _keinVermerk, ...ohneVermerk } = ko as NonNullable<typeof ko>;
    const ergebnis = answerEvidence({
      answer: {
        answered: echt.result.answered as boolean,
        knowledgeClass: echt.result.knowledgeClass,
        sources: echt.result.sources as string[],
        citedSources: echt.result.citedSources as string[],
      },
      sourceKos: new Map([[koId, ohneVermerk]]),
      openConflicts: [],
    } as Parameters<typeof answerEvidence>[0]);

    expect(
      ergebnis.checkCaveat?.reason,
      "kein Lauf ist etwas anderes als ein unvollstaendiger",
    ).toBe("unchecked");
    expect(ergebnis.grade).toBe("unverified");
    expect(ergebnis.knowledgeClass, "abgesenkt").toBe("ungeprueft");
    expect(ergebnis.rawKnowledgeClass, "Herkunft unangetastet").toBe("gesichert");
    // (A) bleibt auch hier, was es war: die Antwort dieses Laufs ist unveraendert belegt.
    pruefeBelegteAntwort(echt, koId);
  });
});
