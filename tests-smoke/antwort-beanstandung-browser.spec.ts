import { type APIRequestContext, type Browser, type Page, expect, test } from "@playwright/test";

import { ensureLoggedIn, workspaceMarker } from "./support/auth";

// ================================================================================================
// BEANSTANDETE ANTWORT BIS ZUR BEGRÜNDETEN RÜCKMELDUNG — IM ECHTEN BROWSER
// (produkt:20261010:antwort-beanstandung-korrektur).
// ================================================================================================
//
// Gegen den Smoke-Server des geprüften Kandidaten, mit GETRENNTEN fiktiven Rollen in eigenen
// Browserkontexten: Melda und Melvin (melden, Experte) · Fachmann (Autor der Quelle = zuständig,
// Experte) · Smoke-Admin (legt Konten an) · Prüfende (Controller, bewerten über die vorhandene Route).
//
//   Fiktive falsche Aussage in einer echten, geprüften Quelle → Melda und Melvin fragen und
//   beanstanden dieselbe Aussage (über die Antwort-/Meldeschnittstelle der EIGENEN Sitzung, dieselbe,
//   die die Fragenseite benutzt) → EIN Vorgang, zuständig der Fachmann → Fachmann sieht im Vorgang
//   Aussage und beide Begründungen, stellt eine Rückfrage an GENAU Meldas Meldung → Melda antwortet in
//   der Oberfläche → Melvin sieht weder Rückfrage noch Meldas Begründung → Fachmann weist begründet
//   zurück → Melda bekommt in der Glocke genau EINE Rückmeldung „zurückgewiesen“ und liest die
//   Begründung im Vorgang.
//
// WAS NICHT GEMESSEN IST: das Meldeformular an der Antwort auf der Fragenseite selbst (gemountet in
// `tests/antwort-beanstandung/beanstandung-flaeche-mounted.test.tsx`), der Korrekturweg mit neuer
// Fassung (am Draht und gegen PostgreSQL), ein Lauf mit echtem KI-Anbieter, und ob Menschen die
// Fläche verstehen. Zustand anlegend — läuft im isolierten Kontext (`chromium-zustand`). Alle
// Konten und Inhalte sind erfundene Testdaten mit Laufmarke.

const PASS = "Beanstandung-Passwort-1";

function marke(): string {
  const buchstaben = "abcdefghijklmnopqrstuvwxyz";
  let raus = "";
  for (let i = 0; i < 8; i += 1) {
    raus += buchstaben[Math.floor(Math.random() * buchstaben.length)];
  }
  return raus;
}

async function bild(page: Page, name: string): Promise<void> {
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

async function beleg(name: string, daten: unknown): Promise<void> {
  await test.info().attach(name, {
    body: JSON.stringify(daten, null, 2),
    contentType: "application/json",
  });
}

async function kontoAnlegen(
  admin: APIRequestContext,
  name: string,
  email: string,
  role: string,
): Promise<string> {
  const res = await admin.post("/api/users", { data: { name, email, password: PASS, role } });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function anmelden(browser: Browser, email: string): Promise<Page> {
  const adresse = test.info().project.use.baseURL;
  const kontext = await browser.newContext(adresse === undefined ? {} : { baseURL: adresse });
  const seite = await kontext.newPage();
  await seite.goto("/");
  await expect(seite.locator('input[type="password"]').first()).toBeVisible({ timeout: 15_000 });
  await seite.locator('input[type="email"]').fill(email);
  await seite.locator('input[type="password"]').first().fill(PASS);
  await seite.locator('button[type="submit"]').click();
  await expect(workspaceMarker(seite)).toBeVisible({ timeout: 15_000 });
  if (await seite.getByTestId("notice-ack").count()) {
    await seite.getByTestId("notice-ack").click();
  }
  return seite;
}

async function vorgangOeffnen(seite: Page, gapId: string): Promise<void> {
  await seite.goto(`/luecke/${gapId}`);
  await expect(seite.getByTestId("luecke-vorgang-stand")).toBeVisible({ timeout: 15_000 });
}

interface Quittung {
  meldungId: string;
  zugestelltAn: string;
  beanstandung?: {
    vorgangId: string;
    koVersion: number | null;
    zusammengefuehrt: boolean;
    zustaendigkeit: string;
  };
}

/** Fragen und die erste Aussage mit ihrer Fundstelle beanstanden — in der Sitzung des Melders. */
async function fragenUndBeanstanden(
  seite: Page,
  titel: string,
  koId: string,
  begruendung: string,
): Promise<Quittung> {
  const gefragt = await seite.request.post("/api/ask", { data: { question: titel } });
  expect(gefragt.status(), await gefragt.text()).toBe(200);
  const antwort = (await gefragt.json()) as {
    receipt: string;
    result: { citedSources?: string[] };
    aussagen?: {
      aussagen: {
        aussageId: string;
        text: string;
        teile: { fundstellen: { fundstelleId: string; koId: string }[] }[];
      }[];
    };
  };
  expect(antwort.result.citedSources ?? [], "KALIBRIERUNG: die Quelle trägt").toContain(koId);
  const aussage = antwort.aussagen?.aussagen[0];
  expect(aussage, "KALIBRIERUNG: die Antwort trägt eine gebundene Aussage").toBeDefined();
  const fundstelle = aussage?.teile.flatMap((t) => t.fundstellen).find((f) => f.koId === koId);
  const gemeldet = await seite.request.post("/api/ask/report", {
    data: {
      koId,
      receipt: antwort.receipt,
      grund: "antwort-falsch",
      aussage: {
        aussageId: aussage?.aussageId ?? "",
        text: aussage?.text ?? "",
        ...(fundstelle ? { fundstelleId: fundstelle.fundstelleId } : {}),
      },
      begruendung,
    },
  });
  expect(gemeldet.status(), await gemeldet.text()).toBe(200);
  return (await gemeldet.json()) as Quittung;
}

test("Beanstandung: melden, zuordnen, adressierte Rückfrage, begründete Zurückweisung, Rückmeldung", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  await ensureLoggedIn(page);
  const m = marke();
  const titel = `Spindel ${m} schmieren`;
  const falsch = `Die Spindel ${m} wird alle 40 Betriebsstunden im laufenden Betrieb geschmiert.`;
  const grundMelda = `Laut Wartungsblatt ${m} nur im Stillstand.`;
  const grundMelvin = `Im Betrieb ist das Schmieren an der Spindel ${m} nicht zulässig.`;
  const rueckfrageText = `Welche Ausgabe des Wartungsblatts ${m} liegt dir vor?`;
  const zurueckweisung = `Für Baujahr 2024 gilt laut Ausgabe 4 das 40-Stunden-Intervall (${m}).`;

  await kontoAnlegen(page.request, `Melda ${m}`, `melda-${m}@beanstandung.test`, "experte");
  await kontoAnlegen(page.request, `Melvin ${m}`, `melvin-${m}@beanstandung.test`, "experte");
  await kontoAnlegen(page.request, `Fachmann ${m}`, `fachmann-${m}@beanstandung.test`, "experte");
  const pruefende: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const mail = `pruefer${i}-${m}@beanstandung.test`;
    await kontoAnlegen(page.request, `Prüfer ${i} ${m}`, mail, "controller");
    pruefende.push(mail);
  }

  const melda = await anmelden(browser, `melda-${m}@beanstandung.test`);
  const melvin = await anmelden(browser, `melvin-${m}@beanstandung.test`);
  const fachmann = await anmelden(browser, `fachmann-${m}@beanstandung.test`);
  try {
    // ---- Eine echte, geprüfte Quelle mit der fiktiven falschen Aussage ------------------------
    const angelegt = await fachmann.request.post("/api/kos", {
      data: {
        confidentiality: "intern",
        title: titel,
        statement: falsch,
        type: "best_practice",
        category: "Instandhaltung",
      },
    });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    const ko = (await angelegt.json()) as { id: string; neededValidations: number };
    for (const mail of pruefende.slice(0, ko.neededValidations)) {
      const login = await request.post("/api/auth/login", {
        data: { email: mail, password: PASS },
      });
      expect(login.status(), await login.text()).toBe(200);
      const token = ((await login.json()) as { token: string }).token;
      const bewertet = await request.put(`/api/kos/${ko.id}`, {
        headers: { authorization: `Bearer ${token}` },
        data: { action: "rate", verdict: "up" },
      });
      expect(bewertet.status(), await bewertet.text()).toBe(200);
    }

    // ---- Zwei Melder, dieselbe Aussage → EIN Vorgang, zuständig der Fachmann -------------------
    const q1 = await fragenUndBeanstanden(melda, titel, ko.id, grundMelda);
    const q2 = await fragenUndBeanstanden(melvin, titel, ko.id, grundMelvin);
    await beleg("quittungen", { melda: q1, melvin: q2 });
    expect(q1.beanstandung).toMatchObject({
      koVersion: 1,
      zusammengefuehrt: false,
      zustaendigkeit: "zugeordnet",
    });
    const gapId = q1.beanstandung?.vorgangId ?? "";
    expect(q2.beanstandung).toMatchObject({ vorgangId: gapId, zusammengefuehrt: true });

    // ---- Fachmann: Aussage und beide Begründungen; Rückfrage an GENAU Meldas Meldung ------------
    await vorgangOeffnen(fachmann, gapId);
    await expect(fachmann.getByTestId("luecke-beanstandung-aussage")).toContainText(
      "40 Betriebsstunden",
    );
    await expect(fachmann.getByTestId("luecke-beanstandung-grund")).toHaveCount(2);
    await expect(fachmann.getByTestId("luecke-beanstandung")).not.toContainText(`Melda ${m}`);
    await bild(fachmann, "1-fachmann-beanstandung");
    await fachmann.getByTestId("luecke-rueckfrage-meldung").selectOption(q1.meldungId);
    await fachmann.getByTestId("luecke-rueckfrage-text").fill(rueckfrageText);
    await fachmann.getByRole("button", { name: "Rückfrage senden" }).click();
    await expect(fachmann.getByTestId("luecke-rueckfrage")).toContainText(rueckfrageText, {
      timeout: 15_000,
    });
    await bild(fachmann, "2-fachmann-rueckfrage-an-melda");

    // ---- Melda: Glocke → Vorgang → Antwort --------------------------------------------------
    await melda.goto("/start");
    await melda.getByTestId("kopfband-meldungen").click();
    const anMelda = melda.locator(
      '[data-testid="meldung-oeffnen"][data-art="luecke"]:has([data-luecken-art="rueckfrage"])',
    );
    await expect(anMelda).toHaveCount(1, { timeout: 15_000 });
    await anMelda.click();
    await expect(melda).toHaveURL(new RegExp(`/luecke/${gapId}`), { timeout: 15_000 });
    await expect(melda.getByTestId("luecke-rueckfrage")).toContainText(rueckfrageText);
    await melda.getByTestId("luecke-rueckfrage-antwort").fill(`Ausgabe 3 (${m}).`);
    await melda.getByRole("button", { name: "Antwort senden" }).click();
    await expect(melda.getByTestId("luecke-rueckfrage")).toContainText(`Ausgabe 3 (${m}).`, {
      timeout: 15_000,
    });
    await bild(melda, "3-melda-rueckfrage-beantwortet");

    // ---- Melvin: eigener Vorgang ohne Meldas Rückfrage, Antwort und Begründung ----------------
    await vorgangOeffnen(melvin, gapId);
    await expect(melvin.getByTestId("luecke-beanstandung-eigene")).toContainText(grundMelvin);
    await expect(melvin.getByTestId("luecke-rueckfrage")).toHaveCount(0);
    await expect(melvin.locator("body")).not.toContainText(rueckfrageText);
    await expect(melvin.locator("body")).not.toContainText(grundMelda);
    await expect(melvin.locator("body")).not.toContainText(`Ausgabe 3 (${m}).`);
    await bild(melvin, "4-melvin-nur-eigene-meldung");

    // ---- Fachmann weist begründet zurück -----------------------------------------------------
    await vorgangOeffnen(fachmann, gapId);
    await fachmann.getByTestId("luecke-zurueckweisen-text").fill(zurueckweisung);
    await fachmann.getByTestId("luecke-zurueckweisen").click();
    await expect(fachmann.getByTestId("luecke-vorgang-stand")).toContainText(
      "begründet zurückgewiesen",
      { timeout: 15_000 },
    );
    await bild(fachmann, "5-fachmann-zurueckgewiesen");

    // ---- Melda: GENAU EINE Rückmeldung „zurückgewiesen“, Begründung im Vorgang ------------------
    await melda.goto("/start");
    await melda.getByTestId("kopfband-meldungen").click();
    const rueckmeldung = melda.locator(
      '[data-testid="meldung-oeffnen"][data-art="luecke"]:has([data-luecken-art="zurueckgewiesen"])',
    );
    await expect(rueckmeldung).toHaveCount(1, { timeout: 15_000 });
    await bild(melda, "6-melda-glocke-zurueckgewiesen");
    await rueckmeldung.click();
    await expect(melda).toHaveURL(new RegExp(`/luecke/${gapId}`), { timeout: 15_000 });
    await expect(melda.getByTestId("luecke-zurueckweisung-begruendung")).toHaveText(zurueckweisung);
    await bild(melda, "7-melda-begruendung");

    // ---- Das Wissen bleibt unverändert: Fassung 1, falsche Aussage wie zuvor ------------------
    const danach = await fachmann.request.get(`/api/kos/${ko.id}`);
    expect(danach.status(), await danach.text()).toBe(200);
    expect(await danach.json()).toMatchObject({ version: 1, statement: falsch });
  } finally {
    await melda.context().close();
    await melvin.context().close();
    await fachmann.context().close();
  }
});
