// ================================================================================================
// JOB 3571 · CHR-NAVIGATION-SCHMAL REST — DIE 760-px-KANTE WIRD MIT AKTIVER FIRMEN-CI GEMESSEN.
// ================================================================================================
//
// DER BENANNTE REST AUS JOB 3525. Jener Job hat die schmale Kopfbandzeile in Chromium gemessen und
// dabei EINE Grenze eingestanden: gemessen wurde OHNE Firmen-CI. Ist sie an, tritt neben die
// Wortmarke das Firmenlogo (`shell/Logo.tsx`), und die Zeile wird breiter. Die untere Kante des
// Punkte-Bands (760 px, `shell/Kopfband.tsx`) war mit einer ÜBERSCHLAGENEN Reserve dafür gewählt —
// „rund 45 px", eine Rechnung, kein Beleg. Genau diese Rechnung prüft diese Datei nach.
//
// WAS DER MENSCH DAVON HAT: Wer KLARWERK mit eingeschaltetem Demo-Erscheinungsbild in einem
// schmalen Fenster benutzt, findet „Meine Entwürfe" und „Gehe zu …" genauso vollständig wie ohne.
// Der Handgriff, der das zeigt: Admin → Vorführdaten → Demo-Erscheinungsbild einschalten, Fenster
// auf 760 px ziehen. Bis heute fuhr kein Test der Maschine diesen Handgriff.
//
// WIE DIE CI HIER EINGESCHALTET WIRD — über den ECHTEN Weg, nicht über eine Attrappe:
// `PUT /api/admin/branding` an der echten Fastify-App, mit dem Adminrecht der Bühne
// (`users.manage`). Kein Route-Mock, kein vorgetäuschter Speicher, kein direkter Aufruf von
// `uebernimmBranding` in der Seite. Die Marke kommt damit denselben Weg wie beim Kunden: Server →
// `GET /api/branding` → `lib/brandTheme.ts` → `shell/Logo.tsx`.
//
// WARUM DAS IN CHROMIUM STEHEN MUSS und nicht in jsdom: die einzige heutige Prüfung des Logos im
// Kopfband ist `tests/demo-firmen-ci-web/logo-im-kopfband-mounted.test.tsx`, und die läuft in jsdom.
// jsdom hat keine Layout-Maschine — jede Pixelzahl daraus wäre erfunden. Die Frage dieses Jobs ist
// aber ausschliesslich eine Frage der Breite.
//
// DIE VORAUSSETZUNG WIRD SELBST GEMESSEN (Fall CI0). Ein Lauf, der „mit CI" behauptet, während die
// CI still aus blieb, misst nichts und wäre grün — der gefährlichste Zustand. Deshalb: das Logo
// muss GEZEICHNET sein (`offsetParent !== null`, Breite > 0, Bild wirklich geladen), und die
// Wortmarke muss dadurch MESSBAR breiter sein als ohne CI. Der Vergleichswert wird im selben Lauf
// am selben Stand gewonnen (CI aus → messen → CI an → messen), nicht aus der Nachbardatei geraten
// und nicht als Zahl gepinnt. Und jede weitere Messung dieser Datei wartet vor dem Messen auf
// dasselbe gezeichnete Logo: fiele die CI zwischendurch aus, bräche der Lauf ab, statt still eine
// Zeile ohne Logo zu vermessen.
//
// DAS MESSWERKZEUG IST DASSELBE wie in `kopfband-schmal-chromium.test.ts` — es wohnt seit diesem
// Job in `kopfband-messung.ts` und wird von beiden importiert. Eine zweite Kopie hiesse zwei
// Wahrheiten über dieselbe Zeile.
//
// EHRLICHE GRENZEN, ausdrücklich benannt:
//   · Gemessen wird DEUTSCH — der längste und damit bindende Fall („Meine Entwürfe" ist länger als
//     „My drafts"). Englisch und Niederländisch MIT Firmen-CI sind hier nicht gemessen.
//   · Gemessen wird das heute EINZIGE Firmenprofil (`advisor`). Ein zweites gibt es nicht; käme
//     eines dazu, ist seine Logobreite eine neue, ungemessene Grösse.
//   · Bei 900 px — der schmalsten Breite der BREITEN Bauform — wird gemessen und ausgegeben, aber
//     die Breite NICHT zugesichert. Begründung wörtlich dieselbe wie in der Schwesterdatei: das ist
//     der Bestand von JOB 3060, und eine Zusicherung darüber wäre eine fremde Aussage.
//   · Bei 390 px wird die Breite ebenfalls nicht zugesichert — dort liegt ein GEMESSENER BEFUND
//     (CI5): mit Firmen-CI ragt der Konto-Kreis rund 20 px rechts aus dem Fenster. Seine Ursache
//     (die Breite des Logokastens) wohnt in `shell/Logo.tsx`, ausserhalb der Zielpfade von JOB 3571.
//     Dieser Job misst und pinnt ihn; beheben muss ihn ein Auftrag, der jene Datei tragen darf.
//   · Eine Instanz je Datei (Kopf von `tests/design/h6-chromium.ts`); die Breiten werden an
//     DERSELBEN Seite durchgefahren.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Stand, fn, starte } from "../design/h6-chromium";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";
import { type Messung, STRENG_ALLES, freierRaum, messe, pruefeZeile } from "./kopfband-messung";

type Buehne = NonNullable<Stand["app"]>;

const HOEHE = 800;
/** Die Startbreite ist die engste des Punkte-Bands — dort entscheidet sich die Schwelle. */
const START_BREITE = 760;
/** Die Kennung, unter der die gemessenen Zahlen im Lauf stehen. */
const KENNUNG = "JOB 3571";

// ================================================================================================
// DIE BREITEN — DIESELBE LISTE WIE DIE SCHWESTERDATEI, UND DIE ZWEI, DIE ANDERS BEHANDELT WERDEN.
// ================================================================================================
//
// Gemessen wird an ALLEN Breiten der Schwesterdatei. Eine kürzere Liste (nur 760) liesse offen, ob
// das Logo bei 390 px den Menü-Knopf verdrängt — es tut es nicht, und das ist gemessen, nicht
// angenommen.
//
// ZUGESICHERT werden die fünf Breiten, an denen die Zeile mit Logo restlos trägt — darunter das
// ganze Punkte-Band 760–899 px, um das es diesem und dem Vorgängerjob geht.
//
// ZWEI BREITEN BEKOMMEN EINE SCHWÄCHERE ZUSAGE, und das ist ein BEFUND, kein Achselzucken. Beide
// werden in CI5 ausgemessen; die Zahlen stehen dort und im Lauf:
//
//   · 390 px — mit Firmen-CI reicht die Zeile über das Fenster hinaus: der Konto-Kreis steht rund
//     20 px rechts DRAUSSEN (gemessen: rechter Rand 410,5 px bei 390 px Fensterbreite). Was hält:
//     56 px Höhe, kein Umbruch, keine Überlappung.
//   · 900 px — dieselbe Klasse in der BREITEN Bauform: rund 110 px zu breit (rechter Rand 1009,5 px
//     bei 900 px). Das ist der Bestand von JOB 3060, wortgleich wie in der Schwesterdatei behandelt.
//
// WARUM DIESER JOB DAS MISST UND NICHT REPARIERT: Ursache ist die Breite des Logokastens selbst
// (gemessen 100,3 px statt der überschlagenen „rund 45 px"). Er wohnt in `shell/Logo.tsx`, und §4
// dieses Auftrags lässt diese Datei ausdrücklich DRAUSSEN; die 900-px-Frage schliesst §10 ebenso
// ausdrücklich aus. Also: gemessen, benannt und gepinnt — nicht stillschweigend zugesichert und
// nicht mit einem Handgriff in einem fremden Zielpfad überdeckt.
const ZUGESICHERT = [600, 760, 768, 899, 1280] as const;
/** Gemessen und ausgegeben, aber nicht zugesichert — je mit eigenem, benanntem Grund. */
const NUR_GEMESSEN: readonly { breite: number; grund: string }[] = [
  {
    breite: 390,
    grund:
      "das Firmenlogo ist breiter als der Überschlag (Befund CI5); `shell/Logo.tsx` liegt ausserhalb der Zielpfade von JOB 3571",
  },
  { breite: 900, grund: "breite Bauform, JOB 3060" },
];

/**
 * Was auch an den zwei ungesicherten Breiten zugesichert BLEIBT.
 *
 * Die schwächere Aussage steht genau an der Achse, an der sie hingehört — nicht an allen. Höhe und
 * Umbruch prüft `pruefeZeile` ohnehin immer; die Überlappung wird hier ausdrücklich weiter
 * zugesichert: dass die Zeile zu breit ist, heisst nicht, dass ihre Elemente einander schneiden,
 * und das ist ein Unterschied, den ein Mensch sofort sieht.
 */
const TROTZ_BEFUND = { ueberlauf: false, fenster: false, ueberlappung: true } as const;
/** Alle gemessenen Breiten, in der Reihenfolge der Schwesterdatei. */
const ALLE = [390, 600, 760, 768, 899, 900, 1280] as const;
/** Der Spaltenabstand der schmalen Zeile (`shell/Kopfband.tsx`, `columnGap`). */
const SCHMALE_FUGE = 20;

/**
 * Die Anmeldedaten der Bühne.
 *
 * Sie stehen hier ein zweites Mal, und das ist bewusst: `starte()` registriert und meldet dieses
 * ERSTE Konto selbst an (`tests/design/h6-chromium.ts`, Ersteinrichtung → Admin) und reicht seinen
 * Bearer nicht heraus. Der Rückruf `vorbereiten` bekommt nur die App. Da diese Datei den echten
 * Adminweg drücken MUSS (`users.manage`), meldet sie sich ein zweites Mal an demselben Konto an.
 * Ginge das Konto der Bühne je verloren, wäre der Fall hier sofort rot (HTTP 401), nicht still grün.
 */
const BUEHNEN_KONTO = { email: "pedi@job3065.test", password: "geheim12345" } as const;

let stand: Stand;
let bearer = "";
/**
 * Der in CI0 GEMESSENE Zuwachs der Wortmarke durch das Firmenlogo.
 *
 * Er steht bewusst nicht als Zahl im Quelltext: CI5 rechnet mit ihm weiter, und eine gepinnte Zahl
 * wäre genau wieder der Überschlag, den dieser Job ablöst. `0` heisst „CI0 ist nicht gelaufen" —
 * CI5 wird dann rot, statt mit einer Null zu rechnen.
 */
let zuwachs = 0;

/** Der Bearer der Bühne — über die echte Anmelderoute, nicht aus einem gebauten Token. */
async function meldeAn(app: Buehne): Promise<string> {
  const antwort = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: BUEHNEN_KONTO.email, password: BUEHNEN_KONTO.password },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(
      `Anmeldung der Bühne: HTTP ${antwort.statusCode} — ${antwort.body.slice(0, 160)}`,
    );
  }
  return (antwort.json() as { token: string }).token;
}

/**
 * Die Firmen-CI über den ECHTEN Adminweg schalten und die Antwort des Servers zurückgeben.
 *
 * Der Rückgabewert ist nicht Zierde: er ist der Beleg, dass der Server die Schaltung wirklich
 * übernommen hat. Ein `PUT`, der 403 sagt, während der Test weiterläuft, wäre genau die stille
 * Lücke, gegen die CI0 steht.
 */
async function schalteCi(
  app: Buehne,
  an: boolean,
): Promise<{ profil: string | null; aktiv: boolean; version: number }> {
  const antwort = await app.inject({
    method: "PUT",
    url: "/api/admin/branding",
    headers: { authorization: `Bearer ${bearer}` },
    payload: { profil: an ? "advisor" : null, aktiv: an },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(
      `PUT /api/admin/branding (an=${an}): HTTP ${antwort.statusCode} — ${antwort.body.slice(0, 160)}`,
    );
  }
  const gestellt = antwort.json() as { profil: string | null; aktiv: boolean; version: number };
  if (gestellt.aktiv !== an || (an && gestellt.profil !== "advisor")) {
    throw new Error(`der Server hat die Schaltung nicht übernommen: ${JSON.stringify(gestellt)}`);
  }
  return gestellt;
}

/**
 * Die Bereitschaft, auf die JEDE Messung dieser Datei wartet: das Firmenlogo ist gezeichnet UND
 * sein Bild ist wirklich geladen. Ohne das Zweite wäre die Breite des `<img>` (h-5, `w-auto`)
 * schlicht 0 — die Marke sähe schmaler aus, als sie ist, und der Lauf hielte ein Nichts für ein
 * Ergebnis.
 */
const LOGO_STEHT = {
  pruefung: fn(`() => {
    const bild = document.querySelector('[data-testid="kopfband-firmenlogo"] img');
    if (!bild) return false;
    const span = bild.parentElement;
    return span.offsetParent !== null && bild.complete && bild.naturalWidth > 0
      && span.getBoundingClientRect().width > 0;
  }`),
  was: "das Firmenlogo ist gezeichnet und sein Bild geladen",
};

// ================================================================================================
// DIE PFLICHT KOMMT AUS DER ZUGESAGTEN BREITE, NICHT AUS DEM GEMESSENEN BAUM (Runde 2, nach ROT).
// ================================================================================================
//
// IN RUNDE 1 WAR ES ANDERSHERUM, UND DAS WAR DER FEHLER: CI4 fragte den gezeichneten Baum, OB das
// Punkte-Band steht, und sprang zurück, wenn es fehlte. Damit entschied der Istzustand selbst, ob
// die Sollaussage überhaupt geprüft wird. Der Prüfer hat genau das aufgedeckt (BEN, JOB 3571 R1,
// Gegenprobe C): er hat das Band NUR bei aktiver Firmen-CI abgeschaltet — beide zugesagten Wege
// waren fort, und alle 26 Fälle blieben grün. Ein Wächter, den der bewachte Fehler abschalten kann,
// bewacht nichts.
//
// DESHALB WIRD DIE PFLICHT JETZT AUS DER ZUSAGE BESTIMMT. Die Zusage ist `SCHMAL_PUNKTE_QUERY` in
// `shell/Kopfband.tsx`: sie SAGT, für welche Breiten das Band gilt. Ausgewertet wird sie nicht von
// einem selbstgebauten Parser, sondern von der Medienabfrage-Maschine desselben Chromium, der die
// Seite zeichnet (`window.matchMedia`) — dieselbe Maschine, an der im Produkt `useMediaQuery.ts`
// hängt. Damit trägt die Zusage jede Form, die CSS kennt, und sie wandert von selbst mit: verschiebt
// jemand die Kante (Lieferung 6), prüft dieser Fall die neue Lage; schaltet jemand das Band weg,
// ohne die Zusage zu ändern, wird er rot.
//
// GELESEN wird die Zeichenkette aus dem Quelltext statt über einen Import: diese Datei läuft in der
// Node-Umgebung, und ein Import von `Kopfband.tsx` zöge React, i18next und die Markenquelle in einen
// Lauf, der eine einzige Zeichenkette braucht. Fehlt die Konstante, bricht der Lauf hier ab — er
// läuft nicht still mit einer Annahme weiter.
const KOPFBAND_QUELLE = new URL("../../apps/web/src/shell/Kopfband.tsx", import.meta.url);

function liesPunkteQuery(): string {
  const quelle = readFileSync(KOPFBAND_QUELLE, "utf8");
  const treffer = /SCHMAL_PUNKTE_QUERY\s*=\s*"([^"]+)"/.exec(quelle)?.[1];
  if (!treffer) {
    throw new Error(
      "in shell/Kopfband.tsx steht kein `SCHMAL_PUNKTE_QUERY` mehr — die Zusage dieses Laufs hat keine Quelle",
    );
  }
  return treffer;
}

/** Die Zusage des Punkte-Bands, wörtlich aus dem Produkt. */
const PUNKTE_QUERY = liesPunkteQuery();

/** Gilt die Zusage an der STEHENDEN Breite? Chromium beantwortet das mit seiner eigenen Maschine. */
const PASST = fn("(q) => window.matchMedia(q).matches");

async function bandZugesagt(): Promise<boolean> {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return await seite.evaluate<boolean>(PASST, PUNKTE_QUERY);
}

interface TextKasten {
  name: string;
  text: string;
  links: number;
  rechts: number;
  scrollBreite: number;
  clientBreite: number;
}

interface CiBefund {
  logoDa: boolean;
  logoGezeichnet: boolean;
  logoBreite: number;
  bildBreite: number;
  bildGeladen: boolean;
  markeBreite: number;
  fensterBreite: number;
  texte: TextKasten[];
}

/**
 * Was `MESSUNG` (das gemeinsame Werkzeug) nicht beantwortet: steht das Logo wirklich da, und stehen
 * die zwei gesuchten Wege vollständig im Fenster? Das ist kein zweites Messraster — die Lagen der
 * Kästen kommen weiter aus dem gemeinsamen Werkzeug; hier steht nur, was NUR diese Datei fragt.
 */
const CI_BEFUND = fn(`() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return null;
  const logo = band.querySelector('[data-testid="kopfband-firmenlogo"]');
  const bild = logo ? logo.querySelector('img') : null;
  const marke = band.querySelector('.kw-kopfband-marke');
  const texte = [];
  const sel = [
    ['entwuerfe', '[data-kopfband-punkt="entwuerfe"]'],
    ['gehezu', '[data-testid="kopfband-gehezu"]'],
  ];
  for (const [name, s] of sel) {
    const el = band.querySelector(s);
    if (!el || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    texte.push({
      name,
      text: (el.innerText || '').trim(),
      links: r.left,
      rechts: r.right,
      scrollBreite: el.scrollWidth,
      clientBreite: el.clientWidth,
    });
  }
  return {
    logoDa: logo !== null,
    logoGezeichnet: logo !== null && logo.offsetParent !== null,
    logoBreite: logo ? logo.getBoundingClientRect().width : 0,
    bildBreite: bild ? bild.getBoundingClientRect().width : 0,
    bildGeladen: bild ? (bild.complete && bild.naturalWidth > 0) : false,
    markeBreite: marke ? marke.getBoundingClientRect().width : 0,
    fensterBreite: window.innerWidth,
    texte,
  };
}`);

/** Nur den CI-Befund an der STEHENDEN Seite lesen — ohne Neuaufbau, ohne zweite Breitenstellung. */
async function liesCiBefund(): Promise<CiBefund> {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  const b = await seite.evaluate<CiBefund | null>(CI_BEFUND);
  if (b === null) {
    throw new Error("kein Kopfband in der Seite");
  }
  return b;
}

/**
 * Messen MIT eingeschalteter Firmen-CI — und zwar nachweislich: erst wenn das Logo gezeichnet ist,
 * wird gemessen, und danach wird noch einmal nachgesehen, dass es beim Messen wirklich stand.
 */
async function messeMitCi(breite: number): Promise<{ m: Messung; ci: CiBefund }> {
  const m = await messe(stand, breite, HOEHE, LOGO_STEHT);
  const ci = await liesCiBefund();
  expect(
    ci.logoGezeichnet,
    `${breite}px: gemessen wurde OHNE Firmenlogo — der Lauf misst nichts`,
  ).toBe(true);
  expect(ci.bildGeladen, `${breite}px: das Firmenlogo ist ein leeres Bild`).toBe(true);
  expect(ci.logoBreite, `${breite}px: das Firmenlogo ist 0 px breit`).toBeGreaterThan(0);
  return { m, ci };
}

beforeAll(async () => {
  stand = await starte(
    "/start",
    'header[data-testid="kopfband"]',
    START_BREITE,
    HOEHE,
    async (app) => {
      bearer = await meldeAn(app);
      await schalteCi(app, true);
    },
  );
}, 180_000);

afterAll(async () => {
  try {
    await schliesseChromium("tests/navigation-schmal/kopfband-ci-chromium.test.ts", stand?.browser);
  } finally {
    await stand?.app?.close();
  }
}, 60_000);

describe("JOB 3571 · CI0 · die Voraussetzung wird selbst gemessen, nicht geglaubt", () => {
  it("CI0 · das Firmenlogo steht gezeichnet im Kopfband und macht die Wortmarke messbar breiter", async () => {
    expect(stand.fehler, "die Bühne kam nicht hoch").toBeNull();
    const app = stand.app;
    if (!app) {
      throw new Error("keine App an der Bühne");
    }

    // AUS → messen. Der Vergleichswert entsteht am SELBEN Stand, in DIESEM Lauf.
    await schalteCi(app, false);
    const ohne = await messe(stand, START_BREITE, HOEHE);
    const ciOhne = await liesCiBefund();
    expect(ciOhne.logoGezeichnet, "ausgeschaltet steht trotzdem ein Firmenlogo im Kopfband").toBe(
      false,
    );
    const markeOhne = ciOhne.markeBreite;
    expect(markeOhne, "die Wortmarke wurde ohne CI gar nicht gemessen").toBeGreaterThan(0);

    // AN → messen.
    const gestellt = await schalteCi(app, true);
    expect(gestellt.profil, "der Server hat ein anderes Profil gesetzt").toBe("advisor");
    const { m, ci } = await messeMitCi(START_BREITE);

    zuwachs = ci.markeBreite - markeOhne;
    console.log(
      `${KENNUNG} · CI0 · Wortmarke ohne CI ${markeOhne.toFixed(1)} px → mit CI ${ci.markeBreite.toFixed(1)} px ` +
        `(Zuwachs ${zuwachs.toFixed(1)} px; Logokasten ${ci.logoBreite.toFixed(1)} px, ` +
        `Bild ${ci.bildBreite.toFixed(1)} px) · freier Raum bei ${START_BREITE} px: ` +
        `ohne CI ${freierRaum(ohne, SCHMALE_FUGE).toFixed(1)} px → mit CI ${freierRaum(m, SCHMALE_FUGE).toFixed(1)} px`,
    );

    // Die eigentliche Aussage: die CI ist nicht nur „gesetzt", sie WIRKT auf die Breite.
    expect(
      ci.markeBreite,
      `die Wortmarke ist mit CI nicht breiter (ohne ${markeOhne}, mit ${ci.markeBreite})`,
    ).toBeGreaterThan(markeOhne + 1);
    // Und die Zeile selbst steht auch im Vergleichslauf ohne CI — sonst hinge der Vergleich an
    // einer kaputten Seite.
    pruefeZeile(ohne, START_BREITE, STRENG_ALLES, `${KENNUNG} · ohne CI`);
  }, 120_000);
});

describe("JOB 3571 · CI1/CI2 · die Kopfbandzeile trägt auf jeder Breite AUCH mit Firmen-CI", () => {
  for (const breite of ZUGESICHERT) {
    it(`CI1 · ${breite} px mit Firmen-CI: 56 px hoch, kein Umbruch, kein Überlauf, keine Überlappung`, async () => {
      const { m } = await messeMitCi(breite);
      pruefeZeile(m, breite, STRENG_ALLES, KENNUNG);
    }, 90_000);
  }

  for (const { breite, grund } of NUR_GEMESSEN) {
    it(`CI2 · ${breite} px mit Firmen-CI: EINE Zeile ohne Überlappung — Breite gemessen, NICHT zugesichert`, async () => {
      // Was auch hier zugesichert bleibt: 56 px hoch, kein Umbruch, keine Überlappung. Was NICHT
      // zugesichert wird, steht als Grund in der Zahl des Laufs und als Messung in CI5.
      //
      // Bei 900 px ist das wortgleich die Begründung der Schwesterdatei: das ist die schmalste
      // Breite der BREITEN Bauform, ihr Platzbedarf ist der Bestand von JOB 3060, und §10 dieses
      // Auftrags lässt ihn ausdrücklich unberührt. Eine rote Zahl dort ist ein Befund für die
      // Rückgabe, kein Grund, an der breiten Bauform zu drehen.
      const { m } = await messeMitCi(breite);
      pruefeZeile(m, breite, { ...TROTZ_BEFUND, grund }, KENNUNG);
    }, 90_000);
  }
});

describe("JOB 3571 · CI3/CI4 · die zwei gesuchten Wege stehen auch mit Logo vollständig da", () => {
  it("CI3 · 390 px mit Firmen-CI: der Menü-Knopf trägt weiter sein Wort, das Logo verdrängt ihn nicht", async () => {
    // Die Frage, die §8.4 des Auftrags ausdrücklich stellt: verdrängt das Logo bei 390 px den
    // Menü-Knopf? Die gemessene Antwort ist NEIN — der Knopf steht links, beschriftet, an seinem
    // Platz. Hinausgeschoben wird die RECHTE Gruppe (Befund CI5), nicht die linke.
    const { m } = await messeMitCi(390);
    pruefeZeile(m, 390, { ...TROTZ_BEFUND, grund: "Befund CI5" }, KENNUNG);
    expect(m.menueText, "auf 390px zeichnet der Browser am Menü-Knopf kein Wort").toBe("Menü");
    expect(m.punkte, "auf 390px stehen Punkte oben").toEqual([]);
    const menue = m.kaesten.find((k) => k.name === "menue");
    expect(menue, "der Menü-Knopf wurde gar nicht gemessen").toBeDefined();
    expect(
      menue?.links ?? Number.NaN,
      "der Menü-Knopf ist bei 390px nach links aus dem Fenster gerutscht",
    ).toBeGreaterThanOrEqual(-1);
    expect(
      menue?.rechts ?? Number.NaN,
      "der Menü-Knopf steht bei 390px nicht mehr im Fenster",
    ).toBeLessThanOrEqual(m.fensterBreite + 1);
  }, 90_000);

  // ==============================================================================================
  // CI4 — DIE ZUSAGE VON JOB 3525 IN IHRER ENGSTEN LAGE, MIT LOGO.
  // ==============================================================================================
  //
  // Geprüft wird an JEDER schmalen Breite der Liste, für die `SCHMAL_PUNKTE_QUERY` das Band ZUSAGT
  // — nicht an einer fest eingetragenen Zahl und ausdrücklich NICHT daran, ob das Band im gemessenen
  // Baum gerade steht (siehe der Block über `PUNKTE_QUERY`: genau daran ist Runde 1 gescheitert).
  // Das ist der Unterschied zwischen „760 px ist grün" und „die Zusage gilt, wo sie gilt":
  // verschiebt jemand die untere Kante, wandert dieser Fall von selbst mit und misst die neue,
  // engere Lage; verschwinden die Wege innerhalb des zugesagten Bands, wird er rot.
  //
  // 1280 px steht hier NICHT: dort gilt die BREITE Bauform (kein Menü-Knopf, volle Punktreihe), und
  // die ist der Bestand von JOB 3060. Ihre Zeile misst CI1 mit, ihre Zusammensetzung ist nicht die
  // Zusage dieses Jobs.
  for (const breite of ALLE.filter((b) => b < 900)) {
    it(`CI4 · ${breite} px mit Firmen-CI: „Meine Entwürfe“ und „Gehe zu …“ stehen vollständig im Fenster`, async () => {
      const { m, ci } = await messeMitCi(breite);
      // ZUERST DIE ZUSAGE, DANN DER BAUM. Beide Richtungen beissen: ein fehlendes Band an einer
      // zugesagten Breite ebenso wie ein Band an einer Breite, für die es niemand zugesagt hat.
      const zugesagt = await bandZugesagt();
      const bandSteht = m.punkte.includes("entwuerfe");
      expect(
        bandSteht,
        zugesagt
          ? `${breite}px: „${PUNKTE_QUERY}" sagt das Punkte-Band zu — im gezeichneten Kopfband steht es nicht`
          : `${breite}px: „${PUNKTE_QUERY}" sagt hier KEIN Punkte-Band zu — im gezeichneten Kopfband steht trotzdem eines`,
      ).toBe(zugesagt);
      if (!zugesagt) {
        // Ausserhalb des zugesagten Bands führt der beschriftete Menü-Knopf; das ist die Bauform von
        // JOB 3525 und keine Lücke. Der Rücksprung hängt an der ZUSAGE, nicht am Baum — sonst
        // schaltete sich dieser Fall von genau dem Fehler ab, den er finden soll.
        expect(m.menueText, `${breite}px: kein Punkte-Band und kein beschrifteter Menü-Knopf`).toBe(
          "Menü",
        );
        console.log(
          `${KENNUNG} · CI4 · ${breite}px · ausserhalb der Zusage „${PUNKTE_QUERY}" — der Menü-Knopf führt`,
        );
        return;
      }
      const namen = ci.texte.map((t) => t.name);
      expect(namen, `${breite}px: „Meine Entwürfe“ fehlt`).toContain("entwuerfe");
      expect(namen, `${breite}px: „Gehe zu …“ fehlt`).toContain("gehezu");
      for (const t of ci.texte) {
        // GEZEICHNET, nicht nur im Baum: `innerText` ist leer, wenn der Browser nichts malt.
        expect(t.text, `${breite}px: „${t.name}“ ist leer`).not.toBe("");
        expect(
          t.rechts,
          `${breite}px: „${t.name}“ ist rechts angeschnitten (${t.rechts} > ${ci.fensterBreite})`,
        ).toBeLessThanOrEqual(ci.fensterBreite + 1);
        expect(t.links, `${breite}px: „${t.name}“ steht links ausserhalb`).toBeGreaterThanOrEqual(
          -1,
        );
        expect(
          t.scrollBreite,
          `${breite}px: „${t.name}“ ist beschnitten (${t.scrollBreite} > ${t.clientBreite})`,
        ).toBeLessThanOrEqual(t.clientBreite + 1);
      }
      expect(m.entwuerfeText, `${breite}px: der Punkt trägt nicht seinen ganzen Namen`).toBe(
        "Meine Entwürfe",
      );
      expect(m.geheZuText, `${breite}px: „Gehe zu …“ steht nicht im Kopfband`).toContain("Gehe zu");
      expect(m.geheZuText, `${breite}px: das Kürzel fehlt`).toContain("⌘K");
      // Und der Menü-Knopf steht daneben — der Rest der Punkte bleibt erreichbar.
      expect(m.menueText, `${breite}px: der Menü-Knopf fehlt`).toBe("Menü");
    }, 90_000);
  }
});

// ================================================================================================
// CI5 · DER BEFUND — WO DIE ZEILE MIT LOGO NICHT MEHR RESTLOS PASST, UND WARUM GENAU DORT.
// ================================================================================================
//
// DAS IST KEIN FREISPRUCH FÜR EINEN FEHLER, SONDERN SEIN PIN. Zwei Breiten tragen den Zuwachs des
// Logos nicht mehr im vorgesehenen Raum: 390 px (das Logo wächst ins Seitenpolster) und 900 px (die
// breite Bauform, deren Platzbedarf JOB 3060 gehört). Beide sind in CI2 bewusst nicht zugesichert —
// und eine nicht zugesicherte Achse ohne Messung wäre genau die stille Lücke, gegen die dieser
// ganze Auftrag steht. Also wird sie ausgemessen und festgehalten:
//
//   · OHNE CI ist an beiden Breiten KEIN Überschuss und steht jedes Element im Fenster — der Beleg,
//     dass das Logo die Ursache ist und nicht ein alter Layoutfehler, den die CI nur sichtbar macht.
//   · MIT CI ist der Überschuss grösser als 0 und HÖCHSTENS so gross wie der in CI0 gemessene
//     Zuwachs der Wortmarke. Wächst er darüber hinaus, ist etwas ANDERES passiert, und dieser Fall
//     wird rot.
//   · UND ES WIRD BENANNT, WAS DER MENSCH SIEHT: wie weit das rechteste Element (Konto-Kreis) aus
//     dem Fenster ragt. Das ist die Zahl, die zählt — nicht `scrollWidth`.
//
// DIESER FALL WIRD AUCH ROT, WENN JEMAND DEN BEFUND BEHEBT — mit Absicht: dann ist die Aussage
// „mit CI bleibt bei 390/900 px ein Überschuss" nicht mehr wahr, und wer sie behoben hat, führt sie
// hier nach. Dieselbe Bauart wie die übrigen Wächter des Hauses; ein Befund, den niemand nachführen
// muss, verschwindet stillschweigend aus dem Gedächtnis.
//
// CI5 STEHT ZULETZT, weil er als einziger Fall die CI zwischendurch ausschaltet. Er schaltet sie
// am Ende wieder ein.
describe("JOB 3571 · CI5 · der gemessene Befund an den zwei nicht zugesicherten Breiten", () => {
  for (const { breite } of NUR_GEMESSEN) {
    it(`CI5 · ${breite} px: ohne CI kein Überschuss, mit CI genau der Zuwachs des Logos`, async () => {
      const app = stand.app;
      if (!app) {
        throw new Error("keine App an der Bühne");
      }
      expect(zuwachs, "CI0 ist nicht gelaufen — es gibt keinen gemessenen Zuwachs").toBeGreaterThan(
        0,
      );

      await schalteCi(app, false);
      const ohne = await messe(stand, breite, HOEHE);
      const ueberschussOhne = ohne.scrollBreite - ohne.clientBreite;
      const draussenOhne = Math.max(...ohne.kaesten.map((k) => k.rechts)) - ohne.fensterBreite;

      await schalteCi(app, true);
      const { m } = await messeMitCi(breite);
      const ueberschussMit = m.scrollBreite - m.clientBreite;
      const rechtester = Math.max(...m.kaesten.map((k) => k.rechts));
      const draussenMit = rechtester - m.fensterBreite;

      console.log(
        `${KENNUNG} · CI5 · ${breite}px · Überschuss ohne CI ${ueberschussOhne} px → mit CI ${ueberschussMit} px ` +
          `(gemessener Zuwachs der Wortmarke ${zuwachs.toFixed(1)} px) · rechtester Kasten ${rechtester.toFixed(1)} px ` +
          `bei Fensterbreite ${m.fensterBreite} px, also ${draussenMit.toFixed(1)} px ausserhalb`,
      );

      expect(
        ueberschussOhne,
        `${breite}px: schon OHNE Firmen-CI läuft die Zeile über — dann ist das Logo nicht die Ursache`,
      ).toBeLessThanOrEqual(1);
      expect(
        draussenOhne,
        `${breite}px: schon OHNE Firmen-CI steht etwas ausserhalb des Fensters`,
      ).toBeLessThanOrEqual(1);
      expect(
        ueberschussMit,
        `${breite}px: mit Firmen-CI ist KEIN Überschuss mehr messbar — der Befund ist behoben, dieser Pin gehört nachgeführt`,
      ).toBeGreaterThan(1);
      expect(
        draussenMit,
        `${breite}px: mit Firmen-CI steht nichts mehr ausserhalb — der Befund ist behoben, dieser Pin gehört nachgeführt`,
      ).toBeGreaterThan(1);
      expect(
        ueberschussMit,
        `${breite}px: der Überschuss (${ueberschussMit} px) ist grösser als der Zuwachs des Logos (${zuwachs.toFixed(1)} px) — die Ursache ist nicht mehr allein das Logo`,
      ).toBeLessThanOrEqual(zuwachs + 1);
    }, 120_000);
  }
});
