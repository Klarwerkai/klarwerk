// @vitest-environment jsdom
// ================================================================================================
// ADMIN-05 · DER GEMEINSAME EINSTIEG, GEMOUNTET — ein Umfang offen, eine Liste, ein Nachfolgerfeld.
// ================================================================================================
//
// produkt:20261007:ownership-uebergabe:admin-20261009. Gemountet wird die echte Komponente
// `UebergabeEinstieg` (mit der echten `VerantwortungUebergabe` darin) unter echtem QueryClient und
// echter Übersetzung. Das Netz darunter ist ein SIMULIERTES Doppel von `verantwortungApi`, das jeden
// Aufruf mitschreibt; die echten Routen misst `ablauf-api.test.ts`. Alle Daten sind erfunden.
//
//   K1 · Beide Umfänge erklärt; geöffnet ist immer nur einer — nie zwei Nachfolgerfelder.
//   K2 · Zwei Pakete in der Vorschau mit Rechtewirkung; Bestätigen erst bei vollständiger Zuordnung.
//   K4 · Teilfehler nennt Offenes; „Offene erneut übertragen" schickt DIESELBE Eingabe noch einmal.
//   K5 · Zugang beenden und vorübergehend sperren getrennt erklärt; die Vertretung steht da.
//   K6 · Die letzte Abschlussbilanz kommt vom Server; Abbrechen vor Bestätigen sendet nichts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Eingabe {
  person: string;
  umfang: string;
  beitraege: { koId: string; an: string }[];
  vorgaenge: { art: string; id: string; an: string }[];
  zugang: string;
}

const netz = vi.hoisted(() => ({
  aufrufe: [] as { weg: string; eingabe?: Eingabe }[],
  ablaeufe: [] as Record<string, unknown>[],
  teilfehler: false,
}));

vi.mock("../../apps/web/src/api/verantwortung", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/verantwortung")>();
  const ziele = [
    { id: "ada", name: "Ada Admin", role: "admin" },
    { id: "nora", name: "Nora Nachfolge", role: "experte" },
    { id: "otto", name: "Otto Controller", role: "controller" },
  ];
  const beitrag = (koId: string, titel: string, zulaessig: string[]) => ({
    koId,
    version: 1,
    titel,
    sichtbar: true,
    status: "offen",
    spaceName: null,
    verantwortungsart: "author-fallback",
    autor: { id: "paula", name: "Paula Abgang" },
    ursprungsautor: { id: "paula", name: "Paula Abgang" },
    mitwirkende: 0,
    imPapierkorb: false,
    zulaessig,
  });
  const bestand = {
    person: { id: "paula", name: "Paula Abgang", role: "experte", zugang: "aktiv" },
    anzahl: 3,
    nichtEinsehbar: 0,
    beitraege: [
      beitrag("a1", "Drehmomentschlüssel Linie 1", ["ada", "nora", "otto"]),
      beitrag("a2", "Messschieber Linie 2", ["ada", "nora", "otto"]),
      beitrag("v1", "Kalibrierlabor Zugang", ["ada", "otto"]),
    ],
    ziele,
    vertretung: [ziele[0], ziele[2]],
  };
  const bilanzVorher = { beitraege: 3, entwuerfe: 1, luecken: 1, pruefaufgaben: 1 };
  const NULL = { beitraege: 0, entwuerfe: 0, luecken: 0, pruefaufgaben: 0 };
  const name = (id: string) => ziele.find((k) => k.id === id)?.name ?? null;
  const eintraege = (e: Eingabe) => [
    ...e.beitraege.map((z) => ({ art: "beitrag", id: z.koId, titel: z.koId, an: z.an })),
    ...e.vorgaenge.map((z) => ({ art: z.art, id: z.id, titel: null, an: z.an })),
  ];
  return {
    ...original,
    verantwortungApi: {
      ...original.verantwortungApi,
      bestand: async () => bestand,
      ungeklaert: async () => ({ personen: [], vertretung: bestand.vertretung }),
      vorgaenge: async () => ({
        entwuerfe: [{ id: "d-offen" }],
        luecken: [{ id: "g-offen" }],
        pruefaufgaben: [{ koId: "p1", titel: "Prüfplan Halle 3" }],
      }),
      ablaeufe: async () => ({ ablaeufe: [...netz.ablaeufe] }),
      ablaufVorschau: async (e: Eingabe) => {
        netz.aufrufe.push({ weg: "vorschau", eingabe: e });
        const alle = eintraege(e);
        const pakete = [...new Set(alle.map((x) => x.an))].map((an) => {
          const meine = alle.filter((x) => x.an === an);
          const wirkung = { beitrag: 0, entwurf: 0, luecke: 0, pruefaufgabe: 0 } as Record<
            string,
            number
          >;
          for (const x of meine) {
            wirkung[x.art] = (wirkung[x.art] ?? 0) + 1;
          }
          return {
            an: { id: an, name: name(an), role: null },
            anzahl: meine.length,
            eintraege: meine.map((x) => ({ ...x, anName: name(an) })),
            bereitsErledigt: 0,
            wirkung,
          };
        });
        const offen = 6 - alle.length;
        return {
          person: bestand.person,
          umfang: e.umfang,
          vorher: bilanzVorher,
          prognose: offen === 0 ? NULL : { ...NULL, luecken: offen },
          pakete,
          abgelehnt: [],
          nichtZugeteilt: [],
          ausgeschlossen: { entwuerfe: [{ id: "d-alt" }], luecken: [], pruefaufgaben: [] },
          zugang: {
            jetzt: "aktiv",
            entscheidung: e.zugang,
            danach: e.zugang === "beenden" && offen === 0 ? "abgelaufen" : "aktiv",
          },
          vertretung: bestand.vertretung,
          hindernisse: offen === 0 ? [] : ["NICHT_ZUGETEILT"],
          bestaetigbar: offen === 0,
          unveraendert: ["autorschaft", "freigabe", "historie", "rolle", "spacezugang"],
        };
      },
      ablauf: async (e: Eingabe) => {
        netz.aufrufe.push({ weg: "ablauf", eingabe: e });
        const alle = eintraege(e).map((x) => ({ ...x, anName: name(x.an) }));
        const erster = netz.teilfehler;
        netz.teilfehler = false;
        const offen = erster ? alle.filter((x) => x.id === "a2") : [];
        const ergebnis = {
          person: bestand.person,
          umfang: e.umfang,
          vorher: erster ? bilanzVorher : { ...NULL, beitraege: 1 },
          nachher: erster ? { ...NULL, beitraege: 1 } : NULL,
          nachfolger: [],
          uebertragen: alle.filter((x) => (x.id === "a2") !== erster),
          bereitsErledigt: erster ? [] : alle.filter((x) => x.id !== "a2"),
          offen: offen.map((x) => ({ ...x, grund: "SCHREIBFEHLER", text: "simulierter Fehler" })),
          zugang: {
            vorher: "aktiv",
            nachher: erster ? "aktiv" : "abgelaufen",
            entscheidung: e.zugang,
            beendet: !erster,
            grund: erster ? "Bei der Person liegt noch 1 Beitrag." : null,
          },
          vollstaendig: !erster,
          protokolliert: true,
        };
        netz.ablaeufe.unshift({
          seq: netz.ablaeufe.length + 1,
          at: "2026-10-09T10:00:00.000Z",
          actor: { id: "ada", name: "Ada Admin" },
          umfang: e.umfang,
          vorher: ergebnis.vorher,
          nachher: ergebnis.nachher,
          nachfolger: [{ an: "nora", beitraege: 2, vorgaenge: 1, name: "Nora Nachfolge" }],
          uebertragen: ergebnis.uebertragen.length,
          bereitsErledigt: ergebnis.bereitsErledigt.length,
          offen: ergebnis.offen,
          zugang: ergebnis.zugang,
          vollstaendig: ergebnis.vollstaendig,
        });
        return ergebnis;
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { UebergabeEinstieg } from "../../apps/web/src/components/UebergabeAblauf";
import i18n from "../../apps/web/src/i18n";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
};

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();
const q = (id: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const alle = (id: string): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`),
];

async function klicken(e: Element | null): Promise<void> {
  expect(e, "Bedienelement fehlt").not.toBeNull();
  await act(async () => {
    (e as HTMLElement).click();
  });
  await flush();
}

async function waehlen(id: string, wert: string): Promise<void> {
  const feld = q(id) as HTMLSelectElement | null;
  expect(feld, `Auswahl ${id} fehlt`).not.toBeNull();
  await act(async () => {
    (feld as HTMLSelectElement).value = wert;
    (feld as HTMLSelectElement).dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

async function anhaken(art: string, id: string): Promise<void> {
  const zeile = container.querySelector(
    `[data-testid="ablauf-zeile"][data-art="${art}"][data-id="${id}"]`,
  );
  await klicken(zeile?.querySelector('[data-testid="ablauf-auswahl"]') ?? null);
}

function Rahmen(): JSX.Element {
  const [offen, setOffen] = useState(false);
  return createElement(UebergabeEinstieg, {
    personId: "paula",
    personName: "Paula Abgang",
    gezieltOffen: offen,
    onGezieltOffen: setOffen,
  });
}

beforeEach(async () => {
  netz.aufrufe.length = 0;
  netz.ablaeufe.length = 0;
  netz.teilfehler = false;
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await i18n.changeLanguage("de");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: qc }, createElement(Rahmen)));
  });
  await flush();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Nora: beide Beiträge und den Entwurf; Otto: den Rest (vertraulicher Beitrag, Lücke, Prüfaufgabe). */
async function verteilen(): Promise<void> {
  await anhaken("beitrag", "a1");
  await anhaken("beitrag", "a2");
  await anhaken("entwurf", "d-offen");
  await waehlen("ablauf-ziel", "nora");
  await klicken(q("ablauf-zuteilen"));
  await waehlen("ablauf-ziel", "otto");
  await klicken(q("ablauf-rest"));
}

describe("K1 · ein Einstieg, zwei Umfänge — nie zwei Nachfolgerformulare", () => {
  it("beide Umfänge sind erklärt; geöffnet ist jeweils nur einer", async () => {
    const einstieg = q("uebergabe-einstieg");
    expect(text(einstieg?.querySelector('[data-umfang="gezielt"]') ?? null)).toBe(
      i18n.t("uebergabeablauf.gezielt"),
    );
    expect(text(einstieg?.querySelector('[data-umfang="ausscheiden"]') ?? null)).toBe(
      i18n.t("uebergabeablauf.ausscheiden"),
    );
    // Geschlossen: kein Nachfolgerfeld, zwei Einstiege.
    expect(container.querySelectorAll("select")).toHaveLength(0);
    expect(q("verantwortung-oeffnen")).not.toBeNull();
    expect(q("ablauf-oeffnen")).not.toBeNull();

    // Ausscheiden geöffnet: die gezielte Fläche verschwindet, es gibt genau EIN Nachfolgerfeld.
    await klicken(q("ablauf-oeffnen"));
    expect(q("ablauf-flaeche")).not.toBeNull();
    expect(q("verantwortung-bereich")).toBeNull();
    expect(alle("ablauf-zeile").map((z) => z.getAttribute("data-art"))).toEqual([
      "beitrag",
      "beitrag",
      "beitrag",
      "entwurf",
      "luecke",
      "pruefaufgabe",
    ]);
    expect(container.querySelectorAll("select")).toHaveLength(1);

    // Abbrechen, dann die gezielte Übergabe: die Ausscheidensfläche ist weg, wieder EIN Feld.
    await klicken(q("ablauf-abbrechen"));
    await klicken(q("verantwortung-oeffnen"));
    expect(q("verantwortung-flaeche")).not.toBeNull();
    expect(q("ablauf-oeffnen")).toBeNull();
    expect(q("ablauf-flaeche")).toBeNull();
    expect(container.querySelectorAll("select").length).toBeLessThanOrEqual(1);
  });
});

describe("K2/K5 · Vorschau, Rechtewirkung, Zugang", () => {
  it("unvollständig ist nicht bestätigbar; vollständig zeigt zwei Pakete mit Rechtewirkung", async () => {
    await klicken(q("ablauf-oeffnen"));
    // K5: beide Zugangswege getrennt erklärt, die Vertretung benannt.
    expect(text(q("ablauf-zugang-beenden-erklaerung"))).toBe(
      i18n.t("uebergabeablauf.zugang.beendenErklaerung"),
    );
    expect(text(q("ablauf-zugang-sperren-erklaerung"))).toBe(
      i18n.t("uebergabeablauf.zugang.sperrenErklaerung"),
    );
    expect(text(q("ablauf-vertretung"))).toContain("Ada Admin, Otto Controller");

    // Eine Prüfaufgabe bietet nur an, wer prüfen darf: Nora fehlt.
    await anhaken("pruefaufgabe", "p1");
    const angebot = [...(q("ablauf-ziel")?.querySelectorAll("option") ?? [])].map((o) => o.value);
    expect(angebot).toEqual(["", "ada", "otto"]);
    await anhaken("pruefaufgabe", "p1");

    await anhaken("beitrag", "a1");
    await waehlen("ablauf-ziel", "nora");
    await klicken(q("ablauf-zuteilen"));
    await klicken(q("ablauf-vorschau-holen"));
    expect(q("ablauf-vorschau")?.getAttribute("data-bestaetigbar")).toBe("nein");
    expect(text(q("ablauf-hindernisse"))).toContain(
      i18n.t("uebergabeablauf.hindernis.NICHT_ZUGETEILT"),
    );
    expect((q("ablauf-bestaetigen") as HTMLButtonElement).disabled).toBe(true);

    await klicken(q("ablauf-verwerfen"));
    await verteilen();
    expect(text(q("ablauf-stand"))).toBe("6 von 6 zugeteilt");
    await klicken(q("ablauf-zugang-beenden"));
    await klicken(q("ablauf-vorschau-holen"));
    const vorschau = q("ablauf-vorschau");
    expect(vorschau?.getAttribute("data-bestaetigbar")).toBe("ja");
    const pakete = alle("ablauf-paket");
    expect(pakete.map((p) => [p.getAttribute("data-an"), p.getAttribute("data-anzahl")])).toEqual([
      ["nora", "3"],
      ["otto", "3"],
    ]);
    expect(text(pakete[0] ?? null)).toContain(
      i18n.t("uebergabeablauf.wirkung.entwurf", { anzahl: 1 }),
    );
    expect(text(pakete[1] ?? null)).toContain(
      i18n.t("uebergabeablauf.wirkung.pruefaufgabe", { anzahl: 1 }),
    );
    expect(text(q("ablauf-unveraendert"))).toBe(i18n.t("uebergabeablauf.unveraendert"));
    expect(text(q("ablauf-ausgeschlossen"))).toContain("1 Entwürfe im Papierkorb");
    expect(q("ablauf-prognose")?.getAttribute("data-beitraege")).toBe("0");
    expect(text(q("ablauf-zugang-plan"))).toBe(
      i18n.t("uebergabeablauf.zugangPlan", {
        jetzt: i18n.t("uebergabe.zugang.aktiv"),
        danach: i18n.t("uebergabe.zugang.abgelaufen"),
      }),
    );
    expect((q("ablauf-bestaetigen") as HTMLButtonElement).disabled).toBe(false);

    // Eine Änderung nach der Vorschau lässt sie verfallen — bestätigt wird nie ein alter Plan.
    await klicken(q("ablauf-zugang-behalten"));
    expect(q("ablauf-vorschau")).toBeNull();
  });
});

describe("K4/K6 · Teilfehler, Wiederaufnahme, Bilanz und Abbruch", () => {
  it("Teilfehler nennt Offenes; Wiederaufnahme schickt dieselbe Eingabe; die Bilanz kommt vom Server", async () => {
    expect(text(q("ablauf-letzte-bilanz"))).toContain(i18n.t("uebergabeablauf.letzte.keine"));
    netz.teilfehler = true;
    await klicken(q("ablauf-oeffnen"));
    await verteilen();
    await klicken(q("ablauf-zugang-beenden"));
    await klicken(q("ablauf-vorschau-holen"));
    await klicken(q("ablauf-bestaetigen"));

    const ergebnis = q("ablauf-ergebnis");
    expect(ergebnis?.getAttribute("data-vollstaendig")).toBe("nein");
    expect(alle("ablauf-offen")[0]?.querySelector("[data-id]")?.getAttribute("data-id")).toBe("a2");
    expect(q("ablauf-ergebnis-zugang")?.getAttribute("data-zugang")).toBe("aktiv");
    expect(q("ablauf-ergebnis-nachher")?.getAttribute("data-beitraege")).toBe("1");

    await klicken(q("ablauf-wiederaufnehmen"));
    const laeufe = netz.aufrufe.filter((a) => a.weg === "ablauf");
    expect(laeufe).toHaveLength(2);
    expect(laeufe[1]?.eingabe).toEqual(laeufe[0]?.eingabe);
    expect(q("ablauf-ergebnis")?.getAttribute("data-vollstaendig")).toBe("ja");
    expect(q("ablauf-ergebnis-zugang")?.getAttribute("data-zugang")).toBe("abgelaufen");

    // Die Bilanz unten kommt aus dem (simulierten) Prüfprotokoll, nicht aus dem Zustand der Fläche.
    const bilanz = q("ablauf-letzte-bilanz");
    expect(text(bilanz)).toContain("Nora Nachfolge: 2 Beiträge, 1 Vorgänge");
    expect(bilanz?.querySelector("[data-vollstaendig]")?.getAttribute("data-vollstaendig")).toBe(
      "ja",
    );
  });

  it("Abbrechen nach der Vorschau sendet nichts und schließt die Fläche", async () => {
    await klicken(q("ablauf-oeffnen"));
    await verteilen();
    await klicken(q("ablauf-zugang-beenden"));
    await klicken(q("ablauf-vorschau-holen"));
    expect(q("ablauf-vorschau")).not.toBeNull();
    await klicken(q("ablauf-abbrechen"));
    expect(q("ablauf-flaeche")).toBeNull();
    expect(netz.aufrufe.map((a) => a.weg)).toEqual(["vorschau"]);
    // Wieder geöffnet beginnt der Plan leer.
    await klicken(q("ablauf-oeffnen"));
    expect(text(q("ablauf-stand"))).toBe("0 von 6 zugeteilt");
  });
});
