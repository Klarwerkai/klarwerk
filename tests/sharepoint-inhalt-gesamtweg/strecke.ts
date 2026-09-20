// ================================================================================================
// JOB 4295 · DER SHAREPOINT-INHALTSWEG ALS **EINE** STRECKE — einmal beschrieben, zweimal gefahren.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. BEN hat an JOB 4232 R4 genau eine Zeile offen gelassen, wörtlich
// (`archiv/4232/runde-4/ben.md:20`): „NUTZENKETTE: TEILWEISE. Serverweg mit Annahme, Journal-Neustart
// und Wiederholimport besteht; Oberflächenwirkung ist separat montiert gemessen. Der durchgehende
// PostgreSQL-/Chromium-Weg bleibt unbewiesen." Die zwei Hälften sagen das über sich selbst:
//
//   · `tests/sharepoint-inhalt/vorschau-und-ergebnis-montiert.test.tsx:1`  — jsdom, und die
//     Drahtgrenze (`components/sharepoint-import/api.ts`) ist eine Attrappe. Die Datei schreibt
//     selbst: „KEIN durchgehender Browserlauf wird behauptet" (`:14-18`).
//   · `tests/sharepoint-inhalt/weg-am-draht-und-neustart.test.ts:28-29` — „WAS DIESER FALL NICHT
//     BEHAUPTET: keinen Browserlauf …"
//
// Zwischen beiden liegt die Annahme, gegen die diese Strecke gebaut ist: dass die ECHTE `api.ts`
// über eine ECHTE Leitung dasselbe bekommt, was der montierte Fall ihr vorgelegt hat. Ab hier ist
// das kein Schluss mehr, sondern ein Messwert.
//
// ================================================================================================
// DER WEG STEHT GENAU EINMAL HIER — dieselbe Doktrin wie `tests/gast-nutzerweg/browserweg.ts:8-17`.
// ================================================================================================
//
//   · `gesamtweg-im-echten-browser.test.ts`           → Speicherablagen, läuft im Tor.
//   · `gesamtweg-pg-im-browser.integration.test.ts`   → echtes PostgreSQL, eigener Lauf.
//
// Verschieden ist EIN Argument (`pool`); alles andere ist Zeichen für Zeichen derselbe Ablauf. Es
// gibt hier deshalb bewusst KEINE Fallunterscheidung `if (pg)`.
//
// UND ES ENTSTEHT KEIN ZWEITER BROWSERWEG. `browserweg.ts` bleibt die eine Quelle für Chromium-Start
// (`starteChromium`), gebaute Fläche (`mitFlaeche`, `DIST`), Tastaturbedienung (`tastaturAusloesen`,
// `tippeMitTastatur`) und Warten auf sichtbaren Text (`warte`). Diese Datei ruft sie, sie kopiert
// sie nicht.
//
// ================================================================================================
// WAS ECHT IST UND WAS ATTRAPPE — in drei Zeilen, damit es niemand suchen muss.
// ================================================================================================
//
// ATTRAPPE IST AUSSCHLIESSLICH MICROSOFT GRAPH SELBST: die Metadaten-Antworten (über ein ersetztes
// `globalThis.fetch`, wie `weg-am-draht-und-neustart.test.ts:156-186`) und der Inhaltsabruf (über
// den injizierten `inhaltsTransport`, wie dort `:141-154`). Die Auflösung ist ebenfalls injiziert,
// damit aus diesem Lauf keine DNS-Anfrage hinausgeht.
//
// ECHT IST ALLES AB DER ROUTE: `sharepointImportRoutes` → `SharePointSourceAdapter` → Mapper →
// Import-Kern → Prüf-Warteschlange → `GET /api/kos/:id`, ausgeliefert von einer echten
// Fastify-Instanz auf einem ECHTEN Socket (`app.listen({ port: 0 })`), dazu die gebaute Fläche aus
// `apps/web/dist` und ein echter Chromium mit frischem Profil. Die Sitzung trägt über den KEKS,
// nicht über einen Bearer — es gibt hier keine Routenabfangung.
//
// `KLARWERK_SHAREPOINT_BASE_URL` bleibt `https:`, damit der Riegel aus `credential-state.ts:60`
// unverändert greift.
//
// WAS DIESE STRECKE AUSDRÜCKLICH NICHT BEHAUPTET: keinen Lauf gegen einen echten
// Microsoft-365-Mandanten und keinen echten TLS-/Socket-Abbau. Pedis Grenze gilt unverändert:
// „Codeprüfung und simulierte Office-Tests ersetzen keine echte Microsoft-365-Abnahme."
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import { expect } from "vitest";
import { buildApp, buildPgServices, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { sharepointImportRoutes } from "../../services/app/src/routes/sharepoint-import-routes";
import {
  type SharePointInhaltsTransport,
  SharePointSourceAdapter,
} from "../../services/sharepoint";
import { SharePointGraphClient } from "../../services/sharepoint/src/graph-client";
import {
  type Browser,
  type Kontext,
  LIES_TEXT,
  type Seite,
  fn,
  mitFlaeche,
  profil,
  tastaturAusloesen,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, Sitzung, type Strecke } from "../gast-nutzerweg/strecke";

export const JOB = "[KLARWERK] JOB 4295";

// ------------------------------------------------------------------------------------------------
// DAS GRAPH-VERTRAGSDOUBLE. Zwei Dateien genügen für alles, was diese Strecke misst.
// ------------------------------------------------------------------------------------------------
const GRAPH = "https://graph.microsoft.test/v1.0";
export const DOWNLOAD = "https://download.sharepoint.test/vorautorisiert/";
/** Die Adresse, auf die die injizierte Auflösung zeigt — öffentlich, damit die SSRF-Sperre trägt. */
export const AUFGELOEST = "93.184.216.34";

export const GEAENDERT_AM = "2026-09-12T09:15:00Z";
export const QUELLSTAND = Math.floor(Date.parse(GEAENDERT_AM) / 1000);
/**
 * JOB 4360 · DIE ZWEITE FASSUNG DERSELBEN DATEI — jemand hat sie in SharePoint überarbeitet.
 *
 * SPÄTER heisst hier wirklich später: der Mapper rechnet `lastModifiedDateTime` in Sekunden um
 * (`services/sharepoint/src/mapper.ts`, `sharepointQuellstand`), und der Re-Sync des Import-Kerns
 * übernimmt NUR bei `>` (`library-analytics/src/service.ts`, `acceptToKo`). Ein gleicher oder
 * kleinerer Wert wäre also nicht „ein zweiter Import", sondern gar keiner — und der Fall belegte
 * nichts.
 */
export const GEAENDERT_AM_NEU = "2026-09-19T14:20:00Z";
export const QUELLSTAND_NEU = Math.floor(Date.parse(GEAENDERT_AM_NEU) / 1000);
/** Der Text, der am Ende am zurückgelesenen Wissensobjekt stehen MUSS. */
export const TEXT = "ZEILE EINS AUS DER DATEI\nZEILE ZWEI AUS DER DATEI";

/**
 * JOB 4360 · DIE DREI SPRACHEN, die das Haus pflegt — und in denen der Quellstand lesbar sein muss.
 *
 * Deutsch fährt den Hauptweg (dort hängt der Stand an einem wirklich gefahrenen Import); „en" und
 * „nl" werden am selben Objekt, im selben Profil und über dieselbe gebaute Fläche nachgelesen.
 */
export const SPRACHEN = ["de", "en", "nl"] as const;

export const NOTIZ = {
  id: "01NOTIZTXT",
  name: "Wartungsnotiz.txt",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsnotiz.txt",
  lastModifiedDateTime: GEAENDERT_AM,
  size: Buffer.byteLength(TEXT, "utf8"),
  file: { mimeType: "text/plain" },
  lastModifiedBy: { user: { displayName: "R. Schuster" } },
};

/** Ein Typ ohne Inhaltsweg — er bleibt „nur Merkmale". Die Liste zeigt damit ZWEI Aussagen. */
export const ANWEISUNG = {
  id: "01ANWEISUNGDOCX",
  name: "Wartungsanweisung.docx",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsanweisung.docx",
  lastModifiedDateTime: "2026-09-10T08:30:00Z",
  size: 24_576,
  description: "Wartung der Abfüllanlage, Stand September.",
  file: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

const DATEIEN = [NOTIZ, ANWEISUNG];
const BYTES = new Map<string, Buffer>([[NOTIZ.id, Buffer.from(TEXT, "utf8")]]);

/** Die vier Zustände, in denen die Gegenstelle antwortet. `normal` ist der Regelfall. */
export type Graphlage = "normal" | "403" | "404" | "500";

/**
 * Der steuerbare Zustand des Doubles. Er wird vom Test verstellt und NICHT von der Strecke —
 * so bleibt der Ablauf unten frei von Fallunterscheidungen.
 */
export const doppel = {
  lage: "normal" as Graphlage,
  /** Hält den Inhaltsabruf an — nur so ist der LAUFENDE Messzustand deterministisch messbar. */
  halt: null as Promise<void> | null,
  /**
   * §9 · „erfolgreich leer": die Bibliothek antwortet gültig, aber ohne Datei.
   *
   * KEIN Fehler und kein Rechteentzug — genau das ist der Unterschied, den §9 verlangt: die Fläche
   * muss einen BENANNTEN Leersatz zeigen und nicht die Fehlerlage von nebenan.
   */
  leer: false,
  /**
   * JOB 4360 · „die Datei wurde in SharePoint überarbeitet": dieselbe Kennung, SPÄTER geändert.
   *
   * Steht dieser Schalter, meldet das Double für die Notiz `GEAENDERT_AM_NEU` statt `GEAENDERT_AM`
   * — in der LISTE und beim gezielten Abruf, denn der Übernahmeweg liest den Stand aus dem
   * gezielten Abruf (`sharepoint-import-routes.ts`, `adapter.holeItem`). Stünde er nur an einer der
   * beiden Stellen, zeigte die Liste etwas anderes, als der Import übernimmt.
   *
   * KEINE ZWEITE DATEI, KEINE ZWEITE KENNUNG: gerade das ist der Fall — dieselbe Quelle in einer
   * neueren Fassung. Eine zweite Kennung wäre eine Erstanlage und bewiese über den Re-Sync nichts.
   */
  neuerStand: false,
  /**
   * §9 · „Cache mit laufender Auffrischung": hält die LISTENantwort an (nicht den Inhaltsabruf).
   *
   * Nur mit einer angehaltenen Auffrischung ist der Zwischenzustand deterministisch messbar statt
   * erwischt — dieselbe Begründung wie bei `halt` für die Inhaltsmessung.
   */
  listenHalt: null as Promise<void> | null,
  graphAufrufe: [] as string[],
  downloadAufrufe: [] as { url: string; adresse: string }[],
  /** Jeder Aufruf, der weder an das Graph-Double noch an den eigenen Socket ging. Muss leer sein. */
  fremdeAufrufe: [] as string[],
};

/**
 * JOB 4360 · Die Datei, wie das Double sie JETZT meldet — mit dem eingestellten Änderungsstand.
 *
 * Betroffen ist AUSSCHLIESSLICH die Notiz: die Anweisung (`ANWEISUNG`) bleibt unverändert, damit
 * der Wiederholimport genau einen neueren Stand bringt und nicht zwei. Die Umstellung geschieht
 * HIER und an einer Stelle, weil Liste und gezielter Abruf dieselbe Datei zeigen müssen.
 */
function mitStand(datei: {
  id: string;
  lastModifiedDateTime: string;
}): Record<string, unknown> {
  return doppel.neuerStand && datei.id === NOTIZ.id
    ? { ...datei, lastModifiedDateTime: GEAENDERT_AM_NEU }
    : { ...datei };
}

const transportDouble: SharePointInhaltsTransport = async (url, optionen) => {
  doppel.downloadAufrufe.push({ url, adresse: optionen.adresse });
  if (!url.startsWith(DOWNLOAD)) {
    doppel.fremdeAufrufe.push(url);
    throw new Error(`${JOB}: unerlaubter Inhaltsabruf im Test: ${url}`);
  }
  if (doppel.halt) {
    await doppel.halt;
  }
  if (doppel.lage === "403") {
    return { status: 403, bytes: null };
  }
  const bytes = BYTES.get(decodeURIComponent(url.slice(DOWNLOAD.length)));
  return bytes === undefined ? { status: 404, bytes: null } : { status: 200, bytes };
};

let echtesFetch: typeof fetch | null = null;

/**
 * Das Netz dieses Laufs: NUR das Graph-Double und der EIGENE Socket.
 *
 * Der eigene Socket muss durch — über ihn läuft die Ersteinrichtung (`Sitzung.sende` aus
 * `tests/gast-nutzerweg/strecke.ts` spricht mit `fetch`). Er ist Loopback und damit kein fremdes
 * Ziel; alles andere landet in `fremdeAufrufe` UND wirft. Die Seiten im Browser gehen ohnehin nicht
 * durch dieses `fetch`, sondern durch Chromium.
 */
export function spanneNetzAuf(): void {
  if (echtesFetch !== null) {
    return;
  }
  echtesFetch = globalThis.fetch;
  const durchreichen = echtesFetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (url.startsWith("http://127.0.0.1:")) {
      return durchreichen(eingabe as Parameters<typeof fetch>[0], init);
    }
    if (!url.startsWith(`${GRAPH}/`)) {
      doppel.fremdeAufrufe.push(url);
      throw new Error(`${JOB}: unerlaubter Aufruf im Test: ${url}`);
    }
    doppel.graphAufrufe.push(url);
    if (doppel.lage === "403") {
      return new Response(JSON.stringify({ error: { code: "accessDenied" } }), { status: 403 });
    }
    if (doppel.lage === "404") {
      return new Response(JSON.stringify({ error: { code: "itemNotFound" } }), { status: 404 });
    }
    if (doppel.lage === "500") {
      return new Response(JSON.stringify({ error: { code: "serviceNotAvailable" } }), {
        status: 503,
      });
    }
    const treffer = /\/items\/([^/?]+)/.exec(url);
    if (treffer) {
      const datei = DATEIEN.find((d) => d.id === decodeURIComponent(treffer[1] ?? ""));
      if (!datei) {
        return new Response(JSON.stringify({ error: { code: "itemNotFound" } }), { status: 404 });
      }
      return new Response(
        JSON.stringify({
          ...mitStand(datei),
          // Die vorautorisierte Adresse kommt NUR beim gezielten Abruf mit — die Liste bekommt keine.
          ...(url.includes("downloadUrl")
            ? { "@microsoft.graph.downloadUrl": `${DOWNLOAD}${encodeURIComponent(datei.id)}` }
            : {}),
        }),
        { status: 200 },
      );
    }
    // DIE LISTE — und nur sie kennt die beiden §9-Stellschrauben. Der Halt steht HIER und nicht
    // weiter oben, damit der gezielte Inhaltsabruf (`/items/…`) von ihm unberührt bleibt: sonst
    // hinge an einer angehaltenen Auffrischung auch die Messung, und der Zwischenzustand wäre
    // wieder zwei Sachen auf einmal.
    if (doppel.listenHalt) {
      await doppel.listenHalt;
    }
    return new Response(
      JSON.stringify({ value: doppel.leer ? [] : DATEIEN.map((d) => mitStand(d)) }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

export function raeumeNetzAb(): void {
  if (echtesFetch !== null) {
    globalThis.fetch = echtesFetch;
    echtesFetch = null;
  }
}

// ================================================================================================
// DIE ANWENDUNG DIESES LAUFS — und warum sie ihre Route selbst registriert.
// ================================================================================================
//
// DIESELBE BEGRÜNDUNG WIE IN `weg-am-draht-und-neustart.test.ts:192-215`, nur mit Socket und Fläche:
// `build-app.ts` baut den SharePoint-Adapter aus der Umgebung und kennt keine Injektion. Ohne
// Injektion ginge der Inhaltsweg an ein ECHTES Netz (er baut seine Verbindung selbst auf,
// `graph-client.ts:695`, und ein global ersetztes `fetch` erreicht ihn nicht mehr). Das darf er
// nicht. Also:
//
//   · Der Schalter steht beim BAU DER DIENSTE — nur so schreibt der Import-Kern den Herkunfts-Anker
//     (`build-app.ts:766`, `externalImportEnabled`).
//   · Beim BAU DER APP ist er für genau diesen einen synchronen Aufruf aus — dann registriert
//     `buildApp` die SharePoint-Route NICHT (`build-app.ts:2796`: „Schalter aus, Route existiert
//     nicht"), und es gibt sie nicht zweimal.
//   · UNMITTELBAR DANACH ist er wieder an, denn die Zugangs-Auskunft liest ihn zur LAUFZEIT
//     (`feature-flags.ts:174`, `schalterAn`). Stünde er dann auf aus, meldete
//     `GET /api/import/sharepoint/zugang` „in dieser Installation nicht eingeschaltet", und die
//     Fläche böte gar keine Dateiliste an.
//   · Und dieser Lauf registriert GENAU DIESELBE Route selbst, mit denselben echten Abhängigkeiten
//     — nur der Adapter trägt die drei Vorrichtungen (Metadaten, Inhalt, Auflösung).
export async function starteAnwendung(opts: { pool?: Pool } = {}): Promise<Strecke> {
  process.env.KLARWERK_SHAREPOINT_IMPORT = "1";
  process.env.KLARWERK_SHAREPOINT_BASE_URL = GRAPH;
  process.env.KLARWERK_SHAREPOINT_TOKEN = "vertragsdouble-nur-fuer-den-test-4295";
  process.env.KLARWERK_SHAREPOINT_DRIVE = "b!testbibliothek";

  const services = opts.pool ? buildPgServices(opts.pool) : buildServices();
  process.env.KLARWERK_SHAREPOINT_IMPORT = "";
  const app = buildApp(services);
  process.env.KLARWERK_SHAREPOINT_IMPORT = "1";

  app.register(
    sharepointImportRoutes({
      library: services.library,
      guards: makeGuards(services.auth),
      importRuns: services.importRuns,
      makeAdapter: () =>
        new SharePointSourceAdapter(
          new SharePointGraphClient({
            baseUrl: GRAPH,
            accessToken: "vertragsdouble-nur-fuer-den-test-4295",
            driveId: "b!testbibliothek",
            inhaltsTransport: transportDouble,
            aufloeseFn: async () => [AUFGELOEST],
          }),
        ),
    }),
  );
  // Die gebaute Fläche an DIESE Instanz — derselbe eine Aufruf wie in `server.ts:66`, geholt aus
  // `browserweg.ts` und nicht abgeschrieben.
  await mitFlaeche().vorListen(app);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const adresse = app.server.address() as AddressInfo | null;
  if (adresse === null || typeof adresse === "string") {
    await app.close();
    throw new Error(`${JOB}: der Server hat keinen Port gemeldet — die Strecke steht nicht.`);
  }
  const basis = `http://127.0.0.1:${adresse.port}`;
  return {
    app,
    basis,
    profil: (name, sprache) => new Sitzung(basis, name, sprache),
    schliessen: () => app.close(),
  };
}

/** Der Port, auf dem diese Strecke wirklich horcht — für das Protokoll aus Lieferung 6. */
export function portVon(strecke: Strecke): number {
  return Number(new URL(strecke.basis).port);
}

// ------------------------------------------------------------------------------------------------
// ZWEI KLEINE WERKZEUGE AN DER SEITE — und beide gehen über den EINEN Weg aus `browserweg.ts`.
// ------------------------------------------------------------------------------------------------

/** Was ein Übersetzer können muss, damit die Sollwerte aus `i18n.ts` und nicht aus dem Test kommen. */
export type Uebersetzer = (schluessel: string, werte?: Record<string, unknown>) => string;

/**
 * ANKREUZEN UND AUFKLAPPEN MIT DER TASTATUR — die LEERTASTE, nicht Enter.
 *
 * Ein Ankreuzfeld und ein `<summary>` reagieren nicht auf Enter, sondern auf die Leertaste; ein
 * „Klick" aus `page.evaluate` wäre wieder der ungemessene zweite Weg, gegen den `browserweg.ts:206`
 * gebaut ist. Gerufen wird deshalb `tippeMitTastatur` — es ist der EINE Weg zu einem Element, das
 * Zeichen entgegennimmt: Fokus auf den Dokumentanfang, per Tab hin, SICHTBAREN Fokus nachgemessen,
 * dann das Zeichen. Das Zeichen ist hier ein Leerschlag, und genau er schaltet um.
 *
 * Damit gilt auch für diese Elemente die Zusage aus JOB 4223: was kein Tab erreicht, lässt diesen
 * Lauf scheitern (BENs Mutation `tabIndex={-1}`).
 */
export function mitLeertaste(seite: Seite, selektor: string, was: string): Promise<number> {
  return tippeMitTastatur(seite, selektor, " ", was);
}

/** Ein Abruf AUS DER SEITE HERAUS — echter Socket, echte Kekse genau dieses Profils. */
const SEITENABRUF = `(pfad) => fetch(pfad, { credentials: "include" })
  .then((r) => r.text().then((t) => ({ status: r.status, rumpf: t })))
  .catch((e) => ({ status: -1, rumpf: String(e) }))`;

export async function ausDerSeite<T>(seite: Seite, pfad: string): Promise<T> {
  const antwort = await seite.evaluate<{ status: number; rumpf: string }>(fn(SEITENABRUF), pfad);
  expect(antwort.status, `${JOB}: ${pfad} antwortete ${antwort.status}: ${antwort.rumpf}`).toBe(
    200,
  );
  return JSON.parse(antwort.rumpf) as T;
}

/** HTML → Klartext, wortgleich mit `weg-am-draht-und-neustart.test.ts:354-358`. */
export function klartext(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

// ================================================================================================
// SICHTBARKEIT — und warum weder `textContent` NOCH `innerText` sie allein belegen.
// ================================================================================================
//
// BEN hat an R1 und an R2 DIESELBE Lücke gemessen: er hat im Produkt den Volltext mit
// `style={{ display: "none" }}` ausgeblendet (`apps/web/src/pages/Stufe2.tsx:557`) — und dieser
// Lauf blieb beide Male GRÜN. Der Grund stand im alten `knotentext`: `textContent` liefert den Text
// eines Knotens unabhängig davon, ob ihn je ein Mensch sehen konnte, und die Wartebedingungen
// fragten nur, ob der Knoten IM BAUM steht.
//
// `innerText` ALLEIN REICHT DAFÜR NICHT — das ist die Falle, die diese Runde beinahe gekostet
// hätte. Nach HTML-Spec fällt `innerText` auf `textContent` ZURÜCK, sobald das Element „not being
// rendered" ist; bei genau BENs `display:none` liefert es also weiterhin den vollen Text. Ein
// blosser Wechsel von `textContent` auf `innerText` hätte seine Gegenprobe ein drittes Mal
// überlebt.
//
// GEMESSEN WIRD DESHALB DIE DARSTELLUNG SELBST, in fünf unabhängigen Fragen:
//   · `checkVisibility({checkOpacity, checkVisibilityCSS})` — deckt VORFAHREN mit ab,
//   · der eigene berechnete Stil (`display`, `visibility`, `opacity`),
//   · das `hidden`-Attribut,
//   · und die wirkliche Fläche (`getBoundingClientRect`) — ein Knoten unter einem
//     `display:none`-Vorfahren misst 0×0, auch wenn sein eigener `display` „block" sagt.
// Erst wenn alle tragen, gilt der Text als gesehen. Beim Scheitern nennt die Meldung den GRUND
// (welche Frage nein sagte) und den Text, der sich gelesen HÄTTE — sie zeigt damit auf die Sache
// statt auf ein nacktes „expected false to be true".
//
// DIE FRAGE STEHT GENAU EINMAL (`SICHTBAR_AM_KNOTEN`, an einem KNOTEN gestellt); alles darunter —
// Einzelbefund, Wartebedingung, Zählung — baut darauf auf, statt sie abzuschreiben. Dieselbe
// Doktrin wie `browserweg.ts:8-17`.
// ================================================================================================
// R4 · UND DER CONTAINER BÜRGT NICHT FÜR SEINEN TEXT — BENs dritter Fund.
// ================================================================================================
//
// R3 fragte `checkVisibility` am AUSGEWÄHLTEN Knoten und seinen Vorfahren, las dann aber dessen
// GANZEN `innerText`. BEN hat genau dazwischen gestochen: er hat den Fliesstext unter `bib-text` in
// ein `<div style={{ opacity: 0 }}>` gewickelt. Der Container blieb sichtbar, seine Diagnose meldete
// `"childOpacity":"0","childVisible":false` — und der Lauf blieb GRÜN, weil `innerText` den Text
// eines durchsichtigen KINDES weiterhin liefert.
//
// Ein sichtbarer Kasten belegt also nicht, dass sein Inhalt lesbar ist. Gefragt wird deshalb ab
// jetzt JEDES texttragende Element unterhalb des Knotens (die Eltern der Textknoten), und zwar mit
// denselben Fragen wie der Knoten selbst — plus einer, die es nur bei Text gibt: eine völlig
// durchsichtige SCHRIFTFARBE (`color: transparent` / Alpha 0) macht Text unsichtbar, ohne dass
// Element oder Vorfahr etwas davon merken.
const SICHTBAR_AM_KNOTEN = `(k) => {
  const s = getComputedStyle(k);
  const r = k.getBoundingClientRect();
  const gruende = [];
  // Beide Schreibweisen der Fahnen: die standardisierten (opacityProperty/visibilityProperty) und
  // die aelteren Chromium-Namen. Unbekannte Schluessel ignoriert der Browser — so haengt dieser
  // Nachweis nicht an der Version des Pruefplatzes.
  if (typeof k.checkVisibility === "function" && !k.checkVisibility({
    checkOpacity: true, checkVisibilityCSS: true,
    opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true
  })) {
    gruende.push("checkVisibility() verneint (prueft auch die Vorfahren)");
  }
  if (s.display === "none") { gruende.push("display:none"); }
  if (s.visibility !== "visible") { gruende.push("visibility:" + s.visibility); }
  if (Number.parseFloat(s.opacity || "1") === 0) { gruende.push("opacity:0"); }
  if (k.hasAttribute("hidden")) { gruende.push("hidden-Attribut"); }
  if (r.width <= 0 || r.height <= 0) {
    gruende.push("Flaeche " + Math.round(r.width) + "x" + Math.round(r.height) + " px");
  }
  return { sichtbar: gruende.length === 0, grund: gruende.join(" · ") };
}`;

/** Ist die SCHRIFTFARBE durchsichtig? Die eine Frage, die nur an Text sinnvoll ist. */
const SCHRIFT_UNSICHTBAR = `(s) => {
  const farbe = (s.color || "").replace(/\\s+/g, "");
  if (farbe === "transparent") { return "color:transparent"; }
  const treffer = /^rgba\\(\\d+,\\d+,\\d+,([\\d.]+)\\)$/.exec(farbe);
  if (treffer && Number.parseFloat(treffer[1]) === 0) { return "color:" + farbe; }
  return "";
}`;

/**
 * Der volle Befund zu einem Knoten: er selbst UND jedes texttragende Element unter ihm.
 *
 * `verdeckt` ist die Antwort auf BENs Fund — jeder Textschnipsel, den der Baum führt, den aber
 * niemand lesen kann, steht dort mit seinem Grund. Ist die Liste nicht leer, ist die Zusage
 * „das sieht ein Mensch" widerlegt, ganz gleich wie sichtbar der Kasten drumherum ist.
 */
const SICHTBARKEIT = `(sel) => {
  const k = document.querySelector(sel);
  if (k === null) {
    return { da: false, sichtbar: false, grund: "kein Knoten zu " + sel, text: null, verdeckt: [] };
  }
  const b = (${SICHTBAR_AM_KNOTEN})(k);
  // Die Eltern aller nicht-leeren Textknoten — genau die Elemente, die wirklich Text zeigen.
  const traeger = [];
  const lauf = document.createTreeWalker(k, NodeFilter.SHOW_TEXT);
  let n = lauf.nextNode();
  while (n) {
    const roh = (n.nodeValue || "").trim();
    const el = n.parentElement;
    if (roh.length > 0 && el) {
      const schon = traeger.find((e) => e.el === el);
      if (schon) { schon.text = schon.text + " " + roh; } else { traeger.push({ el: el, text: roh }); }
    }
    n = lauf.nextNode();
  }
  const verdeckt = [];
  for (const t of traeger) {
    const tb = (${SICHTBAR_AM_KNOTEN})(t.el);
    const gruende = tb.sichtbar ? [] : [tb.grund];
    const farbgrund = (${SCHRIFT_UNSICHTBAR})(getComputedStyle(t.el));
    if (farbgrund !== "") { gruende.push(farbgrund); }
    if (gruende.length > 0) {
      verdeckt.push({ text: t.text.slice(0, 80), grund: gruende.join(" · ") });
    }
  }
  return {
    da: true,
    sichtbar: b.sichtbar && verdeckt.length === 0,
    grund: b.sichtbar ? "" : b.grund,
    text: (k.innerText || "").trim(),
    verdeckt: verdeckt,
  };
}`;

/** „Steht der Knoten sichtbar da?" — die Wartebedingung, aus derselben einen Frage gebaut. */
const IST_SICHTBAR = `(sel) => (${SICHTBARKEIT})(sel).sichtbar === true`;

/** „Steht dieser SATZ sichtbar da?" — Sichtbarkeit UND Wortlaut in einer Bedingung. */
const SICHTBAR_MIT_SATZ = `([sel, soll]) => {
  const b = (${SICHTBARKEIT})(sel);
  return b.sichtbar === true && b.text === soll;
}`;

export interface Sichtbefund {
  /** Steht der Knoten überhaupt im Baum? */
  da: boolean;
  /** Sieht ein Mensch ihn UND jeden Textschnipsel darin? */
  sichtbar: boolean;
  /** Woran es am Knoten selbst hing — für eine Meldung, die auf den Schuldigen zeigt. */
  grund: string;
  /** Der dargestellte Text (`innerText`), oder `null` ohne Knoten. */
  text: string | null;
  /** Jeder Textteil unterhalb, den niemand lesen kann — mit seinem Grund. */
  verdeckt: { text: string; grund: string }[];
}

/** Der Selektor zu einer Testkennung — an EINER Stelle, damit die Schreibweise nicht auseinanderläuft. */
export function testid(kennung: string): string {
  return `[data-testid="${kennung}"]`;
}

export function sichtbefund(seite: Seite, selektor: string): Promise<Sichtbefund> {
  return seite.evaluate<Sichtbefund>(fn(SICHTBARKEIT), selektor);
}

/**
 * Der Text, den ein Mensch WIRKLICH SIEHT — oder ein rotes Ergebnis mit dem Grund.
 *
 * Diese Funktion ersetzt den alten `knotentext` restlos: es gibt in dieser Datei ab jetzt keinen
 * Weg mehr, einen Text zu lesen, ohne seine Sichtbarkeit zu belegen. Stünde der alte daneben,
 * nähme der nächste Fall den bequemeren (dasselbe Argument wie `browserweg.ts:263-268`).
 */
export async function sichtbarerText(seite: Seite, selektor: string, was: string): Promise<string> {
  const befund = await sichtbefund(seite, selektor);
  expect(befund.da, `${JOB}: ${was} steht überhaupt nicht im Baum (${selektor})`).toBe(true);
  // ZWEI GETRENNTE MELDUNGEN, weil es zwei verschiedene Fehler sind: der Kasten ist weg — oder er
  // steht da und sein Text ist trotzdem unlesbar. Die zweite ist BENs Fund aus R3; sie nennt den
  // betroffenen Textschnipsel wörtlich, damit die Meldung auf die Stelle zeigt und nicht auf den
  // Kasten.
  expect(
    befund.verdeckt,
    `${JOB}: ${was} führt Text, den NIEMAND SIEHT (${selektor}) — ${befund.verdeckt
      .map((v) => `„${v.text}" (${v.grund})`)
      .join(" · ")}`,
  ).toEqual([]);
  expect(
    befund.sichtbar,
    `${JOB}: ${was} steht im Baum, ist aber NICHT SICHTBAR (${selektor}) — ${befund.grund}. Gelesen hätte sich: „${(befund.text ?? "").slice(0, 160)}"`,
  ).toBe(true);
  return befund.text as string;
}

/** Warten, bis der Knoten SICHTBAR ist — nicht, bis es ihn gibt. */
export function warteAufSichtbar(
  seite: Seite,
  selektor: string,
  was: string,
  frist = 60_000,
): Promise<void> {
  return warte(seite, IST_SICHTBAR, `${was} ist sichtbar`, selektor, frist);
}

/** Warten, bis dieser SATZ sichtbar dasteht — Wortlaut und Darstellung in einem. */
export function warteAufSichtbarenSatz(
  seite: Seite,
  selektor: string,
  soll: string,
  was: string,
  frist = 60_000,
): Promise<void> {
  return warte(
    seite,
    SICHTBAR_MIT_SATZ,
    `${was} steht sichtbar da („${soll}")`,
    [selektor, soll],
    frist,
  );
}

/**
 * Wie viele Prüfkarten tragen diesen Titel SICHTBAR? Die Frage aus Lieferung 3 (f).
 *
 * Gezählt wird, was ein Mensch sieht: eine zweite, ausgeblendete Karte ist für ihn keine
 * Verdopplung — eine ausgeblendete EINZIGE Karte aber auch kein Eintrag. Beide Richtungen fallen
 * damit auf, denn die Zusicherung darunter verlangt genau EINS.
 */
const SICHTBARE_KARTEN_MIT_TITEL = `([sel, titel]) => [...document.querySelectorAll(sel)]
  .filter((k) => {
    if ((k.innerText || "").trim() !== titel) { return false; }
    if (!(${SICHTBAR_AM_KNOTEN})(k).sichtbar) { return false; }
    // R4: auch hier zaehlt die SCHRIFT, nicht nur der Kasten — eine Karte mit durchsichtigem
    // Titel steht fuer einen Menschen nicht in der Liste.
    return (${SCHRIFT_UNSICHTBAR})(getComputedStyle(k)) === "";
  }).length`;

/** Dieselbe Zählung als Wartebedingung — eine Karte reicht, sie muss aber SICHTBAR sein. */
const SICHTBARE_KARTE_VORHANDEN = `([sel, titel]) => (${SICHTBARE_KARTEN_MIT_TITEL})([sel, titel]) > 0`;

/**
 * JOB 4360 · Dieselbe Zählung, aber auf eine GENAUE Zahl gewartet.
 *
 * Gebraucht für „genau ein Vorgang kam dazu": eine Bedingung `> 0` träte schon vor dem zweiten
 * Import ein (die entschiedene Karte des ersten steht weiterhin da), und eine feste Zahl wäre eine
 * Wette auf die Vorgeschichte. Die Zählung selbst wird GERUFEN, nicht abgeschrieben.
 */
const KARTENZAHL_ERREICHT = `([sel, titel, n]) => (${SICHTBARE_KARTEN_MIT_TITEL})([sel, titel]) === n`;

/**
 * Die drei Kürzel, die der Server im Feld `error` führt (`sharepoint-import-routes.ts:114-129`) —
 * und die auf der Fläche NIE stehen dürfen: dort steht der Satz, nicht der Code.
 *
 * GEPRÜFT WIRD AUF DIE KÜRZEL UND NICHT AUF DAS PRÄFIX `SHAREPOINT_`: Die Zugangskarte nennt
 * berechtigterweise die NAMEN der Umgebungsvariablen (`KLARWERK_SHAREPOINT_TOKEN` …, nie ihre
 * Werte) — im ersten Cloud-Lauf a72929260b234fbb817e479d51c5bbb2 hat genau das die zu weite
 * Fassung dieser Zusicherung rot gemacht. Eine Prüfung, die eine gewollte Auskunft verbietet,
 * misst nicht die Sache, sondern eine Zeichenkette.
 */
const SERVERCODES = ["SHAREPOINT_FORBIDDEN", "SHAREPOINT_NOT_FOUND", "SHAREPOINT_UNREACHABLE"];

/**
 * Steht IRGENDWO auf der Seite noch eine Inhaltszusage? Die Frage aus Lieferung 5.
 *
 * HIER BLEIBT `textContent` — UND DAS IST ABSICHT. Diese Liste trägt eine VERNEINUNG („neben dem
 * Fehlersatz steht keine Zusage mehr"), und für eine Verneinung ist `textContent` die SCHÄRFERE
 * Frage: sie findet auch eine Zusage, die nur ausgeblendet stehen geblieben ist. Mit einer
 * Sichtbarkeitsprüfung wäre diese Zusicherung SCHWÄCHER geworden, nicht stärker — genau umgekehrt
 * zu allen positiven Aussagen darunter, die ab jetzt Sichtbarkeit verlangen.
 */
const INHALTSZUSAGEN = `() => [...document.querySelectorAll('[data-testid^="sharepoint-inhaltstyp-"]')]
  .map((k) => (k.textContent || "").trim())`;

export interface Fehlerlagenbefund {
  /** Die Lage, wie der Test sie gestellt hat. */
  lage: string;
  /** Der SICHTBARE Satz auf der Seite. */
  satz: string;
  /** Was neben ihm an Inhaltszusagen stehen blieb — muss leer sein. */
  zusagen: string[];
}

export interface GesamtwegBefund {
  koId: string;
  kandidatId: string;
  /** Der Text, der aus `GET /api/kos/:id` zurückkam — Klartext. */
  gelesenerText: string;
  herkunft: { provider: string; url: string; sourceVersion: number };
  /** Die Sätze, die VOR der Annahme je Datei sichtbar an der Zeile standen. */
  ankuendigung: Record<string, string>;
  /** Der Satz, der WÄHREND der laufenden Messung an der Zeile stand. */
  waehrendDerMessung: string;
  /** Der Satz, der nach der Messung an der Zeile stand. */
  gemessen: string;
  /** Der Satz des Ergebnisbildes zur übernommenen Datei. */
  ergebnisSatz: string;
  /** Der Volltext, den ein Mensch nach der Annahme auf der Prüfkarte SIEHT. */
  sichtbarerVolltext: string;
  /** Die Herkunftszeile, die dabei neben ihm steht. */
  sichtbareQuelle: string;
  zweiterImport: { nichtsNeu: string; schonVorgemerkt: string; kartenMitDemNamen: number };
  fehlerlagen: Fehlerlagenbefund[];
  /** Was am WIEDER GEÖFFNETEN Wissensobjekt (`/wissen/:id`) sichtbar stand — Lieferung 3 (e). */
  objektseite: Objektseitenbefund;
  /** Die beiden Zustände aus §9, die R2 noch offen gelassen hatte. */
  zustaende: Zustandsbefund;
  /** JOB 4360 · der Wiederholimport mit NEUERER Fassung — und was danach am Objekt stand. */
  neueFassung: NeueFassungBefund;
  tastatur: Record<string, number>;
}

/**
 * JOB 4360 · DIE ZWEITE FASSUNG, ANGEKOMMEN — was ein Mensch danach am Objekt liest.
 *
 * Die Frage dieses Abschnitts ist NICHT „hat der Server die Zahl erhöht" (das misst der Import-Kern
 * seit 4125/4232 selbst), sondern: SIEHT es jemand? Deshalb steht hier neben dem Bestandswert auch
 * der SICHTBARE Text, und die Kennung des Objekts steht daneben — eine zweite Kennung wäre ein
 * zweites Wissensobjekt und damit die Antwort auf eine ganz andere Frage.
 */
export interface NeueFassungBefund {
  /** Die Kennung des Objekts NACH dem zweiten Import — muss dieselbe sein wie vorher. */
  koId: string;
  /** Der Quellstand, den `GET /api/kos/:id` danach am Herkunftsanker führt. */
  standAmBestand: number;
  /** Der SICHTBARE Quellstand am wieder geöffneten Objekt (`bib-quelle-stand`). */
  standSichtbar: string;
  /**
   * Wie viele Prüfkarten mit dem Dateinamen die zweite Fassung HINZUGEFÜGT hat — genau eine.
   *
   * GEMESSEN ALS UNTERSCHIED und nicht als feste Zahl: die Warteschlange führt auch die ENTSCHIEDENE
   * Karte des ersten Imports weiter (gemessen im Cloud-Lauf 8a6eccae4a928c0e8cee5f5b: zwei Karten,
   * nicht eine). Eine feste Erwartung hier wäre eine Wette auf alles, was vorher in diesem Lauf
   * geschah; der Unterschied sagt genau das, was die Zusage meint — ein neuer Vorgang, nicht zwei.
   */
  kartenDazu: number;
  /** Wie viele sichtbare Prüfkarten mit dem Dateinamen danach dastanden — der Rohwert dazu. */
  kartenNachher: number;
  /** Der sichtbare Stand je Sprache — de aus dem Hauptweg, en/nl am selben Objekt nachgelesen. */
  jeSprache: Record<string, string>;
}

/**
 * Lieferung 3 (e), zu Ende geführt: das Wissensobjekt WIEDER GEÖFFNET, über die Oberfläche.
 *
 * BENs Korrekturpflicht 2 (R1 und R2 wörtlich gleich): bis hierher endete der Weg an der
 * aufgeklappten Prüfkarte (`imp-volltext`), und Herkunft wie Stand wurden nur am API-Objekt
 * geprüft. Ein Mensch, der den Eintrag am nächsten Tag sucht, geht aber nicht an die Prüfkarte —
 * er öffnet das Objekt. Genau dieser Weg wird jetzt gefahren: `/wissen/:id` zeigt dieselbe Fläche
 * wie die Bibliothek mit diesem Eintrag vorgewählt (`KnowledgeDetail.tsx:21`, `:133`).
 */
export interface Objektseitenbefund {
  /** Der sichtbare Titel (`bib-titel`). */
  titel: string;
  /** Der sichtbare Fliesstext (`bib-text`) — hier muss der Dateitext stehen. */
  text: string;
  /** Der sichtbare Quellenabschnitt hinter „Mehr" — Herkunft und Originaladresse. */
  quellen: string;
  /** Die sichtbare AUFNAHMEZEIT der Quelle (`bib-quelle-zeit`) — wann sie ans Objekt kam. */
  quellenZeit: string;
  /**
   * JOB 4360 · DER SICHTBARE QUELLSTAND (`bib-quelle-stand`) — WELCHE Fassung angekommen ist.
   *
   * Er ist etwas ANDERES als `quellenZeit`, und bis JOB 4360 hiess das Feld hier missverständlich
   * „quellenStand", obwohl es die Aufnahmezeit trug: die Zeit sagt, wann die Quelle ans Objekt kam,
   * der Stand sagt, welche Fassung der Datei dabei übernommen wurde. Nach einem Wiederholimport
   * ändert sich der Stand — die Zeit allein sagte darüber nichts.
   */
  quellstand: string;
}

/** Die §9-Zustände, im echten Browser gestellt statt beschrieben. */
export interface Zustandsbefund {
  /** Der benannte Leersatz bei leerer Dateiliste — keine leere Fläche, keine Behauptung. */
  leerSatz: string;
  /** Der Satz, der eine LAUFENDE Auffrischung als solche ausweist. */
  nichtFrischSatz: string;
  /** Stand die alte Liste währenddessen noch sichtbar da? (§9: sie darf.) */
  alteListeBleibtSichtbar: boolean;
}

export interface GesamtwegAufbau {
  browser: Browser;
  strecke: Strecke;
  /**
   * Die SOLLSÄTZE kommen aus `i18n.ts`, nicht aus diesem Test (`…-montiert.test.tsx:10-12`).
   *
   * JOB 4360: aus dem einen deutschen Übersetzer ist ein KATALOG JE SPRACHE geworden. Der Grund ist
   * kein Aufräumen, sondern eine Zusage: der Quellstand trägt eine Beschriftung, und die muss in
   * de/en/nl stehen. Deutsch bleibt der Hauptweg (`katalog("de")`), „en"/„nl" werden am selben
   * Objekt nachgelesen — gegen DENSELBEN Katalog und nicht gegen abgeschriebene Wörter.
   */
  katalog: (sprache: string) => Uebersetzer;
  adminEmail: string;
}

/** Ein Browserkontext, der sein Netz wirklich abschalten kann — der Offlinefall aus Lieferung 5. */
interface KontextMitNetz extends Kontext {
  setOffline(offline: boolean): Promise<void>;
}

/** Ein breites Fenster: dieser Auftrag misst den Inhaltsweg, nicht die schmale Kante (JOB 4223 tut das). */
export const BREIT = { width: 1280, height: 900 };

/**
 * DER GANZE WEG, in der Reihenfolge, in der ihn ein Mensch geht.
 *
 * Anmelden → Importseite → Liste lesen → Kennzeichnung prüfen → mit der Tastatur ankreuzen →
 * Messung abwarten → übernehmen → Prüf-Warteschlange aufklappen → annehmen → den Text am
 * zurückgelesenen Objekt lesen → denselben Import ein zweites Mal → und zuletzt die vier
 * Fehlerlagen, im selben Browser und an derselben Seite.
 *
 * Welche Ablagen darunter liegen, entscheidet der Aufrufer — das ist der einzige Unterschied
 * zwischen dem Tor-Lauf und dem PostgreSQL-Lauf.
 */
export async function fahreDenGesamtweg(a: GesamtwegAufbau): Promise<GesamtwegBefund> {
  const basis = a.strecke.basis;
  const t = a.katalog("de");
  const tastatur: Record<string, number> = {};
  const { kontext, seite } = await profilMitStufe2(a.browser);
  try {
    // ══ 1. Der Administrator meldet sich an SEINER Maske an, nur mit der Tastatur. ═════════════
    await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
    await warte(seite, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske");
    tastatur.anmeldungEmail = await tippeMitTastatur(seite, "#auth-email", a.adminEmail, "E-Mail");
    tastatur.anmeldungPasswort = await tippeMitTastatur(
      seite,
      "#auth-password",
      PASSWORT,
      "Passwort",
    );
    await seite.keyboard.press("Enter");
    await warte(seite, `() => !document.querySelector("#auth-email")`, "die Anmeldung trägt");

    // ══ 2. Die Importseite, und auf ihr die Dateiliste aus der ECHTEN Leitung. ═════════════════
    await seite.goto(`${basis}/import`, { waitUntil: "domcontentloaded" });
    await warteAufSichtbar(
      seite,
      testid(`sharepoint-datei-${NOTIZ.id}`),
      "die SharePoint-Dateiliste",
    );

    // ══ 3. Was VERSPRICHT die Liste je Datei? Gemessen am WIRKLICH SICHTBAREN Text. ═══════════
    //
    // Die Textdatei trägt hier die ANKÜNDIGUNG („Inhalt wird vor dem Import geprüft") und noch
    // nicht die Zusage — die Messung steht ja aus. Genau diese Unterscheidung hat JOB 4232 R2
    // eingeführt, und sie ist hier zum ersten Mal im echten Browser gemessen.
    //
    // KALIBRIERT (BENs Korrekturpflicht 1): Wird eine dieser Kennzeichnungen ausgeblendet, sagt
    // `sichtbarerText` mit Grund rot — nicht erst die Gleichheitsprüfung darunter, die bei
    // `display:none` weiterhin bestünde.
    const ankuendigung: Record<string, string> = {};
    for (const datei of DATEIEN) {
      ankuendigung[datei.id] = await sichtbarerText(
        seite,
        testid(`sharepoint-inhaltstyp-${datei.id}`),
        `die Kennzeichnung an ${datei.name}`,
      );
    }
    expect(ankuendigung[NOTIZ.id], "die Textdatei trägt nicht die Ankündigung").toBe(
      t("imp.sharepoint.vorschau.textdatei"),
    );
    expect(ankuendigung[ANWEISUNG.id], "die DOCX trägt nicht „nur Merkmale“").toBe(
      t("imp.sharepoint.vorschau.nurMerkmale"),
    );

    // ══ 4. ANKREUZEN MIT DER TASTATUR — und der LAUFENDE Messzustand, angehalten. ══════════════
    //
    // Der Inhaltsabruf wird festgehalten, BEVOR angekreuzt wird. Nur so ist der Zustand „es wird
    // gemessen" deterministisch messbar statt erwischt: solange er dauert, darf an der Zeile
    // WEDER die alte Ankündigung NOCH eine Zusage stehen (§9: keine Aussage ohne frische
    // Grundlage), und der Übernahmeknopf bleibt zu.
    let freigeben = (): void => undefined;
    doppel.halt = new Promise<void>((erfuellen) => {
      freigeben = () => erfuellen();
    });
    tastatur.ankreuzen = await mitLeertaste(
      seite,
      `[data-testid="sharepoint-datei-${NOTIZ.id}"]`,
      `Ankreuzfeld ${NOTIZ.name}`,
    );
    await warteAufSichtbarenSatz(
      seite,
      testid("sharepoint-wartegrund"),
      t("imp.sharepoint.pruefungLaeuft"),
      "der Grund, warum der Übernahmeknopf noch zu ist",
    );
    const waehrendDerMessung = await sichtbarerText(
      seite,
      testid(`sharepoint-inhaltstyp-${NOTIZ.id}`),
      "die Zeile während der laufenden Messung",
    );
    expect(waehrendDerMessung, "während der Messung steht schon eine Aussage da").toBe(
      t("imp.sharepoint.vorschau.laeuft"),
    );
    expect(
      await seite.evaluate<boolean>(
        fn(
          `() => (document.querySelector('[data-testid="sharepoint-uebernehmen"]') || {}).disabled === true`,
        ),
      ),
      "der Übernahmeknopf ist offen, obwohl noch gemessen wird",
    ).toBe(true);
    freigeben();
    doppel.halt = null;

    // ══ 5. Die Zusage steht erst NACH der wirklichen Messung. ══════════════════════════════════
    await warte(
      seite,
      `(id) => (document.querySelector('[data-testid="sharepoint-inhaltstyp-' + id + '"]') || {}).dataset?.gemessen === "text"`,
      "der gemessene Befund steht an der Zeile",
      NOTIZ.id,
      60_000,
    );
    const gemessen = await sichtbarerText(
      seite,
      testid(`sharepoint-inhaltstyp-${NOTIZ.id}`),
      "die gemessene Zusage an der Zeile",
    );
    expect(gemessen, "der gemessene Satz stimmt nicht").toBe(t("imp.sharepoint.vorschau.text"));
    expect(doppel.downloadAufrufe.length, "es wurde gar kein Inhalt geholt").toBeGreaterThan(0);
    expect(
      doppel.downloadAufrufe.every((d) => d.adresse === AUFGELOEST),
      "eine Verbindung ging nicht an die geprüfte Adresse",
    ).toBe(true);

    // ══ 6. ÜBERNEHMEN — per Tab, sichtbarem Fokus und Enter. ═══════════════════════════════════
    tastatur.uebernehmen = await tastaturAusloesen(seite, t("imp.sharepoint.uebernehmen"));
    await warteAufSichtbar(seite, testid("sharepoint-ergebnis"), "das Ergebnisbild der Übernahme");
    const ergebnisSatz = await sichtbarerText(
      seite,
      testid(`sharepoint-ergebnis-inhalt-${NOTIZ.id}`),
      "der Ergebnissatz zur übernommenen Datei",
    );
    expect(ergebnisSatz, "das Ergebnisbild sagt nicht, dass der Inhalt mitkam").toBe(
      t("imp.sharepoint.uebernommen.text"),
    );

    // ══ 7. DIE MENSCHLICHE ANNAHME — in der Prüf-Warteschlange, im Browser. ═══════════════════
    //
    // Kein Direktaufruf: aufgeklappt wird der Verlaufskasten mit der Leertaste auf seinem
    // `<summary>`, angenommen mit Enter auf „Annehmen". Erst danach entsteht ein Wissensobjekt —
    // die REVIEW-INVARIANTE bleibt genau so sichtbar, wie sie gemeint ist.
    tastatur.warteschlangeAufklappen = await mitLeertaste(
      seite,
      "details#import-review-queue > summary",
      "Verlaufskasten der Prüf-Warteschlange",
    );
    await warte(
      seite,
      SICHTBARE_KARTE_VORHANDEN,
      "die Prüf-Warteschlange führt die Datei SICHTBAR",
      [testid("imp-kandidat-titel"), NOTIZ.name],
      60_000,
    );
    const offeneVorher = await ausDerSeite<{ id: string; status: string; koId: string | null }[]>(
      seite,
      "/api/library/import/candidates",
    );
    expect(offeneVorher, "es steht kein Vorgang zur Entscheidung").toHaveLength(1);
    tastatur.annehmen = await tastaturAusloesen(seite, t("imp.accept"));
    // ENTSCHIEDEN HEISST: der Knopf ist WEG. Es gibt genau einen Vorgang auf dieser Seite, also ist
    // „kein Bedienelement trägt mehr diese Beschriftung“ die genaue Aussage — und sie hängt an
    // keinem Klassennamen, der sich morgen ändert.
    await warte(
      seite,
      `(soll) => [...document.querySelectorAll('button, a[href], [role="button"]')]
         .every((k) => !(k.textContent || "").includes(soll))`,
      "die Karte ist entschieden — kein Annahmeknopf mehr auf der Seite",
      t("imp.accept"),
      60_000,
    );
    const kandidaten = await ausDerSeite<{ id: string; status: string; koId: string | null }[]>(
      seite,
      "/api/library/import/candidates",
    );
    const kandidat = kandidaten.find((k) => k.status === "angenommen" && k.koId !== null);
    expect(kandidat, "die Annahme hat kein Wissensobjekt erzeugt").toBeDefined();
    const koId = (kandidat as { koId: string | null }).koId as string;

    // ══ 8. DER TEXT AM ZURÜCKGELESENEN OBJEKT — und daneben, was ein Mensch SIEHT. ════════════
    //
    // Gemessen wird NICHT an der Antwort des Importaufrufs (dieselbe Regel wie
    // `weg-am-draht-und-neustart.test.ts:11-16`), sondern an `GET /api/kos/:id` — geholt AUS DER
    // SEITE, also über denselben Socket und mit denselben Keksen wie jeder andere Abruf dieses
    // Browsers. Und weil ein Messwert, den niemand sehen kann, für einen Menschen nichts wert ist,
    // wird DANACH der Volltext auf der Prüfkarte aufgeklappt und GELESEN.
    //
    // DIE REIHENFOLGE IST GEMESSEN UND NICHT GESCHMACK: In der roten Gegenprobe 1 (Dateitext im
    // Mapper entfernt, Arbeitsprüfung 078fe89c7f6f43448e76565eec9cf0a6) stand der Bestand zuerst
    // hinten — der Lauf scheiterte dann am fehlenden Aufklapper („Bedienelement … nicht
    // erreichbar"), also an einer FOLGE des Befundes statt an ihm selbst. Der Bestand wird deshalb
    // ZUERST gelesen: die Meldung zeigt dann auf die Sache, nicht auf ihr Symptom.
    const ko = await ausDerSeite<{
      title: string;
      bodyHtml?: string | null;
      sources: {
        provider?: string | null;
        externalId?: string;
        url?: string | null;
        sourceVersion?: number;
      }[];
    }>(seite, `/api/kos/${koId}`);
    expect(ko.title, "das Objekt trägt nicht den Dateinamen").toBe(NOTIZ.name);
    const gelesenerText = klartext(ko.bodyHtml);
    expect(gelesenerText, "am zurückgelesenen Objekt steht nicht der Text der Datei").toBe(
      TEXT.replace("\n", " "),
    );
    const anker = ko.sources.find((s) => s.externalId === NOTIZ.id);
    expect(anker, "am Objekt hängt kein Herkunfts-Anker").toBeDefined();
    expect(anker?.provider, "die Herkunft nennt nicht SharePoint").toBe("SharePoint");
    expect(anker?.url, "die Herkunft nennt nicht die Originaladresse").toBe(NOTIZ.webUrl);
    expect(anker?.sourceVersion, "der Stand am Objekt stimmt nicht").toBe(QUELLSTAND);

    // UND JETZT DASSELBE MIT DEN AUGEN EINES MENSCHEN: der Volltext auf der Prüfkarte, aufgeklappt
    // mit der Tastatur, samt der Herkunftszeile daneben.
    //
    // DAS IST DIE STELLE, AN DER BEN ZWEIMAL DURCHGEKOMMEN IST. Seine Mutation — nichts als
    // `style={{ display: "none" }}` am Volltext (`apps/web/src/pages/Stufe2.tsx:557`) — liess R1
    // und R2 grün, weil hier `textContent` gelesen und nur auf DASEIN gewartet wurde. Beides ist
    // fort: gewartet wird auf SICHTBARKEIT, gelesen wird mit `sichtbarerText`.
    tastatur.volltextAufklappen = await tastaturAusloesen(seite, t("imp.fullText.show"));
    await warteAufSichtbar(seite, testid("imp-volltext"), "der Volltext auf der Prüfkarte");
    const sichtbarerVolltext = await sichtbarerText(
      seite,
      testid("imp-volltext"),
      "der Volltext auf der Prüfkarte",
    );
    for (const zeile of TEXT.split("\n")) {
      expect(sichtbarerVolltext, `„${zeile}“ steht nicht sichtbar auf der Prüfkarte`).toContain(
        zeile,
      );
    }
    const sichtbareQuelle = await sichtbarerText(
      seite,
      testid("imp-quelle"),
      "die Herkunftszeile neben dem Volltext",
    );
    expect(sichtbareQuelle, "neben dem Text steht keine Herkunft").toContain(NOTIZ.name);

    // ══ 9. DERSELBE IMPORT EIN ZWEITES MAL — an der Liste im Browser gesehen. ═════════════════
    tastatur.ankreuzenZweitesMal = await mitLeertaste(
      seite,
      `[data-testid="sharepoint-datei-${NOTIZ.id}"]`,
      `Ankreuzfeld ${NOTIZ.name} (zweiter Import)`,
    );
    await warte(
      seite,
      `(id) => (document.querySelector('[data-testid="sharepoint-inhaltstyp-' + id + '"]') || {}).dataset?.gemessen === "text"`,
      "der zweite Befund steht an der Zeile",
      NOTIZ.id,
      60_000,
    );
    tastatur.uebernehmenZweitesMal = await tastaturAusloesen(
      seite,
      t("imp.sharepoint.uebernehmen"),
    );
    // ------------------------------------------------------------------------------------------
    // DAS NEUTRALE ENDESIGNAL — und warum es nicht „nichts Neues" sein darf.
    // ------------------------------------------------------------------------------------------
    //
    // Die naheliegende Wartebedingung wäre „`sharepoint-nichts-neu` ist da". Sie ist schon die
    // HALBE ANTWORT auf die Frage dieses Schritts: Legt der Wiederholimport doch einen zweiten
    // Vorgang an, tritt sie nie ein, und der Lauf scheitert an der Frist statt am Befund. Genau das
    // hat die rote Gegenprobe 3 gezeigt (Anker-/Dublettenprüfung aus, Arbeitsprüfung
    // 86b6d7ffaaec4b25a458c6983890fb05): „das Ergebnisbild sagt: nichts Neues — nicht eingetreten in
    // 60000 ms". Rot war es, aber es zeigte auf die Uhr und nicht auf die Liste.
    //
    // Gewartet wird deshalb auf etwas, das in BEIDEN Ausgängen gleich eintritt: Die Übernahme ist
    // durch, sobald die Auswahl zurückgesetzt ist (`onSuccess` → `setGewaehlt([])`).
    await warte(
      seite,
      `(id) => (document.querySelector('[data-testid="sharepoint-datei-' + id + '"]') || {}).checked === false`,
      "die zweite Übernahme ist durch (die Auswahl ist zurückgesetzt)",
      NOTIZ.id,
      60_000,
    );
    // UND DIE LISTE WIRD ERST GEZÄHLT, WENN SIE DEN BESTAND WIRKLICH ZEIGT. Ohne diesen Schritt
    // wäre die Zählung eine Wette auf die Auffrischung: ein zweiter Vorgang, der noch nicht
    // gerendert ist, sähe aus wie keiner — der Fall bliebe grün, obwohl verdoppelt wurde.
    const bestand = await ausDerSeite<{ id: string }[]>(seite, "/api/library/import/candidates");
    await warte(
      seite,
      `(n) => document.querySelectorAll('[data-testid="imp-kandidat-titel"]').length === n`,
      `die Prüfliste zeigt die ${bestand.length} Vorgänge des Bestandes`,
      bestand.length,
      60_000,
    );
    const zweiterImport = {
      nichtsNeu: await sichtbarerText(
        seite,
        testid("sharepoint-nichts-neu"),
        "die Meldung „nichts Neues“ des zweiten Imports",
      ),
      schonVorgemerkt: await sichtbarerText(
        seite,
        testid("sharepoint-ergebnis"),
        "das Ergebnisbild des zweiten Imports",
      ),
      kartenMitDemNamen: await seite.evaluate<number>(fn(SICHTBARE_KARTEN_MIT_TITEL), [
        testid("imp-kandidat-titel"),
        NOTIZ.name,
      ]),
    };
    // DIE ENTSCHEIDENDE ZEILE DIESES SCHRITTS, und sie steht VORN: gesehen an der Liste im
    // Browser, nicht an einer Zahl in einer Antwort.
    expect(
      zweiterImport.kartenMitDemNamen,
      "nach dem Wiederholimport steht die Datei mehrfach in der Prüf-Warteschlange",
    ).toBe(1);
    expect(zweiterImport.nichtsNeu, "der zweite Import meldet nicht „nichts Neues“").toBe(
      t("imp.sharepoint.nichtsNeu"),
    );
    expect(
      zweiterImport.schonVorgemerkt,
      "das Ergebnisbild sagt nicht, dass der Stand schon in der Prüfung liegt",
    ).toContain(t("imp.sharepoint.schonVorgemerkt", { n: 1 }));

    // ══ 10. DIE VIER FEHLERLAGEN — im selben Browser, an derselben Seite. ═════════════════════
    const fehlerlagen = await fahreDieFehlerlagen(seite, kontext as KontextMitNetz, t, tastatur);

    // ══ 11. DIE ZWEI §9-ZUSTÄNDE, die R2 offen gelassen hatte. ════════════════════════════════
    const zustaende = await fahreDieZustaende(seite, t, tastatur);

    // ══ 12. DAS WISSENSOBJEKT, ÜBER DIE OBERFLÄCHE WIEDER GEÖFFNET (Lieferung 3 e). ═══════════
    const objektseite = await liesDieObjektseite(seite, basis, koId, t, tastatur);

    // ══ 13. JOB 4360 · DIE ZWEITE FASSUNG DERSELBEN DATEI — angekommen und ABLESBAR. ══════════
    const zweiteFassung = await fahreDieZweiteFassung({ seite, basis, koId, t, tastatur });

    // ══ 14. JOB 4360 · UND DERSELBE QUELLSTAND IN „en" UND „nl". ══════════════════════════════
    //
    // ZULETZT, und das ist kein Geschmack: gemessen wird der Stand der ZWEITEN Fassung. Stünde die
    // Sprachrunde vor Abschnitt 13, prüfte sie den Ausgangswert — und liesse offen, ob die
    // fremdsprachige Fläche eine Aktualisierung überhaupt mitbekommt.
    const jeSprache = await liesDenStandInDenAnderenSprachen({
      kontext,
      seite,
      basis,
      koId,
      katalog: a.katalog,
      tastatur,
      sollStand: QUELLSTAND_NEU,
    });

    return {
      koId,
      kandidatId: (kandidat as { id: string }).id,
      gelesenerText,
      herkunft: {
        provider: String(anker?.provider),
        url: String(anker?.url),
        sourceVersion: Number(anker?.sourceVersion),
      },
      ankuendigung,
      waehrendDerMessung,
      gemessen,
      ergebnisSatz,
      sichtbarerVolltext,
      sichtbareQuelle,
      zweiterImport,
      fehlerlagen,
      objektseite,
      zustaende,
      neueFassung: {
        ...zweiteFassung,
        // Deutsch kommt aus dem Hauptweg (Abschnitt 13), „en"/„nl" aus Abschnitt 14 — DERSELBE
        // Wert, dreimal gelesen, nie abgeschrieben.
        jeSprache: { de: zweiteFassung.standSichtbar, ...jeSprache },
      },
      tastatur,
    };
  } finally {
    // JOB 4360: der Schalter des Doubles gehört zu DIESEM Lauf und nicht zum nächsten — beide
    // Testdateien teilen sich das Modul (`doppel`), und ein stehen gebliebener „neuer Stand" wäre
    // im nächsten Lauf eine Vorbedingung, die niemand gesetzt hat.
    doppel.neuerStand = false;
    await kontext.close();
  }
}

/**
 * Ein frisches Profil, in dem die Stufe-2-Fläche eingeschaltet ist.
 *
 * WARUM DER SPEICHERWERT UND KEIN UMWEG: `/import` liegt hinter dem Stufe-2-Umschalter
 * (`app/navigation.ts:309-321`, `routes.tsx` → `Stage2Notice`), und dessen Zustand IST ein Wert im
 * Endgerätespeicher (`lib/stufe2Storage.ts:7`). Was hier gesetzt wird, ist also genau das, was ein
 * Administrator hinterlässt, der den Schalter einmal umgelegt hat — keine Abkürzung an einer
 * Rechteprüfung vorbei: die Route verlangt weiterhin `users.manage`, und die Rolle kommt aus der
 * echten Sitzung.
 */
async function profilMitStufe2(browser: Browser): Promise<{ kontext: Kontext; seite: Seite }> {
  // Das Profil selbst kommt aus `browserweg.ts` (eigener Keksbeutel, Sprache fest auf Deutsch);
  // hier kommt GENAU EIN Wert dazu. Der Startskript-Weg ist derselbe, den `profil` benutzt, und er
  // wirkt auf jede folgende Navigation — die Seite ist noch auf `about:blank`.
  const { kontext, seite } = await profil(browser, BREIT);
  await kontext.addInitScript(`try { localStorage.setItem("kw.stufe2.v1", "1"); } catch (e) {}`);
  return { kontext, seite };
}

/**
 * §9 · DIE ZWEI ZUSTÄNDE, DIE R2 OFFEN GELASSEN HATTE — steuerbar gemacht statt beschrieben.
 *
 * BENs Korrekturpflicht 3 (R1 und R2 wörtlich gleich): „Leere Liste und angehaltene
 * Listenauffrischung fehlen weiterhin: Das Double liefert stets `DATEIEN`." Es liefert jetzt, was
 * der Test einstellt (`doppel.leer`, `doppel.listenHalt`), und beide Zustände werden im echten
 * Browser AN IHREM SICHTBAREN SATZ gemessen.
 *
 * ZUSTAND A — „erfolgreich leer" (§9): keine Datei, aber ein gültiger Abruf. Verlangt ist ein
 * BENANNTER Leersatz — nicht eine leere Fläche und ausdrücklich nicht die Fehlerlage von nebenan.
 * Deshalb wird HIER auch geprüft, dass KEIN Listenfehler danebensteht: ein Produkt, das „leer"
 * und „kaputt" verwechselt, käme sonst durch.
 *
 * ZUSTAND B — „Cache mit laufender Auffrischung" (§9): die alte Liste DARF sichtbar bleiben, aber
 * sie muss als nicht frisch erkennbar sein. Gemessen wird beides zugleich: der Satz
 * `sharepoint-nicht-frisch` steht sichtbar da UND die alte Zeile ist noch zu sehen. Die
 * Auffrischung wird dafür angehalten — sonst wäre der Zwischenzustand erwischt statt gestellt
 * (dieselbe Begründung wie bei der angehaltenen Inhaltsmessung in Abschnitt 4).
 */
async function fahreDieZustaende(
  seite: Seite,
  t: Uebersetzer,
  tastatur: Record<string, number>,
): Promise<Zustandsbefund> {
  // ── A. Erfolgreich leer. ──────────────────────────────────────────────────────────────────
  doppel.leer = true;
  await bereitZumNeuLaden(seite);
  tastatur.neuLaden_leer = await tastaturAusloesen(seite, t("imp.sharepoint.neuLaden"));
  await warteAufSichtbarenSatz(
    seite,
    testid("sharepoint-leer"),
    t("imp.sharepoint.leer"),
    "der benannte Leersatz",
  );
  const leerSatz = await sichtbarerText(seite, testid("sharepoint-leer"), "der Leersatz");
  // Kein Fehlersatz daneben: „leer" ist eine Auskunft über den Bestand, keine über eine Störung.
  const fehlerDaneben = await sichtbefund(seite, testid("sharepoint-listenfehler"));
  expect(
    fehlerDaneben.da,
    `${JOB}: neben dem Leersatz steht ein Listenfehler („${fehlerDaneben.text ?? ""}") — leer ist nicht kaputt`,
  ).toBe(false);
  // Und keine Inhaltszusage ohne Dateien.
  expect(
    await seite.evaluate<string[]>(fn(INHALTSZUSAGEN)),
    "bei leerer Liste steht noch eine Inhaltszusage auf der Seite",
  ).toEqual([]);

  // ── Zurück zum Bestand, damit Zustand B eine ALTE Liste hat. ──────────────────────────────
  doppel.leer = false;
  await bereitZumNeuLaden(seite);
  tastatur.neuLaden_zurueckVonLeer = await tastaturAusloesen(seite, t("imp.sharepoint.neuLaden"));
  await warteAufSichtbar(
    seite,
    testid(`sharepoint-datei-${NOTIZ.id}`),
    "die Liste steht nach dem Leerzustand wieder",
  );

  // ── B. Cache mit LAUFENDER Auffrischung. ──────────────────────────────────────────────────
  let freigeben = (): void => undefined;
  doppel.listenHalt = new Promise<void>((erfuellen) => {
    freigeben = () => erfuellen();
  });
  let nichtFrischSatz = "";
  let alteListeBleibtSichtbar = false;
  try {
    await bereitZumNeuLaden(seite);
    tastatur.neuLaden_angehalten = await tastaturAusloesen(seite, t("imp.sharepoint.neuLaden"));
    await warteAufSichtbarenSatz(
      seite,
      testid("sharepoint-nicht-frisch"),
      t("imp.sharepoint.nichtFrisch"),
      "der Hinweis auf die laufende Auffrischung",
    );
    nichtFrischSatz = await sichtbarerText(
      seite,
      testid("sharepoint-nicht-frisch"),
      "der Hinweis auf die laufende Auffrischung",
    );
    // §9: der alte Stand DARF stehen bleiben — er muss es hier sogar, sonst flackerte die Fläche
    // bei jeder Auffrischung leer. Gemessen an der Sichtbarkeit, nicht am Dasein.
    const alteZeile = await sichtbefund(seite, testid(`sharepoint-datei-${NOTIZ.id}`));
    alteListeBleibtSichtbar = alteZeile.sichtbar;
    expect(
      alteListeBleibtSichtbar,
      `${JOB}: während der Auffrischung ist die alte Liste verschwunden — ${alteZeile.grund}`,
    ).toBe(true);
  } finally {
    freigeben();
    doppel.listenHalt = null;
  }
  // Und die Auffrischung kommt wirklich an: der Hinweis verschwindet wieder.
  await warte(
    seite,
    "(sel) => document.querySelector(sel) === null",
    "der Hinweis auf die Auffrischung ist nach ihrem Ende wieder fort",
    testid("sharepoint-nicht-frisch"),
    60_000,
  );
  return { leerSatz, nichtFrischSatz, alteListeBleibtSichtbar };
}

/**
 * LIEFERUNG 3 (e), ZU ENDE GEFÜHRT: das Wissensobjekt WIEDER GEÖFFNET — über die Oberfläche.
 *
 * BEN, R1 und R2 wörtlich gleich: „Weiterhin wird die Prüfkarte aufgeklappt, kein Wissensobjekt
 * über die Oberfläche wieder geöffnet; Herkunft und Stand werden am API-Objekt geprüft, die
 * Oberflächenprüfung verlangt nur den Dateinamen." Genau das ist hier behoben.
 *
 * DER WEG IST DER EINES MENSCHEN: `/wissen/:id` zeigt dieselbe Fläche wie die Bibliothek mit
 * diesem Eintrag vorgewählt (`KnowledgeDetail.tsx:21`, `:133`). Titel und Fliesstext stehen
 * sofort (`BibliothekLesen.tsx:2941`, `:2967`); Herkunft und Stand liegen hinter der einen Zeile
 * „Mehr" (`:3060`) im Abschnitt „Quellen und Belege" (`MehrAbschnitte.tsx:1146`). Beide Klappen
 * werden mit der TASTATUR geöffnet — „Mehr" ist ein Knopf, der Abschnitt ein `<details>`.
 *
 * GEMESSEN WIRD AUSSCHLIESSLICH SICHTBARER TEXT. Das ist der Unterschied zu Abschnitt 8: dort
 * stand der Bestand (`GET /api/kos/:id`), hier steht, was ein Mensch davon zu sehen bekommt.
 */
async function liesDieObjektseite(
  seite: Seite,
  basis: string,
  koId: string,
  t: Uebersetzer,
  tastatur: Record<string, number>,
): Promise<Objektseitenbefund> {
  await seite.goto(`${basis}/wissen/${koId}`, { waitUntil: "domcontentloaded" });
  await warteAufSichtbar(seite, testid("bib-titel"), "der Titel des Wissensobjekts");
  const titel = await sichtbarerText(seite, testid("bib-titel"), "der Titel des Wissensobjekts");
  expect(titel, "das wieder geöffnete Objekt trägt nicht den Dateinamen").toBe(NOTIZ.name);

  // DER DATEITEXT, AM WIEDER GEÖFFNETEN OBJEKT GESEHEN — die Zusage dieses ganzen Auftrags.
  const text = await sichtbarerText(seite, testid("bib-text"), "der Fliesstext des Wissensobjekts");
  for (const zeile of TEXT.split("\n")) {
    expect(text, `„${zeile}“ steht nicht sichtbar am wieder geöffneten Wissensobjekt`).toContain(
      zeile,
    );
  }

  // HERKUNFT UND STAND liegen hinter „Mehr" → „Quellen und Belege". Beides mit der Tastatur.
  const quellen = await klappeQuellenAuf(seite, t, tastatur, "");
  expect(quellen, "am wieder geöffneten Objekt steht die Herkunft SharePoint nicht").toContain(
    "SharePoint",
  );
  expect(quellen, "am wieder geöffneten Objekt steht die Originaladresse nicht").toContain(
    NOTIZ.webUrl,
  );

  // DIE AUFNAHMEZEIT DER QUELLE, sichtbar daneben (`MehrAbschnitte.tsx`). Sie wird NICHT
  // nachgerechnet — eine zweite Zeitformatierung im Test wäre eine zweite Wahrheit. Verlangt ist,
  // dass überhaupt eine lesbare Zeit dasteht; das Produkt zeigt an dieser Stelle bewusst NICHTS
  // statt eines geratenen Datums (`koSource.ts`), und genau dieses Nichts soll auffallen.
  const quellenZeit = await sichtbarerText(
    seite,
    testid("bib-quelle-zeit"),
    "die sichtbare Aufnahmezeit der Quelle",
  );
  expect(quellenZeit, "neben der Herkunft steht keine lesbare Aufnahmezeit").not.toBe("");

  // ── JOB 4360 · UND DER QUELLSTAND: WELCHE FASSUNG DER DATEI HIER ANGEKOMMEN IST. ──────────
  const quellstand = await liesDenQuellstand(seite, t, QUELLSTAND, "erster Import");
  return { titel, text, quellen, quellenZeit, quellstand };
}

/** Der Quellenabschnitt, an EINER Stelle — die Schreibweise läuft sonst auseinander. */
const QUELLEN_ABSCHNITT = `details[data-bib-abschnitt="quellen"]`;

/**
 * „Mehr" und „Quellen und Belege" mit der TASTATUR öffnen und die Quellenliste sichtbar lesen.
 *
 * `marke` unterscheidet die Tastaturstationen der verschiedenen Durchgänge (erster Import, zweite
 * Fassung, die beiden anderen Sprachen). Sie sind EINZELN gezählt und nicht überschrieben: sonst
 * bliebe unbemerkt, dass genau einer dieser Wege nicht mehr mit der Tastatur erreichbar ist.
 *
 * Beide Klappen stehen nach jedem Seitenaufbau wieder zu (`BibliothekLesen.tsx`, `mehrOffen`, und
 * `MehrAbschnitte.tsx`, `offene` — beides `useState` ohne Speicher), der Weg ist also nach jedem
 * `goto` derselbe.
 */
async function klappeQuellenAuf(
  seite: Seite,
  t: Uebersetzer,
  tastatur: Record<string, number>,
  marke: string,
): Promise<string> {
  tastatur[`mehrAufklappen${marke}`] = await tastaturAusloesen(seite, t("lib.lesen.mehr"));
  await warteAufSichtbar(
    seite,
    `${QUELLEN_ABSCHNITT} > summary`,
    "der Abschnitt „Quellen und Belege“",
  );
  tastatur[`quellenAufklappen${marke}`] = await mitLeertaste(
    seite,
    `${QUELLEN_ABSCHNITT} > summary`,
    "Abschnitt „Quellen und Belege“",
  );
  // GEWARTET WIRD AUF DAS DASEIN, GEPRÜFT WIRD DIE SICHTBARKEIT — und das ist kein Rückschritt.
  //
  // Die Zusicherung bleibt Zeichen für Zeichen dieselbe: `sichtbarerText` unten stellt genau die
  // Fragen, die `warteAufSichtbar` gestellt hätte, samt jedem texttragenden Nachkommen. Verschieden
  // ist nur die MELDUNG im Fehlerfall. Gemessen in der Ausblend-Gegenprobe dieser Runde
  // (Arbeitsprüfung `df853724cce8423f83d2156d1d8b3a4e`): mit `display:none` am Quellstand wurde die
  // ganze `ul` „nicht sichtbar", die Wartebedingung trat nie ein, und der Lauf scheiterte nach
  // 60 000 ms an der Frist — rot, aber die Meldung zeigte auf die Uhr statt auf das ausgeblendete
  // Feld. Dieselbe Lehre steht in Abschnitt 8 dieser Datei: die Meldung soll auf die Sache zeigen,
  // nicht auf ihre Folge.
  await warte(
    seite,
    "(sel) => document.querySelector(sel) !== null",
    "die Quellenliste des Wissensobjekts steht im Baum",
    `${QUELLEN_ABSCHNITT} ul`,
    60_000,
  );
  return sichtbarerText(seite, `${QUELLEN_ABSCHNITT} ul`, "die Quellenliste des Wissensobjekts");
}

/**
 * JOB 4360 · DER SICHTBARE QUELLSTAND — EXAKT, nicht „enthält".
 *
 * ================================================================================================
 * RUNDE 2, BENs KORREKTURPFLICHT 1 — WARUM `toContain` HIER NICHT GENÜGT.
 * ================================================================================================
 *
 * BEN hat in `koSource.ts` `String(sourceVersion)` durch `String(sourceVersion) + "0"` ersetzt. Die
 * Fläche zeigte danach „Version 17892045000" statt „Version 1789204500" — ein falscher Quellstand,
 * und ein Mensch hätte eine Fassung gelesen, die es nie gab. Dieser Nachweis blieb GRÜN (Cloud-Lauf
 * `c769261f36b41f912ee93a35`, `BEN falsified-browser EXIT=0`), denn „17892045000" ENTHÄLT
 * „1789204500". Eine Teilzeichenkette ist für eine ZAHL die falsche Frage.
 *
 * GEPRÜFT WIRD DESHALB IN ZWEI SCHRITTEN, und beide sind nötig:
 *   1. DIE ZIFFERNFOLGE FÜR SICH, exakt. Sie fängt genau BENs Fall — eine angehängte, eine
 *      fehlende oder eine vorangestellte Ziffer macht rot, und die Meldung zeigt auf die Zahl.
 *   2. DER GANZE SICHTBARE TEXT, exakt gegen „<Beschriftung> <Wert>". Er fängt alles, was die
 *      Ziffernprüfung nicht sieht: eine fehlende Beschriftung, ein zweiter Wert daneben, eine
 *      angehängte Einheit, ein Platzhalter hinter der Zahl.
 * Schritt 2 allein täte es auch, Schritt 1 steht davor, weil seine Meldung die Sache benennt statt
 * zwei lange Zeichenketten gegeneinanderzustellen.
 *
 * DER SOLLWERT WIRD ZUSAMMENGESETZT, NICHT ABGESCHRIEBEN: Beschriftung aus dem Katalog der GERADE
 * eingestellten Sprache, Wert aus derselben API-Antwort, die wenige Zeilen vorher gelesen wurde.
 * Damit ist auch die zweite Zusage exakt: ein nur auf Deutsch vorhandenes Wort wäre in „nl" eine
 * Lücke, die niemand sähe.
 *
 * Gelesen wird mit `sichtbarerText`: DOM-Anwesenheit ist kein Nachweis (Lehre 4295 R1–R3).
 */
async function liesDenQuellstand(
  seite: Seite,
  t: Uebersetzer,
  sollStand: number,
  wo: string,
): Promise<string> {
  const gelesen = await sichtbarerText(
    seite,
    testid("bib-quelle-stand"),
    `der sichtbare Quellstand der Quelle (${wo})`,
  );
  // Die Ziffern des sichtbaren Textes, als eine Zeichenkette. Steht dort mehr als eine Zahl oder
  // eine Ziffer zu viel, stimmt sie nicht mehr mit dem Bestand überein.
  const ziffern = gelesen.replace(/\D+/g, "");
  expect(
    ziffern,
    `${JOB}: am Objekt steht als Quellstand nicht GENAU der gespeicherte Wert ${sollStand} (${wo}) — sichtbare Ziffern: „${ziffern}", gelesen: „${gelesen}"`,
  ).toBe(String(sollStand));
  const erwartet = `${t("w2.source.version")} ${sollStand}`;
  expect(
    gelesen,
    `${JOB}: der sichtbare Quellstand ist nicht „${erwartet}" (${wo}) — gelesen: „${gelesen}"`,
  ).toBe(erwartet);
  return gelesen;
}

/**
 * ================================================================================================
 * JOB 4360 · DIE ZWEITE FASSUNG DERSELBEN DATEI — und ob ein Mensch ihr Ankommen SIEHT.
 * ================================================================================================
 *
 * DER SATZ, DEN DIESER ABSCHNITT MISST: „Jemand überarbeitet die Datei in SharePoint. Dieselbe
 * Person importiert sie erneut, nimmt sie an — und liest am Wissensobjekt, dass jetzt die NEUE
 * Fassung dort steht."
 *
 * WARUM DAS NICHT SCHON ANDERSWO STEHT. Dass der Import-Kern den höheren Stand übernimmt, misst
 * `tests/app/import-update-versioning.test.ts` seit WP-IC-6b am Dienst. Dass er ihn danach an
 * `GET /api/kos/:id` ausliefert, misst Abschnitt 8 dieser Strecke. Was bis JOB 4360 NIRGENDS stand:
 * dass irgendjemand den Unterschied zwischen erster und zweiter Fassung an der Fläche ABLESEN kann.
 * Genau das war die offene Bestellung aus 4295 R3/R4.
 *
 * DIE ENTSCHEIDENDE ZEILE IST DER VERGLEICH ZWEIER VERSCHIEDENER WERTE: vorher stand
 * `QUELLSTAND` sichtbar da (Abschnitt 12), nachher `QUELLSTAND_NEU`. Ein Test, der nur „irgendeine
 * Zahl" verlangte, bliebe auch dann grün, wenn die Fläche den alten Stand einfach stehen liesse —
 * und das ist genau der Fehler, den dieser Auftrag ausschliesst.
 *
 * UND ES ENTSTEHT KEIN ZWEITES WISSENSOBJEKT: dieselbe Kennung vorher wie nachher. Der Re-Sync
 * schreibt das BESTEHENDE Objekt fort (`library-analytics/src/service.ts`, `acceptToKo`); eine
 * zweite Kennung wäre eine Dublette und keine neue Fassung.
 */
async function fahreDieZweiteFassung(a: {
  seite: Seite;
  basis: string;
  koId: string;
  t: Uebersetzer;
  tastatur: Record<string, number>;
}): Promise<Omit<NeueFassungBefund, "jeSprache">> {
  const { seite, basis, koId, t, tastatur } = a;
  // Ab hier meldet die Gegenstelle die Notiz mit einem SPÄTEREN Änderungszeitpunkt — dieselbe
  // Kennung, dieselbe Adresse, neuer Stand.
  doppel.neuerStand = true;

  // ── Zurück auf die Importseite, frisch geladen: die Liste holt den neuen Stand selbst. ─────
  await seite.goto(`${basis}/import`, { waitUntil: "domcontentloaded" });
  await warteAufSichtbar(
    seite,
    testid(`sharepoint-datei-${NOTIZ.id}`),
    "die SharePoint-Dateiliste vor dem Import der zweiten Fassung",
  );

  // ── DER BEZUGSWERT: was in der Warteschlange VOR der zweiten Fassung sichtbar stand. ──────
  // Sie wird dafür zuerst aufgeklappt — eine zugeklappte Liste zeigt niemandem etwas, und gezählt
  // wird nur, was ein Mensch sieht.
  tastatur.warteschlangeAufklappenZweiteFassung = await mitLeertaste(
    seite,
    "details#import-review-queue > summary",
    "Verlaufskasten der Prüf-Warteschlange (zweite Fassung)",
  );
  await warte(
    seite,
    SICHTBARE_KARTE_VORHANDEN,
    "die Prüf-Warteschlange führt die Datei schon vor der zweiten Fassung SICHTBAR",
    [testid("imp-kandidat-titel"), NOTIZ.name],
    60_000,
  );
  const kartenVorher = await seite.evaluate<number>(fn(SICHTBARE_KARTEN_MIT_TITEL), [
    testid("imp-kandidat-titel"),
    NOTIZ.name,
  ]);

  tastatur.ankreuzenZweiteFassung = await mitLeertaste(
    seite,
    `[data-testid="sharepoint-datei-${NOTIZ.id}"]`,
    `Ankreuzfeld ${NOTIZ.name} (zweite Fassung)`,
  );
  await warte(
    seite,
    `(id) => (document.querySelector('[data-testid="sharepoint-inhaltstyp-' + id + '"]') || {}).dataset?.gemessen === "text"`,
    "der Befund zur zweiten Fassung steht an der Zeile",
    NOTIZ.id,
    60_000,
  );
  tastatur.uebernehmenZweiteFassung = await tastaturAusloesen(
    seite,
    t("imp.sharepoint.uebernehmen"),
  );
  await warteAufSichtbar(
    seite,
    testid("sharepoint-ergebnis"),
    "das Ergebnisbild der zweiten Fassung",
  );

  // ── GENAU EIN NEUER VORGANG — an der Liste im Browser gesehen, nicht an einer Antwortzahl. ─
  //
  // Gewartet wird auf `kartenVorher + 1`: die zweite Fassung legt einen Vorgang an, keine zwei.
  // Bliebe es bei `kartenVorher`, hätte der Import gar nichts eingereiht (dann liefe die Annahme
  // gleich darauf ins Leere) — beide Abwege fallen hier auf, bevor sie eine Folge haben.
  const kartenNachher = kartenVorher + 1;
  await warte(
    seite,
    KARTENZAHL_ERREICHT,
    `die Prüf-Warteschlange führt die Datei ${kartenNachher}-mal SICHTBAR (vorher ${kartenVorher})`,
    [testid("imp-kandidat-titel"), NOTIZ.name, kartenNachher],
    60_000,
  );
  tastatur.annehmenZweiteFassung = await tastaturAusloesen(seite, t("imp.accept"));
  await warte(
    seite,
    `(soll) => [...document.querySelectorAll('button, a[href], [role="button"]')]
       .every((k) => !(k.textContent || "").includes(soll))`,
    "die zweite Fassung ist entschieden — kein Annahmeknopf mehr auf der Seite",
    t("imp.accept"),
    60_000,
  );

  // ── DER BESTAND, aus der Seite heraus gelesen: derselbe Träger, neuer Stand. ───────────────
  const kandidaten = await ausDerSeite<{ id: string; status: string; koId: string | null }[]>(
    seite,
    "/api/library/import/candidates",
  );
  const zweite = kandidaten.filter((k) => k.status === "angenommen" && k.koId !== null);
  expect(
    [...new Set(zweite.map((k) => k.koId))],
    "die zweite Fassung ist in ein ANDERES Wissensobjekt gelaufen",
  ).toEqual([koId]);
  const ko = await ausDerSeite<{
    sources: { externalId?: string; sourceVersion?: number }[];
  }>(seite, `/api/kos/${koId}`);
  const anker = ko.sources.find((s) => s.externalId === NOTIZ.id);
  expect(anker, "nach der zweiten Fassung hängt am Objekt kein Herkunfts-Anker mehr").toBeDefined();
  expect(anker?.sourceVersion, "der Bestand führt nicht den neuen Quellstand").toBe(QUELLSTAND_NEU);

  // ── UND JETZT MIT DEN AUGEN EINES MENSCHEN: das Objekt, wieder geöffnet. ───────────────────
  await seite.goto(`${basis}/wissen/${koId}`, { waitUntil: "domcontentloaded" });
  await warteAufSichtbar(seite, testid("bib-titel"), "der Titel nach der zweiten Fassung");
  await klappeQuellenAuf(seite, t, tastatur, "ZweiteFassung");
  const standSichtbar = await liesDenQuellstand(seite, t, QUELLSTAND_NEU, "zweite Fassung");
  // DIE ZEILE, DIE DEN UNTERSCHIED MACHT: der ALTE Stand steht nicht mehr da. Ohne sie bliebe eine
  // Fläche grün, die beide Stände nebeneinander zeigt oder den alten nie ablöst.
  expect(
    standSichtbar,
    `${JOB}: nach der zweiten Fassung steht immer noch der alte Quellstand ${QUELLSTAND} da`,
  ).not.toContain(String(QUELLSTAND));
  return {
    koId,
    standAmBestand: Number(anker?.sourceVersion),
    standSichtbar,
    kartenDazu: kartenNachher - kartenVorher,
    kartenNachher,
  };
}

/**
 * ================================================================================================
 * JOB 4360 · DERSELBE QUELLSTAND IN „en" UND „nl" — im ECHTEN Browser, nicht im Katalogtest.
 * ================================================================================================
 *
 * WARUM ES NICHT REICHT, DEN KATALOG ZU BEFRAGEN (Lehre 4265 R1): dass `w2.source.version` in drei
 * Sprachen gepflegt ist, sagt nichts darüber, ob das Wort durch die gebaute Fläche bis auf den
 * Bildschirm kommt. Gemessen wird deshalb dasselbe Objekt, im selben Profil, über dieselbe Fläche —
 * nur die gespeicherte Sprachwahl wechselt.
 *
 * WIE DIE SPRACHE WECHSELT UND WARUM DAS EHRLICH IST: `profil` legt die Wahl als Startskript in den
 * Endgerätespeicher (`sprachwahl.ts`, `kw.sprache`, gelesen beim Start von `i18n.ts`). Ein WEITERES
 * Startskript läuft NACH dem ersten und überschreibt den Wert — das ist genau das, was ein Mensch
 * hinterlässt, der die Sprache umstellt. Das GEBIETSSCHEMA des Profils bleibt dabei `de-DE`
 * (`browserweg.ts`, `GEBIETSSCHEMA`): erscheint das niederländische Wort, dann WEIL die Fläche die
 * gespeicherte Wahl liest — und nicht, weil die Umgebung sie verraten hat.
 *
 * UND DER WECHSEL WIRD NACHGEMESSEN, nicht angenommen: erst muss `<html lang>` auf der neuen
 * Sprache stehen. Ohne diese Zeile läse ein fehlgeschlagener Wechsel weiterhin die deutsche Fläche,
 * und „Version" stünde dort auch auf Englisch — der Fall bliebe grün und bewiese nichts.
 */
async function liesDenStandInDenAnderenSprachen(a: {
  kontext: Kontext;
  seite: Seite;
  basis: string;
  koId: string;
  katalog: (sprache: string) => Uebersetzer;
  tastatur: Record<string, number>;
  sollStand: number;
}): Promise<Record<string, string>> {
  const gelesen: Record<string, string> = {};
  for (const sprache of SPRACHEN) {
    if (sprache === "de") {
      continue;
    }
    const t = a.katalog(sprache);
    await a.kontext.addInitScript(
      `try { localStorage.setItem("kw.sprache", ${JSON.stringify(sprache)}); } catch (e) {}`,
    );
    await a.seite.goto(`${a.basis}/wissen/${a.koId}`, { waitUntil: "domcontentloaded" });
    await warte(
      a.seite,
      "(s) => document.documentElement.lang === s",
      `die Fläche steht auf „${sprache}"`,
      sprache,
      60_000,
    );
    await warteAufSichtbar(a.seite, testid("bib-titel"), `der Titel in „${sprache}"`);
    await klappeQuellenAuf(a.seite, t, a.tastatur, `_${sprache}`);
    const stand = await liesDenQuellstand(a.seite, t, a.sollStand, `Sprache ${sprache}`);
    // UND ES IST WIRKLICH DIESE SPRACHE: jede ANDERE Beschriftung, die sich von dieser
    // unterscheidet, darf hier nicht stehen. Wo zwei Kataloge dasselbe Wort führen (de/en:
    // „Version"), sagt diese Zeile nichts — und behauptet auch nichts.
    for (const andere of SPRACHEN) {
      const fremd = a.katalog(andere)("w2.source.version");
      if (fremd !== t("w2.source.version")) {
        expect(
          stand,
          `${JOB}: in „${sprache}" steht die Beschriftung aus „${andere}" („${fremd}")`,
        ).not.toContain(fremd);
      }
    }
    gelesen[sprache] = stand;
  }
  return gelesen;
}

/**
 * Warten, bis „Liste neu laden“ wirklich bedienbar ist.
 *
 * Ein gesperrter Knopf ist NICHT tastaturerreichbar (Chromium überspringt `button:disabled`) —
 * ohne diese Vorbedingung scheiterte der Tastaturweg an einer laufenden Auffrischung und die
 * Meldung zeigte auf den falschen Schuldigen.
 */
function bereitZumNeuLaden(seite: Seite): Promise<void> {
  return warte(
    seite,
    `() => (document.querySelector('[data-testid="sharepoint-neu-laden"]') || {}).disabled === false`,
    "„Liste neu laden“ ist bedienbar",
    undefined,
    60_000,
  );
}

/**
 * DIE VIER FEHLERLAGEN, IM ECHTEN BROWSER — und neben jedem Satz steht KEINE Inhaltszusage mehr.
 *
 * Drei Lagen stellt das Graph-Double (403 · 404 · 5xx); die vierte ist ein Fehler OHNE deutbaren
 * Code, und sie wird nicht nachgestellt, sondern hergestellt: der Browserkontext geht WIRKLICH
 * offline. Dann antwortet kein Server, es gibt keinen Code, und die Fläche fällt auf denselben
 * Satz („Verbindung weg") — genau der Fall, den `fehlerlagen.ts:58-62` mit `null` meint.
 *
 * Gemessen wird in allen vieren dasselbe Paar: der SICHTBARE Satz und die Abwesenheit jeder
 * Inhaltszusage. Es gibt keinen zweiten Fehlersatzkatalog — die Sollwerte kommen aus `i18n.ts`.
 */
async function fahreDieFehlerlagen(
  seite: Seite,
  kontext: KontextMitNetz,
  t: Uebersetzer,
  tastatur: Record<string, number>,
): Promise<Fehlerlagenbefund[]> {
  const befunde: Fehlerlagenbefund[] = [];
  const lagen: { lage: Graphlage; schluessel: string }[] = [
    { lage: "403", schluessel: "imp.sharepoint.fehler.keineBerechtigung" },
    { lage: "404", schluessel: "imp.sharepoint.fehler.nichtVorhanden" },
    { lage: "500", schluessel: "imp.sharepoint.fehler.verbindungWeg" },
  ];
  for (const { lage, schluessel } of lagen) {
    doppel.lage = lage;
    await bereitZumNeuLaden(seite);
    tastatur[`neuLaden_${lage}`] = await tastaturAusloesen(seite, t("imp.sharepoint.neuLaden"));
    // KALIBRIERT (BENs Korrekturpflicht 1): Ein Fehlersatz, der nur im Baum steht, ist für den
    // Menschen kein Fehlersatz. Gewartet wird auf Sichtbarkeit UND Wortlaut zugleich.
    await warteAufSichtbarenSatz(
      seite,
      testid("sharepoint-listenfehler"),
      t(schluessel),
      `der Satz zur Lage ${lage}`,
    );
    const zusagen = await seite.evaluate<string[]>(fn(INHALTSZUSAGEN));
    expect(zusagen, `neben dem Satz zur Lage ${lage} steht noch eine Inhaltszusage`).toEqual([]);
    const seitentext = await seite.evaluate<string>(fn(LIES_TEXT));
    for (const code of SERVERCODES) {
      expect(seitentext, `der rohe Servercode ${code} steht auf der Seite`).not.toContain(code);
    }
    befunde.push({
      lage,
      satz: await sichtbarerText(
        seite,
        testid("sharepoint-listenfehler"),
        `der Fehlersatz zur Lage ${lage}`,
      ),
      zusagen,
    });
  }

  // DIE VIERTE LAGE: kein Server, kein Code. Die Liste steht wieder (Lage `normal`), die Auswahl
  // löst eine Messung aus — und die findet offline gar nicht erst statt. Die Fläche behauptet
  // dann nichts über den Inhalt und lässt auch nichts übernehmen.
  doppel.lage = "normal";
  await bereitZumNeuLaden(seite);
  tastatur.neuLaden_zurueck = await tastaturAusloesen(seite, t("imp.sharepoint.neuLaden"));
  await warteAufSichtbar(
    seite,
    testid(`sharepoint-datei-${NOTIZ.id}`),
    "die Liste nach der Erholung",
  );
  await kontext.setOffline(true);
  try {
    // ANGEKREUZT WIRD DIE **ZWEITE** DATEI, und das ist kein Zufall: Für sie gibt es in diesem Lauf
    // noch keinen Messwert, also MUSS die Fläche wirklich messen wollen. Nähmen wir die erste,
    // hinge der Fall daran, ob react-query einen bereits gespeicherten Stand überhaupt noch einmal
    // holt — der Nachweis hätte dann einen Freiheitsgrad, den niemand kontrolliert.
    tastatur.ankreuzenOffline = await mitLeertaste(
      seite,
      `[data-testid="sharepoint-datei-${ANWEISUNG.id}"]`,
      `Ankreuzfeld ${ANWEISUNG.name} (offline)`,
    );
    await warteAufSichtbarenSatz(
      seite,
      testid("sharepoint-probefehler"),
      t("imp.sharepoint.fehler.verbindungWeg"),
      "der Satz zum Fehler ohne deutbaren Code",
    );
    const zusagen = await seite.evaluate<string[]>(fn(INHALTSZUSAGEN));
    // OFFLINE BLEIBT DIE LISTE SICHTBAR (§9: der alte Stand darf stehen bleiben) — was NICHT
    // stehen bleiben darf, ist eine GEMESSENE Zusage. Die Ankündigung an der Zeile ist keine.
    expect(zusagen, "offline steht eine gemessene Inhaltszusage auf der Seite").not.toContain(
      t("imp.sharepoint.vorschau.text"),
    );
    expect(
      await seite.evaluate<boolean>(
        fn(
          `() => (document.querySelector('[data-testid="sharepoint-uebernehmen"]') || {}).disabled === true`,
        ),
      ),
      "offline liesse sich übernehmen, ohne dass irgendetwas gemessen wurde",
    ).toBe(true);
    befunde.push({
      lage: "offline (kein deutbarer Code)",
      satz: await sichtbarerText(
        seite,
        testid("sharepoint-probefehler"),
        "der Fehlersatz ohne deutbaren Code",
      ),
      zusagen,
    });
  } finally {
    await kontext.setOffline(false);
  }
  return befunde;
}

// ------------------------------------------------------------------------------------------------
// DAS PROTOKOLL, DAS EIN MENSCH LESEN KANN (Lieferung 6).
// ------------------------------------------------------------------------------------------------
//
// EINE Zeile, auf stdout UND stderr: Chromium-Version, Port des echten Sockets, ob `dist` vorlag
// oder gebaut wurde, PostgreSQL-Version (oder der genannte Grund des Überspringens), die
// Objektkennung und die ersten Zeichen des WIRKLICH gelesenen Dateitexts. Wer sie liest, weiss,
// dass diese Stationen in EINEM Lauf zusammenhängen — und nicht in zweien nebeneinander.
export function schreibeProtokoll(zeile: string): void {
  process.stdout.write(`${zeile}\n`);
  process.stderr.write(`${zeile}\n`);
}

/** Der Browser, der seine Version kennt — Playwright kann das, `browserweg.ts` braucht es nicht. */
interface BrowserMitVersion extends Browser {
  version(): string;
}

export function protokollzeile(a: {
  browser: Browser;
  port: number;
  flaeche: string;
  datenhaltung: string;
  befund: GesamtwegBefund;
}): string {
  const version = (a.browser as BrowserMitVersion).version();
  return [
    `${JOB} GESAMTWEG`,
    `chromium=${version}`,
    `socket=127.0.0.1:${a.port}`,
    `dist=${a.flaeche}`,
    `datenhaltung=${a.datenhaltung}`,
    `ko=${a.befund.koId}`,
    `text="${a.befund.gelesenerText.slice(0, 48)}"`,
    // SICHTBAR gelesen, am WIEDER GEÖFFNETEN Objekt — die Station, die R1 und R2 gefehlt hat.
    `sichtbar-am-objekt="${a.befund.objektseite.text.replace(/\s+/g, " ").slice(0, 48)}"`,
    `aufnahmezeit-sichtbar="${a.befund.objektseite.quellenZeit}"`,
    // JOB 4360: WELCHE FASSUNG — erst nach dem ersten Import, dann nach der zweiten, je Sprache.
    `quellstand-sichtbar="${a.befund.objektseite.quellstand}"`,
    `quellstand-nach-zweiter-fassung="${a.befund.neueFassung.standSichtbar}"`,
    `quellstand-je-sprache=${Object.entries(a.befund.neueFassung.jeSprache)
      .map(([sprache, wert]) => `${sprache}:"${wert}"`)
      .join(",")}`,
    `fehlerlagen=${a.befund.fehlerlagen.length}`,
    "zustaende=leer+auffrischung",
  ].join(" · ");
}
