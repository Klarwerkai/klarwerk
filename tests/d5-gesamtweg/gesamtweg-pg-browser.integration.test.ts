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
  type Abrufbefund,
  type Bildbefund,
  type Browser,
  type Instanz,
  type Klickfolge,
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
  bildinhaltLesen,
  ergebnisAbwarten,
  fensterSchliessen,
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

// ================================================================================================
// JOB 4304 · WAS DIESE DATEI SEIT DEM PRÜFURTEIL VON 4281 ZUSÄTZLICH MISST.
// ================================================================================================
//
// Das Urteil `archiv/4281/runde-2/ben.md` ist GRÜN und benennt in Punkt 6 selbst zwei Lücken. Beide
// sind hier geschlossen, und zwar an den Stellen, an denen sie standen:
//
//   1. G6 — DAS BILDORIGINAL AM ECHTEN KLICK. Der bisherige Nachweis deckte ausschliesslich den
//      DOWNLOAD-Zweig der Rohbyteroute ab (Textdatei → `attachment`). Der INLINE-Zweig (Bild →
//      eigenes Fenster) war nie betreten. G6 betritt ihn und vergleicht die tatsächlich
//      DARGESTELLTEN Bildpunkte gegen den Seedwert (`bildquelle.ts`).
//   2. DIE PREISGABEPROBE STATT DER GLEICHHEITSPROBE. Hier stand `expect(inhalt).not.toBe(
//      ORIGINALTEXT)` — erfüllt von jedem Auszug und von jedem Dateinamen. Sie ist in G3 ersetzt
//      (nicht ergänzt) und gilt in G7 zusätzlich für die Bildquelle, für beide Zweige und für den
//      erneuten Direktabruf (`preisgabe.ts`, kalibriert in `preisgabe.test.ts`).
//
// UND EINE ABGRENZUNG, die 4281 offen gelassen hat: „Modell abgeschaltet" und „Leserecht entzogen"
// sind zwei verschiedene Zustände. G4 heisst seit diesem Auftrag nach dem, was er misst, und ist
// ausdrücklich KEIN Sperrnachweis; der Sperrnachweis sind G3 (Text) und G7 (Bild).
import {
  BILDNAME,
  BILD_BREITE,
  BILD_HOEHE,
  QUELLE_BILD,
  bildBytes,
  bildeintragAnlegen,
  erwartetePunkteRGBA,
} from "./bildquelle";
import {
  type GesperrteQuelle,
  type VerbotenesStueck,
  preisgabeImText,
  preisgabeInBytes,
  unerhalteneStuecke,
  verboteneStuecke,
} from "./preisgabe";

const JOB = "[KLARWERK] JOB 4281";
const JOB4304 = "[KLARWERK] JOB 4304";
/** Der Titel trägt die Auftragskennung — eigener Bestand, nicht der eines anderen Laufs. */
const TITEL = "Zylinderkopfdichtung XQ42 wechseln (JOB 4281)";
/** Der Titel des Eintrags, dessen Original ein BILD ist — eigener Bestand von JOB 4304. */
const TITEL_BILD = "Zylinderkopfdichtung XQ42 wechseln (JOB 4304, Bildquelle)";
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
async function belegAnsehen(
  seite: Seite,
  objectId: string,
  // JOB 4304: Bezeichnung und Dateiname sind Parameter geworden, weil es jetzt ZWEI Quellenarten
  // gibt (Textdatei und Bild). Die Vorgaben halten jeden bestehenden Aufruf zeichengleich.
  bezeichnung: string = QUELLENBEZEICHNUNG,
  dateiname: string = ORIGINALNAME,
): Promise<string> {
  await mehrOeffnen(seite);
  const beleg = await belegAnDerQuelle(seite, bezeichnung);
  expect(
    beleg,
    `die Quelle „${bezeichnung}" bietet keinen Weg zu ihrem Original an: ${(
      await seitentext(seite)
    ).slice(0, 800)}`,
  ).not.toBeNull();
  expect(
    (beleg as { href: string }).href,
    "der angebotene Weg zeigt nicht auf das hinterlegte Original",
  ).toBe(`/api/objects/${objectId}/raw`);
  expect((beleg as { text: string }).text).toContain(dateiname);
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

// ================================================================================================
// JOB 4304 · DER BILDKLICK — DERSELBE BEDIENGRIFF, DER ANDERE ZWEIG DES PRODUKTS.
// ================================================================================================
//
// Warum ein Bild hier nicht als Download ankommt, steht am Kopf von `bildquelle.ts`: die Allowlist
// der Rohbyteroute liefert `image/png` INLINE aus. Der Klick öffnet also ein Fenster, und der
// Nachweis führt genau dorthin — nicht zu einem Statuscode und nicht zu einem MIME-Typ.
//
// DIE KURZE FRIST IST GEMESSEN UND NICHT GERATEN: im Downloadfall kommt der Download in
// Millisekunden (der Server steht im selben Prozess). Hier kommt KEINER, also wird die Frist in
// voller Länge abgewartet — jede Sekunde mehr wäre reine Wartezeit in jedem Bildfall.
const BILDKLICK_FRIST_MS = 4_000;

/** Der Klick auf die Bildquelle und das Fenster, das er aufgemacht hat. */
async function bildLinkOeffnen(lage: Fachlage): Promise<Seite> {
  const folge = await belegLinkBetaetigen(
    lage.kontext,
    lage.seite,
    '[data-testid="answer-source-original"]',
    BILDKLICK_FRIST_MS,
  );
  expect(
    folge.art,
    `das Drücken des Bildbelegs hat einen DOWNLOAD ausgelöst statt das Bild zu zeigen: ${
      folge.art === "download" ? folge.dateiname : ""
    }`,
  ).toBe("kein-download");
  const fenster = folge as Extract<Klickfolge, { art: "kein-download" }>;
  expect(
    fenster.neueSeiten.length,
    `der Klick auf die Bildquelle hat nicht genau ein Fenster geöffnet — geöffnet: ${
      fenster.neueFenster.join(" | ").slice(0, 600) || "(gar nichts)"
    }`,
  ).toBe(1);
  return fenster.neueSeiten[0] as Seite;
}

/**
 * DER INHALTSNACHWEIS: was in diesem Fenster steht, ist GENAU das geseedete Bild.
 *
 * Verglichen werden Eigengrösse UND jeder einzelne Bildpunkt gegen `bildquelle.ts`. Ein Vergleich
 * auf MIME-Typ, Statuscode oder Dateinamen bliebe für jedes andere Bild derselben Grösse grün —
 * genau diese Halbheit benennt §8.1 des Auftrags.
 */
async function bildinhaltMussStimmen(bildfenster: Seite, erwarteteAdresse: string): Promise<void> {
  await warte(
    bildfenster,
    `() => !!document.querySelector("img")`,
    "das geöffnete Fenster baut ein Bilddokument auf",
    undefined,
    30_000,
  );
  const befund: Bildbefund = await bildinhaltLesen(bildfenster);
  // §9: ein ausgefallener Messweg ist KEIN Inhaltsbefund. Er wird zuerst gelesen und als
  // Maschinenfehler gemeldet, nie als „Inhalt stimmt nicht".
  expect(
    befund.fehler,
    `der Bildinhalt des geöffneten Fensters (${befund.quelle}) war nicht messbar — das ist ein Maschinenfehler und kein Inhaltsbefund`,
  ).toBeNull();
  expect(befund.quelle, "das geöffnete Fenster zeigt eine andere Adresse als der Beleg").toContain(
    erwarteteAdresse,
  );
  const erwartet = erwartetePunkteRGBA();
  expect(
    [befund.breite, befund.hoehe],
    "die Zielansicht zeigt ein Bild anderer Grösse als das hinterlegte Original",
  ).toEqual([BILD_BREITE, BILD_HOEHE]);
  expect(
    befund.punkte.length,
    "die Zielansicht gibt nicht für jeden Bildpunkt vier Werte her",
  ).toBe(erwartet.length);
  expect(
    befund.punkte,
    "die Zielansicht zeigt ein ANDERES Bild als das hinterlegte Original — die Bildpunkte weichen ab",
  ).toEqual(erwartet);
}

// ================================================================================================
// JOB 4304 · DIE PREISGABEPROBE AM FACHFALL — WAS NACH DEM ENTZUG NICHT ANKOMMEN DARF.
// ================================================================================================
//
// Die Stücke selbst und ihre Begründung stehen in `preisgabe.ts`; kalibriert sind sie ohne
// Prüfplatz in `preisgabe.test.ts`. Hier stehen nur die zwei Anwendungen und ihre GRENZE:
//
//   · `keinePreisgabe…`       — für alles, was NACH dem Entzug geholt oder neu aufgebaut wird.
//                               Inhalt, Auszug, Dateiname, Titel: nichts davon.
//   · `keinUnerhaltenesStueck` — für die schon offene Ausgangsseite. Titel und Belegstelle dürfen
//                               dort stehen bleiben (Lieferung 3, Begründung bei G3); was diese
//                               Person NIE erhalten hat, darf dort auch jetzt nicht erscheinen.

function textquelle(): GesperrteQuelle {
  return {
    name: ORIGINALNAME,
    titel: TITEL,
    auszug: BELEGSTELLE,
    original: Buffer.from(ORIGINALTEXT, "utf8"),
    // Was vor dem Entzug berechtigt auf der Antwortkarte stand und dort stehen bleiben darf.
    bereitsErhalten: [QUELLENBEZEICHNUNG],
  };
}

function bildquelle(): GesperrteQuelle {
  return {
    name: BILDNAME,
    titel: TITEL_BILD,
    auszug: BELEGSTELLE,
    original: bildBytes(),
    bereitsErhalten: [QUELLE_BILD],
  };
}

function nennen(durchgekommen: readonly VerbotenesStueck[]): string {
  return durchgekommen.map((s) => s.was).join(" · ");
}

/** Nichts von der gesperrten Quelle — in Bytes gemessen. */
function keinePreisgabeInBytes(wo: string, geliefert: Buffer, quelle: GesperrteQuelle): void {
  const durch = preisgabeInBytes(geliefert, verboteneStuecke(quelle));
  expect(
    nennen(durch),
    `${wo}: geschützter Quellinhalt ist durchgekommen (${geliefert.length} Byte, Anfang: ${JSON.stringify(
      geliefert.subarray(0, 200).toString("latin1"),
    )})`,
  ).toBe("");
}

/** Nichts von der gesperrten Quelle — in etwas, das als Text beim Menschen ankommt. */
function keinePreisgabeImText(wo: string, text: string, quelle: GesperrteQuelle): void {
  const durch = preisgabeImText(text, verboteneStuecke(quelle));
  expect(
    nennen(durch),
    `${wo}: geschützter Quellinhalt ist durchgekommen — ${text.slice(0, 300)}`,
  ).toBe("");
}

/** Nur das NIE ERHALTENE — die Aussage, die auch für die schon ausgelieferte Seite gilt. */
function keinUnerhaltenesStueckImText(wo: string, text: string, quelle: GesperrteQuelle): void {
  const durch = preisgabeImText(text, unerhalteneStuecke(quelle));
  expect(
    nennen(durch),
    `${wo}: ein nie erhaltenes Stück der gesperrten Quelle steht da — ${text.slice(0, 300)}`,
  ).toBe("");
}

// ================================================================================================
// JOB 4304 · RUNDE 3 — DIE SPERRE WIRD AM VERTRAG BESTÄTIGT, NICHT AM LEEREN BILDSCHIRM ABGELESEN.
// ================================================================================================
//
// BENs Korrekturpflicht 2 aus Runde 2, an zwei gemessenen Mutationen belegt:
//   · Die Route lieferte beim Navigationsklick nach dem Entzug die ersten 16 Byte des Originals
//     als Download — G3 blieb GRÜN und nannte den Download sogar „ohne Originalinhalt".
//   · Die Bildroute antwortete beim Navigationsklick mit HTTP 500 — G7 blieb GRÜN, weil im Fenster
//     kein darstellbares Bild stand.
// Beide Male war die Aussage „gesperrt" aus einer ABWESENHEIT geschlossen. Ein leeres Fenster kann
// aber dreierlei heissen: die Sperre griff, der Server fiel um, oder es wurde nie navigiert.
//
// AB JETZT WIRD DIE ABSAGE POSITIV NACHGEWIESEN, in dieser Reihenfolge:
//   1. Der Klick hat überhaupt einen Abruf der Belegadresse ausgelöst — sonst ist nichts gemessen.
//   2. Dieser Abruf kam zustande (kein Netzfehler, Rumpf lesbar) — sonst Maschinenfehler, §9.
//   3. Sein Status ist der VERTRAGSSTATUS der Absage (404), nicht 500 und nicht 200.
//   4. Sein Rumpf ist BYTEGLEICH zur Absage für eine erfundene Kennung — die Absage darf sich nicht
//      unterscheiden, sonst wird sie zum Existenzorakel.
//   5. Es ist KEIN Download entstanden. Nach dem Entzug gibt es nichts herunterzuladen; ein
//      Download ist deshalb für sich genommen der Befund — unabhängig von seinem Inhalt und seiner
//      Länge. Genau hier rutschten BENs 16 Byte durch.
//   6. Und erst DANN die Preisgabeprobe über Fenster und Rumpf.
//
// Der Vertrag wird nicht abgeschrieben, sondern am selben Lauf GEMESSEN: `vertragsabsage` ist die
// Antwort, die dieselbe Person unter einer erfundenen Kennung bekommt.

interface Vertragsabsage {
  status: number;
  text: string;
}

/** Die Abrufe dieses Klicks, die wirklich der Belegadresse galten. */
function abrufeAufBeleg(folge: Klickfolge, belegAdresse: string): Abrufbefund[] {
  return folge.abrufe.filter((a) => a.url.endsWith(belegAdresse));
}

/**
 * Der Klick nach dem Entzug ergibt eine BESTÄTIGTE Rechteabsage — und gibt nichts preis.
 */
function sperreAmKlickBestaetigen(
  folge: Klickfolge,
  belegAdresse: string,
  vertrag: Vertragsabsage,
  quelle: GesperrteQuelle,
  wo: string,
): void {
  // 5. zuerst, weil ein Download alles Weitere erübrigt: es gibt nichts, was hier ankommen dürfte.
  expect(
    folge.art === "download"
      ? `ein Download „${(folge as Extract<Klickfolge, { art: "download" }>).dateiname}" mit ${(folge as Extract<Klickfolge, { art: "download" }>).bytes.length} Byte: ${JSON.stringify(
          (folge as Extract<Klickfolge, { art: "download" }>).bytes
            .subarray(0, 120)
            .toString("latin1"),
        )}`
      : "",
    `${wo}: der Klick auf die gesperrte Quelle hat eine DATEI geliefert. Nach dem Entzug gibt es nichts herunterzuladen — schon der Download ist der Befund, gleich wie kurz er ist`,
  ).toBe("");

  // 1. Der Abruf hat stattgefunden.
  const treffer = abrufeAufBeleg(folge, belegAdresse);
  expect(
    treffer.length,
    `${wo}: der Klick hat gar keinen Abruf von ${belegAdresse} ausgelöst — dann ist über die Sperre NICHTS gemessen (beobachtete Abrufe: ${
      folge.abrufe.map((a) => `${a.status} ${a.url}`).join(" · ") || "(keine)"
    })`,
  ).toBeGreaterThan(0);

  for (const abruf of treffer) {
    // 2. Er kam zustande.
    expect(
      abruf.fehler,
      `${wo}: der Abruf von ${belegAdresse} ist mit einem Maschinenfehler geendet — das ist kein Sperrnachweis (§9)`,
    ).toBeNull();
    // 3. Mit dem Vertragsstatus der Absage.
    expect(
      abruf.status,
      `${wo}: der Klickabruf antwortete ${abruf.status} statt ${vertrag.status}. Ein Serverfehler oder eine Auslieferung ist keine Rechteabsage (§9) — Rumpf: ${JSON.stringify(
        abruf.koerper.subarray(0, 200).toString("latin1"),
      )}`,
    ).toBe(vertrag.status);
    // 4. Und mit genau ihrem Rumpf — nicht erlaubt sieht aus wie nicht vorhanden.
    expect(
      abruf.koerper.toString("utf8"),
      `${wo}: die Absage des Klickabrufs unterscheidet sich von der für eine erfundene Kennung — damit wird sie zum Existenzorakel`,
    ).toBe(vertrag.text);
  }

  // 6. Und erst jetzt: es ist auch nichts durchgekommen.
  const fensterfolge = folge as Extract<Klickfolge, { art: "kein-download" }>;
  for (const neuesFenster of fensterfolge.neueFenster) {
    keinePreisgabeImText(`${wo} · neu geöffnetes Fenster`, neuesFenster, quelle);
  }
  for (const fenstertext of fensterfolge.alleFenster) {
    keinUnerhaltenesStueckImText(`${wo} · offenes Fenster`, fenstertext, quelle);
  }
  for (const abruf of treffer) {
    keinePreisgabeInBytes(`${wo} · Rumpf des Klickabrufs`, abruf.koerper, quelle);
  }
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
      //
      //    JOB 4304 — DIE GLEICHHEITSPROBE IST HIER FORT. Bis zu diesem Auftrag stand im
      //    Downloadzweig `expect(inhalt).not.toBe(ORIGINALTEXT)`: erfüllt von den ersten zweihundert
      //    Zeichen desselben Dokuments, vom blossen Dateinamen, vom Titel. BEN hat das in seinem
      //    Urteil zu 4281 (Punkt 6) selbst benannt. An ihrer Stelle steht seit Runde 3 die am
      //    VERTRAG bestätigte Absage samt Preisgabeprobe (`sperreAmKlickBestaetigen`).
      //
      //    DER VERTRAG WIRD VOR DEM KLICK GEMESSEN, nicht abgeschrieben: er ist die Antwort, die
      //    dieselbe Person unter einer ERFUNDENEN Kennung bekommt. Und er wird selbst kalibriert —
      //    wäre er ein Serverfehler oder ein leerer Rumpf, vergliche der Nachweis darunter zwei
      //    Ausfälle miteinander und wäre wertlos.
      const vertragsAbruf = await abrufAusDerSeite(lage.seite, `/api/objects/${ERFUNDEN}/raw`);
      expect(
        vertragsAbruf.status,
        `Kalibrierung: die Absage für eine erfundene Kennung ist selbst keine gültige Absage (${vertragsAbruf.text.slice(0, 200)})`,
      ).toBe(404);
      expect(
        vertragsAbruf.text.length,
        "Kalibrierung: die Absage für eine erfundene Kennung hat einen leeren Rumpf",
      ).toBeGreaterThan(0);
      const vertrag: Vertragsabsage = { status: 404, text: vertragsAbruf.text };

      const nachEntzugGedrueckt = await belegLinkBetaetigen(
        lage.kontext,
        lage.seite,
        '[data-testid="answer-source-original"]',
        5_000,
      );
      sperreAmKlickBestaetigen(
        nachEntzugGedrueckt,
        belegAdresse,
        vertrag,
        textquelle(),
        "G3 · Klick nach dem Entzug",
      );
      process.stderr.write(
        `${JOB4304} G3 KLICK NACH ENTZUG: bestätigte Absage — ${abrufeAufBeleg(
          nachEntzugGedrueckt,
          belegAdresse,
        )
          .map((a) => `${a.status} ${JSON.stringify(a.koerper.toString("utf8").slice(0, 120))}`)
          .join(" · ")}\n`,
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
      // JOB 4304, Lieferung 2: DIESELBE STRENGE FÜR DEN DIREKTABRUF. Bis hierher standen an dieser
      // Stelle zwei `not.toContain` (Inhalt, Titel) — ein Fehlertext, der nur den DATEINAMEN oder
      // einen Auszug genannt hätte, wäre durchgegangen.
      keinePreisgabeImText("G3 · Direktabruf nach dem Entzug", gesperrt.text, textquelle());

      // ── DER ERNEUTE DIREKTABRUF nach einem echten Neuladen — auch der führt nicht zurück.
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      const nachNeuladen = await abrufAusDerSeite(lage.seite, belegAdresse);
      expect(nachNeuladen.status, "nach dem Neuladen trägt der Direktabruf wieder").toBe(404);
      keinePreisgabeImText("G3 · Direktabruf nach dem Neuladen", nachNeuladen.text, textquelle());

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
  // misst beides und wird rot, wenn eine der beiden Richtungen bricht.
  //
  // ==============================================================================================
  // JOB 4304 · LIEFERUNG 4 UND 5 — DIESER FALL IST KEIN SPERRNACHWEIS, UND SEIN NAME SAGT ES JETZT.
  // ==============================================================================================
  //
  // BENs Promptverbesserung zu 4281, wörtlich: „G4 benennt getrennt die entzogene KI-Berechtigung
  // und das erwartete Leserecht. Ein grüner Modellabschaltungstest gilt NICHT als Nachweis eines
  // gesperrten Originalabrufs." Genau das war bis hierher die Lesart dieses Falls, und sie war
  // falsch: `:767` verlangt einen ERFOLGREICHEN Originalabruf — das Gegenteil einer Sperre.
  //
  // ZWEI ZUSTÄNDE, ZWEI FÄLLE, und sie werden nicht mehr verwechselt:
  //     „Modell abgeschaltet"   → DIESER Fall. Der Originalabruf gelingt weiterhin.
  //     „Leserecht entzogen"    → G3 (Textquelle) und G7 (Bildquelle). Dort ist nichts mehr zu holen.
  //
  // UND DIE BEOBACHTUNG WIRD PROTOKOLLIERT, NICHT BEWERTET (Lieferung 5). Dass ein abgeschaltetes
  // Modell den Originalabruf offenlässt, ist der gebaute Zustand und folgt aus E6. Ob er so bleiben
  // soll, ist eine VERTRAGSENTSCHEIDUNG für Pedi und keine, die hier im Code fällt — so schon
  // `archiv/4281/runde-2/ben.md`, HINWEISE: „G4 benötigt weiterhin eine Vertragsentscheidung."
  // Dieser Fall stellt den Zustand fest, schreibt ihn auf stderr und wartet nicht darauf.
  it("G4 · Modell aus, Leserecht besteht: nichts geht mehr an das Modell — der Originalabruf gelingt weiterhin (KEIN Rechteentzugsnachweis)", async (ctx) => {
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
      // JOB 4304, Lieferung 5: der Befund wird AUSGEWIESEN, damit niemand diesen grünen Fall für
      // einen Sperrnachweis hält — weder beim Lesen des Protokolls noch beim Lesen einer Rückgabe.
      process.stderr.write(
        `${JOB4304} G4 BEFUND (offen, Vertragsentscheidung für Pedi): Modell abgeschaltet, Leserecht UNBERÜHRT — der Originalabruf ${belegAdresse} antwortete ${weiterhin.status}. Dieser Fall ist AUSDRÜCKLICH kein Rechteentzugsnachweis; den führen G3 (Textquelle) und G7 (Bildquelle).\n`,
      );
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

  // ==============================================================================================
  // G6 (JOB 4304) · DAS BILDORIGINAL AM ECHTEN KLICK — UND ZWAR AM BILDINHALT GEMESSEN.
  // ==============================================================================================
  //
  // BENs Prüflücke 6 zu 4281, erster Teil, wörtlich: „Der Downloadnachweis deckt die Textdatei ab;
  // eine inline dargestellte Bilddatei fehlt. Testvorschlag: Bildoriginal anklicken und Inhalt der
  // Zielansicht prüfen."
  //
  // WAS HIER NICHT GEMESSEN WIRD, weil es die Halbheit dieses Falls wäre (§8.4): nicht der MIME-Typ,
  // nicht der Statuscode, nicht der Dateiname. Alle drei blieben grün, wenn unter derselben Adresse
  // ein ANDERES Bild läge. Gemessen werden die Bildpunkte, die dieser Mensch nach seinem Klick vor
  // sich sieht, gegen den Seedwert aus `bildquelle.ts` — und der Seed ist die einzige Wahrheit über
  // den Sollwert, keine zweite Abschrift daneben.
  it("G6 · die Bildquelle wird über die Oberfläche geöffnet und zeigt genau den erwarteten Bildinhalt", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("g6");
    try {
      const eintrag = await bildeintragAnlegen(
        lage.instanz.app,
        lage.admin,
        TITEL_BILD,
        BELEGSTELLE,
      );
      const vorher = draht.lage.generierungen;

      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      await frageBisAntwort(lage.seite);
      expect(
        draht.lage.generierungen,
        "der kontrollierte Adapter wurde nicht befragt — dann misst dieser Fall etwas anderes als beschrieben",
      ).toBeGreaterThan(vorher);

      // ── DER BELEG ZEIGT DIE BILDQUELLE, an ihrer eigenen Zeile und mit ihrem eigenen Dateinamen.
      const adresse = await belegAnsehen(lage.seite, eintrag.objectId, QUELLE_BILD, BILDNAME);
      expect(
        await anzahlAuf(lage.seite, '[data-testid="answer-source-original"]'),
        "es steht mehr als ein Beleg-Link auf der Fläche — dann ist der Klick nicht mehr eindeutig dem geprüften zugeordnet",
      ).toBe(1);

      // ── UND JETZT DER BEDIENGRIFF: gedrückt wird der Link, nicht die Adresse abgerufen.
      const bildfenster = await bildLinkOeffnen(lage);
      await bildinhaltMussStimmen(bildfenster, adresse);
      process.stderr.write(
        `${JOB4304} G6 BILDBELEG: Klick auf ${adresse} öffnete ein Fenster mit ${BILD_BREITE}×${BILD_HOEHE} Bildpunkten, alle gleich dem Seed\n`,
      );
      await fensterSchliessen(bildfenster);

      // ── UND DIE ZEILE LIEGT WIRKLICH IN PostgreSQL — nachgesehen, nicht angenommen.
      const zeile = await lage.db.pool.query<{ anzahl: string }>(
        "SELECT count(*)::text AS anzahl FROM kos WHERE id = $1",
        [eintrag.koId],
      );
      expect(zeile.rows[0]?.anzahl, "der Bildeintrag steht nicht in der Datenbank").toBe("1");
      process.stderr.write(`${JOB4304} G6 GRÜN · ${lage.db.name} · ${lage.instanz.basis}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);

  // ==============================================================================================
  // G7 (JOB 4304) · NACH DEM ENTZUG DES LESERECHTS KOMMT AUCH KEIN AUSSCHNITT UND KEIN DATEINAME AN.
  // ==============================================================================================
  //
  // BENs Prüflücke 6 zu 4281, zweiter Teil: „ausschliesslich einen geschützten Auszug oder
  // Dateinamen ausliefern und dessen Preisgabe ausdrücklich abweisen."
  //
  // WARUM DIESER FALL AM BILD HÄNGT UND NICHT AM TEXT: G3 misst die Textquelle und ist seit diesem
  // Auftrag ebenso scharf (dort steht die Preisgabeprobe an der Stelle der alten Gleichheitsprobe).
  // Die Bildquelle nimmt dagegen den ANDEREN Zweig der Rohbyteroute — sie wird vor dem Entzug INLINE
  // in einem Fenster dargestellt, nicht heruntergeladen. Eine Sperre, die nur den Downloadweg
  // schlösse, bliebe an G3 grün und wäre trotzdem offen. Es entsteht dadurch keine Wiederholung des
  // Textwegs: G7 fährt die Bildquelle, G3 bleibt unangetastet die Textquelle.
  //
  // DER ENTZUG IST DERSELBE ECHTE PRODUKTWEG WIE IN G3 (Höherstufung auf `vertraulich`), nicht ein
  // KI-Schalter — die beiden Zustände sind getrennt, s. die Begründung an G4.
  it("G7 · nach dem Entzug des Leserechts kommt auch kein Auszug und kein Dateiname der gesperrten Bildquelle an", async (ctx) => {
    if (!platz || !browser) {
      ueberspringen(ctx);
      return;
    }
    const lage = await fachlage("g7");
    const gesperrt = bildquelle();
    try {
      const eintrag = await bildeintragAnlegen(
        lage.instanz.app,
        lage.admin,
        TITEL_BILD,
        BELEGSTELLE,
      );
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      await frageBisAntwort(lage.seite);

      // ── KALIBRIERUNG: VORHER trägt der Weg, und zwar bis zum BILDINHALT. Ohne sie wäre „gesperrt"
      //    auch für eine Fläche grün, die nie ein Bild gezeigt hat (§9: keine negative Aussage ohne
      //    einen tatsächlich durchgeführten, fehlerfreien Versuch).
      const belegAdresse = await belegAnsehen(lage.seite, eintrag.objectId, QUELLE_BILD, BILDNAME);
      const vorFenster = await bildLinkOeffnen(lage);
      await bildinhaltMussStimmen(vorFenster, belegAdresse);
      // Das Kalibrierungsfenster wird zugemacht: es wurde VOR dem Entzug ausgeliefert, und über eine
      // schon ausgehändigte Ansicht sagt dieser Auftrag nichts zu (Lieferung 3). Bliebe es offen,
      // stünde es gleich in der Messung, ohne dass sie etwas darüber behauptet.
      await fensterSchliessen(vorFenster);
      const vorAbruf = await abrufAusDerSeite(lage.seite, belegAdresse);
      expect(
        vorAbruf.status,
        `Kalibrierung: das Bildoriginal ist vor dem Entzug nicht direkt abrufbar (${vorAbruf.text.slice(0, 200)})`,
      ).toBe(200);

      // ── DER ENTZUG.
      await alsAdmin(
        lage,
        "PUT",
        `/api/kos/${eintrag.koId}`,
        { action: "confidentiality", level: "vertraulich" },
        "Hochstufung auf vertraulich",
      );

      // ── DER VERTRAG DER ABSAGE, vor dem Klick gemessen und selbst kalibriert (s. G3).
      const vertragsAbrufBild = await abrufAusDerSeite(lage.seite, `/api/objects/${ERFUNDEN}/raw`);
      expect(
        vertragsAbrufBild.status,
        `Kalibrierung: die Absage für eine erfundene Kennung ist selbst keine gültige Absage (${vertragsAbrufBild.text.slice(0, 200)})`,
      ).toBe(404);
      expect(
        vertragsAbrufBild.text.length,
        "Kalibrierung: die Absage für eine erfundene Kennung hat einen leeren Rumpf",
      ).toBeGreaterThan(0);
      const vertragBild: Vertragsabsage = { status: 404, text: vertragsAbrufBild.text };

      // ── ERSTENS: DER NOCH ANGEZEIGTE LINK WIRD GEDRÜCKT. Beide Zweige sind abgedeckt; welchen das
      //    Produkt nimmt, entscheidet es selbst, und die Sperre muss in beiden halten.
      const nachEntzug: Klickfolge = await belegLinkBetaetigen(
        lage.kontext,
        lage.seite,
        '[data-testid="answer-source-original"]',
        BILDKLICK_FRIST_MS,
      );
      sperreAmKlickBestaetigen(
        nachEntzug,
        belegAdresse,
        vertragBild,
        gesperrt,
        "G7 · Klick nach dem Entzug",
      );
      // UND KEIN BILD. Der Wortlaut eines Bilddokuments ist leer — eine reine Textprobe wäre für ein
      // durchgereichtes Bild also immer grün. Deshalb wird jedes neu geöffnete Fenster ausdrücklich
      // daraufhin angesehen, ob dort ein lesbares Bild steht.
      //
      // DIESE ZEILEN SIND SEIT RUNDE 3 NICHT MEHR DER SPERRNACHWEIS, sondern seine Ergänzung: dass
      // hier KEIN Bild steht, war bis dahin die ganze Aussage — und genau daran blieb G7 bei BENs
      // HTTP-500-Mutation grün. Den Nachweis führt jetzt `sperreAmKlickBestaetigen` am Abruf.
      if (nachEntzug.art === "kein-download") {
        for (const neu of nachEntzug.neueSeiten) {
          const befund: Bildbefund = await bildinhaltLesen(neu);
          expect(
            befund.fehler === null ? `${befund.breite}×${befund.hoehe} Bildpunkte` : "",
            `G7: nach dem Entzug steht in einem neu geöffneten Fenster (${befund.quelle}) trotzdem ein darstellbares Bild`,
          ).toBe("");
          expect(befund.punkte, "G7: das neue Fenster gibt Bildpunkte her").toEqual([]);
        }
      }
      process.stderr.write(
        `${JOB4304} G7 KLICK NACH ENTZUG: bestätigte Absage — ${abrufeAufBeleg(
          nachEntzug,
          belegAdresse,
        )
          .map((a) => `${a.status} ${JSON.stringify(a.koerper.toString("utf8").slice(0, 120))}`)
          .join(" · ")}\n`,
      );

      // ── ZWEITENS: DER ERNEUTE DIREKTABRUF aus derselben offenen Seite. Ein 404 ist nur dann ein
      //    Sperrnachweis, wenn der Abruf WIRKLICH stattgefunden hat — ein Maschinenfehler meldet
      //    hier `-1` und wäre damit kein Nachweis, sondern ein Abbruchgrund (§9).
      const abruf = await abrufAusDerSeite(lage.seite, belegAdresse);
      const erfunden = await abrufAusDerSeite(lage.seite, `/api/objects/${ERFUNDEN}/raw`);
      expect(
        abruf.status,
        `der erneute Abruf ist gar nicht zustande gekommen — das ist ein Maschinenfehler und kein Sperrnachweis: ${abruf.text.slice(0, 300)}`,
      ).not.toBe(-1);
      expect(
        abruf.status,
        `das Bildoriginal ist aus der offenen Ansicht noch abrufbar: ${abruf.text.slice(0, 300)}`,
      ).toBe(404);
      // Nicht erlaubt sieht aus wie nicht vorhanden — sonst wird die Absage zum Existenzorakel.
      expect(abruf.status).toBe(erfunden.status);
      expect(abruf.text, "die Absage unterscheidet sich von der für eine erfundene Kennung").toBe(
        erfunden.text,
      );
      keinePreisgabeImText("G7 · Direktabruf nach dem Entzug", abruf.text, gesperrt);

      // ── DRITTENS: NACH EINEM ECHTEN NEULADEN. Ein Produkt, das die Sperre nur in der bestehenden
      //    Ansicht anwendete, käme bis hierher durch.
      await fragenflaecheOeffnen(lage.seite, lage.instanz.basis);
      const nachNeuladen = await abrufAusDerSeite(lage.seite, belegAdresse);
      expect(nachNeuladen.status, "nach dem Neuladen trägt der Direktabruf wieder").toBe(404);
      keinePreisgabeImText("G7 · Direktabruf nach dem Neuladen", nachNeuladen.text, gesperrt);

      // ── UND VIERTENS: DIE FLÄCHE BIETET DEN WEG NICHT MEHR AN, und der Bildschirm verrät nichts.
      expect(await frageStellen(lage.seite, FRAGE)).toBe("gestellt");
      await warte(
        lage.seite,
        `() => !document.querySelector('[data-testid="ask-pending"]') && !!document.querySelector('[data-testid="ask-gap"]')`,
        "die Antwort ist eine ehrliche Wissenslücke",
        undefined,
        60_000,
      );
      await mehrOeffnen(lage.seite);
      expect(
        await belegAdressen(lage.seite),
        "die Fläche bietet das Bildoriginal der gesperrten Quelle weiter an",
      ).not.toContain(belegAdresse);
      keinePreisgabeImText("G7 · neu aufgebaute Fläche", await seitentext(lage.seite), gesperrt);
      process.stderr.write(`${JOB4304} G7 GRÜN · ${lage.db.name}\n`);
    } finally {
      await lage.abbauen();
    }
  }, 600_000);
});
