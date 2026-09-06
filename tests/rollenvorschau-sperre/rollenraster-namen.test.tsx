// @vitest-environment jsdom
// ================================================================================================
// JOB 3124 · UX-12 — DAS AUSWAHL-RASTER TRÄGT DIE VOLLEN NAMEN, OHNE SIE ABZUSCHNEIDEN.
// ================================================================================================
//
// Lieferung 4 des Auftrags tauscht im Raster („Ansicht als Rolle") die Kurzform gegen den vollen
// Namen: „Viewer" → „Betrachter", „Contr." → „Controller". Die naheliegende Halbheit dabei ist, die
// Namen einzusetzen und sie im Engpass kürzen zu lassen — dann steht dort „Betracht…" und die
// Verwechslung ist zurück, nur an anderer Stelle.
//
// WAS DIESE DATEI PRÜFT
// -----------------------------------------------------------------------------------------------
//   N1  alle vier Knöpfe tragen `role.name.*`, keiner mehr die Kurzform.
//   N2  kein Kürzungsmerkmal an den Knöpfen, dafür `break-words`: ein zu langer Name BRICHT UM,
//       er wird nicht beschnitten und bekommt keine Ellipse.
//   N3  das Raster reduziert die Spalten zur schmalen Fläche hin: eine bis `sm`, zwei bis `lg`,
//       vier darüber. Vier Spalten sind der Fall, in dem die längeren Namen überhaupt erst in den
//       Engpass geraten.
//   N4  DIE BREITENAUSSAGE WIRD NICHT HIER GERECHNET, SONDERN IN CHROMIUM GEMESSEN (s. u.).
//
// WAS SIE AUSDRÜCKLICH NICHT IST: eine Pixelmessung. jsdom hat keine Layout-Maschine.
//
// RUNDE 2, BENs KORREKTURPFLICHT 1: Hier stand bis eben eine RECHNUNG, die aus den Breitenabzügen
// im Quelltext schloss, vollständige Lesbarkeit sei bei 320 UND 390 px unmöglich — und die diesen
// Schluss als grüne Zusicherung festhielt. Beides war falsch. Falsch in der Sache, weil eine
// einzeilige Textbreite bei erlaubtem Umbruch nichts über Lesbarkeit sagt (BENs Browsermessung:
// bei 390 px stand der Text vollständig umbrochen im Knopf). Und falsch in der Art, weil ein
// grüner Test einen offenen Mangel auf seinen Fortbestand festgeschrieben hätte. Die Rechnung ist
// ersatzlos GELÖSCHT; die Aussage über 320 und 390 px trifft jetzt ausschließlich die Messung an
// der gebauten App in `rollenraster-schmal-chromium.test.ts`. N4 hält nur noch fest, dass es diese
// Messung gibt und dass sie beide Breiten wirklich prüft.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

// Gemessen wird die BESCHRIFTUNG und der Zeilenumbruch des Rasters, nicht der Rollenzustand — der
// Haken darf deshalb hier ein einfacher sein. (Die echte Kette Sitzung → `previewActive` → Fläche
// misst `sperrkarte-sagt-vorschau-mounted.test.tsx`.)
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({
    role: "admin",
    setRole: () => {},
    stufe2: true,
    setStufe2: () => {},
    isSessionRole: true,
    canPreview: true,
    previewActive: false,
  }),
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ROLES } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { AnsichtAlsRolleDetail } from "../../apps/web/src/pages/AdminKontenDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Kürzungsmerkmale: jedes einzelne macht aus einem langen Namen ein „…" statt eines Umbruchs. */
const KUERZUNG = [
  "truncate",
  "text-ellipsis",
  "text-clip",
  "overflow-hidden",
  "whitespace-nowrap",
  "line-clamp-",
];

interface Raster {
  wurzel: HTMLElement;
  knoepfe: HTMLButtonElement[];
  aufraeumen: () => void;
}

function raster(): Raster {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(AnsichtAlsRolleDetail, { onZurueck: () => {} }));
  });
  const karte = container.querySelector<HTMLElement>('[data-testid="detail-ansicht-rolle"]');
  if (!karte) {
    throw new Error("Detailkarte „Ansicht als Rolle“ wurde nicht gerendert");
  }
  const knoepfe = [...karte.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")];
  const wurzel = knoepfe[0]?.parentElement;
  if (!wurzel) {
    throw new Error("Rollenraster wurde nicht gerendert");
  }
  return {
    wurzel,
    knoepfe,
    aufraeumen: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const quelle = (rel: string): string => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("JOB 3124 UX-12 · das Rollenraster: volle Namen, kein Abschneiden", () => {
  it("N1 · alle vier Knöpfe tragen den vollen Namen (role.name.*), keiner die Kurzform", async () => {
    await i18n.changeLanguage("de");
    const r = raster();
    const texte = r.knoepfe.map((b) => (b.textContent ?? "").trim());
    expect(texte).toEqual(ROLES.map((x) => i18n.t(`role.name.${x}`)));
    // Die Kurzformen sind wirklich weg. „Viewer"/„Contr." unterscheiden sich im Deutschen von
    // „Betrachter"/„Controller" — der Fall trennt also etwas.
    for (const x of ROLES) {
      const kurz = i18n.t(`role.short.${x}`);
      if (kurz !== i18n.t(`role.name.${x}`)) {
        expect(texte, `die Kurzform „${kurz}“ steht noch im Raster`).not.toContain(kurz);
      }
    }
    r.aufraeumen();
  });

  it("N2 · kein Kürzungsmerkmal an den Knöpfen, dafür break-words — ein langer Name bricht um", async () => {
    await i18n.changeLanguage("de");
    const r = raster();
    for (const b of r.knoepfe) {
      for (const merkmal of KUERZUNG) {
        expect(
          b.className,
          `Kürzungsmerkmal „${merkmal}“ am Rollenknopf „${b.textContent}“`,
        ).not.toContain(merkmal);
      }
      expect(b.className, "ohne break-words kann ein langes Wort nicht umbrechen").toContain(
        "break-words",
      );
    }
    r.aufraeumen();
  });

  it("N3 · das Raster reduziert die Spalten nach unten: eine bis sm, zwei bis lg, vier darüber", async () => {
    await i18n.changeLanguage("de");
    const r = raster();
    const klassen = r.wurzel.className.split(/\s+/);
    // Die Grundstellung ist die SCHMALSTE Fläche. Gemessen (Chromium, 320 px): zweispaltig waren
    // die Knöpfe dort 12 px breit und der Text lief bis 10,66 px in den Nachbarn hinein;
    // einspaltig sind sie 30 px breit und der Überlauf ist 0.
    expect(klassen, "die Grundstellung ist nicht einspaltig").toContain("grid-cols-1");
    expect(klassen, "zwei Spalten ohne Breitenbedingung — genau der 320-px-Engpass").not.toContain(
      "grid-cols-2",
    );
    expect(klassen, "vier Spalten ohne Breitenbedingung — der alte Engpass").not.toContain(
      "grid-cols-4",
    );
    expect(klassen, "ab sm ist Platz für zwei Spalten").toContain("sm:grid-cols-2");
    expect(klassen, "auf breiter Fläche bleibt es beim Viererraster").toContain("lg:grid-cols-4");
    r.aufraeumen();
  });

  it("N4 · die Breitenaussage steht nicht hier, sondern als echte Messung an der gebauten App", () => {
    // Diese Datei darf über 320/390 px NICHTS behaupten — sie hat keine Layout-Maschine. Sie hält
    // nur fest, dass die Messung existiert und beide Breiten wirklich anfasst; verschwindet sie
    // oder eine der beiden Breiten, wird dieser Fall rot statt die Lücke stillschweigend zu
    // schlucken (Runde 1 hatte hier eine Rechnung stehen, die eine falsche Aussage grün machte).
    const mess = quelle("tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts");
    // Die beiden Breiten stehen in der SCHLEIFE, die die Fälle erzeugt — nicht bloß irgendwo im
    // Text: eine Zahl im Kommentar wäre kein Beleg dafür, dass sie auch gemessen wird.
    expect(mess, "die Chromium-Messung erzeugt ihre Fälle nicht mehr aus 320 und 390 px").toContain(
      "for (const breite of [320, 390])",
    );
    // Gemessen wird an der GEBAUTEN App in Chromium, nicht an einem Nachbau.
    expect(mess, "die Messung startet keine Chromium-Bühne mehr").toContain(
      'starte("/admin", \'[data-einst="seite"]\', 320, 740)',
    );
    // Und sie misst den Überlauf, nicht bloß Klassennamen.
    expect(mess, "die Messung prüft den Textüberlauf nicht mehr").toContain("scrollWidth");
    expect(mess, "die Messung prüft die Lage der Textzeilen nicht mehr").toContain("ueberlaufPx");
  });
});
