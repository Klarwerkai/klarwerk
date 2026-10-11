import { type Browser, type Page, type TestInfo, expect, test } from "@playwright/test";

import {
  DEMO_TEXTS,
  POC_ANLAGE,
  POC_ANLAGE_UNBETEILIGT,
  POC_KATEGORIE,
  POC_TAG,
} from "../services/app/src/demo-content";
import { ensureLoggedIn, workspaceMarker } from "./support/auth";

// ================================================================================================
// produkt:20261010:branchen-poc-arbeitswege — DIE DREI ARBEITSGESCHICHTEN IM ECHTEN BROWSER.
// ================================================================================================
//
// ART: AGENTENPROBE. Playwright bedient das gebündelte Produkt gegen den echten Smoke-Server
// (`chromium-zustand`, eigener Bestand), mit getrennten Konten je Rolle in eigenen Browserkontexten.
// Es ist KEINE Nutzung durch Menschen und KEINE Simulation des Produkts. Im Torlauf ist kein Modell
// aktiv: Antworten entstehen über den deterministischen Weg („Ohne KI“).
//
// EINSTIEG: die angemeldete Startseite `/start` des Smoke-Servers; Version und Commit des laufenden
// Servers stehen aus `/health` im Messprotokoll (Anhang „PoC-Messprotokoll“).
//
// AUSGANGSBESTAND: zuerst über „Demodaten laden“ (`POST /api/admin/demo-seed`). Der normale
// Torlauf setzt den Schalter `KLARWERK_DEMO_SEED` nicht — dann gibt es diesen Weg nicht (404), und
// der Bestand wird mit DENSELBEN Texten (`DEMO_TEXTS.de.poc`) über die regulären Routen angelegt:
// Konten, Einträge, zwei Bewertungen, Anlagenkopplung, Lückenfrage. Welcher Weg lief, steht im
// Protokoll. Unterschied der Nachbildung: die Quellenbezeichnung „Betriebsanweisung …“ fehlt, weil die
// voreingestellte Stufe für externes Wissen eine Quelle ohne Adresse nicht annimmt; sie ist in der
// Server-Probe über den Demo-Weg belegt (`tests/branchen-poc/arbeitswege-am-draht.test.ts`).
//
// MESSUNG: je Geschichte und Rolle Beginn, Ende, Dauer, genutzte Assistenz-/Hilfeflächen,
// beobachtete Fehler (API-Antworten ≥ 400 und Seitenfehler im Browser dieser Rolle) und offene
// Punkte. Gemessen, nicht geschätzt; das Protokoll hängt auch bei einem Abbruch am Bericht.
//
// IM BROWSER BEDIENT: Assistenz (Frage, Quelle, Seitenkontext, Markierung), Lückenvorgang
// (Übergabe, Rückfrage, Antwort, Entwurf, Abschluss, Glocke, Ergebnis), Reiter „Erneut“ (Melden,
// Begründung, „Noch gültig“). ÜBER ROUTEN DER SITZUNG (keine eigene Fläche geklickt): Erfassen des
// Antworteintrags, Bewertungen der Fachprüfung, Änderungsvorschlag und dessen Übernahme — so auch
// in den vorhandenen Browserproben der verknüpften Aufträge.

const p = DEMO_TEXTS.de.poc;
const LUECKENFRAGE = DEMO_TEXTS.de.gapQuestion;
const KENNWORT = "Poc-Arbeitswege-Kennwort-1";
const ART = "Agentenprobe (Playwright, chromium-zustand, ohne Modell) — keine menschliche Nutzung";

interface Beobachtung {
  fehler: { status: number; methode: string; pfad: string }[];
  seitenfehler: string[];
}
interface Messung {
  geschichte: string;
  rolle: string;
  art: string;
  beginn: string;
  ende: string;
  dauerMs: number;
  hilfe: string[];
  fehler: Beobachtung["fehler"];
  seitenfehler: string[];
  offenePunkte: string[];
  ergebnis: "abgeschlossen" | "abgebrochen";
}

const beobachtet = new Map<Page, Beobachtung>();

function beobachte(seite: Page): void {
  const b: Beobachtung = { fehler: [], seitenfehler: [] };
  seite.on("response", (r) => {
    const pfad = new URL(r.url()).pathname;
    if (pfad.startsWith("/api/") && r.status() >= 400) {
      b.fehler.push({ status: r.status(), methode: r.request().method(), pfad });
    }
  });
  seite.on("pageerror", (e) => b.seitenfehler.push(e.message));
  beobachtet.set(seite, b);
}

async function schritt(
  protokoll: Messung[],
  geschichte: string,
  rolle: string,
  seite: Page,
  offenePunkte: string[],
  arbeit: (hilfe: string[]) => Promise<void>,
): Promise<void> {
  const b = beobachtet.get(seite) ?? { fehler: [], seitenfehler: [] };
  const f0 = b.fehler.length;
  const s0 = b.seitenfehler.length;
  const hilfe: string[] = [];
  const beginn = Date.now();
  let ergebnis: Messung["ergebnis"] = "abgebrochen";
  try {
    await arbeit(hilfe);
    ergebnis = "abgeschlossen";
  } finally {
    const ende = Date.now();
    protokoll.push({
      geschichte,
      rolle,
      art: ART,
      beginn: new Date(beginn).toISOString(),
      ende: new Date(ende).toISOString(),
      dauerMs: ende - beginn,
      hilfe,
      fehler: b.fehler.slice(f0),
      seitenfehler: b.seitenfehler.slice(s0),
      offenePunkte,
      ergebnis,
    });
  }
}

async function bild(seite: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(`PoC · ${name}`, {
    body: await seite.screenshot(),
    contentType: "image/png",
  });
}

async function anmelden(browser: Browser, email: string, kennwort: string): Promise<Page> {
  const adresse = test.info().project.use.baseURL;
  const kontext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ...(adresse === undefined ? {} : { baseURL: adresse }),
  });
  const seite = await kontext.newPage();
  await seite.goto("/");
  await expect(seite.locator('input[type="password"]').first()).toBeVisible({ timeout: 15_000 });
  await seite.locator('input[type="email"]').fill(email);
  await seite.locator('input[type="password"]').first().fill(kennwort);
  await seite.locator('button[type="submit"]').click();
  await expect(workspaceMarker(seite)).toBeVisible({ timeout: 15_000 });
  if (await seite.getByTestId("notice-ack").count()) {
    await seite.getByTestId("notice-ack").click();
  }
  beobachte(seite);
  return seite;
}

async function assistenzOeffnen(seite: Page): Promise<void> {
  const figur = seite.getByTestId("klara-figur");
  await expect(figur).toBeVisible({ timeout: 15_000 });
  const gespraech = seite.getByTestId("klara-gespraech");
  if (!(await gespraech.isVisible())) {
    await figur.click();
  }
  await expect(gespraech).toBeVisible();
  await expect(seite.getByTestId("klara-echt-hinweis")).toHaveAttribute("data-laden", "bereit", {
    timeout: 15_000,
  });
}

interface AskKoerper {
  gap: { id: string } | null;
  geloesteLuecke?: { koId: string };
  result?: { answered?: boolean; citedSources?: string[] };
}

/** Eine Frage in der Assistenz stellen — Antwort des echten Frageweg als Körper zurück. */
async function assistenzFragen(seite: Page, frage: string): Promise<AskKoerper> {
  await assistenzOeffnen(seite);
  const einwilligen = seite.getByTestId("klara-einwilligung-erteilen");
  if (await einwilligen.isVisible()) {
    await einwilligen.click();
    await expect(seite.getByTestId("klara-einwilligung-erteilt")).toBeVisible();
  }
  const frei = seite.getByTestId("klara-bezug-frei");
  if (await frei.isVisible()) {
    await frei.click();
  }
  const frageweg = seite.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/ask" && r.request().method() === "POST",
  );
  await seite.getByTestId("klara-eingabe").fill(frage);
  await seite.getByTestId("klara-eingabe").press("Enter");
  const antwort = await frageweg;
  expect(antwort.status(), await antwort.text()).toBe(200);
  await expect(
    seite.locator('[data-testid="klara-nachricht"][data-von="klara"]').last(),
  ).toHaveAttribute("data-gespeichert", "ja", { timeout: 15_000 });
  return (await antwort.json()) as AskKoerper;
}

/**
 * Ein offenes Assistenzgespräch bleibt über Seitenwechsel offen und liegt als modaler Bereich über
 * der Seite (gemessen: es fängt den Klick auf die Glocke ab). Wie ein Mensch schließt die Probe es,
 * bevor sie außerhalb der Assistenz weiterarbeitet — so auch `klara-kontext-artikel-browser.spec.ts`.
 */
async function assistenzSchliessen(seite: Page): Promise<void> {
  await expect(seite.getByTestId("klara-figur")).toBeAttached({ timeout: 15_000 });
  const gespraech = seite.getByTestId("klara-gespraech");
  if (await gespraech.isVisible()) {
    await seite.getByTestId("klara-schliessen").click();
    await expect(gespraech).toHaveCount(0);
  }
}

async function vorgangOeffnen(seite: Page, gapId: string): Promise<void> {
  await seite.goto(`/luecke/${gapId}`);
  await expect(seite.getByTestId("luecke-vorgang-stand")).toBeVisible({ timeout: 15_000 });
  await assistenzSchliessen(seite);
}

const zeile = (seite: Page, titel: string) =>
  seite.getByTestId("pruefen-warteschlange-eintrag").filter({ hasText: titel });

interface Ko {
  id: string;
  title: string;
  status: string;
  version: number;
}

test("Branchen-PoC · drei Arbeitsgeschichten mit getrennten Rollen im Browser, mit Messprotokoll", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureLoggedIn(page);
  beobachte(page);
  const protokoll: Messung[] = [];
  const kopf: Record<string, unknown> = { art: ART };
  try {
    // ---- Einstieg und Revision ------------------------------------------------------------------
    const health = await page.request.get("/health");
    expect(health.status(), await health.text()).toBe(200);
    const h = (await health.json()) as { version?: string; commit?: string; ai?: unknown };
    kopf.einstieg = `${test.info().project.use.baseURL ?? ""}/start`;
    kopf.version = h.version ?? null;
    kopf.commit = h.commit ?? null;
    kopf.kiBetrieb = h.ai ?? null;

    // ---- Ausgangsbestand ------------------------------------------------------------------------
    const marke = Date.now().toString(36);
    let carlaMail = `carla-${marke}@poc.test`;
    let erikMail = `erik-${marke}@poc.test`;
    let carlaKennwort = KENNWORT;
    let erikKennwort = KENNWORT;
    const geladen = await page.request.post("/api/admin/demo-seed", { data: {} });
    if (geladen.status() === 200) {
      const seed = (await geladen.json()) as {
        skipped: boolean;
        einmalkennwoerter: { email: string; kennwort: string }[];
      };
      expect(seed.skipped, "Demodaten waren schon geladen — kein definierter Start").toBe(false);
      const zugang = (mail: string) =>
        seed.einmalkennwoerter.find((z) => z.email === mail)?.kennwort ?? "";
      carlaMail = "carla@demo.klarwerk";
      erikMail = "erik@demo.klarwerk";
      carlaKennwort = zugang(carlaMail);
      erikKennwort = zugang(erikMail);
      kopf.ausgangsbestand = "Demodaten laden (POST /api/admin/demo-seed)";
    } else {
      expect(geladen.status(), "Ladeweg weder vorhanden noch sauber abwesend").toBe(404);
      kopf.ausgangsbestand =
        "Nachbildung über reguläre Routen mit DEMO_TEXTS.de.poc (Schalter KLARWERK_DEMO_SEED im Torlauf nicht gesetzt); ohne Quellenbezeichnung";
      for (const [name, email, role] of [
        ["Carla Controller", carlaMail, "controller"],
        ["Erik Experte", erikMail, "experte"],
      ] as const) {
        const konto = await page.request.post("/api/users", {
          data: { name, email, password: KENNWORT, role },
        });
        expect(konto.status(), await konto.text()).toBe(201);
      }
    }
    // Der zweite Controller führt die Folgeprüfung in der Oberfläche (Reiter „Erneut“ ist
    // controller+); die Fachprüfung bleibt damit bei zwei ANDEREN Personen.
    const theoMail = `theo-${marke}@poc.test`;
    const theoKonto = await page.request.post("/api/users", {
      data: { name: "Theo Teamleitung", email: theoMail, password: KENNWORT, role: "controller" },
    });
    expect(theoKonto.status(), await theoKonto.text()).toBe(201);
    // Die fragende Fachkraft in Geschichte 2. Verwaltung und Controller tragen `ko.assign` und sind
    // am Vorgang „verwaltend“ — ihr nächster Schritt ist „zuordnen“, die Übergabe auf der
    // Vorgangsseite bedienen nur rein Fragende (LueckenVorgang.tsx, gap-vorgang.ts).
    const fridaMail = `frida-${marke}@poc.test`;
    const fridaKonto = await page.request.post("/api/users", {
      data: { name: "Frida Fertigung", email: fridaMail, password: KENNWORT, role: "experte" },
    });
    expect(fridaKonto.status(), await fridaKonto.text()).toBe(201);

    const carla = await anmelden(browser, carlaMail, carlaKennwort);
    const erik = await anmelden(browser, erikMail, erikKennwort);
    const theo = await anmelden(browser, theoMail, KENNWORT);
    const frida = await anmelden(browser, fridaMail, KENNWORT);
    kopf.rollen = {
      verwaltung:
        "Smoke Tester (admin) — Lückenfrage im Ausgangsbestand, Übernahme des Vorschlags, Prüfung",
      carla: `Carla Controller (controller, ${carlaMail})`,
      erik: `Erik Experte (experte, ${erikMail}) — Fachzuständigkeit`,
      frida: `Frida Fertigung (experte, ${fridaMail}) — Fragende in Geschichte 2`,
      theo: `Theo Teamleitung (controller, ${theoMail}) — Folgeprüfung`,
    };

    if (geladen.status() !== 200) {
      const anlegen = async (text: { title: string; statement: string }, tags: string[]) => {
        const res = await erik.request.post("/api/kos", {
          data: {
            title: text.title,
            statement: text.statement,
            type: "best_practice",
            category: POC_KATEGORIE,
            confidentiality: "intern",
            neededValidations: 2,
            tags: [...tags, POC_TAG],
          },
        });
        expect(res.status(), await res.text()).toBe(201);
        return ((await res.json()) as Ko).id;
      };
      const freigeben = async (id: string) => {
        for (const pruefer of [carla, page]) {
          const r = await pruefer.request.put(`/api/kos/${id}`, {
            data: { action: "rate", verdict: "up" },
          });
          expect(r.status(), await r.text()).toBe(200);
        }
      };
      const koppeln = async (anlage: string, id: string) => {
        const r = await erik.request.post("/api/lifecycle/couple", {
          data: { assetRef: anlage, koId: id },
        });
        expect(r.status(), await r.text()).toBe(204);
      };
      await freigeben(await anlegen(p.koQuelle, ["kühlschmierstoff"]));
      for (const text of [p.koAnlageA, p.koAnlageB]) {
        const id = await anlegen(text, ["abfüllanlage"]);
        await freigeben(id);
        await koppeln(POC_ANLAGE, id);
      }
      const c = await anlegen(p.koUnbeteiligt, ["kompressor"]);
      await freigeben(c);
      await koppeln(POC_ANLAGE_UNBETEILIGT, c);
    }
    // Die Lückenfrage der Verwaltung (beim Demo-Weg schon gestellt: dieselbe Lücke).
    const gestellt = await page.request.post("/api/ask", { data: { question: LUECKENFRAGE } });
    expect(gestellt.status(), await gestellt.text()).toBe(200);
    const gapId = ((await gestellt.json()) as AskKoerper).gap?.id ?? "";
    expect(gapId, "die Lückenfrage ergab keine Lücke — kein Start für Geschichte 2").not.toBe("");

    const alle = (await (await page.request.get("/api/kos")).json()) as Ko[];
    const nachTitel = (titel: string): Ko => {
      const treffer = alle.filter((k) => k.title === titel);
      expect(treffer, `PoC-Eintrag „${titel}“ nicht genau einmal`).toHaveLength(1);
      return treffer[0] as Ko;
    };
    const quelle = nachTitel(p.koQuelle.title);
    const a = nachTitel(p.koAnlageA.title);
    const b = nachTitel(p.koAnlageB.title);
    const c = nachTitel(p.koUnbeteiligt.title);
    for (const ko of [quelle, a, b, c]) {
      expect(ko.status, ko.title).toBe("validiert");
    }

    // Persönliche Assistenz der Fachzuständigkeit: eigener Name und eines der dreizehn Motive.
    const profil = await erik.request.put("/api/me/assistenz", {
      data: {
        name: "Nora",
        avatar: "eule",
        bewegung: "standard",
        einrichtungAbschliessen: true,
        fassung: 0,
      },
    });
    expect(profil.status(), await profil.text()).toBe(200);
    await erik.reload();
    await expect(erik.getByTestId("klara-figur-name")).toHaveText("Nora", { timeout: 15_000 });

    // =============================== GESCHICHTE 1 · QUELLENANTWORT ===============================
    await schritt(
      protokoll,
      "1 Quellenantwort",
      "Fragende (Carla)",
      carla,
      [
        "Fragenseite ohne Modell gesperrt — gefragt wird über die persönliche Assistenz (derselbe Frageweg)",
      ],
      async (hilfe) => {
        await carla.goto("/start");
        hilfe.push("Assistenz: Frage gestellt");
        const antwort = await assistenzFragen(carla, p.quellenFrage);
        expect(antwort.result?.answered).toBe(true);
        expect(antwort.result?.citedSources ?? []).toContain(quelle.id);
        const klara = carla.locator('[data-testid="klara-nachricht"][data-von="klara"]').last();
        const chip = klara.locator(`[data-testid="klara-quelle"][data-ko="${quelle.id}"]`);
        await expect(chip).toBeVisible();
        await expect(chip).toHaveAttribute("data-fassung", String(quelle.version));
        await expect(chip).toHaveAttribute("data-geprueft", "ja");
        await bild(carla, info, "G1 · Antwort mit Quelle, Fassung, Prüfstand");

        // Die Quelle ist aufrufbar: der Link führt in den Eintrag.
        await chip.locator("a").first().click();
        await expect(carla).toHaveURL(new RegExp(`/wissen/${quelle.id}`), { timeout: 15_000 });
        // Seitenkontext der Assistenz auf der Quelle.
        hilfe.push("Assistenz: Seitenkontext gelesen");
        await assistenzOeffnen(carla);
        await expect(carla.getByTestId("klara-ort-seite")).toHaveText("Wissen");
        await expect(carla.getByTestId("klara-ort-objekt")).toHaveText(`„${quelle.title}“`, {
          timeout: 15_000,
        });
        await expect(carla.getByTestId("klara-ort-fassung")).toHaveText(
          `Fassung ${quelle.version}`,
        );
        await expect(carla.getByTestId("klara-ort-pruefstatus")).toHaveAttribute(
          "data-pruefstatus",
          "geprueft",
        );
        await bild(carla, info, "G1 · Quelle geöffnet, Seitenkontext der Assistenz");

        // Markierungskontext: eine Passage markieren → „… fragen“ mit Herkunft und Fassung.
        hilfe.push("Assistenz: Markierung übergeben");
        await carla.getByTestId("klara-schliessen").click();
        await expect(carla.getByTestId("klara-gespraech")).toHaveCount(0);
        const satz = "Der Kühlschmierstoff der Fräse M12 wird alle sechs Wochen";
        await carla
          .locator('[data-testid="bib-text"] p', { hasText: satz })
          .first()
          .click({ clickCount: 3 });
        await expect(carla.getByTestId("klara-auswahl-knopf")).toBeVisible();
        await carla.getByTestId("klara-auswahl-knopf").click();
        await expect(carla.getByTestId("klara-auswahl-text")).toContainText(satz);
        const herkunft = carla.getByTestId("klara-auswahl-herkunft");
        await expect(herkunft).toContainText(quelle.title);
        await expect(herkunft).toContainText(`Fassung ${quelle.version}`);
        await bild(carla, info, "G1 · Markierung mit Herkunft und Fassung");

        // Gegenprobe: eine Frage ohne Quelle bekommt keine Referenz.
        const ohne = await assistenzFragen(carla, LUECKENFRAGE);
        expect(ohne.result?.answered ?? false).toBe(false);
        expect(ohne.result?.citedSources ?? []).toEqual([]);
        const letzte = carla.locator('[data-testid="klara-nachricht"][data-von="klara"]').last();
        await expect(letzte.getByTestId("klara-grundlage-fehlt")).toBeVisible();
        await expect(letzte.getByTestId("klara-quelle")).toHaveCount(0);
        await bild(carla, info, "G1 · Frage ohne Quelle: Grundlage fehlt, keine Referenz");
      },
    );

    // ============================== GESCHICHTE 2 · LÜCKENABSCHLUSS ===============================
    await schritt(
      protokoll,
      "2 Lückenabschluss",
      "Fragende (Frida): Frage und Übergabe",
      frida,
      [],
      async (hilfe) => {
        // Frida stellt dieselbe Frage in ihrer Assistenz — dieselbe offene Lücke, sie ist jetzt
        // Fragende.
        await frida.goto("/start");
        hilfe.push("Assistenz: Frage gestellt");
        const gefragt = await assistenzFragen(frida, LUECKENFRAGE);
        expect(gefragt.result?.answered ?? false).toBe(false);
        expect(gefragt.gap?.id).toBe(gapId);
        await vorgangOeffnen(frida, gapId);
        await expect(frida.getByTestId("luecke-vorgang-stand")).toContainText(
          "Keine Fachzuständigkeit",
        );
        await expect(frida.getByTestId("luecke-vorgang-naechster")).toContainText(
          "An eine berechtigte Fachzuständigkeit übergeben",
        );
        hilfe.push("Assistenz erklärt den Vorgang (luecke-klara)");
        await expect(frida.getByTestId("luecke-klara")).toBeVisible();
        await frida.getByTestId("luecke-uebergeben").selectOption({ label: "Erik Experte" });
        await expect(frida.getByTestId("luecke-vorgang-stand")).toContainText(
          "In Bearbeitung durch die zuständige Person",
          { timeout: 15_000 },
        );
        await bild(frida, info, "G2 · Übergabe an die Fachzuständigkeit");
      },
    );

    await schritt(
      protokoll,
      "2 Lückenabschluss",
      "Fachzuständigkeit (Erik): Rückfrage",
      erik,
      [],
      async (hilfe) => {
        await vorgangOeffnen(erik, gapId);
        hilfe.push("Persönliche Assistenz „Nora“ am Vorgang");
        await expect(erik.getByTestId("luecke-klara")).toContainText("Nora");
        await erik.getByTestId("luecke-rueckfrage-text").fill(p.rueckfrage);
        await erik.getByRole("button", { name: "Rückfrage senden" }).click();
        await expect(erik.getByTestId("luecke-vorgang-stand")).toContainText(
          "Rückfrage an die Fragenden offen",
          { timeout: 15_000 },
        );
        await bild(erik, info, "G2 · Rückfrage mit persönlicher Assistenz");
      },
    );

    await schritt(
      protokoll,
      "2 Lückenabschluss",
      "Fragende (Frida): Antwort auf die Rückfrage",
      frida,
      [],
      async () => {
        await vorgangOeffnen(frida, gapId);
        await frida.getByTestId("luecke-rueckfrage-antwort").fill(p.rueckfrageAntwort);
        await frida.getByRole("button", { name: "Antwort senden" }).click();
        await expect(frida.getByTestId("luecke-vorgang-stand")).toContainText(
          "In Bearbeitung durch die zuständige Person",
          { timeout: 15_000 },
        );
      },
    );

    const erfasst: { ko?: Ko } = {};
    await schritt(
      protokoll,
      "2 Lückenabschluss",
      "Fachzuständigkeit (Erik): Eintrag erfassen und verknüpfen",
      erik,
      ["Eintrag über die Erfassungsroute der Sitzung angelegt, nicht über die Erfassungsfläche"],
      async () => {
        const angelegt = await erik.request.post("/api/kos", {
          data: {
            confidentiality: "intern",
            title: p.lueckenAntwort.title,
            statement: p.lueckenAntwort.statement,
            type: "best_practice",
            category: POC_KATEGORIE,
            neededValidations: 2,
          },
        });
        expect(angelegt.status(), await angelegt.text()).toBe(201);
        const ko = (await angelegt.json()) as Ko;
        erfasst.ko = ko;
        await vorgangOeffnen(erik, gapId);
        await erik.getByTestId("luecke-entwurf-verknuepfen").selectOption(ko.id);
        await expect(erik.getByTestId("luecke-vorgang-stand")).toContainText(
          "Antwortentwurf in der Fachprüfung",
          { timeout: 15_000 },
        );
        await expect(erik.getByTestId("luecke-abschliessen")).toBeDisabled();
        await bild(erik, info, "G2 · Entwurf verknüpft, Abschluss gesperrt");
      },
    );
    const antwortId = erfasst.ko?.id ?? "";

    for (const [rolle, seite] of [
      ["Fachprüfung (Carla)", carla],
      ["Fachprüfung (Verwaltung)", page],
    ] as const) {
      await schritt(
        protokoll,
        "2 Lückenabschluss",
        rolle,
        seite,
        ["Bewertung über die Bewertungsroute der Sitzung, nicht über die Prüffläche geklickt"],
        async () => {
          const r = await seite.request.put(`/api/kos/${antwortId}`, {
            data: { action: "rate", verdict: "up" },
          });
          expect(r.status(), await r.text()).toBe(200);
        },
      );
    }

    await schritt(
      protokoll,
      "2 Lückenabschluss",
      "Fachzuständigkeit (Erik): Abschluss",
      erik,
      [],
      async () => {
        await vorgangOeffnen(erik, gapId);
        await expect(erik.getByTestId("luecke-vorgang-stand")).toContainText(
          "Fachprüfung bestanden",
        );
        await erik.getByTestId("luecke-abschliessen").click();
        await expect(erik.getByTestId("luecke-vorgang-stand")).toContainText("Fachlich gelöst", {
          timeout: 15_000,
        });
        await bild(erik, info, "G2 · fachlich gelöst");
      },
    );

    await schritt(
      protokoll,
      "2 Lückenabschluss",
      "Fragende (Frida): Meldung und Wiederholung",
      frida,
      [],
      async (hilfe) => {
        await frida.goto("/start");
        await expect(workspaceMarker(frida)).toBeVisible({ timeout: 15_000 });
        await assistenzSchliessen(frida);
        await frida.getByTestId("kopfband-meldungen").click();
        const geloest = frida
          .locator(
            '[data-testid="meldung-oeffnen"][data-art="luecke"]:has([data-luecken-art="geloest"])',
          )
          .filter({ hasText: p.lueckenAntwort.title });
        await expect(geloest).toHaveCount(1, { timeout: 15_000 });
        await bild(frida, info, "G2 · genau eine Erfolgsmeldung in der Glocke");
        await geloest.click();
        await expect(frida).toHaveURL(new RegExp(`/luecke/${gapId}`), { timeout: 15_000 });
        await expect(frida.getByTestId("luecke-eintrag")).toHaveAttribute("data-nutzbar", "ja");
        await frida.getByTestId("luecke-ergebnis-oeffnen").click();
        await expect(frida).toHaveURL(new RegExp(`/wissen/${antwortId}`), { timeout: 15_000 });
        await bild(frida, info, "G2 · Ergebnis geöffnet");
        // Wiederholung in der Assistenz: der abgeschlossene Wissensstand statt einer neuen Lücke.
        hilfe.push("Assistenz: Wiederholungsfrage");
        const w = await assistenzFragen(frida, LUECKENFRAGE);
        expect(w.gap).toBeNull();
        const zeigtEintrag =
          w.geloesteLuecke?.koId === antwortId ||
          (w.result?.answered === true && (w.result.citedSources ?? []).includes(antwortId));
        expect(zeigtEintrag, JSON.stringify(w)).toBe(true);
        await bild(frida, info, "G2 · Wiederholungsfrage zeigt den abgeschlossenen Stand");
      },
    );

    // ============================= GESCHICHTE 3 · QUELLENÄNDERUNG ================================
    await schritt(protokoll, "3 Quellenänderung", "Meldung (Carla)", carla, [], async () => {
      await carla.goto("/lebenszyklus");
      await expect(carla.getByTestId("pruefen-flaeche")).toBeVisible({ timeout: 15_000 });
      await assistenzSchliessen(carla);
      const melden = carla.getByTestId("pruefen-anlage");
      await melden.locator("summary").click();
      await melden.locator("input").nth(0).fill(POC_ANLAGE);
      await melden.locator("input").nth(1).fill(p.anlageAenderung);
      await melden.getByRole("button").click();
      await expect(carla.getByTestId("pruefen-quittung")).toBeVisible();
      await bild(carla, info, "G3 · Änderung gemeldet");
    });

    await schritt(
      protokoll,
      "3 Quellenänderung",
      "Folgeprüfung (Theo): Betroffenheit und Eintrag A",
      theo,
      [],
      async (hilfe) => {
        await theo.goto("/lebenszyklus");
        await expect(theo.getByTestId("pruefen-flaeche")).toBeVisible({ timeout: 15_000 });
        await expect(zeile(theo, a.title)).toBeVisible({ timeout: 15_000 });
        await expect(zeile(theo, b.title)).toBeVisible();
        await expect(zeile(theo, c.title), "unbeteiligter Eintrag").toHaveCount(0);
        await expect(zeile(theo, quelle.title), "Antwortquelle aus Geschichte 1").toHaveCount(0);
        await expect(zeile(theo, a.title).getByTestId("folgepruefung-zeile")).toContainText(
          "Erik Experte",
        );
        await zeile(theo, a.title).click();
        const warum = theo.getByTestId("pruefen-karte").getByTestId("folgepruefung-warum");
        await expect(warum).toContainText(POC_ANLAGE);
        await expect(warum).toContainText(p.anlageAenderung);
        hilfe.push("Begründung der Betroffenheit gelesen (Karte)");
        await bild(theo, info, "G3 · begründete Betroffenheit, Unbeteiligter fehlt");
        await theo.getByTestId("pruefen-knopf-noch-gueltig").click();
        await expect(zeile(theo, a.title)).toHaveCount(0, { timeout: 15_000 });
        await expect(zeile(theo, b.title), "B bleibt offen").toBeVisible();
      },
    );

    await schritt(
      protokoll,
      "3 Quellenänderung",
      "Fachzuständigkeit (Erik): Anpassung als Vorschlag",
      erik,
      ["Vorschlag über die Route der Sitzung, nicht über den Editor geklickt"],
      async () => {
        const aktuell = (await (await erik.request.get(`/api/kos/${b.id}`)).json()) as Ko;
        const direkt = await erik.request.put(`/api/kos/${b.id}`, {
          data: { action: "revise", changes: { statement: p.koAnlageBNeu } },
        });
        expect(direkt.status(), await direkt.text()).toBe(403);
        const vorgeschlagen = await erik.request.put(`/api/kos/${b.id}`, {
          data: {
            action: "propose",
            proposal: { statement: p.koAnlageBNeu, baseVersion: aktuell.version },
          },
        });
        expect(vorgeschlagen.status(), await vorgeschlagen.text()).toBe(200);
      },
    );

    await schritt(
      protokoll,
      "3 Quellenänderung",
      "Verwaltung: Vorschlag übernehmen",
      page,
      ["Übernahme über die Route der Sitzung, nicht über die Vorschlagsfläche geklickt"],
      async () => {
        const stand = (await (await page.request.get(`/api/kos/${b.id}`)).json()) as Ko & {
          proposals?: { id: string; status: string }[];
        };
        const vorschlag = stand.proposals?.find((v) => v.status === "offen");
        expect(vorschlag, JSON.stringify(stand.proposals ?? null)).toBeDefined();
        const r = await page.request.put(`/api/kos/${b.id}`, {
          data: {
            action: "decide-proposal",
            proposalId: vorschlag?.id,
            decision: "uebernehmen",
            expectedVersion: stand.version,
          },
        });
        expect(r.status(), await r.text()).toBe(200);
      },
    );

    await schritt(
      protokoll,
      "3 Quellenänderung",
      "Folgeprüfung (Theo): Eintrag B in neuer Fassung",
      theo,
      [],
      async () => {
        await theo.reload();
        await expect(theo.getByTestId("pruefen-flaeche")).toBeVisible({ timeout: 15_000 });
        await zeile(theo, b.title).click();
        await theo.getByTestId("pruefen-knopf-noch-gueltig").click();
        await expect(zeile(theo, b.title)).toHaveCount(0, { timeout: 15_000 });
        await bild(theo, info, "G3 · beide Folgefälle geschlossen");
      },
    );

    for (const [rolle, seite] of [
      ["Fachprüfung (Carla)", carla],
      ["Fachprüfung (Verwaltung)", page],
    ] as const) {
      await schritt(
        protokoll,
        "3 Quellenänderung",
        rolle,
        seite,
        ["Bewertung über die Bewertungsroute der Sitzung, nicht über die Prüffläche geklickt"],
        async () => {
          for (const ko of [a, b]) {
            const r = await seite.request.put(`/api/kos/${ko.id}`, {
              data: { action: "rate", verdict: "up" },
            });
            expect(r.status(), await r.text()).toBe(200);
          }
        },
      );
    }
    for (const ko of [a, b, c]) {
      const jetzt = (await (await page.request.get(`/api/kos/${ko.id}`)).json()) as Ko;
      expect(jetzt.status, ko.title).toBe("validiert");
    }
    const bJetzt = (await (await page.request.get(`/api/kos/${b.id}`)).json()) as {
      statement: string;
    };
    expect(bJetzt.statement).toBe(p.koAnlageBNeu);

    for (const seite of [carla, erik, theo, frida]) {
      await seite.context().close();
    }
  } finally {
    await info.attach("PoC-Messprotokoll", {
      body: JSON.stringify({ ...kopf, messungen: protokoll }, null, 2),
      contentType: "application/json",
    });
  }
});
