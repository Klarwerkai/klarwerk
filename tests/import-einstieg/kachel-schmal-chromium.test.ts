// ================================================================================================
// JOB 3190 · UX-18 / N-0041 · R4 + R5 + B — SCHMAL GEMESSEN, IM ECHTEN BROWSER.
// ================================================================================================
//
// N-0041 („Bei 390 px verdeckt der Status teilweise den Quellnamen") ist eine GEOMETRISCHE Aussage.
// Sie wird deshalb an der gebauten Anwendung in Chromium gemessen und nicht aus Klassennamen
// erschlossen: `apps/web/dist` (Ergebnis von `./tools/build`) an der echten Fastify-App, angemeldet
// als Admin mit eingeschalteter Stufe 2 — die gemeinsame Messstrecke aus `tests/design/h1-chromium.ts`.
//
// DREI STÜTZSTELLEN, NICHT ZWEI (Lehre aus JOB 3144): 320, 360 und 390 px. Zwei belegen eine
// Bedingung, drei belegen eine stetige Regel. Dazu eine Desktop-Stützstelle (1280 px), die
// festhält, dass sich an der heutigen Darstellung ab `sm` NICHTS ändert.
//
// BEIDE FLÄCHEN, AUF DENEN DAS BAUTEIL ERSCHEINT (Lehre aus JOB 3144: „Miss den neuen Weg auf JEDER
// Fläche, auf der er erscheint"): die Import-Galerie auf `/import` (R4) UND der Dateityp-Picker im
// Erfassen (R5). Der Aufrufer-Rahmen ist dort ein anderer — im Erfassen liegt der Picker im
// Arbeitsraum des Blattes, auf `/import` in einer Karte mit `pl-8` —, und genau deshalb wird er
// gemessen und nicht angenommen.
//
// UND DER WEG SELBST (B1–B4): auf `/import` wird die Word-Kachel mit der TASTATUR erreicht (Tab)
// und mit Enter aktiviert; gemessen wird die Adresse, auf der der Browser danach steht. Hier führt
// die Plattform die Navigation wirklich aus — das ist die Hälfte, die jsdom in
// `weg-ins-erfassen.test.tsx` nicht leisten kann.
//
// RUNDE 2 — WAS DAZUGEKOMMEN IST, UND WARUM (Bens Befunde an Runde 1):
//  · B4 misst den ZIELZUSTAND nach Enter in Bens eigenen drei Zahlen: die Dateiauswahl ist dort
//    noch NICHT offen. Danach läuft der Fall genau die Schritte ab, die die Kachel SICHTBAR ansagt
//    (aus ihr gelesen, nicht im Test getippt) — und erst dann steht `capture-file-pick` da.
//  · Die Wegzeile der Kachel wird mitgemessen: nicht gekürzt, keine Überlappung, im Bild.
//  · R5 läuft jetzt in DE UND EN (vorher nur DE) — andere Sprache, andere Textbreiten.
//  · Die gewählte Sprache wird BELEGT (`document.documentElement.lang`), nicht angenommen.
//  · Desktop mit ZWEI Stützstellen: 640 px (die `sm`-Kante) und 1280 px.
//
// NACHGEFÜHRT DURCH JOB 3341 (UX-18-R1) — ZWEI ERWARTUNGEN, DER REST UNVERÄNDERT:
// Der Weg von der Kachel in die Dateiauswahl ist seit JOB 3341 EINER. Damit sind genau die zwei
// Aussagen dieser Datei unwahr geworden, die die alte Grenze festhielten, und nur sie:
//  · R4 „die Wegzeile steht … wirklich auf der Word-Kachel" → jetzt: KEINE Kachel trägt mehr eine
//    (die Ansage ist ersatzlos entfallen, weil es nichts mehr anzusagen gibt).
//  · B4 „nach Enter fehlt die Dateiauswahl noch" → jetzt: sie steht nach Enter da, in denselben drei
//    Zahlen gemessen. Der alte Menüweg wird im selben Fall weiter abgelaufen — er ist NICHT abgelöst.
// Die Geometrie (R4/R5/D1, 320/360/390/640/1280, DE und EN), der Tab-Lauf (B1) und der
// Browser-Rückweg (B2/B3) sind unberührt. Die Wegzeilen-Messung in `MESSEN`/`pruefeSchmal` bleibt
// stehen: sie ist ab jetzt der Wächter, dass keine wieder auftaucht.
//
// AUSGANGSMESSUNG (07.09.2026, mit der alten Kachel: eine Zeile, `truncate`, `grid-cols-2`) —
// alle NEUN schmalen Fälle rot, wörtlich unter anderem:
//     /import 320/de · docx: Name und Zustand überlappen: expected true to be false
//     /import 320/de · docx: Name gekürzt (77 > 0): expected 77 to be less than or equal to 1
//     /import 320/de · word-sys: Name gekürzt (69 > 13)
//     /erfassen 320/de · avtranscript: Name gekürzt (147 > 122)
// Die Überlappung bei 320 px ist N-0041 in Zahlen. Mit der neuen Kachel sind alle vierzehn Fälle
// grün.
//
// EINE Browserinstanz für alle Fälle (Vorlage JOB 3121/3144); die Messungen werden gecacht.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { ORIGIN, type Seite, type Strecke, fn, strecke } from "../design/h1-chromium";

type Sprache = "de" | "en";
type Flaeche = "import" | "erfassen";

interface Rechteck {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
}
interface Kachelmass {
  id: string;
  zustand: string;
  name: Rechteck;
  /** Die natürliche Breite des Namens gegen die dargestellte — ungleich heisst: gekürzt. */
  nameNatuerlich: number;
  nameDargestellt: number;
  badge: Rechteck;
  /**
   * RUNDE 2: die sichtbare Wegzeile der Kachel. `null` bei jeder Kachel, deren Weg keine
   * Restschritte kostet — die trägt keine.
   * JOB 3341: das ist seither JEDE Kachel; die Messung bleibt als Wächter, dass es so bleibt.
   */
  schritte: (Rechteck & { natuerlich: number; dargestellt: number; text: string }) | null;
}
interface Messung {
  fenster: number;
  sprache: string;
  kacheln: Kachelmass[];
  ueberlauf: number;
}

let stand: Strecke | undefined;
const messungen = new Map<string, Messung>();

/** In der Seite: Namen- und Badge-Geometrie jeder sichtbaren Dateikachel. */
const MESSEN = `() => {
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
  };
  const kacheln = [...document.querySelectorAll('[data-id]')]
    .filter((el) => el.querySelector('[data-tile-name]'))
    .map((el) => {
      const name = el.querySelector('[data-tile-name]');
      const badge = el.querySelector('[data-tile-badge]');
      const schritte = el.querySelector('[data-tile-steps]');
      if (!name || !badge) { throw new Error('Kachel ohne Name/Badge: ' + el.getAttribute('data-id')); }
      return {
        id: el.getAttribute('data-id'),
        zustand: el.getAttribute('data-state'),
        name: rect(name),
        nameNatuerlich: name.scrollWidth,
        nameDargestellt: name.clientWidth,
        badge: rect(badge),
        schritte: schritte
          ? Object.assign(rect(schritte), {
              natuerlich: schritte.scrollWidth,
              dargestellt: schritte.clientWidth,
              text: (schritte.textContent || '').trim(),
            })
          : null,
      };
    });
  return {
    fenster: innerWidth,
    sprache: document.documentElement.lang,
    kacheln,
    ueberlauf: document.documentElement.scrollWidth - innerWidth,
  };
}`;

const RUHE =
  "() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))";

/** Die zuletzt in der Seite hinterlegte Produktsprache — sie überlebt jeden Seitenwechsel. */
let gesetzteSprache: Sprache | null = null;

async function oeffneFlaeche(seite: Seite, flaeche: Flaeche, sprache: Sprache): Promise<void> {
  const pfad = flaeche === "import" ? "/import" : "/erfassen";
  if (gesetzteSprache !== sprache) {
    // `localStorage` gehört zur HERKUNFT: auf `about:blank` wirft der Zugriff. Also erst die Seite
    // laden, dann die Sprache hinterlegen — der Ladelauf unten liest sie beim Start.
    await seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
    await seite.evaluate(fn('(s) => localStorage.setItem("kw.sprache", s)'), sprache);
    gesetzteSprache = sprache;
  }
  // Echter Neuaufbau der Seite — die gewählte Produktsprache wird beim Start gelesen.
  await seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
  if (flaeche === "import") {
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('#import-source-gallery [data-tile-name]')`),
      undefined,
      { timeout: 30_000 },
    );
    return;
  }
  // Erfassen: das Blatt steht, der Dateiimport liegt hinter „Datei ▾ → Datei importieren".
  await seite.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="blatt-werkzeug-datei"]')`),
    undefined,
    { timeout: 30_000 },
  );
  await seite.evaluate(
    fn(`() => document.querySelector('[data-testid="blatt-werkzeug-datei"]').click()`),
  );
  await seite.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="blatt-menue-datei"] [role="menuitem"]')`),
    undefined,
    { timeout: 30_000 },
  );
  await seite.evaluate(
    fn(`(wort) => {
      const eintrag = [...document.querySelectorAll('[data-testid="blatt-menue-datei"] [role="menuitem"]')]
        .find((el) => (el.textContent || '').trim() === wort);
      if (!eintrag) { throw new Error('Menüeintrag fehlt: ' + wort); }
      eintrag.click();
    }`),
    String(i18n.getFixedT(sprache)("erfassen.weg.datei")),
  );
  await seite.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="capture-file-pick"]')`),
    undefined,
    { timeout: 30_000 },
  );
}

async function messen(breite: number, sprache: Sprache, flaeche: Flaeche): Promise<Messung> {
  const key = `${flaeche}/${breite}/${sprache}`;
  const vorhanden = messungen.get(key);
  if (vorhanden) {
    return vorhanden;
  }
  if (!stand) {
    throw new Error("Chromium-Prüfstand fehlt");
  }
  const { seite } = stand;
  await seite.setViewportSize({ width: breite, height: breite < 640 ? 720 : 900 });
  await oeffneFlaeche(seite, flaeche, sprache);
  await seite.evaluate(fn(RUHE));
  const m = await seite.evaluate<Messung>(fn(MESSEN));
  console.info(`JOB 3190 · ${key}: ${JSON.stringify(m)}`);
  expect(m.fenster, key).toBe(breite);
  // RUNDE 2 (Bens Prüflücke): die gewählte Sprache wird BELEGT, nicht angenommen — eine Messung in
  // der falschen Sprache wäre eine Messung an der falschen Textbreite.
  expect(m.sprache, `${key}: die Sprachwahl griff nicht`).toBe(sprache);
  expect(m.kacheln.length, `${key}: keine Dateikachel gemessen`).toBeGreaterThanOrEqual(4);
  messungen.set(key, m);
  return m;
}

/** Überschneiden sich zwei Rechtecke wirklich (beide Achsen)? */
function ueberlappt(a: Rechteck, b: Rechteck): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function pruefeSchmal(m: Messung, breite: number, key: string): void {
  for (const kachel of m.kacheln) {
    expect
      .soft(
        ueberlappt(kachel.name, kachel.badge),
        `${key} · ${kachel.id}: Name und Zustand überlappen`,
      )
      .toBe(false);
    // Nicht gekürzt: die natürliche Breite passt in die dargestellte (1 px Rundungsspielraum).
    expect
      .soft(
        kachel.nameNatuerlich,
        `${key} · ${kachel.id}: Name gekürzt (${kachel.nameNatuerlich} > ${kachel.nameDargestellt})`,
      )
      .toBeLessThanOrEqual(kachel.nameDargestellt + 1);
    // Und beides steht vollständig im Bild.
    expect
      .soft(kachel.name.left, `${key} · ${kachel.id}: Name links aus dem Bild`)
      .toBeGreaterThanOrEqual(0);
    expect
      .soft(kachel.name.right, `${key} · ${kachel.id}: Name rechts aus dem Bild`)
      .toBeLessThanOrEqual(breite);
    expect
      .soft(kachel.badge.right, `${key} · ${kachel.id}: Badge rechts aus dem Bild`)
      .toBeLessThanOrEqual(breite);
    // RUNDE 2: die Wegzeile ist Teil der Aussage — eine halbe Wegbeschreibung wäre keine. Sie darf
    // weder kürzen noch mit Name/Badge kollidieren noch aus dem Bild laufen.
    const schritte = kachel.schritte;
    if (schritte) {
      expect
        .soft(
          schritte.natuerlich,
          `${key} · ${kachel.id}: Wegzeile gekürzt (${schritte.natuerlich} > ${schritte.dargestellt}): „${schritte.text}“`,
        )
        .toBeLessThanOrEqual(schritte.dargestellt + 1);
      expect
        .soft(
          ueberlappt(schritte, kachel.name) || ueberlappt(schritte, kachel.badge),
          `${key} · ${kachel.id}: Wegzeile überlappt Name oder Zustand`,
        )
        .toBe(false);
      expect
        .soft(schritte.left, `${key} · ${kachel.id}: Wegzeile links aus dem Bild`)
        .toBeGreaterThanOrEqual(0);
      expect
        .soft(schritte.right, `${key} · ${kachel.id}: Wegzeile rechts aus dem Bild`)
        .toBeLessThanOrEqual(breite);
    }
  }
  expect(m.ueberlauf, `${key}: waagerechter Seitenüberlauf`).toBeLessThanOrEqual(0);
}

describe("JOB 3190 · die Dateikachel bei 320/360/390 px", () => {
  beforeAll(async () => {
    stand = await strecke({
      email: "pedi@job3190-chromium.test",
      stufe2: true,
      viewport: { width: 320, height: 720 },
    });
  }, 180_000);
  afterAll(async () => {
    await stand?.schliessen();
  }, 60_000);

  // ---- R4: die Import-Galerie ------------------------------------------------------------------
  for (const breite of [320, 360, 390]) {
    for (const sprache of ["de", "en"] as const) {
      it(`R4 · /import ${breite} ${sprache.toUpperCase()}: Name und Zustand getrennt lesbar`, async () => {
        const m = await messen(breite, sprache, "import");
        pruefeSchmal(m, breite, `/import ${breite}/${sprache}`);
      });
    }
  }

  it("R4 · die gemessene Menge enthält die Kacheln, um die es geht", async () => {
    const m = await messen(320, "de", "import");
    const ids = m.kacheln.map((k) => k.id);
    expect(ids, ids.join(",")).toContain("docx");
    expect(ids).toContain("pdf");
    // Lieferpunkt 5: „nicht konfiguriert" steht AUSSERHALB des Aufklappers und ist damit mitgemessen
    // — und es ist der längste Name der Galerie, also der harte Fall.
    expect(ids, "„nicht konfiguriert“ muss bei 320 px sichtbar sein").toContain("avtranscript");
    expect(m.kacheln.find((k) => k.id === "avtranscript")?.zustand).toBe("unconfigured");
    expect(m.kacheln.find((k) => k.id === "docx")?.zustand).toBe("elsewhere");
  });

  // ==============================================================================================
  // R4 · NACHGEFÜHRT DURCH JOB 3341 (UX-18-R1) — DIE WEGZEILE IST WEG, WEIL DER WEG WEG IST.
  // ==============================================================================================
  //
  // BIS JOB 3341 stand hier das Gegenteil, und es war damals wahr: die Word-Kachel MUSSTE bei 320 px
  // in DE und EN „Datei → Datei importieren" tragen, weil genau diese zwei Schritte nach dem Klick
  // noch zu gehen waren. JOB 3190 Runde 2 hat den Fall selbst mit dem Vorbehalt versehen, dass er
  // fällt, sobald der Weg einer wird.
  //
  // SEIT JOB 3341 ist er einer (`einschritt-chromium.test.ts`, E1–E3): die Kachel führt über
  // `/erfassen?weg=datei` direkt in die Dateiauswahl. Eine Wegzeile wäre ab hier keine Hilfe mehr,
  // sondern eine unwahre Wegbeschreibung neben einem funktionierenden Weg. Die GEOMETRISCHE Aussage
  // von R4 (Name und Zustand getrennt lesbar, nichts gekürzt, nichts überlappt, bei 320/360/390 in
  // beiden Sprachen) ist unberührt und wird von `pruefeSchmal` weiter über alle Kacheln gefahren;
  // dass diese Messung eine Wegzeile MITMESSEN würde, wenn eine da wäre, steht dort unverändert.
  it("R4 · bei 320 px trägt in DE UND EN keine Kachel mehr eine Wegzeile (JOB 3341)", async () => {
    for (const sprache of ["de", "en"] as const) {
      const m = await messen(320, sprache, "import");
      const word = m.kacheln.find((k) => k.id === "docx");
      // Die Kachel ist da und weiterhin `elsewhere` — „gibt es, dort drüben" gilt unverändert.
      expect(word?.zustand, `320/${sprache}: die Word-Kachel fehlt`).toBe("elsewhere");
      const alt = `${i18n.getFixedT(sprache)("erfassen.werkzeug.datei")} → ${i18n.getFixedT(sprache)("erfassen.weg.datei")}`;
      expect(
        word?.schritte?.text ?? null,
        `320/${sprache}: die Kachel sagt noch „${alt}“ an — der Weg ist aber einer`,
      ).toBeNull();
      // Und keine ANDERE trägt eine: gemessen über die ganze gemessene Menge, nicht über die eine.
      const mitZeile = m.kacheln.filter((k) => k.schritte !== null).map((k) => k.id);
      expect(mitZeile, `320/${sprache}: Kacheln mit Wegzeile: ${mitZeile.join(",")}`).toEqual([]);
    }
  });

  // ---- R5: dieselbe Messung auf der ZWEITEN Fläche ---------------------------------------------
  // RUNDE 2 (Bens Prüflücke): jetzt in BEIDEN Sprachen, wie auf `/import`. Die englischen Namen
  // sind andere Textbreiten — „Audio/video transcript" gegen „Audio-/Video-Transkript" —, und
  // genau daran hängt die Aussage.
  for (const breite of [320, 360, 390]) {
    for (const sprache of ["de", "en"] as const) {
      it(`R5 · /erfassen ${breite} ${sprache.toUpperCase()}: derselbe Picker, anderer Rahmen, dieselbe Zusage`, async () => {
        const m = await messen(breite, sprache, "erfassen");
        pruefeSchmal(m, breite, `/erfassen ${breite}/${sprache}`);
      });
    }
  }

  it("R5 · der Erfassen-Rahmen ist wirklich ein anderer — dort sind Word/PDF aktiv", async () => {
    const m = await messen(320, "de", "erfassen");
    expect(m.kacheln.find((k) => k.id === "docx")?.zustand).toBe("active");
    expect(m.kacheln.find((k) => k.id === "pdf")?.zustand).toBe("active");
  });

  // ---- Desktop: die heutige Darstellung bleibt --------------------------------------------------
  // ZWEI Stützstellen (Bens Prüflücke): 640 px ist die `sm`-Kante selbst — dort muss die Regel
  // schon gelten —, 1280 px die weite Fläche. Eine einzige Stützstelle belegte nur einen Punkt.
  for (const breite of [640, 1280]) {
    it(`D1 · ${breite} px: Name und Badge stehen weiterhin in EINER Zeile (unverändert)`, async () => {
      const m = await messen(breite, "de", "import");
      for (const kachel of m.kacheln) {
        // Eine Zeile heisst: die Höhenbereiche von Name und Badge überschneiden sich senkrecht.
        expect
          .soft(
            kachel.name.top < kachel.badge.bottom && kachel.badge.top < kachel.name.bottom,
            `${breite} · ${kachel.id}: Badge steht am Desktop nicht mehr in der Namenszeile`,
          )
          .toBe(true);
        // Und das Badge liegt rechts vom Namen, wie bisher.
        expect
          .soft(kachel.badge.left, `${breite} · ${kachel.id}`)
          .toBeGreaterThanOrEqual(kachel.name.right - 1);
        // Die Wegzeile steht UNTER dieser Zeile, sie drängt sich nicht hinein.
        if (kachel.schritte) {
          expect
            .soft(
              kachel.schritte.top,
              `${breite} · ${kachel.id}: Wegzeile steht nicht unter der Namenszeile`,
            )
            .toBeGreaterThanOrEqual(kachel.name.bottom - 1);
        }
      }
      expect(m.ueberlauf, `${breite}: waagerechter Seitenüberlauf`).toBeLessThanOrEqual(0);
    });
  }

  // ---- B: der Weg mit der Tastatur, im echten Browser --------------------------------------------
  it("B1 · /import: die Word-Kachel ist mit der Tabulatortaste erreichbar", async () => {
    if (!stand) {
      throw new Error("Chromium-Prüfstand fehlt");
    }
    const { seite } = stand;
    await seite.setViewportSize({ width: 390, height: 720 });
    await oeffneFlaeche(seite, "import", "de");
    await seite.evaluate(fn("() => document.body.focus()"));
    let erreicht = false;
    for (let i = 0; i < 80 && !erreicht; i++) {
      await seite.keyboard.press("Tab");
      erreicht = await seite.evaluate<boolean>(
        fn(`() => document.activeElement?.getAttribute('data-id') === 'docx'`),
      );
    }
    expect(erreicht, "die Word-Kachel liegt nicht im Tab-Lauf der Seite").toBe(true);
  });

  it("B2/B3 · Enter darauf landet auf der Erfassen-Fläche, und der Rückweg führt zurück", async () => {
    if (!stand) {
      throw new Error("Chromium-Prüfstand fehlt");
    }
    const { seite } = stand;
    await seite.setViewportSize({ width: 390, height: 720 });
    await oeffneFlaeche(seite, "import", "de");
    await seite.evaluate(fn(`() => document.querySelector('[data-id="docx"]').focus()`));
    await seite.keyboard.press("Enter");
    // Gemessen wird die Fläche, auf der der Browser danach steht — nicht ein href.
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="blatt-werkzeug-datei"]')`),
      undefined,
      { timeout: 30_000 },
    );
    expect(new URL(seite.url()).pathname).toBe("/erfassen");
    expect(
      await seite.evaluate<boolean>(fn(`() => !!document.querySelector('#import-source-gallery')`)),
    ).toBe(false);
    // B3: der Rückweg ist der Browser-Rückweg — ohne eigenen Knopf, ohne Sonderweg.
    await seite.evaluate(fn("() => history.back()"));
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('#import-source-gallery')`),
      undefined,
      { timeout: 30_000 },
    );
    expect(new URL(seite.url()).pathname).toBe("/import");
  });

  // ==============================================================================================
  // B4 · NACHGEFÜHRT DURCH JOB 3341 (UX-18-R1) — DIESELBEN DREI ZAHLEN, DIE ERSTE STEHT JETZT AUF
  // `true`.
  // ==============================================================================================
  //
  // BENS BEFUND an JOB 3190 Runde 1, im echten Browser nach Tab+Enter:
  //     BEN ZIELZUSTAND {"dateiauswahl":false,"dateieingang":true,"dateiwerkzeug":true}
  // Runde 2 dieses Tests schrieb diese Grenze fest und lief danach die zwei Schritte ab, die die
  // Kachel SICHTBAR ansagte. JOB 3341 hebt die Grenze auf: die Kachel führt über
  // `/erfassen?weg=datei` in EINEM Schritt in die Dateiauswahl, und die Ansage ist damit ersatzlos
  // entfallen (R4 oben). Der Fall misst deshalb DIESELBE Sonde weiter — sie ist der ganze Beleg —,
  // erwartet aber jetzt `dateiauswahl: true` nach Enter, ohne einen weiteren Griff.
  //
  // WEGGEWORFEN WIRD NICHTS: der Tastaturbeleg (Enter auf der fokussierten Kachel) bleibt, die
  // Breite 390 px bleibt, die `accept`-Prüfung des Eingangs bleibt — und der ALTE Menüweg
  // („Datei ▾" → „Datei importieren") wird weiter abgelaufen, nur an seiner richtigen Stelle: nach
  // „Abbrechen", vom Blatt aus. Auftrag §7 löst ausdrücklich nur die BEHAUPTUNG ab, er sei der
  // einzige — nicht den Weg. Seine zwei Wörter kommen jetzt aus i18n statt von der Kachel; das ist
  // dieselbe Quelle, aus der die Fläche sie rendert, und nicht ein im Test getippter Wortlaut.
  it("B4 · nach Enter steht die Dateiauswahl da (ein Schritt) — der Menüweg trägt daneben weiter", async () => {
    if (!stand) {
      throw new Error("Chromium-Prüfstand fehlt");
    }
    const { seite } = stand;
    const de = i18n.getFixedT("de");
    await seite.setViewportSize({ width: 390, height: 720 });
    await oeffneFlaeche(seite, "import", "de");
    // Die Kachel sagt nichts mehr an — der Beleg dafür steht hier, an der Stelle, an der der Test
    // die Ansage früher GELESEN hat.
    expect(
      await seite.evaluate<number>(
        fn(`() => document.querySelectorAll('[data-id="docx"] [data-tile-steps]').length`),
      ),
      "die Word-Kachel trägt noch eine Wegzeile",
    ).toBe(0);

    await seite.evaluate(fn(`() => document.querySelector('[data-id="docx"]').focus()`));
    await seite.keyboard.press("Enter");
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="blatt-werkzeug-datei"]')`),
      undefined,
      { timeout: 30_000 },
    );
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="capture-file-pick"]')`),
      undefined,
      { timeout: 30_000 },
    );
    // DIE AUFGEHOBENE GRENZE, in Bens eigenen drei Zahlen.
    const zielzustand = await seite.evaluate<Record<string, boolean>>(
      fn(`() => ({
        dateiauswahl: !!document.querySelector('[data-testid="capture-file-pick"]'),
        dateieingang: !!document.querySelector('input[type="file"]'),
        dateiwerkzeug: !!document.querySelector('[data-testid="blatt-werkzeug-datei"]'),
      })`),
    );
    console.info(`JOB 3190/3341 · B4 ZIELZUSTAND nach Enter: ${JSON.stringify(zielzustand)}`);
    expect(zielzustand.dateiwerkzeug, "das Dateiwerkzeug fehlt").toBe(true);
    expect(zielzustand.dateieingang, "der Dateieingang fehlt").toBe(true);
    expect(
      zielzustand.dateiauswahl,
      "Bens Zahl steht immer noch auf false — der eine Schritt ist keiner",
    ).toBe(true);
    // Und der Eingang trägt wirklich die Formate, um die es auf der Kachel ging.
    const accept = await seite.evaluate<string>(
      fn(`() => document.querySelector('input[type="file"]')?.getAttribute('accept') || ''`),
    );
    expect(accept).toContain(".docx");
    expect(accept).toContain(".pdf");

    // DER ALTE MENÜWEG IST NICHT ABGELÖST. Zurück aufs Blatt, dann dieselben zwei Griffe wie bisher
    // — über die SICHTBAREN Wörter der Fläche gefunden, so wie ein Mensch sie fände.
    await seite.evaluate(
      fn(`(wort) => {
        const knopf = [...document.querySelectorAll('button')]
          .find((el) => (el.textContent || '').trim() === wort);
        if (!knopf) { throw new Error('kein Knopf „' + wort + '“ im Dateiimport'); }
        knopf.click();
      }`),
      String(de("capture.file.cancel")),
    );
    await seite.waitForFunction(
      fn(`() => !document.querySelector('[data-testid="capture-file-pick"]')`),
      undefined,
      { timeout: 30_000 },
    );
    await seite.evaluate(
      fn(`(wort) => {
        const knopf = [...document.querySelectorAll('[data-testid="blatt-werkzeugzeile"] button')]
          .find((el) => (el.textContent || '').trim() === wort);
        if (!knopf) { throw new Error('kein Werkzeug „' + wort + '“ auf dem Blatt'); }
        knopf.click();
      }`),
      String(de("erfassen.werkzeug.datei")),
    );
    await seite.evaluate(
      fn(`(wort) => {
        const eintrag = [...document.querySelectorAll('[role="menuitem"]')]
          .find((el) => (el.textContent || '').trim() === wort);
        if (!eintrag) { throw new Error('kein Menüeintrag „' + wort + '“'); }
        eintrag.click();
      }`),
      String(de("erfassen.weg.datei")),
    );
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="capture-file-pick"]')`),
      undefined,
      { timeout: 30_000 },
    );
  });
});
