// ================================================================================================
// JOB 3093 · M3 „Haben wir das schon?" — DER TREFFER SAGT PRÜFSTAND, VERSION UND FUNDORT.
// ================================================================================================
//
// Pedi (05.09.2026, CODEX-POC-ENTSCHEIDUNG-1): Klara findet den vorhandenen Eintrag — auch wenn er
// noch nicht validiert ist — und zeigt Titel, Prüfstand („noch nicht geprüft"), Version und WO er
// liegt. Pedi (05.09. 12:03, UEBERGABE.md:389): „N1c NEIN (Entwürfe nicht im Kandidatenpool)".
//
// AUSGANGSLAGE (gemessen an HEAD fc4173d): `toResponse` in `check-text-routes.ts` trägt koId,
// koTitle, relation, confidence, method, rationale, koStatus, koCategory — aber weder einen
// Prüfstand in Menschensprache noch die Version noch einen Fundort mit Bibliothekspfad. Das Panel
// müsste sich Status und Ort selbst ausdenken; genau das darf es nicht (Wissenslücke statt
// Erfindung). Vor dieser Runde: F1, F2, F3 rot (`pruefstand`/`fundort`/`version` fehlen).
//
// DER WEG DES PANELS IST DER SITZUNGSWEG: das Aufgabenfenster ruft `/api/check-text` mit
// `credentials: "include"` (Cookie-Sitzung, mega69 M10), nicht mit dem Add-in-Schlüssel. Auf dem
// Sitzungsweg zählt der eingereichte, noch nicht validierte Bestand seit JOB 3020 mit
// (`includeUnvalidated = !istAddon`). Diese Datei fährt deshalb GENAU diesen Weg — an der echten
// Route über `buildApp(buildServices())`, nicht an einem nachgebauten Handler.
//
// DER RUMPF IST DER DES PANELS: Text, `locale`, `source: "transient-document"` UND `title` — der
// Titel nach DERSELBEN Regel, mit der der Word-Erfassungsweg einen Eintrag betitelt
// (`deriveDraftTitleFromSelection`: erste nichtleere Zeile, 60 Zeichen). GEMESSEN an diesem HEAD:
// ohne `title` findet der deterministische Pfad nicht einmal den wortgleichen Absatz, weil
// `lexicalOverlapScore` (services/conflicts/src/duplicate-detect.ts:66-83) einen leeren Titel gegen
// einen vorhandenen als Deckung 0 wertet — die Titelgewichtung 0,30 fehlt dann immer, und 0,70 liegt
// unter der Schwelle 0,85. Mit dem Titel derselben Regel ist der aus Word erfasste Eintrag
// „identisch". Fall K2 hält diese Grenze fest, statt sie zu verschweigen.
//
// ENTWÜRFE sind keine Wissensobjekte (services/capture, `POST /api/drafts`); der Pool der
// Dublettenprüfung entsteht aus Wissensobjekten (`check-text-detection.ts`, `selectPool`). Ein
// Entwurf ist deshalb strukturell draußen — und erst das Einreichen (`/promote`) macht ihn zum
// Wissensobjekt mit Prüfstand „eingereicht". Fall F3 misst beide Hälften dieses Satzes.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// Ein Absatz, wie er in Pedis Word-Dokument steht — und so, wie ihn der Erfassungsweg als Eintrag
// anlegt (Titel = erste Zeile, 60 Zeichen). Die Frage stellt ihn leicht umformuliert.
const ABSATZ =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschließen und der Druck im " +
  "Hydrauliksystem vollständig abzubauen. Erst danach darf die Schutzhaube geöffnet werden.";
const FRAGE_TEXT = ABSATZ.replace("vollständig abzubauen", "ganz abzubauen");
// Kalibrierung: thematisch fremd, gleiche Form — teilt kein Inhaltstoken mit dem Bestand.
const FREMD =
  "Die Buchhaltung schließt das Geschäftsjahr zum einunddreißigsten Dezember ab und testiert " +
  "den Abschluss anschließend beim Wirtschaftsprüfer.";

/** Spiegel von `deriveDraftTitleFromSelection` (taskpane.html): erste nichtleere Zeile, 60 Zeichen. */
function panelTitel(text: string): string {
  const zeile = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (zeile ?? "").slice(0, 60).trim();
}

const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_ADDON_API", "KLARWERK_ADDON_API_KEY"];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
  }
  // Die Route ist nur bei Flag AN registriert (build-app.ts) — wie in der Live-Instanz.
  process.env.KLARWERK_ADDON_API = "1";
  process.env.KLARWERK_ADDON_API_KEY = "s3cr3t-addon-key";
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

type App = ReturnType<typeof buildApp>;

async function angemeldet() {
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
  return { app, headers };
}

/**
 * Legt ein Wissensobjekt so an, wie es aus Word erfasst würde (Titel = erste Zeile), und lässt es
 * OFFEN — das ist der EINGEREICHTE, noch nicht validierte Stand.
 */
async function eingereicht(
  app: App,
  headers: Record<string, string>,
  opts: { titel?: string; statement?: string; kategorie?: string } = {},
): Promise<string> {
  const statement = opts.statement ?? ABSATZ;
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: opts.titel ?? panelTitel(statement),
      statement,
      type: "best_practice",
      category: opts.kategorie ?? "Instandhaltung",
      neededValidations: 1,
    },
  });
  expect(created.statusCode).toBe(201);
  return created.json().id as string;
}

/** Dasselbe, danach validiert (rate up → status „validiert"). */
async function validiert(
  app: App,
  headers: Record<string, string>,
  opts: { kategorie?: string } = {},
): Promise<string> {
  const id = await eingereicht(app, headers, opts);
  const rated = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  expect(rated.statusCode).toBe(200);
  expect(rated.json().status).toBe("validiert");
  return id;
}

/** Ausdrücklich OHNE Titel fragen (nur K2) — `null`, weil `undefined` den Standardwert zöge. */
const OHNE_TITEL = null;

/** Der Rumpf des Panels: Sitzung, Text, Titel derselben Regel, `source: "transient-document"`. */
function habenWirDasSchon(
  app: App,
  headers: Record<string, string>,
  text = FRAGE_TEXT,
  title: string | null = panelTitel(text),
) {
  return app.inject({
    method: "POST",
    url: "/api/check-text",
    headers,
    payload: {
      text,
      locale: "de",
      source: "transient-document",
      ...(title !== OHNE_TITEL ? { title } : {}),
    },
  });
}

type Treffer = {
  koId: string;
  koTitle: string;
  koStatus: string | null;
  koCategory: string | null;
  pruefstand: "validiert" | "eingereicht" | null;
  version: number | null;
  fundort: { kategorie: string | null; bereich: string | null; bibliothekPfad: string };
};

function treffer(res: { json(): { duplicates: Treffer[] } }, koId: string): Treffer {
  const t = res.json().duplicates.find((d) => d.koId === koId);
  expect(t, `das Objekt ${koId} muss als Treffer erscheinen`).toBeDefined();
  return t as Treffer;
}

describe("JOB 3093 · der Treffer trägt Prüfstand, Version und Fundort", () => {
  it("F1 · ein EINGEREICHTER (noch nicht validierter) Eintrag erscheint mit pruefstand 'eingereicht', Version und Fundort", async () => {
    const { app, headers } = await angemeldet();
    const id = await eingereicht(app, headers, { kategorie: "Instandhaltung" });

    const res = await habenWirDasSchon(app, headers);
    expect(res.statusCode).toBe(200);
    const t = treffer(res, id);
    expect(t.pruefstand).toBe("eingereicht");
    // Die Version ist die des Bestands — gelesen am Objekt, nicht erfunden.
    const ko = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
    expect(typeof t.version).toBe("number");
    expect(t.version).toBe(ko.json().version);
    // Der Fundort: Kategorie, der Bereich, unter dem die Bibliothek sie führt, und der Pfad zum
    // Volltext (dieselbe Fläche wie die Bibliothek, `/wissen/:id`).
    expect(t.fundort).toEqual({
      kategorie: "Instandhaltung",
      bereich: "Instandhaltung",
      bibliothekPfad: `/wissen/${id}`,
    });
    // Der rohe Vertrag aus JOB 3020 bleibt daneben unverändert (Web-Anzeige, JOB 3045).
    expect(t.koStatus).toBe("offen");
    expect(t.koCategory).toBe("Instandhaltung");
    // Kein Modell, kein Textabfluss: der Weg des Panels ist der deterministische.
    expect((t as { method?: string }).method).toBe("deterministic");
  });

  it("F2 · ein VALIDIERTER Eintrag trägt pruefstand 'validiert' — derselbe Fundort-Vertrag", async () => {
    const { app, headers } = await angemeldet();
    const id = await validiert(app, headers, { kategorie: "Wartung" });

    const res = await habenWirDasSchon(app, headers);
    expect(res.statusCode).toBe(200);
    const t = treffer(res, id);
    expect(t.pruefstand).toBe("validiert");
    expect(t.fundort.kategorie).toBe("Wartung");
    expect(t.fundort.bereich).toBe("Wartung");
    expect(t.fundort.bibliothekPfad).toBe(`/wissen/${id}`);
    expect(typeof t.version).toBe("number");
  });

  it("F3 · ein ENTWURF erscheint NICHT — erst das Einreichen macht ihn zum Treffer 'eingereicht'", async () => {
    const { app, headers } = await angemeldet();
    // Der Entwurf, wie ihn der Word-Weg anlegt (Titel derselben Regel).
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: panelTitel(ABSATZ),
        statement: ABSATZ,
        type: "best_practice",
        category: "Instandhaltung",
        // Das Einreichen verlangt eine gewählte Stufe (`toKoInput`, capture/src/service.ts:865-873:
        // INCOMPLETE ohne gültige `confidentiality`) — die Wahl, die das Blatt beim Fortsetzen
        // erfragt. Hier gesetzt, weil F3 das Einreichen selbst misst, nicht das Blatt.
        confidentiality: "intern",
      },
    });
    expect(draft.statusCode).toBe(201);
    const draftId = draft.json().id as string;

    // Vorher: derselbe Text, kein Treffer — und der Titel steht nirgends in der Antwort.
    const vorher = await habenWirDasSchon(app, headers);
    expect(vorher.statusCode).toBe(200);
    expect(vorher.json().duplicates).toEqual([]);
    expect(vorher.payload).not.toContain(panelTitel(ABSATZ));

    // Einreichen: aus dem Entwurf wird ein Wissensobjekt (offen = eingereicht).
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/promote`,
      headers,
      payload: {},
    });
    expect(promote.statusCode).toBe(201);
    const koId = promote.json().id as string;

    const nachher = await habenWirDasSchon(app, headers);
    expect(nachher.statusCode).toBe(200);
    const t = treffer(nachher, koId);
    expect(t.pruefstand).toBe("eingereicht");
    expect(t.fundort.bibliothekPfad).toBe(`/wissen/${koId}`);
    expect(typeof t.version).toBe("number");
  });

  it("F4 · Vertraulichkeit unverändert (SCRUM-502): ein vertraulicher eingereichter Eintrag bleibt draußen — auch sein Fundort", async () => {
    const { app, headers } = await angemeldet();
    const id = await eingereicht(app, headers, { kategorie: "Sonderanlage" });
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode).toBe(200);

    const res = await habenWirDasSchon(app, headers);
    expect(res.statusCode).toBe(200);
    expect(res.json().duplicates).toEqual([]);
    expect(res.payload).not.toContain(panelTitel(ABSATZ));
    expect(res.payload).not.toContain("Sonderanlage");
    expect(res.payload).not.toContain(`/wissen/${id}`);
  });

  it("F5 · Dry-Run bleibt: nach der Frage ist NICHTS entstanden (persisted:false, kein Objekt, kein Board)", async () => {
    const { app, headers } = await angemeldet();
    await eingereicht(app, headers);
    const res = await habenWirDasSchon(app, headers);
    expect(res.json().persisted).toBe(false);
    const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(kos.json()).toHaveLength(1);
    const board = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(board.json()).toHaveLength(0);
  });

  it("K1 · Kalibrierung: ein thematisch fremder Text findet NICHTS — die Fundort-Felder erzeugen keinen Treffer", async () => {
    const { app, headers } = await angemeldet();
    await eingereicht(app, headers);
    const res = await habenWirDasSchon(app, headers, FREMD);
    expect(res.statusCode).toBe(200);
    expect(res.json().duplicates).toEqual([]);
  });

  it("K2 · die GRENZE, ehrlich gepinnt: OHNE Titel findet der deterministische Pfad denselben Absatz nicht (Scorer wertet leeren Titel als Deckung 0)", async () => {
    // Das ist KEIN Wunschzustand, sondern der gemessene Stand von services/conflicts (nicht
    // Zielpfad dieses Auftrags). Das Panel schickt deshalb den Titel derselben Regel mit —
    // gemessen in bestand-im-panel-mounted.test.ts. Wird der Scorer eines Tages repariert, wird
    // dieser Fall rot und die Grenze verschwindet aus der Rückgabe — nicht still.
    const { app, headers } = await angemeldet();
    const id = await eingereicht(app, headers);
    const ohne = await habenWirDasSchon(app, headers, ABSATZ, OHNE_TITEL);
    expect(ohne.statusCode).toBe(200);
    expect(ohne.json().duplicates).toEqual([]);
    const mit = await habenWirDasSchon(app, headers, ABSATZ);
    expect(mit.json().duplicates.map((d: Treffer) => d.koId)).toEqual([id]);
  });
});
