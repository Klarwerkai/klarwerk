// ================================================================================================
// GRAPH-BROWSER-RECHTE · DIE STRECKE IM TOR — echtes Chromium, echter Socket, Speicherablagen.
// ================================================================================================
//
// Diese Datei fährt `strecke.ts` gegen die echte Fastify-Instanz mit den Speicherfassungen
// (`starteStrecke`, wie `tests/gesamtanweisung-tastaturweg/tastaturweg-im-echten-browser.test.ts`).
// Sie braucht KEINE Datenbank und läuft deshalb in der Browser-Gruppe des Tors mit. Denselben
// Ablauf gegen PostgreSQL fährt `tastatur-schmal-rechte-pg.integration.test.ts`.
//
// KEIN ÜBERSPRUNG: fehlt `apps/web/dist`, baut `stelleFlaecheBereit` die Fläche oder scheitert laut;
// `starteChromium` scheitert laut, wenn kein Chromium da ist.
//
// DIE KALIBRIERUNG STEHT DANEBEN (REGELN.md 9): dieselbe Lesefunktion an derselben echten Fläche,
// einmal mit gezielt ausgeblendeten Feldern, einmal durchsichtigem Vorfahren, einmal verdeckt,
// einmal ohne `checkVisibility` und einmal ganz ohne Messverfahren. Jede Verstellung MUSS einen
// benannten Mangel liefern; die unverstellte Fläche liefert keinen.
//
// NACHARBEIT R1 (Ben): K8 SVG-Linie frei/verdeckt/durchfallend und K9 Hit-Test ohne Treffer (B1 —
// eine nicht messbare Verdeckung heisst „NICHT MESSBAR", nie „sichtbar"); K10 Lesefehler der
// Beziehungsliste und K11 verzögerte Detailantwort (B2 — gewartet wird auf die Antwort und einen
// eindeutigen Endzustand). Der historische 500 steht nicht mehr hier, sondern als minimale
// Reproduktion im PostgreSQL-Lauf daneben (B3).
//
// WAS HIER NICHT GEMESSEN WIRD: PostgreSQL und Prozessneustart (Integrationslauf daneben bzw.
// JOB 4328), andere Browser, Bildschirmleser, Word-Add-in.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Browser,
  type Kontext,
  type Seite,
  fn,
  profil,
  starteChromium,
  tabBisZu,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT } from "../gast-nutzerweg/strecke";
import { meldeAnMitTastatur, stelleFlaecheBereit } from "../gesamtanweisung-nutzerweg/weg";
import { SICHT_RUECKFALL } from "../support/sichtRueckfall";
import {
  type Aufbau,
  type Bereich,
  DETAIL_ALT_R1,
  type KontextMitNetz,
  MARKE,
  SCHMAL_360,
  baueAuf,
  fahreStrecke,
  kachelMaengel,
  liesBereich,
  mitStil,
  oeffneEintrag,
  oeffneUnlesbar,
  protokollzeile,
} from "./strecke";

let browser: Browser | undefined;

beforeAll(async () => {
  process.stderr.write(`${MARKE}: gebaute Fläche — ${stelleFlaecheBereit()}\n`);
  browser = await starteChromium();
}, 900_000);

afterAll(async () => {
  await browser?.close();
}, 60_000);

describe(`${MARKE} · Speicherablage im echten Chromium`, () => {
  it("setzen und widerrufen nur mit der Tastatur bei 360 px, Neuladen, Gegenseite, Rechteentzug an offener Sitzung", async () => {
    const aufbau = await baueAuf();
    try {
      const p = await fahreStrecke({ browser: browser as Browser, aufbau });
      process.stderr.write(`${protokollzeile(p)}\n`);
      expect(p.kachelnAnker, "Kacheln an anker: gesetzt → neu geladen → widerrufen").toEqual([
        2, 2, 1,
      ]);
      expect(p.controllerFlaeche, "Controllerin, Fläche: vor → nach dem Entzug").toEqual([1, 0]);
      expect(p.controllerApi, "Controllerin, API: vor → nach dem Entzug").toEqual([1, 0]);
      expect(aufbau.serverfehler, "Serverfehler während der ganzen Strecke").toEqual([]);
    } finally {
      await aufbau.strecke.schliessen();
    }
  }, 600_000);

  // ----------------------------------------------------------------------------------------------
  // DIE KALIBRIERUNG DER LESEFUNKTION — an der echten Fläche, jede Verstellung einzeln
  // ----------------------------------------------------------------------------------------------
  describe("Kalibrierung: die Lesefunktion sieht, was ein Mensch nicht sieht", () => {
    let aufbau: Aufbau | undefined;
    beforeAll(async () => {
      aufbau = await baueAuf();
    }, 300_000);
    afterAll(async () => {
      await aufbau?.strecke.schliessen();
    }, 60_000);

    /** Öffnet `anker` als Admin in einem frischen, ggf. verstellten Profil und liest den Bereich. */
    const lies = async (
      verstellung: (k: Kontext) => Promise<void>,
      nachDemLaden?: (s: Seite) => Promise<void>,
    ): Promise<Bereich> => {
      const a = aufbau as Aufbau;
      const { kontext, seite } = await profil(browser as Browser, SCHMAL_360);
      try {
        await verstellung(kontext);
        await meldeAnMitTastatur(
          seite,
          a.strecke.basis,
          "wbr-admin@graph-browser-rechte.test",
          PASSWORT,
        );
        await seite.goto(`${a.strecke.basis}/wissen/${a.ids.anker}`, {
          waitUntil: "domcontentloaded",
        });
        await warte(
          seite,
          `(id) => !!document.querySelector('[data-kante-id="' + id + '"]')`,
          "die Kachel steht",
          a.verborgenId,
          45_000,
        );
        await nachDemLaden?.(seite);
        return await liesBereich(seite);
      } finally {
        await kontext.close();
      }
    };
    const maengel = (b: Bereich): string[] => {
      const k = b.kacheln.find((x) => x.id === (aufbau as Aufbau).verborgenId);
      expect(k, "die Kachel ist im DOM").toBeDefined();
      return kachelMaengel(k as NonNullable<typeof k>, b.breite);
    };

    it("K0 · unverstellt: kein Mangel (sonst messen K1–K6 nichts)", async () => {
      const b = await lies(async () => undefined);
      expect(maengel(b)).toEqual([]);
      expect(b.kacheln[0]?.satz.verfahren).toBe("checkVisibility + Vorfahrenkette/Verdeckung");
    }, 180_000);

    it("K1 · Statuswort visibility:hidden → „status“ wird benannt", async () => {
      const b = await lies((k) => mitStil(k, '[data-testid="wb-status"]{visibility:hidden}'));
      const m = maengel(b);
      expect(
        m.some((x) => x.startsWith("status: nicht sichtbar")),
        m.join("\n"),
      ).toBe(true);
      expect(
        m.some((x) => x.startsWith("satz:")),
        "nur das verstellte Feld",
      ).toBe(false);
    }, 180_000);

    it("K2 · durchsichtiger Vorfahre (opacity:0 an der Kachel) → alle Felder benannt", async () => {
      const b = await lies((k) => mitStil(k, '[data-testid="wb-kante"]{opacity:0}'));
      const m = maengel(b);
      for (const feld of [
        "kachel",
        "satz",
        "herkunft",
        "status",
        "urheber",
        "oeffnen",
        "widerruf",
      ]) {
        expect(
          m.some((x) => x.startsWith(`${feld}: nicht sichtbar`)),
          `${feld}\n${m.join("\n")}`,
        ).toBe(true);
      }
    }, 180_000);

    it("K3 · OHNE checkVisibility: durchsichtiger und verborgener Vorfahre werden trotzdem erkannt", async () => {
      const ohne = "delete Element.prototype.checkVisibility;";
      const durchsichtig = await lies(async (k) => {
        await k.addInitScript(ohne);
        await mitStil(k, '[data-testid="wb-liste"]{opacity:0}');
      });
      const m1 = maengel(durchsichtig);
      expect(durchsichtig.kacheln[0]?.satz.verfahren).toBe("Rueckfall ohne checkVisibility");
      expect(
        m1.some((x) => x.startsWith("satz: nicht sichtbar") && x.includes("opacity:0")),
        m1.join("\n"),
      ).toBe(true);
      const verborgen = await lies(async (k) => {
        await k.addInitScript(ohne);
        await mitStil(k, '[data-testid="wb-liste"]{visibility:hidden}');
      });
      const m2 = maengel(verborgen);
      expect(
        m2.some((x) => x.startsWith("herkunft: nicht sichtbar") && x.includes("visibility:hidden")),
        m2.join("\n"),
      ).toBe(true);
      // Und die unverstellte Fläche bleibt im Rückfall ohne Mangel — sonst wäre er bloss streng.
      const sauber = await lies((k) => k.addInitScript(ohne));
      expect(sauber.kacheln[0]?.satz.verfahren).toBe("Rueckfall ohne checkVisibility");
      expect(maengel(sauber)).toEqual([]);
    }, 300_000);

    it("K4 · verdeckt (ein Element liegt über der Seite) → Verdeckung benannt, mit und ohne checkVisibility", async () => {
      const decke = async (s: Seite): Promise<void> => {
        await s.evaluate<boolean>(
          fn(`() => {
            const d = document.createElement("div");
            d.setAttribute("data-testid", "kalibrierung-decke");
            d.style.cssText = "position:fixed;inset:0;background:#fff;z-index:2147483647";
            document.body.appendChild(d);
            return true;
          }`),
        );
      };
      for (const ohne of [false, true]) {
        const b = await lies(
          (k) =>
            ohne ? k.addInitScript("delete Element.prototype.checkVisibility;") : Promise.resolve(),
          decke,
        );
        const m = maengel(b);
        expect(
          m.some(
            (x) =>
              x.startsWith("satz: nicht sichtbar") &&
              x.includes("verdeckt von <div kalibrierung-decke>"),
          ),
          `ohne checkVisibility=${ohne}\n${m.join("\n")}`,
        ).toBe(true);
      }
    }, 300_000);

    it("K5 · schmale Darstellung: ein Satz, der nicht umbricht, wird als Überlauf benannt", async () => {
      const b = await lies((k) =>
        mitStil(k, '[data-testid="wb-kante"] p:first-of-type{white-space:nowrap}'),
      );
      const m = maengel(b);
      expect(
        m.length > 0 || b.seitenUeberlauf > 0,
        `Satz ohne Umbruch bei 360 px blieb unbemerkt: ${JSON.stringify(b.kacheln[0]?.satz)}`,
      ).toBe(true);
    }, 180_000);

    it("K7 · Tastatur: ist das Suchfeld per Tab unerreichbar (tabindex=-1), scheitert der Tab-Weg", async () => {
      let befund = "";
      await lies(
        async () => undefined,
        async (s) => {
          await s.evaluate<boolean>(
            fn(
              `() => { document.querySelector("#wb-suche").setAttribute("tabindex", "-1"); return true; }`,
            ),
          );
          try {
            await tabBisZu(s, "#wb-suche", 400, true);
            befund = "erreicht";
          } catch (e) {
            befund = String(e);
          }
        },
      );
      expect(befund).toContain("war in 400 Tab-Anschlägen nicht erreichbar");
    }, 180_000);

    it("K6 · ganz ohne Messverfahren: die Messung meldet das ausdrücklich statt eines Ergebnisses", async () => {
      let fehler = "";
      await lies(
        (k) => k.addInitScript("delete Element.prototype.checkVisibility;"),
        async (s) => {
          await s.evaluate<boolean>(
            fn("() => { window.getComputedStyle = undefined; return true; }"),
          );
          try {
            const b = await liesBereich(s);
            fehler = `kein Fehler — die Messung lieferte ein Ergebnis: ${JSON.stringify(b.kacheln[0]?.satz)}`;
          } catch (e) {
            fehler = String(e);
          }
          await s.reload({ waitUntil: "domcontentloaded" });
          await warte(s, `() => typeof window.getComputedStyle === "function"`, "Stil wieder da");
        },
      );
      expect(fehler).toContain("SICHTMESSUNG NICHT MOEGLICH");
    }, 180_000);

    // --------------------------------------------------------------------------------------------
    // B1 · DIE VERDECKUNG, WO SIE NICHT MESSBAR IST — ausdrücklich, nie „sichtbar"
    // --------------------------------------------------------------------------------------------
    const svgProbe = async (fall: string): Promise<Record<string, unknown>> => {
      const { kontext, seite } = await profil(browser as Browser, SCHMAL_360);
      try {
        await seite.goto("about:blank");
        return await seite.evaluate<Record<string, unknown>>(
          fn(`(fall) => {
            ${SICHT_RUECKFALL}
            delete Element.prototype.checkVisibility;
            document.body.style.margin = "0";
            const ns = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(ns, "svg");
            svg.setAttribute("width", "300");
            svg.setAttribute("height", "200");
            svg.setAttribute("data-testid", "probe-svg");
            const linie = document.createElementNS(ns, "line");
            for (const [n, w] of [["x1", "20"], ["y1", "30"], ["x2", "280"], ["y2", "170"], ["stroke", "black"], ["stroke-width", "4"], ["stroke-dasharray", "9 3"]]) linie.setAttribute(n, w);
            if (fall === "durchfallend") linie.setAttribute("pointer-events", "none");
            svg.appendChild(linie);
            document.body.appendChild(svg);
            if (fall === "verdeckt") {
              const d = document.createElement("div");
              d.setAttribute("data-testid", "decke");
              d.style.cssText = "position:fixed;inset:0;background:#fff";
              document.body.appendChild(d);
            }
            if (fall === "ohneTreffer") Document.prototype.elementFromPoint = () => null;
            const b = sichtRueckfall(linie);
            let wurf = "";
            try { sichtbarOhneCheck(linie); } catch (e) { wurf = String(e && e.message); }
            return { sichtbar: b.sichtbar, messbar: b.messbar, grund: b.grund, wurf };
          }`),
          fall,
        );
      } finally {
        await kontext.close();
      }
    };

    it("K8 · SVG-Linie ohne checkVisibility: frei → sichtbar; verdeckt → benannt; durchfallend/ohne Treffer → NICHT MESSBAR, Verbraucher wirft", async () => {
      const frei = await svgProbe("frei");
      expect([frei.sichtbar, frei.messbar, frei.wurf], String(frei.grund)).toEqual([
        true,
        true,
        "",
      ]);
      expect(String(frei.grund)).toContain("Punkte auf der Form");
      const verdeckt = await svgProbe("verdeckt");
      expect([verdeckt.sichtbar, verdeckt.messbar], String(verdeckt.grund)).toEqual([false, true]);
      expect(String(verdeckt.grund)).toContain("verdeckt von <div decke>");
      for (const fall of ["durchfallend", "ohneTreffer"]) {
        const b = await svgProbe(fall);
        expect([b.sichtbar, b.messbar], `${fall}: ${String(b.grund)}`).toEqual([false, false]);
        expect(String(b.grund), fall).toMatch(/^NICHT MESSBAR: /);
        expect(String(b.wurf), fall).toContain("SICHTMESSUNG NICHT MOEGLICH");
      }
    }, 180_000);

    it("K9 · Hit-Test ohne Treffer an der echten Kachel (ohne checkVisibility): NICHT MESSBAR statt „sichtbar“", async () => {
      const b = await lies((k) =>
        k.addInitScript(
          "delete Element.prototype.checkVisibility; Document.prototype.elementFromPoint = function () { return null; };",
        ),
      );
      const m = maengel(b);
      expect(
        m.some((x) => x.startsWith("satz: NICHT MESSBAR") && x.includes("kein Treffer")),
        m.join("\n"),
      ).toBe(true);
    }, 180_000);

    // --------------------------------------------------------------------------------------------
    // B2 · GEWARTET WIRD AUF DIE ANTWORT UND EINEN EINDEUTIGEN ENDZUSTAND
    // --------------------------------------------------------------------------------------------
    it("K10 · Lesefehler der Beziehungsliste: der Endzustand ist „fehler“, und er zählt NICHT als leerer Bestand", async () => {
      const a = aufbau as Aufbau;
      const { kontext, seite } = await profil(browser as Browser, SCHMAL_360);
      try {
        await (kontext as KontextMitNetz).route(`**/api/kos/${a.ids.anker}/beziehungen`, (u) =>
          u.fulfill({
            status: 500,
            contentType: "application/json",
            body: '{"error":"INTERNAL","message":"Kalibrierung K10"}',
          }),
        );
        await meldeAnMitTastatur(
          seite,
          a.strecke.basis,
          "wbr-admin@graph-browser-rechte.test",
          PASSWORT,
        );
        let befund = "";
        try {
          await oeffneEintrag(seite, a.strecke.basis, a.ids.anker, "anker (K10)");
          befund = "kein Fehler — der Lesefehler wäre als Erfolg durchgegangen";
        } catch (e) {
          befund = String(e);
        }
        expect(befund).toContain("Antwort 500");
        expect(befund).toContain('Zustand „fehler"');
        // Genau der Zustand, den die Rechteprüfung aus Runde 1 als „entfernt“ gelesen hätte:
        const b = await liesBereich(seite);
        expect({ ids: b.ids, fehlerDa: b.fehler !== "" }).toEqual({ ids: [], fehlerDa: true });
      } finally {
        await kontext.close();
      }
    }, 180_000);

    it("K11 · verzögerte Detailantwort: das Prädikat aus Runde 1 sagt zu früh ja, `oeffneUnlesbar` wartet die Antwort ab", async () => {
      const a = aufbau as Aufbau;
      const VERZUG = 4_000;
      const { kontext, seite } = await profil(browser as Browser, SCHMAL_360);
      try {
        await (kontext as KontextMitNetz).route(`**/api/kos/${a.ids.geheim}`, async (u) => {
          await new Promise((weiter) => setTimeout(weiter, VERZUG));
          await u.fulfill({
            status: 404,
            contentType: "application/json",
            body: '{"error":"NOT_FOUND","message":"Kalibrierung K11"}',
          });
        });
        await meldeAnMitTastatur(
          seite,
          a.strecke.basis,
          "wbr-admin@graph-browser-rechte.test",
          PASSWORT,
        );
        const beginn = Date.now();
        await seite.goto(`${a.strecke.basis}/wissen/${a.ids.geheim}`, {
          waitUntil: "domcontentloaded",
        });
        await warte(seite, DETAIL_ALT_R1, "Prädikat aus Runde 1", undefined, VERZUG * 3);
        const altMs = Date.now() - beginn;
        const altEndzustand = await seite.evaluate<boolean>(
          fn(
            `() => { const l = document.querySelector('[data-testid="bib-lesen"]'); return !!l && String(l.innerText || "").length > 0; }`,
          ),
        );
        expect(
          { zuFrueh: altMs < VERZUG, lesenFertig: altEndzustand },
          `Runde-1-Prädikat nach ${altMs} ms`,
        ).toEqual({ zuFrueh: true, lesenFertig: false });
        const neu = await oeffneUnlesbar(seite, a.strecke.basis, a.ids.geheim);
        expect(neu.status).toBe(404);
        expect(
          neu.ms,
          "oeffneUnlesbar kehrte vor der verzögerten Antwort zurück",
        ).toBeGreaterThanOrEqual(VERZUG);
      } finally {
        await kontext.close();
      }
    }, 180_000);
  });
});
