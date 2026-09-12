// ================================================================================================
// JOB 3637 R2 · BEN-KORREKTURPFLICHT 2 — DER LÖSCHWEG IM ECHTEN BROWSER, AN ECHTEN WEGWERFOBJEKTEN.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Runde 1 hat die Kernzusage des Auftrags („die Rückfrage erscheint im
// Blick, ohne Scrollen") NICHT im Browser gemessen, sondern über die STRUKTUR belegt: die Rückfrage
// hängt in einer `fixed inset-0`-Ebene. Das ist ein Indiz, kein Beweis — jsdom rechnet kein Layout,
// und ob ein Kasten wirklich im Sichtfenster liegt, entscheidet der Browser. BEN hat das als
// Korrekturpflicht 2 festgehalten: „langes Wegwerfobjekt, Bestätigen, Abbrechen, Fehler und zwei
// Löschungen hintereinander auf beiden Einstiegswegen; tatsächlichen Listenbestand prüfen."
//
// HIER LÄUFT DESHALB DIE GEBAUTE ANWENDUNG (`apps/web/dist`) in echtem Chromium gegen das ECHTE
// Fastify-Backend (`h4-harness`, dieselbe Vorrichtung wie die Zielbild-Messungen). Nichts ist
// nachgebaut: die Liste kommt aus `GET /api/library/search`, das Löschen aus `DELETE /api/kos/:id`,
// und ob ein Objekt weg ist, sagt der Server — nicht ein Mock.
//
// DIE OBJEKTE SIND EIGENE WEGWERFDATEN. `h4Stand` baut je Lauf einen frischen Bestand in einer
// eigenen Instanz; die zwei langen Objekte legt der `vorbereiten`-Haken zusätzlich an. Pedis echter
// Bestand wird von dieser Datei nie berührt — sie kennt weder seine Kennungen noch seinen Server.
//
// EINE Browserinstanz für alle Fälle (Regel der Vorrichtung): mehr Instanzen kippen im Gesamttor
// fremde Browsertests.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import i18n from "../../apps/web/src/i18n";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

/**
 * JOB 3777: die erwarteten Sätze kommen aus DEM Katalog, den die gebaute Seite selbst benutzt —
 * nicht aus einer hier abgeschriebenen Zeichenkette. Sonst wäre eine Umformulierung im Katalog ein
 * stiller Testfehlschlag statt einer bewussten Entscheidung. `getFixedT` statt `changeLanguage`:
 * die Sprache wird gelesen, nicht umgestellt (die Seite läuft auf „de", s. `i18n.ts:16348`).
 */
const de = i18n.getFixedT("de");

/**
 * Sechzig Abschnitte — das „lange Objekt" aus Pedis Fall. Genau daran hängt die Messung: bei einem
 * kurzen Eintrag stünde die alte Inline-Rückfrage zufällig auch im Bild, und der Fall wäre grün,
 * ohne etwas zu zeigen.
 */
const LANGER_TEXT = Array.from(
  { length: 60 },
  (_, i) => `<h2>Abschnitt ${i + 1}</h2><p>Zahlungsziel im Abschnitt ${i + 1}.</p>`,
).join("");

const TITEL_A = "Wegwerf A · Standard-Zahlungsziel";
const TITEL_B = "Wegwerf B · Standard-Skontofrist";

let stand: H4Stand | null = null;
let fehler: string | null = null;
let idA = "";
let idB = "";

/** Die Anmeldedaten der Vorrichtung — `h4Stand` legt den Benutzer mit genau diesem Passwort an. */
const EMAIL = "pedi@job3637.test";
const PASSWORT = "geheim12345";

/**
 * Ein Sitzungsschlüssel über den ECHTEN Anmeldeweg. Gebraucht wird er genau einmal: um den
 * Fehlerfall in B3 herzustellen, ohne einen Sonderpfad am Server aufzumachen.
 */
async function token(): Promise<string> {
  const antwort = await stand?.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: EMAIL, password: PASSWORT },
  });
  return (antwort?.json() as { token: string }).token;
}

const seite = (): H4Stand["seite"] => {
  if (!stand) {
    throw new Error("Browser nicht bereit");
  }
  return stand.seite;
};

/**
 * Die Lage der Rückfrage IM SICHTFENSTER — das, was jsdom nicht kann. Gemessen wird der Kasten
 * der Rückfrage gegen `innerHeight`/`innerWidth` und, als Gegenstück zu Pedis Befund, wie weit die
 * Seite gescrollt ist (sie soll NICHT gescrollt sein müssen).
 */
const LAGE_FN = `() => {
  const el = document.querySelector('[data-testid="bib-loeschen-rueckfrage"]');
  if (!el) { return { da: false }; }
  const r = el.getBoundingClientRect();
  const menue = document.querySelector('[data-testid="bib-eintrag-menue"]');
  const mr = menue ? menue.getBoundingClientRect() : null;
  return {
    da: true,
    oben: Math.round(r.top),
    unten: Math.round(r.bottom),
    links: Math.round(r.left),
    rechts: Math.round(r.right),
    hoehe: Math.round(r.height),
    fensterHoehe: window.innerHeight,
    fensterBreite: window.innerWidth,
    scrollY: Math.round(window.scrollY),
    // Liegt der Kasten in seiner Mitte wirklich obenauf? Nur dann ist er zu treffen.
    obenauf: (() => {
      const m = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return m !== null && (el === m || el.contains(m) || m.contains(el));
    })(),
    // Der Auslöser sitzt am Kopf — sein Abstand zeigt, wie weit die Rückfrage vorher weg war.
    menueOben: mr ? Math.round(mr.top) : null,
    gesperrt: el.getAttribute('aria-busy'),
    fehlertext: (() => {
      const f = document.querySelector('[data-testid="bib-loeschen-fehler"]');
      return f ? (f.textContent || '').trim() : null;
    })(),
  };
}`;

/** Die Titel, die die Bibliotheksliste GERADE zeigt — der tatsächliche Bestand, nicht ein Mock. */
const LISTE_FN = `() => [...document.querySelectorAll('[data-testid="bib-zeile"]')]
  .map((z) => (z.textContent || '').trim())`;

/**
 * JOB 3777 · was nach dem Bestätigen auf der Fläche STEHT — in einem Zug gemessen, damit die vier
 * Aussagen aus demselben Augenblick stammen. `LAGE_FN` kann das nicht: verschwindet die Rückfrage,
 * gibt es dort nur noch `{ da: false }`, und ob daneben ein Fehlerkasten oder eine Meldung steht,
 * wäre ungemessen. Die Meldungen liegen in den `<output>`-Kästen des Toast-Bereichs
 * (`shell/ToastViewport.tsx:22-26`).
 */
const NACH_BESTAETIGEN_FN = `() => ({
  rueckfrageDa: document.querySelector('[data-testid="bib-loeschen-rueckfrage"]') !== null,
  fehlertext: (() => {
    const f = document.querySelector('[data-testid="bib-loeschen-fehler"]');
    return f ? (f.textContent || '').trim() : null;
  })(),
  meldungen: [...document.querySelectorAll('output')].map((o) => (o.textContent || '').trim()),
  adresse: location.pathname + location.search,
})`;

interface NachBestaetigen {
  rueckfrageDa: boolean;
  fehlertext: string | null;
  meldungen: string[];
  adresse: string;
}

const OFFENER_BERICHT_FN = `() => {
  const t = document.querySelector('[data-testid="bib-titel"]');
  return { titel: t ? (t.textContent || '').trim() : null, pfad: location.pathname + location.search };
}`;

async function warteAuf(quelle: string, was: string, arg?: unknown): Promise<void> {
  await seite()
    .waitForFunction(fn(quelle), arg, { timeout: 30_000 })
    .catch((e: unknown) => {
      throw new Error(`${was}: ${String(e).split("\n")[0]}`);
    });
}

/** Seite frisch öffnen und warten, bis der Bericht wirklich steht. */
async function oeffnen(pfad: string): Promise<void> {
  await seite().goto(`${ORIGIN}${pfad}`, { waitUntil: "domcontentloaded" });
  await warteAuf(
    `() => document.querySelector('[data-testid="bib-titel"]') !== null`,
    `Bericht auf ${pfad} kam nicht`,
  );
  await seite().waitForTimeout(250);
}

/** Menü „…" öffnen und „Wissensobjekt löschen" wählen — Pedis zwei Klicks, echt geklickt. */
async function loeschenWaehlen(): Promise<void> {
  await seite().evaluate<void>(
    fn(`() => { document.querySelector('[data-testid="bib-eintrag-menue"]').click(); }`),
  );
  await warteAuf(
    `() => document.querySelector('[data-testid="bib-menue-loeschen"]') !== null`,
    "Menüpunkt Löschen kam nicht",
  );
  await seite().evaluate<void>(
    fn(`() => { document.querySelector('[data-testid="bib-menue-loeschen"]').click(); }`),
  );
  await seite().waitForTimeout(250);
}

/** Einen Knopf der Rückfrage über seinen Text drücken — echt geklickt, nicht abgeschickt. */
async function knopfDruecken(text: string): Promise<void> {
  await seite().evaluate<void>(
    fn(`(wort) => {
      const knopf = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === wort);
      if (!knopf) { throw new Error('Knopf fehlt: ' + wort); }
      knopf.click();
    }`),
    text,
  );
  await seite().waitForTimeout(400);
}

interface Lage {
  da: boolean;
  oben?: number;
  unten?: number;
  links?: number;
  rechts?: number;
  hoehe?: number;
  fensterHoehe?: number;
  fensterBreite?: number;
  scrollY?: number;
  obenauf?: boolean;
  menueOben?: number | null;
  gesperrt?: string | null;
  fehlertext?: string | null;
}

const lage = (): Promise<Lage> => seite().evaluate<Lage>(fn(LAGE_FN));
const liste = (): Promise<string[]> => seite().evaluate<string[]>(fn(LISTE_FN));

// ==================================================================================================
// JOB 3777 · DIE LÜCKE DER VORRICHTUNG, DIE DIESER FALL AUFGEDECKT HAT — UND WARUM SIE HIER STEHT.
// ==================================================================================================
//
// GEMESSEN, nicht vermutet (Sonde in dieser Runde, auf der laufenden Seite):
//     {"uuid":"undefined","sicher":false,"ursprung":"http://klarwerk.test","outputs":0}
// `window.isSecureContext` ist FALSCH, und `crypto.randomUUID` gibt es in Chromium nur im sicheren
// Kontext. Die Vorrichtung bedient die gebaute Seite unter `http://klarwerk.test` (`h4-harness.ts:32`)
// — also unter einem Ursprung, der weder `https` noch `localhost` ist.
//
// DIE FOLGE: JEDE Meldung der App stirbt dort. `ToastProvider.push` holt sich als Erstes eine
// Kennung über `crypto.randomUUID()` (`apps/web/src/app/ToastContext.tsx:36`); der Aufruf wirft
// „TypeError: crypto.randomUUID is not a function", und der Rest des Zweigs läuft nicht mehr.
// Kein Toast erschien je in dieser Vorrichtung — auch der Erfolgsweg von B4 hat nie einen gezeigt.
// Dass B4 trotzdem grün war, lag an der Reihenfolge: die Ausnahme erreicht `seitenfehler` erst
// NACH der Zusicherung. Ein Wächter, der so knapp danebenliegt, ist keiner.
//
// WARUM EIN ERSATZ UND KEIN AUSKLAMMERN: die Lücke gehört der VORRICHTUNG, nicht dem Produkt. Im
// echten Betrieb läuft Klarwerk über `https` (Coolify) und in der Entwicklung über `localhost` —
// beides sichere Kontexte, beide haben `crypto.randomUUID`. Ein Fall, der die Meldung deshalb
// ungemessen liesse, verschöbe eine Zusicherung des Auftrags auf niemanden.
//
// DER ERSATZ IST KEIN PLATZHALTER: er baut die Kennung aus `crypto.getRandomValues` (das es auch
// im unsicheren Kontext gibt) und liefert eine echte UUID der Fassung 4 — dasselbe Format, das die
// Norm zusagt. Die Fläche bekommt also keine Sonderbehandlung, nur den Browserdienst, den ihr der
// Ursprung dieser Vorrichtung vorenthält.
//
// GRENZE, ausdrücklich benannt: dieselbe Lücke trifft jeden anderen Browserfall über
// `tests/design/h4-harness.ts`, der eine Meldung messen will. Dort gehört der Ersatz eigentlich hin
// — die Datei steht nicht in den Zielpfaden dieser Runde. In der Rückgabe benannt, nicht behoben.
const UUID_ERSATZ_FN = `() => {
  if (typeof crypto.randomUUID === "function") { return; }
  crypto.randomUUID = () => {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
    return [
      h.slice(0, 4).join(""), h.slice(4, 6).join(""), h.slice(6, 8).join(""),
      h.slice(8, 10).join(""), h.slice(10, 16).join(""),
    ].join("-");
  };
}`;

describe("JOB 3637 R2 · Löschen im echten Browser (gebaute Seite, echtes Backend)", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/bibliothek", EMAIL, async ({ services, autorId }) => {
        const a = (await services.ko.create({
          title: TITEL_A,
          statement: "Rechnungen sind binnen 30 Tagen fällig.",
          bodyHtml: LANGER_TEXT,
          type: "best_practice",
          category: "Kaufmännisch",
          author: autorId,
        } as never)) as { id: string };
        const b = (await services.ko.create({
          title: TITEL_B,
          statement: "Skonto gilt binnen 10 Tagen.",
          bodyHtml: LANGER_TEXT,
          type: "best_practice",
          category: "Kaufmännisch",
          author: autorId,
        } as never)) as { id: string };
        idA = a.id;
        idB = b.id;
      });
      // Zweimal, und beide Male sind nötig: `evaluate` versorgt das SCHON GELADENE Dokument, in dem
      // B1–B3 arbeiten; `addInitScript` jedes spätere (B4 lädt über `oeffnen` neu).
      await stand.seite.evaluate(fn(UUID_ERSATZ_FN));
      await stand.seite.addInitScript(`(${UUID_ERSATZ_FN})();`);
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("B1 · am LANGEN Objekt steht die Rückfrage im Sichtfenster — ohne dass jemand scrollt", async () => {
    expect(fehler).toBeNull();
    await oeffnen(`/bibliothek?eintrag=${idA}`);

    // Der Ausgangspunkt: die Seite ist NICHT gescrollt, und der Eintrag ist wirklich der lange.
    const vorher = await seite().evaluate<{
      scrollY: number;
      titel: string | null;
      menueOben: number | null;
    }>(
      fn(`() => {
        const m = document.querySelector('[data-testid="bib-eintrag-menue"]');
        return {
          scrollY: Math.round(window.scrollY),
          titel: (document.querySelector('[data-testid="bib-titel"]') || {}).textContent || null,
          menueOben: m ? Math.round(m.getBoundingClientRect().top) : null,
        };
      }`),
    );
    expect(vorher.scrollY).toBe(0);
    expect(vorher.titel).toContain("Wegwerf A");
    // Der Auslöser steht am Kopf des Berichts, also im Bild.
    expect(vorher.menueOben ?? -1).toBeGreaterThan(0);

    await loeschenWaehlen();
    const l = await lage();

    expect(l.da, "die Rückfrage ist im Browser gar nicht entstanden").toBe(true);
    // DIE EIGENTLICHE MESSUNG, die jsdom nicht leisten kann: der Kasten liegt vollständig im
    // Sichtfenster. Genau das hiess „im Blick, ohne Scrollen" — und genau das war vorher falsch.
    expect(l.oben ?? -1).toBeGreaterThanOrEqual(0);
    expect(l.unten ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(l.fensterHoehe ?? 0);
    expect(l.links ?? -1).toBeGreaterThanOrEqual(0);
    expect(l.rechts ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(l.fensterBreite ?? 0);
    // Niemand hat gescrollt: die Rückfrage kam von selbst ins Bild.
    expect(l.scrollY).toBe(0);
    // Und sie ist auch wirklich zu treffen, liegt also nicht unter etwas anderem.
    expect(l.obenauf).toBe(true);
    // Fail-closed: ein Kasten ohne Höhe wäre „im Sichtfenster" und trotzdem unsichtbar.
    expect(l.hoehe ?? 0).toBeGreaterThan(10);

    // ==========================================================================================
    // UND DIE EIGENTLICH UNTERSCHEIDENDE ZUSICHERUNG: DIE SEITE IST NICHT GESPRUNGEN.
    // ==========================================================================================
    //
    // Gemessen (Sonde in dieser Runde, mit der Rückfrage im Textfluss statt in der Overlay-Ebene):
    // der Kasten lag mit `oben: 566` TROTZDEM im Sichtfenster — weil `Modal` beim Öffnen den Fokus
    // in die Fläche setzt (`Modal.tsx:94`) und Chromium sie daraufhin ins Bild scrollt. Die blosse
    // Frage „liegt der Kasten im Sichtfenster?" unterscheidet die reparierte Lage also NICHT von
    // der kaputten; sie war als alleiniger Beleg zu schwach, und das steht hier, statt still
    // ausgebessert zu werden.
    //
    // Der Unterschied, den Pedi merkt, ist ein anderer: kommt die RÜCKFRAGE zu ihm, oder wird SEIN
    // BERICHT weggerissen? Im Textfluss sprang der Kopf des Berichts auf `-102` — aus dem Bild
    // heraus. In der Overlay-Ebene bleibt er, wo er war: die Fläche legt sich darüber, die Seite
    // dahinter rührt sich nicht.
    expect(
      l.menueOben,
      "die Seite ist beim Öffnen der Rückfrage gesprungen — der Bericht wurde unter dem Leser weggezogen",
    ).toBe(vorher.menueOben);
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  }, 90_000);

  it("B2 · Abbrechen lässt alles stehen — der Eintrag bleibt in der echten Liste", async () => {
    expect(fehler).toBeNull();
    const vorher = await liste();
    expect(vorher.some((z) => z.includes("Wegwerf A"))).toBe(true);

    await knopfDruecken("Behalten");
    expect((await lage()).da, "die Rückfrage steht nach Abbrechen noch da").toBe(false);

    const nachher = await liste();
    expect(nachher).toEqual(vorher);
    const bericht = await seite().evaluate<{ titel: string | null; pfad: string }>(
      fn(OFFENER_BERICHT_FN),
    );
    expect(bericht.titel).toContain("Wegwerf A");
  }, 90_000);

  // ==============================================================================================
  // JOB 3777 · B3 IST UMGEZOGEN, NICHT VERDOPPELT — der 404 ist kein Fehlschlag.
  // ==============================================================================================
  //
  // BIS HIERHER hat dieser Fall die Gegenwahrheit GEPINNT: `l.da === true` („die Rückfrage
  // verschwindet, obwohl nichts gelöscht wurde") und `l.fehlertext === "Wissensobjekt nicht
  // gefunden."`. Der Herstellungsweg war schon damals richtig und bleibt Zeichen für Zeichen
  // stehen — nur die ERWARTUNG war falsch: wer ein Objekt löscht, das schon weg ist, hat sein
  // Ziel erreicht und darf nicht in einem Dialog sitzenbleiben, den er selbst wegklicken muss.
  // Die Prüfliste sagt das in derselben Lage schon lange (`pages/Validation.tsx:296`); die
  // Bibliothek zieht hier nach, im echten Browser gegen den echten Server.
  it("B3 · war das Objekt schon weg, schliesst die Rückfrage und die Liste ist frisch", async () => {
    expect(fehler).toBeNull();
    await loeschenWaehlen();
    expect((await lage()).da).toBe(true);

    // Ein ECHTER 404, nicht einer aus einem Mock: das Objekt verschwindet zwischen dem Öffnen der
    // Rückfrage und dem Bestätigen (derselbe Weg, den auch die Oberfläche geht — genau Pedis
    // „jemand anderes war schneller"). Der nächste DELETE läuft damit in das Sichtbarkeitstor
    // `sichtbaresKoOder404` (`services/app/src/routes/ko-routes.ts:1707`) und antwortet mit 404.
    const weg = await stand?.app.inject({
      method: "DELETE",
      url: `/api/kos/${idA}`,
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(
      weg?.statusCode,
      `Vorbereitung des 404-Falls misslang: ${weg?.body?.slice(0, 120)}`,
    ).toBeLessThan(400);

    await knopfDruecken("Ja, löschen");
    const nach = await seite().evaluate<NachBestaetigen>(fn(NACH_BESTAETIGEN_FN));

    // 1. DIE RÜCKFRAGE IST WEG — kein Dialog, den der Nutzer selbst wegklicken muss.
    expect(nach.rueckfrageDa, "die Rückfrage steht noch da, obwohl das Objekt weg ist").toBe(false);
    // 2. UND KEIN ROTER SATZ. Vorher stand hier „Wissensobjekt nicht gefunden.".
    expect(nach.fehlertext, "der rote Satz steht da, obwohl nichts schiefging").toBeNull();
    // 3. GELESEN WIRD DER SATZ AUS DEM KATALOG — er behauptet nicht „gelöscht" (das hat DIESER
    //    Aufruf nicht getan), sondern dass es schon weg war und die Liste neu geholt wurde.
    expect(nach.meldungen.some((m) => m.includes(de("ko.deleteAlreadyGone")))).toBe(true);
    expect(
      nach.meldungen.some((m) => m.includes(de("ko.deleteDone"))),
      "die Fläche behauptet, SIE habe gelöscht",
    ).toBe(false);
    // 4. DIE ADRESSE ZEIGT NICHT MEHR AUF DIE TOTE KENNUNG (`BibliothekFlaeche.tsx:1889`).
    expect(nach.adresse).not.toContain(idA);

    // 5. UND DIE LISTE IST WIRKLICH FRISCH — der zweite Halbsatz der Meldung („Liste
    //    aktualisiert.") ist nur zulässig, weil `invalidate()` im selben Zweig läuft. Gemessen am
    //    tatsächlichen Bestand der Liste, nicht am Cache.
    await warteAuf(
      `() => ![...document.querySelectorAll('[data-testid="bib-zeile"]')].some((z) => (z.textContent || '').includes('Wegwerf A'))`,
      "Wegwerf A steht nach dem 404 weiter in der Liste — der Halbsatz über die aufgefrischte Liste wäre falsch",
    );
    expect((await liste()).some((z) => z.includes("Wegwerf A"))).toBe(false);
  }, 90_000);

  it("B4 · zwei Löschungen hintereinander tragen beide — echte Liste, echter Server", async () => {
    expect(fehler).toBeNull();
    await oeffnen(`/bibliothek?eintrag=${idB}`);
    const vorher = await liste();
    expect(vorher.some((z) => z.includes("Wegwerf B"))).toBe(true);

    await loeschenWaehlen();
    await knopfDruecken("Ja, löschen");
    await warteAuf(
      `() => ![...document.querySelectorAll('[data-testid="bib-zeile"]')].some((z) => (z.textContent || '').includes('Wegwerf B'))`,
      "Wegwerf B verschwand nicht aus der Liste",
    );

    // DAS ZWEITE LÖSCHEN, direkt danach, ohne Neuladen — Pedis Nachtrag von 15:15.
    const zwischen = await liste();
    expect(zwischen.some((z) => z.includes("Wegwerf B"))).toBe(false);
    const naechster = await seite().evaluate<{ titel: string | null; pfad: string }>(
      fn(OFFENER_BERICHT_FN),
    );
    expect(naechster.titel, "nach dem Löschen steht kein Bericht mehr da").not.toBeNull();

    await loeschenWaehlen();
    const l = await lage();
    expect(l.da, "beim ZWEITEN Löschen kommt die Rückfrage nicht").toBe(true);
    // Der Verdacht aus dem Nachtrag, im Browser geprüft: der Bestätigungsknopf ist NICHT gesperrt.
    expect(l.gesperrt === "true").toBe(false);
    const titelVorher = naechster.titel ?? "";
    await knopfDruecken("Ja, löschen");
    await warteAuf(
      `(t) => ![...document.querySelectorAll('[data-testid="bib-zeile"]')].some((z) => (z.textContent || '').includes(t))`,
      "der zweite Eintrag verschwand nicht aus der Liste",
      titelVorher,
    );
    const danach = await liste();
    expect(danach.some((z) => z.includes(titelVorher.slice(0, 12)))).toBe(false);
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  }, 120_000);
});
