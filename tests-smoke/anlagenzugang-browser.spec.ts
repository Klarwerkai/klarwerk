import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn } from "./support/auth";

// ================================================================================================
// R-1631 / R-1647 / R-2174 (aufnahme:20260922:gesamt-anlagenzugang) — ANLAGENWISSEN PER QR-CODE,
// IN DER ECHTEN APP.
// ================================================================================================
//
// Geklickt und aufgerufen wird gegen den echten Smoke-Server und das gebaute Bündel:
//   B1 · Am Wissen einer Anlage steht im Abschnitt „Kopplung und Anlagen" der QR-Code (sichtbar,
//        mit Modulen), daneben der Weg „Wissen dieser Anlage öffnen". Der Klick führt in die
//        Bibliothek, die genau das Wissen dieser Anlage zeigt — das einer anderen Anlage nicht.
//   B2 · Die Adresse, die der Code trägt, direkt aufgerufen wie nach einem Scan — auf
//        Telefonbreite und nach einem Neuladen: dieselbe Auswahl.
//   B3 · R-1631 (Ben Nacharbeit 1): Bauteil-Code und Geltungskontext. Der Code eines Bauteils mit
//        Standort öffnet das allgemeine und das am Standort geltende Wissen; die Kontextleiste
//        wechselt im Browser auf eine Schicht, und das Neuladen behält die Wahl.
//
// WAS NICHT GEMESSEN IST, ausdrücklich: das Scannen eines gedruckten Etiketts mit einer echten
// Telefonkamera. Dass der Code GENAU diese Adresse trägt, liest
// `tests/anlagenzugang/qr-in-der-wissensansicht-mounted.test.tsx` am gerenderten SVG mit einem
// unabhängigen Leser zurück; die Kamera selbst bleibt eine menschliche Probe.
//
// Jeder Lauf trägt eine frische Marke: der Smoke-Server hält seinen Bestand über alle Fälle.

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

async function legeAn(
  request: APIRequestContext,
  title: string,
  asset: string,
  anlagenkontext?: Record<string, string[]>,
): Promise<{ id: string }> {
  const antwort = await request.post("/api/kos", {
    data: {
      title,
      statement: `Aussage zu ${title}. Sie ist lang genug, um die Formprüfung zu bestehen.`,
      type: "best_practice",
      category: "Instandhaltung",
      tags: ["anlagenzugang"],
      asset,
      ...(anlagenkontext ? { anlagenkontext } : {}),
      confidentiality: "intern",
    },
  });
  expect(
    antwort.ok(),
    `Anlegen von „${title}" scheiterte: ${antwort.status()} ${await antwort.text()}`,
  ).toBe(true);
  return (await antwort.json()) as { id: string };
}

function zeilenIds(page: Page) {
  return page.locator('[data-testid="bib-zeile"]');
}

test.describe("Anlagenzugang · QR-Code und Anlagenauswahl in der echten App", () => {
  test("B1: QR-Code am Wissen, der Weg daneben öffnet genau diese Anlage", async ({ page }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const anlage = `Smoke Linie ${m} / DP-4`;
    const a = await legeAn(page.request, `Dosierpumpe entlüften ${m}`, anlage);
    const b = await legeAn(page.request, `Dosiermenge prüfen ${m}`, anlage);
    const fremd = await legeAn(page.request, `Spindel schmieren ${m}`, `Smoke Fräse ${m}`);

    await page.goto(`/wissen/${a.id}`);
    await expect(page.getByTestId("bib-lesen")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("bib-mehr").click();
    await page.locator('[data-bib-abschnitt="kopplung"] > summary').click();

    const bild = page.getByTestId("anlagen-qr-bild");
    await expect(bild, "kein QR-Code im Abschnitt „Kopplung und Anlagen“").toBeVisible({
      timeout: 15_000,
    });
    expect(await bild.getAttribute("aria-label")).toContain(anlage);
    const pfad = (await bild.locator("path").getAttribute("d")) ?? "";
    expect(pfad.length, "der QR-Code hat keine Module").toBeGreaterThan(100);
    const box = await bild.boundingBox();
    expect(box?.width ?? 0, "der QR-Code ist zu klein, um ihn abzulesen").toBeGreaterThanOrEqual(
      100,
    );

    await page.getByTestId("anlagen-qr-oeffnen").click();
    await expect(page).toHaveURL(/\/bibliothek\?anlage=/);
    const zeilen = zeilenIds(page);
    await expect(zeilen).toHaveCount(2, { timeout: 15_000 });
    const ids = await zeilen.evaluateAll((els) => els.map((e) => e.getAttribute("data-bib-id")));
    expect(ids.sort()).toEqual([a.id, b.id].sort());
    expect(ids).not.toContain(fremd.id);
  });

  test("B2: die Adresse des Codes, direkt geöffnet auf Telefonbreite und neu geladen", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const anlage = `Smoke Presse ${m}`;
    const a = await legeAn(page.request, `Werkzeugwechsel ${m}`, anlage);
    await legeAn(page.request, `Ölstand prüfen ${m}`, `Smoke Säge ${m}`);

    await page.setViewportSize({ width: 390, height: 844 });
    const p = new URLSearchParams();
    p.set("anlage", anlage);
    await page.goto(`/bibliothek?${p.toString()}`);
    const zeilen = zeilenIds(page);
    await expect(zeilen).toHaveCount(1, { timeout: 15_000 });
    await expect(zeilen.first()).toHaveAttribute("data-bib-id", a.id);

    await page.reload();
    await expect(zeilen).toHaveCount(1, { timeout: 15_000 });
    await expect(zeilen.first()).toHaveAttribute("data-bib-id", a.id);
  });

  test("B3: Bauteil-Code mit Standort, Schicht in der Kontextleiste, Neuladen behält sie", async ({
    page,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const anlage = `Smoke Linie ${m}`;
    const bauteil = `BT-${m}`;
    const allgemein = await legeAn(page.request, `Lager prüfen ${m}`, anlage, {
      bauteile: [bauteil],
    });
    const nord = await legeAn(page.request, `Lager Nord ${m}`, anlage, {
      bauteile: [bauteil],
      standorte: ["Werk Nord"],
    });
    await legeAn(page.request, `Lager Süd ${m}`, anlage, {
      bauteile: [bauteil],
      standorte: ["Werk Süd"],
    });
    const nacht = await legeAn(page.request, `Lager Nacht ${m}`, anlage, {
      bauteile: [bauteil],
      schichten: ["Nacht"],
    });
    const frueh = await legeAn(page.request, `Lager Früh ${m}`, anlage, {
      bauteile: [bauteil],
      schichten: ["Früh"],
    });

    const p = new URLSearchParams();
    p.set("bauteil", bauteil);
    p.set("standort", "Werk Nord");
    await page.goto(`/bibliothek?${p.toString()}`);
    const zeilen = zeilenIds(page);
    const ids = async (): Promise<(string | null)[]> =>
      (await zeilen.evaluateAll((els) => els.map((e) => e.getAttribute("data-bib-id")))).sort();
    await expect(zeilen).toHaveCount(4, { timeout: 15_000 });
    expect(await ids()).toEqual([allgemein.id, nord.id, nacht.id, frueh.id].sort());

    await expect(page.getByTestId("bib-kontext")).toBeVisible();
    await page.getByTestId("bib-kontext-schicht").selectOption("Nacht");
    await expect(page).toHaveURL(/schicht=Nacht/);
    await expect(zeilen).toHaveCount(3, { timeout: 15_000 });
    expect(await ids()).toEqual([allgemein.id, nord.id, nacht.id].sort());

    await page.reload();
    await expect(zeilen).toHaveCount(3, { timeout: 15_000 });
    expect(await ids()).toEqual([allgemein.id, nord.id, nacht.id].sort());
    await expect(page.getByTestId("bib-kontext-standort")).toHaveValue("Werk Nord");
  });
});
