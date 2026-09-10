// ================================================================================================
// JOB 3420 · RUNDE 2 — DER TASTATURWEG ZUM WIEDERHOLEN WIRD GEGANGEN, NICHT NACHGEBILDET.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (BENs Korrekturpflicht 2 an Runde 1, wörtlich aus seiner
// Promptverbesserung): „Prüfe Tab→Enter im Browser; direktes `focus()` plus synthetischer Mausklick
// ersetzt diesen Nachweis nicht." Runde 1 hat den Tastaturweg in jsdom aus drei Einzelbedingungen
// zusammengesetzt — jsdom hat weder eine Tabreihenfolge noch die Standardaktivierung eines
// `<button>`. Das prüft, dass der Aufruf am Knopf HÄNGT, nicht dass die Tastatur ihn ERREICHT und
// AUSLÖST. Genau darin unterscheidet sich ein `<button>` von einem `<div onClick tabIndex={-1}>`.
//
// HIER DRÜCKT CHROMIUM SELBST, an der gebauten Anwendung mit dem echten Fastify-Backend dahinter
// (dieselbe Bühne wie `tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts`, eine
// Instanz je Messdatei):
//   K1 · echte `Tab`-Anschläge bis der Wiederholen-Knopf den Fokus hat — nie erreichbar wäre die
//        Halbheit „nur mit der Maus".
//   K2 · echtes `Enter` löst GENAU einen zusätzlichen `POST /api/reasoner/test` aus (an der Weiche
//        gezählt, nicht am Zustand behauptet).
//   K3 · WÄHREND dieser Lauf offen ist, steht der Knopf weiter da, ist gesperrt und trägt
//        „teste …"; der stehen gebliebene Befund ist als der ÄLTERE ausgewiesen. Das ist der
//        Zustand, den Runde 1 als erfüllt gemeldet hat, ohne dass es ihn gab (BENs Messung:
//        `kastenVorhanden:false`).
//   K4 · nach der Antwort ist der Knopf wieder bedienbar und der Älter-Hinweis weg.
//   K5 · und der Tastaturweg ist danach WIEDER gangbar: Tab erreicht den Knopf erneut, Enter löst
//        einen weiteren Lauf aus.
//
// WO DER FOKUS WÄHREND DES LAUFS WIRKLICH STEHT — die Korrektur der Runde 2 (BENs einziger Rotgrund,
// wörtlich aus seiner Promptverbesserung): „Behaupte Fokuserhalt nur nach expliziter Messung von
// `document.activeElement`. Ausbleibende Requests nach Enter belegen allein keinen Fokus auf dem
// geprüften Knopf." Runde 2 hat aus zwei folgenlosen Enter-Anschlägen geschlossen, der Fokus liege
// noch auf dem gesperrten Knopf. Das ist FALSCH, und K3 misst jetzt, was wirklich passiert: sobald
// der Knopf `disabled` wird, nimmt Chromium ihm den Fokus (die HTML-Spezifikation macht ein
// deaktiviertes Bedienelement fokusunfähig) — `document.activeElement` ist danach `body`. Die zwei
// zusätzlichen Enter-Anschläge belegen deshalb NUR das, was sie belegen können: in diesem Zustand
// entsteht kein weiterer Serverruf. Eine Produktpflicht, den Fokus auf einem deaktivierten Knopf zu
// halten, gibt es nicht (BEN, Runde 2); gemessen und benannt wird der Zustand trotzdem.
//
// DIE MESSLAGE WIRD EINGESPEIST, NICHT ERFUNDEN: die echte Route antwortet, ihr Rumpf wird auf dem
// Weg zur Seite durch ein gemessenes Scheitern ersetzt (`stand.antworten.vorAuslieferung`, JOB 3130)
// — ein Netzfehler zum Anbieter. Ohne diesen Griff hinge der Fall an der Zufallslage der Instanz,
// und die zweite Antwort liesse sich nicht offen halten.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type Seite, type Stand, fn, starte } from "../design/h6-chromium";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

/** Echte Tastenanschläge des Browsers (Playwright) — die rohe Seite der Bühne. */
interface SeiteMitTastatur {
  keyboard: { press(taste: string): Promise<void> };
}

const PFAD = "/api/reasoner/test";
const KASTEN = "ki-fehler-cloud";
/** Die Beschriftungen kommen aus derselben Quelle, aus der die Fläche sie zeichnet. */
const TESTEN = i18n.t("adm.ai.test", { lng: "de" });
const WIEDERHOLEN = i18n.t("adm.ai.wiederholen", { lng: "de" });
const LAEUFT = i18n.t("adm.ai.testRunning", { lng: "de" });
const URSACHE = i18n.t("adm.ai.befund.nichtErreichbar", { lng: "de" });

/** Das eingespeiste Scheitern — ein `ReasonerProbeResult`, wie `probe()` es im Netzfall liefert. */
const NETZFEHLER = JSON.stringify({
  ok: false,
  provider: "anthropic:claude-sonnet-4-6",
  mode: "model",
  detail: "Anbieter nicht erreichbar: fetch failed",
  at: "2026-09-09T10:00:00.000Z",
  anbieter: "anthropic",
  fehlerklasse: "network",
});

interface Zustand {
  kastenDa: boolean;
  knopfText: string | null;
  gesperrt: boolean | null;
  aelter: string | null;
  text: string;
  fokusAufKnopf: boolean;
  /** WO `document.activeElement` wirklich steht — gemessen, nicht aus Folgen erschlossen. */
  fokus: { tag: string; text: string; imKasten: boolean };
}

/** Was der Fehlerkasten gerade zeigt — und wo der Fokus steht. */
const ZUSTAND = `([kastenId]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const aktiv = document.activeElement;
  const kasten = document.querySelector('[data-testid="' + kastenId + '"]');
  const fokus = {
    tag: aktiv ? aktiv.tagName.toLowerCase() : '(keiner)',
    text: aktiv ? norm(aktiv.textContent).slice(0, 60) : '',
    imKasten: kasten !== null && aktiv !== null && kasten.contains(aktiv),
  };
  if (!kasten) {
    return { kastenDa: false, knopfText: null, gesperrt: null, aelter: null, text: '', fokusAufKnopf: false, fokus };
  }
  const knopf = kasten.querySelector('button');
  const aelter = kasten.querySelector('[data-testid="' + kastenId + '-aelter"]');
  return {
    kastenDa: true,
    knopfText: knopf ? norm(knopf.textContent) : null,
    gesperrt: knopf ? knopf.disabled : null,
    aelter: aelter ? norm(aelter.textContent) : null,
    text: norm(kasten.textContent),
    fokusAufKnopf: knopf !== null && aktiv === knopf,
    fokus,
  };
}`;

/** Den Cloud-Test anstossen — der EINE Klick, den auch ein Mensch als Erstes macht. */
const ERSTER_TEST = `([beschriftung]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const karte = document.querySelector('[data-testid="detail-ki"]');
  if (!karte) return { fehler: 'die KI-Detailkarte steht nicht' };
  const knopf = [...karte.querySelectorAll('button')].find((b) => norm(b.textContent) === beschriftung);
  if (!knopf) return { fehler: 'Knopf „' + beschriftung + '" nicht gefunden' };
  knopf.click();
  // Den Fokus wegräumen: er hinge sonst am gerade gedrückten Knopf, und die Tabreihenfolge
  // unten würde ihren eigenen Startpunkt messen statt den Weg der Tastatur.
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  return { fehler: null };
}`;

/** Die Karte ist nicht nur gemountet, sondern fertig geladen: ihr Prüfknopf steht da. */
const WARTE_KNOPF = `([beschriftung]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const karte = document.querySelector('[data-testid="detail-ki"]');
  return karte !== null
    && [...karte.querySelectorAll('button')].some((b) => norm(b.textContent) === beschriftung);
}`;
const WARTE_KASTEN = `([kastenId]) => document.querySelector('[data-testid="' + kastenId + '"]') !== null`;
const WARTE_GESPERRT = `([kastenId]) => {
  const k = document.querySelector('[data-testid="' + kastenId + '"] button');
  return k !== null && k.disabled === true;
}`;
const WARTE_FREI = `([kastenId]) => {
  const k = document.querySelector('[data-testid="' + kastenId + '"] button');
  return k !== null && k.disabled === false;
}`;

let stand: Stand;
/** Solange gesetzt, hält die Weiche die nächste Antwort des Prüfwegs offen. */
let durchlassen: (() => void) | null = null;
let gehalten: Promise<void> | null = null;

function seiteRoh(): Seite & SeiteMitTastatur {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return seite as unknown as Seite & SeiteMitTastatur;
}

const zustand = async (): Promise<Zustand> =>
  await seiteRoh().evaluate<Zustand>(fn(ZUSTAND), [KASTEN]);

const rufe = (): number => stand.abrufe.get(PFAD) ?? 0;

/** Wartet, bis die Weiche den erwarteten Ruf gezählt hat (oder die Frist abläuft). */
async function warteAufRuf(mindestens: number, frist = 15_000): Promise<void> {
  const bis = Date.now() + frist;
  while (rufe() < mindestens && Date.now() < bis) {
    await new Promise((weiter) => setTimeout(weiter, 50));
  }
}

/**
 * So oft `Tab` drücken, bis der Wiederholen-Knopf im Fehlerkasten den Fokus hat — höchstens `max`
 * Anschläge. `-1` heisst: nie erreicht, und genau das wäre die Halbheit „nur mit der Maus".
 */
async function tabBisWiederholen(max = 60): Promise<{ schritte: number; zustand: Zustand | null }> {
  const seite = seiteRoh();
  for (let i = 1; i <= max; i++) {
    await seite.keyboard.press("Tab");
    const z = await zustand();
    if (z.fokusAufKnopf) {
      return { schritte: i, zustand: z };
    }
  }
  return { schritte: -1, zustand: await zustand() };
}

describe("JOB 3420 · der Wiederholen-Knopf, mit echter Tastatur in Chromium", () => {
  beforeAll(async () => {
    stand = await starte("/admin?bereich=ki&detail=ki", '[data-testid="detail-ki"]');
    if (stand.fehler === null) {
      stand.antworten.vorAuslieferung = async (url, body) => {
        if (url.pathname !== PFAD) {
          return body;
        }
        // Ab dem ZWEITEN Ruf bleibt die Antwort offen, bis der Test sie durchlässt.
        if ((stand.abrufe.get(PFAD) ?? 0) >= 2 && gehalten !== null) {
          await gehalten;
        }
        return NETZFEHLER;
      };
      try {
        // Gemountet heisst noch nicht bedienbar: die Karte hängt an ihrer Konfigurationsabfrage.
        await seiteRoh().waitForFunction(fn(WARTE_KNOPF), [TESTEN], { timeout: 30_000 });
      } catch (e) {
        stand.fehler = String(e).split("\n").slice(0, 2).join(" | ");
      }
    }
  }, 180_000);

  afterAll(async () => {
    durchlassen?.();
    try {
      await schliesseChromium(
        "tests/ki-fehlerhilfe/wiederholen-tastatur-chromium.test.ts",
        stand?.browser,
      );
    } finally {
      await stand?.app?.close();
    }
  }, 60_000);

  it("K0 · die Bühne steht: gebaute App, echtes Backend, KI-Karte offen", async () => {
    expect(stand.fehler, "Chromium-Bühne kam nicht hoch").toBeNull();
    expect(stand.seitenfehler, "die Seite hat selbst Fehler geworfen").toEqual([]);
    const start = await seiteRoh().evaluate<{ fehler: string | null }>(fn(ERSTER_TEST), [TESTEN]);
    expect(start.fehler, "der erste Prüflauf liess sich nicht anstossen").toBeNull();
    await seiteRoh().waitForFunction(fn(WARTE_KASTEN), [KASTEN], { timeout: 15_000 });
    const z = await zustand();
    expect(z.text, "der eingespeiste Netzfehler steht nicht im Kasten").toContain(URSACHE);
    expect(z.knopfText).toBe(WIEDERHOLEN);
    expect(rufe(), "der erste Prüfweg wurde nicht genau einmal gerufen").toBe(1);
  }, 120_000);

  it("K1–K4 · Tab erreicht den Knopf, Enter löst genau einen Lauf aus, der Lauf ist sichtbar", async () => {
    // Die zweite Antwort wird ab jetzt festgehalten — nur so ist der laufende Zustand messbar.
    gehalten = new Promise<void>((aufloesen) => {
      durchlassen = (): void => aufloesen();
    });

    // K1 — der Weg der Tastatur.
    const { schritte, zustand: fokussiert } = await tabBisWiederholen();
    expect(
      schritte,
      "der Wiederholen-Knopf war in 60 Tab-Anschlägen nicht erreichbar — das ist die Halbheit: nur mit der Maus",
    ).toBeGreaterThan(0);
    expect(fokussiert?.knopfText).toBe(WIEDERHOLEN);
    expect(fokussiert?.gesperrt).toBe(false);
    // eslint-disable-next-line no-console -- der Beleg der Rückgabe
    console.log(`JOB 3420 · Wiederholen per Tastatur erreicht: ${schritte} Tab-Anschläge`);

    // K2 — echtes Enter auf dem fokussierten Knopf.
    const vorher = rufe();
    await seiteRoh().keyboard.press("Enter");
    await seiteRoh().waitForFunction(fn(WARTE_GESPERRT), [KASTEN], { timeout: 15_000 });
    expect(rufe() - vorher, "Enter löste nicht genau einen zusätzlichen Prüflauf aus").toBe(1);

    // K3 — der laufende Zustand, gemessen an der offen gehaltenen Antwort.
    const laufend = await zustand();
    expect(laufend.kastenDa, "der Fehlerkasten verschwand beim Wiederholen").toBe(true);
    expect(laufend.knopfText, "der laufende Knopf trägt nicht die Laufaufschrift").toBe(LAEUFT);
    expect(laufend.gesperrt).toBe(true);
    expect(
      laufend.aelter,
      "der stehen gebliebene Befund ist nicht als älterer ausgewiesen",
    ).not.toBeNull();
    expect(laufend.text, "der zuletzt gemessene Befund wurde geleert").toContain(URSACHE);

    // WO DER FOKUS STEHT — gemessen an `document.activeElement`, nicht aus Folgen erschlossen.
    // Ein `disabled` gewordener Knopf ist nicht mehr fokussierbar; Chromium gibt den Fokus an
    // `body` zurück. Runde 2 hat hier Fokuserhalt BEHAUPTET — er besteht nicht.
    expect(
      laufend.fokusAufKnopf,
      "unerwartet: der deaktivierte Knopf hält den Fokus doch — dann gehört die Aussage in der Rückgabe umgeschrieben",
    ).toBe(false);
    // WO er stattdessen steht, wird protokolliert und NICHT zugesichert: das ist Browserverhalten,
    // keine Zusage dieses Produkts. Zugesichert wird nur das Gemessene — er ist nicht am Knopf.
    // eslint-disable-next-line no-console -- der Beleg der Rückgabe
    console.log(
      `JOB 3420 · Fokus während des Laufs: <${laufend.fokus.tag}> · auf dem Knopf: ${laufend.fokusAufKnopf} · im Kasten: ${laufend.fokus.imKasten}`,
    );
    // Und deshalb belegen die zwei folgenden Enter-Anschläge NUR dies: in diesem Zustand — Knopf
    // gesperrt, Fokus auf `body` — entsteht kein weiterer Serverruf. Sie sind KEIN Fokusbeweis.
    await seiteRoh().keyboard.press("Enter");
    await seiteRoh().keyboard.press("Enter");
    expect(rufe(), "während des laufenden Prüfwegs entstand ein weiterer Ruf").toBe(vorher + 1);

    // K4 — Antwort durchlassen: der Knopf ist wieder bedienbar, der Älter-Hinweis ist weg.
    durchlassen?.();
    await seiteRoh().waitForFunction(fn(WARTE_FREI), [KASTEN], { timeout: 15_000 });
    const danach = await zustand();
    expect(danach.knopfText).toBe(WIEDERHOLEN);
    expect(danach.aelter).toBeNull();
    expect(danach.text).toContain(URSACHE);
    expect(rufe()).toBe(vorher + 1);
    // Auch hier keine Behauptung, sondern die Messung: der Fokus kommt NICHT von selbst zurück.
    // eslint-disable-next-line no-console -- der Beleg der Rückgabe
    console.log(
      `JOB 3420 · Fokus nach dem Lauf: <${danach.fokus.tag}> · auf dem Knopf: ${danach.fokusAufKnopf}`,
    );
    gehalten = null;
  }, 180_000);

  it("K5 · nach dem Lauf ist der Tastaturweg wieder gangbar: Tab erreicht den Knopf, Enter löst aus", async () => {
    // Die Folge aus K3: der Fokus liegt nach dem Lauf nicht mehr auf dem Knopf. Damit die Zusage
    // „per Tastatur erreichbar" nicht nur für den ERSTEN Versuch gilt, wird der Weg hier ein
    // zweites Mal GEGANGEN — aus dem Zustand heraus, den K4 hinterlassen hat, ohne Fokushilfe.
    const vorZustand = await zustand();
    expect(vorZustand.gesperrt, "der Knopf ist noch gesperrt — K4 lief nicht sauber zu Ende").toBe(
      false,
    );
    const { schritte, zustand: fokussiert } = await tabBisWiederholen();
    expect(
      schritte,
      "der Knopf war nach dem Lauf per Tastatur nicht mehr erreichbar",
    ).toBeGreaterThan(0);
    expect(fokussiert?.fokusAufKnopf).toBe(true);
    const vorher = rufe();
    await seiteRoh().keyboard.press("Enter");
    // Diesmal antwortet die Weiche sofort (K4 hat die Bremse gelöst) — gewartet wird deshalb auf
    // den RUF, nicht auf den Laufzustand: der wäre schon vorbei, bevor man ihn sehen kann.
    await warteAufRuf(vorher + 1);
    expect(rufe() - vorher, "das zweite Enter löste nicht genau einen weiteren Prüflauf aus").toBe(
      1,
    );
    await seiteRoh().waitForFunction(fn(WARTE_FREI), [KASTEN], { timeout: 15_000 });
    expect(
      (await zustand()).text,
      "nach dem zweiten Lauf steht der Befund nicht mehr da",
    ).toContain(URSACHE);
    // eslint-disable-next-line no-console -- der Beleg der Rückgabe
    console.log(`JOB 3420 · Tastaturweg nach dem Lauf: ${schritte} Tab-Anschläge, ein Ruf`);
  }, 120_000);
});
