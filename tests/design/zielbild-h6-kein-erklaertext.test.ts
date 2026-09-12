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
// Dazu der Quelltextfall Q. Er hat am 04.09. gezählt, dass `HelpTip` in den Einstellungs- und
// Profilseiten NULL mal vorkommt — damals zeichnete der Baustein noch eine Sprechblase, und seine
// Abwesenheit war gleichbedeutend mit „hier steht kein Erklärtext". JOB 3060 hat ihn am selben Tag
// ausgehöhlt: er rendert seither `null`. Seit JOB 3670 pinnt Q deshalb die VORAUSSETZUNG statt des
// Stellvertreters — `HelpTip` zeichnet nichts —, und die Wirkung messen weiter D und T in Chromium.
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

// JOB 3337: aus vier Behältern sind die sieben Themen der Vorlage geworden. Der Textmesser läuft
// über ALLE sieben — auf keinem darf ein Satz stehen.
const TABS = [
  "konten",
  "ki",
  "quellen",
  "vorfuehrdaten",
  "sicherheit",
  "berichte",
  "system",
] as const;

// „Berichte und Analyse" trägt AUSSCHLIESSLICH Kurzlinks auf vorhandene Bereiche (Analytics,
// Auswertungen, Wissensgraph, Kapital-Sichten) — dort gibt es keine Detailkarte, die einen
// verlegten Hilfetext tragen könnte. Das ist kein Verlust, sondern die Regel „ein Ziel, ein
// maßgeblicher Bedienort": eine zweite Kartenwand für dieselben Bereiche wäre die Doppelung, die
// die Vorlage ausdrücklich ausschließt. Die Kartenfälle laufen deshalb über die sechs Themen MIT
// Karten; dass „berichte" wirklich nur Kurzlinks führt, belegt K-berichte weiter unten.
const TABS_MIT_KARTEN = TABS.filter((tab) => tab !== "berichte");

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

  for (const tab of TABS_MIT_KARTEN) {
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
    for (const tab of TABS_MIT_KARTEN) {
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

  it("K-berichte · KALIBRIERUNG: „Berichte und Analyse“ führt wirklich nur Kurzlinks", async () => {
    // Der Ausschluss aus TABS_MIT_KARTEN ist damit gemessen und nicht behauptet: null Zeilen mit
    // Chevron (= null Detailkarten), aber mindestens ein Kurzlink. Bekäme dieses Thema morgen eine
    // eigene Karte, wäre dieser Fall rot — und der Ausschluss oben gehörte zurückgenommen.
    expect(adminStand?.fehler).toBeNull();
    await restText(adminStand, i18n.t("adm.sec.berichte"));
    const zahlen = await (adminStand?.seite as NonNullable<Stand["seite"]>).evaluate<{
      chevrons: number;
      kurzlinks: number;
    }>(
      fn(`() => ({
        chevrons: [...document.querySelectorAll('[data-einst="zeile"]')].filter((z) => z.querySelector('[data-einst="chevron"]')).length,
        kurzlinks: document.querySelectorAll('[data-einst="kurzlink"]').length,
      })`),
    );
    expect(zahlen.chevrons, "„Berichte und Analyse“ hat eine Detailkarte bekommen").toBe(0);
    expect(zahlen.kurzlinks, "„Berichte und Analyse“ hat gar keinen Weg").toBeGreaterThan(0);
  }, 60_000);

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

  // ================================================================================================
  // JOB 3670 — NACHFÜHRUNG VON FALL Q: DIE VORAUSSETZUNG WAR WEGGEFALLEN, DIE ZUSAGE NICHT.
  // ================================================================================================
  //
  // WAS HIER STAND: „`HelpTip` kommt in den Einstellungs- und Profilseiten NULL mal vor." Das war am
  // 04.09. die richtige Zusage, denn damals ZEICHNETE `HelpTip` etwas: einen „?"-Knopf neben dem
  // Feld, der ein Popover mit Titel, Text und Link öffnete. Ihn aus diesen Seiten zu verbannen war
  // gleichbedeutend mit „hier steht kein Erklärtext im Sichtfeld".
  //
  // WAS SICH AM SELBEN TAG GEÄNDERT HAT: JOB 3060 hat `HelpTip` ausgehöhlt. Er rendert seither
  // NICHTS (`apps/web/src/components/HelpTip.tsx`: Rückgabetyp `null`, keine einzige JSX-Marke im
  // ganzen Baustein); er meldet Titel und Text nur noch beim Sammler an, und gelesen werden sie im
  // Zahnrad unter „Seitenhilfe". Damit misst die alte Zeile seit dem 04.09. nicht mehr, was sie zu
  // messen glaubt: ein Vorkommen von `HelpTip` ist kein Erklärtext im Sichtfeld mehr.
  //
  // WARUM DAS KEINE ABSCHWÄCHUNG IST — und das ist der Punkt, an dem dieser Fall nachgeführt und
  // nicht gestrichen wird: Die Zusage „kein Erklärtext im Sichtfeld" hängt gar nicht an dieser
  // Zeile. Sie hängt am TEXTMESSER (Fälle T und D oben), und der misst den ECHTEN sichtbaren DOM in
  // Chromium — er ist von dieser Änderung unberührt und bleibt grün. Was hier stand, war ein
  // Quelltext-STELLVERTRETER für eine Bauart, die es nicht mehr gibt.
  //
  // WAS JETZT HIER STEHT, ist die VORAUSSETZUNG dieses Stellvertreters, ausdrücklich gemacht:
  // `HelpTip` darf nichts zeichnen. Das fängt die echte Rückkehr des alten Zustands — jemand baut
  // dem Baustein wieder eine Sprechblase ein — an ihrer Wurzel, und zwar für ALLE Flächen auf
  // einmal statt nur für sechs Dateien. Die Fälle D und T darunter messen weiterhin die Wirkung.
  it("Q · `HelpTip` zeichnet nichts — die Voraussetzung, auf der Fall D und T ruhen", () => {
    const pfad = join(WURZEL, "apps/web/src/components/HelpTip.tsx");
    // Die Komponente ist NICHT gelöscht — sie trägt die Seitenhilfe aller Flächen.
    expect(existsSync(pfad), "HelpTip.tsx fehlt ganz").toBe(true);
    const quelle = readFileSync(pfad, "utf8");
    // Kalibrierung: es wurde wirklich etwas gelesen (eine leere Datei wäre trivial grün).
    expect(quelle.length, "HelpTip.tsx ist leer — der Fall hat nichts gemessen").toBeGreaterThan(
      200,
    );
    // 1. Der Rückgabetyp ist `null`. Ein `JSX.Element` hier wäre die Rückkehr der Sprechblase.
    expect(
      /export function HelpTip\([\s\S]*?\):\s*null\s*\{/.test(quelle),
      "HelpTip gibt nicht mehr `null` zurück — zeichnet er wieder etwas, steht Erklärtext im Sichtfeld",
    ).toBe(true);
    // 2. Und im ganzen Baustein steht keine einzige JSX-Marke. Der Typ allein genügte nicht:
    //    ein Nebenzweig könnte trotzdem etwas in ein Portal zeichnen.
    for (const marke of ["/>", "</"]) {
      expect(
        quelle.includes(marke),
        `HelpTip enthält die JSX-Marke „${marke}" — er zeichnet wieder`,
      ).toBe(false);
    }
    // 3. Er meldet weiter beim EINEN Sammler an; eine zweite Hilfemechanik entsteht nicht.
    expect(
      quelle.includes("useSeitenhilfeAnmeldung"),
      "HelpTip meldet sich nicht mehr bei der Seitenhilfe an — die Texte wären dann nirgends lesbar",
    ).toBe(true);

    // 4. Die Einstellungs- und Profilseiten gibt es weiterhin, und sie holen ihre Hilfe
    //    ausschliesslich über die zwei erlaubten Wege: den `hilfe`-Prop der `Detailkarte`
    //    (das „?"-Menü der Karte) und diesen stummen `HelpTip`. Ein dritter Weg — eine eigene
    //    Sprechblase, ein eigenes Popover — wäre wieder Erklärtext im Sichtfeld.
    const seiten = join(WURZEL, "apps/web/src/pages");
    const dateien = readdirSync(seiten).filter(
      (d) => (d.startsWith("Admin") || d.startsWith("Profile")) && d.endsWith(".tsx"),
    );
    expect(
      dateien.length,
      "die Einstellungs-/Profilseiten sind verschwunden",
    ).toBeGreaterThanOrEqual(6);
    const fremdeHilfe: string[] = [];
    for (const d of dateien) {
      const seite = readFileSync(join(seiten, d), "utf8");
      // `HilfeMenue` ist der SICHTBARE Teil der Detailkarte. Wer ihn selbst montiert, stellt eine
      // zweite Sprechblase neben die der Karte.
      if (/<HilfeMenue\b/.test(seite)) {
        fremdeHilfe.push(`${d}: eigenes <HilfeMenue>`);
      }
    }
    expect(fremdeHilfe, `zweite Hilfemechanik: ${fremdeHilfe.join(", ")}`).toEqual([]);
  });
});
