// ================================================================================================
// JOB 3341 · UX-18-R1 — DER EINE SCHRITT, IM ECHTEN BROWSER GEGANGEN.
// ================================================================================================
//
// DIE AUSGANGSMESSUNG, die diesen Auftrag ausgelöst hat (Ben, Chromium, JOB 3190 Runde 1): nach
// Tab+Enter auf der Word-Kachel von `/import` stand der Browser auf `/erfassen`, aber
//
//     BEN ZIELZUSTAND {"dateiauswahl":false,"dateieingang":true,"dateiwerkzeug":true}
//
// — der Dateiimport lag hinter „Datei" → „Datei importieren". Diese Datei fährt GENAU dieselbe
// Sonde und erwartet jetzt `dateiauswahl: true`, nach EINEM Klick und nach EINEM Enter.
//
// WARUM IM ECHTEN BROWSER UND NICHT NUR GEMOUNTET: die Hälfte, die jsdom nicht leisten kann, ist
// genau die, um die es geht — die Plattform folgt dem Link (Maus, Tab/Enter), sie legt den
// Verlaufseintrag an, sie zeichnet den Fokusring, und sie hat ein Layout, an dem sich bei 320 px
// etwas überlappen kann. Die Zielseite selbst (Adressbereinigung, Abbruch, unbekannter Wert) wird
// schnell und ohne Browser in `einschritt-mounted.test.tsx` gemessen; hier steht nur, was einen
// Browser braucht.
//
// RUNDE 2 (Codex fc454b48): dazu E7 — nennt die Adresse ZUGLEICH einen Entwurf, den es nicht gibt,
// überdeckt der Arbeitsraum dessen Ladefehler nicht, sondern wartet. §9 des Auftrags.
//
// KEINE NEUE STARTSTELLE FÜR PLAYWRIGHT: diese Datei reitet auf dem geteilten Prüfstand
// `tests/design/h1-chromium.ts` (wie `kachel-schmal-chromium.test.ts` im selben Ordner). Die
// Browser-Gruppe des Tors berechnet sich über den Importgraphen und nimmt sie damit von selbst auf;
// die gepinnte Zahl der Startdateien in `tests/tor-inventar/tor-bestand-vollstaendig.test.ts` (B4)
// bleibt unberührt. EINE Browserinstanz für alle Fälle.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BLATT_WEG_PARAMETER } from "../../apps/web/src/components/erfassen/wege";
import i18n from "../../apps/web/src/i18n";
import { ORIGIN, type Seite, type Strecke, fn, strecke } from "../design/h1-chromium";

const KACHEL = '[data-id="docx"]';
const AUSWAHL = '[data-testid="capture-file-pick"]';
const ARBEITSRAUM = '[data-testid="blatt-arbeitsraum"]';

/** Bens drei Zahlen, unverändert — plus die Fläche, die den Arbeitsraum trägt. */
const ZIELZUSTAND = `() => ({
  dateiauswahl: !!document.querySelector('[data-testid="capture-file-pick"]'),
  dateieingang: !!document.querySelector('input[type="file"]'),
  dateiwerkzeug: !!document.querySelector('[data-testid="blatt-werkzeug-datei"]'),
  arbeitsraum: !!document.querySelector('[data-testid="blatt-arbeitsraum"]'),
})`;

interface Zielzustand {
  dateiauswahl: boolean;
  dateieingang: boolean;
  dateiwerkzeug: boolean;
  arbeitsraum: boolean;
}

/** Was am fokussierten Knoten wirklich gezeichnet wird — Ring oder Umriss, nicht „ist fokussiert". */
const FOKUS = `() => {
  const el = document.activeElement;
  if (!el || el === document.body) { return null; }
  const s = getComputedStyle(el);
  return {
    id: el.getAttribute('data-id'),
    testid: el.getAttribute('data-testid'),
    outlineStyle: s.outlineStyle,
    outlineWidth: s.outlineWidth,
    boxShadow: s.boxShadow,
  };
}`;

interface Fokusmass {
  id: string | null;
  testid: string | null;
  outlineStyle: string;
  outlineWidth: string;
  boxShadow: string;
}

/** Trägt der fokussierte Knoten eine SICHTBARE Anzeige — Umriss mit Breite oder ein Ring? */
function fokusSichtbar(f: Fokusmass | null): boolean {
  if (f === null) {
    return false;
  }
  const umriss = f.outlineStyle !== "none" && Number.parseFloat(f.outlineWidth) > 0;
  return umriss || (f.boxShadow !== "none" && f.boxShadow.trim().length > 0);
}

let stand: Strecke | undefined;

function pruefstand(): Strecke {
  if (!stand) {
    throw new Error("Chromium-Prüfstand fehlt");
  }
  return stand;
}

/** `/import` frisch laden und warten, bis die Galerie wirklich steht. */
async function importOeffnen(seite: Seite, breite: number): Promise<void> {
  await seite.setViewportSize({ width: breite, height: breite < 640 ? 720 : 800 });
  await seite.goto(`${ORIGIN}/import`, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(
    fn(`() => !!document.querySelector('#import-source-gallery [data-id="docx"]')`),
    undefined,
    { timeout: 30_000 },
  );
}

/** Warten, bis die Dateiauswahl da ist — und den Zielzustand in Bens Zahlen zurückgeben. */
async function warteAufAuswahl(seite: Seite, was: string): Promise<Zielzustand> {
  await seite.waitForFunction(fn(`() => !!document.querySelector('${AUSWAHL}')`), undefined, {
    timeout: 30_000,
  });
  const z = await seite.evaluate<Zielzustand>(fn(ZIELZUSTAND));
  console.info(`JOB 3341 · ${was} ZIELZUSTAND: ${JSON.stringify(z)}`);
  return z;
}

describe("JOB 3341 · UX-18-R1 — von der Word-Kachel in EINEM Schritt in die Dateiauswahl", () => {
  beforeAll(async () => {
    stand = await strecke({
      email: "pedi@job3341-chromium.test",
      stufe2: true,
      viewport: { width: 1280, height: 800 },
    });
  }, 180_000);
  afterAll(async () => {
    await stand?.schliessen();
  }, 60_000);

  it("E1 · Maus, Desktop: ein Klick, und die Dateiauswahl steht da", async () => {
    const { seite } = pruefstand();
    await importOeffnen(seite, 1280);
    // Ein echter Mausklick der Plattform — kein `el.click()` im Seitenkontext, das die
    // Navigationsentscheidung des Browsers überspränge.
    await seite.click(KACHEL);
    const z = await warteAufAuswahl(seite, "E1");
    expect(
      z.dateiauswahl,
      "Bens Zahl steht immer noch auf false — der eine Schritt ist keiner",
    ).toBe(true);
    expect(z.dateieingang).toBe(true);
    expect(z.dateiwerkzeug).toBe(true);
    expect(new URL(seite.url()).pathname).toBe("/erfassen");
    // Die Import-Fläche ist wirklich verlassen, nicht nur überdeckt.
    expect(
      await seite.evaluate<boolean>(fn("() => !!document.querySelector('#import-source-gallery')")),
    ).toBe(false);
    // Und der Eingang trägt die Formate, um die es auf der Kachel ging.
    const accept = await seite.evaluate<string>(
      fn(`() => document.querySelector('input[type="file"]')?.getAttribute('accept') || ''`),
    );
    expect(accept).toContain(".docx");
    expect(accept).toContain(".pdf");
  });

  it("E1b · der Fokus liegt am Ziel im Arbeitsraum und ist sichtbar", async () => {
    // Lieferung 7: ein Weg, der eine neue Fläche aufmacht, lässt den Fokus sonst auf `body` — wer
    // mit der Tastatur kam, müsste die halbe Seite noch einmal durchtabben.
    const { seite } = pruefstand();
    await importOeffnen(seite, 1280);
    await seite.click(KACHEL);
    await warteAufAuswahl(seite, "E1b");
    const f = await seite.evaluate<Fokusmass | null>(fn(FOKUS));
    console.info(`JOB 3341 · E1b FOKUS: ${JSON.stringify(f)}`);
    expect(f?.testid, "der Fokus ist nicht im geöffneten Arbeitsraum gelandet").toBe(
      "blatt-arbeitsraum",
    );
    expect(fokusSichtbar(f), `keine sichtbare Fokusanzeige: ${JSON.stringify(f)}`).toBe(true);
    // KEIN Betriebssystemfenster: geöffnet wird die Arbeitsraum-FLÄCHE, nicht der Dateidialog —
    // der Fokus liegt deshalb ausdrücklich NICHT auf dem versteckten Dateieingang.
    expect(
      await seite.evaluate<string | null>(
        fn("() => document.activeElement?.getAttribute('type') ?? null"),
      ),
    ).not.toBe("file");
  });

  it("E2 · Tastatur: Tab bis zur Kachel, Enter — dasselbe Ergebnis", async () => {
    const { seite } = pruefstand();
    await importOeffnen(seite, 1280);
    await seite.evaluate(fn("() => document.body.focus()"));
    let erreicht = false;
    for (let i = 0; i < 120 && !erreicht; i++) {
      await seite.keyboard.press("Tab");
      erreicht = await seite.evaluate<boolean>(
        fn(`() => document.activeElement?.getAttribute('data-id') === 'docx'`),
      );
    }
    expect(erreicht, "die Word-Kachel liegt nicht im Tab-Lauf der Seite").toBe(true);
    // Der fokussierte Knoten sagt es auch sichtbar — sonst wäre der Tab-Lauf blind.
    const f = await seite.evaluate<Fokusmass | null>(fn(FOKUS));
    console.info(`JOB 3341 · E2 FOKUS auf der Kachel: ${JSON.stringify(f)}`);
    expect(f?.id).toBe("docx");
    expect(fokusSichtbar(f), `keine sichtbare Fokusanzeige: ${JSON.stringify(f)}`).toBe(true);

    await seite.keyboard.press("Enter");
    const z = await warteAufAuswahl(seite, "E2");
    expect(z.dateiauswahl).toBe(true);
    expect(new URL(seite.url()).pathname).toBe("/erfassen");
  });

  // DREI STÜTZSTELLEN, NICHT ZWEI (Lehre aus JOB 3144): zwei belegen eine Bedingung, drei eine Regel.
  for (const breite of [320, 360, 390]) {
    it(`E3 · ${breite} px: derselbe eine Schritt, nichts überlappt, nichts läuft über`, async () => {
      const { seite } = pruefstand();
      await importOeffnen(seite, breite);
      // Die Kachel ist bei dieser Breite wirklich erreichbar: sie steht im Bild, nicht dahinter.
      const lage = await seite.evaluate<{ links: number; rechts: number; ueberlauf: number }>(
        fn(`() => {
          const r = document.querySelector('${KACHEL}').getBoundingClientRect();
          return {
            links: r.left,
            rechts: r.right,
            ueberlauf: document.documentElement.scrollWidth - innerWidth,
          };
        }`),
      );
      expect.soft(lage.links, `${breite}: Kachel links aus dem Bild`).toBeGreaterThanOrEqual(0);
      expect.soft(lage.rechts, `${breite}: Kachel rechts aus dem Bild`).toBeLessThanOrEqual(breite);
      expect(lage.ueberlauf, `${breite}: waagerechter Seitenüberlauf`).toBeLessThanOrEqual(0);

      await seite.click(KACHEL);
      const z = await warteAufAuswahl(seite, `E3/${breite}`);
      expect(z.dateiauswahl).toBe(true);
      expect(
        await seite.evaluate<number>(fn("() => document.documentElement.scrollWidth - innerWidth")),
        `${breite}: Seitenüberlauf am ZIEL`,
      ).toBeLessThanOrEqual(0);
    });
  }

  it("E4 · der Browser-Rückweg führt auf `/import` — der Weg-Parameter steht nicht im Verlauf", async () => {
    const { seite } = pruefstand();
    await importOeffnen(seite, 1280);
    await seite.click(KACHEL);
    await warteAufAuswahl(seite, "E4");
    // Die Adresse ist bereinigt: `?weg=…` hat seine eine Aufgabe getan und ist weg.
    expect(new URL(seite.url()).search, "der Weg-Parameter steht noch in der Adresse").toBe("");
    // EIN Schritt zurück. Stünde `/erfassen?weg=datei` als eigener Eintrag im Verlauf, landete er
    // hier auf einer Zwischenadresse, die den Arbeitsraum gleich wieder aufrisse.
    await seite.evaluate(fn("() => history.back()"));
    await seite.waitForFunction(
      fn("() => !!document.querySelector('#import-source-gallery')"),
      undefined,
      { timeout: 30_000 },
    );
    expect(new URL(seite.url()).pathname).toBe("/import");
  });

  it("E4b · „Abbrechen“ zeigt wieder das Blatt und öffnet den Arbeitsraum NICHT erneut", async () => {
    const { seite } = pruefstand();
    await importOeffnen(seite, 1280);
    await seite.click(KACHEL);
    await warteAufAuswahl(seite, "E4b");
    // Der Knopf wird über sein SICHTBARES Wort gefunden — so findet ihn auch der Mensch.
    await seite.evaluate(
      fn(`(wort) => {
        const knopf = [...document.querySelectorAll('button')]
          .find((el) => (el.textContent || '').trim() === wort);
        if (!knopf) { throw new Error('kein Knopf „' + wort + '“ im Dateiimport'); }
        knopf.click();
      }`),
      String(i18n.getFixedT("de")("capture.file.cancel")),
    );
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="blatt"]')`),
      undefined,
      { timeout: 30_000 },
    );
    // Und er bleibt zu: kein Adressrest reisst ihn nach dem nächsten Bildaufbau wieder auf.
    await seite.evaluate(
      fn("() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))"),
    );
    expect(
      await seite.evaluate<boolean>(fn(`() => !!document.querySelector('${ARBEITSRAUM}')`)),
      "der Arbeitsraum ist von selbst wieder aufgegangen",
    ).toBe(false);
  });

  it("E5 · fail-closed: ein unbekannter Wert zeigt das Blatt, ohne Fehlermeldung", async () => {
    const { seite } = pruefstand();
    await seite.setViewportSize({ width: 1280, height: 800 });
    await seite.goto(`${ORIGIN}/erfassen?${BLATT_WEG_PARAMETER}=quatsch`, {
      waitUntil: "load",
      timeout: 60_000,
    });
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="blatt"]')`),
      undefined,
      { timeout: 30_000 },
    );
    const befund = await seite.evaluate<{ arbeitsraum: boolean; nenntWert: boolean }>(
      fn(`() => ({
        arbeitsraum: !!document.querySelector('${ARBEITSRAUM}'),
        nenntWert: (document.body.textContent || '').includes('quatsch'),
      })`),
    );
    console.info(`JOB 3341 · E5: ${JSON.stringify(befund)}`);
    expect(befund.arbeitsraum, "ein unbekannter Wert hat eine Ansicht erfunden").toBe(false);
    expect(befund.nenntWert, "die Fläche beklagt eine Adresse, die niemand getippt hat").toBe(
      false,
    );
  });

  // ==============================================================================================
  // E7 · RUNDE 2 (Codex fc454b48) — DER ARBEITSRAUM ÜBERDECKT KEINEN LADEFEHLER.
  // ==============================================================================================
  //
  // Runde 1 riss den Arbeitsraum auf, sobald die Adresse den Weg nannte — auch dann, wenn dieselbe
  // Adresse einen Entwurf nannte, den es nicht gibt. Dessen früher return (`Blatt.tsx:2132`) kommt
  // an `BlattLage` gar nicht vorbei; der Mensch stand im Dateiimport und erfuhr nie, dass sein
  // fortgesetzter Entwurf nicht geladen wurde. §9 des Auftrags verspricht das Gegenteil.
  //
  // HIER OHNE ATTRAPPE: die Kennung gibt es auf dem echten Server wirklich nicht, der Fehler ist
  // also ein echter. Die Ausgänge des Wartens (Erneut versuchen, geladener Entwurf) misst
  // `einschritt-mounted.test.tsx` Z8–Z10, wo sich der Abruf steuern lässt.
  it("E7 · `?draft=<unbekannt>&weg=datei`: die Ladefehlermeldung steht da, der Arbeitsraum nicht", async () => {
    const { seite } = pruefstand();
    await seite.setViewportSize({ width: 1280, height: 800 });
    await seite.goto(
      `${ORIGIN}/erfassen?draft=job3341-gibt-es-nicht&${BLATT_WEG_PARAMETER}=datei`,
      { waitUntil: "load", timeout: 60_000 },
    );
    // Auf das ERGEBNIS des Ladens warten, nicht auf den Bildaufbau davor.
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="blatt-lage"]')`),
      undefined,
      { timeout: 30_000 },
    );
    const befund = await seite.evaluate<{
      arbeitsraum: boolean;
      dateiauswahl: boolean;
      meldung: string;
      wiederholen: boolean;
    }>(
      fn(`() => ({
        arbeitsraum: !!document.querySelector('${ARBEITSRAUM}'),
        dateiauswahl: !!document.querySelector('${AUSWAHL}'),
        meldung: (document.querySelector('[data-testid="blatt-lage"]')?.textContent || '').trim(),
        wiederholen: !!document.querySelector('[data-testid="blatt-erneut"]'),
      })`),
    );
    console.info(`JOB 3341 · E7: ${JSON.stringify(befund)}`);
    expect(befund.arbeitsraum, "der Arbeitsraum liegt über dem gescheiterten Ladevorgang").toBe(
      false,
    );
    expect(befund.dateiauswahl).toBe(false);
    expect(befund.meldung.length, "die Ladefehlermeldung ist leer").toBeGreaterThan(0);
    expect(befund.wiederholen, "kein Weg aus dem Fehler heraus").toBe(true);
  });

  it("E6 · die Kachel sagt keine Restschritte mehr an — es gibt keine", async () => {
    // Der Browser-Beleg zu Lieferung 4. Gemessen wird über die ganze Galerie, nicht über die eine
    // Kachel: auch eine vergessene Wegzeile anderswo wäre eine zweite, unwahre Wahrheit.
    const { seite } = pruefstand();
    await importOeffnen(seite, 1280);
    expect(
      await seite.evaluate<number>(
        fn("() => document.querySelectorAll('#import-source-gallery [data-tile-steps]').length"),
      ),
      "auf der Galerie steht noch eine Restschritt-Zeile",
    ).toBe(0);
  });
});
