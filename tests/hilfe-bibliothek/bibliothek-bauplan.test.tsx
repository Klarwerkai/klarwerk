// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0890 — JEDE FUNKTION HAT IHREN ARTIKEL NACH FESTEM BAUPLAN.
// ================================================================================================
//
// DER ORIGINALWORTLAUT: „Eine gegliederte Bibliothek erklärt jede Funktion nach festem Bauplan: was
// es ist, wie es funktioniert, warum es so gebaut ist, was danach passiert und welche typischen
// Missverständnisse es gibt."
//
// BENS BEFUND (Nacharbeit 3): „Die Bibliotheksartikel nach dem Fünf-Teil-Bauplan … fehlen
// weiterhin." Geliefert sind sie in `lib/hilfeBibliothek.ts`; dieser Fall hält fest:
//   B1 · jede Funktion (= jedes Hilfekapitel, `HELP_TOPICS`) hat einen Artikel mit allen fünf
//        Teilen in DE, EN und NL — übersetzt, nicht deutsch zurückgefallen;
//   B2 · es gibt keinen Artikel ohne Funktion;
//   B3 · die Artikel sprechen Anwendersprache (dieselbe Wortwahl wie die FAQ der Hilfeseite);
//   B4 · die ECHTE Hilfeseite zeigt den Artikel zugeklappt unter jeder Kapitelkarte, die fünf Teile
//        in der Reihenfolge des Bauplans und mit ihren Überschriften.
//
// GEGENPROBEN: einen Teil eines Artikels leeren → B1 rot; einen Artikel entfernen → B1/B4 rot;
// „Admins" in einen Teil schreiben → B3 rot; den Aufklapper aus `Help.tsx` nehmen → B4 rot.
//
// BENS BEFUNDE (Nacharbeit 5), je mit eigenem Fall:
//   G1–G4 · „R-0890 wurde … auf 22 vorhandene Bereichskapitel verkürzt … Diktieren wird nur
//        beiläufig erwähnt; geführtes Interview und Wissensarten fehlen." Die Erwartung kommt jetzt
//        aus dem QUELLDOKUMENT selbst (Lieferung 1, Abschnitt B): jeder Punkt B0-1 … B10-4 ist einem
//        Artikel zugeordnet, und das Stichwort der Zuordnung steht im Artikel — in allen drei
//        Sprachen. Punkte ohne Artikel tragen ihren Grund.
//   S1–S3 · „Die neuen Bibliotheksartikel fehlen im Suchraum … „Leimzeit" …" — die Hilfesuche
//        findet Wörter, die nur im Artikel stehen, und zeigt den Artikel offen.
//   GEGENPROBEN: eine Zuordnung streichen → G1 rot; das Stichwort aus dem Artikel nehmen → G2 rot;
//   „Diktieren" wieder dem Bereichsartikel zuordnen → G3 rot; `suchtext` aus `filterHelpTopics`
//   nehmen → S1/S2 rot.
//
// BENS BEFUNDE (Nacharbeit 7):
//   G2/G5/G6 · B5-6 „Eine Antwort weitergeben“ hat seinen Artikel; eine Auslassung gilt nur, wenn
//        ihre Art am Bestand nachgemessen stimmt (Rollenvertrag, Routen, Teil jedes Artikels).
//   S6/S7 · jeder Funktionsartikel führt rollengeprüft in seinen Bereich.
//   K1–K3 · die KI-Grundlage nimmt Bibliotheksauszüge, ohne eine FAQ-Antwort zu verdrängen.
//   GEGENPROBEN: B5-6 wieder ohne Artikel → G5/G6 rot; den Bereichslink aus `Help.tsx` nehmen →
//   S6/S7 rot; in `klaraGrundlage` FAQ verdrängbar machen → K2 rot.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { GUARDED_ITEMS, routePathAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { FAQ_CONTENT } from "../../apps/web/src/lib/faqContent";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import { ISO_HELP_TOPICS } from "../../apps/web/src/lib/helpTopics.iso";
import {
  type Auslassung,
  BIBLIOTHEK_GRUPPEN,
  BIBLIOTHEK_TEILE,
  FUNKTIONS_ARTIKEL,
  GLIEDERUNG,
  HILFE_BIBLIOTHEK,
  artikelText,
} from "../../apps/web/src/lib/hilfeBibliothek";
import { allBibliothekEntries, bibliothekAuszuege } from "../../apps/web/src/lib/klaraBibliothek";
import {
  BIBLIOTHEK_PLAETZE,
  allFaqEntries,
  allKlaraEntries,
  klaraGrundlage,
  rankKlara,
  resolveKlaraEntries,
  searchKlara,
} from "../../apps/web/src/lib/klaraRegistry";
import { Help } from "../../apps/web/src/pages/Help";
import { ROLE_PERMISSIONS } from "../../services/rbac/src/policy";
import { SPRACHEN, funde } from "../hilfe-faq-sammlung/wortwahl";
import { repoPfad } from "../support/repoPfad";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// S6 (Nacharbeit 7) wechselt die Rolle; alle anderen Fälle lesen als Controller.
const rollenquelle = vi.hoisted(() => ({ rolle: "controller" as string }));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({
    role: rollenquelle.rolle,
    setRole: () => {},
    stufe2: false,
    setStufe2: () => {},
    isSessionRole: true,
    canPreview: false,
    previewActive: false,
  }),
}));

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(async () => {
  const wurzel = root;
  if (wurzel) {
    await act(async () => {
      wurzel.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  rollenquelle.rolle = "controller";
  await i18n.changeLanguage("de");
});

async function hilfeMounten(sprache: string): Promise<HTMLElement> {
  await i18n.changeLanguage(sprache);
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  await act(async () => {
    wurzel.render(createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help)));
  });
  return flaeche;
}

describe("R-0890 · die Anwender-Wissensbibliothek nach festem Bauplan", () => {
  it("B1 · jede Funktion hat einen Artikel mit allen fünf Teilen in DE, EN und NL", () => {
    expect(BIBLIOTHEK_TEILE).toEqual(["was", "wie", "warum", "danach", "missverstaendnisse"]);
    const fehlt: string[] = [];
    for (const kapitel of HELP_TOPICS) {
      const artikel = HILFE_BIBLIOTHEK[kapitel.id];
      if (!artikel) {
        fehlt.push(`${kapitel.id}: kein Artikel`);
        continue;
      }
      for (const teil of BIBLIOTHEK_TEILE) {
        const text = artikel[teil];
        for (const sprache of SPRACHEN) {
          if ((text?.[sprache] ?? "").trim().length < 20) {
            fehlt.push(`${kapitel.id} · ${teil} · ${sprache}: leer oder zu kurz`);
          }
        }
        if (text && (text.en === text.de || text.nl === text.de)) {
          fehlt.push(`${kapitel.id} · ${teil}: nicht übersetzt`);
        }
      }
    }
    expect(fehlt).toEqual([]);
  });

  it("B2 · kein Artikel ohne Funktion", () => {
    const kapitel = new Set(HELP_TOPICS.map((eintrag) => eintrag.id));
    expect(Object.keys(HILFE_BIBLIOTHEK).filter((id) => !kapitel.has(id))).toEqual([]);
  });

  it("B3 · die Artikel sprechen Anwendersprache — ohne Rollen-, Prüf- oder Pilotbegriffe", () => {
    const gefunden: string[] = [];
    for (const [id, artikel] of Object.entries(HILFE_BIBLIOTHEK)) {
      for (const teil of BIBLIOTHEK_TEILE) {
        for (const sprache of SPRACHEN) {
          for (const fund of funde(artikel[teil][sprache], sprache, false)) {
            gefunden.push(`${id} · ${teil} · ${sprache}: ${fund}`);
          }
        }
      }
    }
    expect(gefunden).toEqual([]);
  });

  it.each(SPRACHEN)("B4 · %s: Artikel zugeklappt unter jeder Karte", async (sprache) => {
    const flaeche = await hilfeMounten(sprache);
    const aufklapper = i18n.t("hilfebibliothek.oeffnen");
    for (const kapitel of HELP_TOPICS) {
      const karte = flaeche.querySelector(`[data-hilfe-thema="${kapitel.id}"]`);
      expect(karte, `${kapitel.id}: Kapitelkarte fehlt`).not.toBeNull();
      const auswahl = `details[data-hilfe-artikel="${kapitel.id}"]`;
      const artikel = karte?.querySelector<HTMLDetailsElement>(auswahl);
      expect(artikel, `${kapitel.id}: Artikel fehlt auf der Karte`).not.toBeNull();
      expect(artikel?.open, `${kapitel.id}: Artikel steht offen`).toBe(false);
      expect(artikel?.querySelector("summary")?.textContent).toBe(aufklapper);
      const knoten = artikel?.querySelectorAll<HTMLElement>("dd[data-hilfe-artikel-teil]");
      const teile = [...(knoten ?? [])];
      expect(teile.map((dd) => dd.dataset.hilfeArtikelTeil)).toEqual([...BIBLIOTHEK_TEILE]);
      const quelle = HILFE_BIBLIOTHEK[kapitel.id];
      for (const dd of teile) {
        const teil = dd.dataset.hilfeArtikelTeil as (typeof BIBLIOTHEK_TEILE)[number];
        const ueberschrift = i18n.t(`hilfebibliothek.teil.${teil}`);
        expect(dd.textContent, `${kapitel.id} · ${teil}`).toBe(quelle?.[teil][sprache]);
        expect(dd.previousElementSibling?.textContent).toBe(ueberschrift);
      }
    }
    // Die ISO-Kapitel sind keine Funktion der Anwendung und tragen keinen Artikel.
    for (const iso of ISO_HELP_TOPICS) {
      const karte = flaeche.querySelector(`[data-hilfe-thema="${iso.id}"]`);
      expect(karte?.querySelector("details[data-hilfe-artikel]") ?? null).toBeNull();
    }
  });
});

/**
 * Die Pfade aller Routen der Anwendung. Nacharbeit 9 (Prüflauf e58ab422, „die Routen wurden nicht
 * gelesen"): `routes.tsx` schreibt nur die Sonderrouten als `path="…"` aus; die Bereiche routet es
 * über `GUARDED_ITEMS.map(…)` mit `path={item.path}`. Gelesen werden deshalb BEIDE Quellen.
 */
function routenpfade(): string[] {
  const routen = readFileSync(repoPfad("apps/web/src/routes.tsx"), "utf8");
  const feste = [...routen.matchAll(/path="([^"]*)"/g)].map((treffer) => treffer[1] ?? "");
  return [...GUARDED_ITEMS.map((item) => item.path), ...feste];
}

/** Hält die Art einer Auslassung am Bestand nach — `null`, wenn sie stimmt, sonst der Befund. */
function auslassungBefund(auslassung: Auslassung): string | null {
  switch (auslassung.art) {
    case "ohne-recht": {
      // Der Rollenvertrag sagt, ob die Rolle das Recht hat — dann gäbe es die Funktion doch.
      const rechte = (ROLE_PERMISSIONS as Record<string, readonly string[]>)[auslassung.rolle];
      if (rechte === undefined) return `die Rolle „${auslassung.rolle}“ gibt es nicht`;
      return rechte.includes(auslassung.recht)
        ? `die Rolle „${auslassung.rolle}“ hat „${auslassung.recht}“ — die Funktion besteht`
        : null;
    }
    case "jeder-artikel": {
      const artikel = [
        ...Object.values(HILFE_BIBLIOTHEK).map((a) => a[auslassung.teil]),
        ...FUNKTIONS_ARTIKEL.map((a) => a.teile[auslassung.teil]),
      ];
      const leer = artikel.filter((text) => SPRACHEN.some((s) => text[s].trim().length < 20));
      return leer.length > 0 ? `${leer.length} Artikel ohne Teil „${auslassung.teil}“` : null;
    }
    case "keine-flaeche": {
      const pfade = routenpfade();
      if (pfade.length < 20) return "die Routen wurden nicht gelesen";
      const passt = (pfad: string): boolean =>
        auslassung.routenwoerter.some((wort) => pfad.toLowerCase().includes(wort));
      const treffer = pfade.filter(passt);
      return treffer.length > 0 ? `es gibt die Fläche doch: ${treffer.join(", ")}` : null;
    }
  }
}

/** Die Punkte B0-1 … B10-4 aus Abschnitt B des Quelldokuments — gelesen, nicht abgeschrieben. */
function quellpunkte(): string[] {
  const quelle = readFileSync(
    repoPfad("docs/qm/HILFE_LIEFERUNG-1_GLIEDERUNG-UND-FAQ_2026-07-04.md"),
    "utf8",
  );
  const abschnitt = quelle.slice(
    quelle.indexOf("## B · Gliederung der Wissensbibliothek"),
    quelle.indexOf("## C · FAQ-Fragenkatalog"),
  );
  return [...abschnitt.matchAll(/^- \*\*(B\d+-\d+) ·/gm)].map((treffer) => treffer[1] ?? "");
}

describe("R-0890 · Nacharbeit 5 — jede Funktion der Quellengliederung ist erklärt", () => {
  it("G1 · jeder Punkt der Quellengliederung ist genau einmal zugeordnet", () => {
    const quelle = quellpunkte();
    expect(quelle.length, "die Quellengliederung wurde nicht gelesen").toBeGreaterThan(60);
    const zugeordnet = GLIEDERUNG.map((punkt) => punkt.id);
    expect(new Set(zugeordnet).size, "ein Punkt ist doppelt zugeordnet").toBe(zugeordnet.length);
    expect([...zugeordnet].sort()).toEqual([...quelle].sort());
  });

  it("G2 · der zugeordnete Artikel erklärt die Funktion: das Stichwort steht darin, je Sprache", () => {
    const fehlt: string[] = [];
    for (const punkt of GLIEDERUNG) {
      if (punkt.artikel === null) {
        // Nacharbeit 7 (Ben): eine Auslassung gilt nicht wegen ihres Begründungstexts, sondern nur,
        // wenn ihre Art am Bestand nachgemessen stimmt (G5).
        const befund = auslassungBefund(punkt.auslassung);
        if (befund !== null) fehlt.push(`${punkt.id}: ohne Artikel, aber ${befund}`);
        continue;
      }
      for (const sprache of SPRACHEN) {
        const text = artikelText(punkt.artikel, sprache);
        if (text === null) {
          fehlt.push(`${punkt.id}: Artikel „${punkt.artikel}“ gibt es nicht`);
          continue;
        }
        const stichwort = punkt.stichwort[sprache];
        if (!text.toLowerCase().includes(stichwort.toLowerCase())) {
          fehlt.push(`${punkt.id} · ${sprache}: „${stichwort}“ steht nicht in „${punkt.artikel}“`);
        }
      }
    }
    expect(fehlt).toEqual([]);
  });

  it("G3 · Diktieren, Interview und Wissensarten haben je einen EIGENEN Funktionsartikel", () => {
    const zuordnung = new Map(GLIEDERUNG.map((punkt) => [punkt.id, punkt.artikel]));
    expect(zuordnung.get("B1-3")).toBe("diktieren");
    expect(zuordnung.get("B1-4")).toBe("interview");
    expect(zuordnung.get("B1-8")).toBe("wissensarten");
    const eigene = FUNKTIONS_ARTIKEL.map((artikel) => artikel.id);
    for (const id of ["diktieren", "interview", "wissensarten"]) {
      expect(eigene, `${id} ist kein eigener Funktionsartikel`).toContain(id);
    }
  });

  it("G4 · jeder Funktionsartikel hat Titel und fünf Teile in drei Sprachen, in Anwendersprache", () => {
    const befunde: string[] = [];
    const ids = FUNKTIONS_ARTIKEL.map((artikel) => artikel.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const artikel of FUNKTIONS_ARTIKEL) {
      const rollenErlaubt = artikel.rollenausnahme === true;
      for (const sprache of SPRACHEN) {
        befunde.push(...funde(artikel.titel[sprache], sprache, rollenErlaubt));
        for (const teil of BIBLIOTHEK_TEILE) {
          const text = artikel.teile[teil][sprache];
          if (text.trim().length < 20) befunde.push(`${artikel.id} · ${teil} · ${sprache}: leer`);
          for (const fund of funde(text, sprache, rollenErlaubt)) {
            befunde.push(`${artikel.id} · ${teil} · ${sprache}: ${fund}`);
          }
        }
      }
      for (const teil of BIBLIOTHEK_TEILE) {
        const text = artikel.teile[teil];
        if (text.en === text.de || text.nl === text.de) {
          befunde.push(`${artikel.id} · ${teil}: nicht übersetzt`);
        }
      }
    }
    expect(befunde).toEqual([]);
  });
});

/** Je Sprache ein Wort, das nur im Funktionsartikel „Diktieren“ steht. */
const SUCHWOERTER = [
  ["de", "Spracherkennung"],
  ["en", "speech recognition"],
  ["nl", "spraakherkenning"],
] as const;

async function suche(flaeche: HTMLElement, text: string): Promise<void> {
  const feld = flaeche.querySelector<HTMLInputElement>('[data-testid="hilfe-suche"]');
  if (!feld) throw new Error("Das Suchfeld der Hilfeseite fehlt.");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("R-0935 / R-1671 · Nacharbeit 5 — die Artikel sind auffindbar", () => {
  it("S1 · „Leimzeit“ steht nur im Artikel — die Hilfesuche findet das Kapitel und öffnet ihn", async () => {
    const flaeche = await hilfeMounten("de");
    await suche(flaeche, "Leimzeit");
    const karte = flaeche.querySelector('[data-hilfe-thema="capture"]');
    expect(karte, "die Suche findet das Kapitel über seinen Artikel nicht").not.toBeNull();
    const auswahl = 'details[data-hilfe-artikel="capture"]';
    const artikel = karte?.querySelector<HTMLDetailsElement>(auswahl);
    expect(artikel?.open, "der treffende Artikel bleibt zugeklappt").toBe(true);
    expect(flaeche.querySelector('[data-testid="hilfe-nulltreffer"]')).toBeNull();
  });

  it.each(SUCHWOERTER)("S2 · %s: Wort aus einem Funktionsartikel", async (sprache, wort) => {
    const flaeche = await hilfeMounten(sprache);
    await suche(flaeche, wort);
    const abschnitt = flaeche.querySelector('[data-testid="hilfe-funktionen"]');
    expect(abschnitt, "der Abschnitt der Funktionsartikel fehlt").not.toBeNull();
    const auswahl = 'details[data-hilfe-artikel="diktieren"]';
    const artikel = abschnitt?.querySelector<HTMLDetailsElement>(auswahl);
    expect(artikel, "der Artikel Diktieren ist nicht unter den Treffern").not.toBeNull();
    expect(artikel?.open).toBe(true);
  });

  it("S3 · Klaras Suche findet Bereichs- und Funktionsartikel in der Sprache der Oberfläche", () => {
    const t = i18n.getFixedT("de");
    const de = allBibliothekEntries("de", (key) => t(key));
    expect(de).toHaveLength(Object.keys(HILFE_BIBLIOTHEK).length + FUNKTIONS_ARTIKEL.length);
    expect(searchKlara(de, "Leimzeit").map((eintrag) => eintrag.id)).toContain("artikel:capture");
    const en = allBibliothekEntries("en", (key) => i18n.getFixedT("en")(key));
    expect(searchKlara(en, "speech recognition").map((e) => e.id)).toContain("artikel:diktieren");
  });

  it("S5 · Nacharbeit 6: die Registry im ersten Brocken bindet die Artikel nicht statisch ein", () => {
    // Klaras Registry steht in der Hülle jeder Seite. Die Artikel dort statisch einzubinden hob den
    // Eintritt über den Deckel aus R-0801 (gemessen 1403861 B gegen 1360000 B). Die Wirkung misst
    // `tests/erstladezeit/eintritt-ohne-seiten.test.ts` am Bau; hier steht die Ursache fest.
    const registry = readFileSync(repoPfad("apps/web/src/lib/klaraRegistry.ts"), "utf8");
    expect(registry).not.toMatch(/from "\.\/(hilfeBibliothek|klaraBibliothek)"/);
  });

  it("S4 · ohne Suche stehen alle Funktionsartikel zugeklappt da, nach Teilen gegliedert", async () => {
    const flaeche = await hilfeMounten("de");
    const auswahl = '[data-testid="hilfe-funktionen"] details[data-hilfe-artikel]';
    const alle = [...flaeche.querySelectorAll<HTMLDetailsElement>(auswahl)];
    const reihenfolge: string[] = [];
    for (const gruppe of BIBLIOTHEK_GRUPPEN) {
      for (const artikel of FUNKTIONS_ARTIKEL) {
        if (artikel.gruppe === gruppe) reihenfolge.push(artikel.id);
      }
    }
    expect(alle.map((d) => d.dataset.hilfeArtikel)).toEqual(reihenfolge);
    expect(alle.every((d) => !d.open)).toBe(true);
  });

  it.each(["controller", "viewer"] as const)(
    "S6 · %s: jeder Funktionsartikel führt in seinen Bereich, so weit die Rolle reicht",
    async (rolle) => {
      // Ben (Nacharbeit 7): „Die neuen Funktionsartikel zeigen keinen direkten Sprung in ihren
      // Anwendungsbereich." Erwartet wird dieselbe Regel wie bei der FAQ: Router lässt die Rolle
      // hinein, und nie auf `/hilfe` selbst. GEGENPROBE: den Link aus `Help.tsx` nehmen → rot;
      // die Rollenprüfung weglassen → für den Betrachter rot.
      rollenquelle.rolle = rolle;
      const flaeche = await hilfeMounten("de");
      const erwartet: string[] = [];
      const gefunden: string[] = [];
      for (const artikel of FUNKTIONS_ARTIKEL) {
        if (artikel.route !== "/hilfe" && routePathAllows(artikel.route, rolle)) {
          erwartet.push(artikel.id);
        }
        const link = flaeche.querySelector(`[data-testid="hilfe-funktion-route-${artikel.id}"]`);
        if (link?.getAttribute("href") === artikel.route) gefunden.push(artikel.id);
      }
      expect(gefunden).toEqual(erwartet);
      expect(erwartet.length, "kein Artikel führt in einen Bereich").toBeGreaterThan(0);
      if (rolle === "viewer") {
        expect(erwartet.length, "die Rolle schränkt nichts ein").toBeLessThan(
          FUNKTIONS_ARTIKEL.length,
        );
      }
    },
  );

  it("S7 · „Spracherkennung“ trifft nur den Artikel — und der offene Artikel führt hin", async () => {
    const flaeche = await hilfeMounten("de");
    await suche(flaeche, "Spracherkennung");
    const diktieren = FUNKTIONS_ARTIKEL.find((artikel) => artikel.id === "diktieren");
    const auswahl = 'details[data-hilfe-artikel="diktieren"]';
    const offen = flaeche.querySelector<HTMLDetailsElement>(auswahl);
    expect(offen?.open).toBe(true);
    const link = offen?.querySelector('[data-testid="hilfe-funktion-route-diktieren"]');
    expect(link?.getAttribute("href")).toBe(diktieren?.route);
  });
});

describe("R-0890 · Nacharbeit 7 — „Eine Antwort weitergeben“ und nachgemessene Auslassungen", () => {
  it("G5 · B5-6 hat seinen Artikel, und er nennt die echten Beschriftungen des Weitergabewegs", () => {
    // Ben: „Ask.tsx:1280–1364 implementiert Markdown-Erzeugung, Kopieren und Download; :1993–2004
    // verbindet den Download mit dem Antwortmenü." Der Artikel muss genau diese Bedienelemente bei
    // ihrem angezeigten Namen nennen — in jeder Sprache.
    const zuordnung = new Map(GLIEDERUNG.map((punkt) => [punkt.id, punkt.artikel]));
    expect(zuordnung.get("B5-6")).toBe("antwort-weitergeben");
    const fragen = readFileSync(repoPfad("apps/web/src/pages/Ask.tsx"), "utf8");
    expect(fragen).toContain('{ id: "download", label: t("ask.export.download") }');
    expect(fragen).toContain('{ id: "print", label: t("ask.export.print") }');
    expect(fragen).toContain('{t("ask.export.copy")}');
    const fehlt: string[] = [];
    for (const sprache of SPRACHEN) {
      const t = i18n.getFixedT(sprache);
      const text = artikelText("antwort-weitergeben", sprache) ?? "";
      for (const key of ["ask.export.copy", "ask.export.download", "ask.export.print"]) {
        if (!text.includes(t(key))) fehlt.push(`${sprache}: „${t(key)}“ fehlt`);
      }
      if (!text.includes(t("ask.menu.label"))) fehlt.push(`${sprache}: das Antwortmenü fehlt`);
    }
    expect(fehlt).toEqual([]);
  });

  it("G6 · GEGENPROBE: die Auslassungsprüfung ist keine Konstante", () => {
    // Jede Art schlägt an, wenn sie am Bestand nicht stimmt.
    const falsch: Auslassung[] = [
      { art: "ohne-recht", rolle: "controller", recht: "ko.validate" },
      { art: "ohne-recht", rolle: "gibtsnicht", recht: "ko.read" },
      { art: "keine-flaeche", routenwoerter: ["hilfe"] },
    ];
    for (const auslassung of falsch) {
      expect(auslassungBefund(auslassung), JSON.stringify(auslassung)).not.toBeNull();
    }
    // Nacharbeit 9: der Befund muss die echte Route nennen — sonst schlug nur die Kalibrierung an
    // („die Routen wurden nicht gelesen"), und diese Gegenprobe war still gegenstandslos.
    const hilfe: Auslassung = { art: "keine-flaeche", routenwoerter: ["hilfe"] };
    expect(auslassungBefund(hilfe), "der Routenleser misst nichts").toContain("/hilfe");
    // Und die heute geführten Auslassungen stimmen — die Begründung allein trägt keine.
    const ohne = GLIEDERUNG.filter((punkt) => punkt.artikel === null).map((punkt) => punkt.id);
    expect(ohne).toEqual(["B2-9", "B10-1", "B10-3", "B10-4"]);
  });
});

describe("R-0943 · Nacharbeit 7 — die KI-Grundlage nimmt Bibliotheksauszüge, ohne FAQ zu verdrängen", () => {
  const t = i18n.getFixedT("de");
  const bestand = [
    ...resolveKlaraEntries(allKlaraEntries(), (key) => t(key)),
    ...allFaqEntries("de"),
  ];
  const auszuege = bibliothekAuszuege("de", (key) => t(key));

  it("K1 · „Leimzeit“: bisher keine Grundlage, jetzt der passende Auszug", () => {
    expect(rankKlara(bestand, "Leimzeit", 12), "schon die Registry kennt das Wort").toEqual([]);
    const ids = klaraGrundlage(bestand, auszuege, "Leimzeit", 12).map((eintrag) => eintrag.id);
    expect(ids).toContain("artikel:capture:was");
  });

  it("K2 · für jede FAQ-Frage bleibt jede FAQ-Antwort der bisherigen Grundlage drin", () => {
    const verloren: string[] = [];
    for (const faq of FAQ_CONTENT) {
      const vorher = rankKlara(bestand, faq.question, 12).filter((e) => e.kind === "faq");
      const nachher = klaraGrundlage(bestand, auszuege, faq.question, 12);
      expect(nachher.length).toBeLessThanOrEqual(12);
      const artikel = nachher.filter((e) => e.kind === "artikel").length;
      expect(artikel).toBeLessThanOrEqual(BIBLIOTHEK_PLAETZE);
      for (const antwort of vorher) {
        if (!nachher.includes(antwort)) verloren.push(`${faq.id}: ${antwort.id}`);
      }
    }
    expect(verloren).toEqual([]);
  });

  it("K3 · jeder Auszug kommt ungekürzt an der Modellkante an (Titel ≤ 160, Text ≤ 700)", () => {
    const zuLang: string[] = [];
    for (const sprache of SPRACHEN) {
      const fest = i18n.getFixedT(sprache);
      for (const auszug of bibliothekAuszuege(sprache, (key) => fest(key))) {
        if (auszug.title.length > 160) zuLang.push(`${sprache} · ${auszug.id}: Titel`);
        if (auszug.body.length > 700 || auszug.body.trim().length === 0) {
          zuLang.push(`${sprache} · ${auszug.id}: Text ${auszug.body.length}`);
        }
      }
    }
    expect(zuLang).toEqual([]);
  });
});
