// ================================================================================================
// JOB 3616 · A/R/S · DIE DREI URTEILE DER MESSUNG, MIT GEBAUTEN LAGEN GEGENGEPRÜFT.
// ================================================================================================
//
// WAS HIER BEWACHT WIRD. `logokasten-chromium.test.ts` fällt drei Urteile, an denen jede seiner
// Zahlen hängt:
//
//   · „die Antwort ist da" — der Ankunftsnachweis (`beurteileAnkunft`). Bis Runde 3 genügte ihm ein
//     fertig empfangener Eintrag der Ressourcen-Zeitleiste; eine mit HTTP 503 beantwortete Abfrage
//     erfüllte ihn ebenso wie eine erfolgreiche (BEN, JOB 3616 R2, Korrekturpflicht 1).
//
//   · „die Zeile ist zur Ruhe gekommen" — zwei aufeinanderfolgende Messungen sind gleich
//     (`zeilenUnterschied`). Bis JOB 3616 verglich dieses Urteil NUR Namen und Breiten: eine Zeile,
//     die sich als Ganzes verschob, ohne dass ein Kasten seine Breite änderte, hiess „ruhig" —
//     obwohl genau die Lage (`k.rechts`) die Grösse ist, an der die Datei ihr Urteil fällt.
//   · „das Firmenlogo steht" — bis JOB 3616 hiess das: sein Bild ist geladen und breiter als 0 px
//     (`logokasten-chromium.test.ts:320-323` am Basisstand `e3c590a`). Ein Logo, das 0 px hoch,
//     durchsichtig, unsichtbar geschaltet oder aus dem Fenster geschoben war, galt als vorhanden.
//
// WARUM ALS EIGENE DATEI UND NICHT ALS SATZ IN EINER RÜCKGABE — das ist die Lehre L8 aus JOB 3582
// (`deckelung-waechter.test.ts` W1–W10): eine Gegenprobe, die nur als Behauptung in einer Rückgabe
// steht, ist am Tag ihrer Niederschrift wahr und danach unbewacht. Hier werden dieselben zwei
// Urteile mit GEBAUTEN Lagen gefüttert und rot verlangt — und mit je einer Gegenrichtung grün,
// sonst wäre ein immer-roter Prüfer von einem tragenden nicht zu unterscheiden.
//
// DIESE DATEI FÄHRT KEINEN BROWSER und importiert kein Browserpaket: sie prüft die URTEILE, nicht
// die Messung. Ob der Browser die Lagen so liefert, sagt allein `logokasten-chromium.test.ts` am
// gebauten Produkt — die zwei Hälften teilen sich dieselbe eine Regel (`ruhe-und-sicht.ts`).
import { describe, expect, it } from "vitest";
import {
  type AnkunftBefund,
  type Rechteck,
  type SichtBefund,
  type StilKnoten,
  type ZeilenLage,
  beurteileAnkunft,
  beurteileSicht,
  zeilenUnterschied,
} from "./ruhe-und-sicht";

const KENNUNG = "JOB 3616";

function rechteck(links: number, oben: number, breite: number, hoehe: number): Rechteck {
  return { links, rechts: links + breite, oben, unten: oben + hoehe };
}

function kasten(
  name: string,
  links: number,
  breite: number,
): { name: string; links: number; rechts: number } {
  return { name, links, rechts: links + breite };
}

/** Eine Kopfbandzeile, wie die Messung sie liefert — die Namen sind die echten (`MESSUNG`). */
function zeile(verschiebung = 0, markeBreite = 202.5): ZeilenLage {
  return {
    kaesten: [
      kasten("marke", 16 + verschiebung, markeBreite),
      kasten("punkt:start", 240 + verschiebung, 44),
      kasten("punkt:validierung", 300 + verschiebung, 62),
      kasten("konto", 1200 + verschiebung, 32),
    ],
  };
}

// ================================================================================================
// R — DER RUHEVERGLEICH
// ================================================================================================
describe("JOB 3616 · R · zwei Messungen sind nur dann gleich, wenn auch die Lage gleich ist", () => {
  it("R1 · gleiche Breiten, verschobene Positionen: das ist KEINE Ruhe", () => {
    // Der Fall, den der Ausgangsstand durchliess: jeder Kasten behält seine Breite, die ganze Zeile
    // rutscht um 15 px. `draussen()` rechnet mit `k.rechts` — genau dieser Wert ist ein anderer.
    const unterschied = zeilenUnterschied(zeile(0), zeile(15));
    expect(
      unterschied,
      "zwei Messungen mit gleichen Breiten, aber um 15 px verschobener Zeile wurden als ruhig gewertet",
    ).not.toBeNull();
    expect(String(unterschied)).toContain("verschoben");
    expect(String(unterschied)).toContain("marke");
    console.log(`${KENNUNG} · R1 · ${String(unterschied)}`);
  });

  it("R2 · dieselbe Zeile zweimal: das IST Ruhe (die Gegenrichtung)", () => {
    // Ohne diesen Fall wäre ein Vergleich, der IMMER einen Unterschied meldet, von einem richtigen
    // nicht zu unterscheiden — und `beruhige` käme nie zu Ende.
    expect(zeilenUnterschied(zeile(0), zeile(0)), "dieselbe Zeile galt als unruhig").toBeNull();
  });

  it("R3 · ein Kasten wird breiter: das ist KEINE Ruhe (die Achse des Ausgangsstands)", () => {
    const unterschied = zeilenUnterschied(zeile(0), zeile(0, 217.5));
    expect(unterschied, "ein um 15 px breiterer Kasten wurde als ruhig gewertet").not.toBeNull();
    expect(String(unterschied)).toContain("breit");
  });

  it("R4 · ein Kasten kommt dazu oder heisst anders: das ist KEINE Ruhe", () => {
    const kuerzer: ZeilenLage = { kaesten: zeile().kaesten.slice(0, 3) };
    expect(
      zeilenUnterschied(zeile(), kuerzer),
      "eine kürzere Zeile galt als gleich",
    ).not.toBeNull();
    const umbenannt: ZeilenLage = {
      kaesten: zeile().kaesten.map((k, i) => (i === 2 ? { ...k, name: "punkt:konflikte" } : k)),
    };
    expect(
      zeilenUnterschied(zeile(), umbenannt),
      "ein anderer Kasten an derselben Stelle galt als gleich",
    ).not.toBeNull();
  });

  it("R5 · Teilpixel unterhalb der Schwelle bleiben Ruhe — die Schwelle ist unverändert 0,01 px", () => {
    const fastGleich: ZeilenLage = {
      kaesten: zeile().kaesten.map((k) => ({
        ...k,
        links: k.links + 0.004,
        rechts: k.rechts + 0.004,
      })),
    };
    expect(zeilenUnterschied(zeile(), fastGleich), "0,004 px galten als Bewegung").toBeNull();
  });
});

// ================================================================================================
// A — DER ANKUNFTSNACHWEIS
// ================================================================================================
//
// DER ANLASS IST EINE GEMESSENE FEHLFREIGABE (BEN, JOB 3616 R2, Korrekturpflicht 1). Der Nachweis
// las die Ressourcen-Zeitleiste des Dokuments und nahm jeden fertig empfangenen Eintrag als „die
// Antwort ist da". Eine mit HTTP 503 beantwortete Abfrage erzeugt denselben Eintrag: der Prüfer hat
// die Zähler-Quelle gestört und bekam `nachweisErbracht:true` nach 355 ms mit
// `timing:[{status:503}]` — eine NICHT geladene Zeile bekam einen fertigen Messwert. Bei leerem
// Prüf-Board (Sollwert 0) und in der schmalen Bauform, wo der Punkt gar nicht gezeichnet ist, fiel
// auch die zweite Hälfte des Nachweises weg; es blieb gar keine Prüfung übrig.
//
// „EMPFANGEN" UND „ERFOLGREICH" SIND ZWEI AUSSAGEN. Gemessen wird erst nach der zweiten.
const ANKUNFT_LEER: AnkunftBefund = { eintraege: [], pufferVoll: false, statusLesbar: true };

/** Eine Zeitleiste aus fertig empfangenen Einträgen — `[status, responseEnd]` je Eintrag. */
function zeitleiste(...eintraege: [number, number][]): AnkunftBefund {
  return {
    eintraege: eintraege.map(([status, responseEnd]) => ({ status, responseEnd })),
    pufferVoll: false,
    statusLesbar: true,
  };
}

describe("JOB 3616 · A · „die Antwort ist da“ heisst: sie ist ERFOLGREICH empfangen", () => {
  it("A0 · HTTP 200: das ist der Nachweis (die Gegenrichtung zu allen folgenden Fällen)", () => {
    // Auch die LEERE erfolgreiche Antwort — das Prüf-Board dieser Bühne liefert `[]`. Der Körper
    // spielt keine Rolle; was zählt, ist der empfangene Status.
    const urteil = beurteileAnkunft(zeitleiste([200, 412.5]));
    expect(
      urteil.art,
      `eine erfolgreiche Antwort wurde nicht als Nachweis genommen: ${urteil.meldung}`,
    ).toBe("angekommen");
    expect(urteil.responseEnd).toBeCloseTo(412.5, 3);
    expect(urteil.erfolgreich).toBe(1);
  });

  it("A1 · HTTP 503: ein empfangener Fehler ist KEIN fertiger Ladezustand", () => {
    const urteil = beurteileAnkunft(zeitleiste([503, 65.5]));
    expect(
      urteil.art,
      "eine mit HTTP 503 beantwortete Abfrage galt als fertig geladen — genau das war die gemessene Fehlfreigabe",
    ).toBe("wartet");
    expect(urteil.meldung).toContain("HTTP 503");
    expect(urteil.meldung).toContain("kein fertiger Ladezustand");
    expect(urteil.erfolgreich, "ein Fehler wurde als Erfolg gezählt").toBe(0);
    expect(
      urteil.fertig,
      "der Eintrag ist empfangen — das bleibt wahr und wird auch so gesagt",
    ).toBe(1);
    console.log(`${KENNUNG} · A1 · ${urteil.meldung}`);
  });

  it("A2 · HTTP 404 ebenso — die Regel ist „2xx“, nicht „alles ausser 503“", () => {
    const urteil = beurteileAnkunft(zeitleiste([404, 70]));
    expect(urteil.art, "HTTP 404 galt als fertiger Ladezustand").toBe("wartet");
    expect(urteil.meldung).toContain("HTTP 404");
  });

  it("A3 · erst HTTP 503, dann erfolgreich: der Messwert stammt vom ERFOLG, nicht vom Fehler", () => {
    // Der Wiederholungsabruf des Produkts (`retry: 1`, main.tsx). Der erste Eintrag darf keine
    // vorzeitige Freigabe bewirken — und der Zeitpunkt, den der Lauf ausgibt, ist der des 200ers.
    const urteil = beurteileAnkunft(zeitleiste([503, 65.5], [200, 1834.25]));
    expect(urteil.art, "nach einem Fehler und einem Erfolg wurde nicht gemessen").toBe(
      "angekommen",
    );
    expect(
      urteil.responseEnd,
      "der ausgegebene Zeitpunkt stammt vom Fehlereintrag statt von der erfolgreichen Antwort",
    ).toBeCloseTo(1834.25, 3);
    expect(urteil.fertig).toBe(2);
    expect(urteil.erfolgreich).toBe(1);
    console.log(`${KENNUNG} · A3 · ${urteil.meldung}`);
  });

  it("A4 · ein noch nicht zu Ende empfangener Eintrag trägt nichts (responseEnd 0)", () => {
    const urteil = beurteileAnkunft(zeitleiste([200, 0]));
    expect(urteil.art, "ein unfertiger Eintrag galt als Nachweis").toBe("wartet");
    expect(urteil.fertig).toBe(0);
  });

  it("A5 · gar kein Eintrag: die Antwort ist nicht im Browser angekommen", () => {
    const urteil = beurteileAnkunft(ANKUNFT_LEER);
    expect(urteil.art).toBe("wartet");
    expect(urteil.meldung).toContain("NICHT IM BROWSER ANGEKOMMEN");
  });

  it("A6 · übergelaufene Zeitleiste: Abbruch statt Urteil — auch mit erfolgreichem Eintrag", () => {
    // Läuft die Zeitleiste über, fehlen Einträge. Dann ist weder „nicht angekommen" belegbar noch
    // ausgeschlossen, dass der fehlende Eintrag der Fehler war. Abbruch mit Grund, nicht raten.
    const voll: AnkunftBefund = { ...zeitleiste([200, 412.5]), pufferVoll: true };
    const urteil = beurteileAnkunft(voll);
    expect(urteil.art, "die übergelaufene Zeitleiste wurde trotzdem als Nachweis genommen").toBe(
      "abbruch",
    );
    expect(urteil.meldung).toContain("übergelaufen");
  });

  it("A7 · ein Browser ohne `responseStatus`: Abbruch, denn Fehler und Erfolg wären ununterscheidbar", () => {
    const ohne: AnkunftBefund = { ...zeitleiste([200, 412.5]), statusLesbar: false };
    const urteil = beurteileAnkunft(ohne);
    expect(
      urteil.art,
      "ohne lesbaren Status wurde gemessen — dann wäre die ganze Korrektur dieser Runde wirkungslos",
    ).toBe("abbruch");
    expect(urteil.meldung).toContain("responseStatus");
    console.log(`${KENNUNG} · A7 · ${urteil.meldung}`);
  });

  it("A8 · ein fertiger Eintrag ohne lesbaren Status (0): Abbruch mit Grund", () => {
    const urteil = beurteileAnkunft(zeitleiste([0, 412.5]));
    expect(urteil.art, "ein Eintrag ohne Status galt als erfolgreich").toBe("abbruch");
    expect(urteil.meldung).toContain("ohne lesbaren Status");
  });

  it("A9 · die Meldung zählt die empfangenen Fehler, statt sie zu verschweigen", () => {
    const urteil = beurteileAnkunft(zeitleiste([503, 65.5], [503, 1070.25]));
    expect(urteil.art).toBe("wartet");
    expect(urteil.meldung, "zwei Fehlantworten wurden nicht gezählt").toContain("HTTP 503 (2×)");
  });
});

// ================================================================================================
// S — DER SICHTBARKEITSBEFUND
// ================================================================================================
//
// Die gebaute Lage ist die echte: das eingepasste Logo (88,3 × 20 px) in seinem Kasten, im Kopfband,
// im Körper, bei 1280 × 800 px Fenster. Jeder Fall verstellt GENAU EINE Grösse — ein Fall, der aus
// zwei Gründen zugleich rot ist, belegt keinen von beiden (dieselbe Regel wie `bauQuelle` in
// `deckelung-waechter.test.ts`).
const FENSTER = { breite: 1280, hoehe: 800 };
const BILD = rechteck(120, 18, 88.3, 20);
const LOGOKASTEN = rechteck(118, 12, 100.3, 28);
const BAND = rechteck(0, 0, 1280, 56);
const KOERPER = rechteck(0, 0, 1280, 2400);

/**
 * Ein Kettenelement. `innen` ist vorbelegt mit der äusseren Kante — das ist die Lage OHNE Rahmen
 * und ohne Rollleiste. Die Fälle S15/S16 setzen es ausdrücklich, denn genau dort liegt der
 * Unterschied, an dem Runde 1 gescheitert ist.
 */
function knoten(name: string, r: Rechteck, abweichung: Partial<StilKnoten> = {}): StilKnoten {
  return {
    name,
    rechteck: r,
    innen: r,
    display: "block",
    sichtbarkeit: "visible",
    deckkraft: 1,
    ueberlaufX: "visible",
    ueberlaufY: "visible",
    ...abweichung,
  };
}

/**
 * Ein Element mit Rahmen: äussere Kante `r`, Schnittfläche je Achse um `rahmen` px eingerückt.
 *
 * Die zwei Achsen sind getrennt, damit ein Fall GENAU EINE Sache verstellen kann — ein Fall, der
 * waagerecht UND senkrecht beschneidet, belegt keine von beiden.
 */
function gerahmt(
  name: string,
  r: Rechteck,
  rahmen: { x: number; y: number },
  ueberlauf: string,
): StilKnoten {
  return knoten(name, r, {
    innen: {
      links: r.links + rahmen.x,
      rechts: r.rechts - rahmen.x,
      oben: r.oben + rahmen.y,
      unten: r.unten - rahmen.y,
    },
    ueberlaufX: ueberlauf,
    ueberlaufY: ueberlauf,
  });
}

/** Die saubere Lage — Grundlage jedes Falls, damit jeder Fall genau eine Sache verstellt. */
function sauber(): SichtBefund {
  return {
    gefunden: true,
    bildGeladen: true,
    gezeichnet: true,
    kette: [
      knoten("img.h-5", BILD),
      knoten("span[data-testid=kopfband-firmenlogo]", LOGOKASTEN),
      knoten("header[data-testid=kopfband]", BAND),
      knoten("body", KOERPER),
    ],
    kastenRechteck: LOGOKASTEN,
    fenster: FENSTER,
  };
}

/** Denselben Befund mit einem verstellten Bildrechteck. */
function mitBild(r: Rechteck, abweichung: Partial<StilKnoten> = {}): SichtBefund {
  const b = sauber();
  b.kette[0] = knoten("img.h-5", r, abweichung);
  return b;
}

function rot(befund: SichtBefund, fall: string, erwartet: string): void {
  const urteil = beurteileSicht(befund);
  expect(urteil.sichtbar, `${fall}: der Befund nannte das Firmenlogo sichtbar`).toBe(false);
  expect(urteil.gruende.join(" · "), `${fall}: der Grund nennt die Sache nicht`).toContain(
    erwartet,
  );
  console.log(`${KENNUNG} · ${fall} · ${urteil.gruende.join(" · ")} · ${urteil.masse}`);
}

describe("JOB 3616 · S · „das Firmenlogo steht“ heisst: ein Mensch sieht es", () => {
  it("S0 · die saubere Lage ist sichtbar (die Gegenrichtung zu allen folgenden Fällen)", () => {
    const urteil = beurteileSicht(sauber());
    expect(urteil.sichtbar, `die saubere Lage wurde abgelehnt: ${urteil.gruende.join(" · ")}`).toBe(
      true,
    );
    expect(urteil.gruende).toEqual([]);
    console.log(`${KENNUNG} · S0 · sichtbar · ${urteil.masse}`);
  });

  it("S1 · Höhe 0: eingepasst heisst nicht zusammengedrückt", () => {
    rot(mitBild(rechteck(120, 18, 88.3, 0)), "S1", "hoch");
  });

  it("S2 · Breite 0: der Fall, den schon der Ausgangsstand fand", () => {
    rot(mitBild(rechteck(120, 18, 0, 20)), "S2", "breit");
  });

  it("S3 · ganz ausserhalb des Fensters: rechts neben der Fensterkante", () => {
    rot(mitBild(rechteck(1300, 18, 88.3, 20)), "S3", "Fenster");
  });

  it("S4 · angeschnitten an der Fensterkante: auch das ist nicht „steht“", () => {
    rot(mitBild(rechteck(1240, 18, 88.3, 20)), "S4", "Fenster");
  });

  it("S5 · hinter einem abschneidenden, ROLLBAREN Vorfahren (overflow: auto)", () => {
    // WÖRTLICH die Korrekturpflicht, an der JOB 3584 zweimal gescheitert ist (LEHREN.md 11.09.
    // 10:45:27): „In Erreichbarkeits- und Fokusmesser rollbare Vorfahren nicht pauschal ausnehmen."
    // Ein Inhalt, der aus seiner Rollfläche herausragt, ist JETZT nicht zu sehen — dass man ihn
    // hinrollen KÖNNTE, ist eine andere Aussage als „er steht da".
    const b = sauber();
    b.kette[2] = knoten("header[data-testid=kopfband]", rechteck(0, 0, 100, 56), {
      ueberlaufX: "auto",
      ueberlaufY: "auto",
    });
    rot(b, "S5", "schneidet");
  });

  it("S6 · hinter einem abschneidenden Vorfahren (overflow: hidden)", () => {
    const b = sauber();
    b.kette[2] = knoten("header[data-testid=kopfband]", rechteck(0, 0, 100, 56), {
      ueberlaufX: "hidden",
      ueberlaufY: "hidden",
    });
    rot(b, "S6", "schneidet");
  });

  it("S7 · ein rollbarer Vorfahr, der das Logo NICHT abschneidet, bleibt grün (Gegenrichtung zu S5)", () => {
    // Ohne diesen Fall wäre nicht zu unterscheiden, ob S5 die Beschneidung misst oder pauschal
    // jeden rollbaren Vorfahren ablehnt — das eine ist der Befund, das andere ein blinder Prüfer.
    const b = sauber();
    b.kette[2] = knoten("header[data-testid=kopfband]", BAND, {
      ueberlaufX: "auto",
      ueberlaufY: "auto",
    });
    const urteil = beurteileSicht(b);
    expect(
      urteil.sichtbar,
      `ein rollbarer Vorfahr allein galt als Beschneidung: ${urteil.gruende.join(" · ")}`,
    ).toBe(true);
  });

  it("S8 · opacity: 0 am Bild selbst", () => {
    rot(mitBild(BILD, { deckkraft: 0 }), "S8", "durchsichtig");
  });

  it("S9 · opacity: 0 an einem Vorfahren — Deckkraft erbt sich nicht in den Rechenwert", () => {
    const b = sauber();
    b.kette[1] = knoten("span[data-testid=kopfband-firmenlogo]", LOGOKASTEN, { deckkraft: 0 });
    rot(b, "S9", "durchsichtig");
  });

  it("S10 · visibility: hidden an einem Vorfahren", () => {
    const b = sauber();
    b.kette[1] = knoten("span[data-testid=kopfband-firmenlogo]", LOGOKASTEN, {
      sichtbarkeit: "hidden",
    });
    rot(b, "S10", "visibility");
  });

  it("S11 · display: none an einem Vorfahren", () => {
    const b = sauber();
    b.kette[2] = knoten("header[data-testid=kopfband]", BAND, { display: "none" });
    rot(b, "S11", "display");
  });

  it("S12 · das Bild ist gar nicht geladen — die Achse des Ausgangsstands bleibt", () => {
    const b = sauber();
    b.bildGeladen = false;
    rot(b, "S12", "leeres Bild");
  });

  it("S13 · gar kein Logokasten im Kopfband", () => {
    rot(
      {
        gefunden: false,
        bildGeladen: false,
        gezeichnet: false,
        kette: [],
        kastenRechteck: null,
        fenster: FENSTER,
      },
      "S13",
      "kein Firmenlogo",
    );
  });

  it("S14 · der Kasten selbst ist 0 px hoch, obwohl das Bild Masse hat", () => {
    const b = sauber();
    b.kastenRechteck = rechteck(118, 12, 100.3, 0);
    rot(b, "S14", "Logokasten");
  });

  // ==============================================================================================
  // S15/S16 — DIE FEHLFREIGABE AUS RUNDE 1: RAHMEN UND ROLLFLÄCHE (Korrekturpflicht 2 des Prüfers).
  // ==============================================================================================
  //
  // Der Prüfer hat im Browser gemessen: rollbarer Vorfahr mit 20 px Rahmen, Bildbeginn 125,47 px,
  // innere Begrenzung 140,47 px — 15 px abgeschnitten, Urteil trotzdem `sichtbar:true`. Ursache war
  // der Vergleich gegen `getBoundingClientRect()`, also gegen die äussere Kante samt Rahmen. Die
  // gebaute Lage hier ist dieselbe Klasse; die Messung am gezeichneten Produkt steht in
  // `logokasten-chromium.test.ts` (L10).
  const RAHMEN = { x: 20, y: 0 };
  /**
   * Die äussere Kante des rollbaren Vorfahren: sie umschliesst das Bild (120 … 208,3 px), seine
   * Schnittfläche (120 … 193,3 px) nicht — dieselben 15 px, die der Prüfer im Browser gemessen hat.
   */
  const ROLLFLAECHE = rechteck(100, 8, 113.3, 40);

  it("S15 · gerahmter rollbarer Vorfahr: das Bild liegt innerhalb der äusseren Kante, aber ausserhalb der Rollfläche", () => {
    const b = sauber();
    const flaeche = gerahmt("div.rollflaeche", ROLLFLAECHE, RAHMEN, "auto");
    b.kette[2] = flaeche;
    const innen = flaeche.innen;
    // DIE VORAUSSETZUNG, ohne die dieser Fall nichts belegte: gegen die äussere Kante wäre er grün.
    expect(BILD.rechts, "die gebaute Lage ragt schon über die äussere Kante").toBeLessThanOrEqual(
      ROLLFLAECHE.rechts,
    );
    expect(BILD.rechts, "die gebaute Lage wird gar nicht beschnitten").toBeGreaterThan(
      innen.rechts + 1,
    );
    rot(b, "S15", "schneidet");
    expect(
      beurteileSicht(b).gruende.join(" · "),
      "die Meldung nennt die Schnittfläche nicht",
    ).toContain("Schnittfläche");
  });

  it("S16 · derselbe Rahmen, aber das Bild liegt vollständig in der Rollfläche — grün", () => {
    const b = sauber();
    b.kette[2] = gerahmt("div.rollflaeche", rechteck(60, 0, 220, 56), RAHMEN, "auto");
    expect(BILD.rechts, "die Gegenrichtung ist gar nicht weit genug").toBeLessThan(
      60 + 220 - RAHMEN.x,
    );
    const urteil = beurteileSicht(b);
    expect(
      urteil.sichtbar,
      `ein gerahmter rollbarer Vorfahr ohne Beschneidung wurde abgelehnt: ${urteil.gruende.join(" · ")}`,
    ).toBe(true);
  });

  it("S17 · ein `display: contents`-Vorfahr schneidet nichts ab — er hat gar keine Box", () => {
    // Ohne diese Frage lehnte der Befund ein Logo ab, dessen Vorfahr keine Fläche erzeugt: seine
    // Client-Masse sind 0, die „Schnittfläche" wäre ein Punkt.
    const b = sauber();
    b.kette[2] = knoten("div.huelle", rechteck(0, 0, 0, 0), {
      display: "contents",
      ueberlaufX: "hidden",
      ueberlaufY: "hidden",
    });
    const urteil = beurteileSicht(b);
    expect(
      urteil.sichtbar,
      `ein display:contents-Vorfahr galt als Beschneidung: ${urteil.gruende.join(" · ")}`,
    ).toBe(true);
  });
});
