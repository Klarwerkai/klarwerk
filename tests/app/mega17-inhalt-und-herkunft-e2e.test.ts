import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// AUFTRAG-mega17 Block A — INHALT UND HERKUNFT, ODER KEINS VON BEIDEM.
//
// DER BEFUND (bens Einordnung, von mir geteilt): mega16 hat die Anhäng-Grenze fail-closed gemacht.
// Die Regel ist richtig. Zwei Arbeitsabläufe daneben sind an ihr zerbrochen — beide nach derselben
// Form: erst Fachinhalt schreiben, dann eine Quelle OHNE Anker nachschieben.
//
//   A-1  AppendToArticleModal: revise (Body des Zielartikels) ZUERST, danach add-source ohne
//        `objectId`. Auf der VORGABE-Stufe `search_on_click` weist die Route den adresslosen
//        Vermerk zu Recht mit 403 ab — die Revision ist da längst persistiert.
//   A-2  Capture, „Aus Dokument ergänzen" an einem noch nicht existierenden Wissensobjekt: der
//        Dokumenttext landet im Beitrag, der Quellenvermerk läuft in ein abgefangenes 403.
//
// Beide Male bleibt zurück: Inhalt ohne Herkunft. Bei einem Produkt, dessen Satz „Beweispflicht
// statt Plausibilität" lautet, ist das der Bruch des Kernvertrags.
//
// DIESE DATEI FÄHRT DIE ECHTEN ROUTEN, auf der AUSGELIEFERTEN Vorgabestufe, ohne die Allowlist
// interner Origins zu setzen (der geschlossene Auslieferungszustand). Je Weg belegt EIN Test
// BEIDES im selben Lauf — den übernommenen Dokumentinhalt UND den Herkunftsvermerk. Daneben steht
// je Weg die GEGENPROBE in der alten Reihenfolge: sie lässt Inhalt ohne Herkunft zurück.

type App = ReturnType<typeof buildApp>;

// Der Dokumenttext, der in den Beitrag übernommen wird, und die Belegstelle dazu. Beide werden
// unten wörtlich gesucht — „irgendein Body" und „irgendeine Quelle" wäre kein Beleg.
const DOKUMENT = "Pruefbericht-2026.pdf";
const UEBERNOMMEN = "Dichtung vor jedem Anlauf auf Rissbildung sichten.";
const BELEGSTELLE = "Abschnitt 4.2: Sichtpruefung der Dichtung vor Anlauf verbindlich.";
const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht 2026").toString("base64")}`;

// Die Allowlist bleibt in dieser Datei ausdrücklich UNGESETZT: ohne Konfiguration ist sie leer,
// jede Adresse ist damit `public` — der Auslieferungszustand, in dem der Befund entstand.
let vorher: string | undefined;
beforeEach(() => {
  vorher = process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
  delete process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
});
afterEach(() => {
  if (vorher === undefined) {
    delete process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
  } else {
    process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = vorher;
  }
});

async function setup() {
  const app = buildApp(buildServices());
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
  const headers = { authorization: `Bearer ${login.json().token}` };
  // Die Stufe wird NICHT gesetzt — DEFAULT_EXTERNAL_KNOWLEDGE_STAGE ist `search_on_click`. Genau
  // die Stufe, auf der beide Wege heute brechen.
  const stage = await app.inject({ method: "GET", url: "/api/external/policy", headers });
  expect(stage.json().stage).toBe("search_on_click");
  return { app, headers };
}

async function createKo(app: App, headers: Record<string, string>, bodyHtml: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf pruefen.",
      type: "best_practice",
      category: "Instandhaltung",
      bodyHtml,
    },
  });
  expect(res.statusCode).toBeLessThan(300);
  return res.json().id as string;
}

// Das Original an GENAU DIESES Wissensobjekt hängen — der Schritt, der den Anker erzeugt. Bewusst
// über die echten Routen: ein direkt in den Bestand geschriebener Anhang würde die Nachschlage-
// Prüfung umgehen, die hier belegt werden soll.
async function ankerAnlegen(app: App, headers: Record<string, string>, koId: string) {
  const obj = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name: DOKUMENT, mime: "application/pdf", data: PDF_DATA_URL },
  });
  expect(obj.statusCode).toBeLessThan(300);
  const objectId = obj.json().id as string;
  const attached = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: {
      action: "attach",
      attachment: { name: DOKUMENT, mime: "application/pdf", objectId },
    },
  });
  expect(attached.statusCode).toBe(200);
  return objectId;
}

function addSource(
  app: App,
  headers: Record<string, string>,
  koId: string,
  source: Record<string, unknown>,
) {
  return app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "add-source", source },
  });
}

function revise(
  app: App,
  headers: Record<string, string>,
  koId: string,
  changes: Record<string, unknown>,
) {
  return app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "revise", changes },
  });
}

async function lesen(app: App, headers: Record<string, string>, koId: string) {
  const res = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
  expect(res.statusCode).toBe(200);
  const ko = res.json() as {
    bodyHtml?: string | null;
    sources?: { label: string; excerpt: string | null; url: string | null }[];
  };
  return { bodyHtml: ko.bodyHtml ?? "", sources: ko.sources ?? [] };
}

describe("A-1 · An bestehenden Artikel anhängen: Anker → Beleg → Inhalt", () => {
  it("auf search_on_click steht danach BEIDES am Artikel — der übernommene Dokumentinhalt UND sein Herkunftsvermerk", async () => {
    const { app, headers } = await setup();
    const koId = await createKo(app, headers, "<p>Bestandstext.</p>");

    // 1. ANKER: das Originaldokument an den ZIEL-Artikel. Dieser Schritt fehlte bis mega16 auf
    //    diesem Weg vollständig — deshalb konnte es keinen Anker geben.
    const objectId = await ankerAnlegen(app, headers, koId);

    // 2. BELEG je Punkt, MIT dem eben entstandenen Anker.
    const quelle = await addSource(app, headers, koId, {
      label: DOKUMENT,
      excerpt: BELEGSTELLE,
      objectId,
    });
    expect(quelle.statusCode).toBe(200);

    // 3. ERST DANN der Inhalt.
    const revidiert = await revise(app, headers, koId, {
      bodyHtml: `<p>Bestandstext.</p><h2>Aus ${DOKUMENT}</h2><p>${UEBERNOMMEN}</p>`,
      statement: "Dichtung vor jedem Anlauf pruefen.",
    });
    expect(revidiert.statusCode).toBe(200);

    const stand = await lesen(app, headers, koId);
    // BEIDES im selben Test, bens ausdrückliche Formulierung:
    expect(stand.bodyHtml).toContain(UEBERNOMMEN); // … der Inhalt ist da …
    expect(stand.sources).toHaveLength(1); // … und seine Herkunft ebenso.
    expect(stand.sources[0]?.label).toBe(DOKUMENT);
    expect(stand.sources[0]?.excerpt).toBe(BELEGSTELLE);
    // Eine Datei-Belegstelle hat keine Adresse — sie wird über den Anker belegt, nicht über eine URL.
    expect(stand.sources[0]?.url).toBeNull();
  });

  it("GEGENPROBE — ohne den Fix bleibt Inhalt ohne Herkunft zurück: die alte Reihenfolge persistiert die Revision und scheitert erst danach am Vermerk", async () => {
    const { app, headers } = await setup();
    const koId = await createKo(app, headers, "<p>Bestandstext.</p>");

    // Die Reihenfolge bis mega16: revise ZUERST …
    const revidiert = await revise(app, headers, koId, {
      bodyHtml: `<p>Bestandstext.</p><h2>Aus ${DOKUMENT}</h2><p>${UEBERNOMMEN}</p>`,
      statement: "Dichtung vor jedem Anlauf pruefen.",
    });
    expect(revidiert.statusCode).toBe(200);

    // … danach der adresslose, ankerlose Vermerk. Die Route weist ihn korrekt ab.
    const quelle = await addSource(app, headers, koId, { label: DOKUMENT, excerpt: BELEGSTELLE });
    expect(quelle.statusCode).toBe(403);
    expect(quelle.json().reason).toBe("unanchored-source");

    const stand = await lesen(app, headers, koId);
    // DAS ist der Befund, im Wortlaut: Inhalt ohne Herkunft bleibt zurück.
    expect(stand.bodyHtml).toContain(UEBERNOMMEN);
    expect(stand.sources).toHaveLength(0);
  });
});

describe("A-2 · Erfassen: Dokumentinhalt in ein noch nicht existierendes Wissensobjekt übernehmen", () => {
  it("auf search_on_click trägt das neue Wissensobjekt BEIDES — den übernommenen Dokumentinhalt UND seinen Herkunftsvermerk", async () => {
    const { app, headers } = await setup();

    // Der Submit legt das Wissensobjekt MIT dem übernommenen Dokumenttext an …
    const koId = await createKo(app, headers, `<h2>Aus ${DOKUMENT}</h2><p>${UEBERNOMMEN}</p>`);

    // … Phase B hängt danach das mitgeführte Dokument an — daraus entsteht der Anker …
    const objectId = await ankerAnlegen(app, headers, koId);

    // … und erst DER geht als `objectId` an den Quellenvermerk. Bis mega16 stand hier `undefined`.
    const quelle = await addSource(app, headers, koId, {
      label: DOKUMENT,
      excerpt: BELEGSTELLE,
      objectId,
    });
    expect(quelle.statusCode).toBe(200);

    const stand = await lesen(app, headers, koId);
    expect(stand.bodyHtml).toContain(UEBERNOMMEN);
    expect(stand.sources).toHaveLength(1);
    expect(stand.sources[0]?.label).toBe(DOKUMENT);
    expect(stand.sources[0]?.excerpt).toBe(BELEGSTELLE);
  });

  it("GEGENPROBE — ohne den Fix bleibt Inhalt ohne Herkunft zurück: das Wissensobjekt wird gespeichert, der ankerlose Vermerk abgewiesen", async () => {
    const { app, headers } = await setup();
    const koId = await createKo(app, headers, `<h2>Aus ${DOKUMENT}</h2><p>${UEBERNOMMEN}</p>`);

    const quelle = await addSource(app, headers, koId, { label: DOKUMENT, excerpt: BELEGSTELLE });
    expect(quelle.statusCode).toBe(403);
    expect(quelle.json().reason).toBe("unanchored-source");

    const stand = await lesen(app, headers, koId);
    expect(stand.bodyHtml).toContain(UEBERNOMMEN);
    expect(stand.sources).toHaveLength(0);
  });

  it("ein ERFUNDENER Anker hilft nicht — der Server schlägt die objectId in der eigenen Anhangsliste nach", async () => {
    const { app, headers } = await setup();
    const koId = await createKo(app, headers, `<p>${UEBERNOMMEN}</p>`);
    // Ein echtes Object, das aber an einem ANDEREN Wissensobjekt hängt: kein Anker für dieses hier.
    const fremdKo = await createKo(app, headers, "<p>Fremd.</p>");
    const fremdObject = await ankerAnlegen(app, headers, fremdKo);

    const quelle = await addSource(app, headers, koId, {
      label: DOKUMENT,
      excerpt: BELEGSTELLE,
      objectId: fremdObject,
    });
    expect(quelle.statusCode).toBe(403);
    expect(quelle.json().reason).toBe("unanchored-source");
    expect((await lesen(app, headers, koId)).sources).toHaveLength(0);
  });
});
