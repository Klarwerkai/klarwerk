// ================================================================================================
// KLARA 02 (produkt:20261008:klara-sprache) — Sprechen, Diktieren und Vorlesen im gebündelten Produkt.
// ================================================================================================
//
// Drei Sonden in Chromium, Firefox und WebKit, mit echtem Server und echter Anmeldung:
//   1. „Diktieren“ füllt nur das Eingabefeld (kein `POST /api/ask`); „Auftrag sprechen“ zeigt
//      erkannten Text und Ziel; „Senden“ schickt GENAU den erkannten Text über den echten Frageweg;
//      die Karte zeigt danach gehört, gesendet, Ziel und Ergebnis; die Antwort wird auf Klick
//      vorgelesen und lässt sich stoppen. Auch schmal (390 px) bleiben die Knöpfe im Bild.
//   2. Mikrofon abgelehnt: ehrlicher Hinweis, die getippte Frage geht weiter.
//   3. Browser ohne Spracherkennung und Sprachausgabe: Hinweise statt Knöpfe, Tippen geht.
//
// ATTRAPPEN, ausdrücklich: Die Bahn hat kein Mikrofon und keine hörbare Ausgabe. Deshalb ersetzt ein
// Init-Skript die BROWSER-SCHNITTSTELLEN `SpeechRecognition` und `speechSynthesis` (sie „hören“ und
// „sprechen“ auf Kommando des Tests). Alles dahinter — Bündel, Klara, Frageweg, Ablage — ist echt.
// Eine echte Spracherkennung mit Mikrofon misst dieser Lauf nicht; im hermetischen Tor ist auch kein
// Modell aktiv (Antworten „Ohne KI“) — die Kette bis zur KI belegt
// `tests/klara-sprache/klara-sprache-am-server.test.tsx` mit dem kontrollierten Modelladapter.
import { type Browser, type Page, type TestInfo, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const KENNWORT = "Klara-Sprache-Kennwort-1";

function marke(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function eigenesKonto(admin: Page, name: string): Promise<string> {
  await ensureLoggedIn(admin);
  const email = `klara-sprache-${name}-${marke()}@klarwerk.test`;
  const angelegt = await admin.request.post("/api/users", {
    data: { name: `Klara Sprache ${name}`, email, password: KENNWORT, role: "experte" },
  });
  expect(angelegt.status(), await angelegt.text()).toBe(201);
  return email;
}

type Lage = "ok" | "verweigert" | "ohne";

/** Läuft im Browser vor jedem Skript der Seite. */
function sprachSchnittstellen(lage: Lage): void {
  const w = window as unknown as Record<string, unknown> & {
    __klara: { gesprochen: { text: string; lang: string }[]; abgebrochen: number; rec: unknown };
  };
  w.__klara = { gesprochen: [], abgebrochen: 0, rec: null };
  const setze = (name: string, wert: unknown): void => {
    Object.defineProperty(w, name, { value: wert, configurable: true, writable: true });
  };
  if (lage === "ohne") {
    setze("SpeechRecognition", undefined);
    setze("webkitSpeechRecognition", undefined);
    setze("speechSynthesis", undefined);
    setze("SpeechSynthesisUtterance", undefined);
    return;
  }
  class Rekorder {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    start(): void {
      w.__klara.rec = this;
      if (lage === "verweigert") {
        setTimeout(() => {
          this.onerror?.({ error: "not-allowed" });
          this.onend?.();
        }, 0);
      }
    }
    stop(): void {
      setTimeout(() => this.onend?.(), 0);
    }
    hoert(text: string, endgueltig: boolean): void {
      this.onresult?.({
        resultIndex: 0,
        results: [Object.assign([{ transcript: text }], { isFinal: endgueltig })],
      });
    }
  }
  setze("SpeechRecognition", Rekorder);
  setze("webkitSpeechRecognition", Rekorder);
  setze("speechSynthesis", {
    speak: (u: { text: string; lang: string }) => {
      w.__klara.gesprochen.push({ text: u.text, lang: u.lang });
    },
    cancel: () => {
      w.__klara.abgebrochen += 1;
    },
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

async function seite(
  browser: Browser,
  admin: Page,
  name: string,
  lage: Lage,
  groesse = { width: 1280, height: 800 },
): Promise<{ p: Page; schliessen: () => Promise<void> }> {
  const email = await eigenesKonto(admin, name);
  const kontext = await browser.newContext({ viewport: groesse });
  await kontext.addInitScript(sprachSchnittstellen, lage);
  const p = await kontext.newPage();
  await p.goto("/");
  const pw = p.locator('input[type="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await p.locator('input[type="email"]').fill(email);
  await pw.first().fill(KENNWORT);
  await p.locator('button[type="submit"]').click();
  await expect(p.getByTestId("kopfband")).toBeVisible({ timeout: 15_000 });
  await p.goto("/klara-vorschau");
  const figur = p.getByTestId("klara-figur");
  await expect(figur).toBeVisible({ timeout: 15_000 });
  await figur.click();
  await expect(p.getByTestId("klara-gespraech")).toBeVisible();
  await expect(p.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
  await p.getByTestId("klara-einwilligung-erteilen").click();
  await expect(p.getByTestId("klara-einwilligung-erteilt")).toBeVisible();
  return { p, schliessen: () => kontext.close() };
}

async function hoert(p: Page, text: string, endgueltig = true): Promise<void> {
  await p.evaluate(
    ([t, e]) => {
      const k = (window as unknown as { __klara: { rec: { hoert(t: string, e: boolean): void } } })
        .__klara;
      k.rec.hoert(t, e);
    },
    [text, endgueltig] as [string, boolean],
  );
}

async function beleg(p: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`Klara 02 — ${name}`, {
    body: await p.screenshot({ fullPage: false }),
    contentType: "image/png",
  });
}

const letzteKlara = (p: Page) =>
  p.locator('[data-testid="klara-nachricht"][data-von="klara"]').last();

test("Klara 02 · Diktieren füllt nur das Feld; Auftrag sprechen → Senden über den Frageweg; Vorlesen und Stopp", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150_000);
  const { p, schliessen } = await seite(browser, page, "eins", "ok");
  const fragen: string[] = [];
  p.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/ask" && r.method() === "POST") {
      fragen.push((JSON.parse(r.postData() ?? "{}") as { question?: string }).question ?? "");
    }
  });
  const gesprochen = `Wie wird die Anlage ${marke()} gesichert?`;

  // Diktieren: nur Text im Feld.
  await p.getByTestId("klara-diktieren").click();
  await expect(p.getByTestId("klara-aufnahme-laeuft")).toHaveAttribute("data-art", "diktat");
  await hoert(p, gesprochen);
  await expect(p.getByTestId("klara-eingabe")).toHaveValue(gesprochen);
  await p.getByTestId("klara-aufnahme-stoppen").click();
  await expect(p.getByTestId("klara-aufnahme-laeuft")).toHaveCount(0);
  await expect(p.getByTestId("klara-auftrag")).toHaveCount(0);
  await p.waitForTimeout(500);
  expect(fragen, "Diktieren hat eine Frage gesendet").toEqual([]);
  await beleg(p, info, "1 Diktat im Eingabefeld, nichts gesendet");
  await p.getByTestId("klara-eingabe").fill("");

  // Auftrag sprechen: Karte mit erkanntem Text und Ziel.
  await p.getByTestId("klara-auftrag-sprechen").click();
  await expect(p.getByTestId("klara-aufnahme-laeuft")).toHaveAttribute("data-art", "auftrag");
  await hoert(p, gesprochen);
  await p.getByTestId("klara-aufnahme-stoppen").click();
  await expect(p.getByTestId("klara-auftrag")).toBeVisible();
  await expect(p.getByTestId("klara-auftrag-text")).toHaveValue(gesprochen);
  const seiteName = (await p.getByTestId("klara-ort-seite").textContent()) ?? "";
  const objekt = (await p.getByTestId("klara-ort-objekt").textContent()) ?? "";
  await expect(p.getByTestId("klara-auftrag-ziel")).toHaveText(`${seiteName} · ${objekt}`);
  await expect(p.getByTestId("klara-auftrag-art")).toHaveAttribute("data-art", "frage");
  expect(fragen).toEqual([]);
  await beleg(p, info, "2 gesprochener Auftrag mit Ziel");

  const frageweg = p.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await p.getByTestId("klara-auftrag-senden").click();
  const antwort = await frageweg;
  expect(antwort.status(), await antwort.text()).toBe(200);
  expect(fragen).toEqual([gesprochen]);
  const klara = letzteKlara(p);
  await expect(klara).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  const ergebnis = p.getByTestId("klara-auftrag-ergebnis");
  await expect(ergebnis).toHaveAttribute("data-stand", "beantwortet", { timeout: 15_000 });
  await expect(p.getByTestId("klara-ergebnis-gehoert")).toHaveText(gesprochen);
  await expect(p.getByTestId("klara-ergebnis-gesendet")).toHaveText(gesprochen);
  await expect(p.getByTestId("klara-ergebnis-ziel")).toHaveText(`${seiteName} · ${objekt}`);
  await beleg(p, info, "3 gesendet, Ergebnis sichtbar");

  // Vorlesen auf Klick, Stopp.
  await klara.getByTestId("klara-vorlesen").click();
  const vorgelesen = (): Promise<number> =>
    p.evaluate(
      () => (window as unknown as { __klara: { gesprochen: unknown[] } }).__klara.gesprochen.length,
    );
  await expect.poll(vorgelesen).toBe(1);
  await expect(p.getByTestId("klara-vorlesen-stoppen")).toBeVisible();
  await p.getByTestId("klara-vorlesen-stoppen").click();
  await expect(p.getByTestId("klara-vorlesen-stoppen")).toHaveCount(0);
  const abgebrochen = await p.evaluate(
    () => (window as unknown as { __klara: { abgebrochen: number } }).__klara.abgebrochen,
  );
  expect(abgebrochen).toBeGreaterThan(0);
  await schliessen();
});

test("Klara 02 · schmal: Sprachknöpfe, Eingabe und Senden bleiben im Bild", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000);
  const { p, schliessen } = await seite(browser, page, "schmal", "ok", { width: 390, height: 844 });
  for (const id of ["klara-diktieren", "klara-auftrag-sprechen", "klara-eingabe", "klara-senden"]) {
    const box = await p.getByTestId(id).boundingBox();
    expect(box, `${id} ohne Box`).not.toBeNull();
    if (box) {
      expect(box.x >= 0 && box.x + box.width <= 391, `${id} waagrecht ausserhalb`).toBe(true);
      expect(box.y >= 0 && box.y + box.height <= 845, `${id} senkrecht ausserhalb`).toBe(true);
    }
  }
  await beleg(p, info, "schmal mit Sprachknöpfen");
  await schliessen();
});

test("Klara 02 · Mikrofon abgelehnt: Hinweis, getippte Frage geht weiter", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000);
  const { p, schliessen } = await seite(browser, page, "verweigert", "verweigert");
  await p.getByTestId("klara-auftrag-sprechen").click();
  await expect(p.getByTestId("klara-sprache-hinweis")).toContainText(
    "Das Mikrofon ist nicht erlaubt",
  );
  await expect(p.getByTestId("klara-aufnahme-laeuft")).toHaveCount(0);
  await beleg(p, info, "Mikrofon abgelehnt");
  const frageweg = p.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await p.getByTestId("klara-eingabe").fill("Was kann ich hier tun?");
  await p.getByTestId("klara-eingabe").press("Enter");
  expect((await frageweg).status()).toBe(200);
  await expect(letzteKlara(p)).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  await schliessen();
});

test("Klara 02 · Browser ohne Spracherkennung und Sprachausgabe: Hinweise statt Knöpfe, Tippen geht", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120_000);
  const { p, schliessen } = await seite(browser, page, "ohne", "ohne");
  await expect(p.getByTestId("klara-diktieren")).toHaveCount(0);
  await expect(p.getByTestId("klara-auftrag-sprechen")).toHaveCount(0);
  await expect(p.getByTestId("klara-sprache-na")).toBeVisible();
  await expect(p.getByTestId("klara-vorlesen-na")).toBeVisible();
  await beleg(p, info, "ohne Sprachschnittstellen");
  const frageweg = p.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await p.getByTestId("klara-eingabe").fill("Was kann ich hier tun?");
  await p.getByTestId("klara-eingabe").press("Enter");
  expect((await frageweg).status()).toBe(200);
  const klara = letzteKlara(p);
  await expect(klara).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  await expect(klara.getByTestId("klara-vorlesen")).toHaveCount(0);
  await schliessen();
});
