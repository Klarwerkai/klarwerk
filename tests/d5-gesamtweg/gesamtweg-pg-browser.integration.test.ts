// ================================================================================================
// JOB 4281 · DER D5-GESAMTWEG, EINMAL AM ECHTEN WEG GEMESSEN — NICHT AM NACHBAU.
// ================================================================================================
//
// WAS HIER ECHT IST, GLIED FÜR GLIED:
//   PostgreSQL-Zeile (Wissensobjekt, Anhang, Quelle, Freigabe, Vertraulichkeitsstufe, hochgeladenes
//   Original) → `buildPgServices(pool)` → die echten Dienste → HTTP-Route über einen ECHTEN SOCKET
//   (`app.listen({ port: 0 })`) → die GEBAUTE Fläche aus `apps/web/dist` (`registerWebStatic`) →
//   ein ECHTES Chromium → die Bedienung durch den Menschen → und beim Entzug zurück auf den
//   GESPEICHERTEN Stand.
//
// KEIN GLIED WIRD DURCH EINEN NACHBAU ERSETZT. Insbesondere gibt es hier KEIN `seite.route`-
// Abfangen der eigenen `/api/*`-Aufrufe (die Vorrichtung `tests/design/h4-harness.ts:66` tut genau
// das und taugt für dieses Ziel deshalb nicht) und KEIN `app.inject` auf dem BEDIENWEG. `inject`
// kommt ausschliesslich für Verwaltungsgriffe zum Einsatz, die ein Administrator an seiner eigenen
// Fläche macht (Bestand anlegen, Stufe hochsetzen, Modell umstellen) — und für die Gegenmessung
// desselben Serverstands mit den Helfern aus `kette.ts`.
//
// DER FACHLICHE ABLAUF IST NICHT ABGESCHRIEBEN. Er steht genau einmal in
// `tests/klara-quellen-nutzerweg/kette.ts` und wird von dort importiert (`eintragMitOriginal`,
// `neuesKonto`, `fragen`, `kosLesen`, `objektLesen`, `originalLesen`, `drahtAufbauen`,
// `adapterUmgebungSetzen`, `FRAGE`, `ORIGINALTEXT`, `ORIGINALNAME`, `QUELLENBEZEICHNUNG`,
// `BELEGSTELLE`). Entstünde hier ein ZWEITER Ablauf über dieselbe Sache, wäre das der Fehler.
//
// WAS DIESE DATEI GEGENÜBER `kette-postgres.integration.test.ts` HINZUFÜGT — und warum sie jene
// NICHT ablöst: jene Datei ist die testcontainers-Fassung und überspringt weiterhin ehrlich, wo
// keine Container-Laufzeit ist. Sie bleibt unverändert stehen. Diese hier nimmt den Weg, der auf
// dem Prüfplatz nachweislich LÄUFT (`guardedLocalPgTestUrl`, s. `platz.ts`), und sie misst
// zusätzlich das, was jene gar nicht messen kann: den ECHTEN SOCKET, das ECHTE CHROMIUM und das
// TATSÄCHLICHE NEULADEN nach einem App-Neustart.
//
// ================================================================================================
// DER KONTROLLIERTE MODELLADAPTER — BENANNT, NICHT VERSTECKT.
// ================================================================================================
//
// An der Stelle, an der im Betrieb die Cloud steht, antwortet in diesem Lauf der Adapter aus
// `kette.ts` (`drahtAufbauen`, angebunden über `KLARWERK_LOCAL_LLM_URL`; der Port wird nie
// geöffnet). Er erfindet nichts: er liest die nummerierte Quellenliste, die der Server ihm vorlegt,
// und antwortet mit deren Wortlaut. Auswahl, Grounding, Zitatdeckung, Rückfall und Anzeige laufen
// unverändert im Produkt.
//
// DAMIT DARF WEDER EINE REALE SEMANTISCHE ANTWORTQUALITÄT NOCH EINE MICROSOFT-365-HOST-ABNAHME
// BEHAUPTET WERDEN, UND ES ENTSTEHEN KEINE EXTERNEN MODELLKOSTEN. Der Quellen- und Fassungsbezug
// dagegen wird am TATSÄCHLICHEN Appweg gemessen — und genau darum geht es hier.
//
// WARUM DER DRAHT TROTZ ECHTEM SOCKET GREIFT: der Server läuft im selben Prozess wie dieser Test.
// Sein Modellaufruf geht über `globalThis.fetch` und wird dort abgefangen. Die Aufrufe des BROWSERS
// laufen dagegen über den Socket und sehen den Draht nie.
//
// ================================================================================================
// SICHTBARER SKIP STATT STILLEM GRÜN — UND ZWAR AN DER RICHTIGEN STELLE.
// ================================================================================================
//
// Ohne erreichbare Datenbank ruft jeder Fall `ctx.skip()`. Ein frühes `return` ist hier VERBOTEN:
// genau das war der Befund der Runde 4 von JOB 4224 (`kette-postgres.integration.test.ts:20-25`) —
// ein `return` ist in Vitest ein BESTANDENER Test, und der Lauf meldete „3 passed" auf stdout,
// während auf stderr die Übersprungmeldung stand. Wer diese Datei anfasst, prüft stdout UND stderr.
//
// EIN ÜBERSPRUNGENER FACHFALL IST HIER KEIN BESTANDENER FALL. Die Zählzeile am Ende des Laufs sagt
// das ausdrücklich (`afterAll`), und die Rückgabe dieses Jobs meldet einen übersprungenen Fachlauf
// als BLOCKADE.
//
// KEINE PRODUKTIVDATEN: eigene Wegwerf-Datenbanken je Fall (Name mit `test` UND `4281`), eigene
// Konten- und Titelkennungen mit `4281`, am Ende abgeräumt.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  BELEGSTELLE,
  type Draht,
  FRAGE,
  type Konto,
  ORIGINALNAME,
  ORIGINALTEXT,
  QUELLENBEZEICHNUNG,
  adapterUmgebungSetzen,
  drahtAufbauen,
  eintragMitOriginal,
  fragen,
  kosLesen,
  neuesKonto,
  objektLesen,
  originalLesen,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

import {
  type Browser,
  type Instanz,
  type Kontext,
  MELDUNG_KEINE_DATENBANK,
  type Pruefplatz,
  type Seite,
  type Wegwerfdatenbank,
  abrufAusDerSeite,
  anmelden,
  antworttext,
  anzahlAuf,
  belegAdressen,
  belegAnDerQuelle,
  belegLinkBetaetigen,
  ergebnisAbwarten,
  flaecheBereitstellen,
  fn,
  frageStellen,
  fragenflaecheOeffnen,
  instanzStarten,
  mehrOeffnen,
  profil,
  pruefplatzOeffnen,
  seitentext,
  starteChromium,
  warte,
} from "./platz";

const JOB = "[KLARWERK] JOB 4281";
/** Der Titel trägt die Auftragskennung — eigener Bestand, nicht der eines anderen Laufs. */
const TITEL = "Zylinderkopfdichtung XQ42 wechseln (JOB 4281)";
/** Eine Kennung, die es nie gegeben hat — der Maßstab für „nicht vorhanden". */
const ERFUNDEN = "gibt-es-nicht-4281";

let platz: Pruefplatz | undefined;
let skipGrund = "";
let browser: Browser | undefined;
let flaeche = "nicht hergestellt";
let chromiumFassung = "(nicht gelesen)";
let draht: Draht;

/** Die getrennte Zählung der FACHFÄLLE — Lieferung 5. „übersprungen" zählt NICHT als bestanden. */
const zaehlung = { bestanden: 0, fehlgeschlagen: 0, uebersprungen: 0 };

/**
 * Der Skip wird HIER gezählt und nicht in `afterEach` — gemessen, nicht angenommen.
 *
 * Die erste Fassung zählte alles in `afterEach` über `ctx.task.result.state`. Der Gegenprobenlauf
 * mit unerreichbarer Datenbank (Arbeitsprüfung ffe6b399…) hat gezeigt, dass das falsch ist: Vitest
 * meldete auf stdout „Tests 5 skipped (5)", die eigene Zeile daneben aber
 * „bestanden=0 · fehlgeschlagen=0 · übersprungen=0" — `afterEach` läuft nach einem `ctx.skip()`
 * gar nicht mehr, und damit blieb auch die ACHTUNG-Zeile aus. Eine Zählzeile, die den einen Zustand
 * verschweigt, gegen den dieser Auftrag antritt, wäre schlimmer als keine.
 *
 * Deshalb: `afterEach` zählt nur noch, was es sicher sieht (bestanden/fehlgeschlagen), und der
 * Übersprungzweig zählt sich selbst — er läuft IM Testkörper, unmittelbar vor `ctx.skip()`.
 */
function ueberspringen(ctx: { skip: () => void }): void {
  zaehlung.uebersprungen += 1;
  ctx.skip();
}

beforeAll(async () => {
  draht = drahtAufbauen();
  const ergebnis = await pruefplatzOeffnen();
  if (ergebnis.skipGrund !== undefined) {
    skipGrund = ergebnis.skipGrund;
    process.stderr.write(`${MELDUNG_KEINE_DATENBANK} ${skipGrund}\n`);
    return;
  }
  platz = ergebnis.platz;
  process.stderr.write(`${JOB} DB-STARTBELEG: ${platz.pgFassung}\n`);
  flaeche = flaecheBereitstellen();
  process.stderr.write(`${JOB} FLÄCHE: ${flaeche} (${process.cwd()}/apps/web/dist)\n`);
  browser = await starteChromium();
  chromiumFassung =
    typeof (browser as unknown as { version?: () => string }).version === "function"
      ? (browser as unknown as { version: () => string }).version()
      : "(Fassung nicht abfragbar)";
  process.stderr.write(`${JOB} BROWSER-STARTBELEG: Chromium ${chromiumFassung}\n`);
}, 900_000);

afterEach((ctx) => {
  const stand = ctx.task.result?.state;
  if (stand === "pass") {
    zaehlung.bestanden += 1;
  } else if (stand === "fail") {
    zaehlung.fehlgeschlagen += 1;
  }
});

afterAll(async () => {
  draht?.abbauen();
  await browser?.close().catch(() => undefined);
  await platz?.abraeumen();
  process.stderr.write(
    `${JOB} FACHFÄLLE GETRENNT GEZÄHLT: bestanden=${zaehlung.bestanden} · fehlgeschlagen=${zaehlung.fehlgeschlagen} · übersprungen=${zaehlung.uebersprungen}` +
      ` · PostgreSQL=${platz?.pgFassung ?? "(keine)"} · Chromium=${chromiumFassung} · Fläche=${flaeche}\n`,
  );
  if (zaehlung.uebersprungen > 0) {
    process.stderr.write(
      `${JOB} ACHTUNG: ein übersprungener Fachfall ist KEIN bestandener Fachfall — der D5-Gesamtweg gilt dann als NICHT gemessen.\n`,
    );
  }
}, 180_000);

// ================================================================================================
// DIE LAGE EINES FACHFALLS — eigene leere Datenbank, eigene App, eigenes Browserprofil.
// ================================================================================================
//
// JEDER FALL BEKOMMT EINE EIGENE WEGWERF-DATENBANK. Das ist kein Luxus: G5 misst einen Bestand
// OHNE Originalquelle, und läge daneben noch der Eintrag MIT Quelle aus G1, beantwortete das Produkt
// die Frage aus jenem — der Fall behauptete dann etwas über eine Lage, in der er nie war.

interface Fachlage {
  db: Wegwerfdatenbank;
  instanz: Instanz;
  admin: Konto;
  leser: Konto;
  kontext: Kontext;
  seite: Seite;
  /** Die Instanz kann im Lauf ausgetauscht werden (G2) — der Abbau greift immer die aktuelle. */
  setzeInstanz(neu: Instanz): void;
  abbauen(): Promise<void>;
}

async function fachlage(marke: string): Promise<Fachlage> {
  const p = platz as Pruefplatz;
  const db = await p.wegwerfdatenbank(marke);
  let instanz = await instanzStarten(db.pool);
  draht.setzeApp(instanz.app);
  const admin = await neuesKonto(instanz.app, `4281-${marke}-admin`);
  const leser = await neuesKonto(instanz.app, `4281-${marke}-leser`, admin);
  const { kontext, seite } = await profil(browser as Browser, { width: 1280, height: 900 });
  await anmelden(seite, instanz.basis, leser.email);
  return {
    db,
    get instanz() {
      return instanz;
    },
    admin,
    leser,
    kontext,
    seite,
    setzeInstanz(neu: Instanz) {
      instanz = neu;
      draht.setzeApp(neu.app);
    },
    async abbauen() {
      await kontext.close().catch(() => undefined);
      await instanz.schliessen().catch(() => undefined);
      draht.setzeApp(null);
      await db.schliessen();
    },
  };
}

/** Der Verwaltungsgriff eines Administrators an seiner eigenen Fläche — nie ein Schritt des Weges. */
async function alsAdmin(
  lage: Fachlage,
  verfahren: "PUT" | "POST",
  url: string,
  nutzlast: Record<string, unknown>,
  was: string,
): Promise<void> {
  const res = await lage.instanz.app.inject({
    method: verfahren,
    url,
    headers: lage.admin.kopf,
    payload: nutzlast,
  });
  expect(res.statusCode, `${was} gescheitert: ${res.body}`).toBe(200);
}

/** Die Frage stellen und auf eine ANTWORTKARTE warten — nicht auf „irgendein Ergebnis". */
async function frageBisAntwort(seite: Seite): Promise<void> {
  expect(await frageStellen(seite, FRAGE), "die Fläche liess die Frage gar nicht zu").toBe(
    "gestellt",
  );
  await ergebnisAbwarten(seite);
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="ask-answer"]')`,
    "die Antwortkarte steht",
    undefined,
    60_000,
  );
}

/**
 * Der angebotene Beleg wird ANGESEHEN — Zeile, Beschriftung, Adresse. Noch nicht gedrückt.
 *
 * Gibt die Adresse zurück, damit der Fachfall sie dem Direktabruf vorlegen kann. Der Direktabruf
 * ist seit Runde 2 ausdrücklich NICHT mehr der Nachweis des Bediengriffs, sondern eine ZWEITE,
 * andere Frage („kommt die Person auch ohne die Fläche an das Original?"). Der Bediengriff steht
 * in `belegBetaetigen`.
 */
async function belegAnsehen(seite: Seite, objectId: string): Promise<string> {
  await mehrOeffnen(seite);
  const beleg = await belegAnDerQuelle(seite, QUELLENBEZEICHNUNG);
  expect(
    beleg,
    `die Quelle „${QUELLENBEZEICHNUNG}" bietet keinen Weg zu ihrem Original an: ${(
      await seitentext(seite)
    ).slice(0, 800)}`,
  ).not.toBeNull();
  expect(
    (beleg as { href: string }).href,
    "der angebotene Weg zeigt nicht auf das hinterlegte Original",
  ).toBe(`/api/objects/${objectId}/raw`);
  expect((beleg as { text: string }).text).toContain(ORIGINALNAME);
  return (beleg as { href: string }).href;
}

/**
 * DER LETZTE BEDIENGRIFF: der angezeigte Link wird GEDRÜCKT, und was dabei herauskommt, wird auf
 * Dateiname und vollen Inhalt geprüft.
 *
 * DAS IST BENS KORREKTURPFLICHT 1 AUS RUNDE 1. Vorher stand hier ein `fetch` auf den ausgelesenen
 * `href`; seine Mutation `onClick={(event) => event.preventDefault()}` an allen drei Original-Links
 * liess den Fall trotzdem grün (sein Auftrag 1f640fac…). Mit diesem Griff wird derselbe Eingriff rot.
 *
 * VOR DEM KLICK wird gezählt: es darf GENAU EIN Beleg-Link auf der Fläche stehen. Ohne diese Zeile
 * wäre `seite.click('[data-testid="answer-source-original"]')` bei mehreren Treffern entweder
 * mehrdeutig oder träfe einen anderen als den gerade an der Quelle nachgewiesenen — dann bewiese
 * der Klick etwas über einen Link, den niemand geprüft hat.
 */
async function belegBetaetigen(lage: Fachlage, objectId: string): Promise<void> {
  const adresse = await belegAnsehen(lage.seite, objectId);
  expect(
    await anzahlAuf(lage.seite, '[data-testid="answer-source-original"]'),
    "es steht mehr als ein Beleg-Link auf der Fläche — dann ist der Klick nicht mehr eindeutig dem geprüften zugeordnet",
  ).toBe(1);
  const folge = await belegLinkBetaetigen(lage.kontext, lage.seite);
  expect(
    folge.art,
    `das Drücken des Beleg-Links (${adresse}) hat das Original nicht geöffnet — der Klick machte auf: ${
      folge.art === "kein-download"
        ? folge.neueFenster.join(" | ").slice(0, 600) || "(gar nichts)"
        : ""
    }`,
  ).toBe("download");
  const geladen = folge as { art: "download"; dateiname: string; inhalt: string };
  expect(geladen.dateiname, "die geöffnete Datei trägt einen anderen Namen als das Original").toBe(
    ORIGINALNAME,
  );
  expect(geladen.inhalt, "der gedrückte Beleg führt nicht zum VOLLSTÄNDIGEN Original").toBe(
    ORIGINALTEXT,
  );
}

describe("JOB 4281 · D5 · G — der Gesamtweg auf echtem PostgreSQL, im echten Browser", () => {
  // ==============================================================================================
  // G1 · VON DER FRAGE BIS ZUM VOLLSTÄNDIGEN ORIGINAL — EINMAL GANZ.
  // ==============================================================================================
  it("G1 · berechtigte Person: Frage → Antwort → Beleg → vollständiges Original", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("g1");
    try {
      const eintrag = await eintragMitOriginal(lage.instanz.app, lage.admin, { titel: TITEL });
      const vorher = draht.lage.generierungen;

      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      await frageBisAntwort(lage.seite);
      expect(
        draht.lage.generierungen,
        "der kontrollierte Adapter wurde nicht befragt — dann misst dieser Fall etwas anderes als beschrieben",
      ).toBeGreaterThan(vorher);

      // ── DIE ANTWORT WIRD GELESEN, nicht nur gezählt (BENs Prüflücke 6 der Runde 1: „konkrete
      //    Assertions für den sichtbaren Antwortwortlaut" fehlten). Der kontrollierte Adapter
      //    antwortet mit dem WORTLAUT der Quelle, die der Server ihm vorgelegt hat; genau dieser
      //    Satz muss auf der Antwortkarte stehen. Eine leere Karte mit einer Fussnote wäre sonst
      //    ebenso grün wie eine getragene Antwort.
      const gelesen = await antworttext(lage.seite);
      expect(gelesen, "die Antwortkarte trägt keinen Text").not.toBeNull();
      expect(
        gelesen as string,
        `die Antwortkarte zeigt nicht den belegten Wortlaut der Quelle: ${(gelesen as string).slice(0, 400)}`,
      ).toContain(BELEGSTELLE);

      // ── UND JETZT DER LETZTE BEDIENGRIFF: der angezeigte Beleg wird GEDRÜCKT.
      await belegBetaetigen(lage, eintrag.objectId);

      // ── ZWEITE, ANDERE FRAGE: kommt dieselbe Person auch über den Direktabruf an das Original?
      //    Das ist NICHT der Bediennachweis von eben, sondern die Rechtelage darunter — G3 misst
      //    dieselbe Stelle nach dem Entzug und braucht diese Kalibrierung.
      const direkt = await abrufAusDerSeite(lage.seite, `/api/objects/${eintrag.objectId}/raw`);
      expect(
        direkt.status,
        `das Original ist über den Direktabruf nicht erreichbar: ${direkt.text.slice(0, 300)}`,
      ).toBe(200);
      expect(direkt.text).toBe(ORIGINALTEXT);

      // Und die ehrliche Gegenaussage steht NICHT da, wenn es ein Original gibt.
      expect(
        await lage.seite.evaluate<boolean>(
          fn(`() => !!document.querySelector('[data-testid="answer-source-no-original"]')`),
        ),
        'die Fläche behauptet „kein Original", obwohl eines hinterlegt ist',
      ).toBe(false);

      // Die Zeile liegt WIRKLICH in PostgreSQL — nachgesehen, nicht angenommen.
      const zeile = await lage.db.pool.query<{ anzahl: string }>(
        "SELECT count(*)::text AS anzahl FROM kos WHERE id = $1",
        [eintrag.koId],
      );
      expect(zeile.rows[0]?.anzahl, "der Eintrag steht nicht in der Datenbank").toBe("1");
      process.stderr.write(`${JOB} G1 GRÜN · ${lage.db.name} · ${lage.instanz.basis}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // G2 · APP-NEUSTART UND ECHTES NEULADEN — DER GESPEICHERTE STAND GILT, NICHT DER SPEICHER.
  // ==============================================================================================
  //
  // EIN `unmount()/mount()` ZÄHLT DAFÜR AUSDRÜCKLICH NICHT, und das ist der Grund, aus dem dieser
  // Fall überhaupt existiert: `flaeche-fuehrt-zum-original.test.tsx:343-351` baut die Seite in jsdom
  // neu auf und misst damit den React-Baum, nicht den Browser. Hier wird die APP abgebaut und auf
  // DEMSELBEN Port neu aufgebaut, und die Seite mit `goto(<dieselbe Adresse>, { waitUntil: "load" })`
  // wirklich neu geladen. Dass es ein echtes Neuladen war, wird nicht behauptet, sondern gemessen:
  // eine Marke am `window` überlebt einen Neuaufbau des React-Baums, ein Neuladen aber nicht.
  it("G2 · App-Neustart und echtes Neuladen: Bestand und Quellenbezug stimmen weiter", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("g2");
    try {
      const eintrag = await eintragMitOriginal(lage.instanz.app, lage.admin, { titel: TITEL });
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      await frageBisAntwort(lage.seite);
      await belegBetaetigen(lage, eintrag.objectId);

      // Die Marke, an der sich ein echtes Neuladen von einem Neuaufbau unterscheidet.
      await lage.seite.evaluate<boolean>(
        fn(`() => { window.__kw4281 = "vor dem Neustart"; return true; }`),
      );
      expect(
        await lage.seite.evaluate<string>(fn(`() => window.__kw4281 || "weg"`)),
        "die Marke sitzt nicht — dann kann dieser Fall das Neuladen nicht belegen",
      ).toBe("vor dem Neustart");

      // ── DIE APP WIRD WIRKLICH ABGEBAUT UND NEU AUFGEBAUT. Dieselbe Adresse, dieselbe Datenbank.
      const port = lage.instanz.port;
      const alteBasis = lage.instanz.basis;
      await lage.instanz.schliessen();
      const neu = await instanzStarten(lage.db.pool, port);
      lage.setzeInstanz(neu);
      expect(neu.basis, "der Neustart hat eine andere Adresse bekommen").toBe(alteBasis);
      process.stderr.write(`${JOB} G2 NEUSTARTBELEG: App neu aufgebaut auf ${neu.basis}\n`);

      // ── DAS ECHTE NEULADEN.
      await fragenflaecheOeffnen(lage.seite, neu.basis);
      expect(
        await lage.seite.evaluate<string>(fn(`() => window.__kw4281 || "weg"`)),
        "die Marke hat überlebt — dann war das kein Neuladen, sondern ein Neuaufbau",
      ).toBe("weg");
      process.stderr.write(`${JOB} G2 NEULADEBELEG: Marke nach goto(load) weg\n`);

      // ── DIE SITZUNG TRÄGT WEITER: sie liegt in der Datenbank, nicht im Speicher der alten App.
      expect(
        await lage.seite.evaluate<boolean>(fn(`() => !!document.querySelector("#auth-email")`)),
        "nach dem Neustart steht die Anmeldemaske da — die Sitzung lag im Speicher, nicht in der Datenbank",
      ).toBe(false);

      // ── DER BESTAND STIMMT NOCH, gelesen über den echten Socket aus der Seite heraus.
      const bestand = await abrufAusDerSeite(lage.seite, "/api/kos");
      expect(
        bestand.status,
        `der Bestand ist nach dem Neustart nicht lesbar: ${bestand.text}`,
      ).toBe(200);
      expect(bestand.text, "der Eintrag hat den App-Neustart nicht überlebt").toContain(
        eintrag.koId,
      );

      // ── UND DER QUELLENBEZUG STIMMT NOCH: dieselbe Frage, derselbe Beleg, dasselbe Original —
      //    wieder durch DRÜCKEN des angezeigten Links, nicht durch einen Abruf daneben.
      await frageBisAntwort(lage.seite);
      await belegBetaetigen(lage, eintrag.objectId);
      process.stderr.write(`${JOB} G2 GRÜN · ${lage.db.name} · ${neu.basis}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // G3 · RECHTEENTZUG — WEDER DIE OFFENE ANSICHT NOCH EIN ERNEUTER DIREKTABRUF FÜHRT ZUM ORIGINAL.
  // ==============================================================================================
  //
  // DER ENTZUG IST DER ECHTE PRODUKTWEG, kein Testschalter: der Eintrag wird auf `vertraulich`
  // hochgestuft (`PUT /api/kos/:id`, `action: "confidentiality"`). Ab da gilt `darfSehen`
  // (`services/app/src/sichtbarkeit.ts:67-77`): vertraulich sieht nur, wer `ko.validate` trägt oder
  // der Autor ist. Die fragende Person ist beides nicht.
  //
  // DIESER FALL SCHLIESST DIE GEMEINTE FEHLERKLASSE AUS: geprüft wird nicht nur die Oberfläche,
  // sondern der ERNEUTE DIREKTABRUF aus der SCHON OFFENEN Seite — ein Produkt, das die Sperre erst
  // in der Ansicht anwendet, lässt G3 rot.
  it("G3 · Rechteentzug: offene Ansicht und erneuter Direktabruf führen nicht mehr zum Original", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("g3");
    try {
      const eintrag = await eintragMitOriginal(lage.instanz.app, lage.admin, { titel: TITEL });
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      await frageBisAntwort(lage.seite);

      // KALIBRIERUNG: vorher trug der Weg — und zwar durch DRÜCKEN. Ohne sie wäre „gesperrt" auch
      // für eine Fläche grün, die nie etwas gezeigt hat.
      await belegBetaetigen(lage, eintrag.objectId);
      const belegAdresse = `/api/objects/${eintrag.objectId}/raw`;

      // KALIBRIERUNG DER ZÄHLER (BENs Prüflücke 6: „gesperrten Treffer ausschliesslich numerisch
      // preisgeben"). Erst wenn die Zahlen VORHER von null verschieden sind, sagt ihr Nullwerden
      // nachher etwas aus. Der Bestand dieser Datenbank besteht aus genau diesem einen Eintrag.
      const bestandVorher = JSON.parse(
        (await abrufAusDerSeite(lage.seite, "/api/kos")).text,
      ) as unknown[];
      expect(bestandVorher.length, "der Bestand dieses Falls ist nicht der erwartete").toBe(1);
      const chipsVorher = await anzahlAuf(lage.seite, '[data-testid="ask-quellen-chip"]');
      expect(
        chipsVorher,
        "vor dem Entzug zeigt die Fläche gar keinen Quellen-Chip",
      ).toBeGreaterThan(0);

      await alsAdmin(
        lage,
        "PUT",
        `/api/kos/${eintrag.koId}`,
        { action: "confidentiality", level: "vertraulich" },
        "Hochstufung auf vertraulich",
      );

      // ── DIE SCHON OFFENE ANSICHT, ZUERST MIT DEM BEDIENGRIFF. Der Link steht noch da (die Seite
      //    weiss vom Entzug nichts) — ein Mensch würde also darauf drücken. Es darf dabei NICHTS
      //    herauskommen, was das Original trägt.
      //
      //    ZWEI VERSCHIEDENE ZUSICHERUNGEN, und die Trennung ist gemessen (s. `belegLinkBetaetigen`):
      //    · DER ORIGINALINHALT darf in KEINEM Fenster stehen — auch nicht im schon offenen. Er hat
      //      dort nie gestanden (er ist der Dateiinhalt, nicht der Bildschirmtext), also ist das
      //      eine harte Aussage und keine leere.
      //    · DER TITEL der gesperrten Quelle darf in keinem NEU geöffneten Fenster stehen. Auf der
      //      Ausgangsseite steht er weiter, und das ist richtig so: sie wurde vor dem Entzug
      //      ausgeliefert, und eine schon ausgelieferte Kopie holt keine Oberfläche zurück
      //      (dieselbe ehrliche Grenze wie `flaeche-fuehrt-zum-original.test.tsx:330-341`). Dass
      //      sie beim nächsten Aufbau weg ist, misst dieser Fall weiter unten.
      const nachEntzugGedrueckt = await belegLinkBetaetigen(
        lage.kontext,
        lage.seite,
        '[data-testid="answer-source-original"]',
        5_000,
      );
      if (nachEntzugGedrueckt.art === "download") {
        expect(
          nachEntzugGedrueckt.inhalt,
          "das Drücken des noch angezeigten Links hat das gesperrte Original geladen",
        ).not.toBe(ORIGINALTEXT);
      } else {
        for (const fenstertext of nachEntzugGedrueckt.alleFenster) {
          expect(
            fenstertext,
            "nach dem Klick steht der gesperrte Originalinhalt in einem offenen Fenster",
          ).not.toContain(ORIGINALTEXT);
        }
        for (const neuesFenster of nachEntzugGedrueckt.neueFenster) {
          expect(
            neuesFenster,
            "der Klick hat ein Fenster aufgemacht, das den Titel der gesperrten Quelle trägt",
          ).not.toContain(TITEL);
        }
      }
      process.stderr.write(
        `${JOB} G3 KLICK NACH ENTZUG: ${
          nachEntzugGedrueckt.art === "download"
            ? `Download „${nachEntzugGedrueckt.dateiname}" ohne Originalinhalt`
            : `kein Download · neu geöffnet: ${nachEntzugGedrueckt.neueFenster.length} Fenster${
                nachEntzugGedrueckt.neueFenster.length > 0
                  ? ` (${nachEntzugGedrueckt.neueFenster.join(" | ").slice(0, 200)})`
                  : ""
              }`
        }\n`,
      );

      // ── UND DERSELBE ORT ÜBER DEN DIREKTABRUF: dieselbe Seite, dieselbe Adresse, kein Neuladen.
      const gesperrt = await abrufAusDerSeite(lage.seite, belegAdresse);
      const erfunden = await abrufAusDerSeite(lage.seite, `/api/objects/${ERFUNDEN}/raw`);
      expect(
        gesperrt.status,
        `das Original ist aus der offenen Ansicht noch abrufbar: ${gesperrt.text.slice(0, 300)}`,
      ).toBe(404);
      // Nicht erlaubt sieht aus wie nicht vorhanden — sonst wird die Absage zum Existenzorakel.
      expect(gesperrt.status).toBe(erfunden.status);
      expect(
        gesperrt.text,
        "die Absage unterscheidet sich von der für eine erfundene Kennung",
      ).toBe(erfunden.text);
      expect(gesperrt.text, "der Fehlertext trägt den geschützten Inhalt").not.toContain(
        ORIGINALTEXT,
      );
      expect(gesperrt.text, "der Fehlertext nennt den Titel der gesperrten Quelle").not.toContain(
        TITEL,
      );

      // ── DER ERNEUTE DIREKTABRUF nach einem echten Neuladen — auch der führt nicht zurück.
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      const nachNeuladen = await abrufAusDerSeite(lage.seite, belegAdresse);
      expect(nachNeuladen.status, "nach dem Neuladen trägt der Direktabruf wieder").toBe(404);
      expect(nachNeuladen.text).not.toContain(ORIGINALTEXT);

      // ── UND DIE FLÄCHE BIETET DEN WEG NICHT MEHR AN: dieselbe Frage, jetzt eine Wissenslücke.
      expect(await frageStellen(lage.seite, FRAGE)).toBe("gestellt");
      await warte(
        lage.seite,
        `() => !document.querySelector('[data-testid="ask-pending"]') && !!document.querySelector('[data-testid="ask-gap"]')`,
        "die Antwort ist eine ehrliche Wissenslücke",
        undefined,
        60_000,
      );
      expect(
        await lage.seite.evaluate<boolean>(
          fn(`() => !!document.querySelector('[data-testid="ask-answer"]')`),
        ),
        "die Fläche stützt sich weiter auf den gesperrten Eintrag",
      ).toBe(false);
      // Das Blatt „Mehr" wird GEÖFFNET, bevor gemessen wird: läge es zu, stünde die Quellenliste
      // gar nicht im Baum, und „kein Weg zum Original" wäre eine leere Aussage über eine Fläche,
      // die man nicht angesehen hat.
      await mehrOeffnen(lage.seite);
      expect(
        await belegAdressen(lage.seite),
        "die Fläche bietet das Original der gesperrten Quelle weiter an",
      ).not.toContain(belegAdresse);

      // ── VORSCHAU UND FEHLERTEXT VERRATEN NICHTS.
      const text = await seitentext(lage.seite);
      expect(text, "der Titel der gesperrten Quelle steht noch auf dem Bildschirm").not.toContain(
        TITEL,
      );
      expect(text, "der Auszug der gesperrten Quelle steht noch auf dem Bildschirm").not.toContain(
        BELEGSTELLE,
      );

      // ── UND DIE ZÄHLER AUCH NICHT — DAS IST BENS PRÜFLÜCKE 6, ausdrücklich NUMERISCH gemessen.
      //    Bis Runde 1 stand hier nur „der Rumpf enthält die Kennung nicht". Ein Produkt, das den
      //    gesperrten Treffer aus der Liste nimmt, ihn aber WEITERZÄHLT („1 Quelle", ein Chip ohne
      //    Text, ein verschlossener Eintrag), wäre damit grün geblieben und hätte die Existenz
      //    trotzdem bestätigt. Gemessen werden deshalb die Zahlen selbst, gegen die Kalibrierung
      //    von oben (Bestand 1 → 0, Chips >0 → 0).
      const bestand = await abrufAusDerSeite(lage.seite, "/api/kos");
      expect(bestand.status).toBe(200);
      expect(bestand.text, "der Bestand führt die gesperrte Quelle weiter").not.toContain(
        eintrag.koId,
      );
      expect(
        (JSON.parse(bestand.text) as unknown[]).length,
        `der Bestand zählt nach dem Entzug weiter mit (vorher ${bestandVorher.length}) — schon die Zahl ist eine Auskunft über den gesperrten Eintrag`,
      ).toBe(0);
      expect(
        await anzahlAuf(lage.seite, '[data-testid="ask-quellen-chip"]'),
        `die Fläche zeigt nach dem Entzug weiter Quellen-Chips (vorher ${chipsVorher})`,
      ).toBe(0);
      expect(
        await anzahlAuf(lage.seite, '[data-testid="answer-source-original"]'),
        "die Fläche zählt nach dem Entzug weiter Wege zum Original",
      ).toBe(0);
      expect(
        await anzahlAuf(lage.seite, '[data-testid="ask-verschlossen-eintrag"]'),
        "die Torlage bestätigt die Existenz des gesperrten Eintrags über einen verschlossenen Posten",
      ).toBe(0);

      // ── DIESELBE AUSSAGE AM SERVERSTAND, mit den Helfern der Kette gegengemessen: kein Titel,
      //    kein Wortlaut, keine Kennung, keine verräterische Torlage.
      const danach = await fragen(lage.instanz.app, lage.leser);
      expect(danach.roh).not.toContain(eintrag.koId);
      expect(danach.roh).not.toContain(eintrag.kernaussage);
      expect(danach.verschlossen.map((v) => v.id)).not.toContain(eintrag.koId);
      expect((await kosLesen(lage.instanz.app, lage.leser)).map((k) => k.id)).not.toContain(
        eintrag.koId,
      );
      expect((await objektLesen(lage.instanz.app, lage.leser, eintrag.objectId)).statusCode).toBe(
        404,
      );

      // ── GEGENPROBE AUF DEMSELBEN GESPEICHERTEN STAND: gemessen wird das RECHT, nicht ein
      //    Totalausfall der Ablage. Der Autor kommt weiter durch.
      const alsAutor = await originalLesen(lage.instanz.app, lage.admin, eintrag.objectId);
      expect(alsAutor.statusCode, "auch der Autor kommt nicht mehr an sein Original").toBe(200);
      expect(alsAutor.body).toBe(ORIGINALTEXT);
      process.stderr.write(`${JOB} G3 GRÜN · ${lage.db.name}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // G4 · KI-FREIGABEENTZUG — GETRENNT VOM RECHTEENTZUG, UND ZWAR IN BEIDE RICHTUNGEN.
  // ==============================================================================================
  //
  // WAS DER WIRKSAME KI-ENTZUG FÜR DIESE KETTE IST, und warum er nicht die zentrale Adminfreigabe
  // ist: die Freigabe für ÖFFENTLICHE KI riegelt die Cloud ab; der bestätigte hausinterne Anbieter
  // darf ausdrücklich einspringen (`services/reasoner/src/service.ts`, `chainForChoice`). Der
  // Adapter dieser Kette IST dieser lokale Anbieter — eine erteilte oder entzogene Freigabe für
  // öffentliche KI ändert an ihr deshalb nichts. Das ist in JOB 4224 gemessen und ausgeschrieben:
  // `tests/klara-quellen-nutzerweg/entzug-sperrt-die-quelle.test.ts:203-235` (E5). Der wirksame
  // Entzug ist der Adminweg aus E6 (`:237-267`): die Aufgabe wird auf den deterministischen Weg
  // gestellt, und ab da darf den Adapter nichts mehr erreichen.
  //
  // DIE ZWEITE HÄLFTE IST DER EIGENTLICHE PUNKT, und sie ist eine PRODUKTENTSCHEIDUNG, keine
  // Nachlässigkeit: der Entzug der KI nimmt NIEMANDEM sein Leserecht. E6 sagt es wörtlich — „Ein
  // KI-Schalter, der nebenbei Lesezugriffe schliesst, wäre eine stille zweite Wirkung." Dieser Fall
  // misst beides und wird rot, wenn eine der beiden Richtungen bricht. Dass §5 des Auftrags für G4
  // „derselben Nachweis wie G3" verlangt (also einen geschlossenen Direktabruf), ist damit am
  // gebauten Produkt NICHT erfüllbar, ohne E6 zu verletzen; die Rückgabe meldet das als Abweichung,
  // statt es hier stillschweigend passend zu machen.
  it("G4 · KI-Freigabeentzug: nichts geht mehr an das Modell — und das Leserecht bleibt unberührt", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("g4");
    try {
      const eintrag = await eintragMitOriginal(lage.instanz.app, lage.admin, { titel: TITEL });
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      await frageBisAntwort(lage.seite);
      const belegAdresse = `/api/objects/${eintrag.objectId}/raw`;
      // KALIBRIERUNG durch den echten Bediengriff — vor dem KI-Entzug trägt der Weg.
      await belegBetaetigen(lage, eintrag.objectId);

      const vorher = draht.lage.generierungen;
      expect(vorher, "vor dem Entzug hat der Adapter nie gerechnet").toBeGreaterThan(0);

      await alsAdmin(
        lage,
        "PUT",
        "/api/reasoner/config",
        { global: "deterministic" },
        "Umstellung auf den deterministischen Weg",
      );

      // ── DIE FLÄCHE NEU LADEN, damit sie die Lage des Modells frisch liest, und erneut fragen.
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      const lage2 = await frageStellen(lage.seite, FRAGE);
      if (lage2 === "gestellt") {
        await ergebnisAbwarten(lage.seite);
      }
      process.stderr.write(`${JOB} G4 ABSENDEKNOPF nach dem KI-Entzug: ${lage2}\n`);

      // ── ERSTE RICHTUNG: nichts geht mehr an das Modell.
      expect(
        draht.lage.generierungen,
        "nach dem Entzug der KI ging trotzdem etwas an das Modell",
      ).toBe(vorher);

      // ── EHRLICHKEIT DES ANGEBOTS: bietet die Fläche überhaupt noch einen Beleg an, muss er zum
      //    ECHTEN Original führen. Ein aus dem Antworttext abgeleiteter Beleg fiele hier auf.
      //    Das Blatt „Mehr" wird dafür geöffnet — eine geschlossene Liste wäre keine Messung.
      await mehrOeffnen(lage.seite);
      const adressen = await belegAdressen(lage.seite);
      process.stderr.write(
        `${JOB} G4 BELEGANGEBOT nach dem KI-Entzug: ${adressen.length === 0 ? "keines" : adressen.join(", ")}\n`,
      );
      for (const adresse of adressen) {
        const abruf = await abrufAusDerSeite(lage.seite, adresse);
        expect(
          abruf.status,
          `die Fläche bietet nach dem KI-Entzug einen Weg an, der ins Leere führt (${adresse})`,
        ).toBe(200);
      }

      // ── ZWEITE RICHTUNG, GETRENNT VOM RECHTEENTZUG: das Leserecht ist unberührt. Quelle und
      //    Original bleiben für die berechtigte Person offen — über den echten Socket, aus der
      //    schon offenen Seite heraus.
      const weiterhin = await abrufAusDerSeite(lage.seite, belegAdresse);
      expect(
        weiterhin.status,
        `der KI-Entzug hat nebenbei ein Leserecht geschlossen — das ist die stille zweite Wirkung aus E6: ${weiterhin.text.slice(0, 300)}`,
      ).toBe(200);
      expect(weiterhin.text).toBe(ORIGINALTEXT);
      const bestand = await abrufAusDerSeite(lage.seite, "/api/kos");
      expect(bestand.status).toBe(200);
      expect(bestand.text, "der KI-Entzug hat den Bestand mitgenommen").toContain(eintrag.koId);
      process.stderr.write(`${JOB} G4 GRÜN · ${lage.db.name}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // G5 · KALIBRIERUNG AN EINEM ABSICHTLICH FEHLENDEN QUELLENBEZUG.
  // ==============================================================================================
  //
  // Dieser Fall belegt zweierlei: dass ein fehlendes Original KEINEN erfundenen Beleg erzeugt
  // („Wissenslücke statt Erfindung") — und dass diese Vorrichtung überhaupt etwas messen kann. Ohne
  // ihn wäre jede Beleg-Zusicherung von G1–G4 auch für ein Produkt grün, das Belege wahllos
  // anbietet.
  //
  // DER EINTRAG WIRD HIER OHNE `eintragMitOriginal` ANGELEGT, und das ist benannt: jener Helfer
  // lädt IMMER ein Original hoch und hängt es an (`kette.ts:271-355`); `ohneQuelle` nimmt nur die
  // Quelle weg, nicht den Anhang. Für „gar kein Original" gibt es in der Kette keinen Handgriff,
  // und dieser Auftrag darf `kette.ts` nicht ändern. Es sind dieselben zwei Aufrufe, die
  // `flaeche-fuehrt-zum-original.test.tsx:248-274` (F2) dafür macht.
  it("G5 · ein Eintrag ohne Original: die Antwort bietet keinen Beleg an und erfindet keinen", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("g5");
    try {
      const angelegt = await lage.instanz.app.inject({
        method: "POST",
        url: "/api/kos",
        headers: lage.admin.kopf,
        payload: {
          title: TITEL,
          statement: BELEGSTELLE,
          type: "best_practice",
          category: "Betrieb",
          confidentiality: "intern",
          neededValidations: 1,
        },
      });
      expect(angelegt.statusCode, angelegt.body).toBe(201);
      const koId = (angelegt.json() as { id: string }).id;
      await alsAdmin(lage, "PUT", `/api/kos/${koId}`, { action: "admin-validate" }, "Freigabe");

      const vorher = draht.lage.generierungen;
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      await frageBisAntwort(lage.seite);
      expect(
        draht.lage.generierungen,
        "der kontrollierte Adapter wurde nicht befragt",
      ).toBeGreaterThan(vorher);

      await mehrOeffnen(lage.seite);
      expect(
        await belegAdressen(lage.seite),
        "die Fläche bietet einen Weg zu einem Original an, das es nicht gibt",
      ).toHaveLength(0);
      const satz = await lage.seite.evaluate<string | null>(
        fn(`() => {
          const e = document.querySelector('[data-testid="answer-source-no-original"]');
          return e ? (e.textContent || "").trim() : null;
        }`),
      );
      expect(
        satz,
        `die Fläche sagt nicht, dass kein Original vorliegt: ${(await seitentext(lage.seite)).slice(0, 800)}`,
      ).not.toBeNull();
      expect((satz as string).length, "ein leerer Satz ist keine Aussage").toBeGreaterThan(0);
      // Ein echter Satz, kein roher Programmschlüssel.
      expect(satz as string).not.toContain("answerSource.");
      process.stderr.write(`${JOB} G5 GRÜN · ${lage.db.name}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);
});
