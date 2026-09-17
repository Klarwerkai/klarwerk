// ================================================================================================
// JOB 4224 · D5 — DIE EINE KETTE: FRAGE → ANTWORT → BELEG → ORIGINAL → ENTZUG
// ================================================================================================
//
// WAS HIER ECHT IST. Die ganze App (`buildServices`/`buildApp`, Kompositionswurzel
// `services/app/src/build-app.ts`), alle Routen (`/api/ask`, `/api/kos`, `/api/objects/:id`,
// `/api/objects/:id/raw`), der echte `AskService` mit echtem `Reasoner` und echter Rechte- und
// Sichtbarkeitsentscheidung (`services/app/src/sichtbarkeit.ts`), der echte Object-Store. Der
// Transport ist `app.inject` — die Bahn-Sandkiste laesst keinen Horchsocket zu (`listen EPERM`);
// dieselbe Bauform wie `tests/ask-c02/konflikt-flaeche-mounted.test.tsx`.
//
// DER KONTROLLIERTE MODELLADAPTER. An der Stelle, an der im Betrieb die Cloud steht, antwortet in
// diesem Lauf ein ADAPTER (`modelladapter()` unten, angebunden ueber `KLARWERK_LOCAL_LLM_URL`; der
// Port wird nie geoeffnet, der Draht faengt den Aufruf ab). Er ERFINDET NICHTS: er liest die
// nummerierte Quellenliste, die der Server ihm vorlegt (`provider-model.ts`, `grounding`), und
// antwortet mit dem WORTLAUT der Quelle unter der gewaehlten Marke. Auswahl, Grounding,
// Zitatdeckung (`pruefeDeckung`), Rueckfall und Anzeige laufen unveraendert im Produkt.
//
// DAMIT DARF WEDER EINE REALE SEMANTISCHE ANTWORTQUALITAET NOCH EINE MICROSOFT-365-HOST-ABNAHME
// BEHAUPTET WERDEN.
//
// DIE ABLAGE IST HIER DER ANWENDUNGSSPEICHER — UND DAS IST NICHT MEHR DIE GANZE GESCHICHTE.
// Runde 1 und 2 haben an dieser Stelle behauptet, ein PostgreSQL-Lauf sei im Pruefplatz nicht zu
// haben. Das war eine ANNAHME, und sie war falsch: gemessen (Arbeitspruefung 5ba672e5…) faehrt der
// Pruefplatz Testcontainers ohne Skip. Seit Runde 3 gibt es deshalb
// `kette-postgres.integration.test.ts` — DIESELBE Kette, DIESELBEN Helfer, nur mit
// `buildPgServices(pool)` gegen einen echten PostgreSQL-Container (`appAufbauen` nimmt dafuer eine
// Dienste-Fabrik entgegen).
//
// DIESE Datei bleibt bei der Speicherablage, und zwar mit Grund: sie traegt die Faelle, die im TOR
// mitlaufen muessen (`vitest.config.ts` schliesst `**/*.integration.test.ts` aus). Schnell und ohne
// Container im Tor, vollstaendig und mit Container im Integrationslauf — beides steht, keines
// ersetzt das andere.
import type { FastifyInstance } from "fastify";
import { expect } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

/** Die Adresse des kontrollierten Adapters. Loopback, nie geoeffnet — der Draht faengt sie ab. */
export const ADAPTER_URL = "http://127.0.0.1:65529/v1";

export function adapterUmgebungSetzen(): void {
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  process.env.KLARWERK_LOCAL_LLM_URL = ADAPTER_URL;
  process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-job4224-adapter";
  process.env.KLARWERK_LOCAL_LLM_TIMEOUT_MS = "5000";
}

// ================================================================================================
// DER KONTROLLIERTE MODELLADAPTER
// ================================================================================================

/**
 * Die Quelle, die im Grounding unter `[nr]` steht — abgelesen an der Zeile, die der Server WIRKLICH
 * baut (`provider-model.ts`: `[${i + 1}] ${r.title}: ${r.statement}`). Zurueck kommt der Wortlaut
 * der Kernaussage, also genau das, was der Server dem Modell vorgelegt hat.
 */
function quelleUnter(nutzertext: string, nr: number): string | null {
  const marke = `[${nr}] `;
  for (const zeile of nutzertext.split("\n")) {
    if (!zeile.startsWith(marke)) {
      continue;
    }
    const rest = zeile.slice(marke.length);
    const trenner = rest.indexOf(": ");
    if (trenner < 0) {
      return null;
    }
    return rest.slice(trenner + 2).trim();
  }
  return null;
}

/** Die Nutzernachricht eines OpenAI-kompatiblen Chatrumpfs (`model-client.ts`). */
function nutzernachricht(rumpf: string): string {
  try {
    const koerper = JSON.parse(rumpf) as { messages?: { role?: string; content?: unknown }[] };
    const nutzer = (koerper.messages ?? []).find((m) => m.role === "user");
    return typeof nutzer?.content === "string" ? nutzer.content : "";
  } catch {
    return "";
  }
}

export interface Adapterlage {
  /** Wie oft der Adapter GENERIERT hat (nicht: Erreichbarkeits-Pings). */
  generierungen: number;
  /** Was der Adapter zuletzt ausgeliefert hat — fuer ehrliche Fehlermeldungen im Test. */
  zuletzt: string | null;
  /** Die Nutzertexte, die der Server dem Adapter vorgelegt hat. */
  vorlagen: string[];
  /**
   * Ein FREIER Satz hinter dem belegten Wortlaut — also ein Satz, den keine Quelle deckt. Das
   * Produkt verwirft ihn in `pruefeDeckung` („EINE MARKE IST KEIN BELEG") und geht in seinen
   * Rueckfall; genau daran misst Lieferung 3, ob zwei abweichende Quellen zwei bleiben. Ohne
   * diesen Schalter erzwaenge der Adapter immer eine gedeckte Antwort, und der Widerspruchsweg
   * des Produkts liefe in keinem Fall an.
   */
  zusatz: string | null;
}

/**
 * Antwortet OpenAI-kompatibel auf den Aufruf des Adapters.
 *
 * Eine Anfrage OHNE nummerierte Quellenliste ist der Erreichbarkeits-Ping (`provider-model.ts`); er
 * bekommt ein kurzes „bereit". Nur die Generierung baut eine Antwort — aus dem gelieferten
 * Wortlaut, mit der Marke der Quelle. Ohne verwertbare Quelle bleibt der Text LEER; dann sagt das
 * Produkt selbst ehrlich „keine Antwort", statt dass der Adapter etwas erfindet.
 */
export function modelladapter(lage: Adapterlage, rumpf: string): { choices: unknown[] } {
  const nutzer = nutzernachricht(rumpf);
  const istGenerierung = /\n\[1\] /.test(nutzer);
  if (!istGenerierung) {
    return { choices: [{ message: { content: "bereit" } }] };
  }
  lage.generierungen += 1;
  lage.vorlagen.push(nutzer);
  const eins = quelleUnter(nutzer, 1);
  const inhalt = eins ? `${eins} [1]${lage.zusatz ? ` ${lage.zusatz}` : ""}` : "";
  lage.zuletzt = inhalt;
  return { choices: [{ message: { content: inhalt } }] };
}

export function neueAdapterlage(): Adapterlage {
  return { generierungen: 0, zuletzt: null, vorlagen: [], zusatz: null };
}

// ================================================================================================
// DIE APP UND DIE KONTEN
// ================================================================================================

export type App = FastifyInstance;
export type Kopf = Record<string, string>;

export interface Konto {
  email: string;
  kopf: Kopf;
  token: string;
}

let kontozaehler = 0;

async function anmelden(app: App, email: string, kennwort: string): Promise<Konto> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: kennwort },
  });
  expect(res.statusCode, `Anmeldung ${email} gescheitert: ${res.body}`).toBe(200);
  const token = (res.json() as { token: string }).token;
  return { email, token, kopf: { authorization: `Bearer ${token}` } };
}

/**
 * Ein neues Konto ueber den echten Weg: registrieren, freigeben, anmelden.
 *
 * DIE FREIGABE IST KEIN TESTTRICK, sondern das Produktverhalten: nur das ERSTE Konto einer frischen
 * Instanz ist von sich aus freigegeben; jedes weitere antwortet bei der Anmeldung `NOT_APPROVED`
 * (gemessen 16.09. im Cloud-Lauf 4789a272…). Ein Admin gibt es frei
 * (`POST /api/auth/users/:id/approve`) — genau der Weg, den ein Betrieb geht. Ohne `admin` wird
 * nicht freigegeben; das ist der Aufbau des ersten Kontos.
 */
export async function neuesKonto(app: App, name: string, admin?: Konto): Promise<Konto> {
  kontozaehler += 1;
  const email = `job4224-${name}-${kontozaehler}@klarwerk.test`;
  const kennwort = "geheim12345";
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name, email, password: kennwort },
  });
  expect(res.statusCode, `Registrierung ${email} gescheitert: ${res.body}`).toBe(201);
  if (admin) {
    const id =
      (res.json() as { id?: string; user?: { id: string } }).id ??
      (res.json() as { user?: { id: string } }).user?.id;
    expect(id, `die Registrierung von ${email} nennt keine Kennung: ${res.body}`).toBeTruthy();
    const frei = await app.inject({
      method: "POST",
      url: `/api/auth/users/${id}/approve`,
      headers: admin.kopf,
    });
    expect(frei.statusCode, `Freigabe von ${email} gescheitert: ${frei.body}`).toBe(200);
  }
  return anmelden(app, email, kennwort);
}

export interface Aufbau {
  app: App;
  /** Der erste registrierte Mensch — Admin, legt den Bestand an. */
  admin: Konto;
}

/** Die Dienste, die `buildApp` entgegennimmt — Speicherablage ODER PostgreSQL. */
export type Dienste = Parameters<typeof buildApp>[0];

/**
 * `ohneModell` baut dieselbe App OHNE verdrahteten Anbieter — die Lage aus Lieferung 5. Die
 * Umgebung wird nur fuer den Bau abgeraeumt und danach wiederhergestellt: `buildServices()` liest
 * sie EINMAL, beim Bauen (`createReasonerFromEnv`), und ein dauerhaft geloeschter Wert riss jeden
 * spaeteren Fall derselben Datei still mit.
 *
 * `diensteBauen` tauscht die ABLAGE, nicht den Weg: `kette-postgres.integration.test.ts` reicht hier
 * `() => buildPgServices(pool)` herein und faehrt danach dieselbe Kette gegen echtes PostgreSQL.
 * Bewusst eine FABRIK und kein fertiges Objekt — sie muss INNERHALB des Umgebungsfensters oben
 * laufen, weil auch sie den Reasoner aus der Umgebung baut.
 */
export async function appAufbauen(
  ohneModell = false,
  diensteBauen?: () => Dienste,
): Promise<Aufbau> {
  const gemerkt = process.env.KLARWERK_LOCAL_LLM_URL;
  if (ohneModell) {
    // `process.env.X = undefined` schriebe in Node die ZEICHENKETTE „undefined"; die Variable muss
    // wirklich FEHLEN, sonst baut der Reasoner einen Anbieter auf eine unbrauchbare Adresse.
    Reflect.deleteProperty(process.env, "KLARWERK_LOCAL_LLM_URL");
  }
  try {
    const app = buildApp(diensteBauen ? diensteBauen() : buildServices());
    await app.ready();
    const admin = await neuesKonto(app, "admin");
    return { app, admin };
  } finally {
    if (ohneModell && gemerkt !== undefined) {
      process.env.KLARWERK_LOCAL_LLM_URL = gemerkt;
    }
  }
}

// ================================================================================================
// DER BESTAND — EIN FREIGEGEBENER EINTRAG MIT ECHTER QUELLE UND HINTERLEGTEM ORIGINAL
// ================================================================================================

/** Der Inhalt der hinterlegten Originaldatei — der Text, den ein Mensch am Ende lesen koennen muss. */
export const ORIGINALTEXT =
  "Betriebsanweisung XQ42, Abschnitt 4: Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.";
export const ORIGINALNAME = "betriebsanweisung-xq42.txt";
export const ORIGINAL_MIME = "text/plain";

export const QUELLENBEZEICHNUNG = "Betriebsanweisung XQ42 (Abschnitt 4)";
export const BELEGSTELLE = "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.";

export interface Eintrag {
  koId: string;
  /** Die Kennung im Object-Store — die Adresse des Originals. */
  objectId: string;
  titel: string;
  kernaussage: string;
}

function datenUrl(text: string): string {
  return `data:${ORIGINAL_MIME};base64,${Buffer.from(text, "utf8").toString("base64")}`;
}

/**
 * Laedt das Original hoch, legt den Eintrag an, haengt das Original an, verankert die Quelle daran
 * und gibt frei. JEDER Schritt wird auf seinen Statuscode geprueft — ein stillschweigend
 * gescheiterter Aufbau waere ein Test, der nichts misst.
 *
 * WARUM DIE QUELLE IMMER VERANKERT IST (gemessen, Cloud-Lauf c4fd6b01…): auf der ausgelieferten
 * Stufe `search_on_click` laesst `decideExternalAttach` NUR eine Quelle zu, die nachweislich aus
 * dem eigenen Haus stammt — eine Belegstelle aus einem hinterlegten Dokument oder eine Adresse aus
 * dem konfigurierten internen Netz. Eine Quelle OHNE Anker (`unanchored-source`) und eine mit
 * oeffentlicher Web-Adresse (`public-source`) antworten beide mit 403. Der Aufbau folgt dem, statt
 * die Stufe zu verstellen: was das Produkt im Auslieferungszustand nicht zulaesst, wird hier auch
 * nicht hergestellt. Die beiden uebrigen Zweige der Ableitung (Adresse, Papierreferenz) misst
 * `beleg-fuehrt-zum-original.test.ts` deshalb ausdruecklich an der Ableitung selbst.
 *
 * `ohneQuelle` laesst die Quelle ganz weg — der Eintrag traegt dann nur seinen Anhang. Das ist der
 * Zustand jedes Objekts von vor JOB 4077.
 */
export async function eintragMitOriginal(
  app: App,
  konto: Konto,
  over: {
    titel?: string;
    kernaussage?: string;
    kategorie?: string;
    originaltext?: string;
    ohneQuelle?: boolean;
    quelle?: { label: string; excerpt?: string };
  } = {},
): Promise<Eintrag> {
  const titel = over.titel ?? "Zylinderkopfdichtung XQ42 wechseln";
  const kernaussage = over.kernaussage ?? BELEGSTELLE;
  const hochgeladen = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: konto.kopf,
    payload: {
      name: ORIGINALNAME,
      mime: ORIGINAL_MIME,
      data: datenUrl(over.originaltext ?? ORIGINALTEXT),
      kind: "document",
      purpose: "anchor",
      confidentiality: "intern",
    },
  });
  expect(hochgeladen.statusCode, `Upload gescheitert: ${hochgeladen.body}`).toBe(201);
  const objectId = (hochgeladen.json() as { id: string }).id;

  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: konto.kopf,
    payload: {
      title: titel,
      statement: kernaussage,
      type: "best_practice",
      category: over.kategorie ?? "Betrieb",
      confidentiality: "intern",
      neededValidations: 1,
    },
  });
  expect(angelegt.statusCode, `Anlage gescheitert: ${angelegt.body}`).toBe(201);
  const koId = (angelegt.json() as { id: string }).id;

  const angehaengt = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: konto.kopf,
    payload: {
      action: "attach",
      attachment: { name: ORIGINALNAME, mime: ORIGINAL_MIME, objectId, size: ORIGINALTEXT.length },
    },
  });
  expect(angehaengt.statusCode, `Anhaengen gescheitert: ${angehaengt.body}`).toBe(200);

  if (!over.ohneQuelle) {
    const quelle = over.quelle ?? { label: QUELLENBEZEICHNUNG, excerpt: BELEGSTELLE };
    const verankert = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: konto.kopf,
      payload: {
        action: "add-source",
        source: {
          label: quelle.label,
          ...(quelle.excerpt ? { excerpt: quelle.excerpt } : {}),
          objectId,
        },
      },
    });
    expect(verankert.statusCode, `Quelle anhaengen gescheitert: ${verankert.body}`).toBe(200);
  }

  const freigegeben = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: konto.kopf,
    payload: { action: "admin-validate" },
  });
  expect(freigegeben.statusCode, `Freigabe gescheitert: ${freigegeben.body}`).toBe(200);

  return { koId, objectId, titel, kernaussage };
}

// ================================================================================================
// DIE HANDGRIFFE DER KETTE
// ================================================================================================

export const FRAGE = "Wie wird die Zylinderkopfdichtung XQ42 vor dem Wechsel behandelt?";

export interface Antwortlage {
  status: number;
  answered: boolean;
  answer: string | null;
  sources: string[];
  citedSources: string[];
  verschlossen: { id: string; title: string }[];
  roh: string;
}

export async function fragen(app: App, konto: Konto, frage = FRAGE): Promise<Antwortlage> {
  const res = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers: konto.kopf,
    payload: { question: frage, locale: "de" },
  });
  if (res.statusCode !== 200) {
    return {
      status: res.statusCode,
      answered: false,
      answer: null,
      sources: [],
      citedSources: [],
      verschlossen: [],
      roh: res.body,
    };
  }
  const koerper = res.json() as {
    result: {
      answered: boolean;
      answer: string | null;
      sources: string[];
      citedSources?: string[];
    };
    verschlossen?: { id: string; title: string }[];
  };
  return {
    status: 200,
    answered: koerper.result.answered,
    answer: koerper.result.answer,
    sources: koerper.result.sources,
    citedSources: koerper.result.citedSources ?? [],
    verschlossen: koerper.verschlossen ?? [],
    roh: res.body,
  };
}

/** Der Bestand, wie die Fragenflaeche ihn liest (`useKos()` → `GET /api/kos`). */
export async function kosLesen(app: App, konto: Konto): Promise<Record<string, unknown>[]> {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers: konto.kopf });
  expect(res.statusCode, `KO-Liste gescheitert: ${res.body}`).toBe(200);
  return res.json() as Record<string, unknown>[];
}

export async function objektLesen(app: App, konto: Konto, objectId: string) {
  return app.inject({ method: "GET", url: `/api/objects/${objectId}`, headers: konto.kopf });
}

// ================================================================================================
// DER DRAHT — die EINE Stelle, an der dieser Lauf das Netz ersetzt
// ================================================================================================
//
// Zwei Richtungen, beide begruendet:
//   · ABSOLUT → der kontrollierte Modelladapter. Jede andere absolute Adresse WIRFT; ein stiller
//     Netzweg waere in einem Abnahmelauf genau das, was dieser Auftrag ausschliesst.
//   · RELATIV → die eigene App ueber `app.inject`. Die Bahn-Sandkiste laesst keinen Horchsocket zu.
export interface Draht {
  lage: Adapterlage;
  setzeApp(app: App | null): void;
  setzeCookie(cookie: string | null): void;
  /**
   * EINE Stoerung fuer den naechsten Aufruf dieser Adresse — der Serverfehler „zwischendurch" aus
   * Lieferung 6. Sie wirkt genau einmal und raeumt sich selbst ab; ein dauerhafter Schalter
   * koennte einen spaeteren Fall still mitreissen.
   */
  stoerungEinmal(url: string, status: number): void;
  /** Die relativen Adressen, die ueber den Draht gelaufen sind — fuer Kalibrierungen. */
  aufrufe: { methode: string; url: string; status: number }[];
  abbauen(): void;
}

export function drahtAufbauen(): Draht {
  const vorher = globalThis.fetch;
  const lage = neueAdapterlage();
  const aufrufe: { methode: string; url: string; status: number }[] = [];
  const stoerungen = new Map<string, number>();
  let app: App | null = null;
  let cookie: string | null = null;
  const draht = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (url.startsWith(ADAPTER_URL)) {
      const rumpf = init?.body === undefined || init.body === null ? "" : String(init.body);
      const nutzlast = modelladapter(lage, rumpf);
      return {
        status: 200,
        statusText: "200",
        ok: true,
        json: async () => nutzlast,
        text: async () => JSON.stringify(nutzlast),
      } as unknown as Response;
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      throw new Error(`IN-PROCESS-GRENZE: ${url} wird in diesem Lauf nicht gewaehlt.`);
    }
    if (!app) {
      throw new Error(`Draht ohne App: ${url}`);
    }
    const stoerung = stoerungen.get(url);
    if (stoerung !== undefined) {
      stoerungen.delete(url);
      aufrufe.push({ methode: (init?.method ?? "GET").toUpperCase(), url, status: stoerung });
      const rumpf = JSON.stringify({ error: "SERVER", message: "Dienst kurz weg." });
      return {
        status: stoerung,
        statusText: String(stoerung),
        ok: false,
        text: async () => rumpf,
      } as unknown as Response;
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const methode = (init?.method ?? "GET").toUpperCase();
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    aufrufe.push({ methode, url, status: antwort.statusCode });
    const gesetzt = antwort.headers["set-cookie"];
    const roh = Array.isArray(gesetzt) ? gesetzt[0] : gesetzt;
    if (typeof roh === "string") {
      cookie = roh.split(";")[0] ?? cookie;
    }
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    } as unknown as Response;
  }) as unknown as typeof globalThis.fetch;
  globalThis.fetch = draht;
  const fenster = (globalThis as unknown as { window?: { fetch: unknown } }).window;
  if (fenster) {
    fenster.fetch = draht;
  }
  return {
    lage,
    aufrufe,
    setzeApp: (a) => {
      app = a;
    },
    setzeCookie: (c) => {
      cookie = c;
    },
    stoerungEinmal: (url, status) => {
      stoerungen.set(url, status);
    },
    abbauen: () => {
      globalThis.fetch = vorher;
      if (fenster) {
        fenster.fetch = vorher;
      }
    },
  };
}

export async function originalLesen(app: App, konto: Konto, objectId: string) {
  return app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers: konto.kopf });
}
