import { type APIRequestContext, type Page, expect, test } from "@playwright/test";

import { SMOKE_PASS, ensureLoggedIn } from "./support/auth";

// ================================================================================================
// ÄNDERUNGSFOLGEN IN DER ECHTEN APP — Reiter „Erneut": melden, begründen, neue Änderung, Abschluss.
// ================================================================================================
//
// Geklickt wird im echten Browser gegen den echten Smoke-Server (produkt:20261010:
// aenderungsfolgen-sichtbar). Ausschließlich fiktive Testdaten; jeder Lauf hat eigene Namen.
//
// DIE KULISSE: eine fiktive Quelle „Dosierstation <Lauf>" mit ZWEI gekoppelten internen Einträgen
// (A, B), einem gekoppelten VERTRAULICHEN Eintrag (D) und einem UNBETEILIGTEN Eintrag an einer
// anderen Anlage (C).
//
//   K8/K1/K2 · Die Änderung wird in der Fläche gemeldet (mit Änderungsbeleg); A und B stehen mit
//              Grund, Zuständigkeit und Stand in der Liste, C nicht; die Karte begründet.
//   K8/K5    · Während die Karte Stand 1 zeigt, geht eine weitere Änderung ein: „Noch gültig"
//              wird abgelehnt und sagt es; nach dem Neuladen steht Stand 2.
//   K8/K7    · Dieselbe Meldung noch einmal: der Stand bleibt.
//   K8/K5    · Abschluss des neuen Stands: A verschwindet aus der Liste, B bleibt offen.
//   K8/K4    · Getrennte Sichtbarkeit: eine Leserin sieht A/B, aber D nirgends.
//
// WAS HIER NICHT SIMULIERT IST: alle Schritte laufen gegen den Server; die „weitere Änderung" kommt
// über denselben öffentlichen Weg (`POST /api/lifecycle/asset-changed`), den die Fläche benutzt —
// nur eben von einer zweiten Stelle, während die erste die Karte offen hat.

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function eintrag(
  request: APIRequestContext,
  titel: string,
  stufe = "intern",
): Promise<string> {
  const res = await request.post("/api/kos", {
    data: {
      confidentiality: stufe,
      title: titel,
      statement: `${titel}: fiktive Arbeitsanweisung, vor jeder Schicht zu prüfen.`,
      type: "best_practice",
      category: "Dosierung",
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function koppeln(request: APIRequestContext, assetRef: string, koId: string) {
  const res = await request.post("/api/lifecycle/couple", { data: { assetRef, koId } });
  expect(res.status(), await res.text()).toBe(204);
}

interface Fall {
  koId: string;
  stand: number;
  anlaesse: { aenderung: string | null }[];
}

async function faelle(request: APIRequestContext, kopf?: Record<string, string>): Promise<Fall[]> {
  const res = await request.get("/api/lifecycle/folgepruefung", kopf ? { headers: kopf } : {});
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as Fall[];
}

function zeile(page: Page, titel: string) {
  return page.getByTestId("pruefen-warteschlange-eintrag").filter({ hasText: titel });
}

test.describe("Änderungsfolgen · der Weg im Reiter „Erneut“", () => {
  test("melden, begründen, neue Änderung während der Prüfung, Wiederholung, Abschluss, Sichtbarkeit", async ({
    page,
    request,
  }) => {
    await ensureLoggedIn(page);
    const m = marke();
    const anlage = `Dosierstation ${m}`;
    const titelA = `Dosierpumpe ${m} entlüften`;
    const titelB = `Dosiermenge ${m} einstellen`;
    const titelC = `Förderband ${m} spannen`;
    const titelD = `Rezepturgrenzen ${m}`;

    const a = await eintrag(page.request, titelA);
    const b = await eintrag(page.request, titelB);
    const c = await eintrag(page.request, titelC);
    const d = await eintrag(page.request, titelD, "vertraulich");
    await koppeln(page.request, anlage, a);
    await koppeln(page.request, anlage, b);
    await koppeln(page.request, anlage, d);
    await koppeln(page.request, `Förderband ${m}`, c);

    // ---- Melden in der Fläche ------------------------------------------------------------------
    await page.goto("/lebenszyklus");
    await expect(page.getByTestId("pruefen-flaeche")).toBeVisible({ timeout: 15_000 });
    const melden = page.getByTestId("pruefen-anlage");
    await melden.locator("summary").click();
    await melden.locator("input").nth(0).fill(anlage);
    await melden.locator("input").nth(1).fill("Rev. B");
    await melden.getByRole("button").click();
    await expect(page.getByTestId("pruefen-quittung")).toBeVisible();

    // ---- K1/K2/K3: Liste und Karte -------------------------------------------------------------
    await expect(zeile(page, titelA)).toBeVisible({ timeout: 15_000 });
    await expect(zeile(page, titelB)).toBeVisible();
    await expect(zeile(page, titelC), "der unbeteiligte Eintrag").toHaveCount(0);
    await expect(zeile(page, titelA).getByTestId("folgepruefung-zeile")).toContainText(
      "Smoke Tester",
    );
    await zeile(page, titelA).click();
    const warum = page.getByTestId("pruefen-karte").getByTestId("folgepruefung-warum");
    await expect(warum).toContainText(anlage);
    await expect(warum).toContainText("Rev. B");
    await page.screenshot({ path: test.info().outputPath("1-begruendung.png"), fullPage: true });

    // ---- K5: weitere Änderung, während die Karte Stand 1 zeigt ---------------------------------
    expect((await faelle(page.request)).find((f) => f.koId === a)?.stand).toBe(1);
    const weitere = await page.request.post("/api/lifecycle/asset-changed", {
      data: { assetRef: anlage, aenderung: "Rev. C" },
    });
    expect(weitere.status(), await weitere.text()).toBe(200);
    await page.getByTestId("pruefen-knopf-noch-gueltig").click();
    // Die Einblendung `folgepruefung.standVeraltet` — in jeder der drei Sprachen.
    await expect(
      page.locator("output").filter({ hasText: /Nicht bestätigt|Not confirmed|Niet bevestigd/ }),
    ).toBeVisible({ timeout: 10_000 });
    const nachAblehnung = (await faelle(page.request)).find((f) => f.koId === a);
    expect(nachAblehnung?.stand).toBe(2);
    expect(nachAblehnung?.anlaesse.map((x) => x.aenderung)).toEqual(["Rev. B", "Rev. C"]);
    await expect(warum).toContainText("Rev. C", { timeout: 10_000 });
    await page.screenshot({ path: test.info().outputPath("2-neue-aenderung.png"), fullPage: true });

    // ---- K7: dieselbe Meldung noch einmal ------------------------------------------------------
    const wiederholt = await page.request.post("/api/lifecycle/asset-changed", {
      data: { assetRef: anlage, aenderung: "Rev. C" },
    });
    expect(wiederholt.status()).toBe(200);
    expect((await faelle(page.request)).find((f) => f.koId === a)?.stand).toBe(2);

    // ---- K4: getrennte Sichtbarkeit (Leserin) --------------------------------------------------
    const leserin = `leserin-${m}@folgen.test`;
    const konto = await page.request.post("/api/users", {
      data: { name: `Lea ${m}`, email: leserin, password: SMOKE_PASS, role: "viewer" },
    });
    expect(konto.status(), await konto.text()).toBe(201);
    const anmeldung = await request.post("/api/auth/login", {
      data: { email: leserin, password: SMOKE_PASS },
    });
    expect(anmeldung.status(), await anmeldung.text()).toBe(200);
    const token = ((await anmeldung.json()) as { token: string }).token;
    const alsLeserin = await faelle(request, { authorization: `Bearer ${token}` });
    const sichtbar = alsLeserin.map((f) => f.koId);
    expect(sichtbar).toContain(a);
    expect(sichtbar).toContain(b);
    expect(JSON.stringify(alsLeserin)).not.toContain(d);
    expect(JSON.stringify(alsLeserin)).not.toContain(titelD);

    // ---- K5: Abschluss des NEUEN Stands --------------------------------------------------------
    await page.reload();
    await zeile(page, titelA).click();
    await expect(
      page.getByTestId("pruefen-karte").getByTestId("folgepruefung-status"),
    ).toContainText(/(Stand|state|stand) 2/);
    await page.getByTestId("pruefen-knopf-noch-gueltig").click();
    await expect(zeile(page, titelA)).toHaveCount(0, { timeout: 15_000 });
    await expect(zeile(page, titelB), "der Nachbar bleibt offen").toBeVisible();
    const danach = await faelle(page.request);
    expect(danach.map((f) => f.koId)).not.toContain(a);
    expect(danach.map((f) => f.koId)).toContain(b);
    await page.screenshot({ path: test.info().outputPath("3-abschluss.png"), fullPage: true });
  });
});
