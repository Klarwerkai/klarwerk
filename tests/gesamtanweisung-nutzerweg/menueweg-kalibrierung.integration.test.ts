// ================================================================================================
// JOB 4323 · DIE KALIBRIERUNG — ZEHN VERSTELLUNGEN, DIE DEN NACHWEIS NAMENTLICH ROT MACHEN MÜSSEN.
// ================================================================================================
//
// WOZU DIESE DATEI DA IST. Ein grüner Nachweis sagt nichts, solange niemand gezeigt hat, dass er
// auch scheitern KANN. REGELN.md 9 sagt es für die Sichtbarkeit wörtlich: „Kalibriere jede
// Sichtbarkeitsbehauptung durch gezieltes Ausblenden genau dieses Elements … der unveränderte Test
// MUSS daran mit konkretem Feldnamen scheitern." Genau das steht hier — und zwar für die
// Zusagen, die der Nachweis daneben macht:
//
//   K1  SICHTBARKEIT  · `display:none` auf dem Menüpunkt  → Station (b) scheitert NAMENTLICH.
//   K2  TASTATUR      · `tabindex="-1"` auf demselben Punkt → der Tab-Weg scheitert mit „nur mit
//                       der Maus" (`browserweg.ts:257-259`).
//   K3  SPRACHE       · die Fläche bleibt DEUTSCH, erwartet werden die ENGLISCHEN Sollwerte → rot.
//                       Das ist der Beleg, dass der EN-Nachweis nicht durch den deutschen Rückfall
//                       grün bliebe.
//   K4  BESTAND       · zwischen SIGTERM und Neustart werden die Zeilen gelöscht → Station (e) rot.
//   K5  TEXTKIND      · der Menüpunkt behält Platz und Beschriftung, aber sein texttragendes KIND
//                       bekommt `color: transparent` → rot. Das ist nicht dieselbe Probe wie K1:
//                       der Behälter bleibt sichtbar, und genau darauf ist JOB 4295 dreimal
//                       hereingefallen (R1, R2, R3 — `LEHREN.md`, Korrekturpflicht wörtlich:
//                       „Sichtbarkeit der gelesenen Textteile prüfen, einschließlich ihrer
//                       Nachkommen, statt Container-Sichtbarkeit auf dessen gesamten Text zu
//                       übertragen"). REGELN.md 9 verlangt diese zweite Probe ausdrücklich.
//   K6  BAUSTEIN      · der ZWEITE Baustein bekommt `display:none` → die Fachprüfung der Bausteine
//                       wird NAMENTLICH an ihm rot.                     ┐ BENs Korrekturpflicht 1
//   K7  BAUSTEINTEXT  · nur seine texttragenden Kinder werden verborgen │ zu Runde 1: Baustein UND
//                       (`visibility:hidden`) → ebenfalls namentlich rot.┘ texttragendes Kind je
//   K8  OPACITY       · `opacity: 0` auf beiden Bausteinen — BENs eigene Gegenprobe, mit der die
//                       Strecke in Runde 1 GRÜN blieb. Ab hier ist sie rot.
//   K9  NICHT         · `content-visibility: hidden` + `contain-intrinsic-size` auf dem
//       GERENDERT      Herkunftsabsatz, NACH dem Prozessneustart gesetzt — BENs Gegenprobe aus
//                      Runde 2. Der Baustein bleibt sichtbar und behält Fläche; nur sein Name wird
//                      nicht mehr gezeichnet (`innerText === ""`, `textContent` unverändert).
//                      Damit blieb die Strecke in Runde 2 GRÜN. Ab hier ist sie rot.
//   K10 NAME IM        · der ERSTE Textknoten jedes Herkunftsabsatzes wandert in ein
//       DURCHSICHTIGEN   `<span style="opacity:0">`, der übrige Absatz bleibt sichtbar — BENs
//       KIND             Gegenprobe aus Runde 3. Der Absatz behält Fläche, Farbe und einen
//                        `innerText`, der den Namen weiterhin nennt; nur der Name selbst wird nicht
//                        mehr gelesen. Damit blieb die Strecke in Runde 3 GRÜN. Ab hier ist sie rot
//                        — und derselbe Fall zeigt in EINEM Lauf beide Richtungen: ohne Verstellung
//                        grün, mit ihr rot, nach der Rücknahme wieder grün.
//
// WARUM SIE HINTER EINEM SCHALTER STEHT. Zehn dauerhaft rote Fälle wären ein dauerhaft rotes Tor
// und damit nach kurzer Zeit ein ignoriertes. `KLARWERK_KALIBRIERUNG=1` schaltet sie an; ohne die
// Variable wird jeder Fall mit SICHTBAREM Grund übersprungen — kein stiller Skip, dieselbe Regel
// wie nebenan (`../wiki-gesamtanweisung-abnahme/laufzustand.ts`).
//
// SIE FÄHRT DIESELBEN STATIONEN wie der Nachweis (`./weg.ts`) und keine Kopie davon. Eine Kopie
// wäre eine Aussage über sich selbst.
//
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen.
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Browser,
  type Kontext,
  type Seite,
  fn,
  starteChromium,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, Sitzung, mussGelingen, wissensobjektAnlegen } from "../gast-nutzerweg/strecke";
import { sprachbestand } from "../support/i18nBestand";
import { type Laufzustand, befundsatz } from "../wiki-gesamtanweisung-abnahme/laufzustand";
import {
  type Verbindung,
  MARKE as WEG_MARKE,
  WURZEL,
  anweisungAnlegen,
  bausteinAufnehmen,
  bausteineMuessenSichtbarSein,
  freierPort,
  frischesProfil,
  meldeAnMitTastatur,
  menuewegOhneMaus,
  mussSichtbarTragen,
  pgUrl,
  schneideMit,
  serverUmgebung,
  stelleFlaecheBereit,
  warteAufGesund,
  zerlege,
} from "./weg";

const MARKE = `${WEG_MARKE} KALIBRIERUNG`;
const ADMIN = "kalibrierung-admin@gesamtanweisung-4323.test";
const ANWEISUNGSTITEL = "Kalibrierung (JOB 4323)";

/**
 * Die Titel der beiden gebundenen Wissenseinträge — und damit der SICHTBARE Text, an dem die
 * Fachprüfung die Bausteine erkennt (`LesestandAnsicht.tsx:146-149`, `ga.baustein.herkunft`).
 */
const BAUSTEINTITEL = ["Ventil oeffnen (Kalibrierung)", "Druck pruefen (Kalibrierung)"] as const;

/**
 * Der Schalter. Ohne ihn läuft hier nichts — und der Grund steht sichtbar auf stderr.
 *
 * ZWEI WEGE, UND WARUM ES ZWEI SIND. `KLARWERK_KALIBRIERUNG=1` ist der Weg von Hand. Der
 * Cloud-Wrapper der Bahnen nimmt aber ausschliesslich Aufrufe entgegen, die mit `npx vitest run`
 * BEGINNEN (`register/cloud/work.py`, `validate_execution`) — ein vorangestelltes `VAR=1` wird
 * abgelehnt, und schwere Läufe dürfen nur dort fahren. Deshalb zählt zusätzlich eine Marke im
 * Ordner. Sie ist eine bewusst gelegte Datei und kein Zufall; wer sie liegen lässt, macht nur
 * diesen Integrationslauf rot — das Tor sieht `*.integration.test.ts` ohnehin nicht
 * (`vitest.config.ts:32`).
 */
const MARKENDATEI = join(import.meta.dirname, "KALIBRIERUNG_AN");
const ANGESCHALTET = process.env.KLARWERK_KALIBRIERUNG === "1" || existsSync(MARKENDATEI);

/**
 * Ein Init-Skript, das GENAU diese eine CSS-Regel nachlegt — sonst bleibt die Fläche unverändert.
 *
 * Es hängt den Stil ans Dokument, nicht an ein Element: React baut die Menüzeilen und die
 * Bausteinliste bei jedem Zustandswechsel neu auf, ein gesetztes Attribut wäre danach fort.
 */
function stilSkript(css: string): string {
  return `(() => {
  const setze = () => {
    const s = document.createElement("style");
    s.textContent = ${JSON.stringify(css)};
    document.head.appendChild(s);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setze);
  } else {
    setze();
  }
})();`;
}

/** K1 · Ein Stil, der GENAU den Menüpunkt ausblendet — sonst ist alles unverändert. */
const VERSTECKE_EINTRAG = stilSkript(
  '[data-testid="bereich-gesamtanweisungen"]{display:none !important}',
);

/**
 * K5 · Das texttragende KIND des Menüpunkts durchsichtig machen — der Punkt selbst bleibt sichtbar.
 *
 * `MenueZeile` zeichnet die Beschriftung in ein eigenes `<span class="… truncate">`
 * (`apps/web/src/shell/Menue.tsx:196`). Der `<a>` darüber behält damit Platz, Rand und Fokusring;
 * nur der Text ist fort. Eine Prüfung, die die Sichtbarkeit des Behälters auf dessen ganzen
 * `innerText` überträgt, bliebe hier grün.
 */
const DURCHSICHTIGER_TEXT = stilSkript(
  '[data-testid="bereich-gesamtanweisungen"] span{color: transparent !important}',
);

// K6 bis K8 setzen am ZWEITEN Baustein der Liste an
// (`[data-testid="ga-lesestand-baustein"]:nth-of-type(2)`). Die Regeln stehen AUSGESCHRIEBEN und
// nicht zusammengesetzt: der Zeuge im Tor liest genau diese Zeichenketten, und ein zusammengefügter
// Selektor wäre dort nicht mehr als die Verstellung erkennbar, die er ist.

/** K6 · Der zweite Baustein ist ganz fort — Platz, Text und alles. */
const VERSTECKE_ZWEITEN_BAUSTEIN = stilSkript(
  '[data-testid="ga-lesestand-baustein"]:nth-of-type(2){display:none !important}',
);

/**
 * K7 · Nur die texttragenden KINDER des zweiten Bausteins sind fort — er selbst steht noch da.
 *
 * Die identifizierende Angabe eines Bausteins (Titel und Autor der gebundenen Fassung) wohnt in
 * einem eigenen `<p>` (`apps/web/src/components/gesamtanweisung/LesestandAnsicht.tsx:144-152`).
 * Bleibt der `<li>` sichtbar und verschwindet nur sein Text, dann ist der Baustein für eine
 * Prüfung auf Behälter-Sichtbarkeit noch da und für einen Menschen nicht mehr lesbar.
 */
const VERSTECKE_TEXTKIND_DES_ZWEITEN = stilSkript(
  '[data-testid="ga-lesestand-baustein"]:nth-of-type(2) p{visibility:hidden !important}',
);

/**
 * K8 · BENs eigene Gegenprobe aus Runde 1, wörtlich: `opacity: 0` auf den Bausteinen.
 *
 * Sie ist der Anlass dieser Runde. Mit ihr blieb die gesamte Strecke GRÜN (`Tests 2 passed`,
 * Exit 0, Cloud-Lauf `11b08c1c4470b94f8c1a9b09`), obwohl beide Bausteine unsichtbar waren. Hier
 * steht sie als dauerhafter Fall — nicht, weil eine fremde Messung es verlangt, sondern damit
 * dieselbe Verstellung nie wieder unbemerkt durchgeht.
 */
const DURCHSICHTIGE_BAUSTEINE = stilSkript(
  '[data-testid="ga-lesestand-baustein"]{opacity:0 !important}',
);

/**
 * K9 · BENs Gegenprobe aus Runde 2, wörtlich: der Herkunftsabsatz wird NICHT GERENDERT.
 *
 * `content-visibility: hidden` überspringt den Inhalt eines Kastens; `contain-intrinsic-size` lässt
 * ihm trotzdem seine Höhe. Die Folge ist die heimtückischste Lage dieser ganzen Reihe: der Baustein
 * ist sichtbar, hat Fläche, `display`/`visibility`/`opacity` sind unverdächtig — und `textContent`
 * liefert den Namen weiter, als stünde er da. Nur `innerText` ist leer, und nur
 * `getComputedStyle(...).contentVisibility` sagt, warum.
 *
 * Mit genau dieser Verstellung blieb die Strecke in Runde 2 GRÜN (Cloud-Lauf
 * `31a2d24979fe2b4ac4d57dea`, beide Herkunftsabsätze `innerText === ""`). Sie steht hier als
 * dauerhafter Fall, und sie wird NACH dem Prozessneustart gesetzt — so, wie BEN sie gemessen hat.
 */
const HERKUNFTSABSATZ_NICHT_GERENDERT = stilSkript(
  '[data-testid="ga-lesestand-baustein"] > p:nth-of-type(2){content-visibility: hidden !important; contain-intrinsic-size: auto 24px !important}',
);

/**
 * K10 · BENs Gegenprobe aus Runde 3, wörtlich: der NAME wandert in ein durchsichtiges Kind.
 *
 * Der Herkunftsabsatz (`LesestandAnsicht.tsx:142-152`) trägt DREI Textknoten: den übersetzten Satz
 * mit Titel und Autor, das Trennzeichen „ · " und das Fassungsdatum. BEN hat den ERSTEN — den mit
 * dem Namen — in ein `<span style="opacity:0">` verschoben und alles andere stehen gelassen. Damit
 * blieb der Absatz sichtbar, behielt Fläche und Farbe, und sein `innerText` nannte den Namen
 * weiterhin. Genau daran blieb die Strecke in Runde 3 GRÜN (Cloud-Lauf `2ddd7c926c34fef101a9038c`).
 *
 * SIE IST EINE DOM-VERSTELLUNG UND KEIN STIL, und sie wird deshalb EINMAL und ERST NACH dem Aufbau
 * gesetzt — so, wie BEN sie gesetzt hat. Ein Init-Skript mit Beobachter würde React beim nächsten
 * Neuzeichnen in die Quere kommen; hier zeichnet nach der Verstellung nichts mehr neu.
 *
 * Sie liefert ihren eigenen Beleg zurück: Text des verschobenen Knotens, `checkVisibility` und
 * berechnete Deckkraft des Spans, dazu den REST des Absatzes. Ohne diesen Beleg wäre das Rot unten
 * nicht von K7 zu unterscheiden — dort ist der ganze Absatz fort, hier NUR der Name.
 */
const NAME_IN_DURCHSICHTIGES_KIND = `() => {
  const befunde = [];
  for (const li of document.querySelectorAll('[data-testid="ga-lesestand-baustein"]')) {
    const absaetze = li.querySelectorAll(":scope > p");
    const absatz = absaetze[1];
    if (!absatz) { befunde.push({ verschoben: false, grund: "kein Herkunftsabsatz" }); continue; }
    const knoten = [...absatz.childNodes].find(
      (k) => k.nodeType === 3 && String(k.textContent || "").trim() !== "",
    );
    if (!knoten) { befunde.push({ verschoben: false, grund: "kein Textknoten" }); continue; }
    const huelle = document.createElement("span");
    huelle.setAttribute("data-kalibrierung", "k10");
    huelle.style.opacity = "0";
    absatz.insertBefore(huelle, knoten);
    huelle.appendChild(knoten);
    const s = getComputedStyle(huelle);
    befunde.push({
      verschoben: true,
      grund: "",
      verstecktText: String(huelle.textContent || "").replace(/\\s+/g, " ").trim(),
      verstecktSichtbar: huelle.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      verstecktDeckkraft: String(s.opacity || ""),
      absatzSichtbar: absatz.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      absatzGerendert: String(absatz.innerText || "").replace(/\\s+/g, " ").trim(),
      restText: [...absatz.childNodes]
        .filter((k) => k.nodeType === 3 && String(k.textContent || "").trim() !== "")
        .map((k) => String(k.textContent).replace(/\\s+/g, " ").trim())
        .join(" "),
    });
  }
  return befunde;
}`;

/** Was die Verstellung K10 über sich selbst zurückmeldet — ihr eigener Beleg. */
interface Verstellbefund {
  verschoben: boolean;
  grund: string;
  /** Die Zeichen des verschobenen Knotens — hier muss der Name des Bausteins stehen. */
  verstecktText?: string;
  /** `checkVisibility` der Hülle: sie MUSS `false` sein, sonst ist nichts verstellt. */
  verstecktSichtbar?: boolean;
  verstecktDeckkraft?: string;
  /** Der Absatz selbst bleibt sichtbar — das ist der Unterschied zu K7. */
  absatzSichtbar?: boolean;
  /** `innerText` des Absatzes: er nennt den Namen weiterhin. Genau darauf fiel Runde 3 herein. */
  absatzGerendert?: string;
  /** Was im Absatz sichtbar stehen bleibt (Trennzeichen und Fassungsdatum). */
  restText?: string;
}

/** Die Rücknahme: der Knoten wandert zurück an seine Stelle, die Hülle fällt weg. */
const VERSTELLUNG_ZURUECK = `() => {
  let zurueck = 0;
  for (const huelle of document.querySelectorAll('span[data-kalibrierung="k10"]')) {
    const eltern = huelle.parentNode;
    if (!eltern) continue;
    while (huelle.firstChild) eltern.insertBefore(huelle.firstChild, huelle);
    eltern.removeChild(huelle);
    zurueck += 1;
  }
  return zurueck;
}`;

/** Genau den Menüpunkt aus der Tab-Reihenfolge nehmen — er bleibt sichtbar und mit der Maus nutzbar. */
const NIMM_AUS_DER_TABREIHE = `(() => {
  const setze = () => {
    for (const e of document.querySelectorAll('[data-testid="bereich-gesamtanweisungen"]')) {
      e.setAttribute("tabindex", "-1");
    }
  };
  const start = () => {
    setze();
    new MutationObserver(setze).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();`;

describe("JOB 4323 · Kalibrierung: zehn Verstellungen, die den Nachweis rot machen", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let prozess: ChildProcessWithoutNullStreams | undefined;
  let port = 0;
  let basis = "";
  let zugang = "";
  let verfuegbar = false;
  let laufzustand: Laufzustand | undefined;
  /** Die beiden bindbaren Fassungen — NACHGESEHEN, nicht geraten. */
  const bausteine: { koId: string; fassung: number }[] = [];
  const protokoll: string[] = [];
  const db = `klarwerk_ga4323k_test_${`${Date.now()}`.slice(-9)}`;

  const starte = (): ChildProcessWithoutNullStreams =>
    spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
      cwd: WURZEL,
      env: serverUmgebung(zugang, port),
    });

  beforeAll(async () => {
    if (!ANGESCHALTET) {
      laufzustand = {
        gelaufen: false,
        grund:
          "KLARWERK_KALIBRIERUNG ist nicht 1 — die zehn Verstellungen sind absichtlich abgeschaltet, sonst wäre das Tor dauerhaft rot",
      };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    const url = guardedLocalPgTestUrl();
    if (!url) {
      laufzustand = { gelaufen: false, grund: "keine gesicherte KLARWERK_PG_TEST_URL" };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      laufzustand = { gelaufen: false, grund: "KLARWERK_PG_TEST_URL nennt keinen Rechnernamen" };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${db}`);
    zugang = pgUrl(verbindung, db);
    stelleFlaecheBereit();
    browser = await starteChromium();
    port = await freierPort();
    basis = `http://127.0.0.1:${port}`;
    prozess = starte();
    schneideMit(prozess, protokoll);
    await warteAufGesund(basis, prozess, protokoll, "erster Start");
    const api = new Sitzung(basis, "admin");
    mussGelingen(
      "POST /api/auth/setup",
      await api.sende("POST", "/api/auth/setup", {
        name: "Admin",
        email: ADMIN,
        password: PASSWORT,
      }),
      201,
    );
    for (const titel of BAUSTEINTITEL) {
      const koId = await wissensobjektAnlegen(api, titel);
      const antwort = mussGelingen(
        `GET /api/kos/${koId}/versions`,
        await api.sende("GET", `/api/kos/${koId}/versions`),
      );
      const saetze = (antwort.json as { version: number }[]) ?? [];
      bausteine.push({ koId, fassung: Math.max(...saetze.map((s) => s.version)) });
    }
    verfuegbar = true;
    laufzustand = { gelaufen: true, quelle: `${verbindung.host}:${verbindung.port}/${db}` };
    process.stderr.write(befundsatz(MARKE, laufzustand));
  }, 900_000);

  afterAll(async () => {
    const laufender = prozess;
    if (laufender && laufender.exitCode === null && laufender.signalCode === null) {
      const aus = new Promise<void>((fertig) => laufender.once("exit", () => fertig()));
      laufender.kill("SIGTERM");
      await aus;
    }
    await browser?.close();
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  /** Ein angemeldetes Profil mit genau dieser Verstellung im Init-Skript, auf `/start`. */
  async function angemeldet(verstellung?: string): Promise<{ kontext: Kontext; seite: Seite }> {
    const profil = await frischesProfil(browser as Browser, async (kontext) => {
      if (verstellung !== undefined) {
        await kontext.addInitScript(verstellung);
      }
    });
    await meldeAnMitTastatur(profil.seite, basis, ADMIN, PASSWORT);
    await profil.seite.goto(`${basis}/start`, { waitUntil: "domcontentloaded" });
    await warte(
      profil.seite,
      `() => !!document.querySelector('[data-testid="kopfband-zahnrad"]')`,
      "das Kopfband mit dem Zahnrad",
      undefined,
      45_000,
    );
    return profil;
  }

  function uebersprungen(ctx: { skip: () => void }): boolean {
    if (verfuegbar) {
      return false;
    }
    process.stderr.write(befundsatz(MARKE, laufzustand));
    ctx.skip();
    return true;
  }

  /** Der deutsche Menüweg, so wie ihn der Nachweis fährt. */
  async function deutscherMenueweg(seite: Seite): Promise<void> {
    await menuewegOhneMaus(
      seite,
      sprachbestand("de")["menue.weitereBereiche"] ?? "",
      sprachbestand("de")["ga.bereich.titel"] ?? "",
      "de",
    );
  }

  /**
   * Station (c) des Nachweises, unverändert: Menüweg, anlegen, zwei Bausteine binden.
   *
   * Sie steht hier, damit K4 und K6 bis K8 GENAU denselben Zustand herstellen wie der Nachweis —
   * eine nachgebaute Variante wäre eine Kalibrierung ihrer selbst.
   */
  async function anweisungMitZweiBausteinen(seite: Seite): Promise<string> {
    await deutscherMenueweg(seite);
    const kennung = await anweisungAnlegen(seite, ANWEISUNGSTITEL);
    let gebunden = 0;
    for (const baustein of bausteine) {
      gebunden += 1;
      await bausteinAufnehmen(seite, baustein.koId, baustein.fassung, `kal-${gebunden}`, gebunden);
    }
    return kennung;
  }

  /** Die Fachprüfung der Bausteine — WÖRTLICH die des Nachweises, kein Nachbau. */
  async function bausteinePruefen(seite: Seite, wann: string): Promise<void> {
    await bausteineMuessenSichtbarSein(seite, [...BAUSTEINTITEL], wann);
  }

  // ==============================================================================================
  // K1 · SICHTBARKEIT (REGELN.md 9) — der Menüpunkt ist da, aber niemand sieht ihn.
  // ==============================================================================================
  it("K1 — mit `display:none` auf dem Menüpunkt scheitert Station (b) NAMENTLICH an diesem Eintrag", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const profil = await angemeldet(VERSTECKE_EINTRAG);
    try {
      // Der Eintrag STEHT weiterhin im Dokument und trägt weiterhin seinen Text — das ist gerade
      // der Punkt: eine Prüfung auf blosse Anwesenheit (`querySelector`, `textContent`) bliebe hier
      // grün. `mussSichtbarTragen` unterscheidet beide Lagen in seiner Meldung: „steht nicht im
      // Dokument" gegen „hat keine Fläche auf dem Bildschirm". Erwartet wird die ZWEITE.
      await deutscherMenueweg(profil.seite);
      expect(
        "der Menüpunkt war trotz display:none als sichtbar durchgegangen",
        `${MARKE}: K1 ist nicht rot geworden — der Nachweis prüft Anwesenheit statt Sichtbarkeit`,
      ).toBe("unsichtbar");
    } finally {
      await profil.kontext.close();
    }
  }, 600_000);

  // ==============================================================================================
  // K2 · TASTATUR — der Menüpunkt ist sichtbar, aber kein Tab erreicht ihn.
  // ==============================================================================================
  it("K2 — mit `tabindex=-1` auf dem Menüpunkt scheitert der Tab-Weg mit „nur mit der Maus“", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const profil = await angemeldet(NIMM_AUS_DER_TABREIHE);
    try {
      await deutscherMenueweg(profil.seite);
      // Wird diese Zeile je erreicht, war der Tab-Weg kein Nachweis: dann hätte ein Element
      // ausserhalb der Tab-Reihenfolge den Weg getragen.
      expect(
        "der Menüpunkt war trotz tabindex=-1 per Tastatur erreichbar",
        `${MARKE}: K2 ist nicht rot geworden — der Tab-Weg sieht eine zerstörte Bedienbarkeit nicht`,
      ).toBe("unerreichbar");
    } finally {
      await profil.kontext.close();
    }
  }, 600_000);

  // ==============================================================================================
  // K3 · SPRACHE — die Fläche bleibt DEUTSCH, erwartet werden die ENGLISCHEN Sollwerte.
  // ==============================================================================================
  it("K3 — ohne Sprachwechsel scheitern die englischen Sollwerte: kein deutscher Rückfall trägt den EN-Nachweis", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const profil = await angemeldet();
    try {
      await warte(
        profil.seite,
        `() => document.documentElement.lang === "de"`,
        "die Fläche steht auf Deutsch",
        undefined,
        45_000,
      );
      await menuewegOhneMaus(
        profil.seite,
        sprachbestand("en")["menue.weitereBereiche"] ?? "",
        sprachbestand("en")["ga.bereich.titel"] ?? "",
        "en",
      );
    } finally {
      await profil.kontext.close();
    }
  }, 600_000);

  // ==============================================================================================
  // K5 · TEXTKIND — der Behälter bleibt sichtbar, seine Beschriftung ist unlesbar.
  // ==============================================================================================
  //
  // DIE ZWEITE SICHTBARKEITSPROBE, und sie ist nicht dieselbe wie K1. Der Menüpunkt behält hier
  // Fläche, Rand und Fokusring — nur sein texttragendes Kind ist durchsichtig. Genau an dieser
  // Unterscheidung ist JOB 4295 dreimal gescheitert (R1, R2, R3): eine Prüfung, die die
  // Sichtbarkeit des BEHÄLTERS auf dessen ganzen Text überträgt, bleibt hier grün und behauptet,
  // ein Mensch lese etwas, das er nicht sieht.
  it("K5 — ist das texttragende Kind des Menüpunkts durchsichtig, ist Station (b) rot: Behälter-Sichtbarkeit trägt den Text nicht", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const profil = await angemeldet(DURCHSICHTIGER_TEXT);
    try {
      await deutscherMenueweg(profil.seite);
      expect(
        "die durchsichtige Beschriftung war als sichtbar durchgegangen",
        `${MARKE}: K5 ist nicht rot geworden — die Sichtbarkeit des Behälters wird auf seinen Text übertragen`,
      ).toBe("unlesbar");
    } finally {
      await profil.kontext.close();
    }
  }, 600_000);

  // ==============================================================================================
  // K6 · DER BAUSTEIN SELBST — er steht in der Liste und im Bestand, aber niemand sieht ihn.
  // ==============================================================================================
  //
  // DER ANLASS DIESER RUNDE. BEN hat in Runde 1 die Bausteine unsichtbar gemacht, und die ganze
  // Strecke blieb GRÜN — weil sie nur DOM-Elemente zählte und `data-baustein` las. K6 bis K8 sind
  // die drei Verstellungen, die das ab jetzt unmöglich machen; sie fassen die Fachprüfung NICHT an,
  // sie fahren dieselbe (`bausteinePruefen`).
  it("K6 — ist der zweite Baustein ausgeblendet, wird die Fachprüfung NAMENTLICH an ihm rot", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const profil = await angemeldet(VERSTECKE_ZWEITEN_BAUSTEIN);
    try {
      await anweisungMitZweiBausteinen(profil.seite);
      await bausteinePruefen(profil.seite, "vor dem Prozessneustart");
      expect(
        "der ausgeblendete Baustein war als sichtbar durchgegangen",
        `${MARKE}: K6 ist nicht rot geworden — die Fachprüfung zählt DOM-Elemente statt sichtbare Bausteine`,
      ).toBe("unsichtbar");
    } finally {
      await profil.kontext.close();
    }
  }, 600_000);

  // ==============================================================================================
  // K7 · SEIN TEXTTRAGENDES KIND — der Baustein behält seinen Platz, seine Angabe ist fort.
  // ==============================================================================================
  //
  // Nicht dieselbe Probe wie K6: hier bleibt der `<li>` sichtbar und behält Fläche; unlesbar ist
  // nur die Angabe, an der ein Mensch den Baustein ERKENNT. Eine Prüfung, die die Sichtbarkeit des
  // Behälters auf seinen Inhalt überträgt, bliebe grün — die Fehlerklasse aus JOB 4295 R3.
  it("K7 — ist das texttragende Kind des zweiten Bausteins verborgen, wird die Fachprüfung NAMENTLICH an ihm rot", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const profil = await angemeldet(VERSTECKE_TEXTKIND_DES_ZWEITEN);
    try {
      await anweisungMitZweiBausteinen(profil.seite);
      await bausteinePruefen(profil.seite, "vor dem Prozessneustart");
      expect(
        "der unlesbare Baustein war als erkannt durchgegangen",
        `${MARKE}: K7 ist nicht rot geworden — die Sichtbarkeit des Bausteins wird auf seinen Text übertragen`,
      ).toBe("unlesbar");
    } finally {
      await profil.kontext.close();
    }
  }, 600_000);

  // ==============================================================================================
  // K8 · BENS GEGENPROBE, WÖRTLICH — `opacity: 0` auf beiden Bausteinen.
  // ==============================================================================================
  //
  // Sie ist der Befund, der Runde 1 rot gemacht hat (`ben.md`, EIGENE MESSUNG: „2 Bausteine nach
  // Neustart opacity=0, alle fachlichen Assertions bestanden", Exit 0). Ab hier ist sie ein Fall.
  it("K8 — mit `opacity: 0` auf den Bausteinen wird die Fachprüfung rot: BENs Gegenprobe aus Runde 1", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const profil = await angemeldet(DURCHSICHTIGE_BAUSTEINE);
    try {
      await anweisungMitZweiBausteinen(profil.seite);
      await bausteinePruefen(profil.seite, "vor dem Prozessneustart");
      expect(
        "die durchsichtigen Bausteine waren als sichtbar durchgegangen",
        `${MARKE}: K8 ist nicht rot geworden — genau diese Verstellung liess Runde 1 grün`,
      ).toBe("unsichtbar");
    } finally {
      await profil.kontext.close();
    }
  }, 600_000);

  // ==============================================================================================
  // K4 · BESTAND — zwischen SIGTERM und Neustart verschwinden die Zeilen.
  // ==============================================================================================
  //
  // ER LÄUFT ZULETZT, weil er den gemeinsamen Serverprozess beendet und neu startet. Das ist
  // Absicht: ein eigener zweiter Prozess daneben wäre eine zweite Wahrheit über denselben Start.
  it("K4 — werden die Zeilen zwischen SIGTERM und Neustart gelöscht, ist Station (e) rot", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const pool = new Pool({ connectionString: zugang });
    const profil = await angemeldet();
    let anweisungId = "";
    try {
      anweisungId = await anweisungMitZweiBausteinen(profil.seite);
      // Vor der Verstellung stehen beide Bausteine SICHTBAR da — sonst sagte das Rot unten nichts
      // über den Neustart, sondern nur über einen Aufbau, der schon vorher nicht trug.
      await bausteinePruefen(profil.seite, "vor dem Prozessneustart");
    } finally {
      await profil.kontext.close();
    }

    const laufender = prozess as ChildProcessWithoutNullStreams;
    const beendet = new Promise<void>((fertig) => laufender.once("exit", () => fertig()));
    laufender.kill("SIGTERM");
    await beendet;

    // ── DIE VERSTELLUNG: der Bestand verschwindet, während niemand hinsieht. ─────────────────────
    await pool.query("DELETE FROM gesamtanweisung_bausteine WHERE anweisung_id = $1", [
      anweisungId,
    ]);
    await pool.query("DELETE FROM gesamtanweisungen WHERE id = $1", [anweisungId]);

    prozess = starte();
    protokoll.length = 0;
    schneideMit(prozess, protokoll);
    await warteAufGesund(basis, prozess, protokoll, "Neustart");

    const nachher = await frischesProfil(browser as Browser);
    try {
      await meldeAnMitTastatur(nachher.seite, basis, ADMIN, PASSWORT);
      await nachher.seite.goto(`${basis}/gesamtanweisungen/${anweisungId}`, {
        waitUntil: "domcontentloaded",
      });
      await warte(
        nachher.seite,
        `(n) => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === n`,
        "die beiden Bausteine nach dem Prozessneustart",
        2,
        20_000,
      );
      await mussSichtbarTragen(
        nachher.seite,
        '[data-testid="ga-lesestand"]',
        ANWEISUNGSTITEL,
        "der Titel ist nach dem Prozessneustart nicht mehr zu sehen",
      );
      await bausteinePruefen(nachher.seite, "nach dem Prozessneustart");
    } finally {
      await nachher.kontext.close();
      await pool.end();
    }
  }, 900_000);

  // ==============================================================================================
  // K9 · DER NICHT GERENDERTE HERKUNFTSABSATZ — BENs Gegenprobe aus Runde 2, an ihrer Stelle.
  // ==============================================================================================
  //
  // ER LÄUFT SPÄT, weil er wie K4 den gemeinsamen Serverprozess beendet und neu startet; nach ihm
  // kommt nur noch K10, der dasselbe tut.
  //
  // UND ER IST ZWEITEILIG, weil BENs Messung es war: VOR dem Neustart läuft die Fachprüfung ohne
  // jede Verstellung und MUSS bestehen — sonst sagte das Rot unten nichts über den nicht
  // gerenderten Text, sondern nur über einen Aufbau, der schon vorher nicht trug. Erst das
  // Browserprofil NACH dem Neustart bekommt die Verstellung.
  it("K9 — wird der Herkunftsabsatz nach dem Neustart nicht mehr gerendert, wird die Fachprüfung NAMENTLICH am Baustein rot", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const profil = await angemeldet();
    let anweisungId = "";
    try {
      anweisungId = await anweisungMitZweiBausteinen(profil.seite);
      await bausteinePruefen(profil.seite, "vor dem Prozessneustart");
    } finally {
      await profil.kontext.close();
    }

    const laufender = prozess as ChildProcessWithoutNullStreams;
    const beendet = new Promise<void>((fertig) => laufender.once("exit", () => fertig()));
    laufender.kill("SIGTERM");
    await beendet;
    prozess = starte();
    protokoll.length = 0;
    schneideMit(prozess, protokoll);
    await warteAufGesund(basis, prozess, protokoll, "Neustart");

    // ── DIE VERSTELLUNG: erst jetzt, im neuen Browserprofil. ────────────────────────────────────
    const nachher = await frischesProfil(browser as Browser, async (kontext) => {
      await kontext.addInitScript(HERKUNFTSABSATZ_NICHT_GERENDERT);
    });
    try {
      await meldeAnMitTastatur(nachher.seite, basis, ADMIN, PASSWORT);
      await nachher.seite.goto(`${basis}/gesamtanweisungen/${anweisungId}`, {
        waitUntil: "domcontentloaded",
      });
      await warte(
        nachher.seite,
        `(n) => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === n`,
        "die beiden Bausteine nach dem Prozessneustart",
        2,
        45_000,
      );
      // Der Bestand ist da, der Titel steht da, die Bausteine stehen da und haben Fläche — nur
      // ihren Namen liest niemand mehr. Genau das darf nicht als „wiederhergestellt" durchgehen.
      await mussSichtbarTragen(
        nachher.seite,
        '[data-testid="ga-lesestand"]',
        ANWEISUNGSTITEL,
        "der Titel ist nach dem Prozessneustart nicht mehr zu sehen",
      );
      await bausteinePruefen(nachher.seite, "nach dem Prozessneustart");
      expect(
        "der nicht gerenderte Herkunftstext war als sichtbar durchgegangen",
        `${MARKE}: K9 ist nicht rot geworden — genau diese Verstellung liess Runde 2 grün`,
      ).toBe("nicht gerendert");
    } finally {
      await nachher.kontext.close();
    }
  }, 900_000);

  // ==============================================================================================
  // K10 · DER NAME IM DURCHSICHTIGEN KIND — BENs Gegenprobe aus Runde 3, an ihrer Stelle.
  // ==============================================================================================
  //
  // ER IST DER EINZIGE FALL, DER BEIDE RICHTUNGEN IN EINEM LAUF ZEIGT, weil BENs Befund genau die
  // Unterscheidung war, die keine Stilregel herstellt: derselbe Absatz, dieselbe Seite, dasselbe
  // Browserprofil — EINMAL mit dem Namen an seiner Stelle (grün) und EINMAL mit dem Namen in einem
  // durchsichtigen Kind (rot). Beide Läufe fahren die WÖRTLICH gleiche Fachprüfung.
  //
  // DREI ZUSICHERUNGEN STEHEN VOR DEM ROT, sonst sagte es nichts über den verschachtelten Fall:
  //   1. die Verstellung hat wirklich stattgefunden und der verschobene Knoten trägt den Namen;
  //   2. das Kind ist wirklich unsichtbar (`checkVisibility === false`, `opacity === "0"`);
  //   3. der ABSATZ ist weiterhin sichtbar und zeichnet weiterhin Text — sonst wäre es K7.
  it("K10 — wandert der Name in ein Kind mit `opacity:0` und bleibt der Absatz sichtbar, wird die Fachprüfung NAMENTLICH am Baustein rot", async (ctx) => {
    if (uebersprungen(ctx)) {
      return;
    }
    const profil = await angemeldet();
    let anweisungId = "";
    try {
      anweisungId = await anweisungMitZweiBausteinen(profil.seite);
      await bausteinePruefen(profil.seite, "vor dem Prozessneustart");
    } finally {
      await profil.kontext.close();
    }

    const laufender = prozess as ChildProcessWithoutNullStreams;
    const beendet = new Promise<void>((fertig) => laufender.once("exit", () => fertig()));
    laufender.kill("SIGTERM");
    await beendet;
    prozess = starte();
    protokoll.length = 0;
    schneideMit(prozess, protokoll);
    await warteAufGesund(basis, prozess, protokoll, "Neustart");

    const nachher = await frischesProfil(browser as Browser);
    try {
      await meldeAnMitTastatur(nachher.seite, basis, ADMIN, PASSWORT);
      await nachher.seite.goto(`${basis}/gesamtanweisungen/${anweisungId}`, {
        waitUntil: "domcontentloaded",
      });
      await warte(
        nachher.seite,
        `(n) => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === n`,
        "die beiden Bausteine nach dem Prozessneustart",
        2,
        45_000,
      );
      // ── OHNE VERSTELLUNG: dieselbe Seite, dieselbe Prüfung — sie MUSS bestehen. ────────────────
      await mussSichtbarTragen(
        nachher.seite,
        '[data-testid="ga-lesestand"]',
        ANWEISUNGSTITEL,
        "der Titel ist nach dem Prozessneustart nicht mehr zu sehen",
      );
      await bausteinePruefen(nachher.seite, "nach dem Prozessneustart, vor der Verstellung");

      // ── DIE VERSTELLUNG: der erste Textknoten jedes Herkunftsabsatzes wandert ins Kind. ────────
      const verstellt = await nachher.seite.evaluate<Verstellbefund[]>(
        fn(NAME_IN_DURCHSICHTIGES_KIND),
      );
      expect(
        verstellt.length,
        `${MARKE}: K10 hat nicht beide Herkunftsabsätze erreicht (${verstellt.length})`,
      ).toBe(2);
      for (let i = 0; i < verstellt.length; i += 1) {
        const b = verstellt[i] as Verstellbefund;
        const wer = BAUSTEINTITEL[i] ?? `Baustein ${i + 1}`;
        expect(
          b.verschoben,
          `${MARKE}: K10 konnte bei „${wer}" nichts verschieben: ${b.grund}`,
        ).toBe(true);
        expect(
          b.verstecktText ?? "",
          `${MARKE}: der verschobene Knoten bei „${wer}" trägt den Namen gar nicht — dann misst K10 etwas anderes`,
        ).toContain(wer);
        expect(
          b.verstecktSichtbar,
          `${MARKE}: das durchsichtige Kind bei „${wer}" gilt der Engine als SICHTBAR — dann ist es keine Verstellung`,
        ).toBe(false);
        expect(
          b.verstecktDeckkraft,
          `${MARKE}: das Kind bei „${wer}" hat nicht die Deckkraft 0`,
        ).toBe("0");
        // UND DER ABSATZ STEHT NOCH DA. Das ist der Unterschied zu K7 — und der Grund, warum diese
        // Verstellung die feldweise Messung aus Runde 3 überlebt hat: sein `innerText` nennt den
        // Namen weiterhin, obwohl niemand ihn liest.
        expect(
          b.absatzSichtbar,
          `${MARKE}: der Herkunftsabsatz bei „${wer}" ist mitverschwunden — dann wäre K10 nur eine zweite K7`,
        ).toBe(true);
        expect(
          b.restText ?? "",
          `${MARKE}: im Absatz bei „${wer}" steht kein sichtbarer Resttext mehr — dann wäre K10 nur eine zweite K7`,
        ).not.toBe("");
        expect(
          b.absatzGerendert ?? "",
          `${MARKE}: selbst der innerText des Absatzes nennt „${wer}" nicht mehr — dann prüft K10 nicht mehr BENs Lage`,
        ).toContain(wer);
      }

      // ── DAS ERWARTETE ROT — aufgefangen, damit die RÜCKNAHME danach noch gemessen wird. ────────
      let rot: unknown;
      try {
        await bausteinePruefen(nachher.seite, "nach dem Prozessneustart");
      } catch (fehler) {
        rot = fehler;
      }

      // ── DIE RÜCKNAHME: der Knoten wandert zurück, und dieselbe Prüfung ist wieder GRÜN. ────────
      // Ohne sie bewiese das Rot oben nur, dass die Prüfung überhaupt rot werden kann — nicht, dass
      // GENAU diese Verstellung sie rot macht.
      const zurueck = await nachher.seite.evaluate<number>(fn(VERSTELLUNG_ZURUECK));
      expect(zurueck, `${MARKE}: K10 konnte die Verstellung nicht zurücknehmen`).toBe(2);
      await bausteinePruefen(nachher.seite, "nach der Rücknahme der Verstellung");

      if (rot !== undefined) {
        throw rot;
      }
      expect(
        "der Name im durchsichtigen Kind war als sichtbar durchgegangen",
        `${MARKE}: K10 ist nicht rot geworden — genau diese Verstellung liess Runde 3 grün`,
      ).toBe("unsichtbar");
    } finally {
      await nachher.kontext.close();
    }
  }, 900_000);
});
