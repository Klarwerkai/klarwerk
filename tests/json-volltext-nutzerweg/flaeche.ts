// ================================================================================================
// JOB 4293 · DIE FLÄCHE — DER BEDIENWEG, GENAU EINMAL BESCHRIEBEN.
// ================================================================================================
//
// Dateiauswahl → Prüfkarte → ganzen Text lesen → annehmen → neu laden. Er steht HIER und wird von
// zwei Dateien gefahren: `rundlauf-im-echten-browser.test.ts` (Speicherablagen, Tor) und
// `rundlauf-pg.integration.test.ts` (echte PostgreSQL, Neustart). Verschieden ist EIN Argument —
// der Pool; alles andere ist Zeichen für Zeichen derselbe Ablauf. Läge er zweimal ausgeschrieben
// da, wären es zwei Aussagen, die nur heute übereinstimmen
// (`tests/gast-nutzerweg/browserweg.ts:15-17`).
//
// WARUM DIESE DATEI GETRENNT VON `weg.ts` IST: sie erreicht `browserweg.ts` und damit die eine
// Startstelle des Chromium. Jede Datei, die sie importiert, fällt in die serielle Browsergruppe des
// Tors (`tests/tor-inventar/browser-gruppe.ts`). Der reine Socket-Lauf und die Kalibrierung brauchen
// keinen Browser und sollen auch nicht in dieser Gruppe landen — deshalb zwei Dateien.
//
// DIE DECISIVEN HANDGRIFFE GEHEN ÜBER DIE TASTATUR, mit nachgemessenem sichtbarem Fokus
// (`tastaturAusloesen`, Lehre JOB 4223 R1: ein Knopf mit `tabIndex={-1}` liess einen behaupteten
// Tastaturnachweis grün). Zwei Ausnahmen, beide benannt: das `<summary>` der Prüfliste (kein
// Bedienelement im Sinne von `BEDIENBAR`) und die Dateiübergabe selbst — der Systemdialog ist für
// den Browser nicht bedienbar, die Datei geht deshalb durch GENAU den `<input type="file">`, den
// der sichtbare Knopf öffnet.
import { expect } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { JSON_UPLOAD_INPUT_ID } from "../../apps/web/src/lib/importSourceGallery";
import { BREIT } from "../fassungsrueckholung-echter-browser/weg";
import {
  type Browser,
  type Kontext,
  LIES_TEXT,
  type Seite,
  fn,
  tastaturAusloesen,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Sitzung, type Strecke } from "../gast-nutzerweg/strecke";
import {
  JOB,
  KERN_MARKE,
  type Kandidat,
  VOLLTEXT_MARKE,
  kandidatMitTitel,
  warteschlange,
} from "./weg";

/** Die Sollwerte kommen aus DEM Katalog des Hauses, nicht aus einer hier eingetippten Abschrift. */
export const T = i18n.getFixedT("de");

/**
 * Die Dateiübergabe der echten Auswahl.
 *
 * `Seite` aus `browserweg.ts` beschreibt nur, was der Gastweg braucht; `setInputFiles` gehört zu
 * Playwrights `Page` und wird hier ausdrücklich dazugeschrieben, statt eine zweite
 * Seitenabstraktion danebenzustellen.
 */
export type SeiteMitDatei = Seite & {
  setInputFiles(
    selektor: string,
    dateien: { name: string; mimeType: string; buffer: Buffer }[],
  ): Promise<void>;
};

export const TEXT_VON = `(sel) => {
  const el = document.querySelector(sel);
  return el ? el.innerText : null;
}`;
export const GIBT_ES = "(sel) => !!document.querySelector(sel)";

/**
 * IST DER TEXT WIRKLICH GEKLEMMT?
 *
 * Gemessen an der Geometrie des Kastens, nicht am Text: Chromium lässt über `overflow: hidden`
 * abgeschnittenen Inhalt im `innerText` stehen. Ein Fall, der „gekürzt" am Text prüfen wollte,
 * wäre vor UND nach „Mehr anzeigen" grün — also blind für genau den Unterschied, den er behauptet.
 */
const GEKLEMMT = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  return { scroll: el.scrollHeight, sichtbar: el.clientHeight };
}`;
const VOLLTEXT_KASTEN = '[data-testid="imp-volltext"] .prose-kw';

/**
 * Ein frisches Profil MIT eingeschalteter Stufe 2.
 *
 * `/import` trägt `stufe2: true` (`apps/web/src/app/navigation.ts:308-321`); ohne den Schalter
 * zeigt die Route die `Stage2Notice` statt der Seite. Gesetzt wird der PERSISTIERTE Zustand des
 * echten Umschalters (`apps/web/src/lib/stufe2Storage.ts`, Schlüssel `kw.stufe2.v1`) — genau das,
 * was ein Mensch hinterlässt, der ihn einmal umgelegt hat. Es ist KEINE Umgehung eines Rechtetors:
 * `effectiveStufe2` verlangt weiterhin die Admin-Rolle, und der Server prüft jeden Aufruf selbst
 * (dieselben 403, die `rundlauf-am-echten-socket.test.ts` in L7d misst).
 */
export async function importProfil(browser: Browser): Promise<{ kontext: Kontext; seite: Seite }> {
  const kontext = await browser.newContext({ viewport: BREIT });
  await kontext.addInitScript(
    `try { localStorage.setItem("kw.sprache", "de"); localStorage.setItem("kw.stufe2.v1", "1"); } catch (e) {}`,
  );
  return { kontext, seite: await kontext.newPage() };
}

/** Anmeldung über die echte Maske, ausschliesslich mit der Tastatur (Primitiven aus browserweg). */
export async function anmelden(seite: Seite, basis: string, email: string): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  await tippeMitTastatur(seite, "#auth-email", email, "E-Mail");
  await tippeMitTastatur(seite, "#auth-password", PASSWORT, "Passwort");
  await seite.keyboard.press("Enter");
  // Erst wenn die Maske WEG ist, ist die Anmeldung durch. Ohne diesen Halt liefe der nächste `goto`
  // gegen eine Seite, die noch gar nicht angemeldet ist — der Fall scheiterte am falschen Ort.
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    `die Anmeldung von ${email} ist durch`,
    undefined,
    60_000,
  );
}

/**
 * Die Prüfliste aufklappen.
 *
 * Sie steht standardmässig ZU (`apps/web/src/components/ImportHistory.tsx:22`). Ein `<summary>` ist
 * kein Bedienelement im Sinne von `browserweg.BEDIENBAR` und über `tabBisText` deshalb nicht
 * erreichbar; hier wird es darum angeklickt. Bewusst KEINE Tastaturaussage — die decisiven
 * Handgriffe laufen über `tastaturAusloesen`.
 */
export async function oeffneWarteschlange(seite: Seite): Promise<void> {
  await warte(seite, GIBT_ES, "die eingeklappte Prüfliste", "#import-review-queue > summary");
  await seite.click("#import-review-queue > summary");
}

/** Auf die Import-Seite, angemeldet, mit aufgeklappter Prüfliste. */
export async function zurImportseite(seite: Seite, basis: string, email: string): Promise<void> {
  await anmelden(seite, basis, email);
  await seite.goto(`${basis}/import`, { waitUntil: "domcontentloaded" });
  await warte(seite, GIBT_ES, "die Import-Seite mit dem JSON-Kasten", "#import-json-card");
  await oeffneWarteschlange(seite);
}

/** Die Datei durch den echten Eingang der Seite geben. */
export async function dateiWaehlen(seite: Seite, dateiname: string, inhalt: string): Promise<void> {
  await warte(seite, GIBT_ES, "der Dateieingang der Import-Seite", `#${JSON_UPLOAD_INPUT_ID}`);
  expect(
    await seite.evaluate<string | null>(fn(TEXT_VON), "#import-json-card"),
    `${JOB}: der JSON-Kasten nennt den Auswahlknopf „${T("imp.upload")}" nicht.`,
  ).toContain(T("imp.upload"));
  await (seite as SeiteMitDatei).setInputFiles(`#${JSON_UPLOAD_INPUT_ID}`, [
    { name: dateiname, mimeType: "application/json", buffer: Buffer.from(inhalt, "utf8") },
  ]);
}

export interface Hoehen {
  scroll: number;
  sichtbar: number;
}

export interface Flaechenbefund {
  /** Der Volltext auf der Karte, gekürzt angezeigt. */
  gekuerzt: string;
  /** Die Geometrie des Kastens VOR „Mehr anzeigen" — er muss wirklich klemmen. */
  hoehenGekuerzt: Hoehen | null;
  /** Derselbe Volltext nach „Mehr anzeigen". */
  ganz: string;
  /** Die Geometrie DANACH — nichts wird mehr abgeschnitten. */
  hoehenGanz: Hoehen | null;
  /** Der Volltext auf der Karte NACH dem Neuladen der Seite. */
  nachNeuladen: string;
  /** Der Kandidat, unabhängig über die API gelesen. */
  kandidat: Kandidat;
}

export interface Flaechenaufbau {
  browser: Browser;
  strecke: Strecke;
  /** Eine API-Sitzung desselben Kontos — für die UNABHÄNGIGE Lesung nach dem Annehmen. */
  admin: Sitzung;
  email: string;
  titel: string;
  dateiInhalt: string;
  /** Eine Zeichenfolge aus dem LETZTEN Absatz des Volltexts — Beleg für „der GANZE Text". */
  letzterAbsatz: string;
}

/**
 * DER BEDIENWEG, von der Dateiauswahl bis zum angenommenen Kandidaten.
 *
 * Er prüft unterwegs nur das, was sonst am falschen Ort scheitern würde (ist die Karte da? steht
 * der Aufklapper da?). Die fachliche ZUSAGE prüft der Aufrufer am zurückgegebenen Befund — aus
 * demselben Grund, aus dem `fahreDenRundlauf` und `pruefeVolltextZusage` getrennt sind.
 */
export async function fahreDenSichtbarenRundlauf(a: Flaechenaufbau): Promise<Flaechenbefund> {
  const { kontext, seite } = await importProfil(a.browser);
  try {
    expect(
      (await kontext.cookies()).some((k) => k.name === "kw_session"),
      `${JOB}: ein frisches Profil trägt bereits einen Sitzungskeks.`,
    ).toBe(false);
    await zurImportseite(seite, a.strecke.basis, a.email);
    await dateiWaehlen(seite, "klarwerk-export.json", a.dateiInhalt);
    await warte(
      seite,
      "(t) => document.body.innerText.includes(t)",
      `die Prüfkarte für „${a.titel}"`,
      a.titel,
      60_000,
    );

    // ── DER GANZE TEXT, VOR DEM ANNEHMEN. ─────────────────────────────────────────────────────
    await warte(
      seite,
      GIBT_ES,
      "der Volltext-Aufklapper auf der Prüfkarte",
      '[data-testid="imp-volltext-schalter"]',
    );
    expect(
      await seite.evaluate<boolean>(fn(GIBT_ES), '[data-testid="imp-volltext-fehlt"]'),
      `${JOB}: die Karte behauptet, dieser Eintrag trage keinen Volltext.`,
    ).toBe(false);
    await tastaturAusloesen(seite, T("imp.fullText.show"));
    await warte(seite, GIBT_ES, "der geöffnete Volltext", '[data-testid="imp-volltext"]');
    const gekuerzt =
      (await seite.evaluate<string | null>(fn(TEXT_VON), '[data-testid="imp-volltext"]')) ?? "";
    const hoehenGekuerzt = await seite.evaluate<Hoehen | null>(fn(GEKLEMMT), VOLLTEXT_KASTEN);
    // NIE GEKÜRZT OHNE HINWEIS: dieser Text liegt über dem Anzeigedeckel, also steht der Satz da —
    // und nach „Mehr anzeigen" nicht mehr.
    expect(
      await seite.evaluate<boolean>(fn(GIBT_ES), '[data-testid="imp-volltext-gekuerzt"]'),
      `${JOB}: der Kürzungshinweis fehlt, obwohl der Text über dem Deckel liegt.`,
    ).toBe(true);
    await tastaturAusloesen(seite, T("imp.fullText.more"));
    await warte(
      seite,
      `() => !document.querySelector('[data-testid="imp-volltext-gekuerzt"]')`,
      "der Kürzungshinweis verschwindet nach „Mehr anzeigen“",
    );
    const ganz =
      (await seite.evaluate<string | null>(fn(TEXT_VON), '[data-testid="imp-volltext"]')) ?? "";
    const hoehenGanz = await seite.evaluate<Hoehen | null>(fn(GEKLEMMT), VOLLTEXT_KASTEN);

    // ── DAS BEWUSSTE ANNEHMEN, per Tastatur, mit sichtbarem Fokus. ────────────────────────────
    await tastaturAusloesen(seite, T("imp.accept"));
    await warte(
      seite,
      "(t) => document.body.innerText.includes(t)",
      "die Karte meldet „angenommen“",
      T("imp.status.angenommen"),
      60_000,
    );

    // ── NEULADEN. ─────────────────────────────────────────────────────────────────────────────
    await seite.reload({ waitUntil: "domcontentloaded" });
    await oeffneWarteschlange(seite);
    await warte(
      seite,
      "(t) => document.body.innerText.includes(t)",
      "die Prüfkarte nach dem Neuladen",
      a.titel,
      60_000,
    );
    await tastaturAusloesen(seite, T("imp.fullText.show"));
    await warte(
      seite,
      GIBT_ES,
      "der geöffnete Volltext nach dem Neuladen",
      '[data-testid="imp-volltext"]',
    );
    const nachNeuladen =
      (await seite.evaluate<string | null>(fn(TEXT_VON), '[data-testid="imp-volltext"]')) ?? "";

    const kandidat = kandidatMitTitel(await warteschlange(a.admin), a.titel);
    return { gekuerzt, hoehenGekuerzt, ganz, hoehenGanz, nachNeuladen, kandidat };
  } finally {
    await kontext.close();
  }
}

/** Die fachliche Zusage an der FLÄCHE — getrennt geprüft, damit ein Rot benennt, was fehlt. */
export function pruefeFlaechenzusage(befund: Flaechenbefund, letzterAbsatz: string): void {
  expect(
    befund.gekuerzt,
    `${JOB}: auf der Prüfkarte steht die Volltextmarke ${VOLLTEXT_MARKE} nicht.`,
  ).toContain(VOLLTEXT_MARKE);
  expect(
    befund.ganz,
    `${JOB}: der LETZTE Absatz des Volltexts fehlt auf der Karte — es ist nicht der ganze Text.`,
  ).toContain(letzterAbsatz);
  // Und er ist danach WIRKLICH zu sehen, nicht bloss im Baum: vorher klemmt der Kasten, danach
  // nicht mehr. Ohne diese zwei Zahlen wäre „gekürzt" eine Behauptung ohne Sachverhalt.
  expect(
    befund.hoehenGekuerzt,
    `${JOB}: die Geometrie des Volltextkastens war nicht lesbar.`,
  ).not.toBeNull();
  expect(
    befund.hoehenGanz,
    `${JOB}: die Geometrie nach „Mehr anzeigen" war nicht lesbar.`,
  ).not.toBeNull();
  const vorher = befund.hoehenGekuerzt as Hoehen;
  const nachher = befund.hoehenGanz as Hoehen;
  expect(
    vorher.scroll,
    `${JOB}: der Volltext war gar nicht geklemmt (${vorher.scroll} ≤ ${vorher.sichtbar}) — der Kürzungshinweis stand ohne Sachverhalt da.`,
  ).toBeGreaterThan(vorher.sichtbar + 1);
  expect(
    nachher.scroll,
    `${JOB}: nach „Mehr anzeigen" bleibt der Text abgeschnitten (${nachher.scroll} > ${nachher.sichtbar}).`,
  ).toBeLessThanOrEqual(nachher.sichtbar + 1);
  expect(
    befund.ganz,
    `${JOB}: die Karte zeigt die Kernaussage (${KERN_MARKE}) anstelle des Volltexts.`,
  ).not.toContain(KERN_MARKE);
  expect(
    befund.nachNeuladen,
    `${JOB}: nach dem Neuladen steht der Volltext nicht mehr auf der Karte.`,
  ).toContain(VOLLTEXT_MARKE);
  expect(befund.kandidat.status, `${JOB}: der Kandidat ist nicht angenommen.`).toBe("angenommen");
  expect(
    befund.kandidat.koId,
    `${JOB}: der angenommene Kandidat nennt kein Zielobjekt.`,
  ).not.toBeNull();
}

// ================================================================================================
// JOB 4293 R2 · § 9 IM ECHTEN BROWSER — DER STAND DER PRÜFKARTE UND DIE SPERRE VON „ANNEHMEN".
// ================================================================================================
//
// WAS NUR HIER MESSBAR IST: dass ein ECHTER Chromium beim Wegfallen des Netzes wirklich das
// `offline`-Ereignis auslöst, dass react-querys `onlineManager` es aufnimmt und dass der Mensch die
// Kennzeichnung mit den Augen findet (`getBoundingClientRect`, nicht nur ein Knoten im Baum). Die
// gemountete Fassung (`stand-der-pruefkarte-mounted.test.tsx`) stellt den Onlinezustand selbst —
// sie kann über den Browser nichts aussagen.
//
// DIE BEIDEN STÖRUNGEN SIND VERSCHIEDEN UND WERDEN GETRENNT GEFAHREN:
//   · OHNE NETZ (`kontext.setOffline`) — es gibt gar keinen Versuch, die Abfrage ruht.
//   · DIENST ANTWORTET 503 (`seite.route`, nur auf dem LESEweg) — es hat einen Versuch gegeben, und
//     er ist gescheitert. Ausgelöst wird die Auffrischung dabei durch eine echte Handlung: eine
//     zweite Datei wählen. Deren `POST` läuft durch (er ist nicht gestört) und zieht die
//     Auffrischung der Warteschlange nach sich (`ImportReview`, `createCandidates.onSuccess`).
// Nach jeder Störung muss der Vorbehalt wieder GEHEN — ein klebender Vorbehalt wäre die andere
// Halbheit.

/** Playwrights Netz- und Leitungsgriffe, dazugeschrieben wie `SeiteMitDatei` (Begründung dort). */
export type KontextMitNetz = Kontext & { setOffline(aus: boolean): Promise<void> };
export type SeiteMitLeitung = Seite & {
  route(muster: string, haken: (route: Leitungsgriff) => unknown): Promise<void>;
  unroute(muster: string): Promise<void>;
};
export interface Leitungsgriff {
  request(): { method(): string };
  fulfill(antwort: Record<string, unknown>): Promise<void>;
  continue(): Promise<void>;
}
/** Die Antworten, die der Browser wirklich empfangen hat — Playwrights `page.on("response")`. */
export type SeiteMitEreignissen = Seite & {
  on(
    ereignis: "response",
    haken: (antwort: {
      url(): string;
      status(): number;
      request(): { method(): string };
    }) => void,
  ): void;
};

/** Das Bild der Karte, so wie ein Mensch es sieht. */
export interface Standbild {
  /** Die Lage, die die Karte selbst nennt (`data-lage`) — ihre Auskunft, nicht die des Tests. */
  lage: string | null;
  /** Der Wortlaut der Kennzeichnung, oder `null`, wenn keine dasteht. */
  satz: string | null;
  /** Hat die Kennzeichnung eine Fläche auf dem Bildschirm? */
  sichtbar: boolean;
  /** Ist „Annehmen" gesperrt? `null` = der Knopf steht gar nicht da. */
  annehmenGesperrt: boolean | null;
  /** Steht die Prüfkarte (ihr Titel) noch da? */
  karteDa: boolean;
  /** Trägt die Karte den Volltext noch? */
  volltextDa: boolean;
  /** Was der Browser selbst über sein Netz sagt. */
  online: boolean;
  /**
   * Wie viele Leseantworten der Warteschlange sind BIS HIERHER erfolgreich (HTTP 200) im Browser
   * angekommen? Runde 4: „Netz ist wieder da" und „ich habe wirklich neu gelesen" sind zwei
   * verschiedene Dinge — ohne diese Zahl liesse sich das eine für das andere halten. Gezählt wird
   * an den echten Antworten des Browsers, nicht an der Selbstauskunft von react-query.
   */
  lesungenErfolgreich: number;
}

const STANDBILD = `(titel) => {
  const stand = document.querySelector('[data-testid="imp-stand"]');
  const annehmen = document.querySelector('[data-testid="imp-annehmen"]');
  const kasten = stand ? stand.getBoundingClientRect() : null;
  const text = document.body.innerText;
  return {
    lage: stand ? stand.getAttribute("data-lage") : null,
    satz: stand ? stand.innerText.replace(/\\s+/g, " ").trim() : null,
    sichtbar: !!(kasten && kasten.width > 0 && kasten.height > 0),
    annehmenGesperrt: annehmen ? !!annehmen.disabled : null,
    karteDa: text.includes(titel),
    volltextDa: !!document.querySelector('[data-testid="imp-volltext-schalter"]'),
    online: navigator.onLine,
  };
}`;

/** Auf eine bestimmte Lage warten — und dann erst ablesen. Kein Blick auf einen Zwischenstand. */
async function warteAufLage(
  seite: Seite,
  lage: string | null,
  titel: string,
  zaehler: () => number,
): Promise<Standbild> {
  await warte(
    seite,
    `(erwartet) => {
      const stand = document.querySelector('[data-testid="imp-stand"]');
      const ist = stand ? stand.getAttribute("data-lage") : null;
      return ist === erwartet;
    }`,
    lage === null ? "die Prüfkarte OHNE Vorbehalt" : `die Prüfkarte in der Lage „${lage}"`,
    lage,
    30_000,
  );
  const bild = await seite.evaluate<Omit<Standbild, "lesungenErfolgreich">>(fn(STANDBILD), titel);
  return { ...bild, lesungenErfolgreich: zaehler() };
}

export interface Standkette {
  frisch: Standbild;
  pausiert: Standbild;
  /** Netz wieder da — aber noch KEINE neue Lesung angekommen (Runde 4, BENs Befund). */
  nachNetzrueckkehr: Standbild;
  gescheitert: Standbild;
  nachErholung: Standbild;
  /**
   * RUNDE 5 (BENs zweite Gegenprobe, hier im echten Browser): die Lücke fällt, WÄHREND die
   * Import-Seite gar nicht eingehängt ist — der Mensch ist kurz auf einer anderen Seite. Kein Bild
   * und keine Einhängung dieser Seite kann sie merken; nur die Uhr am Verbindungsbeobachter.
   */
  nachAbwesenheit: Standbild;
  /** Und auch danach entsperrt erst die erfolgreiche neue Lesung. */
  nachAbwesenheitFrisch: Standbild;
}

export interface Standaufbau {
  browser: Browser;
  strecke: Strecke;
  email: string;
  titel: string;
  /** Die Datei, aus der die Prüfkarte entsteht. */
  dateiInhalt: string;
  /** Eine ZWEITE Datei — sie löst die Auffrischung aus, die am 503 scheitern soll. */
  zweiteDatei: string;
  /** Und eine dritte für die Erholung: derselbe Weg, diesmal ungestört. */
  dritteDatei: string;
  /** Eine vierte für die Erholung NACH der Abwesenheit (Runde 5). */
  vierteDatei: string;
}

/** Der Rückweg über den Verlauf — Playwrights `page.goBack()`, dazugeschrieben wie `route`. */
export type SeiteMitVerlauf = Seite & { goBack(opts?: Record<string, unknown>): Promise<unknown> };

/** Innerhalb der Anwendung wegklicken und zurückkommen — OHNE Neuladen des Dokuments. */
const IN_DER_APP = `(ziel) => {
  const link = document.querySelector('a[href="' + ziel + '"]');
  if (!link) { return false; }
  link.click();
  return true;
}`;

/** Die ganze Kette in einem Durchlauf — an EINER Karte, die nie neu geladen wird. */
export async function fahreDieStandkette(a: Standaufbau): Promise<Standkette> {
  const { kontext, seite } = await importProfil(a.browser);
  const netz = kontext as KontextMitNetz;
  const leitung = seite as SeiteMitLeitung;
  // DIE UNABHÄNGIGE ZÄHLUNG: jede Antwort des Browsers auf die Warteschlangen-Lesung, die wirklich
  // mit 200 angekommen ist. Sie ist der einzige harte Beleg dafür, ob zwischen zwei Standbildern
  // eine neue LESUNG lag — die Kennzeichnung selbst darf dafür nicht herhalten, sie ist der
  // Prüfgegenstand.
  let lesungenErfolgreich = 0;
  (seite as SeiteMitEreignissen).on("response", (antwort) => {
    if (
      antwort.url().includes("/api/library/import/candidates") &&
      antwort.request().method() === "GET" &&
      antwort.status() === 200
    ) {
      lesungenErfolgreich += 1;
    }
  });
  const zaehler = (): number => lesungenErfolgreich;
  try {
    await zurImportseite(seite, a.strecke.basis, a.email);
    await dateiWaehlen(seite, "stand-1.json", a.dateiInhalt);
    await warte(
      seite,
      "(t) => document.body.innerText.includes(t)",
      `die Prüfkarte für „${a.titel}"`,
      a.titel,
      60_000,
    );

    // ── 1 · FRISCH GELESEN: kein Vorbehalt, der Knopf ist frei. ───────────────────────────────
    const frisch = await warteAufLage(seite, null, a.titel, zaehler);

    // ── 2 · OHNE NETZ: der Stand bleibt stehen, gekennzeichnet — und wird nicht angenommen. ───
    await netz.setOffline(true);
    const pausiert = await warteAufLage(seite, "pausiert", a.titel, zaehler);

    // ── 3 · NETZ ZURÜCK — UND SONST NICHTS. ──────────────────────────────────────────────────
    // RUNDE 4, BENS BEFUND: Bis hierher erwartete diese Zeile den Vorbehalt als GEGANGEN, sobald
    // das Netz zurück war. Das war die Halbheit: die Seite läuft mit der produktiven Frischefrist
    // (`staleTime` 30 s, `main.tsx:44`), also holt react-query beim Wiederverbinden gar nichts —
    // die Warteschlange ist danach genau so alt wie vorher. Erwartet wird deshalb der EIGENE
    // Vorbehalt dieser Lage; dass wirklich nichts gelesen wurde, prüft `pruefeStandzusage` an der
    // Antwortzählung und nicht an der Kennzeichnung, die hier der Prüfgegenstand ist.
    await netz.setOffline(false);
    const nachNetzrueckkehr = await warteAufLage(seite, "netzluecke", a.titel, zaehler);

    // ── 4 · DER DIENST ANTWORTET 503 — ausgelöst durch eine echte zweite Dateiauswahl. ───────
    // Eine GESCHEITERTE Lesung ist keine Lesung: der Vorbehalt bleibt, nur mit dem anderen Grund.
    await leitung.route("**/api/library/import/candidates*", async (griff) => {
      if (griff.request().method() === "GET") {
        await griff.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Dienst nicht verfügbar" }),
        });
        return;
      }
      await griff.continue();
    });
    await dateiWaehlen(seite, "stand-2.json", a.zweiteDatei);
    const gescheitert = await warteAufLage(seite, "auffrischung_gescheitert", a.titel, zaehler);

    // ── 5 · ERST DIE ERFOLGREICHE NEUE LESUNG ENTSPERRT. ────────────────────────────────────
    await leitung.unroute("**/api/library/import/candidates*");
    await dateiWaehlen(seite, "stand-3.json", a.dritteDatei);
    const nachErholung = await warteAufLage(seite, null, a.titel, zaehler);

    // ── 6 · DIE LÜCKE FÄLLT, WÄHREND DIESE SEITE GAR NICHT DA IST (Runde 5) ─────────────────
    // Der Weg ist der eines Menschen: über die Kopfzeile auf „Start", dort das Netz verlieren und
    // wiederbekommen, über die Kopfzeile zurück. BEWUSST OHNE `goto`: ein neues Dokument würde
    // Anwendung, Zwischenspeicher und Uhr zurücksetzen — dann wäre ohnehin neu gelesen und der
    // Fall bewiese nichts. Geklickt wird deshalb im Programm (react-router).
    expect(
      await seite.evaluate<boolean>(fn(IN_DER_APP), "/start"),
      `${JOB}: der Weg zur Startseite fehlt in der Kopfzeile.`,
    ).toBe(true);
    await warte(
      seite,
      `() => !document.querySelector("#import-json-card")`,
      "die Import-Seite ist wirklich abgebaut",
    );
    // Ab jetzt kann keine Lesung mehr gelingen — eine stille erfolgreiche Auffrischung beim
    // Zurückkommen ist damit ausgeschlossen, und die Zählung belegt es hinterher.
    await leitung.route("**/api/library/import/candidates*", async (griff) => {
      if (griff.request().method() === "GET") {
        await griff.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Dienst nicht verfügbar" }),
        });
        return;
      }
      await griff.continue();
    });
    await netz.setOffline(true);
    await warte(seite, "() => navigator.onLine === false", "der Browser meldet sich als offline");
    await netz.setOffline(false);
    await warte(seite, "() => navigator.onLine === true", "der Browser ist wieder online");
    // ZURÜCK ÜBER DEN VERLAUF und nicht über einen Link: die Kopfzeile der Startseite führt den
    // Import-Punkt nicht (`/import` ist eine Stufe-2-Fläche) — gemessen, nicht vermutet: der Klick
    // auf `a[href="/import"]` fand dort nichts (Arbeitsprüfung 48ca174d5c99457e8a0110044eca4b36).
    // `goBack()` ist der Weg, den ein Mensch dann nimmt, und er bleibt im selben Dokument: die
    // Anwendung, der Zwischenspeicher und die Netzlückenuhr überleben ihn.
    await (seite as SeiteMitVerlauf).goBack();
    await warte(seite, GIBT_ES, "die Import-Seite ist wieder da", "#import-json-card");
    await oeffneWarteschlange(seite);
    const nachAbwesenheit = await warteAufLage(seite, "netzluecke", a.titel, zaehler);

    // Und auch hier gibt erst die erfolgreiche neue Lesung wieder frei.
    await leitung.unroute("**/api/library/import/candidates*");
    await dateiWaehlen(seite, "stand-4.json", a.vierteDatei);
    const nachAbwesenheitFrisch = await warteAufLage(seite, null, a.titel, zaehler);

    return {
      frisch,
      pausiert,
      nachNetzrueckkehr,
      gescheitert,
      nachErholung,
      nachAbwesenheit,
      nachAbwesenheitFrisch,
    };
  } finally {
    await netz.setOffline(false).catch(() => undefined);
    await kontext.close();
  }
}

/** Die Zusage aus § 9 an der Fläche — je Zustand Kennzeichnung UND Sperrzustand, einzeln. */
export function pruefeStandzusage(kette: Standkette): void {
  const {
    frisch,
    pausiert,
    nachNetzrueckkehr,
    gescheitert,
    nachErholung,
    nachAbwesenheit,
    nachAbwesenheitFrisch,
  } = kette;

  expect(frisch.karteDa, `${JOB}: S/1 · die Prüfkarte fehlt schon im Ausgangszustand.`).toBe(true);
  expect(frisch.online, `${JOB}: S/1 · der Browser war im Ausgangszustand gar nicht online.`).toBe(
    true,
  );
  expect(frisch.satz, `${JOB}: S/1 · auf frischem Stand steht ein Vorbehalt.`).toBeNull();
  expect(
    frisch.annehmenGesperrt,
    `${JOB}: S/1 · „Annehmen" ist auf frisch gelesenem Stand gesperrt.`,
  ).toBe(false);

  expect(
    pausiert.online,
    `${JOB}: S/2 · der Browser meldet sich trotz getrenntem Netz als online — die Trennung hat nicht gewirkt.`,
  ).toBe(false);
  expect(pausiert.karteDa, `${JOB}: S/2 · ohne Netz ist die Prüfkarte verschwunden.`).toBe(true);
  expect(pausiert.volltextDa, `${JOB}: S/2 · ohne Netz ist der Volltext weg.`).toBe(true);
  expect(pausiert.satz, `${JOB}: S/2 · nicht der Satz des Katalogs.`).toBe(T("imp.stand.pausiert"));
  expect(
    pausiert.sichtbar,
    `${JOB}: S/2 · die Kennzeichnung hat keine Fläche auf dem Bildschirm.`,
  ).toBe(true);
  expect(
    pausiert.annehmenGesperrt,
    `${JOB}: S/2 · ohne Netz lässt sich der Stand von vorhin annehmen.`,
  ).toBe(true);

  // ── S/3 · NETZ ZURÜCK IST KEIN FRISCHENACHWEIS (Runde 4, BENs Befund) ──────────────────────
  expect(
    nachNetzrueckkehr.online,
    `${JOB}: S/3 · der Browser ist nach der Rückkehr nicht online.`,
  ).toBe(true);
  // ZUERST der Beleg, dass dieser Punkt wirklich die Lage misst, um die es geht: seit dem
  // Ausgangsbild ist KEINE Leseantwort angekommen. Ohne ihn könnte hinter „gesperrt" auch eine
  // gescheiterte oder eine gerade laufende Lesung stehen — und der Fall bewiese etwas anderes.
  expect(
    nachNetzrueckkehr.lesungenErfolgreich,
    `${JOB}: S/3 · es IST eine Lesung angekommen — dann misst dieser Punkt nicht die Netzlücke.`,
  ).toBe(frisch.lesungenErfolgreich);
  expect(nachNetzrueckkehr.karteDa, `${JOB}: S/3 · die Prüfkarte ist verschwunden.`).toBe(true);
  expect(nachNetzrueckkehr.volltextDa, `${JOB}: S/3 · der Volltext ist weg.`).toBe(true);
  expect(nachNetzrueckkehr.satz, `${JOB}: S/3 · nicht der Satz des Katalogs.`).toBe(
    T("imp.stand.netzluecke"),
  );
  expect(
    nachNetzrueckkehr.sichtbar,
    `${JOB}: S/3 · die Kennzeichnung hat keine Fläche auf dem Bildschirm.`,
  ).toBe(true);
  expect(
    nachNetzrueckkehr.annehmenGesperrt,
    `${JOB}: S/3 · nach blosser Netzrückkehr, ohne eine einzige neue Lesung, lässt sich annehmen.`,
  ).toBe(true);

  expect(
    gescheitert.karteDa,
    `${JOB}: S/4 · die gescheiterte Auffrischung hat die Prüfliste geleert (REGELN § 7).`,
  ).toBe(true);
  expect(gescheitert.volltextDa, `${JOB}: S/4 · der zuletzt gelesene Volltext ist weg.`).toBe(true);
  expect(gescheitert.satz, `${JOB}: S/4 · nicht der Satz des Katalogs.`).toBe(
    T("imp.stand.auffrischungGescheitert"),
  );
  expect(
    gescheitert.sichtbar,
    `${JOB}: S/4 · die Kennzeichnung hat keine Fläche auf dem Bildschirm.`,
  ).toBe(true);
  expect(
    gescheitert.annehmenGesperrt,
    `${JOB}: S/4 · nach gescheiterter Auffrischung lässt sich weiter annehmen.`,
  ).toBe(true);
  // Eine GESCHEITERTE Lesung ist keine Lesung: die Zählung darf hier nicht gestiegen sein.
  expect(
    gescheitert.lesungenErfolgreich,
    `${JOB}: S/4 · es kam eine erfolgreiche Lesung durch — dann ist der 503 nicht angekommen.`,
  ).toBe(frisch.lesungenErfolgreich);

  // ── S/5 · ERST DIE ERFOLGREICHE NEUE LESUNG ENTSPERRT ──────────────────────────────────────
  expect(
    nachErholung.lesungenErfolgreich,
    `${JOB}: S/5 · es ist keine neue Lesung angekommen — die Freigabe hinge dann an nichts.`,
  ).toBeGreaterThan(gescheitert.lesungenErfolgreich);
  expect(
    nachErholung.satz,
    `${JOB}: S/5 · der Vorbehalt klebt am frisch gelesenen Stand.`,
  ).toBeNull();
  expect(
    nachErholung.annehmenGesperrt,
    `${JOB}: S/5 · „Annehmen" bleibt nach der erfolgreichen Wiederaufnahme gesperrt.`,
  ).toBe(false);

  // ── S/6 · DIE LÜCKE IN DER ABWESENHEIT DIESER SEITE (Runde 5) ─────────────────────────────
  expect(
    nachAbwesenheit.online,
    `${JOB}: S/6 · der Browser ist nach der Rückkehr nicht online.`,
  ).toBe(true);
  expect(
    nachAbwesenheit.lesungenErfolgreich,
    `${JOB}: S/6 · es IST eine Lesung angekommen — dann misst dieser Punkt nicht die Lücke.`,
  ).toBe(nachErholung.lesungenErfolgreich);
  expect(nachAbwesenheit.karteDa, `${JOB}: S/6 · die Prüfkarte ist nicht wieder da.`).toBe(true);
  expect(nachAbwesenheit.satz, `${JOB}: S/6 · nicht der Satz des Katalogs.`).toBe(
    T("imp.stand.netzluecke"),
  );
  expect(
    nachAbwesenheit.sichtbar,
    `${JOB}: S/6 · die Kennzeichnung hat keine Fläche auf dem Bildschirm.`,
  ).toBe(true);
  expect(
    nachAbwesenheit.annehmenGesperrt,
    `${JOB}: S/6 · eine Lücke, die in der Abwesenheit dieser Seite lag, lässt den alten Stand annehmen.`,
  ).toBe(true);

  expect(
    nachAbwesenheitFrisch.lesungenErfolgreich,
    `${JOB}: S/7 · es ist keine neue Lesung angekommen — die Freigabe hinge an nichts.`,
  ).toBeGreaterThan(nachAbwesenheit.lesungenErfolgreich);
  expect(nachAbwesenheitFrisch.satz, `${JOB}: S/7 · der Vorbehalt klebt.`).toBeNull();
  expect(
    nachAbwesenheitFrisch.annehmenGesperrt,
    `${JOB}: S/7 · „Annehmen" bleibt nach der erfolgreichen neuen Lesung gesperrt.`,
  ).toBe(false);
}

/**
 * DIE EHRLICHE GRENZE: eine Datei ohne Volltext ergibt keinen leeren Kasten, sondern einen Satz.
 *
 * Gibt den Satz zurück, wie er auf der Seite steht, und den ganzen Seitentext — beides prüft der
 * Aufrufer.
 */
export async function fahreDenGrenzfall(
  a: Omit<Flaechenaufbau, "letzterAbsatz" | "admin">,
): Promise<{ satz: string | null; seitentext: string }> {
  const { kontext, seite } = await importProfil(a.browser);
  try {
    await zurImportseite(seite, a.strecke.basis, a.email);
    await dateiWaehlen(seite, "ohne-volltext.json", a.dateiInhalt);
    await warte(
      seite,
      "(t) => document.body.innerText.includes(t)",
      `die Prüfkarte für „${a.titel}"`,
      a.titel,
      60_000,
    );
    await warte(
      seite,
      GIBT_ES,
      "die benannte Grenze statt eines leeren Felds",
      '[data-testid="imp-volltext-fehlt"]',
    );
    return {
      satz: await seite.evaluate<string | null>(fn(TEXT_VON), '[data-testid="imp-volltext-fehlt"]'),
      seitentext: await seite.evaluate<string>(fn(LIES_TEXT)),
    };
  } finally {
    await kontext.close();
  }
}
