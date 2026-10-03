// @vitest-environment jsdom
// ================================================================================================
// R-0801 / R-1013 · DER ECHTE EINSTIEG `main.tsx` ZEIGT EINE LADEFLÄCHE, SOLANGE DIE STARTSPRACHE
// NACHGELADEN WIRD — UND BAUT DANACH DIE ANWENDUNG AUF (ben, Nacharbeit 3, F1).
// ================================================================================================
//
// DER BEFUND. Seit en und nl nachgeladen werden, wartete `main.tsx` mit `createRoot` auf
// `sprachBereit`. Bei gespeicherter Wahl en/nl oder `?lang=en` blieb `#root` (index.html) so lange
// LEER — keine Ladefläche, keine Fehlergrenze. Die vorhandenen Splash-Tests prüfen den Rückfall
// INNERHALB von React und erreichen diese Phase vor `createRoot` nicht.
//
// WIE HIER GEPRÜFT WIRD. `apps/web/src/main.tsx` wird WIRKLICH importiert, gegen ein leeres
// `#root`, und montiert mit dem echten React. Ersetzt sind genau drei Modulränder:
//   · `i18n`   — durch ein ECHTES i18next mit dem ECHTEN Nachlader (`lib/sprachNachlader.ts`) und
//                genau dem Aufbau aus `i18n.ts` (Deutsch im Start, en/nl über den Nachlader,
//                `partialBundledLanguages`). Nur die Pakete selbst sind kleine Wörterbücher, deren
//                Eintreffen der Test steuert: AUSSTEHEND, ERFÜLLT oder ABGELEHNT. `sprachBereit` ist
//                damit kein nachgebautes Versprechen, sondern das `init` von i18next selbst.
//   · `App`    — durch eine Markierung, die über `useTranslation` übersetzt. Sie belegt den
//                Anwendungsaufbau und die Sprache, in der er geschieht; die echte `App` braucht
//                Server und Anmeldung und ist hier nicht der Gegenstand.
//   · `brandTheme` — ruft beim Start `/api/branding`; hier ohne Netz stillgelegt.
//
// GEGEN DEN BISHERIGEN STAND (`createRoot` erst nach `sprachBereit`) scheitern E1 und E2 an der
// ersten Zusicherung: solange das Paket aussteht, ist `#root` leer.
import { afterEach, describe, expect, it, vi } from "vitest";
import { SPRACHE_STORAGE_KEY } from "../../apps/web/src/lib/sprachwahl";

type Paket = Record<string, string>;

const steuer = vi.hoisted(() => {
  const DEUTSCH: Record<string, string> = {
    "state.loading": "Lädt …",
    marke: "Anwendung bereit",
  };
  return {
    DEUTSCH,
    sprache: "de",
    gefragt: [] as string[],
    lader: (_sprache: string): Promise<Record<string, string>> | undefined => undefined,
  };
});

vi.mock("../../apps/web/src/i18n", async () => {
  const { createInstance } = await import("../../apps/web/node_modules/i18next");
  const { initReactI18next } = await import("../../apps/web/node_modules/react-i18next");
  const { sprachNachlader } = await import("../../apps/web/src/lib/sprachNachlader");
  const i18n = createInstance();
  const sprachBereit = i18n
    .use(
      sprachNachlader((sprache) => {
        steuer.gefragt.push(sprache);
        return steuer.lader(sprache);
      }),
    )
    .use(initReactI18next)
    .init({
      lng: steuer.sprache,
      fallbackLng: "de",
      partialBundledLanguages: true,
      resources: { de: { translation: steuer.DEUTSCH } },
      interpolation: { escapeValue: false },
    });
  return { default: i18n, sprachBereit };
});

vi.mock("../../apps/web/src/App", async () => {
  const { createElement } = await import("../../apps/web/node_modules/react");
  const { useTranslation } = await import("../../apps/web/node_modules/react-i18next");
  function App(): unknown {
    const { t, i18n } = useTranslation();
    return createElement(
      "p",
      { "data-testid": "app-montiert", "data-sprache": i18n.language },
      t("marke"),
    );
  }
  return { default: App };
});

vi.mock("../../apps/web/src/lib/brandTheme", () => ({ initBrandTheme: () => {} }));

interface Steuerbar {
  versprechen: Promise<Paket>;
  erfuellen: (paket: Paket) => void;
  ablehnen: (fehler: Error) => void;
}

function steuerbar(): Steuerbar {
  let erfuellen: (paket: Paket) => void = () => {};
  let ablehnen: (fehler: Error) => void = () => {};
  const versprechen = new Promise<Paket>((ja, nein) => {
    erfuellen = ja;
    ablehnen = nein;
  });
  return { versprechen, erfuellen, ablehnen };
}

/** Startet den ECHTEN Einstieg gegen ein leeres `#root` — wie der Browser `index.html` lädt. */
async function starteEinstieg(sprache: string, paket?: Steuerbar): Promise<HTMLElement> {
  vi.resetModules();
  steuer.sprache = sprache;
  steuer.gefragt = [];
  steuer.lader = (gefragt) => (gefragt === sprache && paket ? paket.versprechen : undefined);
  document.body.innerHTML = '<div id="root"></div>';
  const wurzel = document.getElementById("root") as HTMLElement;
  expect(wurzel.childNodes.length, "Vorbedingung: `#root` ist leer wie in index.html").toBe(0);
  await import("../../apps/web/src/main");
  return wurzel;
}

const montiert = (wurzel: HTMLElement): HTMLElement | null =>
  wurzel.querySelector<HTMLElement>('[data-testid="app-montiert"]');

afterEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = "";
});

describe("main.tsx · Ladefläche statt leerer Wurzel, solange die Startsprache nachlädt", () => {
  for (const [sprache, text] of [
    ["en", "Application ready"],
    ["nl", "Applicatie klaar"],
  ] as const) {
    it(`E ${sprache}: sichtbare Ladefläche bis zum Paket, danach die Anwendung auf ${sprache}`, async () => {
      const paket = steuerbar();
      const wurzel = await starteEinstieg(sprache, paket);

      // 1. SOLANGE DAS PAKET AUSSTEHT: eine sichtbare Ladefläche — nicht die leere Wurzel. Ihr Text
      //    kommt aus dem deutschen Wörterbuch im Eintritt; sie braucht das ausstehende Paket nicht.
      await vi.waitFor(() => {
        expect(wurzel.textContent, "`#root` bleibt leer, solange das Paket aussteht").toBe(
          "Lädt …",
        );
      });
      expect(steuer.gefragt, `das Paket ${sprache} wurde angefordert`).toContain(sprache);
      expect(montiert(wurzel), "die Anwendung darf vor dem Paket nicht stehen").toBeNull();

      // 2. DAS PAKET TRIFFT EIN: die Anwendung steht, in der Startsprache, die Ladefläche ist weg.
      paket.erfuellen({ "state.loading": "…", marke: text });
      await vi.waitFor(() => {
        expect(montiert(wurzel)?.textContent).toBe(text);
      });
      expect(montiert(wurzel)?.getAttribute("data-sprache")).toBe(sprache);
      expect(wurzel.textContent, "die Ladefläche ist verschwunden").not.toContain("Lädt …");

      // 3. Die Sprachpersistenz hört erst NACH der Initialisierung zu: der Start schreibt nichts.
      expect(window.localStorage.getItem(SPRACHE_STORAGE_KEY)).toBeNull();
    });
  }

  it("E nl abgelehnt: Ladefläche, dann die Anwendung über den deutschen Rückfall — kein Abbruch", async () => {
    const paket = steuerbar();
    const wurzel = await starteEinstieg("nl", paket);
    await vi.waitFor(() => {
      expect(wurzel.textContent).toBe("Lädt …");
    });

    paket.ablehnen(new Error("Netz weg"));
    await vi.waitFor(() => {
      expect(montiert(wurzel), "nach dem Fehlschlag muss die Anwendung stehen").not.toBeNull();
    });
    // i18next hat seinen Rückfall abgeschlossen: die Sprache ist nl, die Texte kommen aus `de`.
    expect(montiert(wurzel)?.getAttribute("data-sprache")).toBe("nl");
    expect(montiert(wurzel)?.textContent).toBe("Anwendung bereit");
    expect(wurzel.textContent).not.toContain("Lädt …");
  });

  it("E de: die Anwendung steht ohne Nachladen", async () => {
    const wurzel = await starteEinstieg("de");
    await vi.waitFor(() => {
      expect(montiert(wurzel)?.textContent).toBe("Anwendung bereit");
    });
    expect(steuer.gefragt, "für Deutsch wird nichts nachgeladen").toEqual([]);
  });
});
