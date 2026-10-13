// ================================================================================================
// produkt:20261009:referenzki-adminauswahl (REF-03) — AUSWAHL NACH NEULADEN UND FUNKTIONSCHECK
// MIT DEM ECHTEN MODELL, BEDIENT IN DER OBERFLÄCHE.
// ================================================================================================
//
// Lieferbeleg des Auftrags: „Gespeicherte Auswahl nach Reload und tatsächlicher Modellaufruf". Die
// Sonde fährt den Einstieg Verwaltung → KI → Referenzprüfung am laufenden Smoke-Server:
//   1. Grundfreigabe öffentlicher KI über den vorhandenen Adminweg (wie `support/ki-freigabe.ts`).
//   2. In der Oberfläche Claude (Anthropic) als Referenz-KI erlauben, Seite neu laden: bleibt erlaubt.
//   3. Seitenaufruf ruft kein Modell (kein Funktionscheck ohne Klick).
//   4. Funktionscheck per Klick: echter Modellaufruf mit fiktivem Prüfstoff. Zeit, Modell, Ergebnis,
//      Verbrauch und Kosten stehen an der Karte und, nach Neuladen, als letzte Prüfung der Option.
//   5. Ist die Antwort-KI dasselbe Modell, steht die Konflikthilfe da (kein Vier-Augen-Ergebnis).
// Am Ende werden Liste und Freigabe auf den Vorher-Stand zurückgestellt (ein geteilter Server).
//
// Zugang ausschließlich über die Betreiber-Einspeisung des vollen Smokes
// (`KLARWERK_SHIP_SMOKE_API_KEY`); diese Datei liest keinen Schlüssel. Im hermetischen Tor über
// `@modell` ausgenommen (benannt in `tests/smoke/tor-ausnahme.test.ts`). Nur Chromium.
import { expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

test.skip(({ browserName }) => browserName !== "chromium", "Ein echter Lauf je Smoke genügt");

interface Zuordnung {
  global: string;
  perTask: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
  referenzpruefung?: string[];
}

interface Option {
  wahl: string;
  modell: string | null;
  eingerichtet: boolean;
  erlaubt: boolean;
  sperre: string | null;
  gleichWieAntwortmodell: boolean;
  zustand: string;
  letzteFunktionspruefung: {
    zeit: string;
    modell: string | null;
    ergebnis: string;
    modellaufruf: boolean;
    dauerMs: number;
    verbrauch: { eingabe: number; ausgabe: number } | null;
  } | null;
}

interface Lage {
  liste: string[];
  optionen: Option[];
  antwortmodell: { anbieter: string; modell: string | null } | null;
  unabhaengigVerfuegbar: boolean;
}

const KARTE = "/admin?bereich=ki&detail=kiReferenz";

test("REF-03 · Referenzprüfung: Auswahl nach Neuladen und Funktionscheck mit echtem Modell @modell", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await ensureLoggedIn(page);
  const lageLesen = async (): Promise<Lage> => {
    const r = await page.request.get("/api/reasoner/referenzpruefung");
    expect(r.status(), await r.text()).toBe(200);
    return (await r.json()) as Lage;
  };
  const vorherR = await page.request.get("/api/reasoner/config");
  expect(vorherR.status()).toBe(200);
  const vorher = ((await vorherR.json()) as { taskConfig: Zuordnung }).taskConfig;

  try {
    // 1. Grundfreigabe — vertrauliche Inhalte bleiben, wie sie waren.
    const frei = await page.request.put("/api/reasoner/config", {
      data: {
        global: vorher.global,
        perTask: vorher.perTask,
        kiFreigabe: {
          oeffentlicheKi: true,
          vertraulicheInhalte: vorher.kiFreigabe?.vertraulicheInhalte === true,
        },
      },
    });
    expect(frei.status(), await frei.text()).toBe(200);

    // 2. In der Oberfläche erlauben (falls noch nicht) und nach Neuladen wiederfinden.
    const letzteZeitVorher = (await lageLesen()).optionen.find((o) => o.wahl === "anthropic")
      ?.letzteFunktionspruefung?.zeit;
    await page.goto(KARTE);
    const kaestchen = page.getByTestId("ki-referenz-anthropic-erlaubt");
    await expect(kaestchen).toBeVisible({ timeout: 30_000 });
    await expect(kaestchen, "Claude ist im Smoke eingerichtet").toBeEnabled();
    if (!(await kaestchen.isChecked())) {
      await kaestchen.focus();
      await page.keyboard.press("Space");
      await expect(kaestchen).toBeChecked({ timeout: 30_000 });
    }
    await page.reload();
    await expect(page.getByTestId("ki-referenz-anthropic-erlaubt")).toBeChecked({
      timeout: 30_000,
    });
    const nachReload = await lageLesen();
    expect(nachReload.liste).toContain("anthropic");

    // 3. Öffnen und Neuladen haben keinen Funktionscheck ausgelöst.
    expect(
      nachReload.optionen.find((o) => o.wahl === "anthropic")?.letzteFunktionspruefung?.zeit,
    ).toBe(letzteZeitVorher);

    // 5. Konflikthilfe, wenn die Antwort-KI dasselbe Modell nutzt.
    const anthropic = nachReload.optionen.find((o) => o.wahl === "anthropic") as Option;
    expect(anthropic.eingerichtet).toBe(true);
    expect(anthropic.sperre).toBeNull();
    expect(anthropic.modell).not.toBeNull();
    if (anthropic.gleichWieAntwortmodell) {
      await expect(page.getByTestId("ki-referenz-anthropic-gleich")).toBeVisible();
      if (!nachReload.unabhaengigVerfuegbar) {
        await expect(page.getByTestId("ki-referenz-konflikt")).toBeVisible();
      }
    }

    // 4. Funktionscheck per Tastatur — ein echter Modellaufruf.
    const knopf = page.getByTestId("ki-referenz-anthropic-check");
    await knopf.focus();
    await page.keyboard.press("Enter");
    const ergebnis = page.getByTestId("ki-referenz-check-ergebnis");
    await expect(ergebnis).toBeVisible({ timeout: 90_000 });
    const text = (await ergebnis.textContent()) ?? "";
    const danach = await lageLesen();
    const letzte = danach.optionen.find((o) => o.wahl === "anthropic")?.letzteFunktionspruefung;
    await testInfo.attach("referenzki-funktionscheck.json", {
      body: JSON.stringify({ anzeige: text, lage: danach }, null, 2),
      contentType: "application/json",
    });
    console.info(`REF-03 · Funktionscheck → ${JSON.stringify(letzte)}`);
    expect(text).toContain("Tatsächlicher Modellaufruf");
    expect(letzte).not.toBeNull();
    expect(letzte?.modellaufruf).toBe(true);
    expect(letzte?.modell).toBe(anthropic.modell);
    expect(letzte?.zeit).not.toBe(letzteZeitVorher);
    expect(letzte?.ergebnis, `Funktionscheck: ${text}`).toBe("erfolgreich");

    // Nach Neuladen steht die letzte Prüfung als Zustand der Option.
    await page.reload();
    await expect(page.getByTestId("ki-referenz-anthropic-letzte")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("ki-referenz-anthropic")).toHaveAttribute(
      "data-zustand",
      "letzte_pruefung_erfolgreich",
    );
  } finally {
    await page.request.put("/api/reasoner/referenzpruefung", {
      data: { liste: vorher.referenzpruefung ?? null },
    });
    await page.request.put("/api/reasoner/config", {
      data: {
        global: vorher.global,
        perTask: vorher.perTask,
        kiFreigabe: {
          oeffentlicheKi: vorher.kiFreigabe?.oeffentlicheKi === true,
          vertraulicheInhalte: vorher.kiFreigabe?.vertraulicheInhalte === true,
        },
      },
    });
  }
});
