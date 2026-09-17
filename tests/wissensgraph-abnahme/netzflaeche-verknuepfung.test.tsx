// @vitest-environment jsdom
// ================================================================================================
// JOB 4155 · WG-LUECKEN — L4: „KEINE KANTE" HEISST AUF DER FLÄCHE NIE „GEPRÜFT KONFLIKTFREI".
// ================================================================================================
//
// Der verbindliche API-Vertrag des Themas (`jobs/4151/HINWEIS.md`, „Fachliche Grenzen") sagt es
// wörtlich: **„keine Kante" heisst nie „geprueft konfliktfrei"**. Am Server ist das eine
// Zurückhaltung — die Ebene gibt Zahlen aus und kein Urteil. An der FLÄCHE ist es eine
// Bringschuld: wer eine niedrige Verknüpfungszahl sieht und keinen Satz daneben, liest sie als
// Mangel; wer eine hohe sieht, liest sie als Prüfsiegel. Beides wäre eine Aussage, die diese
// Ebene nicht treffen darf.
//
// UND DIE ZWEITE, SCHÄRFERE ZUSAGE: Hat der Server die Zähler AUSGELASSEN, steht auf der Fläche
// der GRUND und NIRGENDS eine Verknüpfungszahl. Eine 0 wäre hier die gefährlichste Antwort, weil
// sie aussieht wie ein Messergebnis.
//
// Bauform wie `tests/wissensnetz-sichtmetrik/flaeche.test.tsx`: jsdom, relative Importe über
// `../../apps/web/node_modules/…`, gehoisteter endpoints-Mock. Die Endpointgrenze ist die einzige
// Attrappe — Seite, i18n, React-Query und Router sind echt.
import { afterEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => {
  const antwort = { wert: null as unknown };
  return {
    antwort,
    luecken: vi.fn(async () => antwort.wert),
    search: vi.fn(async () => []),
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { wissensnetz: { luecken: d.luecken }, library: { search: d.search } },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Wissensnetz } from "../../apps/web/src/pages/Wissensnetz";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;
let steht = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function abbauen(): void {
  if (!steht) {
    return;
  }
  act(() => root.unmount());
  container.remove();
  steht = false;
}

async function mount(): Promise<void> {
  abbauen();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/wissensnetz"] },
          createElement(Wissensnetz),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  steht = true;
}

afterEach(() => {
  abbauen();
  qc?.clear();
  i18n.changeLanguage("de");
});

const THEMENKARTE = {
  themen: [{ thema: "ventil", objekte: 5, farbe: "belegt", ohneKanten: false }],
  kanten: [],
  weitere: [],
  weitereAbgeschnitten: false,
  mindesthaeufigkeit: 1,
  unterdruecktDurchUbiquitaet: 0,
};

/** Die Antwort MIT erhobenen Zählern. */
function erhoben(): unknown {
  return {
    objekteGesamt: 5,
    ohneThema: 0,
    sichtbareBeitragendeGesamt: 2,
    themen: [
      {
        thema: "ventil",
        objekte: 5,
        sichtbareBeitragende: 2,
        beitragendeAbgeschnitten: false,
        verknuepft: 2,
        unverknuepft: 3,
      },
    ],
    themenkarte: THEMENKARTE,
    verknuepfungAusgelassen: false,
  };
}

/** Die Antwort MIT Auslassung: Schalter und Grund, und die Zähler fehlen ganz. */
function ausgelassen(grund: "kein-kantenport" | "zu-viele-objekte"): unknown {
  return {
    objekteGesamt: 5,
    ohneThema: 0,
    sichtbareBeitragendeGesamt: 2,
    themen: [
      { thema: "ventil", objekte: 5, sichtbareBeitragende: 2, beitragendeAbgeschnitten: false },
    ],
    themenkarte: THEMENKARTE,
    verknuepfungAusgelassen: true,
    verknuepfungAusgelassenGrund: grund,
  };
}

const eins = (marke: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${marke}"]`);
const flaechenText = (): string => (container.textContent ?? "").replace(/\s+/g, " ");

describe("JOB 4155 · L4 — der Grundsatz steht, und bei Auslassung steht keine Zahl", () => {
  it("mit erhobenen Zählern: die Zahlen stehen in der Themenzeile UND der Grundsatz daneben", async () => {
    d.antwort.wert = erhoben();
    await mount();

    const zeile = eins("metrik-thema-verknuepfung");
    expect(zeile, "die Verknüpfungszahlen erscheinen nicht").not.toBeNull();
    expect((zeile as HTMLElement).textContent ?? "").toBe(
      i18n.t("wissensnetz.lesen.verknuepfung", { verknuepft: 2, unverknuepft: 3 }),
    );

    const grundsatz = eins("netz-verknuepfung-grundsatz");
    expect(grundsatz, "der Grundsatz fehlt").not.toBeNull();
    expect((grundsatz as HTMLElement).textContent ?? "").toBe(
      i18n.t("wissensnetz.verknuepfung.grundsatz"),
    );
    // Kein Auslassungssatz, solange nichts ausgelassen wurde — er wäre eine Aussage über nichts.
    expect(eins("netz-verknuepfung-ausgelassen")).toBeNull();
  });

  // ==============================================================================================
  // DER KERN VON L4: bei Auslassung der GRUND — und NIRGENDS eine Verknüpfungszahl.
  // ==============================================================================================
  for (const grund of ["kein-kantenport", "zu-viele-objekte"] as const) {
    it(`Auslassung „${grund}": der Grund steht als Satz, und es steht keine Zahl dazu`, async () => {
      d.antwort.wert = ausgelassen(grund);
      await mount();

      const satz = eins("netz-verknuepfung-ausgelassen");
      expect(satz, "der Grund der Auslassung wird verschwiegen").not.toBeNull();
      expect((satz as HTMLElement).textContent ?? "").toBe(
        i18n.t(`wissensnetz.verknuepfung.ausgelassen.${grund}`),
      );
      // Der Grundsatz steht AUCH hier: er spricht über die Bedeutung einer fehlenden Beziehung,
      // nicht über den Erhebungsstand.
      expect(eins("netz-verknuepfung-grundsatz")).not.toBeNull();

      // DIE GEGENPROBE: keine Verknüpfungszahl, nirgends. Weder als Zeile noch als stille 0.
      expect(
        eins("metrik-thema-verknuepfung"),
        "eine ausgelassene Erhebung erscheint als Zahl",
      ).toBeNull();
      expect(flaechenText()).not.toContain(
        i18n.t("wissensnetz.lesen.verknuepfung", { verknuepft: 0, unverknuepft: 5 }),
      );
    });
  }

  it("ein Server OHNE die Erweiterung: der Grundsatz steht, aber nichts behauptet eine Erhebung", async () => {
    // Weder `verknuepfungAusgelassen` noch Zähler — die Antwort sagt zu Beziehungen gar nichts.
    d.antwort.wert = {
      objekteGesamt: 5,
      ohneThema: 0,
      sichtbareBeitragendeGesamt: 2,
      themen: [
        { thema: "ventil", objekte: 5, sichtbareBeitragende: 2, beitragendeAbgeschnitten: false },
      ],
      themenkarte: THEMENKARTE,
    };
    await mount();

    expect(eins("netz-verknuepfung-grundsatz")).not.toBeNull();
    expect(eins("metrik-thema-verknuepfung")).toBeNull();
    // KEIN Auslassungssatz: „ausgelassen" wäre eine Auskunft, die diese Antwort nicht gibt.
    expect(eins("netz-verknuepfung-ausgelassen")).toBeNull();
  });

  // ==============================================================================================
  // DE/EN/NL — der Satz steht in jeder Sprache, die `i18n.ts` führt, und in keiner fehlt er.
  // ==============================================================================================
  //
  // Ohne diesen Fall stünde die Ehrlichkeitsauflage auf Deutsch da und auf Englisch der ROHE
  // SCHLÜSSEL — i18next gibt bei fehlendem Eintrag den Schlüsselnamen aus, und der sieht im DOM
  // aus wie Text. Genau so verschwindet eine Zusage unbemerkt.
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`${sprache}: der Grundsatz steht am DOM und ist kein roher Schlüssel`, async () => {
      d.antwort.wert = erhoben();
      await i18n.changeLanguage(sprache);
      await mount();

      const text = (eins("netz-verknuepfung-grundsatz") as HTMLElement).textContent ?? "";
      expect(text.length, `der Grundsatz fehlt in ${sprache}`).toBeGreaterThan(40);
      expect(text, "der Schlüssel steht statt des Satzes da").not.toContain(
        "wissensnetz.verknuepfung",
      );
      expect(text).toBe(i18n.t("wissensnetz.verknuepfung.grundsatz"));
    });
  }
});
