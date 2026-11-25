// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "../../apps/web/node_modules/react";
import type {
  Funktionskatalog,
  KatalogEintrag,
} from "../../services/app/src/funktionskatalog/vertrag";
import {
  type Stand,
  abbauen,
  beruhige,
  klicke,
  montiere,
  ohneNetz,
  ort,
  sprache,
  tippe,
  verlauf,
} from "./vorrichtung";

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: async () => ({ needsSetup: false }),
      me: async () => ({ id: "admin", name: "Ada", role: "admin", email: "a@example.test" }),
    },
  };
});
const text = (de: string, en: string, nl: string) => ({ de, en, nl });
const e: KatalogEintrag = {
  id: "kalender",
  platforms: ["app"],
  group: "termine",
  status: "planned",
  title: text("Kalender lesen", "Read calendar", "Agenda lezen"),
  description: text("Zeigt Termine", "Shows appointments", "Toont afspraken"),
  input: text("Freigabe", "Permission", "Machtiging"),
  output: text("Terminübersicht", "Calendar overview", "Agendaoverzicht"),
  scope: text("Mein Konto", "My account", "Eigen account"),
  sources: [{ label: text("Beschluss", "Decision", "Besluit"), reference: "K-42" }],
};
const katalog: Funktionskatalog = {
  stand: "2026-11-25",
  groups: [{ id: "termine", label: text("Termine", "Schedule", "Planning") }],
  wege: [
    {
      id: "testweg",
      titel: text("Ein Kalenderweg", "A calendar path", "Een agendaroute"),
      verbindungen: [
        {
          von: "word-0",
          nach: "kalender",
          text: text("Termin übernehmen", "Use the date", "Afspraak overnemen"),
          stand: "vorgesehen",
          beleg: text("Vertrag K-42", "Contract K-42", "Contract K-42"),
        },
      ],
    },
  ],
  entries: [
    e,
    ...Array.from(
      { length: 21 },
      (_, i): KatalogEintrag => ({
        ...e,
        id: `word-${i}`,
        platforms: ["office"],
        status: "available",
        title: text(`Word ${i}`, `Word ${i}`, `Word ${i}`),
        input: text("Text", "Text", "Tekst"),
        output: text("Markierung", "Selection", "Selectie"),
        description: text("Prüfen", "Check", "Controleren"),
        scope: text("Dokument", "Document", "Document"),
        sources: [{ label: text("Quelle", "Source", "Bron"), reference: "W-1" }],
      }),
    ),
  ],
};
let stand: Stand;
const pfad = "/admin?bereich=funktionen";
function katalogSeite() {
  return stand.container.querySelector('[data-testid="funktionskatalog"]') as HTMLElement;
}
function button(name: string) {
  return [...katalogSeite().querySelectorAll("button")].find((b) => b.textContent === name);
}
function ergebnisse() {
  return [...katalogSeite().querySelectorAll('a[aria-haspopup="dialog"]')];
}
async function oeffne(adresse = pfad) {
  stand = montiere(adresse);
  await beruhige();
}
beforeEach(async () => {
  await sprache("de");
  ohneNetz({ "/api/admin/funktionen": katalog });
});
afterEach(() => {
  if (stand) abbauen(stand);
});

describe("Funktionskatalog der Verwaltung", () => {
  it("öffnet den adressierbaren Katalog nach Vorführdaten und behält Seite und Filter im Verlauf", async () => {
    await oeffne("/admin");
    const link = stand.container.querySelector(`[data-einst="reiter"][href="${pfad}"]`);
    expect(link?.previousElementSibling?.textContent).toBe("Vorführdaten");
    await klicke(link);
    expect(ort(stand)).toBe(pfad);
    expect(ergebnisse()).toHaveLength(20);
    await klicke(button("Weiter"));
    expect(ergebnisse()).toHaveLength(2);
    expect(ort(stand)).toContain("seite=2");
    await klicke(button("Klara-App"));
    expect(ergebnisse()).toHaveLength(1);
    expect(katalogSeite().querySelector("output")?.textContent).toBe("1 Funktion");
    await verlauf(stand, -1);
    expect(ergebnisse()).toHaveLength(2);
  });
  it("findet Übersetzungen, Quellen und Suchwörter über Felder hinweg; kombiniert und löscht Filter", async () => {
    await oeffne();
    const feld = katalogSeite().querySelector("input[type=search]");
    await tippe(feld, "machtiging K-42");
    expect(ergebnisse()).toHaveLength(1);
    expect(ergebnisse()[0]?.textContent).toContain("Kalender lesen");
    const auswahl = katalogSeite().querySelectorAll("select");
    await act(async () => {
      const status = auswahl[1] as HTMLSelectElement;
      status.value = "available";
      status.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await beruhige(3);
    expect(katalogSeite().textContent).toContain("Keine passenden Funktionen");
    await klicke(button("Filter zurücksetzen"));
    expect(katalogSeite().querySelector("output")?.textContent).toBe("22 Funktionen");
  });
  it("benennt den Dialog, zeigt Ablauf, Fundstelle und Geltungsbereich und schließt per Escape oder Zurück", async () => {
    await oeffne(`${pfad}&produkt=app`);
    await klicke(ergebnisse()[0]);
    const dialog = stand.container.querySelector("[data-katalog-dialog]");
    expect(dialog?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog?.querySelector("h2")?.textContent).toBe("Kalender lesen");
    expect([...(dialog?.querySelectorAll("ol li") ?? [])].map((s) => s.textContent)).toEqual([
      "EingabeFreigabe",
      "VerarbeitungKalender lesen",
      "ErgebnisTerminübersicht",
    ]);
    expect(dialog?.textContent).toContain("BeschlussK-42");
    expect(dialog?.textContent).toContain("Mein Konto");
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    await beruhige(3);
    expect(ort(stand)).toBe(`${pfad}&produkt=app`);
    await verlauf(stand, 1);
    expect(stand.container.querySelector("[data-katalog-dialog]")).not.toBeNull();
    await verlauf(stand, -1);
    expect(stand.container.querySelector("[data-katalog-dialog]")).toBeNull();
  });
  it("übersetzt einen direkt verlinkten Eintrag; Schließen behält seinen Suchkontext", async () => {
    await sprache("en");
    await oeffne(`${pfad}&q=K-42&funktion=kalender`);
    expect(stand.container.querySelector("[data-katalog-dialog]")?.textContent).toContain(
      "Calendar overview",
    );
    await sprache("nl");
    expect(stand.container.querySelector("[data-katalog-dialog]")?.textContent).toContain(
      "Agendaoverzicht",
    );
    await klicke(stand.container.querySelector("[data-katalog-dialog] button"));
    expect(ort(stand)).toBe(`${pfad}&q=K-42`);
  });
});
describe("Funktionslandkarte", () => {
  it("folgt gerichteten Wegen samt Beleg, öffnet das Detail und kehrt zur Station zurück", async () => {
    await oeffne();
    await klicke(katalogSeite().querySelector('nav a[href*="ansicht=karte"]'));
    const map = katalogSeite().querySelector('[data-testid="funktionskarte"]');
    expect(map?.querySelectorAll("[data-station]")).toHaveLength(2);
    expect(map?.querySelectorAll("path[marker-end]")).toHaveLength(1);
    const pfeil = map?.querySelector('[data-katalog-pfeil="word-0-kalender"]');
    expect(pfeil?.getAttribute("aria-label")).toContain("Word 0 → Kalender lesen");
    await act(async () => {
      pfeil?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    await beruhige(3);
    expect(ort(stand)).toContain("von=word-0");
    expect(map?.querySelector("[data-katalog-kante]")?.textContent).toContain("Vertrag K-42");
    await verlauf(stand, -1);
    const panel = map?.querySelector('[data-katalog-station="word-0"]');
    expect(panel?.textContent).toContain("Termin übernehmen");
    expect(panel?.textContent).toContain("Vertrag K-42");
    await klicke(panel?.querySelector('a[href*="knoten=kalender"]'));
    expect(ort(stand)).toContain("knoten=kalender");
    const ziel = map?.querySelector('[data-katalog-station="kalender"]');
    expect(ziel?.textContent).toContain("Hierher führt");
    await klicke(ziel?.querySelector('a[aria-haspopup="dialog"]'));
    expect(stand.container.querySelector("[data-katalog-dialog] h2")?.textContent).toBe(
      "Kalender lesen",
    );
    await verlauf(stand, -1);
    expect(stand.container.querySelector("[data-katalog-dialog]")).toBeNull();
    expect(map?.querySelector('[data-station="kalender"]')?.getAttribute("aria-current")).toBe(
      "step",
    );
  });
  it("erhält nicht verknüpfte Funktionen mit Produktherkunft und reagiert auf leere Filter", async () => {
    await oeffne(`${pfad}&ansicht=karte&knoten=word-2`);
    const map = katalogSeite().querySelector('[data-testid="funktionskarte"]');
    expect(map?.textContent).toContain("kein fachlicher Weg");
    expect(map?.querySelectorAll("path[marker-end]")).toHaveLength(0);
    expect(map?.querySelector("ol")?.textContent).toBe("Klara in Microsoft 365TermineWord 2");
    await tippe(katalogSeite().querySelector("input[type=search]"), "xxxyyy");
    expect(katalogSeite().textContent).toContain("Keine passenden Funktionen gefunden");
    await klicke(button("Filter zurücksetzen"));
    expect(katalogSeite().querySelector('[data-testid="funktionswege-graph"]')).not.toBeNull();
  });
  it("zeigt die drei Beispielergebnisse und den gemeinsamen Umstieg auch nach Sprachwechsel", async () => {
    const { funktionskatalog } = await import("../../services/app/src/funktionskatalog/katalog");
    ohneNetz({ "/api/admin/funktionen": funktionskatalog });
    await sprache("en");
    await oeffne(`${pfad}&ansicht=karte&weg=dokumentpruefung&knoten=V02`);
    const beispiel = katalogSeite().querySelector("[data-katalog-vergleich]");
    expect(beispiel?.querySelector("output")?.textContent).toContain("Contradiction");
    await klicke(button("must not"));
    expect(beispiel?.querySelector("output")?.textContent).toContain("Match");
    await klicke(button("channel 11"));
    expect(beispiel?.querySelector("output")?.textContent).toContain("Open");
    const map = katalogSeite().querySelector('[data-testid="funktionskarte"]');
    await klicke(map?.querySelector('[data-station="V03"]'));
    await klicke(map?.querySelector('[data-katalog-station] a[href*="weg=wissensfreigabe"]'));
    expect(ort(stand)).toContain("weg=wissensfreigabe");
    expect(ort(stand)).toContain("knoten=V03");
    await sprache("nl");
    expect(map?.querySelector("[data-katalog-netz]")?.textContent).toContain(
      "Alle routes en overstappen",
    );
    expect(map?.textContent).not.toContain("funktionskatalog.");
  });
});
