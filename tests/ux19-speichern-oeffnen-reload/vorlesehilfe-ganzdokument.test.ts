// ================================================================================================
// JOB 3259 · UX-19-R2 — WAS EINE VORLESEHILFE AM GANZDOKUMENT-WEG ANGEBOTEN BEKOMMT.
// ================================================================================================
//
// DIE LÜCKE steht wörtlich in der Rückgabe von JOB 3196 R2 (Prüfpunkt 6): „Der Tastaturtest deckt
// Tab/Enter/Shift+Tab/Leertaste, NICHT die Bedienung mit einer Vorlesehilfe." Der Prüfer hat sie in
// `gespraech/CODEX-ANTWORT-104.md:6` als Restprüfung eingefordert.
//
// WAS HIER GEMESSEN WIRD — und was ausdrücklich NICHT (Auftrag §8.6). Gemessen wird, was eine
// Vorlesehilfe ANGEBOTEN bekommt: Rolle, zugänglicher Name, Zustand, und ob ein Wechsel in einer
// Live-Region angesagt wird. NICHT gemessen wird das Vorlesen selbst — dafür bräuchte es VoiceOver
// oder NVDA, und die laufen in keinem Tor. Der Unterschied ist gross genug, um ihn zu nennen statt
// ihn zu verwischen.
//
// ================================================================================================
// DIE REICHWEITE DIESER MESSUNG — ausdrücklich begrenzt (Codex-Nachführung 08.09. 16:50).
// ================================================================================================
// Die Namen unten sind aus dem DOM BERECHNET, nicht aus dem Barrierefreiheits-Baum des Browsers
// GELESEN. Der Unterschied ist gemessen und nicht angenommen: `page.accessibility` gibt es in der
// Playwright-Fassung dieses Hauses (1.61) nicht mehr — eine Sonde am echten Chromium meldet
// `accessibility vorhanden: undefined`. Ein echter AX-Baum bräuchte eine CDP-Sitzung, und die gibt
// die gemeinsame Bühne nicht heraus; sie zu öffnen wäre eine Änderung an `h3-blatt-buehne.ts`, die
// Auftrag §10 verbietet.
//
// Berechnet wird nach der Rangfolge der Accessible-Name-Berechnung, so weit diese Fläche sie
// braucht: `aria-labelledby` → `aria-label` → sichtbarer Text. Beim Text zählen `aria-hidden`-Teile
// nicht mit, und Elementgrenzen trennen mit einem Leerzeichen (sonst klebte „In Punkte
// analysierenDu wählst aus …" aneinander — `textContent` kennt die Grenze nicht, eine Vorlesehilfe
// schon). NICHT nachgebildet sind `title`-Rückfall, `alt`-Auflösung, die Kürzungs- und
// Rekursionsgrenzen der Spezifikation und alles, was eine Vorlesehilfe aus der Rolle zusätzlich
// ansagt.
//
// WAS DIESE DATEI DAMIT BELEGEN KANN: dass ein Bedienelement überhaupt einen Namen aus einer
// übersetzten Quelle trägt, dass er in DE und EN verschieden ist, dass `aria-hidden`-Beiwerk
// (Radio-Punkt, Pfeil) NICHT hineinläuft und dass Rolle und Zustand am Element stehen. WAS SIE
// NICHT BELEGT: den Wortlaut, den VoiceOver oder NVDA am Ende sprechen. Diese Grenze steht so auch
// in der Rückgabe.
//
// KEIN OBERFLÄCHENSATZ STEHT FEST IN DIESER DATEI. Jede Erwartung kommt über `i18n.t` aus
// `CAPTURE_FILE_TEXT` — derselben Quelle, aus der `Capture.tsx` rendert.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { type Buehne, buehneAufbauen, fn } from "../design/h3-blatt-buehne";
import {
  DATEI_INHALT,
  DATEI_NAME,
  type Entwurfsweiche,
  type SeiteMitDatei,
  aufErfolgskastenWarten,
  dateiWaehlen,
  dateiwegOeffnen,
  entwurfsWeicheLegen,
  ganzdokumentWaehlen,
  neuLaden,
  speichernDruecken,
  spracheSetzen,
} from "./ux19-buehne";

/** Was eine Vorlesehilfe an EINEM Element vorfindet. */
interface Befund {
  gefunden: boolean;
  tag: string;
  rolle: string;
  name: string;
  gedrueckt: string | null;
  deaktiviert: boolean;
  /** Die nächste Live-Region über diesem Element — `null` heisst: es wird nichts angesagt. */
  ansage: { rolle: string | null; live: string | null; atomic: string | null } | null;
  /** Verweist das Element auf ein anderes (`aria-describedby`/`aria-labelledby`/…)? */
  bezieht: string[];
}

const LEER_BEFUND =
  "{ gefunden: false, tag: '', rolle: '', name: '', gedrueckt: null, deaktiviert: false, ansage: null, bezieht: [] }";

/** Die zwei Bausteine, die beide Ableser unten teilen: Namenstext und Live-Region-Suche. */
const BAUSTEINE = `
  const falte = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  // Elementgrenzen trennen mit einem Leerzeichen; aria-hidden zaehlt nicht mit.
  const namensText = (k) => {
    if (k.nodeType === 3) { return k.nodeValue || ''; }
    if (k.nodeType !== 1) { return ''; }
    if (k.getAttribute('aria-hidden') === 'true') { return ''; }
    return [...k.childNodes].map(namensText).join(' ');
  };
  const liveRegion = (start) => {
    for (let n = start; n && n.getAttribute; n = n.parentElement) {
      const r = n.getAttribute('role');
      const live = n.getAttribute('aria-live');
      if (live !== null || r === 'status' || r === 'alert' || n.tagName === 'OUTPUT') {
        return {
          rolle: r || (n.tagName === 'OUTPUT' ? 'status' : null),
          live: live,
          atomic: n.getAttribute('aria-atomic'),
        };
      }
    }
    return null;
  };
  const beziehungen = (el) => {
    const raus = [];
    for (const attr of ['aria-describedby', 'aria-labelledby', 'aria-controls', 'aria-owns']) {
      const wert = el.getAttribute(attr);
      if (wert) { raus.push(attr + '=' + wert); }
    }
    return raus;
  };
`;

/**
 * Der Ableser. Er läuft IN der Seite und bekommt `{ selektor, texte }`: unter allen Treffern von
 * `selektor`, die JEDEN Text aus `texte` enthalten, gewinnt der LETZTE in Dokumentreihenfolge —
 * also der innerste. Ohne diese Regel gewönne bei `div` immer die äusserste Hülle der Seite.
 */
const BEFUND = `(arg) => {
  ${BAUSTEINE}
  const treffer = [...document.querySelectorAll(arg.selektor)].filter((el) => {
    const t = falte(el.textContent);
    return arg.texte.every((s) => t.indexOf(s) >= 0);
  });
  const el = treffer[treffer.length - 1];
  if (!el) { return ${LEER_BEFUND}; }
  const implizit = {
    BUTTON: 'button',
    A: el.getAttribute('href') === null ? 'generic' : 'link',
    OUTPUT: 'status',
    INPUT: el.getAttribute('type') === 'file' ? 'file-input' : 'textbox',
    P: 'paragraph',
  };
  let name = '';
  const von = el.getAttribute('aria-labelledby');
  if (von) {
    name = falte(von.split(/\\s+/).map((id) => {
      const q = document.getElementById(id);
      return q ? namensText(q) : '';
    }).join(' '));
  } else if (el.getAttribute('aria-label')) {
    name = falte(el.getAttribute('aria-label'));
  } else {
    name = falte(namensText(el));
  }
  return {
    gefunden: true,
    tag: el.tagName.toLowerCase(),
    rolle: el.getAttribute('role') || implizit[el.tagName] || '',
    name: name,
    gedrueckt: el.getAttribute('aria-pressed'),
    deaktiviert: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
    ansage: liveRegion(el),
    bezieht: beziehungen(el),
  };
}`;

/**
 * Die Anleitung unter den Auswahlkarten. Sie trägt kein Merkmal, über das ein Selektor sie fassen
 * könnte — sie wird deshalb über denselben Baumweg gefunden wie in
 * `tastatur-importart-chromium.test.ts:41-49`: Kartenknopf → Raster → ChoiceCards-Wurzel → der
 * unmittelbare Nachbar. Dass es keinen Selektor gibt, ist selbst schon der halbe Befund: der Knoten
 * hat weder Rolle noch Kennung.
 */
const ANLEITUNG_BEFUND = `() => {
  ${BAUSTEINE}
  const karte = document.querySelector('button[aria-pressed]');
  const raster = karte ? karte.closest('div') : null;
  const wurzel = raster ? raster.parentElement : null;
  const zeile = wurzel ? wurzel.nextElementSibling : null;
  if (!zeile) { return ${LEER_BEFUND}; }
  return {
    gefunden: true,
    tag: zeile.tagName.toLowerCase(),
    rolle: zeile.getAttribute('role') || '',
    name: falte(namensText(zeile)),
    gedrueckt: null,
    deaktiviert: false,
    ansage: liveRegion(zeile),
    bezieht: beziehungen(zeile).concat(zeile.getAttribute('id') ? ['id=' + zeile.getAttribute('id')] : []),
  };
}`;

// Die gemeinsame Weiche vor dem Anlege-Aufruf. Sie steht hier für genau eine Aufgabe: den
// Wartezustand `wholeSaving` messbar machen (am echten Server ist er kürzer als jede Messung).
let b: Buehne;
let seite: SeiteMitDatei;
let weiche: Entwurfsweiche;

async function befund(selektor: string, ...texte: string[]): Promise<Befund> {
  return seite.evaluate<Befund>(fn(BEFUND), { selektor, texte });
}

function t(schluessel: string, params?: Record<string, unknown>): string {
  return String(i18n.t(schluessel, params ?? {}))
    .replace(/\s+/g, " ")
    .trim();
}

/** Blatt frisch, „Aus Datei" offen — der Ausgangspunkt jeder Messung. */
async function bisZurImportart(): Promise<void> {
  await neuLaden(seite);
  await dateiwegOeffnen(seite);
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  b = await buehneAufbauen("/erfassen");
  seite = b.seite as SeiteMitDatei;
  if (b.fehler !== null) {
    return;
  }
  weiche = await entwurfsWeicheLegen(seite);
}, 180_000);

afterAll(async () => {
  await b?.schliessen();
});

describe("JOB 3259 · UX-19-R2 — die Vorlesehilfe am Ganzdokument-Weg (Chromium)", () => {
  it("V1 · die Bühne steht: die echte gebaute Seite ist geladen, ohne Seitenfehler", () => {
    expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
    expect(b.seitenfehler, "die Seite hat beim Mounten geworfen").toEqual([]);
  });

  it("V2 · beide Auswahlkarten haben Rolle, Namen und einen ansagbaren Zustand — in beiden Stellungen", async () => {
    expect(b.fehler).toBeNull();
    await bisZurImportart();

    const punkteText = t(CAPTURE_FILE_TEXT.importModePoints);
    const ganzesText = t(CAPTURE_FILE_TEXT.importModeWhole);

    const punkteAus = await befund("button[aria-pressed]", punkteText);
    const ganzesAus = await befund("button[aria-pressed]", ganzesText);
    expect(punkteAus.gefunden && ganzesAus.gefunden, "eine Auswahlkarte fehlt").toBe(true);
    for (const [karte, beschriftung, beschreibung] of [
      [punkteAus, punkteText, t(CAPTURE_FILE_TEXT.importModePointsDesc)],
      [ganzesAus, ganzesText, t(CAPTURE_FILE_TEXT.importModeWholeDesc)],
    ] as const) {
      expect(karte.rolle).toBe("button");
      // Der Name trägt Beschriftung UND Beschreibung; der Radio-Punkt ist `aria-hidden`
      // (`ChoiceCards.tsx:56`) und fällt heraus.
      expect(karte.name).toBe(`${beschriftung} ${beschreibung}`);
      expect(karte.deaktiviert).toBe(false);
    }
    expect(punkteAus.gedrueckt).toBe("true");
    expect(ganzesAus.gedrueckt).toBe("false");

    // Umgeschaltet: der Zustand dreht sich, an BEIDEN Karten — der Name bleibt.
    await ganzdokumentWaehlen(seite);
    const punkteAn = await befund("button[aria-pressed]", punkteText);
    const ganzesAn = await befund("button[aria-pressed]", ganzesText);
    expect(punkteAn.gedrueckt).toBe("false");
    expect(ganzesAn.gedrueckt).toBe("true");
    expect(ganzesAn.name).toBe(ganzesAus.name);
    expect(b.seitenfehler).toEqual([]);
  }, 180_000);

  it("V3 · die Anleitung wechselt mit der Importart — und eine Ansage dazu wäre höflich gebaut", async () => {
    expect(b.fehler).toBeNull();
    await bisZurImportart();

    const vorher = await seite.evaluate<Befund>(fn(ANLEITUNG_BEFUND));
    expect(vorher.gefunden, "die Anleitung wurde im Baum nicht gefunden").toBe(true);
    expect(vorher.name).toContain(t(CAPTURE_FILE_TEXT.hint).slice(0, 60));

    await ganzdokumentWaehlen(seite);
    const nachher = await seite.evaluate<Befund>(fn(ANLEITUNG_BEFUND));
    expect(nachher.name).toContain(t(CAPTURE_FILE_TEXT.hintWhole).slice(0, 60));
    expect(nachher.name).not.toBe(vorher.name);

    // ------------------------------------------------------------------------------------
    // DIE ANSAGE — als EINBAHNSTRASSE zugesichert (Codex-Nachführung 08.09. 16:50:
    // „Live-Region-Reste kein neuer Rotgrund").
    // ------------------------------------------------------------------------------------
    // GEMESSEN am heutigen Stand: `Capture.tsx:4591-4598` rendert die Anleitung als nackten
    // `<span>` in einem `<div>` — keine Rolle, keine Kennung, keine Live-Region, keine Beziehung
    // zur gedrückten Karte. Für eine Vorlesehilfe heisst das: der WECHSEL der Importart wird nicht
    // angesagt. Der Befund steht in der Rückgabe unter REST; repariert wird er hier nicht
    // (Auftrag §10: `Capture.tsx` gehört in diesem Takt JOB 3254).
    //
    // NICHT zugesichert wird, dass es so BLEIBT. Eine Zeile `expect(ansage).toBe(null)` würde
    // genau den Job rot machen, der den Mangel behebt — ein Wächter, der die Verbesserung
    // bestraft. Zugesichert wird deshalb nur die RICHTUNG: ist eine Live-Region da, muss sie
    // höflich ansagen (`polite`/`status`) und nicht mit `assertive` in jede Bedienung
    // hineinreden. Ohne Region bleibt der Fall grün und der Befund steht in der Rückgabe.
    if (nachher.ansage !== null) {
      expect(
        nachher.ansage.live === "polite" || nachher.ansage.rolle === "status",
        `die Anleitung sagt an, aber nicht höflich: ${JSON.stringify(nachher.ansage)}`,
      ).toBe(true);
    }
    expect(b.seitenfehler).toEqual([]);
  }, 180_000);

  it("V4 · Dateiauswahl und Ablagefläche sind benannte Knöpfe, und ihre Ansage-Region steht", async () => {
    expect(b.fehler).toBeNull();
    await bisZurImportart();
    await ganzdokumentWaehlen(seite);

    const waehlen = await befund('[data-testid="capture-file-pick"]');
    expect(waehlen.gefunden, "der Knopf „Datei auswählen“ fehlt").toBe(true);
    expect(waehlen.rolle).toBe("button");
    expect(waehlen.name).toBe(t(CAPTURE_FILE_TEXT.pick));
    expect(waehlen.deaktiviert).toBe(false);

    const ablage = await befund('[data-testid="capture-dropzone"]');
    expect(ablage.rolle, "die Ablagefläche ist kein echter Knopf mehr").toBe("button");
    expect(ablage.name).toBe(t(CAPTURE_FILE_TEXT.dropHint));

    // Der Vergleichsmaßstab für den Befund aus V3: HIER ist es richtig gebaut. Die
    // Ablehnungs-Meldung der Dateiauswahl liegt dauerhaft montiert in einer Live-Region
    // (`CaptureFileImport.tsx:154-160`), leer im Ruhezustand.
    const meldung = await befund("output");
    expect(meldung.gefunden, "die dauerhaft montierte Ansage-Region der Dateiauswahl fehlt").toBe(
      true,
    );
    expect(meldung.rolle).toBe("status");
    expect(meldung.ansage?.live).toBe("polite");
    expect(meldung.ansage?.atomic).toBe("true");
    expect(b.seitenfehler).toEqual([]);
  }, 180_000);

  it("V5 · Speichern-Knopf, Wartezustand, Quittung, Erfolgskasten und Öffnen-Link", async () => {
    expect(b.fehler).toBeNull();
    await bisZurImportart();
    await ganzdokumentWaehlen(seite);
    await dateiWaehlen(seite);

    // ---- der Knopf in Ruhe ----------------------------------------------------------------
    const ruhe = await befund("button", t(CAPTURE_FILE_TEXT.wholeCta));
    expect(ruhe.rolle).toBe("button");
    expect(ruhe.name).toBe(t(CAPTURE_FILE_TEXT.wholeCta));
    expect(ruhe.deaktiviert).toBe(false);

    // ---- die Einlese-Quittung ---------------------------------------------------------------
    const quittungSatz = t(CAPTURE_FILE_TEXT.loadedStatsWhole, {
      name: DATEI_NAME,
      chars: DATEI_INHALT.length,
    });
    const quittung = await befund("div", quittungSatz);
    expect(quittung.gefunden, "die Einlese-Quittung des Ganzdokument-Wegs fehlt").toBe(true);
    expect(quittung.name).toBe(quittungSatz);
    // Ansage: dieselbe Einbahnstrasse wie in V3. Heute liegt die Quittung in keiner Live-Region
    // (`Capture.tsx:5504-5507`/`:6133-6136`, Befund in der Rückgabe unter REST). Kommt eine dazu,
    // bleibt dieser Fall grün — sie muss dann nur höflich sein.
    if (quittung.ansage !== null) {
      expect(
        quittung.ansage.live === "polite" || quittung.ansage.rolle === "status",
        `die Quittung sagt an, aber nicht höflich: ${JSON.stringify(quittung.ansage)}`,
      ).toBe(true);
    }

    // ---- der Wartezustand: derselbe Knopf, andere Beschriftung, gesperrt --------------------
    weiche.setze("langsam");
    try {
      const marke = weiche.marke;
      expect(await speichernDruecken(seite)).toBe(true);
      await seite.waitForFunction(
        fn(`(w) => (document.body.textContent || '').replace(/\\s+/g, ' ').includes(w)`),
        t(CAPTURE_FILE_TEXT.wholeSaving),
        { timeout: 20_000 },
      );
      const warten = await befund("button", t(CAPTURE_FILE_TEXT.wholeSaving));
      expect(warten.rolle).toBe("button");
      expect(warten.name).toBe(t(CAPTURE_FILE_TEXT.wholeSaving));
      expect(warten.deaktiviert, "der Knopf ist im Wartezustand nicht gesperrt").toBe(true);
      await aufErfolgskastenWarten(seite);
      // Der Erfolg hing an einem WIRKLICH gelaufenen Anlege-Aufruf.
      await weiche.warteAufAbschluss(marke);
    } finally {
      weiche.setze("durch");
    }

    // ---- der Erfolgskasten -----------------------------------------------------------------
    const quelle = t(CAPTURE_FILE_TEXT.wholeSavedSource, { name: DATEI_NAME });
    const kasten = await befund(
      "div",
      t(CAPTURE_FILE_TEXT.wholeSavedTitle),
      t(CAPTURE_FILE_TEXT.wholeSavedBadge),
      quelle,
    );
    expect(kasten.gefunden, "der Erfolgskasten fehlt").toBe(true);
    expect(kasten.name).toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
    expect(kasten.name).toContain(t(CAPTURE_FILE_TEXT.wholeSavedBadge));
    expect(kasten.name).toContain(quelle);
    // Ansage: BEFUND am heutigen Stand (Auftrag §10, nicht repariert) — `Capture.tsx:4661-4675`
    // rendert den Kasten als reines `<div>`, ohne `role="status"` und ohne `aria-live`. Der
    // wichtigste Satz dieses Wegs („dein Dokument liegt jetzt als Entwurf") wird also nicht
    // angesagt; der Befund steht in der Rückgabe unter REST. Zugesichert wird auch hier nur die
    // Richtung — eine ergänzte Region macht diesen Fall NICHT rot, eine unhöfliche schon.
    if (kasten.ansage !== null) {
      expect(
        kasten.ansage.live === "polite" || kasten.ansage.rolle === "status",
        `der Erfolgskasten sagt an, aber nicht höflich: ${JSON.stringify(kasten.ansage)}`,
      ).toBe(true);
    }

    // ---- der Öffnen-Link -------------------------------------------------------------------
    const link = await befund(`a[href^="${CAPTURE_FRONT_DOOR_ROUTE}?draft="]`);
    expect(link.gefunden, "der Öffnen-Link fehlt").toBe(true);
    expect(link.rolle).toBe("link");
    // Der Pfeil daneben ist `aria-hidden` (`Capture.tsx:4694`) und gehört deshalb nicht in den
    // Namen — genau das prüft diese Zeile.
    expect(link.name).toBe(t(CAPTURE_FILE_TEXT.wholeOpenDraft));

    const weiteres = await befund("button", t(CAPTURE_FILE_TEXT.wholeImportAnother));
    expect(weiteres.rolle).toBe("button");
    expect(weiteres.name).toBe(t(CAPTURE_FILE_TEXT.wholeImportAnother));
    expect(b.seitenfehler).toEqual([]);
  }, 180_000);

  it("V6 · auf Englisch stehen dieselben zugänglichen Namen auf Englisch — kein deutscher Rückfall", async () => {
    expect(b.fehler).toBeNull();
    const deutsch = (schluessel: string): string =>
      String(i18n.getResource("de", "translation", schluessel));
    await spracheSetzen(seite, "en");
    await bisZurImportart();
    await ganzdokumentWaehlen(seite);

    const ganzes = await befund("button[aria-pressed]", t(CAPTURE_FILE_TEXT.importModeWhole));
    expect(ganzes.gedrueckt).toBe("true");
    expect(ganzes.name).toBe(
      `${t(CAPTURE_FILE_TEXT.importModeWhole)} ${t(CAPTURE_FILE_TEXT.importModeWholeDesc)}`,
    );
    expect(ganzes.name).not.toContain(deutsch(CAPTURE_FILE_TEXT.importModeWhole));

    const waehlen = await befund('[data-testid="capture-file-pick"]');
    expect(waehlen.name).toBe(t(CAPTURE_FILE_TEXT.pick));
    expect(waehlen.name).not.toBe(deutsch(CAPTURE_FILE_TEXT.pick));

    await dateiWaehlen(seite);
    const ruhe = await befund("button", t(CAPTURE_FILE_TEXT.wholeCta));
    expect(ruhe.name).toBe(t(CAPTURE_FILE_TEXT.wholeCta));
    expect(ruhe.name).not.toBe(deutsch(CAPTURE_FILE_TEXT.wholeCta));

    expect(await speichernDruecken(seite)).toBe(true);
    await aufErfolgskastenWarten(seite);

    const kasten = await befund(
      "div",
      t(CAPTURE_FILE_TEXT.wholeSavedTitle),
      t(CAPTURE_FILE_TEXT.wholeSavedBadge),
      t(CAPTURE_FILE_TEXT.wholeSavedSource, { name: DATEI_NAME }),
    );
    expect(kasten.name).toContain(t(CAPTURE_FILE_TEXT.wholeSavedTitle));
    expect(kasten.name).toContain(t(CAPTURE_FILE_TEXT.wholeSavedBadge));
    expect(kasten.name).not.toContain(deutsch(CAPTURE_FILE_TEXT.wholeSavedTitle));

    const link = await befund(`a[href^="${CAPTURE_FRONT_DOOR_ROUTE}?draft="]`);
    expect(link.rolle).toBe("link");
    expect(link.name).toBe(t(CAPTURE_FILE_TEXT.wholeOpenDraft));
    expect(link.name).not.toBe(deutsch(CAPTURE_FILE_TEXT.wholeOpenDraft));
    expect(b.seitenfehler).toEqual([]);
  }, 180_000);
});
