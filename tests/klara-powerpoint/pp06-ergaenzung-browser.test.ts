// Genau ein neuer H04-Nutzerweg gegen die gebaute Anwendung, echte lokale Dienste und fiktive PPTX.
// Aufruf ausschließlich unter dem vorhandenen globalen Browserdeckel mit einem Worker.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { expect, it } from "vitest";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";
import { PPTX, pruefdeck } from "./pp03-pruefdeck";

it("PP-06 H04 · Lücke, passende/unpassende Quelle, Übernahme, Herkunft und Rücknahme", async () => {
  let stand: H4Stand | undefined;
  let zielId = "";
  let quelleId = "";
  let anhangId = "";
  let dpId = "";
  const ausgabe = resolve(process.env.KLARWERK_PP06_AUSGABE ?? ".local/run/pp06-browser");
  mkdirSync(ausgabe, { recursive: true });
  const beginn = new Date().toISOString();
  try {
    stand = await h4Stand(
      "/bibliothek",
      "pp06-fiktiv@example.test",
      async ({ services, app, autorId }) => {
        const q = await services.ko.create({
          title: "PP06 Fiktive Vergleichsdaten",
          statement: "Umsatz netto Europa Q3 2025: 900 T€",
          type: "best_practice",
          category: "Testbestand",
          author: autorId,
          confidentiality: "intern",
        });
        quelleId = q.id;
        const ziel = await services.ko.create({
          title: "PP06 Fiktives Prüfdeck",
          statement: "Vergleich mit Vorquartal ergänzen",
          type: "best_practice",
          category: "Testbestand",
          author: autorId,
          confidentiality: "intern",
        });
        zielId = ziel.id;
        const zip = await JSZip.loadAsync(await pruefdeck());
        const xml = await zip.file("ppt/slides/slide1.xml")?.async("string");
        zip.file(
          "ppt/slides/slide1.xml",
          xml?.replace("Umsatz 2024: 900 T€", "Vergleichswert offen") ?? "",
        );
        const bytes = await zip.generateAsync({ type: "nodebuffer" });
        const o = await services.objects.put({
          name: "PP06-Fiktives-Deck.pptx",
          mime: PPTX,
          data: `data:${PPTX};base64,${bytes.toString("base64")}`,
          purpose: "attachment",
        });
        const mit = await services.ko.addAttachment(ziel.id, autorId, {
          name: o.name,
          mime: PPTX,
          objectId: o.id,
          size: o.size,
        });
        anhangId = mit.attachments?.[0]?.id ?? "";
        // Reguläre Anmeldung ausschließlich dieses eigens angelegten fiktiven Kontos.
        const anmeldung = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: "pp06-fiktiv@example.test", password: "geheim12345" },
        });
        const token = anmeldung.json<{ token: string }>().token;
        for (const zeitraum of ["Q3 2025", "Q4 2025"]) {
          const r = await app.inject({
            method: "POST",
            url: `/api/kos/${quelleId}/datenpunkte`,
            headers: { authorization: `Bearer ${token}` },
            payload: {
              art: "zahl",
              wert: "900 T€",
              erfassung: "direkt",
              quelleKoId: quelleId,
              zitat: "Umsatz netto Europa Q3 2025: 900 T€",
              einheit: "T€",
              waehrung: "EUR",
              bezugsgroesse: "Umsatz netto Europa",
              zeitraum,
            },
          });
          expect(r.statusCode, r.body).toBe(201);
          if (zeitraum === "Q3 2025") dpId = r.json<{ id: string }>().id;
        }
      },
    );
    const seite = stand.seite;
    await seite.goto(`${ORIGIN}/wissen/${zielId}`, { waitUntil: "load" });
    await seite.click('[data-testid="bib-mehr"]');
    await seite.click(`[data-office-oeffnen="${anhangId}"]`);
    const auswahl = '[data-element="256:7"]';
    await seite.click(`${auswahl} summary`);
    await seite.waitForFunction(
      fn(
        `() => document.querySelector('${auswahl} [data-pp06-quelle] option[value="${quelleId}"]')`,
      ),
    );
    await seite.selectOption(`${auswahl} [data-pp06-quelle]`, quelleId);
    for (const [feld, wert] of Object.entries({
      zeitraum: "Q3 2025",
      einheit: "T€",
      waehrung: "EUR",
      bezugsgroesse: "Umsatz netto Europa",
    })) {
      await seite.click(`${auswahl} [data-pp06-feld="${feld}"]`);
      await seite.keyboard.type(wert);
    }
    // Prüfen über die echte Kontextaktion, keine direkte API-Wirkung aus dem Test.
    await seite.click(`${auswahl} [data-pp06-suchen]`);
    await seite.waitForFunction(
      fn(`() => document.querySelectorAll('${auswahl} [data-pp06-kandidat]').length === 2`),
    );
    expect(
      await seite.evaluate(
        fn(`() => document.querySelectorAll('${auswahl} [data-passend="true"]').length`),
      ),
    ).toBe(1);
    expect(
      await seite.evaluate(
        fn(`() => document.querySelector('${auswahl} [data-passend="false"]').textContent`),
      ),
    ).toContain("Zeitraum passt nicht");
    const neuerText = await seite.evaluate<string>(
      fn(`() => document.querySelector('${auswahl} [data-passend="true"] p').textContent`),
    );
    expect(neuerText).toContain("Q3 2025");
    await seite.setViewportSize({ width: 390, height: 844 });
    const passt = await seite.evaluate<boolean>(
      fn(
        `() => { const r = document.querySelector('${auswahl} [data-pp06]').getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1; }`,
      ),
    );
    expect(passt).toBe(true);
    await seite.screenshot({ path: resolve(ausgabe, "PP06-VORSCHAU-SCHMAL.png"), fullPage: true });
    await seite.setViewportSize({ width: 1440, height: 1000 });
    await seite.click(`${auswahl} [data-pp06-uebernehmen]`);
    await seite.waitForFunction(
      fn(
        `() => document.querySelector('${auswahl}').textContent.includes('Ergänzung gespeichert')`,
      ),
    );
    await seite.click(`${auswahl} button[data-datenpunkt="${dpId}"][aria-pressed]`);
    await seite.waitForFunction(
      fn(
        `() => document.querySelector('[data-herkunft="${dpId}"] [data-herkunft-quelle="${quelleId}"]')`,
      ),
    );
    expect(
      await seite.evaluate<string>(
        fn(`() => document.querySelector('[data-herkunft="${dpId}"]').textContent`),
      ),
    ).toContain("Q3 2025");
    await seite.screenshot({ path: resolve(ausgabe, "PP06-HERKUNFT.png"), fullPage: true });
    await seite.click("[data-herkunft-schliessen]");
    // Der letzte Knopf im Ergebnis ist der normale Office-Rücknahmeweg.
    const ruecknahme = await seite.evaluate<string>(
      fn(
        `() => [...document.querySelectorAll('${auswahl} button')].find(b => b.textContent.includes('Vorherige Dokumentfassung')).outerHTML`,
      ),
    );
    expect(ruecknahme).toContain("button");
    await seite.evaluate(
      fn(
        `() => [...document.querySelectorAll('${auswahl} button')].find(b => b.textContent.includes('Vorherige Dokumentfassung')).focus()`,
      ),
    );
    await seite.keyboard.press("Enter");
    await seite.waitForFunction(
      fn(`() => document.querySelector('${auswahl} > p')?.textContent === 'Vergleichswert offen'`),
    );
    expect(stand.seitenfehler).toEqual([]);
    writeFileSync(
      resolve(ausgabe, "BROWSER-ERGEBNIS.json"),
      JSON.stringify(
        {
          beginn,
          pruefungBeendet: new Date().toISOString(),
          browser: stand.version,
          h04: "ein neuer vollständiger Web-Dateiweg positiv",
          breite: [390, 1440],
          source: "fiktiver lokaler Testbestand",
          nativePowerPoint: "nicht geprüft",
          powerpointWeb: "nicht geprüft",
          screenreader: "nicht geprüft",
          seitenfehler: stand.seitenfehler,
        },
        null,
        2,
      ),
    );
  } finally {
    await stand?.browser.close();
    await stand?.app.close();
    writeFileSync(
      resolve(ausgabe, "RESSOURCEN-ENDE.json"),
      JSON.stringify(
        {
          beginn,
          ende: new Date().toISOString(),
          browserUndAppGeschlossen: !!stand,
          keineMacOfficeDbNutzung: true,
        },
        null,
        2,
      ),
    );
  }
}, 120_000);
