// ================================================================================================
// A30 — DIE GRENZE DES SUCHRAUMS: WAS SIE IST, UND WER SIE BEWACHT
// ================================================================================================
//
// JOB 612 · D4. Der Auftragstext ist das rote Vollurteil BEN2-PRUEFUNG-JOB-612-D3
// (SHA-256 780ee14b…). Es stellt in Korrekturpflicht 2 eine Alternative auf:
//
//   „Entweder ist vollständige Metadatenprojektion eine harte Suchfreigabe-Invariante und wird
//    durch Backfill/Gate plus Negativtest gesichert, oder nicht projizierter Bestand bleibt
//    zulässig und benötigt ein autorisierungssicher transportiertes Signal bis zur UI."
//
// und benennt in NICHT GEPRÜFT selbst, was zur Entscheidung fehlte:
//
//   „Nicht festgestellt ist, wie viele reale Objekte ohne Metadatenprojektion existieren oder ob
//    ein separates Freigabegate diesen Zustand im Betrieb ausschließt."
//
// GENAU DAS IST HIER GEMESSEN, und die Antwort ist kein Entwurf, sondern der gebaute Zustand:
// das Freigabegate schließt ihn aus, doppelt. `searchProjectionReadiness()` verlangt
// `audit.kos === audit.mitMetadaten` (knowledge-object/src/service.ts:1101) und speist damit
// `alle` (:1151); `finishSearchProjectionBuild()` verweigert `V2_READY` ohne `alle` (:1204), und
// `releaseSearchProjectionVersion()` prüft dieselben fünf Punkte UNTER der Ausschlusssperre noch
// einmal und wirft `SEARCH_PROJECTION_NOT_READY` (:1250-1255). Die zweite Sperre liegt eine Ebene
// tiefer: `findActive` ruft `freigegebeneProjektion()` VOR jeder Leermengen-Entscheidung
// (search-projection-repo.ts:691) — eine nicht suchbereite Instanz wirft, statt ein unehrliches
// „nichts gefunden" zu melden.
//
// FOLGE FÜR DIE ALTERNATIVE: der POSITIVZWEIG ist der gebaute Zielweg. Was ihm fehlte, ist der vom
// Urteil ausdrücklich verlangte NEGATIVTEST — Teil B dieser Datei. Der Negativzweig
// („nicht projizierter Bestand bleibt zulässig") hat keine erreichbare Vorbedingung: es gibt
// keinen Betriebszustand, in dem ein sichtbarer, nicht projizierter Beitrag über die Suche
// erreichbar wäre. Deshalb wird hier kein Signalfeld gebaut und kein sichtbarer Wortlaut gezeigt —
// Korrekturpflicht 4 bindet den Wortlaut wörtlich an den Nachweis, dass ein solcher Beitrag
// existiert, und dieser Nachweis misslingt.
//
// WAS DIESE DATEI DESHALB IST, in drei Teilen:
//   A  Regressionsschutz der DREIGLIEDRIGEN ODER-Bedingung (Inhalt · Kategorie · Schlagwort) am
//      Suchdokument. D3 hat hier fünf Fälle gepinnt; sie bleiben — mit EINER Korrektur: A3 pinnt
//      den Nulltreffer ohne Metadatenzeile NICHT mehr als hinnehmbaren Endzustand (das war der
//      „Scheinbeleg" aus SUBSTANZURTEIL 2), sondern als den Zustand, den Teil B als
//      freigabesperrend nachweist.
//   B  Der NEGATIVTEST der Freigabe-Invariante: unvollständige Metadatenprojektion sperrt die
//      Freigabe, der Backfill repariert sie, und im Bau antwortet die Suche nicht mit Leere.
//   C  Der tatsächliche NUTZERVERTRAG am echten HTTP-Weg (GET /api/library/search): regulärer
//      Schlagworttreffer, unsichtbarer Beitrag, echter Nulltreffer, unveränderte Wireform.
//
// ANTI-VAKUUM: jeder sperrende Fall hat seine Kalibrierung unmittelbar daneben (A5, B2, B4, C1) —
// ein Test, der nur verbietet, ist von einem kaputten Aufbau nicht zu unterscheiden.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
  METADATA_REVISION_NONE,
  matchEffectiveSearchDocument,
} from "../../services/knowledge-object";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

// ------------------------------------------------------------------------------------------------
// Vorrichtung A/B — der Dienststapel, in Betrieb genommen wie eine echte Installation.
// ------------------------------------------------------------------------------------------------
// Eine frische Instanz steht auf `UNINITIALIZED` und ist NICHT suchbereit (Entscheidung 05 §1).
// Der Stapel fährt deshalb die vorgeschriebene Folge UNINITIALIZED → V2_BUILDING → V2_READY →
// V2_ACTIVE über den Produktweg — keine Abkürzung am Gate vorbei, die fünf Prüfungen laufen.
async function stapel() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: projections,
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  return { repo, projections, ko };
}

const EINGABE = {
  title: "Spezialpresse SPX9",
  statement: "Kurzfassung ohne die Prüfwörter.",
  type: "best_practice" as const,
  author: "anna",
};

// ================================================================================================
// TEIL A — DIE DREIGLIEDRIGE ODER-BEDINGUNG (Regressionsschutz)
// ================================================================================================
//
// `matchEffectiveSearchDocument` prüft seit G27 Welle 1 DREI Glieder statt einem: `searchText`
// deckt nur die revisionsgebundenen Inhaltsteile ab, Kategorie und Schlagwörter stehen daneben
// (effective-search-document.ts:124-127). Fällt eines weg, verschwindet eine ganze Suchdimension
// still — die Fälle hier beißen einzeln dagegen.
//
// Das Suchdokument kommt aus dem PRODUKTWEG (`effectiveSearchDocumentOf`), nicht aus einer
// handgebauten Attrappe: eine Attrappe könnte den Feldvertrag der Projektion nicht mitführen und
// bliebe grün, wenn er sich änderte.

describe("A30 · Teil A · der Suchraum hat drei Glieder, und jedes trägt allein", () => {
  it("A1 — ein Treffer NUR in der Kategorie erzeugt einen Treffer (matched.category)", async () => {
    const { ko } = await stapel();
    const erstellt = await ko.create({
      ...EINGABE,
      category: "Kategoriewortalpha",
      tags: ["Schlagwortalpha"],
    });
    const doc = await ko.effectiveSearchDocumentOf(erstellt.id);
    expect(doc, "ohne Suchdokument prüft dieser Fall nichts").toBeDefined();

    const treffer = matchEffectiveSearchDocument(doc as NonNullable<typeof doc>, [
      "kategoriewortalpha",
    ]);

    expect(treffer?.koId).toBe(erstellt.id);
    expect(treffer?.matched.category).toBe(true);
    expect(treffer?.matched.tag).toBe(false);
    // Der Begriff steht NICHT im Inhalt — sonst wiese der Fall das Kategorieglied gar nicht nach.
    expect((doc as NonNullable<typeof doc>).searchText.toLowerCase()).not.toContain(
      "kategoriewortalpha",
    );
  });

  it("A2 — ein Treffer NUR im Schlagwort erzeugt einen Treffer (matched.tag)", async () => {
    const { ko } = await stapel();
    const erstellt = await ko.create({
      ...EINGABE,
      category: "Kategoriewortalpha",
      tags: ["Schlagwortalpha"],
    });
    const doc = await ko.effectiveSearchDocumentOf(erstellt.id);

    const treffer = matchEffectiveSearchDocument(doc as NonNullable<typeof doc>, [
      "schlagwortalpha",
    ]);

    expect(treffer?.koId).toBe(erstellt.id);
    expect(treffer?.matched.tag).toBe(true);
    expect(treffer?.matched.category).toBe(false);
    expect((doc as NonNullable<typeof doc>).searchText.toLowerCase()).not.toContain(
      "schlagwortalpha",
    );
  });

  it("A3 — OHNE Metadatenzeile fällt die Kategorie-/Schlagwortsuche aus; genau diesen Zustand sperrt Teil B vor der Freigabe", async () => {
    const { projections, ko } = await stapel();
    const erstellt = await ko.create({
      ...EINGABE,
      category: "Kategoriewortalpha",
      tags: ["Schlagwortalpha"],
      bodyHtml: "<p>Inhaltswortalpha</p>",
    });

    await projections.metadata.remove(erstellt.id);
    const doc = await ko.effectiveSearchDocumentOf(erstellt.id);

    // Die ehrliche Aussage der Zusammensetzung: leere Felder UND Revision 0 — daran ist „noch nicht
    // projiziert" von „projiziert, aber ohne Kategorie" eindeutig unterscheidbar
    // (effective-search-document.ts:98-100).
    expect((doc as NonNullable<typeof doc>).categoryText).toBe("");
    expect((doc as NonNullable<typeof doc>).tagText).toBe("");
    expect((doc as NonNullable<typeof doc>).metadataRevision).toBe(METADATA_REVISION_NONE);
    expect(
      matchEffectiveSearchDocument(doc as NonNullable<typeof doc>, ["kategoriewortalpha"]),
    ).toBeUndefined();

    // DIESE ZEILE IST DER UNTERSCHIED ZU D3. Der Zustand wird hier NICHT als hinnehmbarer
    // Endzustand festgeschrieben — er ist der Zustand, den B1/B3 als freigabesperrend und B4 als
    // reparabel nachweisen. Das Objekt trägt die Kategorie autoritativ weiter; nur die Projektion
    // fehlt, und genau deshalb darf eine solche Instanz nicht suchbereit gemeldet werden.
    expect((await ko.get(erstellt.id))?.category).toBe("Kategoriewortalpha");
  });

  it("A4 — matched.body bleibt ABGELEITET: getroffen, aber in keinem Kurzfeld", async () => {
    const { ko } = await stapel();
    const erstellt = await ko.create({
      ...EINGABE,
      category: "Kategoriewortalpha",
      tags: ["Schlagwortalpha"],
      bodyHtml: "<p>Inhaltswortalpha steht nur im Dokumenttext.</p>",
    });
    const doc = await ko.effectiveSearchDocumentOf(erstellt.id);

    const treffer = matchEffectiveSearchDocument(doc as NonNullable<typeof doc>, [
      "inhaltswortalpha",
    ]);

    expect(treffer?.matched).toEqual({
      title: false,
      statement: false,
      category: false,
      tag: false,
      caption: false,
      body: true,
    });
  });

  it("A5 — KALIBRIERUNG: ohne Metadatenzeile bleibt der INHALTSTREFFER bestehen", async () => {
    const { projections, ko } = await stapel();
    const erstellt = await ko.create({
      ...EINGABE,
      category: "Kategoriewortalpha",
      bodyHtml: "<p>Inhaltswortalpha</p>",
    });
    await projections.metadata.remove(erstellt.id);
    const doc = await ko.effectiveSearchDocumentOf(erstellt.id);

    // Ohne diesen Fall wäre A3 auch dann grün, wenn die Zusammensetzung gar nichts mehr fände.
    expect(
      matchEffectiveSearchDocument(doc as NonNullable<typeof doc>, ["inhaltswortalpha"])?.koId,
    ).toBe(erstellt.id);
  });
});

// ================================================================================================
// TEIL B — DER NEGATIVTEST DER FREIGABE-INVARIANTE (Korrekturpflicht 2, Positivzweig)
// ================================================================================================
//
// Die Alternative des Urteils verlangt für den Positivzweig ausdrücklich „Backfill/Gate plus
// Negativtest". Gate und Backfill sind gebaut; hier steht der fehlende Negativtest — und zwar an
// den drei Stellen, an denen die Invariante trägt oder gar nicht trägt.

describe("A30 · Teil B · unvollständige Metadatenprojektion ist ein Freigabehindernis", () => {
  it("B1 — eine fehlende Metadatenzeile macht das Gate unzufrieden und benennt die Zahlen", async () => {
    const { projections, ko } = await stapel();
    const erstellt = await ko.create({ ...EINGABE, category: "Kategoriewortalpha" });

    await projections.metadata.remove(erstellt.id);
    const readiness = await ko.searchProjectionReadiness();

    expect(readiness.konsistenz).toBe(false);
    expect(readiness.alle).toBe(false);
    // Der Befund nennt die Zahlen, nicht nur ein Nein — „warum nicht?" bleibt beantwortbar.
    expect(readiness.befunde.join("; ")).toContain("unvollständige Projektion (1/1 Inhalt, 0/1");
  });

  it("B2 — KALIBRIERUNG: mit vollständiger Projektion ist genau dieselbe Prüfung zufrieden", async () => {
    const { ko } = await stapel();
    await ko.create({ ...EINGABE, category: "Kategoriewortalpha", tags: ["Schlagwortalpha"] });

    const readiness = await ko.searchProjectionReadiness();

    // Ohne diesen Fall belegte B1 nur, dass die Prüfung IMMER unzufrieden ist.
    expect(readiness.konsistenz, readiness.befunde.join("; ")).toBe(true);
    expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  });

  it("B3 — der Bau erreicht V2_READY NICHT, solange eine Metadatenzeile fehlt", async () => {
    const { projections, ko } = await stapel();
    const erstellt = await ko.create({ ...EINGABE, category: "Kategoriewortalpha" });

    // Der eine verbindliche Recovery-Pfad: V2_ACTIVE → FAILED → V2_BUILDING (Entscheidung 08 §1).
    await ko.rollbackSearchProjectionVersion("A30-Negativtest");
    await ko.beginSearchProjectionBuild();
    expect((await ko.searchProjectionControl()).projectionState).toBe("V2_BUILDING");
    await projections.metadata.remove(erstellt.id);

    const { control, readiness } = await ko.finishSearchProjectionBuild();

    // Kein V2_READY, kein FAILED: die Instanz bleibt im Bau und ist wiederholbar (:1188-1206).
    expect(control.projectionState).toBe("V2_BUILDING");
    expect(readiness.konsistenz).toBe(false);
    expect(readiness.alle).toBe(false);
  });

  it("B4 — der Backfill repariert die fehlende Hälfte, und danach trägt die Freigabe wieder", async () => {
    const { projections, ko } = await stapel();
    const erstellt = await ko.create({ ...EINGABE, category: "Kategoriewortalpha" });
    await projections.metadata.remove(erstellt.id);
    expect((await ko.searchProjectionReadiness()).konsistenz).toBe(false);

    await ko.backfillSearchProjections({ limit: 10 });

    // Das ist der Positivzweig in voller Länge: Gate hält an, Backfill zieht nach, Freigabe trägt.
    const readiness = await ko.searchProjectionReadiness();
    expect(readiness.konsistenz, readiness.befunde.join("; ")).toBe(true);
    expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
    expect((await ko.findSearchHits({ terms: ["kategoriewortalpha"] })).map((h) => h.koId)).toEqual(
      [erstellt.id],
    );
  });

  it("B5 — eine nicht suchbereite Instanz WIRFT; sie meldet nie ein unehrliches Nichts-gefunden", async () => {
    const { ko } = await stapel();
    await ko.create({ ...EINGABE, category: "Kategoriewortalpha" });
    await ko.rollbackSearchProjectionVersion("A30-Negativtest");

    // Die zweite Sperre (search-projection-repo.ts:691): die Bereitschaftsprüfung liegt VOR jeder
    // Leermengen-Entscheidung. Stünde sie dahinter, log eine unfertige Instanz über ihre
    // Verfügbarkeit — und genau das wäre der „nicht projizierte, erreichbare Bestand", für den das
    // Urteil ein UI-Signal verlangt. Er ist nicht erreichbar.
    await expect(ko.findSearchHits({ terms: ["kategoriewortalpha"] })).rejects.toMatchObject({
      name: "KoError",
    });
    // Auch die LEERE Anfrage wirft — sonst wäre „zeig den Bestand" die Lücke in der Sperre.
    await expect(ko.findSearchHits({ terms: [] })).rejects.toMatchObject({ name: "KoError" });
  });
});

// ================================================================================================
// TEIL C — DER TATSÄCHLICHE NUTZERVERTRAG (Korrekturpflicht 4/5)
// ================================================================================================
//
// Gemessen am ECHTEN HTTP-Weg, nicht am Dienst darunter: die Zusage gilt dem Menschen an der
// Oberfläche, und die Autorisierung fällt an der Route (library-routes.ts:185-192, `sichtbareFuer`
// über dem SQL-Trim). Der Client daneben (`endpoints.library.search`, api/endpoints.ts:592) und
// die beiden Aufrufer des Hakens (`Library.tsx:338`, `Mobile.tsx:233`) lesen genau das Array, das
// hier gemessen wird — ein Hüllenwechsel wäre für beide brechend (C4).

async function anmelden(app: App, email: string, passwort: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: passwort },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

// Die Vorrichtung legt ihre Konten SELBST an (kein Demo-Seed): der erste registrierte Nutzer wird
// Admin, danach legt der Admin die beiden Experten an (sofort freigegeben).
async function route() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@a30.test", password: "geheim12345" },
  });
  const admin = await anmelden(app, "admin@a30.test", "geheim12345");
  for (const email of ["autor@a30.test", "fremd@a30.test"]) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    autor: await anmelden(app, "autor@a30.test", "geheim12345"),
    fremd: await anmelden(app, "fremd@a30.test", "geheim12345"),
  };
}

async function anlegen(app: App, headers: Auth, payload: Record<string, unknown>): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function suchen(app: App, headers: Auth, q: string) {
  const res = await app.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(q)}`,
    headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return { treffer: res.json() as { id: string; title: string }[], rumpf: res.body };
}

describe("A30 · Teil C · der Suchraum an der Route, für den, der davorsitzt", () => {
  it("C1 — ein Schlagworttreffer kommt über GET /api/library/search beim Nutzer an", async () => {
    const { app, autor } = await route();
    const id = await anlegen(app, autor, {
      title: "Flanschmontage",
      statement: "Kurzfassung ohne das Prüfwort.",
      type: "best_practice",
      category: "Wartung",
      tags: ["Schlagwortalpha"],
    });

    const { treffer } = await suchen(app, autor, "Schlagwortalpha");

    expect(treffer.map((t) => t.id)).toEqual([id]);
  });

  it("C2 — ein UNSICHTBARER Beitrag fehlt vollständig: kein Titel, kein Kerntext, kein Zähler", async () => {
    const { app, autor, fremd } = await route();
    const geheim = await anlegen(app, autor, {
      title: "Vertraulicher Beitrag",
      statement: "Sensibler Kerntext mit Schlagwortalpha im Wort.",
      type: "best_practice",
      category: "Anlage 1",
      tags: ["Schlagwortalpha"],
    });
    const hoch = await app.inject({
      method: "PUT",
      url: `/api/kos/${geheim}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);
    // KALIBRIERUNG in derselben Anfrage: ein sichtbares Objekt mit DEMSELBEN Schlagwort.
    const offen = await anlegen(app, fremd, {
      title: "Offener Beitrag",
      statement: "Alltagswissen, das jeder sehen darf.",
      type: "best_practice",
      category: "Anlage 1",
      tags: ["Schlagwortalpha"],
    });

    const { treffer, rumpf } = await suchen(app, fremd, "Schlagwortalpha");

    expect(treffer.map((t) => t.id)).toEqual([offen]);
    expect(treffer.map((t) => t.id)).not.toContain(geheim);
    // Kein Rest des unsichtbaren Objekts reist mit — auch nicht als Andeutung im Rumpf.
    expect(rumpf).not.toContain("Vertraulicher Beitrag");
    expect(rumpf).not.toContain("Sensibler Kerntext");
    expect(rumpf).not.toContain(geheim);
  });

  it("C3 — ein ECHTER Nulltreffer ist ein leeres Array mit 200, keine Fehlermeldung", async () => {
    const { app, autor } = await route();
    await anlegen(app, autor, {
      title: "Flanschmontage",
      statement: "Kurzfassung ohne das Prüfwort.",
      type: "best_practice",
      category: "Wartung",
      tags: ["Schlagwortalpha"],
    });

    const { treffer } = await suchen(app, autor, "Wortdasesnirgendsgibt");

    expect(treffer).toEqual([]);
  });

  it("C4 — die Wireform ist ein nacktes KnowledgeObject[]; ein Hüllenwechsel bräche beide Aufrufer", async () => {
    const { app, autor } = await route();
    const id = await anlegen(app, autor, {
      title: "Flanschmontage",
      statement: "Kurzfassung ohne das Prüfwort.",
      type: "best_practice",
      category: "Wartung",
      tags: ["Schlagwortalpha"],
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/library/search?q=Schlagwortalpha",
      headers: autor,
    });

    // `Library.tsx:338` und `Mobile.tsx:233` reichen die Antwort direkt als Liste weiter
    // (searchLibrary/windowList). Käme hier eine Hülle `{ items, … }`, wäre das für beide ein
    // stiller Totalausfall der Trefferliste — deshalb steht die Form hier als Vertrag.
    const rumpf = res.json();
    expect(Array.isArray(rumpf)).toBe(true);
    expect((rumpf as { id: string }[])[0]?.id).toBe(id);
    // Und der Treffer trägt weiterhin die Produktfelder, aus denen die Oberfläche ihre Zeile baut.
    expect((rumpf as { title: string; category: string }[])[0]).toMatchObject({
      title: "Flanschmontage",
      category: "Wartung",
    });
  });
});
