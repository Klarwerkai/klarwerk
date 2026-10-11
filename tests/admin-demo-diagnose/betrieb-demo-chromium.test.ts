// ================================================================================================
// ADMIN-16 · IM ECHTEN BROWSER — 390 × 844 UND DESKTOP, TASTATUR, VORSCHAU UND BEGRENZTES ENTFERNEN.
// ================================================================================================
//
// produkt:20261009:admin-demo-diagnose. Das GEBAUTE Produkt (`apps/web/dist`) in Chromium gegen die
// echte App mit einem frischen Speicherbestand (`tests/design/h6-chromium.ts`) — isoliert, nur
// erfundene Daten, kein Produktionszugriff.
//
//   B1  K1/K2  390 × 844: „Vorführdaten" zeigt Demodaten, Pakete und Testimporte ohne waagrechten
//              Überlauf; /import zeigt keinen Paket- oder Aufräumkasten.
//   B2  K5     Tastatur: Zeile mit Enter öffnen, Pfad lesen, „Zurück" mit Enter — wieder im Thema.
//   B3  K3/K4  Advisor-Paket laden, Entfernen anfragen: die Vorschau nennt sechs Kennungen, nicht
//              die des unabhängigen Beitrags; nach der Bestätigung ist er unverändert da.
//   B4  K5     Der alte Direktlink /import#demopakete landet auf der neuen Karte.
//   B5  K1     Dieselbe Fläche auf Desktopbreite (1280).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { adminHref } from "../../apps/web/src/lib/adminSections";
import { type Stand, beende, fn, starte, wechsle } from "../design/h6-chromium";

const t = (k: string, o?: Record<string, unknown>): string => i18n.t(k, o ?? {});

const ADVISOR = "advisor-ict-en-v1";

let stand: Stand | null = null;
/** Der unabhängige, fiktive Beitrag — angelegt VOR dem ersten Seitenaufbau über die echte Route. */
const beitrag = { id: "", titel: "", version: 0, token: "" };

const UEBERLAUF = `() => {
  const doc = document.documentElement;
  return { breite: window.innerWidth, scroll: doc.scrollWidth };
}`;

const TEXT_VON = `([sel]) => {
  const el = document.querySelector(sel);
  return el === null ? null : (el.innerText || '').replace(/\\s+/g, ' ').trim();
}`;

/** In der Seite: einen Knopf INNERHALB eines Behälters über seine sichtbare Schrift drücken. */
const DRUECKE = `(async ([behaelter, schrift]) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const raum = document.querySelector(behaelter);
  if (!raum) return 'Behälter ' + behaelter + ' fehlt';
  const treffer = [...raum.querySelectorAll('button')].filter((b) => norm(b.textContent) === schrift);
  if (treffer.length !== 1) return 'Knopf „' + schrift + '": ' + treffer.length + ' Treffer · ' + norm(raum.innerText).slice(0, 300);
  treffer[0].click();
  return null;
})`;

function seite(): NonNullable<Stand["seite"]> {
  expect(stand?.fehler, "Seite nicht gestartet").toBeNull();
  return (stand as Stand).seite as NonNullable<Stand["seite"]>;
}

async function warteAuf(selektor: string, ms = 20_000): Promise<void> {
  await seite().waitForFunction(fn("(s) => document.querySelector(s) !== null"), selektor, {
    timeout: ms,
  });
}

async function textVon(selektor: string): Promise<string> {
  return (await seite().evaluate<string | null>(fn(TEXT_VON), [selektor])) ?? "";
}

beforeAll(async () => {
  stand = await starte(
    adminHref("vorfuehrdaten"),
    '[data-testid="zeile-demopakete"]',
    390,
    844,
    async (app) => {
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3065.test", password: "geheim12345" },
      });
      beitrag.token = (login.json() as { token: string }).token;
      const angelegt = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: { authorization: `Bearer ${beitrag.token}` },
        payload: {
          confidentiality: "intern",
          title: "Fiktive Musterfirma: Rückruf innerhalb von zwei Stunden",
          statement:
            "Bei der fiktiven Musterfirma GmbH erfolgt ein Kundenrückruf binnen zwei Stunden.",
          type: "best_practice",
          category: "Service",
        },
      });
      const ko = angelegt.json() as { id: string; title: string; version: number };
      beitrag.id = ko.id;
      beitrag.titel = ko.title;
      beitrag.version = ko.version;
    },
  );
}, 180_000);

afterAll(async () => {
  if (stand) await beende(stand);
}, 60_000);

describe("ADMIN-16 · Betrieb und Demo in Chromium", () => {
  it("B1 · 390 × 844: drei Zeilen unter Vorführdaten, ohne waagrechten Überlauf", async () => {
    expect(beitrag.id, "der unabhängige Beitrag wurde nicht angelegt").not.toBe("");
    const s = seite();
    for (const id of ["zeile-demodaten", "zeile-demopakete", "zeile-testimporte"]) {
      await warteAuf(`[data-testid="${id}"]`);
    }
    expect(await textVon('[data-testid="zeile-testimporte"]')).toContain(
      t("betriebdemo.wert.alleImporte"),
    );
    const m = await s.evaluate<{ breite: number; scroll: number }>(fn(UEBERLAUF));
    expect(m.breite).toBe(390);
    expect(m.scroll, "waagrechter Überlauf bei 390 px").toBeLessThanOrEqual(m.breite);
  }, 60_000);

  it("B2 · Tastatur: Enter öffnet die Paketkarte, Enter auf „Zurück“ führt ins Thema zurück", async () => {
    const s = seite();
    await s.evaluate(
      fn(`() => { document.querySelector('[data-testid="zeile-demopakete"]').focus(); }`),
    );
    await s.keyboard.press("Enter");
    await warteAuf('[data-testid="detail-pakete"]');
    expect(await textVon('[data-einst="pfad"]')).toBe(
      [t("gliederung.verwaltung"), t("adm.sec.vorfuehrdaten"), t("betriebdemo.ziel.pakete")].join(
        " › ",
      ),
    );
    const ort = await s.evaluate<string>(fn("() => location.pathname + location.search"));
    expect(ort).toBe(adminHref("vorfuehrdaten", "pakete"));
    const m = await s.evaluate<{ breite: number; scroll: number }>(fn(UEBERLAUF));
    expect(m.scroll, "die Paketkarte läuft bei 390 px über").toBeLessThanOrEqual(m.breite);

    await s.evaluate(
      fn(
        `() => { document.querySelector('[data-testid="detail-pakete"] [data-einst="zurueck"]').focus(); }`,
      ),
    );
    await s.keyboard.press("Enter");
    await warteAuf('[data-testid="zeile-demopakete"]');
    expect(await s.evaluate<string>(fn("() => location.pathname + location.search"))).toBe(
      adminHref("vorfuehrdaten"),
    );
  }, 60_000);

  it("B3 · laden, Vorschau vor dem Entfernen, bestätigen — der unabhängige Beitrag bleibt", async () => {
    const s = seite();
    await wechsle(
      stand as Stand,
      adminHref("vorfuehrdaten", "pakete"),
      '[data-testid="detail-pakete"]',
    );
    const karte = `[data-demopaket="${ADVISOR}"]`;
    await warteAuf(karte);
    expect(await textVon(karte)).toContain(t("dpk.fictional"));

    expect(await s.evaluate<string | null>(fn(DRUECKE), [karte, t("dpk.load")])).toBeNull();
    await warteAuf(`[data-demopaket-bilanz="${ADVISOR}"]`, 30_000);
    expect(await textVon(`[data-demopaket-bilanz="${ADVISOR}"]`)).toContain(
      t("dpk.resultLoad", { created: 6, skipped: 0 }),
    );

    // „Paket entfernen" ist erst bedienbar, wenn die Übersicht den geladenen Bestand gezählt hat.
    await s.waitForFunction(
      fn(`([sel, schrift]) => {
        const norm = (x) => (x || '').replace(/\\s+/g, ' ').trim();
        const raum = document.querySelector(sel);
        return raum !== null && [...raum.querySelectorAll('button')].some((b) => norm(b.textContent) === schrift && !b.disabled);
      }`),
      [karte, t("dpk.remove")],
      { timeout: 20_000 },
    );
    // Entfernen fragt zuerst — und holt dabei die Vorschau vom Server.
    expect(await s.evaluate<string | null>(fn(DRUECKE), [karte, t("dpk.remove")])).toBeNull();
    const vorschauSel = `[data-demopaket-vorschau="${ADVISOR}"]`;
    await s.waitForFunction(
      fn(`([sel, erwartet]) => {
        const el = document.querySelector(sel);
        return el !== null && (el.innerText || '').includes(erwartet);
      }`),
      [vorschauSel, t("dpk.previewRemove", { n: 6, ids: "" }).trim()],
      { timeout: 20_000 },
    );
    const vorschau = await textVon(vorschauSel);
    expect(vorschau, "die Vorschau nennt den unabhängigen Beitrag").not.toContain(beitrag.id);

    expect(
      await s.evaluate<string | null>(fn(DRUECKE), [karte, t("dpk.removeConfirm")]),
    ).toBeNull();
    await s.waitForFunction(
      fn(`([sel, erwartet]) => {
        const el = document.querySelector(sel);
        return el !== null && (el.innerText || '').includes(erwartet);
      }`),
      [
        `[data-demopaket-bilanz="${ADVISOR}"]`,
        t("dpk.resultRemove", { removed: 6, conflicts: 0, duplicates: 0 }),
      ],
      { timeout: 30_000 },
    );

    // Am Server nachgesehen, nicht an der Fläche: der Beitrag ist unverändert da.
    const app = (stand as Stand).app;
    const nachher = await app?.inject({
      method: "GET",
      url: `/api/kos/${beitrag.id}`,
      headers: { authorization: `Bearer ${beitrag.token}` },
    });
    expect(nachher?.statusCode).toBe(200);
    const ko = nachher?.json() as { title: string; version: number };
    expect(ko.title).toBe(beitrag.titel);
    expect(ko.version).toBe(beitrag.version);
  }, 120_000);

  it("B4 · /import zeigt keine Vorführkästen; /import#demopakete führt auf die Paketkarte", async () => {
    const s = seite();
    await s.evaluate(fn(`() => { localStorage.setItem("kw.stufe2.v1", "1"); }`));
    await wechsle(stand as Stand, "/import", "h1");
    await s.waitForFunction(
      fn(
        `([titel]) => [...document.querySelectorAll('h1')].some((h) => (h.textContent || '').trim() === titel)`,
      ),
      [t("nav.import")],
      { timeout: 20_000 },
    );
    // Die früheren Kästen rendeten im selben Durchgang wie der Seitenkopf; steht der `h1`, stünden
    // sie auch. Die kurze Pause lässt nachgeladene Abschnitte trotzdem zur Ruhe kommen.
    await s.waitForTimeout(1000);
    const text = await s.evaluate<string>(fn("() => document.body.innerText"));
    for (const key of ["exp.title", "dpk.title", "imp.cleanup.title"]) {
      expect(text, `„${t(key)}“ steht auf /import`).not.toContain(t(key));
    }
    await wechsle(stand as Stand, "/import#demopakete", '[data-testid="detail-pakete"]');
    expect(await s.evaluate<string>(fn("() => location.pathname + location.search"))).toBe(
      adminHref("vorfuehrdaten", "pakete"),
    );
  }, 90_000);

  it("B5 · Desktop 1280: dieselben drei Zeilen, kein Überlauf, und keine Seitenfehler", async () => {
    const s = seite();
    await s.setViewportSize({ width: 1280, height: 900 });
    await wechsle(stand as Stand, adminHref("vorfuehrdaten"), '[data-testid="zeile-testimporte"]');
    const m = await s.evaluate<{ breite: number; scroll: number }>(fn(UEBERLAUF));
    expect(m.breite).toBe(1280);
    expect(m.scroll).toBeLessThanOrEqual(m.breite);
    const reiter = await s.evaluate<string[]>(
      fn(
        `() => [...document.querySelectorAll('[data-einst="reiter"]')].map((b) => (b.textContent || '').trim())`,
      ),
    );
    expect(reiter[reiter.length - 1]).toBe(t("adm.sec.vorfuehrdaten"));
    expect(stand?.seitenfehler).toEqual([]);
  }, 60_000);
});
