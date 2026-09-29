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
import {
  type Aufbau,
  type Bereich,
  MARKE,
  PROBE_ANLAGEN,
  SCHMAL_360,
  baueAuf,
  fahreStrecke,
  kachelMaengel,
  liesBereich,
  mitStil,
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
  it("setzen und widerrufen nur mit der Tastatur bei 360 px, Neuladen, Gegenseite, Rechteentzug an offener Sitzung, 500-Probe bei offenem Graphen", async () => {
    const aufbau = await baueAuf();
    try {
      const p = await fahreStrecke({ browser: browser as Browser, aufbau, probe: true });
      process.stderr.write(`${protokollzeile(p)}\n`);
      expect(p.kachelnAnker, "Kacheln an anker: gesetzt → neu geladen → widerrufen").toEqual([
        2, 2, 1,
      ]);
      expect(p.controllerFlaeche, "Controllerin, Fläche: vor → nach dem Entzug").toEqual([1, 0]);
      expect(p.controllerApi, "Controllerin, API: vor → nach dem Entzug").toEqual([1, 0]);
      expect(p.probe?.status, "500-Probe: jede Anlage bei offenem Graphen").toEqual({
        "201": PROBE_ANLAGEN,
      });
      expect(p.probe?.serverfehler, "Serverfehler während der 500-Probe").toEqual([]);
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
  });
});
