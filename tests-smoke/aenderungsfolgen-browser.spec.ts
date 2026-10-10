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

    // ---- Nacharbeit 6 (Ben, S02/AW-08): Quellenvergleich und bewusste Übernahme in der Anleitung --
    // Eine fiktive Anleitung bindet Eintrag A in seiner bisherigen Fassung und ist entschieden. Dann
    // ändert sich A (neue Fassung). In der ECHTEN Anleitungsfläche werden verwendete und neue
    // Fassung gezeigt, die Unterschiede angesehen und die neue Fassung bewusst übernommen. Danach:
    // neue Bindung, festgehaltener Vorstand lesbar, Anleitung wieder Entwurf (erneute Entscheidung
    // nötig) und die Folgeprüfung von A weiter offen, bis jemand den angezeigten Stand bestätigt.
    const fassungAlt = (
      (await (await page.request.get(`/api/kos/${a}`)).json()) as {
        version: number;
      }
    ).version;
    const angelegt = await page.request.post("/api/gesamtanweisungen", {
      data: { titel: `Dosieranleitung ${m}`, zweck: "Fiktive Anleitung für die Abnahme." },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const anleitung = (await angelegt.json()) as { id: string; version: number };
    const mitAbschnitt = await page.request.post(
      `/api/gesamtanweisungen/${anleitung.id}/bausteine`,
      { data: { version: anleitung.version, koId: a, koVersion: fassungAlt } },
    );
    expect(mitAbschnitt.status(), await mitAbschnitt.text()).toBe(200);
    const nachAbschnitt = (await mitAbschnitt.json()) as { version: number };
    // Auch die Testvorbereitung folgt dem vorhandenen Weg: erst vorlegen, dann entscheiden.
    const vorlegen = await page.request.post(`/api/gesamtanweisungen/${anleitung.id}/vorlegen`, {
      data: { version: nachAbschnitt.version },
    });
    expect(vorlegen.status(), await vorlegen.text()).toBe(200);
    const vorgelegt = (await vorlegen.json()) as { version: number };
    const entschieden = await page.request.post(
      `/api/gesamtanweisungen/${anleitung.id}/entscheiden`,
      { data: { version: vorgelegt.version, entscheidung: "angenommen" } },
    );
    expect(entschieden.status(), await entschieden.text()).toBe(200);
    const standEntschieden = ((await entschieden.json()) as { version: number }).version;

    // Die Quelle A ändert sich: eine neue Fassung des Eintrags.
    const quellaenderung = await page.request.put(`/api/kos/${a}`, {
      data: {
        action: "revise",
        changes: { statement: `${titelA}: nach Rev. C mit angepasster Dosiermenge (fiktiv).` },
      },
    });
    expect(quellaenderung.status(), await quellaenderung.text()).toBe(200);
    const fassungNeu = fassungAlt + 1;

    await page.goto(`/gesamtanweisungen/${anleitung.id}`);
    const aenderungskarte = page.getByTestId("ga-lesestand-aenderung").first();
    await expect(aenderungskarte).toBeVisible({ timeout: 15_000 });
    await expect(aenderungskarte.getByTestId("ga-lesestand-aenderung-bisher")).toContainText(
      String(fassungAlt),
    );
    await expect(aenderungskarte.getByTestId("ga-lesestand-aenderung-neu")).toContainText(
      String(fassungNeu),
    );
    await aenderungskarte
      .getByRole("button", { name: /Unterschiede ansehen|View differences|Verschillen bekijken/ })
      .click();
    await expect(aenderungskarte.getByTestId("ga-lesestand-weiterhin")).toBeVisible();
    const unterschiede = aenderungskarte.getByTestId("ga-lesestand-unterschiede");
    await expect(unterschiede).toContainText("vor jeder Schicht zu prüfen", { timeout: 10_000 });
    await expect(unterschiede).toContainText("angepasster Dosiermenge");
    await page.screenshot({
      path: test.info().outputPath("2b-quellenvergleich.png"),
      fullPage: true,
    });
    await aenderungskarte
      .getByRole("button", {
        name: new RegExp(
          `Fassung ${fassungNeu} übernehmen|Adopt version ${fassungNeu}|Versie ${fassungNeu} overnemen`,
        ),
      })
      .click();
    await expect(page.getByTestId("ga-lesestand-aenderung")).toHaveCount(0, { timeout: 15_000 });
    await page.screenshot({ path: test.info().outputPath("2c-uebernommen.png"), fullPage: true });

    // Bewusst übernommene Bindung und erneute Entscheidungspflicht der Anleitung (vom Server).
    const lesestand = (await (
      await page.request.get(`/api/gesamtanweisungen/${anleitung.id}`)
    ).json()) as {
      version: number;
      stand: string;
      bausteine: { koId: string; koVersion: number }[];
      uebernommeneAenderungen: { vonFassung: number; aufFassung: number }[] | null;
    };
    expect(lesestand.bausteine.find((x) => x.koId === a)?.koVersion).toBe(fassungNeu);
    expect(lesestand.stand).toBe("entwurf");
    expect(lesestand.uebernommeneAenderungen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ vonFassung: fassungAlt, aufFassung: fassungNeu }),
      ]),
    );
    // Der festgehaltene, entschiedene Vorstand bleibt lesbar und vergleichbar.
    const staende = (await (
      await page.request.get(`/api/gesamtanweisungen/${anleitung.id}/staende`)
    ).json()) as { staende: number[] };
    expect(staende.staende).toContain(standEntschieden);
    const vergleich = await page.request.get(
      `/api/gesamtanweisungen/${anleitung.id}/vergleich?von=${standEntschieden}&bis=${lesestand.version}`,
    );
    expect(vergleich.status(), await vergleich.text()).toBe(200);
    expect(((await vergleich.json()) as { befunde: unknown[] }).befunde.length).toBeGreaterThan(0);
    // Erneute Prüfpflicht des Eintrags: die Folgeprüfung bleibt offen.
    expect(
      (await faelle(page.request)).find((f) => f.koId === a)?.stand,
      "Prüfpflicht bleibt",
    ).toBe(2);
    await page.goto("/lebenszyklus");
    await expect(page.getByTestId("pruefen-flaeche")).toBeVisible({ timeout: 15_000 });
    // Verborgene Verwendung: der vertrauliche Eintrag D ist ebenso betroffen — sichtbar nur für
    // Berechtigte (hier: Verwaltung), für die Leserin unten nicht.
    expect((await faelle(page.request)).map((f) => f.koId)).toContain(d);
    await page.reload();
    await zeile(page, titelA).click();
    await expect(
      page.getByTestId("pruefen-karte").getByTestId("folgepruefung-warum"),
    ).toContainText("→", { timeout: 10_000 });

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
