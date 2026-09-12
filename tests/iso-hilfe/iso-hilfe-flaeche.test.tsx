// @vitest-environment jsdom
// ================================================================================================
// JOB 3338 · ISO-HILFE — gemessen an der GEMOUNTETEN Hilfe, nicht am Inhaltsmodul.
// ================================================================================================
//
// PEDIS SATZ (Freigabe 08.09.2026, ISO-HILFE-AUFTRAG.md:3): „wenn ich 9001 oder 2701 in der Hilfe …
// eintrage, soll dazu deine Erklärung kommen". Genau das misst diese Datei: der Suchbegriff geht in
// das ECHTE Eingabefeld der echten Seite `pages/Help.tsx`, und danach steht der ERKLÄRTEXT im DOM —
// nicht nur ein Link, der ihn verspricht.
//
// WARUM GEMOUNTET UND NICHT ÜBER `filterHelpTopics`. Der Filter ist DOM-frei und schon geprüft
// (`tests/analytics/help-topics.test.ts`). Er würde auch dann grün bleiben, wenn die ISO-Kapitel im
// Suchraum der SEITE gar nicht ankämen — der teuerste Fehler dieses Projekts (etwas ist gebaut und
// wird nie gerufen). Deshalb ist der Prüfstand hier die Seite mit echtem Router und echtem i18n;
// Attrappen gibt es keine.
//
// DIE ZWEI GEGENPROBEN, mit denen diese Datei ihre Aussagekraft belegt (RUECKGABE.md):
//   1. Alias `2701` aus `helpTopics.iso.ts` entfernen  → A1/A2 rot („2701" findet nichts).
//   2. „Klarwerk garantiert die Zertifizierung." in einen Fliesstext einfügen → F1 rot.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import {
  ISO_HELP_LABELS,
  ISO_HELP_TOPICS,
  helpAbsaetze,
  isoQuellenAnzeige,
} from "../../apps/web/src/lib/helpTopics.iso";
import { Help } from "../../apps/web/src/pages/Help";
import { VERBOTENE_ZUSAGEN, zusagenBefund, zusagenBlockliste } from "./zusagen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountHilfe(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help)));
    await flush();
  });
}

/** Das echte Suchfeld der Seite — kein zweites, kein verstecktes. */
function suchfeld(): HTMLInputElement {
  const felder = container.querySelectorAll<HTMLInputElement>('input[data-testid="hilfe-suche"]');
  expect(felder.length, "die Hilfe hat nicht genau EIN Suchfeld").toBe(1);
  const feld = felder[0];
  if (!feld) {
    throw new Error("Suchfeld fehlt");
  }
  return feld;
}

/** Tippen wie ein Mensch: über den nativen Setter, damit React den Zustand wirklich übernimmt. */
async function tippe(wert: string): Promise<void> {
  const el = suchfeld();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

async function sprache(lng: string): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage(lng);
    await flush();
  });
}

/** Die IDs der Kapitel, die gerade WIRKLICH auf der Fläche stehen. */
function sichtbareKapitel(): string[] {
  return [...container.querySelectorAll<HTMLElement>("[data-hilfe-thema]")].map(
    (el) => el.dataset.hilfeThema ?? "",
  );
}

function kapitel(id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-hilfe-thema="${id}"]`);
  if (!el) {
    throw new Error(`Kapitel ${id} steht nicht auf der Fläche`);
  }
  return el;
}

function text(el: ParentNode | null): string {
  return (el instanceof HTMLElement ? el.textContent : (el?.textContent ?? "")) ?? "";
}

/** Whitespace normalisieren — der DOM bricht Absätze anders um als die Quelle. */
function flach(roh: string): string {
  return roh.replace(/\s+/g, " ").trim();
}

/**
 * Der ERKLÄRTEXT einer Karte: Überschrift und Absätze, satzweise trennbar. Bewusst NICHT
 * `textContent` der ganzen Karte — das hängt Absätze ohne Leerzeichen aneinander und mischt
 * Quell-URLs hinein, in denen jeder Punkt wie ein Satzende aussieht. Für den rohen Kartentext
 * gibt es F3 mit der Blockliste, die keine Satzgrenzen braucht.
 */
function kartenText(id: string): string {
  const karte = kapitel(id);
  const teile = [
    text(karte.querySelector("h3")),
    ...[...karte.querySelectorAll("[data-hilfe-absatz]")].map((p) => text(p)),
  ];
  return teile.join("\n");
}

function isoThema(id: string) {
  const thema = ISO_HELP_TOPICS.find((t) => t.id === id);
  if (!thema) {
    throw new Error(`Lieferung ohne Kapitel ${id}`);
  }
  return thema;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("JOB 3338 · A — der Suchbegriff findet die ISO-Erklärung, in beiden Sprachen", () => {
  it("A1: „2701“ (DE) führt zu ISO/IEC 27001 — und die Überschrift nennt die RICHTIGE Nummer", async () => {
    await mountHilfe();
    await tippe("2701");
    const gefunden = sichtbareKapitel();
    expect(gefunden, "„2701“ findet das 27001-Kapitel nicht").toContain("iso-27001");
    const ueberschrift = flach(text(kapitel("iso-27001").querySelector("h3")));
    expect(ueberschrift).toBe(isoThema("iso-27001").title.de);
    expect(ueberschrift, "die Überschrift nennt die Normbezeichnung nicht").toContain(
      "ISO/IEC 27001",
    );
    // Der Alias ist ein SUCHBEGRIFF. Keine Überschrift eines Kapitels darf „2701“ als Nummer führen.
    for (const id of gefunden) {
      expect(
        flach(text(kapitel(id).querySelector("h3"))),
        `${id} führt den Suchalias als Normbezeichnung in der Überschrift`,
      ).not.toMatch(/ISO[\s/A-Z]*\s2701\b/);
    }
  });

  it("A2: „2701“ (EN) führt zu demselben Kapitel — der Alias ist sprachunabhängig", async () => {
    await mountHilfe();
    await sprache("en");
    await tippe("2701");
    expect(sichtbareKapitel(), "„2701“ wirkt auf Englisch nicht").toContain("iso-27001");
    expect(flach(text(kapitel("iso-27001").querySelector("h3")))).toBe(
      isoThema("iso-27001").title.en,
    );
  });

  it("A3: „9001“, „27001“, „ISO 9001“, „iso2701“, „ISO“ — jeder Pflichtbegriff der Lieferung trifft", async () => {
    await mountHilfe();
    const pflicht: ReadonlyArray<readonly [string, string]> = [
      ["9001", "iso-9001"],
      ["27001", "iso-27001"],
      ["ISO 9001", "iso-9001"],
      ["ISO 2701", "iso-27001"],
      ["iso2701", "iso-27001"],
      ["iso27001", "iso-27001"],
      ["ISO", "iso-overview"],
    ];
    for (const lng of ["de", "en"] as const) {
      await sprache(lng);
      for (const [begriff, erwartet] of pflicht) {
        await tippe(begriff);
        expect(sichtbareKapitel(), `„${begriff}“ (${lng}) findet ${erwartet} nicht`).toContain(
          erwartet,
        );
      }
    }
  });

  it("A4: der bestehende Suchbestand bleibt — „erfassen“, leere Suche, unbekannter Begriff", async () => {
    await mountHilfe();
    await tippe("erfassen");
    expect(sichtbareKapitel(), "das Erfassen-Kapitel ist aus der Suche gefallen").toContain(
      "capture",
    );
    await tippe("pwa");
    expect(sichtbareKapitel()).toEqual(["mobile"]);
    await tippe("");
    // Leere Suche zeigt ALLE: die Kapitel aus `HELP_TOPICS` plus die vier ISO-Kapitel.
    // JOB 3468 (REVIEW26-HILFE-IMPORT): von 14 auf 15 — `HELP_TOPICS` führt seit diesem Job elf
    // Kapitel (das neue `fileimport`). Die Zahl ist hier ABGELEITET und nicht mehr getippt: sie
    // bleibt damit bei jedem weiteren Kapitel richtig, und der Fall prüft weiterhin genau das, was
    // er prüfen soll — dass BEIDE Listen auf der Fläche ankommen und keine dabei verlorengeht.
    // JOB 3741 (SEITENHILFE-LUECKEN): von 15 auf 25 — `HELP_TOPICS` führt seit diesem Job
    // einundzwanzig Kapitel (zehn neue für die Menüpunkte ohne Erklärsatz). Die abgeleitete Zeile
    // darüber bleibt der eigentliche Wächter; die getippte Zahl darunter ist der Gegenhalt gegen
    // eine Ableitung, die beide Seiten gleichzeitig verlöre.
    const alle = sichtbareKapitel();
    expect(alle.length).toBe(HELP_TOPICS.length + ISO_HELP_TOPICS.length);
    expect(alle.length, "der sichtbare Bestand ist nicht mehr fünfundzwanzig Kapitel").toBe(25);
    for (const id of ["firststart", "capture", "ask", "library", "validation", "tasks"]) {
      expect(alle, `${id} fehlt in der ungefilterten Hilfe`).toContain(id);
    }
    await tippe("zzz-gibt-es-nicht");
    expect(sichtbareKapitel()).toEqual([]);
    expect(flach(text(container))).toContain(i18n.t("help.noResults"));
  });
});

describe("JOB 3338 · B — der Inhalt steht LESBAR da, nicht nur als Link", () => {
  it("B1: jeder Absatz der Lieferung steht als eigener Absatz im DOM — vollständig, DE und EN", async () => {
    await mountHilfe();
    for (const lng of ["de", "en"] as const) {
      await sprache(lng);
      for (const thema of ISO_HELP_TOPICS) {
        await tippe("iso");
        const karte = kapitel(thema.id);
        const absaetze = helpAbsaetze(thema.body[lng]);
        expect(absaetze.length, `${thema.id} liefert keine Absätze`).toBeGreaterThanOrEqual(3);
        const imDom = [...karte.querySelectorAll("[data-hilfe-absatz]")].map((p) => flach(text(p)));
        expect(imDom, `${thema.id}/${lng}: Absatzzahl weicht ab`).toEqual(
          absaetze.map((a) => flach(a)),
        );
      }
    }
  });

  it("B2: der Erklärtext hängt nicht am Link — die Karte trägt ihn auch ohne ihren Handlungslink", async () => {
    await mountHilfe();
    await tippe("27001");
    const karte = kapitel("iso-27001");
    const route = karte.querySelector('[data-testid="hilfe-route-iso-27001"]');
    expect(route, "der interne Handlungslink fehlt").not.toBeNull();
    const ohneLink = flach(text(karte)).replace(flach(text(route)), "");
    expect(ohneLink, "ohne den Link bleibt kein Erklärtext übrig").toContain(
      flach(helpAbsaetze(isoThema("iso-27001").body.de)[0] ?? "—"),
    );
  });

  it("B3: der Handlungslink ist eine ECHTE interne Route, kein externer Link", async () => {
    await mountHilfe();
    await tippe("iso");
    for (const thema of ISO_HELP_TOPICS) {
      const link = kapitel(thema.id).querySelector<HTMLAnchorElement>(
        `[data-testid="hilfe-route-${thema.id}"]`,
      );
      expect(link, `${thema.id} ohne Handlungslink`).not.toBeNull();
      expect(link?.getAttribute("href")).toBe(thema.to);
      expect(link?.hasAttribute("target"), `${thema.id}: interne Route öffnet einen Tab`).toBe(
        false,
      );
    }
  });

  // ================================================================================================
  // B4 — DIE BREITE IST EINE ENTSCHEIDUNG, ALSO WIRD SIE GEMESSEN (Runde 2).
  // ================================================================================================
  // Runde 1 setzte die Breite mit `cx("flex flex-col", istIso && "sm:col-span-2")`. Der
  // Klassenbindungs-Sammler (`tests/app/mega47-…`) machte das Tor rot: eine unauflösbare Bindung
  // mehr (218 statt 217). Runde 2 schreibt stattdessen ZWEI Karten mit je wörtlicher Klassenkette.
  //
  // Dabei kann die Breite still verlorengehen — die Umstellung berührt genau die Zeile, die sie
  // trägt, und KEIN Fall hätte es bisher gemerkt (jsdom rechnet kein Layout, misst also nur die
  // Klasse). Dieser Fall prüft beide Zweige: das ISO-Kapitel trägt `sm:col-span-2`, ein
  // bestehendes Kapitel trägt es NICHT. Ohne die Gegenrichtung wäre er auch dann grün, wenn die
  // Klasse plötzlich an JEDER Karte stünde.
  it("B4: ISO-Karten laufen über die ganze Rasterbreite, bestehende Kapitel nicht", async () => {
    await mountHilfe();
    await tippe("");
    for (const thema of ISO_HELP_TOPICS) {
      expect(
        kapitel(thema.id).className.split(/\s+/),
        `${thema.id}: der Fliesstext steht wieder in der halben Spalte`,
      ).toContain("sm:col-span-2");
    }
    for (const id of ["capture", "ask", "mobile"]) {
      expect(
        kapitel(id).className.split(/\s+/),
        `${id}: ein bestehendes Kapitel hat die volle Breite bekommen`,
      ).not.toContain("sm:col-span-2");
    }
  });
});

describe("JOB 3338 · C — die externen Quellen stehen GETRENNT und kündigen den Tabwechsel an", () => {
  it("C1: eigener Quellenblock je ISO-Kapitel, mit allen Quellen der Lieferung", async () => {
    await mountHilfe();
    await tippe("iso");
    for (const thema of ISO_HELP_TOPICS) {
      const block = kapitel(thema.id).querySelector<HTMLElement>(
        `[data-testid="hilfe-quellen-${thema.id}"]`,
      );
      expect(block, `${thema.id} ohne Quellenblock`).not.toBeNull();
      expect(flach(text(block))).toContain(ISO_HELP_LABELS.sources.de);
      const links = [...(block?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
      expect(
        links.map((a) => a.getAttribute("href")),
        `${thema.id}: Quellen weichen ab`,
      ).toEqual([...thema.sources]);
      for (const a of links) {
        expect(a.getAttribute("target"), "externe Quelle ohne neuen Tab").toBe("_blank");
        expect(a.getAttribute("rel") ?? "", "externe Quelle ohne rel-Schutz").toContain(
          "noreferrer",
        );
        // Die Ankündigung steht IM Link — sie ist damit Teil seines zugänglichen Namens.
        expect(flach(text(a)), "Ankündigung „öffnet neuen Tab“ fehlt am Link").toContain(
          ISO_HELP_LABELS.newTab.de,
        );
        expect(flach(text(a))).toContain(isoQuellenAnzeige(a.getAttribute("href") ?? ""));
      }
    }
  });

  it("C2: der Quellenblock enthält KEINE interne Route, der Handlungslink KEINE externe Quelle", async () => {
    await mountHilfe();
    await tippe("iso");
    for (const thema of ISO_HELP_TOPICS) {
      const karte = kapitel(thema.id);
      const block = karte.querySelector<HTMLElement>(`[data-testid="hilfe-quellen-${thema.id}"]`);
      expect(
        block?.querySelector(`[data-testid="hilfe-route-${thema.id}"]`),
        `${thema.id}: der Handlungslink steckt im Quellenblock`,
      ).toBeNull();
      const route = karte.querySelector<HTMLAnchorElement>(
        `[data-testid="hilfe-route-${thema.id}"]`,
      );
      expect(route?.getAttribute("href") ?? "").toMatch(/^\//);
      // Und umgekehrt: kein externer Link ausserhalb des Quellenblocks.
      for (const a of karte.querySelectorAll<HTMLAnchorElement>("a")) {
        const href = a.getAttribute("href") ?? "";
        if (href.startsWith("http")) {
          expect(
            block?.contains(a),
            `${thema.id}: externer Link ausserhalb des Quellenblocks`,
          ).toBe(true);
        }
      }
    }
  });

  it("C3: die Merkmalsleiste der ISO-Kapitel heisst „Suchbegriffe“ — `2701` ist keine Nummer", async () => {
    await mountHilfe();
    await tippe("2701");
    const karte = kapitel("iso-27001");
    const leiste = karte.querySelector<HTMLElement>('[data-testid="hilfe-suchbegriffe-iso-27001"]');
    expect(leiste, "die ISO-Karte beschriftet ihre Merkmalsleiste nicht").not.toBeNull();
    expect(flach(text(leiste))).toContain(ISO_HELP_LABELS.searchTerms.de);
    expect(flach(text(leiste))).toContain("2701");
  });
});

describe("JOB 3338 · D — der Sprachwechsel behält Suchbegriff und geöffnete Erklärung", () => {
  it("D1: „2701“ eingetippt, de → en → de: der Begriff bleibt, der Treffer bleibt, der Text wechselt", async () => {
    await mountHilfe();
    await tippe("2701");
    const thema = isoThema("iso-27001");
    expect(thema.title.de, "DE und EN führen denselben Titel — der Fall misst nichts").not.toBe(
      thema.title.en,
    );
    expect(flach(text(kapitel("iso-27001")))).toContain(flach(thema.title.de));

    await sprache("en");
    expect(suchfeld().value, "der Sprachwechsel hat den Suchbegriff verworfen").toBe("2701");
    expect(sichtbareKapitel(), "der Treffer ist beim Sprachwechsel verschwunden").toContain(
      "iso-27001",
    );
    const enText = flach(text(kapitel("iso-27001")));
    expect(enText).toContain(flach(thema.title.en));
    expect(enText, "der deutsche Titel steht nach dem Wechsel noch da").not.toContain(
      flach(thema.title.de),
    );
    expect(enText).toContain(flach(helpAbsaetze(thema.body.en)[0] ?? "—"));

    await sprache("de");
    expect(suchfeld().value).toBe("2701");
    expect(flach(text(kapitel("iso-27001")))).toContain(flach(thema.title.de));
  });

  it("D2: `nl` fällt auf Deutsch zurück — kein leeres Kapitel, wie `fallbackLng` in i18n.ts", async () => {
    await mountHilfe();
    await tippe("9001");
    await sprache("nl");
    expect(sichtbareKapitel()).toContain("iso-9001");
    expect(flach(text(kapitel("iso-9001")))).toContain(flach(isoThema("iso-9001").title.de));
  });
});

describe("JOB 3338 · F — auf der Fläche steht keine Zusage, die Klarwerk nicht halten kann", () => {
  it("F1: keine verbotene Zusage im gerenderten ISO-Text — DE und EN, alle vier Kapitel", async () => {
    await mountHilfe();
    expect(
      VERBOTENE_ZUSAGEN.length,
      "die Zusagenliste ist leer — der Fall misst nichts",
    ).toBeGreaterThan(10);
    for (const lng of ["de", "en"] as const) {
      await sprache(lng);
      await tippe("iso");
      for (const thema of ISO_HELP_TOPICS) {
        expect(
          zusagenBefund(kartenText(thema.id)),
          `${thema.id}/${lng}: verbotene Zusage auf der Fläche`,
        ).toEqual([]);
      }
    }
  });

  it("F3: auch die GANZE Karte (Beschriftungen, Suchbegriffe, Quellen) trägt keine Zusage", async () => {
    await mountHilfe();
    for (const lng of ["de", "en"] as const) {
      await sprache(lng);
      await tippe("iso");
      for (const thema of ISO_HELP_TOPICS) {
        expect(
          zusagenBlockliste(text(kapitel(thema.id))),
          `${thema.id}/${lng}: verbotene Zusage ausserhalb des Fliesstexts`,
        ).toEqual([]);
      }
    }
  });

  it("F2: die Einschränkung steht MIT auf der Fläche — nicht nur die Zusage fehlt", async () => {
    await mountHilfe();
    await tippe("9001");
    expect(flach(text(kapitel("iso-9001")))).toContain(
      "es garantiert weder die Erstzertifizierung noch deren Erhalt",
    );
    await sprache("en");
    expect(flach(text(kapitel("iso-9001")))).toContain(
      "it does not guarantee initial or continued certification",
    );
  });
});
