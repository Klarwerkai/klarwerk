// ================================================================================================
// produkt:20261010:assistenz-avatarzustaende — ZUSTÄNDE ALLER 13 MOTIVE IM BROWSER, AM ECHTEN PRODUKT.
// ================================================================================================
//
// Drei Sonden am gebündelten Produkt mit echtem Server, echter Anmeldung und FIKTIVEN Konten, die
// der Admin der Suite eigens anlegt (keine Personendaten):
//   1. Desktop: Meine Assistenz → für JEDES der 13 Motive „Zustände ansehen“ → alle neun Zustände
//      nacheinander mit der motivgerechten Darstellung (expressiv: Gesten und Mimik; sachlich: Licht
//      und sparsame Neigung, nie Hüpfer). Bild je Motiv und Zustand. Die Vorschau sendet nichts an
//      den Server und ändert weder Profil noch den Zustand der echten Figur.
//   2. 390 × 844, reduzierte Bewegung, Tastatur: Vorschau per Enter, Fokus auf „Vorschau beenden“,
//      Escape → Fokus zurück; still, mit Hinweis und Textstatus; nichts ragt aus dem Bild.
//      Feldprüfung als Nutzerfehler an der Figur (eigene Fehlerart und eigener Text).
//   3. Desktop, echte Ereignisse: Freude nach bestätigtem Speichern → sofort neue Aktion (fehlende
//      Angabe) ersetzt sie, die alte Freude kehrt nicht zurück; Speicherfehler (technisch) und
//      Abbrechen; Minimieren = Pause ohne Animation; Seitenansicht, Andocken und Verschieben per
//      Tastatur erhalten das Motiv.
//
// WAS DIESE SONDEN NICHT ERSETZEN: das Urteil eines Menschen über Bildwirkung und Ausdruck je Motiv,
// eine Prüfung an echten Endgeräten und echte Sprachein-/-ausgabe (der kopflose Browser hat keine).
// Eine Transport-Attrappe gibt es genau einmal: die einmal scheiternde Speicherung (Sonde 3).
import {
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { ASSISTENZ_ZUSTAENDE } from "../apps/web/src/components/assistenz/ausdruck";
import { ASSISTENZ_AVATAR_KATALOG, animationsStil } from "../apps/web/src/lib/assistenzAvatare";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Assistenz-Kennwort-1";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Ein eigenes fiktives Konto (Rolle Experte), angelegt vom Admin der Suite. */
async function fiktivesKonto(admin: Page, name: string): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `zustaende-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Fiktiv ${name}`, email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

async function angemeldet(
  browser: Browser,
  email: string,
  groesse: { width: number; height: number },
): Promise<Page> {
  const kontext = await browser.newContext({ viewport: groesse });
  const p = await kontext.newPage();
  await p.goto("/");
  const pw = p.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await p.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await p.locator('button[type="submit"]').click();
  await expect(p.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
  return p;
}

/** Profil am eigenen Konto einrichten, Assistenz einschalten, „Meine Assistenz“ öffnen. */
async function meineAssistenz(p: Page, avatar: string): Promise<void> {
  const r = await p.request.put("/api/me/assistenz", {
    data: { name: "Mia", avatar, einrichtungAbschliessen: true, fassung: 0 },
  });
  expect(r.status(), await r.text()).toBe(200);
  await p.goto("/klara-vorschau");
  await expect(figur(p)).toBeVisible({ timeout: 15_000 });
  await p.goto("/profil?bereich=assistenz");
  await expect(figur(p)).toBeVisible({ timeout: 15_000 });
  const formular = p.getByTestId("assistenz-formular-aendern");
  if (!(await formular.isVisible().catch(() => false))) {
    await p.getByTestId("zeile-assistenz").click();
  }
  await expect(formular).toBeVisible({ timeout: 15_000 });
}

async function profilAmServer(p: Page): Promise<unknown> {
  const r = await p.request.get("/api/me/assistenz");
  expect(r.status()).toBe(200);
  return r.json();
}

async function beleg(p: Page, info: TestInfo, name: string, ziel?: Locator): Promise<void> {
  await info.attach(`Avatarzustände — ${name}`, {
    body: ziel ? await ziel.screenshot() : await p.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

const figur = (p: Page) => p.getByTestId("klara-figur");
const vorschau = (p: Page) => p.getByTestId("assistenz-zustandsvorschau");
const vorschauFigur = (p: Page) => p.getByTestId("assistenz-zustandsvorschau-figur");
const start = (p: Page, id: string) => p.getByTestId(`assistenz-vorschau-start-${id}`);

async function animation(el: Locator): Promise<string> {
  return el.locator(".klara-motiv").evaluate((n) => getComputedStyle(n).animationName);
}

/** Die erwartete Bewegung je Stil und Zustand (index.css, ANIMATIONSZUSTAENDE.json). */
const ERWARTET: Record<"expressiv" | "zurueckhaltend", Record<string, string>> = {
  expressiv: {
    bereit: "kw-assistenz-atmen",
    warten: "kw-klara-denkt",
    nachdenken: "kw-assistenz-neigen",
    zuhoeren: "kw-assistenz-nicken",
    sprechen: "kw-assistenz-sprechen",
    ratlos: "kw-assistenz-kippen",
    freude: "kw-assistenz-huepfer",
    fehler: "kw-assistenz-absinken",
    pause: "none",
  },
  zurueckhaltend: {
    bereit: "none",
    warten: "kw-assistenz-lichtpuls",
    nachdenken: "kw-assistenz-lichtwandern",
    zuhoeren: "kw-assistenz-signal",
    sprechen: "kw-assistenz-signal",
    ratlos: "kw-assistenz-neigen-klein",
    freude: "kw-assistenz-aufhellen",
    fehler: "none",
    pause: "none",
  },
};

test("Avatarzustände · Vorschau aller 13 Motive in neun Zuständen — ohne Wirkung auf Profil und Figur", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(420_000);
  const p = await angemeldet(browser, await fiktivesKonto(page, "vorschau"), {
    width: 1280,
    height: 800,
  });
  await meineAssistenz(p, "eule");
  const profilVorher = await profilAmServer(p);
  await expect(figur(p)).toHaveAttribute("data-zustand", "bereit", { timeout: 6_000 });
  let gesendet = 0;
  p.on("request", (r) => {
    if (r.method() !== "GET" && new URL(r.url()).pathname.startsWith("/api/me/assistenz")) {
      gesendet += 1;
    }
  });

  const tabelle: Array<{ motiv: string; stil: string; zustand: string; animation: string }> = [];
  for (const m of ASSISTENZ_AVATAR_KATALOG) {
    const stil = animationsStil(m);
    // Bewusst gestartet — per Tastatur (die schwebende Figur kann einen Knopf überdecken).
    await start(p, m.id).focus();
    await p.keyboard.press("Enter");
    await expect(vorschau(p)).toHaveAttribute("data-avatar-vorschau", m.id);
    await expect(vorschau(p)).toContainText("Nur eine Vorschau");
    for (const [i, z] of ASSISTENZ_ZUSTAENDE.entries()) {
      await expect(vorschauFigur(p)).toHaveAttribute("data-zustand", z, { timeout: 5_000 });
      await expect(p.getByTestId("assistenz-zustandsvorschau-text")).toContainText(
        `Vorschau ${i + 1} von 9`,
      );
      const a = await animation(vorschauFigur(p));
      tabelle.push({ motiv: m.id, stil, zustand: z, animation: a });
      expect(a, `${m.id} · ${z}`).toBe(ERWARTET[stil][z]);
      // Mimik nur bei Motiven mit Gesicht; sachliche Objekte bleiben gesichtslos.
      await expect(vorschauFigur(p).getByTestId("klara-mimik")).toHaveCount(
        stil === "expressiv" ? 1 : 0,
      );
      await beleg(p, info, `${m.id} · ${i + 1} ${z}`, vorschauFigur(p));
    }
    await expect(vorschau(p)).toHaveCount(0, { timeout: 5_000 });
    await expect(p.getByTestId("assistenz-zustandsvorschau-fertig")).toBeVisible();
    // Die echte Figur blieb unberührt.
    await expect(figur(p)).toHaveAttribute("data-zustand", "bereit");
    await expect(figur(p).getByTestId("klara-avatar")).toHaveAttribute("data-avatar", "eule");
  }
  // Sachliche Objekte: nie Gesten oder Hüpfer.
  const gesten = /huepfer|nicken|kippen|atmen|absinken|kw-assistenz-sprechen|kw-klara-denkt/;
  for (const zeile of tabelle.filter((z) => z.stil === "zurueckhaltend")) {
    expect(zeile.animation, `${zeile.motiv} · ${zeile.zustand}`).not.toMatch(gesten);
  }
  expect(tabelle).toHaveLength(13 * 9);
  await info.attach("Avatarzustände — Tabelle Motiv × Zustand × Animation", {
    body: JSON.stringify(tabelle, null, 2),
    contentType: "application/json",
  });
  expect(gesendet, "die Vorschau darf nichts speichern").toBe(0);
  expect(await profilAmServer(p)).toEqual(profilVorher);
  await p.context().close();
});

test("Avatarzustände · 390 × 844, reduzierte Bewegung, Tastatur: Vorschau, Escape, Nutzerfehler", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150_000);
  const p = await angemeldet(browser, await fiktivesKonto(page, "schmal"), {
    width: 390,
    height: 844,
  });
  await p.emulateMedia({ reducedMotion: "reduce" });
  await meineAssistenz(p, "leuchtkreis");

  // Tastatur: Startknopf fokussieren, Enter — der Fokus springt auf „Vorschau beenden“.
  await start(p, "leuchtkreis").focus();
  await p.keyboard.press("Enter");
  const beenden = p.getByTestId("assistenz-zustandsvorschau-beenden");
  await expect(beenden).toBeFocused();
  const rahmen = await beenden.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(rahmen).toBe("solid");
  await expect(p.getByTestId("assistenz-zustandsvorschau-ruhig")).toBeVisible();
  await expect(vorschauFigur(p)).toHaveAttribute("data-stil", "zurueckhaltend");
  // Reduziert: still — kein Lichtpuls, aber Text und ruhiger statischer Ausdruck.
  await expect(vorschauFigur(p)).toHaveAttribute("data-zustand", "warten", { timeout: 5_000 });
  expect(await animation(vorschauFigur(p))).toBe("none");
  expect(
    await vorschauFigur(p)
      .locator(".klara-motiv")
      .evaluate((n) => getComputedStyle(n).filter),
  ).toContain("brightness");
  await expect(p.getByTestId("assistenz-zustandsvorschau-text")).toContainText(
    "Wartet auf die Antwort",
  );
  const b = await vorschau(p).boundingBox();
  expect(b && b.x >= 0 && b.x + b.width <= 391, "Vorschau ragt aus dem Bild").toBe(true);
  await beleg(p, info, "schmal · Vorschau reduziert mit Fokus");
  await p.keyboard.press("Escape");
  await expect(vorschau(p)).toHaveCount(0);
  await expect(start(p, "leuchtkreis")).toBeFocused();

  // Nutzerfehler: Name leeren, Enter — die Figur zeigt eine fehlende Angabe, keinen Fehlschlag.
  const name = p.getByTestId("assistenz-name");
  await name.focus();
  await name.fill("");
  await p.keyboard.press("Enter");
  await expect(p.getByTestId("assistenz-name-fehler")).toBeVisible();
  await expect(figur(p)).toHaveAttribute("data-zustand", "fehler");
  await expect(figur(p)).toHaveAttribute("data-fehlerart", "eingabe");
  await expect(p.getByTestId("klara-figur-zustand")).toContainText("Eine Angabe fehlt noch");
  await expect(p.getByTestId("klara-figur-zustand")).not.toContainText("Fehlgeschlagen");
  expect(await animation(figur(p))).toBe("none");
  await beleg(p, info, "schmal · fehlende Angabe an der Figur");
  await p.keyboard.type("Mia");
  await expect(figur(p)).not.toHaveAttribute("data-zustand", "fehler");
  await p.context().close();
});

test("Avatarzustände · echte Ereignisse: schneller Wechsel, Fehlerarten, Abbrechen, Minimieren, Seitenansicht, Andocken", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const p = await angemeldet(browser, await fiktivesKonto(page, "ereignis"), {
    width: 1280,
    height: 800,
  });
  await meineAssistenz(p, "fuchs");
  const name = p.getByTestId("assistenz-name");

  // Bestätigter Erfolg: Freude (kurz) …
  await name.fill("Kai");
  await p.getByTestId("assistenz-speichern").click();
  await expect(figur(p)).toHaveAttribute("data-zustand", "freude");
  await beleg(p, info, "Freude nach bestätigtem Speichern", figur(p));
  // … sofort eine neue Aktion: die fehlende Angabe ersetzt die Freude; die alte kehrt nicht zurück.
  await name.fill("");
  await p.getByTestId("assistenz-speichern").click();
  await expect(figur(p)).toHaveAttribute("data-zustand", "fehler");
  await expect(figur(p)).toHaveAttribute("data-fehlerart", "eingabe");
  await p.waitForTimeout(3_000);
  await expect(figur(p)).toHaveAttribute("data-zustand", "fehler");
  expect(await animation(figur(p))).toBe("kw-assistenz-neigen-klein");
  await beleg(p, info, "schneller Wechsel: fehlende Angabe ersetzt Freude", figur(p));
  await name.fill("Kai");
  await expect(figur(p)).toHaveAttribute("data-zustand", "bereit");

  // Technischer Fehler: einmal 500 — eigener Text, rot gekennzeichnet; Abbrechen beendet ihn.
  let einmal = true;
  await p.route("**/api/me/assistenz", async (route) => {
    if (route.request().method() === "PUT" && einmal) {
      einmal = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "INTERNAL", message: "Speicher nicht erreichbar." }),
      });
      return;
    }
    await route.fallback();
  });
  await name.fill("Lio");
  await p.getByTestId("assistenz-speichern").click();
  await expect(p.getByTestId("assistenz-speicherfehler")).toBeVisible();
  await expect(figur(p)).toHaveAttribute("data-fehlerart", "technisch");
  await expect(p.getByTestId("klara-figur-zustand")).toContainText("Fehlgeschlagen");
  expect(await animation(figur(p))).toBe("kw-assistenz-absinken");
  await beleg(p, info, "technischer Fehler mit Text");
  await p.getByTestId("assistenz-abbrechen").click();
  await expect(figur(p)).not.toHaveAttribute("data-zustand", "fehler");

  // Minimieren: Pause, keine Animation, Motiv bleibt.
  await figur(p).click();
  await expect(p.getByTestId("klara-gespraech")).toBeVisible();
  await p.getByTestId("klara-minimieren").click();
  await expect(figur(p)).toHaveAttribute("data-minimiert", "true");
  await expect(figur(p)).toHaveAttribute("data-zustand", "pause");
  expect(await animation(figur(p))).toBe("none");
  await expect(figur(p).getByTestId("klara-avatar")).toHaveAttribute("data-avatar", "fuchs");
  await beleg(p, info, "minimiert: Pause");

  // Seitenansicht und Andocken: dasselbe Motiv; Gesten bleiben in der runden Fläche.
  await figur(p).click();
  await expect(p.getByTestId("klara-gespraech")).toBeVisible();
  await p.getByTestId("klara-ansicht").click();
  await expect(p.getByTestId("klara-gespraech")).toHaveAttribute("data-ansicht", "seitlich");
  await expect(p.getByTestId("klara-gespraech-avatar")).toHaveAttribute("data-avatar", "fuchs");
  await beleg(p, info, "Seitenansicht mit Motiv");
  await p.getByTestId("klara-ansicht").click();
  await p.getByTestId("klara-andocken").click();
  await expect(figur(p)).toHaveAttribute("data-angedockt", /links|rechts/);
  await expect(figur(p).getByTestId("klara-avatar")).toHaveAttribute("data-avatar", "fuchs");
  expect(await figur(p).evaluate((el) => getComputedStyle(el).overflow)).toBe("hidden");
  await p.getByTestId("klara-schliessen").click();
  await expect(figur(p)).toBeFocused();
  // Verschieben per Tastatur vom angedockten Rand weg.
  const rand = await figur(p).getAttribute("data-angedockt");
  const vorher = (await figur(p).boundingBox())?.x ?? 0;
  await p.keyboard.press(rand === "links" ? "ArrowRight" : "ArrowLeft");
  await expect
    .poll(async () => Math.abs(((await figur(p).boundingBox())?.x ?? 0) - vorher))
    .toBeGreaterThan(8);
  await expect(figur(p)).toHaveAttribute("data-angedockt", "");
  await expect(figur(p).getByTestId("klara-avatar")).toHaveAttribute("data-avatar", "fuchs");
  await expect(figur(p)).toHaveAttribute("data-zustand", "bereit");
  await beleg(p, info, "verschoben per Tastatur: Motiv und Zustand erhalten");
  await p.context().close();
});
