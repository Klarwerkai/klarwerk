import { setTimeout as verzoegere } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type H4Stand, ORIGIN, TITEL_FREI, TITEL_OFFEN, fn, h4Stand } from "../design/h4-harness";
import { type Stand, beende, starte, wechsle } from "../design/h6-chromium";
import { originalProbe } from "./original-probe";

// Eine Instanz nach der anderen; keine zusätzlichen parallel laufenden Browser im Nachweis.
let bib: H4Stand;
let profil: Stand;
const scope = () => ({
  expect,
  s: () => bib,
  fn,
  ORIGIN,
  TITEL_FREI,
  TITEL_OFFEN,
  stand: profil,
  t: (key: string) => i18n.t(key),
});

/** Nur die zwei neuen Bereitschafts-Timeouts der Negativprobe verkürzen; Aufbau/Tippen unverändert. */
function negativesScope(): object {
  const seite = new Proxy(bib.seite, {
    get(ziel, name) {
      if (name === "waitForFunction")
        return (
          pruefung: Parameters<H4Stand["seite"]["waitForFunction"]>[0],
          arg?: unknown,
          opts?: Record<string, unknown>,
        ) =>
          ziel.waitForFunction(
            pruefung,
            arg,
            /ist\.every|stil\.visibility/.test(pruefung.toString())
              ? { ...opts, timeout: 1_000 }
              : opts,
          );
      const wert = Reflect.get(ziel, name);
      return typeof wert === "function" ? wert.bind(ziel) : wert;
    },
  });
  return { ...scope(), s: () => ({ ...bib, seite }) };
}

async function protokolliere(
  fall: "B3b" | "B4" | "I28",
  start: number,
  fehler: unknown,
): Promise<void> {
  const seite = fall === "I28" ? profil.seite : bib.seite;
  const zustand = await seite?.evaluate(
    fn(`() => ({
    url: location.href, verlauf: history.length,
    zeilen: [...document.querySelectorAll('[data-testid="bib-zeile"] [data-bib-text="zeile-titel"]')].map(e => e.textContent),
    lesetitel: document.querySelector('[data-testid="bib-titel"]')?.textContent ?? null,
    detail: document.querySelector('[data-testid="detail-wirkung"]')?.innerText ?? null
  })`),
  );
  console.log(
    `${fall} GEGENPROBE · ${Date.now() - start}ms · erster Fehler: ${String(fehler).split("\n")[0]} · letzter sichtbarer Zustand: ${JSON.stringify(zustand)}`,
  );
}

async function mussRotBleiben(
  fall: "B3b" | "B4" | "I28",
  grund: RegExp,
  eingabe: object,
): Promise<void> {
  const start = Date.now();
  let fehler: unknown;
  try {
    await originalProbe(fall)(eingabe);
  } catch (e) {
    fehler = e;
  }
  await protokolliere(fall, start, fehler);
  expect(fehler, `${fall}: echter Fehler wurde grün`).toBeDefined();
  expect(String(fehler)).toMatch(grund);
}

describe("JOB 3130 · echte verzögerte Antworten, unveränderte Originalprüfungen", () => {
  describe("Bibliothek", () => {
    beforeAll(async () => {
      bib = await h4Stand("/bibliothek", "pedi@job3130.test");
    }, 180_000);
    afterAll(async () => {
      await bib?.browser.close();
      await bib?.app.close();
    }, 60_000);

    for (const fall of ["B3b", "B4"] as const) {
      it(`${fall} · besteht trotz gezielt verspäteter Listenantwort`, async () => {
        const start = Date.now();
        let gebremst = 0;
        bib.antworten.vorAuslieferung = async (url, body) => {
          if (
            url.pathname === "/api/library/search" &&
            (fall === "B3b" || url.searchParams.get("q") === "Reinigung")
          ) {
            gebremst++;
            // B3b: Lesetitel schon da, Liste noch offen. B4: q geschrieben, Treffer noch offen.
            await bib.seite.waitForFunction(
              fn(
                fall === "B3b"
                  ? `() => !!document.querySelector('[data-testid="bib-titel"]')`
                  : `() => new URLSearchParams(location.search).get('q') === 'Reinigung'`,
              ),
              undefined,
              { timeout: 20_000 },
            );
            await verzoegere(1_200);
          }
          return body;
        };
        try {
          await originalProbe(fall)(scope());
          expect(gebremst, "keine Listenantwort verzögert — kein Nachweis").toBeGreaterThan(0);
        } catch (fehler) {
          await protokolliere(fall, start, fehler);
          throw fehler;
        } finally {
          delete bib.antworten.vorAuslieferung;
        }
      }, 120_000);
    }

    for (const [fall, defekt, grund] of [
      ["B3b", "Liste bleibt leer", /Bibliothek nicht bereit/],
      ["B3b", "falscher Bericht", /Bibliothek nicht bereit/],
      ["B4", "Zeile fehlt dauerhaft", /Zeile fehlt: Reinigung Spritzzone Linie 3/],
      ["B4", "zusätzliches pushState", /jeder Schreibweg muss `replace` sein/],
    ] as const) {
      it(`${fall} · ${defekt} bleibt rot`, async () => {
        let verstellt = 0;
        bib.antworten.vorAuslieferung = async (url, body) => {
          if (defekt === "falscher Bericht" && url.pathname === `/api/kos/${bib.koOffenId}`) {
            verstellt++;
            return JSON.stringify({ ...JSON.parse(body), title: TITEL_FREI });
          }
          if (
            url.pathname === "/api/library/search" &&
            (fall === "B3b" || url.searchParams.get("q") === "Reinigung")
          ) {
            if (defekt === "Liste bleibt leer" || defekt === "Zeile fehlt dauerhaft") {
              verstellt++;
              return "[]";
            }
            if (defekt === "zusätzliches pushState" && verstellt === 0) {
              verstellt++;
              await bib.seite.evaluate(
                fn(`() => history.pushState(history.state, '', location.href)`),
              );
            }
          }
          return body;
        };
        try {
          await mussRotBleiben(fall, grund, negativesScope());
          expect(verstellt).toBeGreaterThan(0);
        } finally {
          delete bib.antworten.vorAuslieferung;
        }
      }, 120_000);
    }
  });

  describe("Profil", () => {
    beforeAll(async () => {
      await i18n.changeLanguage("de");
      profil = await starte("/profil", '[data-testid="zeile-wirkung"]');
      expect(profil.fehler).toBeNull();
    }, 180_000);
    afterAll(async () => {
      if (profil) await beende(profil);
    }, 60_000);

    it("I28 · besteht trotz gezielt verspäteter Wirkungsantwort", async () => {
      const start = Date.now();
      await wechsle(profil, "/profil", '[data-testid="zeile-wirkung"]');
      let gebremst = 0;
      profil.antworten.vorAuslieferung = async (url, body) => {
        if (url.pathname === "/api/me/impact") {
          gebremst++;
          await profil.seite?.waitForFunction(
            fn(`() => !!document.querySelector('[data-testid="detail-wirkung"]')`),
            undefined,
            { timeout: 8_000 },
          );
          await verzoegere(1_200);
        }
        return body;
      };
      try {
        await originalProbe("I28")(scope());
        expect(gebremst, "keine Wirkungsantwort verzögert — kein Nachweis").toBeGreaterThan(0);
      } catch (fehler) {
        await protokolliere("I28", start, fehler);
        throw fehler;
      } finally {
        delete profil.antworten.vorAuslieferung;
      }
    }, 90_000);

    it("I28 · dauerhaft fehlender Detailinhalt bleibt rot", async () => {
      await wechsle(profil, "/profil", '[data-testid="zeile-wirkung"]');
      const vorher = profil.abrufe.get("/api/me/impact") ?? 0;
      profil.stoerung = "/api/me/impact";
      try {
        await mussRotBleiben("I28", /Inhalt .*my-impact.*kam nicht/, scope());
        expect(profil.abrufe.get("/api/me/impact")).toBeGreaterThan(vorher);
      } finally {
        profil.stoerung = null;
      }
    }, 90_000);

    for (const defekt of ["fehlende Wirkungszahl", "falsche Wirkungszahl"] as const) {
      it(`I28 · ${defekt} bleibt rot`, async () => {
        await wechsle(profil, "/profil", '[data-testid="zeile-wirkung"]');
        let verstellt = 0;
        profil.antworten.vorAuslieferung = async (url, body) => {
          if (url.pathname !== "/api/me/impact") return body;
          verstellt++;
          const daten = JSON.parse(body);
          if (defekt === "fehlende Wirkungszahl") delete daten.helpfulReceived;
          else daten.helpfulReceived += 1;
          return JSON.stringify(daten);
        };
        try {
          await mussRotBleiben("I28", /Wirkungszahlen/, scope());
          expect(verstellt).toBeGreaterThan(0);
        } finally {
          delete profil.antworten.vorAuslieferung;
        }
      }, 90_000);
    }
  });
});
