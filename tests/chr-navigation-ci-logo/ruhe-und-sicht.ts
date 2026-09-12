// ================================================================================================
// JOB 3616 · DIE ZWEI URTEILE DER MESSUNG — GETRENNT VOM BROWSER, DAMIT SIE SELBST PRÜFBAR SIND.
// ================================================================================================
//
// WOZU ES DIESE DATEI GIBT. `logokasten-chromium.test.ts` misst im Browser und URTEILT über das
// Gemessene. Bis JOB 3616 standen beide Urteile mitten in der Messdatei, und beide waren schwächer
// als ihr Name:
//
//   · „die Zeile ist zur Ruhe gekommen" verglich NUR Namen und Breiten der Kästen. Eine Zeile, die
//     sich als Ganzes verschob, ohne dass ein Kasten seine Breite änderte, hiess ruhig — obwohl die
//     Datei ihr Urteil an der LAGE fällt (`draussen()` rechnet mit `k.rechts`).
//   · „das Firmenlogo steht" hiess: sein Bild ist geladen und breiter als 0 px. Ein Logo mit Höhe 0,
//     mit `opacity: 0`, hinter einem abschneidenden Vorfahren oder ausserhalb des Fensters war für
//     diese Datei vorhanden.
//
// BEIDE URTEILE WOHNEN DESHALB HIER, als reine Rechnung über übergebene Zahlen — und NICHT, weil
// zwei Dateien schöner wären als eine, sondern weil ein Urteil, das nur im Browser fällt, sich nicht
// gegenprüfen lässt: man kann dem echten Kopfband keine Höhe 0 geben, ohne das Produkt anzufassen.
// `ruhe-und-sicht-waechter.test.ts` füttert dieselbe Rechnung mit GEBAUTEN Lagen und verlangt sie
// rot; die Messdatei füttert sie mit dem, was Chromium wirklich zeichnet. Eine Regel, zwei Hälften.
//
// DIESE DATEI IMPORTIERT NICHTS AUS DEM BROWSER — kein Playwright, keinen Prüfstand. Sie rechnet nur
// und ordnet sich damit NICHT in die serielle Browser-Gruppe ein (`tests/tor-inventar/browser-gruppe.ts`),
// und sie fügt dem gepinnten Bestand der Chromium-Startdateien keine hinzu.
//
// DIE TYPEN SIND STRUKTURELL und absichtlich klein: `KastenLage` ist genau der Ausschnitt von
// `Kasten` (`tests/navigation-schmal/kopfband-messung.ts`), den der Ruhevergleich braucht. Eine
// Importbeziehung dorthin zöge den Prüfstand und damit Playwright in diese Datei.

/** Der Ausschnitt eines gemessenen Kastens, an dem die Ruhe entschieden wird. */
export interface KastenLage {
  name: string;
  links: number;
  rechts: number;
}

/** Eine gemessene Kopfbandzeile — strukturell die `Messung` der Messdatei. */
export interface ZeilenLage {
  kaesten: KastenLage[];
}

/**
 * Die Schwelle, ab der zwei Messungen als verschieden gelten.
 *
 * SIE BLEIBT BEI 0,01 px, unverändert seit JOB 3582. Eine grössere Toleranz schluckte genau die
 * Fehlerklasse, die diese Messfamilie finden soll (der Zähler am Punkt „Prüfen" ist rund 15 px
 * breit); der Kopf von `logokasten-chromium.test.ts` verbietet sie ausdrücklich.
 */
export const RUHE_TOLERANZ_PX = 0.01;

/**
 * Sind zwei Messungen dieselbe Zeile? `null` heisst ja; sonst steht da, WAS sich bewegt hat.
 *
 * Verglichen werden Anzahl, Name, BREITE und LAGE jedes Kastens. Die Lage kam mit JOB 3616 dazu:
 * ohne sie galt eine um 15 px verschobene Zeile als ruhig, und der rechte Rand — die Zahl, an der
 * die Messdatei „steht etwas ausserhalb des Fensters" entscheidet — war eine andere.
 */
export function zeilenUnterschied(a: ZeilenLage, b: ZeilenLage): string | null {
  if (a.kaesten.length !== b.kaesten.length) {
    return `die Zeile trug einmal ${a.kaesten.length} und einmal ${b.kaesten.length} Kästen`;
  }
  for (let i = 0; i < a.kaesten.length; i++) {
    const erst = a.kaesten[i];
    const zweit = b.kaesten[i];
    if (erst === undefined || zweit === undefined) {
      return `an Stelle ${i + 1} fehlt ein Kasten`;
    }
    if (erst.name !== zweit.name) {
      return `an Stelle ${i + 1} stand einmal „${erst.name}“ und einmal „${zweit.name}“`;
    }
    const breiteA = erst.rechts - erst.links;
    const breiteB = zweit.rechts - zweit.links;
    if (Math.abs(breiteB - breiteA) >= RUHE_TOLERANZ_PX) {
      return `„${erst.name}“ war einmal ${breiteA.toFixed(2)} px und einmal ${breiteB.toFixed(2)} px breit (${Math.abs(breiteB - breiteA).toFixed(2)} px Unterschied)`;
    }
    const links = zweit.links - erst.links;
    const rechts = zweit.rechts - erst.rechts;
    if (Math.abs(links) >= RUHE_TOLERANZ_PX || Math.abs(rechts) >= RUHE_TOLERANZ_PX) {
      return (
        `„${erst.name}“ hat sich verschoben: links ${erst.links.toFixed(2)} → ${zweit.links.toFixed(2)} px, ` +
        `rechts ${erst.rechts.toFixed(2)} → ${zweit.rechts.toFixed(2)} px (${Math.max(Math.abs(links), Math.abs(rechts)).toFixed(2)} px)`
      );
    }
  }
  return null;
}

// ================================================================================================
// DER ANKUNFTSNACHWEIS — „die Antwort ist da" heisst: sie ist ERFOLGREICH empfangen.
// ================================================================================================
//
// DIESE RECHNUNG STAND BIS RUNDE 3 INMITTEN VON `logokasten-chromium.test.ts` und lautete dort in
// einer Zeile: `eintraege.filter((e) => e.responseEnd > 0)` — wer einen fertig empfangenen Eintrag
// hat, hat den Nachweis. Der Prüfer hat daran die Fehlfreigabe gemessen (BEN, JOB 3616 R2,
// Korrekturpflicht 1): eine mit HTTP 503 beantwortete Abfrage erzeugt denselben Eintrag, und der
// Lauf mass mit `nachweisErbracht:true` weiter. Sie wohnt deshalb hier — als reine Rechnung über
// übergebene Zahlen, damit `ruhe-und-sicht-waechter.test.ts` (A0–A9) sie mit gebauten Zeitleisten
// gegenprüfen kann; am gebauten Produkt misst sie `logokasten-chromium.test.ts` (L11a/L11b).
//
// DER ALTE STAND IST ERSETZT, NICHT ERGÄNZT: es gibt keinen zweiten, schwächeren Weg, „die Antwort
// ist da“ zu sagen. Der rote Ausgangslauf dieser Runde (Cloud-Lauf 2cf08bf0db16e386019fba5e) hat
// die alte Regel hier gefahren: A1/A2/A7/A8/A9 und L11a/L11b waren rot, alles andere grün.

/** Ein Eintrag der Ressourcen-Zeitleiste des Dokuments, auf das Nötige verkürzt. */
export interface ZeitleistenEintrag {
  /** `responseEnd` — > 0, sobald der Browser die Antwort vollständig empfangen hat. */
  responseEnd: number;
  /** `responseStatus` — der empfangene HTTP-Status; 0 heisst „gibt der Browser nicht her". */
  status: number;
}

export interface AnkunftBefund {
  eintraege: ZeitleistenEintrag[];
  /** Ist die Zeitleiste übergelaufen? Dann fehlen Einträge und „nicht angekommen" wäre falsch. */
  pufferVoll: boolean;
  /** Kennt dieser Browser `PerformanceResourceTiming.responseStatus` überhaupt? */
  statusLesbar: boolean;
}

export interface Ankunftsurteil {
  /** `angekommen` = messen · `wartet` = weiter warten · `abbruch` = sofort mit Grund beenden. */
  art: "angekommen" | "wartet" | "abbruch";
  /** Der Satz, den der Lauf ausgibt — bei `abbruch` und bei Fristablauf ist er der Grund. */
  meldung: string;
  /** Nur bei `angekommen`: der Zeitpunkt der ERFOLGREICHEN Antwort. */
  responseEnd: number;
  /** Wie viele Einträge vollständig empfangen sind (gleich welchen Status sie tragen). */
  fertig: number;
  /** Wie viele davon einen 2xx-Status tragen. */
  erfolgreich: number;
  /** Die empfangenen Status in der Reihenfolge der Zeitleiste — sie stehen in jeder Meldung. */
  status: number[];
}

/** Nur 2xx zählt. 3xx ist ein Zwischenschritt, 4xx/5xx ein empfangener Fehler. */
function istErfolg(status: number): boolean {
  return status >= 200 && status < 300;
}

/** „HTTP 503 (2×), HTTP 200" — die Status einer Zeitleiste, lesbar für einen Menschen. */
export function statusListe(status: number[]): string {
  if (status.length === 0) {
    return "kein Status";
  }
  const gezaehlt = new Map<number, number>();
  for (const s of status) {
    gezaehlt.set(s, (gezaehlt.get(s) ?? 0) + 1);
  }
  return [...gezaehlt.entries()]
    .map(([s, n]) => `HTTP ${s === 0 ? "ohne lesbaren Status" : s}${n > 1 ? ` (${n}×)` : ""}`)
    .join(", ");
}

/**
 * IST DIE ZÄHLER-ANTWORT ERFOLGREICH IM BROWSER ANGEKOMMEN?
 *
 * VIER FRAGEN IN DIESER REIHENFOLGE, und jede kann nur EIN Ergebnis haben:
 *
 *   1. IST DIE ZEITLEISTE VOLLSTÄNDIG? Ein übergelaufener Puffer verliert Einträge — dann ist weder
 *      „nicht angekommen“ belegbar noch ausgeschlossen, dass der verlorene Eintrag der Fehler war.
 *      Abbruch mit Grund, auch wenn ein erfolgreicher Eintrag dasteht.
 *   2. IST DER STATUS ÜBERHAUPT LESBAR? Gäbe dieser Browser `responseStatus` nicht her, wäre ein
 *      empfangener Fehler von einer erfolgreichen Antwort nicht zu unterscheiden — und die ganze
 *      Frage 4 wäre wirkungslos. Dann wird nicht gemessen, sondern gesagt, warum.
 *   3. LIEGT EINE ERFOLGREICHE ANTWORT VOR (2xx)? Dann ist der Nachweis erbracht, und der Zeitpunkt
 *      ist DER IHRE — nicht der eines vorangegangenen Fehlers.
 *   4. SONST WIRD GEWARTET. Ein empfangener HTTP-Fehler (oder ein Eintrag ohne lesbaren Status)
 *      bringt den Lauf keinen Schritt weiter; er steht in der Meldung, damit der Abbruch bei
 *      Fristablauf seinen wirklichen Grund nennt statt „nicht angekommen“.
 *
 * DAS IST DIE KORREKTUR DER RUNDE 3 (BEN, JOB 3616 R2, Korrekturpflicht 1). Bis hierher genügte
 * Frage 3 in der Form „ist irgendein Eintrag fertig empfangen“, und der Prüfer bekam mit einer
 * gestörten Zähler-Quelle `nachweisErbracht:true` nach 355 ms bei `timing:[{status:503}]`.
 * „Empfangen“ und „erfolgreich“ sind zwei Aussagen; gemessen wird erst nach der zweiten.
 */
export function beurteileAnkunft(b: AnkunftBefund): Ankunftsurteil {
  const fertige = b.eintraege.filter((e) => e.responseEnd > 0);
  const status = fertige.map((e) => e.status);
  const erfolgreiche = fertige.filter((e) => istErfolg(e.status));
  const rumpf = {
    // DER ZEITPUNKT IST DER DER ERFOLGREICHEN ANTWORT. Ein vorangegangener Fehler hat seinen
    // eigenen, früheren `responseEnd`; ihn hier mitzurechnen hiesse, den Fehler als Messwert zu
    // führen. Ohne Erfolg gibt es keinen Zeitpunkt — dann steht hier 0.
    responseEnd: erfolgreiche.length ? Math.max(...erfolgreiche.map((e) => e.responseEnd)) : 0,
    fertig: fertige.length,
    erfolgreich: erfolgreiche.length,
    status,
  };
  if (b.pufferVoll) {
    return {
      art: "abbruch",
      meldung:
        "die Ressourcen-Zeitleiste des Dokuments ist übergelaufen — der Ankunftsnachweis wäre nicht mehr verlässlich, und „nicht angekommen“ wäre eine Falschaussage",
      ...rumpf,
    };
  }
  if (!b.statusLesbar) {
    return {
      art: "abbruch",
      meldung:
        "dieser Browser gibt `responseStatus` der Ressourcen-Zeitleiste nicht her — eine empfangene Fehlerantwort wäre von einer erfolgreichen nicht zu unterscheiden, und der Ladenachweis wäre wirkungslos",
      ...rumpf,
    };
  }
  if (erfolgreiche.length > 0) {
    return {
      art: "angekommen",
      meldung: `${fertige.length} Eintrag/Einträge in der Zeitleiste (${statusListe(status)}), davon ${erfolgreiche.length} erfolgreich, responseEnd ${rumpf.responseEnd.toFixed(0)} ms`,
      ...rumpf,
    };
  }
  const ohneStatus = fertige.filter((e) => e.status === 0);
  if (ohneStatus.length > 0) {
    return {
      art: "abbruch",
      meldung: `die Zeitleiste trägt ${ohneStatus.length} empfangene(n) Eintrag/Einträge ohne lesbaren Status (0) — ob die Antwort erfolgreich war, ist daran nicht zu erkennen`,
      ...rumpf,
    };
  }
  if (fertige.length > 0) {
    return {
      art: "wartet",
      meldung: `im Browser kamen nur Fehlerantworten an: ${statusListe(status)} — ein empfangener HTTP-Fehler ist kein fertiger Ladezustand`,
      ...rumpf,
    };
  }
  return {
    art: "wartet",
    meldung: `die Antwort ist NICHT IM BROWSER ANGEKOMMEN (${b.eintraege.length} Einträge in der Ressourcen-Zeitleiste dieses Dokuments)`,
    ...rumpf,
  };
}

// ================================================================================================
// DER SICHTBARKEITSBEFUND
// ================================================================================================

export interface Rechteck {
  links: number;
  rechts: number;
  oben: number;
  unten: number;
}

/** Ein Element der Kette vom gemessenen Bild aufwärts — mit den Stilen, die Sicht verhindern können. */
export interface StilKnoten {
  /** Wie das Element in einer Fehlermeldung heisst (Tag plus `data-testid` oder erste Klasse). */
  name: string;
  /** Die ÄUSSERE Kante (`getBoundingClientRect`) — Rahmen eingeschlossen. */
  rechteck: Rechteck;
  /**
   * DIE FLÄCHE, DIE DIESES ELEMENT WIRKLICH ZEIGT — und der Grund, aus dem sie neben der äusseren
   * Kante steht (JOB 3616 R2, Korrekturpflicht 2 des Prüfers).
   *
   * Ein abschneidendes Element zeigt seinen Inhalt nur INNERHALB seiner Polsterkante: der Rahmen
   * liegt darüber, eine Rollleiste nimmt weitere Pixel. Wer gegen `getBoundingClientRect()` prüft,
   * hält beides für sichtbare Fläche. Der Prüfer hat genau das gemessen: rollbarer Vorfahr mit
   * 20 px Rahmen, Bildbeginn 125,47 px, innere Grenze 140,47 px — 15 px abgeschnitten, und der
   * Befund sagte trotzdem „sichtbar". Diese Zahl kommt deshalb aus `clientLeft`/`clientTop` und
   * `clientWidth`/`clientHeight`, die Rahmen UND Rollleisten bereits abziehen.
   */
  innen: Rechteck;
  display: string;
  sichtbarkeit: string;
  deckkraft: number;
  ueberlaufX: string;
  ueberlaufY: string;
}

/**
 * Was der Browser über das gezeichnete Firmenlogo hergibt — Zahlen, keine Urteile.
 *
 * `kette[0]` ist das `<img>` selbst, danach folgen seine Vorfahren bis zum Wurzelelement. Die
 * Deckkraft steht je Element und nicht nur am Bild: `opacity` vererbt sich NICHT in den errechneten
 * Wert eines Kindes, ein durchsichtiger Vorfahr macht das Kind trotzdem unsichtbar.
 */
export interface SichtBefund {
  gefunden: boolean;
  bildGeladen: boolean;
  /** `offsetParent !== null` am Bild — der Beleg, dass es überhaupt im Layout steht. */
  gezeichnet: boolean;
  kette: StilKnoten[];
  kastenRechteck: Rechteck | null;
  fenster: { breite: number; hoehe: number };
}

export interface Sichturteil {
  sichtbar: boolean;
  /** Jeder Grund einzeln — wer misst, soll alles sehen, was im Weg steht, nicht nur das Erste. */
  gruende: string[];
  /** Die Zahlen, mit denen geurteilt wurde. Sie stehen im Lauf, auch wenn der Fall grün ist. */
  masse: string;
}

/**
 * Die Teilpixel-Toleranz der Lagevergleiche — dieselbe 1 px wie überall in dieser Messfamilie
 * (`pruefeZeile` in `tests/navigation-schmal/kopfband-messung.ts`).
 */
export const SICHT_TOLERANZ_PX = 1;

/**
 * Schneidet dieser Überlaufwert ab?
 *
 * ALLES AUSSER `visible` schneidet ab — `hidden`, `clip`, `scroll` und `auto`. ROLLBARE VORFAHREN
 * WERDEN AUSDRÜCKLICH NICHT AUSGENOMMEN: das ist wörtlich die Korrekturpflicht, an der JOB 3584
 * zweimal gescheitert ist (LEHREN.md, 11.09. 10:45:27). Inhalt, der aus seiner Rollfläche
 * herausragt, ist JETZT nicht zu sehen; dass man ihn hinrollen KÖNNTE, ist eine andere Aussage als
 * „er steht da" — und diese Datei urteilt über die erste.
 */
function schneidetAb(wert: string): boolean {
  return wert !== "visible";
}

/**
 * Erzeugt dieses Element überhaupt eine Box, die abschneiden KANN?
 *
 * `display: contents` erzeugt keine — ein solches Element kann nichts beschneiden, und seine
 * Client-Masse sind 0. Ohne diese Frage würde ein `display: contents`-Vorfahr mit geerbtem
 * `overflow` alles ablehnen, was er gar nicht berührt.
 */
function hatBox(k: StilKnoten): boolean {
  return k.display !== "contents" && k.display !== "none";
}

function breiteVon(r: Rechteck): number {
  return r.rechts - r.links;
}

function hoeheVon(r: Rechteck): number {
  return r.unten - r.oben;
}

/** Liegt `was` innerhalb von `rahmen` — je Achse, mit Teilpixel-Toleranz? */
function liegtInnerhalb(
  was: Rechteck,
  rahmen: Rechteck,
  achsen: { x: boolean; y: boolean },
): boolean {
  const t = SICHT_TOLERANZ_PX;
  if (achsen.x && (was.links < rahmen.links - t || was.rechts > rahmen.rechts + t)) {
    return false;
  }
  if (achsen.y && (was.oben < rahmen.oben - t || was.unten > rahmen.unten + t)) {
    return false;
  }
  return true;
}

/**
 * Sieht ein Mensch dieses Firmenlogo?
 *
 * Sieben Gründe, aus denen die Antwort nein ist, und jeder nennt seine Zahl: es gibt keines · sein
 * Bild ist leer · es steht nicht im Layout · es hat keine Fläche · es ist durchsichtig oder
 * ausgeblendet (an sich selbst oder an einem Vorfahren) · es liegt ausserhalb des Fensters · ein
 * Vorfahr schneidet es ab.
 */
export function beurteileSicht(b: SichtBefund): Sichturteil {
  const bild = b.kette[0];
  const rechteck = bild?.rechteck ?? null;
  const breite = rechteck ? breiteVon(rechteck) : 0;
  const hoehe = rechteck ? hoeheVon(rechteck) : 0;
  const abschneidend = b.kette
    .slice(1)
    .filter((k) => hatBox(k) && (schneidetAb(k.ueberlaufX) || schneidetAb(k.ueberlaufY)));
  const kastenMass =
    b.kastenRechteck === null
      ? "nicht gemessen"
      : `${breiteVon(b.kastenRechteck).toFixed(1)} × ${hoeheVon(b.kastenRechteck).toFixed(1)} px`;
  const masse =
    `Bild ${breite.toFixed(1)} × ${hoehe.toFixed(1)} px bei (${(rechteck?.links ?? 0).toFixed(1)}, ` +
    `${(rechteck?.oben ?? 0).toFixed(1)}) · Kasten ${kastenMass} · ` +
    `Fenster ${b.fenster.breite} × ${b.fenster.hoehe} px · ` +
    `${b.kette.length} Elemente in der Kette, davon ${abschneidend.length} abschneidend`;

  const gruende: string[] = [];
  if (!b.gefunden || bild === undefined || rechteck === null) {
    return {
      sichtbar: false,
      gruende: ["im Kopfband steht kein Firmenlogo (Kasten oder Bild fehlt)"],
      masse,
    };
  }
  if (!b.bildGeladen) {
    gruende.push("das Firmenlogo ist ein leeres Bild (nicht geladen)");
  }
  if (!b.gezeichnet) {
    gruende.push("das Firmenlogo steht nicht im Layout (offsetParent ist null)");
  }
  if (!(breite > 0)) {
    gruende.push(`das Firmenlogo ist ${breite.toFixed(1)} px breit`);
  }
  if (!(hoehe > 0)) {
    gruende.push(
      `das Firmenlogo ist ${hoehe.toFixed(1)} px hoch — eingepasst heisst nicht zusammengedrückt`,
    );
  }
  const kasten = b.kastenRechteck;
  if (kasten === null || !(breiteVon(kasten) > 0) || !(hoeheVon(kasten) > 0)) {
    gruende.push(
      `der Logokasten hat keine Fläche (${kasten === null ? "nicht gemessen" : `${breiteVon(kasten).toFixed(1)} × ${hoeheVon(kasten).toFixed(1)} px`})`,
    );
  }
  for (const k of b.kette) {
    if (k.display === "none") {
      gruende.push(`„${k.name}“ ist mit display: none ausgeblendet`);
    }
    if (k.sichtbarkeit !== "visible") {
      gruende.push(`„${k.name}“ trägt visibility: ${k.sichtbarkeit}`);
    }
    if (!(k.deckkraft > 0)) {
      gruende.push(`„${k.name}“ ist durchsichtig (opacity: ${k.deckkraft})`);
    }
  }
  const fenster: Rechteck = {
    links: 0,
    rechts: b.fenster.breite,
    oben: 0,
    unten: b.fenster.hoehe,
  };
  if (!liegtInnerhalb(rechteck, fenster, { x: true, y: true })) {
    gruende.push(
      `das Firmenlogo liegt nicht im Fenster: (${rechteck.links.toFixed(1)} … ${rechteck.rechts.toFixed(1)}, ` +
        `${rechteck.oben.toFixed(1)} … ${rechteck.unten.toFixed(1)}) bei ${b.fenster.breite} × ${b.fenster.hoehe} px`,
    );
  }
  for (const k of abschneidend) {
    const achsen = { x: schneidetAb(k.ueberlaufX), y: schneidetAb(k.ueberlaufY) };
    // GEPRÜFT WIRD GEGEN `innen`, NICHT GEGEN DIE ÄUSSERE KANTE: Rahmen und Rollleiste eines
    // abschneidenden Elements zeigen keinen Inhalt. Die äussere Kante steht in der Meldung daneben,
    // damit ein Mensch sieht, wie viel davon Rahmen ist.
    if (!liegtInnerhalb(rechteck, k.innen, achsen)) {
      gruende.push(
        `„${k.name}“ schneidet das Firmenlogo ab (overflow-x: ${k.ueberlaufX}, overflow-y: ${k.ueberlaufY}; ` +
          `Schnittfläche ${k.innen.links.toFixed(1)} … ${k.innen.rechts.toFixed(1)} / ${k.innen.oben.toFixed(1)} … ${k.innen.unten.toFixed(1)}, ` +
          `äussere Kante ${k.rechteck.links.toFixed(1)} … ${k.rechteck.rechts.toFixed(1)} / ${k.rechteck.oben.toFixed(1)} … ${k.rechteck.unten.toFixed(1)})`,
      );
    }
  }
  return { sichtbar: gruende.length === 0, gruende, masse };
}
