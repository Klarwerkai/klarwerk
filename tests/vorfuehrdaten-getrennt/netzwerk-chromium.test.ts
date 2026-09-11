// ================================================================================================
// JOB 3636 R2 · IM NETZWERK NACHGESEHEN — welcher Knopf ruft welchen Weg, im echten Browser.
// ================================================================================================
//
// BENs Korrekturpflicht 4 an Runde 1: „Browserprüfung mit abgefangenen POST-Aufrufen ergänzen:
// beide Karten, unterschiedliche Netzwerkziele und benannte Rückmeldungen in DE/EN." Der Auftrag
// verlangt dasselbe in §7: „jeder Knopf löst den ihm zugehörigen Aufruf aus (im Netzwerk
// nachgesehen, NICHT am Text abgelesen)".
//
// WARUM DIESE DATEI NEBEN DEM GEMOUNTETEN FALL STEHT. `flaeche-mounted.test.tsx` misst an der
// ENDPUNKTGRENZE: es ersetzt `endpoints.admin.*` durch Attrappen und sieht, welche Funktion
// gerufen wurde. Das ist scharf gegen Verwechslung, aber es glaubt der Endpunktdatei aufs Wort —
// welche HTTP-Adresse hinter `demoPackages.load` steht, kommt dort nie vor. Hier läuft das
// GEBAUTE Produkt (`apps/web/dist`) in Chromium gegen die ECHTE Fastify-App, und gemessen wird
// die Anfrage auf dem Draht: Methode und Pfad.
//
// KEINE ECHTEN DEMODATEN — Pedi hat das ausdrücklich untersagt (Auftrag §7: „Lade die Demodaten
// NICHT nur, um die Seite anzusehen"). Die beiden LADE-POSTs werden deshalb abgefangen und mit
// einer Attrappe beantwortet; sie erreichen die echte App nie. ALLES ANDERE bleibt echt und geht
// an den Server durch — insbesondere `GET /api/admin/demo-packages`. Genau darauf kommt es an:
// die Kennung, mit der die Fläche lädt, stammt aus der ANTWORT DES ECHTEN SERVERS und nicht aus
// einer Attrappe dieses Tests (Auftrag §4: „Hol die Kennung aus der vorhandenen Liste").
//
//   N1  Beide Karten       Die zwei Karten stehen mit ihren eigenen Knöpfen in der Detailkarte.
//   N2  Knopf 1            POST /api/admin/demo-seed — und KEIN Paket-POST.
//   N3  Knopf 2            POST /api/admin/demo-packages/advisor-ict-en-v1/load — und kein Seed.
//   N4  Rückmeldung        Die Fläche nennt nach dem Laden das Paket beim Namen (§6).
//   N5  EN                 Dieselben zwei Wege, englische Beschriftung, englische Rückmeldung.
//
// Ein Browser, eine Seite, fünf Fälle — auf dem gemeinsamen Prüfstand `tests/design/h6-chromium.ts`
// und damit KEINE neue Playwright-Startstelle (s. `tests/tor-inventar/tor-bestand-vollstaendig.
// test.ts`, Fall B4: Dateien, die über `h6-chromium.ts` fahren, tauchen dort bewusst nicht auf).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { ORIGIN, type Stand, beende, fn, starte } from "../design/h6-chromium";

const t = (k: string, o?: Record<string, unknown>): string => i18n.t(k, o ?? {});

/** Die Kennung, die der echte Server führt (`services/app/src/example-packages/advisor-ict-en-v1.ts:91`). */
const ADVISOR = "advisor-ict-en-v1";
const SEED_PFAD = "/api/admin/demo-seed";
const LADE_PFAD = `/api/admin/demo-packages/${ADVISOR}/load`;

/** Was der Server auf einen Paketladen antwortet — Form nach `api/types.ts:1535`. */
const PAKET_ATTRAPPE = {
  package: ADVISOR,
  run: "job3636-r2-attrappe",
  created: 6,
  updated: 0,
  skipped: 0,
  removed: 0,
  removedAssigned: 0,
  registered: 6,
  duplicates: 0,
  skippedInTrash: 0,
  closedConflicts: 0,
  closedDuplicates: 0,
  failures: [],
};

/** Was der Server auf den Grundbestand antwortet — Form nach `endpoints.admin.demoSeed`. */
const SEED_ATTRAPPE = { kos: 12, users: 3, skipped: false, einmalkennwoerter: [] };

/** Jede abgefangene Schreibanfrage, in der Reihenfolge, in der sie auf dem Draht lag. */
const gesehen: { methode: string; pfad: string }[] = [];

let stand: Stand | null = null;
let demoSchalterVorher: string | undefined;

/**
 * In der Seite: Reiter wählen, Zeile öffnen, auf die Detailkarte warten.
 * Derselbe Weg wie im Funktionsinventar (`tests/design/h6-funktionsinventar.test.ts`, Zeile 16).
 */
const OEFFNE = `(async ([reiter]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const sichtbar = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
  };
  const warte = async (pruefung, ms = 8000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) { if (pruefung()) return true; await new Promise((r) => setTimeout(r, 50)); }
    return pruefung();
  };
  if (document.querySelector('[data-testid="detail-demodaten"]') === null) {
    const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => norm(b.textContent) === reiter);
    if (!r) return 'Reiter „' + reiter + '" fehlt';
    r.click();
    if (!(await warte(() => r.getAttribute('aria-pressed') === 'true'))) return 'Reiter ging nicht auf';
    const zeile = document.querySelector('[data-testid="zeile-demodaten"]');
    if (!zeile) return 'Zeile „Demodaten" fehlt';
    zeile.click();
  }
  if (!(await warte(() => sichtbar(document.querySelector('[data-testid="detail-demodaten"]'))))) {
    return 'Detailkarte „detail-demodaten" ging nicht auf';
  }
  // Die Paketliste kommt echt vom Server und braucht ihren Augenblick.
  if (!(await warte(() => document.querySelector('[data-demopaket]') !== null, 15000))) {
    return 'Advisor-Karte kam nicht: ' + norm(document.querySelector('[data-einst="karte-advisor"]').innerText);
  }
  return null;
})`;

/** In der Seite: einen Knopf IN einer der beiden Karten über seine sichtbare Schrift drücken. */
const DRUECKE = `(async ([karte, schrift]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const raum = document.querySelector('[data-einst="karte-' + karte + '"]');
  if (!raum) return 'Karte „' + karte + '" fehlt';
  const treffer = [...raum.querySelectorAll('button')].filter((b) => norm(b.textContent).includes(schrift));
  if (treffer.length !== 1) return 'Knopf „' + schrift + '" in Karte ' + karte + ': ' + treffer.length + ' Treffer · sichtbar: ' + norm(raum.innerText);
  treffer[0].click();
  await new Promise((r) => setTimeout(r, 1200));
  return null;
})`;

/** In der Seite: der sichtbare Text einer der beiden Karten. */
const TEXT = `([karte]) => {
  const el = document.querySelector('[data-einst="karte-' + karte + '"]');
  return el === null ? null : (el.innerText || '').replace(/\\s+/g, ' ').trim();
}`;

/**
 * In der Seite: die Sprache auf demselben Weg umstellen, den Pedi hat — Konto-Menü im Kopfband,
 * Zeile „Sprache", Knopf EN (`components/SprachSchalter.tsx`, `sprach-schalter-<l>`). Kein
 * `i18n.changeLanguage` von aussen: das wäre eine Umgehung der Fläche, und der Auftrag verlangt
 * DE/EN an der Fläche.
 *
 * Der Beleg, dass es wirklich gewirkt hat, ist das `lang`-Attribut an `<html>` — es hängt an
 * `applyHtmlLang` (`lib/htmlLang.ts`) und damit an derselben einen Sprachwahrheit.
 */
const SPRACHE = `(async ([kuerzel]) => {
  const warte = async (pruefung, ms = 8000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) { if (pruefung()) return true; await new Promise((r) => setTimeout(r, 50)); }
    return pruefung();
  };
  const konto = document.querySelector('[data-testid="kopfband-konto"]');
  if (!konto) return 'Konto-Kreis im Kopfband fehlt';
  konto.click();
  const wahl = '[data-testid="sprach-schalter-' + kuerzel + '"]';
  if (!(await warte(() => document.querySelector(wahl) !== null))) return 'Sprachschalter ' + kuerzel + ' kam nicht ins Menü';
  document.querySelector(wahl).click();
  if (!(await warte(() => document.documentElement.lang.startsWith(kuerzel)))) {
    return 'Sprache blieb ' + document.documentElement.lang;
  }
  // Menü wieder zu, sonst liegt es über der Karte. Erst der Weg, den auch die Tastatur geht;
  // bleibt es offen, derselbe Konto-Kreis noch einmal (er schaltet um).
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  if (!(await warte(() => document.querySelector(wahl) === null, 2000))) {
    konto.click();
    if (!(await warte(() => document.querySelector(wahl) === null, 2000))) return 'Konto-Menü blieb offen';
  }
  return null;
})`;

/** Alles, was seit dem letzten Aufruf auf dem Draht lag. */
function seitdem(): string[] {
  const liste = gesehen.map((g) => `${g.methode} ${g.pfad}`);
  gesehen.length = 0;
  return liste;
}

async function oeffne(): Promise<void> {
  expect(stand?.fehler, "Prüfstand nicht gestartet").toBeNull();
  const fehler = await (stand as Stand).seite?.evaluate<string | null>(fn(OEFFNE), [
    t("adm.sec.vorfuehrdaten"),
  ]);
  expect(fehler, "Demodaten-Karte nicht erreichbar").toBeNull();
}

async function druecke(karte: "allgemein" | "advisor", schrift: string): Promise<void> {
  const fehler = await (stand as Stand).seite?.evaluate<string | null>(fn(DRUECKE), [
    karte,
    schrift,
  ]);
  expect(fehler, `Knopf „${schrift}" nicht gedrückt`).toBeNull();
}

const kartentext = async (karte: "allgemein" | "advisor"): Promise<string> =>
  (await (stand as Stand).seite?.evaluate<string | null>(fn(TEXT), [karte])) ?? "";

describe("JOB 3636 R2 · zwei Knöpfe, zwei Netzwerkziele — gemessen in Chromium", () => {
  beforeAll(async () => {
    // Ohne diesen Schalter ist der Knopf der allgemeinen Karte baulich abwesend (mega64 Block A,
    // `FeatureGate feature="demodaten"`). Die Vorgabe des Produkts bleibt AUS; sie wird nur für
    // die Dauer dieser Datei gesetzt und danach wiederhergestellt — die Umgebung gehört dem
    // ganzen Prozess (dieselbe Handhabung wie in `h6-funktionsinventar.test.ts:770`).
    demoSchalterVorher = process.env.KLARWERK_DEMO_SEED;
    process.env.KLARWERK_DEMO_SEED = "1";
    await i18n.changeLanguage("de");
    stand = await starte("/admin", '[data-einst="seite"]', 1280, 900);
    if (stand.fehler === null && stand.seite) {
      /**
       * DIE ABFANGWEICHE. Sie wird NACH `starte` registriert und gewinnt deshalb: Playwright
       * probiert Routen in umgekehrter Reihenfolge ihrer Anmeldung. Was sie nicht selbst
       * beantwortet, reicht sie mit `fallback()` an die Weiche des Prüfstands weiter, die den
       * echten Server fragt.
       *
       * `fallback()` steht nicht in der schmalen `Route`-Schnittstelle von `h6-chromium.ts`
       * (sie beschreibt nur, was die dortige Weiche braucht). Zur Laufzeit ist das Objekt ein
       * echtes Playwright-`Route` und hat die Methode seit 1.23; der Baum fährt 1.61. Die
       * Erweiterung steht deshalb hier als örtliche Sicht auf dasselbe Objekt, statt den
       * gemeinsamen Prüfstand für einen einzigen Aufrufer umzubauen.
       */
      await stand.seite.route(`${ORIGIN}/api/admin/**`, async (route) => {
        const req = route.request();
        const pfad = new URL(req.url()).pathname;
        const methode = req.method();
        const weiter = route as unknown as { fallback(): Promise<void> };
        if (methode !== "POST" || (pfad !== SEED_PFAD && pfad !== LADE_PFAD)) {
          await weiter.fallback();
          return;
        }
        gesehen.push({ methode, pfad });
        await route.fulfill({
          status: 200,
          body: JSON.stringify(pfad === SEED_PFAD ? SEED_ATTRAPPE : PAKET_ATTRAPPE),
          headers: { "content-type": "application/json" },
        });
      });
      await stand.seite.waitForFunction(
        fn(`() => document.querySelectorAll('[data-einst="zeile"]').length > 0`),
        undefined,
        { timeout: 30_000 },
      );
    }
  }, 240_000);

  afterAll(async () => {
    if (stand) await beende(stand);
    if (demoSchalterVorher === undefined) {
      delete process.env.KLARWERK_DEMO_SEED;
    } else {
      process.env.KLARWERK_DEMO_SEED = demoSchalterVorher;
    }
    await i18n.changeLanguage("de");
  }, 60_000);

  it("N1 · beide Karten stehen in der Detailkarte, jede mit ihrem eigenen Knopf", async () => {
    await oeffne();
    const allgemein = await kartentext("allgemein");
    const advisor = await kartentext("advisor");
    expect(allgemein, "Karte 1 ohne ihren Knopf").toContain(t("adm.seedButton"));
    // Der Paketname kommt aus der ECHTEN Serverantwort, nicht aus einer Attrappe dieses Tests.
    expect(advisor, "Karte 2 ohne den Paketnamen des Servers").toContain("Advisor ICT (EN)");
    expect(advisor).toContain(`${t("dpk.load")} · Advisor ICT (EN)`);
    // Und die Trennung ist keine Behauptung: in Karte 1 steht nichts vom Advisor-Paket.
    expect(allgemein, "die allgemeine Karte spricht vom Advisor").not.toContain("Advisor");
    seitdem();
  });

  it("N2 · „Demodaten laden“ schickt POST /api/admin/demo-seed — und sonst nichts", async () => {
    await oeffne();
    seitdem();
    await druecke("allgemein", t("adm.seedButton"));
    expect(seitdem()).toEqual([`POST ${SEED_PFAD}`]);
  });

  it("N3 · der Advisor-Knopf schickt POST auf die Paketroute mit der Kennung des Servers", async () => {
    await oeffne();
    seitdem();
    await druecke("advisor", `${t("dpk.load")} · Advisor ICT (EN)`);
    // DIE REGEL DES AUFTRAGS (§4), auf dem Draht: eine ANDERE Adresse, nicht derselbe Aufruf mit
    // anderer Schrift. Und die Kennung darin ist die, die `GET /api/admin/demo-packages` genannt
    // hat — dieser GET ging echt an den Server, er wird von der Weiche oben durchgereicht.
    expect(seitdem()).toEqual([`POST ${LADE_PFAD}`]);
  });

  it("N4 · nach dem Laden nennt die Fläche das Paket beim Namen", async () => {
    await oeffne();
    seitdem();
    await druecke("advisor", `${t("dpk.load")} · Advisor ICT (EN)`);
    expect(seitdem()).toEqual([`POST ${LADE_PFAD}`]);
    const advisor = await kartentext("advisor");
    expect(advisor).toContain(
      `Advisor ICT (EN) · ${t("dpk.resultLoad", { created: 6, skipped: 0 })}`,
    );
  });

  it("N5 · in EN sind beide Wege dieselben — Beschriftung und Rückmeldung englisch", async () => {
    await oeffne();
    const fehler = await (stand as Stand).seite?.evaluate<string | null>(fn(SPRACHE), ["en"]);
    expect(fehler, "Sprache ließ sich nicht umstellen").toBeNull();
    await i18n.changeLanguage("en");
    await oeffne();
    seitdem();

    await druecke("allgemein", t("adm.seedButton"));
    expect(seitdem()).toEqual([`POST ${SEED_PFAD}`]);

    await druecke("advisor", `${t("dpk.load")} · Advisor ICT (EN)`);
    expect(seitdem()).toEqual([`POST ${LADE_PFAD}`]);
    const advisor = await kartentext("advisor");
    expect(advisor).toContain(
      `Advisor ICT (EN) · ${t("dpk.resultLoad", { created: 6, skipped: 0 })}`,
    );
    // Die englische Bilanz ist wirklich englisch und nicht der stehengebliebene deutsche Satz.
    expect(advisor).toContain("6 created");
    expect(advisor).not.toContain("6 angelegt");
  });
});
