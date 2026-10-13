// ================================================================================================
// produkt:20261009:referenzki-antwortstatus (REF-04, K9) — DURCHGÄNGIG MIT ECHTEM PRÜFMODELL.
// ================================================================================================
//
// Lieferbeleg des Auftrags: „echte durchgängige Antwort → Prüfmodell → Aussagezustand →
// Quellenpassage → Rückweg auf Desktop und 390 × 844 sowie per Tastatur". Die Sonde fährt am
// laufenden Smoke-Server:
//   1. Fiktive, interne Testquelle anlegen und bestätigen (eindeutige Marke je Lauf).
//   2. Antwortweg: die Aufgabe „answer" auf den internen deterministischen Weg; Referenz-KI: Claude
//      (Anthropic) über den vorhandenen Adminweg; Grundfreigabe öffentlicher KI.
//      WARUM NICHT CLAUDE ALS ANTWORT-KI: der volle Smoke bietet genau EIN Modell. Ein Modell prüft
//      sich nicht selbst (Unabhängigkeit, `Reasoner.referenzPruefer`) — mit Claude als Antwort-KI
//      wäre der Prüfstatus zu Recht „nicht prüfbar". Das belegt Schritt 6 als Gegenprobe.
//      Die Oberfläche sperrt den Fragenknopf ohne Antwortmodell (D-AISTATE); für Schritt 3 meldet
//      die Sonde deshalb NUR die Verfügbarkeit der Aufgabe „answer" (wie `h4-harness`). Server,
//      Antwort, Prüfung und Anzeige bleiben echt.
//   3. Frage per Tastatur → Antwort → tatsächlicher Prüfaufruf (`messung.modellaufrufe: 1`) →
//      Kennzeichnung und je Aussage ein Zustand.
//   4. 1280 × 800 und 390 × 844: Aussage → „Fundstelle und Begründung zeigen" per Tastatur →
//      Passage und Begründung → Escape → Fokus zurück; Fundstelle öffnen → Quelle in ihrer Fassung
//      → zurück: die Prüfung wird serverseitig bestätigt (kein neuer Modellaufruf nötig).
//   5. Kennzeichnung stimmt mit den Zuständen überein: „Quellen geprüft" genau dann, wenn jede
//      Aussage belegt ist.
//   6. Gegenprobe: Claude auch als Antwort-KI → sichtbar „nicht prüfbar" mit Grund
//      `pruefer_nicht_unabhaengig` und nächstem Schritt, nie „Quellen geprüft".
// Am Ende werden Zuordnung, Freigabe und Referenzliste auf den Vorher-Stand zurückgestellt.
//
// Zugang ausschließlich über die Betreiber-Einspeisung des vollen Smokes
// (`KLARWERK_SHIP_SMOKE_API_KEY`); diese Datei liest keinen Schlüssel. Im hermetischen Tor über
// `@modell` ausgenommen (benannt in `tests/smoke/tor-ausnahme.test.ts`). Nur Chromium.
// Zugesichert werden Ablauf, Bindung und ehrliche Anzeige — nicht, dass das Modell jedes Urteil
// trifft; die beobachteten Urteile stehen im Anhang.
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

test.skip(({ browserName }) => browserName !== "chromium", "Ein echter Lauf je Smoke genügt");

interface Zuordnung {
  global: string;
  perTask: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
  referenzpruefung?: string[];
}

interface Aussage {
  aussageId: string;
  zustand: string;
  fundstellen: { koId: string; koVersion: number }[];
}

interface Pruefung {
  status: string;
  grund?: string;
  aussagen: Aussage[];
  messung: { modellaufrufe: number };
  bindung?: { antwortFingerabdruck: string };
}

interface Antwort {
  result: { answered: boolean };
  aussagen?: { antwortFingerabdruck?: string };
  referenzpruefung?: Pruefung;
}

const ZUSTAENDE = ["belegt", "teilweise_belegt", "widersprochen", "nicht_pruefbar"];

async function fragen(page: Page, frage: string): Promise<Antwort> {
  await page.goto("/fragen");
  const eingabe = page.locator('[data-testid="page-fragen"] form input').first();
  await expect(eingabe).toBeVisible({ timeout: 30_000 });
  await eingabe.focus();
  await page.keyboard.type(frage);
  const antwort = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
    { timeout: 120_000 },
  );
  await page.keyboard.press("Enter");
  const r = await antwort;
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()) as Antwort;
}

async function ueberlauf(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

test("REF-04 · Antwort → Prüfmodell → Aussagezustand → Fundstelle → Rückweg mit echtem Prüfmodell @modell", async ({
  page,
}, testInfo) => {
  test.setTimeout(360_000);
  await ensureLoggedIn(page);
  const vorherR = await page.request.get("/api/reasoner/config");
  expect(vorherR.status()).toBe(200);
  const vorher = ((await vorherR.json()) as { taskConfig: Zuordnung }).taskConfig;
  const marke = Date.now().toString(36);
  const beleg: Record<string, unknown> = {
    auftrag: "produkt:20261009:referenzki-antwortstatus (REF-04, K9)",
    hinweis:
      "fiktive Testdaten; Zugangsdatum nur über die Betreiber-Einspeisung; Antwortweg intern deterministisch, Prüfmodell Claude",
  };

  try {
    // 1. Fiktive Quelle.
    const statement = `Im fiktiven Musterwerk Ostkai ${marke} wird die Hebebühne H9 vor jeder Schicht auf Hydrauliköl geprüft.`;
    const ko = await page.request.post("/api/kos", {
      data: {
        type: "best_practice",
        category: "Ref04",
        neededValidations: 1,
        confidentiality: "intern",
        title: `Hebebühne H9 Musterwerk Ostkai ${marke}`,
        statement,
      },
    });
    expect(ko.status(), await ko.text()).toBe(201);
    const koId = ((await ko.json()) as { id: string }).id;
    const bewertet = await page.request.put(`/api/kos/${koId}`, {
      data: { action: "rate", verdict: "up" },
    });
    expect(bewertet.status(), await bewertet.text()).toBeLessThan(300);

    // 2. Antwortweg intern, Referenz-KI Claude, Grundfreigabe.
    const zuordnung = await page.request.put("/api/reasoner/config", {
      data: {
        global: vorher.global,
        perTask: { ...vorher.perTask, answer: "deterministic" },
        kiFreigabe: {
          oeffentlicheKi: true,
          vertraulicheInhalte: vorher.kiFreigabe?.vertraulicheInhalte === true,
        },
      },
    });
    expect(zuordnung.status(), await zuordnung.text()).toBe(200);
    const liste = await page.request.put("/api/reasoner/referenzpruefung", {
      data: { liste: ["anthropic"] },
    });
    expect(liste.status(), await liste.text()).toBe(200);
    const lage = (await (await page.request.get("/api/reasoner/referenzpruefung")).json()) as {
      optionen: { wahl: string; modell: string | null; eingerichtet: boolean }[];
    };
    const claude = lage.optionen.find((o) => o.wahl === "anthropic");
    expect(claude?.eingerichtet, "Claude ist im vollen Smoke eingerichtet").toBe(true);
    beleg.pruefmodell = claude?.modell ?? null;

    // Nur die Verfügbarkeit der Aufgabe „answer" für die Fläche (s. Kopf, Schritt 2).
    await page.route("**/api/reasoner/status", async (route) => {
      const echt = await route.fetch();
      const daten = (await echt.json()) as { tasks?: Record<string, boolean> };
      await route.fulfill({
        response: echt,
        json: { ...daten, active: true, tasks: { ...(daten.tasks ?? {}), answer: true } },
      });
    });

    // 3. Frage → Antwort → echter Prüfaufruf.
    await page.setViewportSize({ width: 1280, height: 800 });
    const body = await fragen(
      page,
      `Wann wird die Hebebühne H9 im Musterwerk Ostkai ${marke} auf Hydrauliköl geprüft?`,
    );
    beleg.antwort = { answered: body.result.answered, referenzpruefung: body.referenzpruefung };
    expect(body.result.answered, "die fiktive Quelle trägt eine Antwort").toBe(true);
    const ref = body.referenzpruefung as Pruefung;
    expect(ref, "die Antwort trägt eine Referenzprüfung").toBeDefined();
    expect(ref.status, `Prüfstatus ${ref.status} (${ref.grund ?? "-"})`).toBe("geprueft");
    expect(ref.messung.modellaufrufe, "tatsächlicher Aufruf des Prüfmodells").toBe(1);
    expect(ref.bindung?.antwortFingerabdruck).toBe(body.aussagen?.antwortFingerabdruck);
    expect(ref.aussagen.length).toBeGreaterThan(0);
    for (const a of ref.aussagen) {
      expect(ZUSTAENDE).toContain(a.zustand);
    }
    const tragend = ref.aussagen.filter((a) => a.fundstellen.length > 0);
    expect(tragend.length, "mindestens eine Aussage mit Fundstelle").toBeGreaterThan(0);
    expect(tragend[0]?.fundstellen[0]?.koId).toBe(koId);

    // 5. Kennzeichnung ⇔ Zustände.
    const belegt = (a: Aussage): boolean => a.zustand === "belegt" && a.fundstellen.length > 0;
    const alleBelegt = ref.aussagen.every(belegt);
    const kennzeichen = page.getByTestId("quellenstatus-marke");
    await expect(kennzeichen).toHaveAttribute(
      "data-gesamt",
      alleBelegt ? "quellen_geprueft" : "gemischt",
      { timeout: 30_000 },
    );
    beleg.kennzeichnung = await kennzeichen.getAttribute("data-gesamt");

    // 4. Aussage → Fundstelle → zurück, Desktop und 390 × 844, per Tastatur.
    for (const [breite, hoehe] of [
      [1280, 800],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width: breite, height: hoehe });
      const aussage = page
        .locator(`[data-testid="referenzpruefung-aussage"]`)
        .filter({ has: page.getByTestId("referenzpruefung-fundstelle") })
        .first();
      const knopf = aussage.getByTestId("referenzpruefung-zur-fundstelle");
      await knopf.focus();
      await page.keyboard.press("Enter");
      const detail = aussage.getByTestId("referenzpruefung-fundstelle-detail");
      await expect(detail).toBeVisible();
      await expect(detail).toBeFocused();
      await expect(detail.getByTestId("referenzpruefung-passage")).toContainText("Hebebühne H9");
      await expect(detail.getByTestId("referenzpruefung-detail-begruendung")).not.toBeEmpty();
      expect(await ueberlauf(page)).toBe(false);
      await testInfo.attach(`referenzki-antwortstatus-${breite}x${hoehe}.png`, {
        body: await page.screenshot({ fullPage: false }),
        contentType: "image/png",
      });
      await page.keyboard.press("Escape");
      await expect(detail).toBeHidden();
      await expect(knopf).toBeFocused();
    }

    // Rückweg über die Quelle in ihrer Fassung: die Prüfung steht danach bestätigt wieder da.
    await page.setViewportSize({ width: 1280, height: 800 });
    const aussage = page
      .locator(`[data-testid="referenzpruefung-aussage"]`)
      .filter({ has: page.getByTestId("referenzpruefung-fundstelle") })
      .first();
    const link = aussage.getByTestId("referenzpruefung-fundstelle").first();
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/wissen/${koId}\\?fassung=\\d+`), { timeout: 30_000 });
    await page.goBack();
    await expect(page.getByTestId("referenzpruefung")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("quellenstatus-marke")).toHaveAttribute(
      "data-gesamt",
      String(beleg.kennzeichnung),
      { timeout: 60_000 },
    );

    // 6. Gegenprobe: dasselbe Modell als Antwort-KI → kein Vier-Augen-Ergebnis.
    await page.unroute("**/api/reasoner/status");
    const gleich = await page.request.put("/api/reasoner/config", {
      data: {
        global: vorher.global,
        perTask: { ...vorher.perTask, answer: "anthropic" },
      },
    });
    expect(gleich.status(), await gleich.text()).toBe(200);
    const zweit = await fragen(
      page,
      `Was wird an der Hebebühne H9 im Musterwerk Ostkai ${marke} vor jeder Schicht geprüft?`,
    );
    beleg.gegenprobe = {
      answered: zweit.result.answered,
      referenzpruefung: zweit.referenzpruefung,
    };
    if (zweit.result.answered && zweit.referenzpruefung) {
      expect(zweit.referenzpruefung.status).toBe("nicht_pruefbar");
      expect(zweit.referenzpruefung.grund).toBe("pruefer_nicht_unabhaengig");
      await expect(page.getByTestId("quellenstatus-marke")).toHaveAttribute(
        "data-gesamt",
        "nicht_pruefbar",
        { timeout: 30_000 },
      );
      await expect(page.getByTestId("referenzpruefung-naechster")).toContainText("anderen Modell");
    }
    await expect(
      page.locator('[data-testid="quellenstatus-marke"][data-gesamt="quellen_geprueft"]'),
    ).toHaveCount(0);
  } finally {
    await testInfo.attach("referenzki-antwortstatus-beleg.json", {
      body: JSON.stringify(beleg, null, 2),
      contentType: "application/json",
    });
    await page.unroute("**/api/reasoner/status").catch(() => undefined);
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
