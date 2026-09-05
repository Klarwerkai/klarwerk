// ================================================================================================
// JOB 3065 H6 · DAS TEXTMESSER: auf der Fläche „Einstellungen" steht kein Satz.
// ================================================================================================
//
// Pedi 04.09. 06:50 (Maßstab Apple Pages): „Knopf und Feld erklären sich selbst, Erklärtext im
// Verhältnis 1:100." Der Auftrag macht daraus eine messbare Zusage: der sichtbare Text der Fläche
// AUSSERHALB von Labels, Werten, Kickern, Reitern und Knöpfen ist höchstens 40 Zeichen lang.
//
// GEMESSEN WIRD `innerText`-artig am ECHTEN DOM in Chromium: jeder sichtbare Textknoten unter
// `[data-einst="seite"]`, dessen Vorfahren KEIN `data-einst` aus der erlaubten Menge tragen. Ein
// Absatz, ein Hinweis, eine Einleitung — alles davon zählt. Deshalb steht darunter die Kalibrierung
// K: ein eingefügter Satz MUSS das Messer ausschlagen lassen, sonst wäre die Zusage still grün.
//
// Dazu die Quelltextzählung: `HelpTip` kommt in den Einstellungs- und Profilseiten NULL mal vor.
// Die zwölf Aufrufe von gestern sind nicht gelöscht, sondern in das eine „?"-Menü je Detailkarte
// gewandert (`Detailkarte.tsx`) — was dort steht, prüft `tests/design/h6-funktionsinventar.test.ts`.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type Stand, WURZEL, beende, fn, starte, wechsle } from "./h6-chromium";

/** Die Träger, deren Text ausdrücklich erlaubt ist: Label, Wert, Kicker, Titel, Reiter, Knopf. */
const ERLAUBT = ["label", "wert", "kicker", "titel", "reiter", "flaechenknopf", "hilfe"];

/**
 * In der Seite: der sichtbare Text außerhalb der erlaubten Träger.
 * Unsichtbares (display:none, visibility:hidden, Nullfläche) zählt nicht — es steht ja nicht da.
 */
const TEXTMESSER = `([erlaubt]) => {
  const wurzel = document.querySelector('[data-einst="seite"]');
  if (!wurzel) return null;
  const gehe = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  const stuecke = [];
  for (let n = gehe.nextNode(); n !== null; n = gehe.nextNode()) {
    const text = (n.nodeValue || '').replace(/\\s+/g, ' ').trim();
    if (text === '') continue;
    let e = n.parentElement;
    let erlaubtesEltern = false;
    let sichtbar = true;
    while (e && e !== wurzel.parentElement) {
      const marke = e.getAttribute('data-einst');
      if (marke && erlaubt.includes(marke)) { erlaubtesEltern = true; break; }
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') { sichtbar = false; break; }
      e = e.parentElement;
    }
    if (!erlaubtesEltern && sichtbar) stuecke.push(text);
  }
  return stuecke;
}`;

/**
 * JOB 3065 R2 — BENs Korrekturpflicht 1: „Der Kein-Erklärtext-Test öffnet jede Detailkarte bei
 * geschlossenem Hilfemenü und prüft alle verlegten Schlüssel auf Abwesenheit; danach öffnet er das
 * Menü und verlangt sie dort."
 *
 * Die Liste der verlegten Texte wird NICHT abgeschrieben, sondern ABGELEITET: der Lauf öffnet je
 * Karte das „?"-Menü, liest die Absätze mit `data-einst="hilfetext"` und verlangt anschließend, dass
 * GENAU DIESE Sätze im Sichtfeld derselben Karte fehlen. Kommt morgen ein Hilfetext dazu, ist er
 * automatisch Gegenstand — ohne dass hier eine Zeile über ihn steht.
 *
 * Die Karten selbst werden ebenfalls abgeleitet: jede Zeile mit Chevron und der Flächenknopf führen
 * in eine; der Lauf klickt sie der Reihe nach durch.
 */
const KARTEN = `(async ([reiterLabel]) => {
  const warte = async (pruefung, ms = 4000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) { if (pruefung()) return true; await new Promise((r) => setTimeout(r, 40)); }
    return pruefung();
  };
  const sichtbarerText = (el) => {
    if (!el) return '';
    const gehe = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const stuecke = [];
    for (let n = gehe.nextNode(); n !== null; n = gehe.nextNode()) {
      const text = (n.nodeValue || '').replace(/\\s+/g, ' ').trim();
      if (text === '') continue;
      let e = n.parentElement, sichtbar = true;
      while (e && e !== el.parentElement) {
        const st = getComputedStyle(e);
        if (st.display === 'none' || st.visibility === 'hidden') { sichtbar = false; break; }
        e = e.parentElement;
      }
      if (sichtbar) stuecke.push(text);
    }
    return stuecke.join(' ');
  };
  if (reiterLabel) {
    const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => (b.textContent||'').trim() === reiterLabel);
    if (!r) return { fehler: 'Reiter fehlt: ' + reiterLabel, karten: [] };
    r.click();
    await warte(() => r.getAttribute('aria-pressed') === 'true');
  }
  // Die Öffner dieser Fläche: jede Zeile mit Chevron plus der Flächenknopf.
  const oeffnerZahl = () =>
    [...document.querySelectorAll('[data-einst="zeile"]')].filter((z) => z.querySelector('[data-einst="chevron"]')).length;
  const gesamt = oeffnerZahl() + document.querySelectorAll('[data-einst="flaechenknopf"]').length;
  const karten = [];
  for (let i = 0; i < gesamt; i++) {
    const zeilen = [...document.querySelectorAll('[data-einst="zeile"]')].filter((z) => z.querySelector('[data-einst="chevron"]'));
    const oeffner = i < zeilen.length ? zeilen[i] : document.querySelectorAll('[data-einst="flaechenknopf"]')[i - zeilen.length];
    if (!oeffner) { karten.push({ id: 'Öffner ' + i + ' fehlt', sichtbar: '', hilfe: [] }); continue; }
    const name = (oeffner.textContent || '').replace(/\\s+/g, ' ').trim();
    oeffner.click();
    const auf = await warte(() => document.querySelector('[data-einst="detail"]') !== null);
    if (!auf) { karten.push({ id: name + ' — Karte ging nicht auf', sichtbar: '', hilfe: [] }); continue; }
    const karte = document.querySelector('[data-einst="detail"]');
    // (1) Sichtfeld der Karte bei GESCHLOSSENEM Menü.
    const sichtbar = sichtbarerText(karte);
    const menueOffen = document.querySelector('[data-einst="hilfemenue"]') !== null;
    // (2) Das „?"-Menü öffnen und die verlegten Texte lesen.
    const hilfeKnopf = karte.querySelector('[data-einst="hilfe"]');
    let hilfe = [];
    if (hilfeKnopf) {
      hilfeKnopf.click();
      await warte(() => document.querySelector('[data-einst="hilfemenue"]') !== null);
      hilfe = [...document.querySelectorAll('[data-einst="hilfetext"]')].map((p) => (p.textContent||'').replace(/\\s+/g, ' ').trim());
      hilfeKnopf.click();
      await warte(() => document.querySelector('[data-einst="hilfemenue"]') === null);
    }
    karten.push({ id: name, sichtbar, hilfe, menueOffen });
    const zurueck = karte.querySelector('[data-einst="zurueck"]');
    if (zurueck) zurueck.click();
    await warte(() => document.querySelector('[data-einst="detail"]') === null);
  }
  return { fehler: null, karten };
})`;

const TABS = ["konten", "ki", "daten", "sicherheit"] as const;

/** Eine geöffnete Detailkarte: ihr Sichtfeld und die Texte in ihrem „?"-Menü. */
interface Karte {
  id: string;
  sichtbar: string;
  hilfe: string[];
  menueOffen?: boolean;
}

// EINE Chromium-Instanz für beide Flächen: /admin wird gemessen, danach führt dieselbe Seite auf
// /profil (siehe `wechsle` in h6-chromium.ts — mehr Instanzen kippen im Gesamttor fremde Messungen).
let adminStand: Stand | null = null;

describe("JOB 3065 H6 · kein Erklärtext im Sichtfeld — gemessen in Chromium", () => {
  beforeAll(async () => {
    adminStand = await starte("/admin", '[data-einst="seite"]');
    if (adminStand.fehler === null && adminStand.seite) {
      await adminStand.seite.waitForFunction(
        fn(`() => document.querySelectorAll('[data-einst="zeile"]').length > 0`),
        undefined,
        { timeout: 30_000 },
      );
    }
  }, 180_000);

  afterAll(async () => {
    if (adminStand) await beende(adminStand);
  }, 60_000);

  async function restText(stand: Stand | null, reiter?: string): Promise<string[]> {
    expect(stand?.fehler, "Seite nicht gemountet").toBeNull();
    const seite = stand?.seite;
    if (!seite) {
      throw new Error("keine Seite");
    }
    if (reiter !== undefined) {
      await seite.evaluate(
        fn(
          `(label) => { const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => (b.textContent||'').trim() === label); if (r) r.click(); }`,
        ),
        reiter,
      );
      await seite.waitForFunction(
        fn(
          `(label) => { const r = [...document.querySelectorAll('[data-einst="reiter"]')].find((b) => (b.textContent||'').trim() === label); return r && r.getAttribute('aria-pressed') === 'true'; }`,
        ),
        reiter,
        { timeout: 10_000 },
      );
    }
    const stuecke = await seite.evaluate<string[] | null>(fn(TEXTMESSER), [ERLAUBT]);
    expect(stuecke, "Fläche [data-einst=seite] nicht gefunden").not.toBeNull();
    return stuecke ?? [];
  }

  for (const tab of TABS) {
    it(`T-${tab} · der Reiter „${tab}" trägt außerhalb von Label, Wert, Kicker und Knopf höchstens 40 Zeichen`, async () => {
      const stuecke = await restText(adminStand, i18n.t(`adm.sec.${tab}`));
      const gesamt = stuecke.join(" ");
      console.info(
        `JOB 3065 H6 · Textmesser ${tab}: ${gesamt.length} Zeichen · ${JSON.stringify(stuecke)}`,
      );
      expect(
        gesamt.length,
        `Resttext im Reiter ${tab}: ${JSON.stringify(stuecke)}`,
      ).toBeLessThanOrEqual(40);
    }, 60_000);
  }

  /** Alle Detailkarten eines Reiters öffnen und je Karte Sichtfeld + „?"-Texte zurückgeben. */
  async function karten(stand: Stand | null, reiter: string): Promise<Karte[]> {
    expect(stand?.fehler, "Seite nicht gemountet").toBeNull();
    const ergebnis = await (stand?.seite as NonNullable<Stand["seite"]>).evaluate<{
      fehler: string | null;
      karten: Karte[];
    }>(fn(KARTEN), [reiter]);
    expect(ergebnis.fehler).toBeNull();
    return ergebnis.karten;
  }

  for (const tab of TABS) {
    it(`D-${tab} · jede Detailkarte des Reiters „${tab}" trägt bei geschlossenem „?“ KEINEN verlegten Hilfetext`, async () => {
      const gefunden = await karten(adminStand, i18n.t(`adm.sec.${tab}`));
      // Kalibrierung: der Reiter hat überhaupt Karten, und keine ist beim Öffnen steckengeblieben.
      expect(gefunden.length, `keine Detailkarte im Reiter ${tab}`).toBeGreaterThan(0);
      expect(
        gefunden.filter((k) => k.id.includes("ging nicht auf") || k.id.includes("fehlt")),
        "Karte ließ sich nicht öffnen",
      ).toEqual([]);
      const verlegt = gefunden.flatMap((k) => k.hilfe);
      const befunde: string[] = [];
      for (const karte of gefunden) {
        // Das Menü ist beim Messen wirklich zu (sonst wäre die Abwesenheit trivial falsch gemessen).
        expect(karte.menueOffen, `${karte.id}: „?“-Menü stand beim Messen offen`).toBe(false);
        for (const text of verlegt) {
          if (text.length > 20 && karte.sichtbar.includes(text)) {
            befunde.push(`${karte.id}: „${text.slice(0, 60)}…“ steht im Sichtfeld der Karte`);
          }
        }
      }
      console.info(
        `JOB 3065 H6 · Detailkarten ${tab}: ${gefunden.length} Karten, ${verlegt.length} verlegte Texte im „?“-Menü`,
      );
      expect(befunde, befunde.join(" · ")).toEqual([]);
    }, 90_000);
  }

  it("D-hilfe · die verlegten Texte stehen wörtlich im „?“-Menü — und es sind alle zwölf Hilfe-Körper", async () => {
    // Die zwölf `HelpTip`-Körper von gestern, aus dem Katalog gelesen (nicht abgeschrieben): jeder
    // muss in genau einem „?“-Menü stehen. Fehlt einer, ist ein Hilfetext beim Umbau verloren
    // gegangen — genau das, was Pedi am 04.09. ausgeschlossen wissen wollte.
    const koerper = [
      "adm.ai.help",
      "adm.ai.accessHelp",
      "adm.presets.help",
      "adm.val.help",
      "adm.upload.help",
      "adm.ext.help",
      "adm.dup.help",
      "adm.trash.help",
      "adm.factory.help",
      "adm.sich.auditHelp",
      "adm.sich.dataHelp",
      "adm.ready.help",
    ].map((k) => i18n.t(k));
    const alle: string[] = [];
    for (const tab of TABS) {
      for (const karte of await karten(adminStand, i18n.t(`adm.sec.${tab}`))) {
        alle.push(...karte.hilfe);
      }
    }
    const fehlend = koerper.filter((text) => !alle.some((h) => h.includes(text)));
    expect(fehlend, `Hilfetext nicht im „?“-Menü: ${fehlend.join(" | ")}`).toEqual([]);
    // Und die beiden Einleitungen, die der Auftrag ausdrücklich nennt.
    for (const key of ["adm.ready.intro", "adm.createHint"]) {
      expect(
        alle.some((h) => h.includes(i18n.t(key))),
        `${key} fehlt im „?“-Menü`,
      ).toBe(true);
    }
  }, 120_000);

  it("K · KALIBRIERUNG: ein eingefügter Satz lässt das Messer ausschlagen (und wird zurückgenommen)", async () => {
    expect(adminStand?.fehler).toBeNull();
    const seite = adminStand?.seite;
    if (!seite) {
      throw new Error("keine Seite");
    }
    const vorher = (await restText(adminStand, i18n.t("adm.sec.konten"))).join(" ").length;
    await seite.evaluate(
      fn(
        `() => { const p = document.createElement('p'); p.id = 'h6-kalibrierung'; p.textContent = 'Dieser Satz erklaert etwas, was die Flaeche selbst sagen muesste.'; document.querySelector('[data-einst="seite"]').appendChild(p); }`,
      ),
    );
    const mitSatz = (await restText(adminStand)).join(" ");
    expect(mitSatz.length).toBeGreaterThan(40);
    expect(mitSatz).toContain("Dieser Satz erklaert etwas");
    await seite.evaluate(fn(`() => document.getElementById('h6-kalibrierung').remove()`));
    const nachher = (await restText(adminStand)).join(" ").length;
    expect(nachher).toBe(vorher);
  }, 60_000);

  // Nach der Kalibrierung — dieselbe Chromium-Instanz führt jetzt auf die zweite Fläche.
  it("T-profil · auch /profil trägt außerhalb von Label und Wert höchstens 40 Zeichen", async () => {
    expect(adminStand?.fehler).toBeNull();
    await wechsle(adminStand as Stand, "/profil", '[data-einst="seite"]');
    // Auch die Karten des Profils: kein verlegter Text im Sichtfeld (dort gibt es keine „?“-Menüs,
    // also darf auch nichts fehlen — die Messung hält fest, dass die Karten sich öffnen lassen).
    const profilKarten = await karten(adminStand, "");
    expect(profilKarten.length, "keine Detailkarte auf /profil").toBeGreaterThan(0);
    expect(
      profilKarten.filter((k) => k.id.includes("ging nicht auf") || k.id.includes("fehlt")),
      "Karte ließ sich nicht öffnen",
    ).toEqual([]);
    const stuecke = await restText(adminStand);
    const gesamt = stuecke.join(" ");
    console.info(
      `JOB 3065 H6 · Textmesser profil: ${gesamt.length} Zeichen · ${JSON.stringify(stuecke)}`,
    );
    expect(gesamt.length, `Resttext auf /profil: ${JSON.stringify(stuecke)}`).toBeLessThanOrEqual(
      40,
    );
  }, 60_000);

  it("Q · `HelpTip` kommt in den Einstellungs- und Profilseiten NULL mal vor", () => {
    const seiten = join(WURZEL, "apps/web/src/pages");
    const dateien = readdirSync(seiten).filter(
      (d) => (d.startsWith("Admin") || d.startsWith("Profile")) && d.endsWith(".tsx"),
    );
    // Kalibrierung: die Dateien gibt es überhaupt (sonst zählte der Fall eine leere Menge).
    expect(dateien.length).toBeGreaterThanOrEqual(6);
    const treffer: string[] = [];
    for (const d of dateien) {
      const quelle = readFileSync(join(seiten, d), "utf8");
      const anzahl = (quelle.match(/HelpTip/g) ?? []).length;
      if (anzahl > 0) {
        treffer.push(`${d}: ${anzahl}`);
      }
    }
    expect(treffer, `HelpTip lebt noch: ${treffer.join(", ")}`).toEqual([]);
    // Und die Komponente selbst ist NICHT gelöscht — sie trägt die Hilfe anderer Flächen weiter.
    expect(existsSync(join(WURZEL, "apps/web/src/components/HelpTip.tsx"))).toBe(true);
  });
});
