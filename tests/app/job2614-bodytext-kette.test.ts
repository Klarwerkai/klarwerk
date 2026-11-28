// ================================================================================================
// JOB 2614 · D3 — DIE SUCHTEXT-KETTE: IMPORT BIS FUNDSTELLE, IN EINEM TEST
// ================================================================================================
//
// Station 2 des Pedi-Pfads. Der Befund an der Live-Datenbank (Sanierer, 27.08., BAADER-Dokument):
// `bodyHtml` 753 KB, `bodyText` 0 Zeichen — Klara antwortete „Keine belastbare Grundlage", weil der
// Volltext für das Relevanzmaß schlicht nicht da war. Die Diagnose aus D1 (BASIC3, übernommener
// Fremdstand): die Extraktion EXISTIERT und ist angeschlossen (`visibleTextFromBodyHtml`,
// search-projection.ts:480/:637); Pedis Bestand trägt Projektionszeilen der Fassung 1, deren
// `body_text` als Schema-Default leer blieb und die der gedrosselte Neben-Backfill nie erreichte.
//
// K1 beantwortet die von D1 offen gelassene Frage („wird ein NEU importiertes Dokument sofort
// V2-projiziert?") am ECHTEN Importweg und fährt die Abnahme-Kette in EINEM Fall durch:
//   Import (POST /api/drafts, exakt die Add-in-Form) → Übernahme (POST /api/drafts/:id/promote)
//   → Validierung → `bodyText` steht in der Projektionszeile → POST /api/ask findet das Dokument
//   über ein Wort, das AUSSCHLIESSLICH im Fliesstext steht → die Antwort belegt es mit der Quelle.
//
// DER PRÜFFALL FOLGT D1 §2: Das Suchwort darf in Titel, Kernaussage, Kategorie und Schlagwörtern
// NICHT vorkommen — nur dann misst der Fall wirklich den Fliesstext; ein Titelwort wäre grün, ohne
// dass `body_text` je gefüllt worden wäre. K2 liefert die zweite Hälfte, ohne die K1 nichts beweist:
// derselbe Bestand in Fassung 1 findet die Stelle NICHT — und der Migrationslauf (Trockenlauf mit
// Zählung, dann Ausführung) repariert genau das. K3 pinnt die Wiederholbarkeit.
import { describe, expect, it } from "vitest";
import {
  assembleServices,
  buildApp,
  buildServices,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  type KoSearchProjection,
  KoService,
  SEARCH_PROJECTION_VERSION,
  buildSearchProjection,
  matchEffectiveSearchDocument,
  parseClassificationSnapshot,
} from "../../services/knowledge-object";
import {
  bodytextNachziehen,
  exitCodeFuer,
  zaehleBetroffene,
} from "../../tools/bodytext-nachziehen";

// Das Prüfwort steht AUSSCHLIESSLICH im bodyHtml (D1 §2). K1 sichert das mit eigenen Expects ab.
const FLIESSTEXTWORT = "Splitterschutzverriegelung";
const BODY_HTML = `<h2>Kapitel 4 — Schutzeinrichtungen</h2><p>Die ${FLIESSTEXTWORT} wird vor jedem
Schichtbeginn auf freien Lauf geprüft und erst nach dem Prüfvermerk wieder freigegeben.</p>`;
const TITEL = "BAADER Wartungshandbuch Kapitel 4";
const KERNAUSSAGE = "Schutzeinrichtungen vor Schichtbeginn nach Handbuch prüfen.";

describe("JOB 2614 · Suchtext-Kette: Import → bodyText → Suche → belegte Antwort", () => {
  it("K1 — der echte Importweg füllt bodyText sofort (Fassung 2), und die Frage findet die Stelle", async () => {
    const services = buildServices();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@job2614.test", password: "geheim12345" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@job2614.test", password: "geheim12345" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };

    // GLIED 1 · IMPORT — exakt die Form, die das Word-Add-in sendet (draftPostPayload,
    // apps/web/src/lib/wordAddin.ts:1191): title, statement, bodyHtml, origin.
    const draftRes = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: { title: TITEL, statement: KERNAUSSAGE, bodyHtml: BODY_HTML, origin: "word_addin" },
    });
    expect(draftRes.statusCode, draftRes.body).toBe(201);
    const draftId = draftRes.json().id as string;

    // GLIED 2 · ÜBERNAHME — der Mensch vervollständigt die Pflichtfelder und reicht ein
    // (POST /api/drafts/:id/promote mit draftPayload, mergeDraftPayload-Weg aus mega21/22).
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/promote`,
      headers,
      payload: {
        // JOB 3082 (Q3 a): `confidentiality` ist seither ein KO-PFLICHTFELD des Promote — genau
        // das ist der Sinn von „der Mensch vervollständigt die Pflichtfelder". Ohne sie antwortet
        // die Route mit 400 INCOMPLETE, und dieser Fall käme nicht bis zur Suchtext-Kette.
        draftPayload: {
          type: "best_practice",
          category: "Wartung",
          neededValidations: 1,
          confidentiality: "intern",
        },
      },
    });
    expect(promote.statusCode, promote.body).toBe(201);
    const koId = promote.json().id as string;

    // GLIED 3 · VALIDIERUNG — die Abnahme verlangt ein VALIDIERTES Dokument (D1 §3 nennt genau
    // diese Reihenfolgefalle: `status='offen'` schlüge die Abnahme auch bei gefülltem Text).
    const rate = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rate.statusCode, rate.body).toBe(200);

    // DER PRÜFFALL TRÄGT (D1 §2): das Wort steht NUR im Fliesstext — nirgendwo sonst.
    const ko = await services.ko.get(koId);
    expect(ko?.title).not.toContain(FLIESSTEXTWORT);
    expect(ko?.statement).not.toContain(FLIESSTEXTWORT);
    expect(ko?.category).not.toContain(FLIESSTEXTWORT);
    expect((ko?.tags ?? []).join(" ")).not.toContain(FLIESSTEXTWORT);
    expect(ko?.bodyHtml).toContain(FLIESSTEXTWORT);

    // GLIED 4 · DIE DATENBANK — die Antwort auf D1s offene Frage: die aktive Projektionszeile ist
    // SOFORT in geltender Fassung, und `bodyText` trägt den extrahierten Fliesstext. Teil 1 des
    // Auftrags ist damit BELEGT gebaut (durch den bestehenden `persistSearchProjection`-Weg), nicht
    // noch einmal gebaut (Regel 4).
    const zeile = await services.ko.searchProjectionOf(koId);
    expect(zeile, "der Import muss sofort eine Projektionszeile schreiben").toBeDefined();
    expect(zeile?.projectionVersion).toBe(SEARCH_PROJECTION_VERSION);
    expect(zeile?.bodyText).toContain(FLIESSTEXTWORT);
    // Und zwar als TEXT, nicht als HTML — die Extraktion hat gearbeitet, nicht kopiert.
    expect(zeile?.bodyText).not.toContain("<p>");

    // GLIED 5 · FRAGE → BELEGTE ANTWORT MIT FUNDSTELLE (die Abnahme aus §5 des Auftrags).
    const ask = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: `Wie wird die ${FLIESSTEXTWORT} geprüft?` },
    });
    expect(ask.statusCode, ask.body).toBe(200);
    const antwort = ask.json();
    expect(antwort.result.answered).toBe(true);
    expect(antwort.result.sources).toContain(koId);
    expect(antwort.result.knowledgeClass).toBe("gesichert");
    expect(antwort.gap).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// Vorrichtung K2/K3 — der Dienststapel mit einem Altbestand EXAKT in Pedis Lage: die
// Projektionszeile trägt Fassung 1 und einen leeren Dokumenttext, obwohl das Objekt `bodyHtml`
// führt (Bauform der V1-Zeile wie tests/ko/g27-welle1-v1-v2-migration.test.ts).
//
// BEWUSST OHNE VORHERIGE AKTIVIERUNG: Unter `V2_ACTIVE` fällt eine nachträglich eingefügte Zeile
// fremder Fassung zu Recht den Integritätsmarker (schreibStempel, search-projection-repo.ts:309-313
// — „Mutation ausserhalb der freigegebenen Generation") und die Suche wird fail-closed. Der echte
// Mischbestand ist aber KEINE nachträgliche Beschädigung, sondern stammt aus der Zeit VOR dem
// V2-Zyklus — und genau so wird er hier hergestellt: Zeilen zuerst, Freigabe danach (in K2 als
// Endabnahme NACH der Reparatur).
// ------------------------------------------------------------------------------------------------
const KO_CREATED_AT = "2026-08-20T08:00:00.000Z";

function altbestand(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "baader-alt-1",
    title: TITEL,
    statement: KERNAUSSAGE,
    bodyHtml: BODY_HTML,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 0,
    trust: 100,
    status: "validiert",
    version: 1,
    originalAuthor: "pedi",
    author: "pedi",
    neededValidations: 1,
    assignments: [],
    createdAt: KO_CREATED_AT,
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

function v1Zeile(objekt: KnowledgeObject): KoSearchProjection {
  return {
    ...buildSearchProjection(objekt, KO_CREATED_AT),
    projectionVersion: 1,
    bodyText: "",
    searchText: `${objekt.title}\n${objekt.statement}\n${objekt.category}`,
    contentHash: "v1-hash",
    classificationSnapshot: parseClassificationSnapshot("", objekt.version),
  };
}

async function bestandsStapel() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const dienst = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: projections,
  });
  const alt = altbestand();
  await repo.insert(alt);
  await projections.insert(v1Zeile(alt));
  return { dienst, alt };
}

// Die Auffindbarkeitsprobe am zusammengesetzten Suchdokument — derselbe Produktweg
// (`effectiveSearchDocumentOf` + `matchEffectiveSearchDocument`), den auch die Suche fährt.
async function findetFliesstextwort(dienst: KoService, id: string): Promise<boolean> {
  const doc = await dienst.effectiveSearchDocumentOf(id);
  expect(doc, "ohne Suchdokument prüft dieser Fall nichts").toBeDefined();
  return (
    matchEffectiveSearchDocument(doc as NonNullable<typeof doc>, [FLIESSTEXTWORT.toLowerCase()]) !==
    undefined
  );
}

describe("JOB 2614 · Bestandsreparatur: Trockenlauf zählt, der Nachzug repariert, die Suche findet", () => {
  it("K2 — GEGENPROBE UND REPARATUR: Fassung 1 findet die Stelle nicht; der Lauf zieht nach, dann trägt sie", async () => {
    const { dienst, alt } = await bestandsStapel();

    // DIE GEGENPROBE (D1 §2, zweite Hälfte): mit der Fassung-1-Zeile findet die Suche das Wort
    // NICHT — Pedis „Keine belastbare Grundlage", hier als Messwert statt als Anekdote.
    expect(await findetFliesstextwort(dienst, alt.id)).toBe(false);

    // TROCKENLAUF (Default des Werkzeugs): nennt die Zahl betroffener KOs und schreibt NICHTS.
    const trocken = await bodytextNachziehen(dienst, { ausfuehren: false });
    expect(trocken.vorher.betroffen).toBe(1);
    expect(trocken.vorher.fassung1).toBe(1);
    expect(trocken.offenV1).toBe(1);
    expect(trocken.reconcile).toBeUndefined();
    expect(trocken.nachher).toBeUndefined();
    expect(trocken.ergebnis).toBe("trockenlauf");
    expect(exitCodeFuer(trocken)).toBe(0);
    // Wirklich nichts geschrieben: die Zeile ist unverändert Fassung 1 mit leerem Text.
    const unveraendert = await dienst.searchProjectionOf(alt.id);
    expect(unveraendert?.projectionVersion).toBe(1);
    expect(unveraendert?.bodyText).toBe("");

    // AUSFÜHRUNG (Testlauf gegen Testdaten, Auftrag §6): der VORHANDENE Nachzug läuft — keine
    // zweite Extraktion. Danach ist die Zeile in geltender Fassung und trägt den Fliesstext.
    const lauf = await bodytextNachziehen(dienst, { ausfuehren: true });
    expect(lauf.reconcile?.differenz).toBe(0);
    expect(lauf.nachher?.betroffen).toBe(0);
    expect(lauf.ergebnis).toBe("vollstaendig");
    expect(exitCodeFuer(lauf)).toBe(0);
    const repariert = await dienst.searchProjectionOf(alt.id);
    expect(repariert?.projectionVersion).toBe(SEARCH_PROJECTION_VERSION);
    expect(repariert?.bodyText).toContain(FLIESSTEXTWORT);

    // DIE KETTE SCHLIESST: dieselbe Probe, die eben leer ausging, findet jetzt die Stelle …
    expect(await findetFliesstextwort(dienst, alt.id)).toBe(true);

    // … und die ENDABNAHME trägt: der nachgezogene Bestand besteht die volle Freigabe (alle fünf
    // Gate-Prüfungen), und die freigegebene Suche liefert den Treffer über den Fliesstext.
    const { readiness } = await dienst.activateSearchProjectionV2();
    expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
    const treffer = await dienst.findSearchHits({ terms: [FLIESSTEXTWORT.toLowerCase()] });
    expect(treffer.map((t) => t.koId)).toEqual([alt.id]);
  });

  it("K3 — WIEDERHOLBAR: nach der Reparatur meldet der Trockenlauf null Betroffene, der zweite Lauf ist ein No-op", async () => {
    const { dienst } = await bestandsStapel();
    await bodytextNachziehen(dienst, { ausfuehren: true });

    expect((await zaehleBetroffene(dienst)).betroffen).toBe(0);
    const zweiter = await bodytextNachziehen(dienst, { ausfuehren: true });
    expect(zweiter.vorher.betroffen).toBe(0);
    expect(zweiter.reconcile?.nachgezogen).toBe(0);
    expect(zweiter.nachher?.betroffen).toBe(0);
  });

  it("K4 — KALIBRIERUNG DER ZÄHLUNG: ein frisch angelegtes Objekt zählt nie als betroffen", async () => {
    const { dienst } = await bestandsStapel();
    await dienst.create({
      title: "Frisch angelegtes Wissen",
      statement: "Ohne das Prüfwort.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: "<p>Neuer Fliesstext ohne Altlast.</p>",
    });

    // Ohne diesen Fall wäre K2 auch grün, wenn die Zählung schlicht ALLES als betroffen meldete.
    const zaehlung = await zaehleBetroffene(dienst);
    expect(zaehlung.kos).toBe(2);
    expect(zaehlung.betroffen).toBe(1);
  });
});

// ================================================================================================
// R-1410 (BEFUND 19) — DER FEHLERFALL, DEN DER NORMALWEG NICHT ERFASST
// ================================================================================================
//
// Eine Zeile in GELTENDER Fassung mit leerem Text, obwohl das Objekt `bodyHtml` trägt: für den
// Nachzug (`missingActive`) ist sie erledigt, `ensureSearchArtifacts` lässt sie append-only stehen.
// Vorher stand der Rest nur im Bericht und das Werkzeug endete mit 0. Jetzt bindet die Gegenprobe
// das Ergebnis: Rest → „rest" und Exit 1; erst der ausdrückliche Rebuild schliesst den Fall.
describe("R-1410 · der Normalweg lässt einen Rest — das Werkzeug meldet ihn als Fehlschlag", () => {
  async function leerInGeltenderFassung() {
    const repo = new InMemoryKoRepo();
    const projections = new InMemoryKoSearchProjectionRepo(repo);
    const dienst = new KoService({
      repo,
      versions: new InMemoryKoVersionRepo(),
      searchProjections: projections,
    });
    const alt = altbestand({ id: "leer-in-v2" });
    await repo.insert(alt);
    await projections.insert({
      ...buildSearchProjection(alt, KO_CREATED_AT),
      bodyText: "",
      contentHash: "leer-hash",
    });
    return { dienst, alt };
  }

  it("Trockenlauf sagt den Rest voraus; der Nachzug endet mit „rest“ und Exit 1; der Rebuild schliesst ihn", async () => {
    const { dienst, alt } = await leerInGeltenderFassung();
    expect((await dienst.searchProjectionOf(alt.id))?.projectionVersion).toBe(
      SEARCH_PROJECTION_VERSION,
    );

    const trocken = await bodytextNachziehen(dienst, { ausfuehren: false });
    expect(trocken.vorher.leerTrotzBodyHtml).toBe(1);
    expect(trocken.nichtErfasst).toBe(1);
    expect(exitCodeFuer(trocken)).toBe(0);
    // Mit --rebuild sagt der Trockenlauf keinen Rest voraus — der Rebuild erfasst die Sorte.
    const mitRebuild = await bodytextNachziehen(dienst, { ausfuehren: false, rebuild: true });
    expect(mitRebuild.nichtErfasst).toBe(0);

    // DER NORMALWEG: die Zeile bleibt leer — und das Werkzeug sagt das nicht mehr nur im Bericht.
    const lauf = await bodytextNachziehen(dienst, { ausfuehren: true });
    expect(lauf.nachher?.leerTrotzBodyHtml).toBe(1);
    expect((await dienst.searchProjectionOf(alt.id))?.bodyText).toBe("");
    expect(lauf.nichtErfasst).toBe(1);
    expect(lauf.ergebnis).toBe("rest");
    expect(exitCodeFuer(lauf)).toBe(1);

    // DIE ESKALATION: der ausdrückliche Rebuild füllt den Text; die Gegenprobe zählt null.
    const rebuild = await bodytextNachziehen(dienst, { ausfuehren: true, rebuild: true });
    expect(rebuild.nachher?.betroffen).toBe(0);
    expect(rebuild.ergebnis).toBe("vollstaendig");
    expect(exitCodeFuer(rebuild)).toBe(0);
    expect((await dienst.searchProjectionOf(alt.id))?.bodyText).toContain(FLIESSTEXTWORT);
  });
});

// ================================================================================================
// JOB 2614 · D4 — DER MENSCHLICHE WEG UND DER NEGATIVTEST (BENs Lücken 1 und 3 aus dem D3-Urteil)
// ================================================================================================
//
// K5 führt einen BAADER-ähnlichen Fassung-1-Altbestand (status='offen', confidentiality NULL,
// bodyText leer) durch GENAU die Folge, die am echten Dokument ansteht: Trockenlauf → Ausführung
// des Werkzeugs → ausdrückliche Validierung → Stufensetzung → Ask-Antwort mit richtiger Quelle
// und konkreter Fundstelle. Der Ask-Weg ist der des Word-Panels: `mode: "retrieval-only"`
// (validatedOnly + retrievalOnly — die Antwort ist die WÖRTLICHE validierte Aussage plus Quellen).
//
// K6 ist der Negativtest der fail-safe-Zusage: `status='offen'` ODER `confidentiality NULL` hält
// den Datensatz TROTZ gefülltem bodyText aus den Antworten heraus; erst nach BEIDEN ausdrücklichen
// Freigaben wird derselbe Datensatz nutzbar. Jede Sperre wird EINZELN gemessen (zwei Objekte),
// die Kalibrierung am Ende belegt, dass die Vorrichtung überhaupt antworten kann.
//
// AUFBAU-REIHENFOLGE, bewusst: Altbestand und V1-Zeilen entstehen VOR dem App-Start
// (UNINITIALIZED — wie Zeilen aus der Zeit vor dem V2-Zyklus); das WERKZEUG repariert und der
// Beweis wird VOR `app.ready()` am Repo gemessen — sonst wäre nicht unterscheidbar, ob die
// Reparatur vom Werkzeug oder vom Aktivierungs-Rebuild des Starts stammt. Der Start findet dann
// einen vollständigen Bestand vor und gibt frei.

const ZWEITWORT = "Kettenradabdeckung";
const BODY_HTML_B = `<p>Die ${ZWEITWORT} wird nur mit entlastetem Antrieb geöffnet.</p>`;

async function menschlicherWegAufbau(mitZweitem: boolean) {
  const repos = inMemoryRepos();
  const projections = new InMemoryKoSearchProjectionRepo(repos.koRepo);
  const altA = altbestand({ status: "offen", trust: 0 } as Partial<KnowledgeObject>);
  await repos.koRepo.insert(altA);
  await projections.insert(v1Zeile(altA));
  let altB: KnowledgeObject | null = null;
  if (mitZweitem) {
    altB = altbestand({
      id: "baader-alt-2",
      title: "BAADER Wartungshandbuch Kapitel 7",
      statement: "Antrieb vor Arbeiten an Abdeckungen entlasten.",
      bodyHtml: BODY_HTML_B,
      status: "offen",
      trust: 0,
    } as Partial<KnowledgeObject>);
    await repos.koRepo.insert(altB);
    await projections.insert(v1Zeile(altB));
  }
  const services = assembleServices(repos, { searchProjections: projections });

  // TROCKENLAUF: nennt die Zahl, schreibt nichts (Beleg: Zeile bleibt Fassung 1, Text leer).
  const trocken = await bodytextNachziehen(services.ko, { ausfuehren: false });
  expect(trocken.vorher.betroffen).toBe(mitZweitem ? 2 : 1);
  expect((await services.ko.searchProjectionOf(altA.id))?.projectionVersion).toBe(1);

  // AUSFÜHRUNG DES WERKZEUGS — und der Beweis VOR dem App-Start: die Reparatur stammt von hier.
  const lauf = await bodytextNachziehen(services.ko, { ausfuehren: true });
  expect(lauf.nachher?.betroffen).toBe(0);
  const repariert = await services.ko.searchProjectionOf(altA.id);
  expect(repariert?.projectionVersion).toBe(SEARCH_PROJECTION_VERSION);
  expect(repariert?.bodyText).toContain(FLIESSTEXTWORT);

  const app = buildApp(services);
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job2614-d4.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@job2614-d4.test", password: "geheim12345" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, services, headers, altA, altB };
}

type App2614 = Awaited<ReturnType<typeof menschlicherWegAufbau>>["app"];
type Headers2614 = { authorization: string };

// Die Frage ist der markierte Satz aus dem Fliesstext — der Weg des Word-Panels (retrieval-only).
async function panelFrage(app: App2614, headers: Headers2614, frage: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers,
    payload: { question: frage, mode: "retrieval-only" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

async function validieren(app: App2614, headers: Headers2614, id: string) {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  expect(res.statusCode, res.body).toBe(200);
}

async function stufeSetzen(app: App2614, headers: Headers2614, id: string) {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "confidentiality", level: "intern" },
  });
  expect(res.statusCode, res.body).toBe(200);
}

describe("JOB 2614 · D4 · K5 — der menschliche Weg: Trockenlauf → Ausführung → Validierung → Stufe → Fundstelle", () => {
  it("führt den BAADER-ähnlichen Altbestand bis zur Antwort mit richtiger Quelle und wörtlicher Fundstelle", async () => {
    const { app, services, headers, altA } = await menschlicherWegAufbau(false);

    // DIE BEIDEN AUSDRÜCKLICHEN FREIGABEN — je über die echte Route, wie ein Mensch sie setzt.
    await validieren(app, headers, altA.id);
    expect((await services.ko.get(altA.id))?.status).toBe("validiert");
    await stufeSetzen(app, headers, altA.id);
    expect((await services.ko.get(altA.id))?.confidentiality).toBe("intern");

    // Der markierte Satz aus dem Fliesstext — das Prüfwort steht NUR dort (K1-Regel gilt weiter).
    const antwort = await panelFrage(app, headers, `Wie wird die ${FLIESSTEXTWORT} geprüft?`);
    expect(antwort.result.answered).toBe(true);
    // DIE RICHTIGE QUELLE …
    expect(antwort.result.sources).toEqual([altA.id]);
    expect(antwort.result.citedSources).toContain(altA.id);
    // … UND DIE KONKRETE FUNDSTELLE: retrieval-only antwortet mit der WÖRTLICHEN validierten
    // Aussage der Quelle — der Antworttext trägt den Wortlaut, die Einstufung reist als evidence.
    expect(String(antwort.result.answer)).toContain(KERNAUSSAGE);
    expect(antwort.result.evidence).toBeDefined();
    expect(antwort.gap).toBeNull();
  });
});

describe("JOB 2614 · K6 — Freigabe des Altbestands für den Word-Antwortweg", () => {
  // Die Klassifizierung und die fachliche Validierung sind zwei eigenständige Bedingungen.
  // Die gemeinsame Egress-Regel isConfidential lässt nur ausdrücklich interne Quellen zu.
  it("verwendet eine validierte Quelle erst nach ihrer ausdrücklichen Einstufung als intern", async () => {
    const { app, headers, altA, altB } = await menschlicherWegAufbau(true);
    const frageA = `Wie wird die ${FLIESSTEXTWORT} geprüft?`;
    const frageB = `Wann darf die ${ZWEITWORT} geöffnet werden?`;

    // (a) DIE BAADER-LAGE NACH DER MIGRATION: offen, keine Stufe — trotz gefülltem bodyText
    // bleibt die Antwort aus. Das ist die Sperre, an der Pedis Dokument HEUTE wirklich hängt.
    const vorher = await panelFrage(app, headers, frageA);
    expect(vorher.result.answered).toBe(false);
    expect(vorher.result.sources).toEqual([]);

    // (b) Die Validierung allein ändert die ungeklärte Stufe des Altbestands nicht.
    await validieren(app, headers, altA.id);
    const detail = await app.inject({ method: "GET", url: `/api/kos/${altA.id}`, headers });
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json()).toMatchObject({
      id: altA.id,
      status: "validiert",
      confidentiality: null,
      confidentialityProvenance: "unknown",
    });
    const nurValidiert = await panelFrage(app, headers, frageA);
    expect(nurValidiert.result.answered).toBe(false);
    expect(nurValidiert.result.sources).toEqual([]);

    // (c) DIE VERTRAULICHKEITS-SPERRE, DIE ES GIBT: ausdrücklich „vertraulich" gesetzt → dasselbe
    // validierte Objekt fällt aus JEDEM Antwortweg (dropConfidential, SCRUM-502).
    const hoch = await app.inject({
      method: "PUT",
      url: `/api/kos/${altA.id}`,
      headers,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);
    const vertraulich = await panelFrage(app, headers, frageA);
    expect(vertraulich.result.answered).toBe(false);
    expect(vertraulich.result.sources).toEqual([]);

    // (d) DIE PRÜFSTAND-SPERRE ALLEIN: altB trägt die Stufe „intern", bleibt aber offen —
    // validatedOnly verwirft es, BEVOR ausgewählt wird (JOB 1591: die Meldung darüber bleibt).
    await stufeSetzen(app, headers, altB?.id ?? "");
    const nurGestuft = await panelFrage(app, headers, frageB);
    expect(nurGestuft.result.answered).toBe(false);
    expect(nurGestuft.result.sources).toEqual([]);

    // (e) KALIBRIERUNG: die ausdrückliche Rückstufung auf „intern" öffnet denselben Datensatz
    // wieder — die Messungen oben maßen also die Sperren, nicht eine stumme Vorrichtung.
    await stufeSetzen(app, headers, altA.id);
    const frei = await panelFrage(app, headers, frageA);
    expect(frei.result.answered).toBe(true);
    expect(frei.result.sources).toEqual([altA.id]);
  });
});
