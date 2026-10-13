// ================================================================================================
// R-0679 / R-2156 / FR-VAL-07 — DER GERÄTEHINWEIS EINER PRÜFZUWEISUNG, AM ECHTEN BROWSER.
// ================================================================================================
//
// Peters Entscheidung 23: Push-Konfiguration und Empfangsbeleg gehören auf diesen Prüfplatz.
// Was hier ECHT ist:
//   · der Smoke-Server trägt ein frisches VAPID-Paar (playwright.smoke.config.ts, SMOKE_VAPID);
//   · der Browser abonniert über den Knopf der Profilseite beim Push-Dienst seines Herstellers;
//   · der Server signiert und schickt den Anstoß an diesen Dienst, der Dienst stellt ihn dem
//     Browser zu, der Service Worker zeigt den Hinweis — kein Ersatzsender, keine Attrappe.
// Die Prüferin ist ein eigenes Konto in einem eigenen Browserkontext (isoliert vom Admin, der
// über die Schnittstelle anlegt und zuweist).
//
// WAS DIESER PLATZ NICHT KANN: einen Hinweis des Betriebssystems anklicken. Den Klick ersetzt der
// Aufruf GENAU der Funktion, die der Service Worker beim Antippen ausführt
// (`self.klarwerkPruefzuweisungOeffnen`, apps/web/public/sw.js) — mit dem tatsächlich empfangenen
// Hinweis als Argument. Belegt wird damit die Navigation in die eigene, gefilterte Prüfliste.
//
// BROWSER: das auf dem Prüfplatz VORHANDENE Chromium des Projekts `chromium` (Nacharbeit 10: Google
// Chrome ist dort nicht installiert, `channel: "chrome"` scheiterte schon beim Start — und eine
// Installation ist nicht Teil dieses Auftrags). Ob dieses Chromium beim Push-Dienst ein Abo
// bekommt, ist eine MESSUNG dieses Laufs, keine Annahme: scheitert das Abo, nennt der Fall die
// wörtliche Meldung des Browsers (`aboDiagnose`) statt nur an einer Zeitgrenze zu enden. Fehlt der
// Netzweg zum Push-Dienst, nennt er das ebenso — rot mit Grund, nie still grün.
//
// Nacharbeit 11: im Standardstart zeigte die Profilzeile „Im Browser blockiert" — der Browser
// meldete die Benachrichtigungserlaubnis trotz erteilter Kontextberechtigung als verweigert. Das
// Produkt hat damit richtig geantwortet; die Ursache ist der kopflose Standardstart des Projekts
// (die reduzierte „headless shell" ohne Benachrichtigungen). `channel: "chromium"` startet
// dasselbe mitgelieferte Chromium im vollständigen neuen Kopflosmodus — keine Installation, kein
// fremder Browser. Meldet der Browser dennoch „verweigert", endet der Fall mit genau dieser
// Diagnose (Anhang `push-erlaubnis-diagnose.json`), statt an einer Zeitgrenze.
//
// Nacharbeit 12: mit `channel: "chromium"` stand die Profilzeile auf „Aus", das Abo selbst scheiterte
// mit „AbortError: Registration failed - permission denied". `browser.newContext()` ist ein
// flüchtiger Inkognito-Kontext, und Chromium verweigert Push-Abos in Inkognito-Profilen. Die Prüferin
// bekommt deshalb ein EIGENES, dauerhaftes Profil (`launchPersistentContext`) in einem frischen
// Verzeichnis je Lauf — isoliert vom Admin und von jedem anderen Lauf, nach dem Lauf gelöscht.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type APIRequestContext,
  type Page,
  type Worker,
  chromium,
  expect,
  test,
} from "@playwright/test";
import { SMOKE_MAIL, SMOKE_PASS, workspaceMarker } from "./support/auth";

const HINWEIS_TAG = "klarwerk-pruefzuweisung";
const PRUEFLISTE = "/validierung?mine=1";
const HINWEISTEXTE = [
  "Dir wurde eine Prüfung zugewiesen.",
  "A review has been assigned to you.",
  "Er is een beoordeling aan je toegewezen.",
];

interface Hinweis {
  title: string;
  body: string;
  ziel: string | undefined;
}

async function token(request: APIRequestContext, email: string, password: string) {
  const res = await request.post("/api/auth/login", { data: { email, password } });
  expect(res.status(), `Anmeldung ${email} über die Schnittstelle`).toBe(200);
  return { authorization: `Bearer ${((await res.json()) as { token: string }).token}` };
}

async function imBrowserAnmelden(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/");
  await page.locator('input[type="email"]').fill(email);
  const pw = page.locator('input[type="password"]');
  for (let i = 0; i < (await pw.count()); i++) {
    await pw.nth(i).fill(password);
  }
  await page.locator('button[type="submit"]').click();
  await expect(workspaceMarker(page)).toBeVisible({ timeout: 15_000 });
}

/** Die angezeigten Hinweise dieser Anwendung, gelesen beim Service Worker der Seite. */
async function angezeigteHinweise(page: Page): Promise<Hinweis[]> {
  return page.evaluate(async (tag) => {
    const reg = await navigator.serviceWorker.ready;
    const liste = await reg.getNotifications({ tag });
    return liste.map((n) => ({
      title: n.title,
      body: n.body,
      ziel: (n.data as { ziel?: string } | null)?.ziel,
    }));
  }, HINWEIS_TAG);
}

interface AboDiagnose {
  browser: string;
  erlaubnis: string;
  pushManager: boolean;
  meldung: string;
}

/**
 * Warum der Browser kein Abo bekommt — gemessen, nicht vermutet: derselbe Aufruf, den die
 * Profilzeile macht (`pushManager.subscribe` mit dem öffentlichen VAPID-Schlüssel des Servers),
 * mit der wörtlichen Meldung des Browsers. Gelingt er hier, lag der Fehler in der Oberfläche.
 */
async function aboDiagnose(page: Page, oeffentlicherSchluessel: string): Promise<AboDiagnose> {
  return page.evaluate(async (schluessel) => {
    const browser = navigator.userAgent;
    const erlaubnis = typeof Notification === "undefined" ? "fehlt" : Notification.permission;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) {
      return { browser, erlaubnis, pushManager: false, meldung: "kein PushManager" };
    }
    const b64 = schluessel.replace(/-/g, "+").replace(/_/g, "/");
    const roh = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    try {
      await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(roh, (z) => z.charCodeAt(0)),
      });
      return {
        browser,
        erlaubnis,
        pushManager: true,
        meldung: "Abo im Browser möglich — der Fehler lag zwischen Oberfläche und Server",
      };
    } catch (fehler) {
      const e = fehler as { name?: string; message?: string };
      return { browser, erlaubnis, pushManager: true, meldung: `${e.name}: ${e.message}` };
    }
  }, oeffentlicherSchluessel);
}

async function serviceWorkerVon(page: Page): Promise<Worker> {
  const vorhanden = page
    .context()
    .serviceWorkers()
    .find((w) => w.url().endsWith("/sw.js"));
  return vorhanden ?? page.context().waitForEvent("serviceworker", { timeout: 15_000 });
}

test("R-0679: Prüfzuweisung erreicht das Gerät als Push-Hinweis und führt in die eigene Prüfliste", async ({
  browserName,
  request,
  baseURL,
}, testInfo) => {
  test.skip(
    browserName !== "chromium",
    "Der Geräte-Push wird auf diesem Prüfplatz in Chromium gemessen.",
  );
  // Erstanmeldung des frischen Profils beim Push-Dienst (bis 120 s) plus Zustellung (bis 90 s).
  test.setTimeout(300_000);

  // --- Admin: Push ist eingerichtet; die Prüferin entsteht als eigenes Konto. -------------------
  const admin = await token(request, SMOKE_MAIL, SMOKE_PASS);
  const config = (await (await request.get("/api/push/config", { headers: admin })).json()) as {
    verfuegbar: boolean;
    publicKey: string | null;
  };
  expect(config, "der Smoke-Server trägt die VAPID-Konfiguration").toMatchObject({
    verfuegbar: true,
  });
  const oeffentlicherSchluessel = config.publicKey ?? "";
  const pruefer = {
    name: "Push Prüferin",
    email: `push-pruefer-${Date.now()}@klarwerk.test`,
    password: "Pruef-Passwort-1",
  };
  const angelegt = await request.post("/api/users", {
    headers: admin,
    data: { ...pruefer, role: "controller" },
  });
  expect(angelegt.status(), "Prüferkonto anlegen").toBe(201);
  const konten = (await (await request.get("/api/users", { headers: admin })).json()) as {
    id: string;
    email: string;
  }[];
  const prueferId = konten.find((k) => k.email === pruefer.email)?.id;
  expect(prueferId, "Prüferkonto in der Kontenliste").toBeTruthy();

  // --- Prüferin: eigenes dauerhaftes Profil (kein Inkognito), Benachrichtigungen erlaubt, ------
  // --- Service Worker zugelassen; das Profilverzeichnis ist je Lauf frisch und wird gelöscht. ---
  const profil = mkdtempSync(join(tmpdir(), "klarwerk-push-pruefer-"));
  const kontext = await chromium.launchPersistentContext(profil, {
    channel: "chromium",
    headless: true,
    ...(baseURL ? { baseURL } : {}),
    serviceWorkers: "allow",
    permissions: ["notifications"],
    locale: "de-DE",
  });
  // Die Erlaubnis zusätzlich ausdrücklich für den Ursprung des Prüfservers (nicht nur pauschal).
  if (baseURL) {
    await kontext.grantPermissions(["notifications"], { origin: new URL(baseURL).origin });
  }
  try {
    const page = kontext.pages()[0] ?? (await kontext.newPage());
    await imBrowserAnmelden(page, pruefer.email, pruefer.password);
    // Erst wenn der Service Worker steht, kann die Profilzeile ein Abo anlegen — sonst meldete sie
    // ehrlich „auf diesem Gerät nicht möglich“. Deshalb ZUERST warten, DANN die Profilseite öffnen.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.goto("/profil");

    const zeile = page.getByTestId("zeile-geraete-push");
    // Erst warten, bis die Zeile überhaupt eine Lage nennt (statt „—"), dann sie beurteilen.
    await expect(zeile, "die Profilzeile nennt eine Push-Lage").not.toContainText("—", {
      timeout: 15_000,
    });
    if (!(await zeile.textContent())?.includes("Aus")) {
      const erlaubnis = await page.evaluate(() => ({
        browser: navigator.userAgent,
        erlaubnis: typeof Notification === "undefined" ? "fehlt" : Notification.permission,
        pushManager: "PushManager" in window,
      }));
      const lage = (await zeile.textContent()) ?? "";
      await testInfo.attach("push-erlaubnis-diagnose.json", {
        contentType: "application/json",
        body: JSON.stringify({ profilzeile: lage, ...erlaubnis }, null, 2),
      });
      throw new Error(
        `die Profilzeile meldet Push nicht als einschaltbar („${lage}") — Benachrichtigungserlaubnis des Browsers: ${erlaubnis.erlaubnis}, PushManager: ${erlaubnis.pushManager}, Browser: ${erlaubnis.browser}`,
      );
    }
    // Nacharbeit 13: das Abo war im Browser möglich, die Profilzeile kam in 30 s trotzdem nicht auf
    // „An". Ob die Anmeldung beim Push-Dienst in einem FRISCHEN Profil länger braucht oder der
    // Server das Abo abweist, wird jetzt gemessen: jede Antwort auf `POST /api/push/abo` wird
    // mitgeschrieben (Status und Fehlerschlüssel, nie der Endpunkt), und die Wartezeit reicht für
    // die Erstanmeldung des Profils beim Dienst.
    const anmeldungen: { status: number; fehler: string | null }[] = [];
    page.on("response", async (antwort) => {
      const pfad = new URL(antwort.url()).pathname;
      if (antwort.request().method() !== "POST" || pfad !== "/api/push/abo") {
        return;
      }
      const rumpf = (await antwort.json().catch(() => null)) as { error?: string } | null;
      anmeldungen.push({ status: antwort.status(), fehler: rumpf?.error ?? null });
    });
    const geklickt = Date.now();
    await zeile.getByRole("button", { name: "Einschalten" }).click();
    const angemeldet = await expect(zeile)
      .toContainText("An", { timeout: 120_000 })
      .then(
        () => true,
        () => false,
      );
    if (!angemeldet) {
      // Erst festhalten, was die Oberfläche hinterlassen hat — DANN der eigene Abo-Versuch.
      const vorhandenesAbo = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        const abo = await reg.pushManager?.getSubscription();
        return abo ? new URL(abo.endpoint).host : null;
      });
      const diagnose = await aboDiagnose(page, oeffentlicherSchluessel);
      const bericht = {
        ...diagnose,
        wartezeitSekunden: Math.round((Date.now() - geklickt) / 1000),
        aboNachDemKlick: vorhandenesAbo ?? "keines",
        anmeldungAmServer: anmeldungen.length > 0 ? anmeldungen : "keine Anfrage gesendet",
      };
      await testInfo.attach("push-abo-diagnose.json", {
        contentType: "application/json",
        body: JSON.stringify(bericht, null, 2),
      });
      throw new Error(
        `Profilzeile nicht auf „An": Abo nach dem Klick: ${bericht.aboNachDemKlick}; Anmeldung am Server: ${JSON.stringify(bericht.anmeldungAmServer)}; eigener Abo-Versuch: ${diagnose.meldung}`,
      );
    }
    const endpunkt = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return (await reg.pushManager.getSubscription())?.endpoint ?? null;
    });
    expect(endpunkt, "Abo im Browser").toBeTruthy();
    expect(await angezeigteHinweise(page), "vor der Zuweisung liegt kein Hinweis vor").toEqual([]);

    // --- Admin: Objekt anlegen und der Prüferin zuweisen. ---------------------------------------
    const titel = `Push-Prüfplatz ${Date.now()}`;
    const ko = await request.post("/api/kos", {
      headers: admin,
      data: {
        confidentiality: "intern",
        title: titel,
        statement: "Vor dem Öffnen den Hydraulikdruck vollständig ablassen.",
        type: "best_practice",
        category: "Push-Prüfplatz",
        neededValidations: 1,
      },
    });
    expect(ko.status(), "Objekt anlegen").toBe(201);
    const koId = ((await ko.json()) as { id: string }).id;
    const zuweisung = await request.put(`/api/kos/${koId}`, {
      headers: admin,
      data: { action: "assign", userIds: [prueferId] },
    });
    expect(zuweisung.status(), "Zuweisung").toBe(204);

    // --- Gerät: der echte Hinweis kommt über den Push-Dienst an. --------------------------------
    await expect
      .poll(async () => (await angezeigteHinweise(page)).length, {
        timeout: 90_000,
        message:
          "kein Gerätehinweis nach der Zuweisung — der Push-Dienst hat nicht zugestellt (Protokoll des Smoke-Servers: `push_fehlgeschlagen`)",
      })
      .toBe(1);
    const [hinweis] = await angezeigteHinweise(page);
    expect(hinweis?.title).toBe("KLARWERK");
    expect(HINWEISTEXTE).toContain(hinweis?.body);
    expect(hinweis?.ziel).toBe(PRUEFLISTE);
    await testInfo.attach("geraetehinweis.json", {
      contentType: "application/json",
      body: JSON.stringify(
        // Der Endpunkt trägt eine Gerätekennung — im Anhang steht nur der Dienst.
        { pushDienst: new URL(endpunkt ?? "").host, hinweis, zugewiesen: koId },
        null,
        2,
      ),
    });

    // --- Antippen: derselbe Weg wie `notificationclick`, mit dem empfangenen Hinweis. -----------
    const sw = await serviceWorkerVon(page);
    await sw.evaluate(async (tag) => {
      const scope = globalThis as unknown as {
        registration: { getNotifications(o: { tag: string }): Promise<{ close(): void }[]> };
        klarwerkPruefzuweisungOeffnen(n: unknown): Promise<unknown>;
      };
      const [empfangen] = await scope.registration.getNotifications({ tag });
      empfangen?.close();
      await scope.klarwerkPruefzuweisungOeffnen(empfangen);
    }, HINWEIS_TAG);
    await expect(page, "das Antippen führt in die eigene Prüfliste").toHaveURL(
      /\/validierung\?mine=1$/,
      { timeout: 15_000 },
    );
    await expect(page.getByText(titel).first(), "die Zuweisung steht in der Prüfliste").toBeVisible(
      {
        timeout: 15_000,
      },
    );
    await testInfo.attach("pruefliste-nach-hinweis.png", {
      contentType: "image/png",
      body: await page.screenshot({ fullPage: false }),
    });
  } finally {
    await kontext.close();
    rmSync(profil, { recursive: true, force: true });
  }
});
