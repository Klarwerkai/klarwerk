// @vitest-environment jsdom
// ================================================================================================
// JOB 4224 · D5 — DIE DOM-HÄLFTE: WAS EIN MENSCH AUF DER ECHTEN FRAGENFLÄCHE WIRKLICH ÖFFNEN KANN
// ================================================================================================
//
// `beleg-fuehrt-zum-original.test.ts` misst die Kette bis zur Ableitung und bis zu den Rohbytes.
// Diese Datei misst, was davon AUF DEM BILDSCHIRM ankommt: die echte Seite `pages/Ask.tsx` mit
// ihren echten Providern, dem echten Client (`api/endpoints`), der echten App dahinter und dem
// kontrollierten Modelladapter an der Modellkante (`kette.ts`). Damit darf weder eine reale
// semantische Antwortqualität noch eine Microsoft-365-Host-Abnahme behauptet werden.
//
// WARUM `.tsx` UND NICHT `.test.ts`: der Wurzel-Typcheck ist Node-rein (`tsconfig.json`,
// `lib: ["ES2022"]`, `exclude: tests/**/*.tsx`); gemountete Fälle brauchen die DOM-Bibliothek und
// laufen über `tsconfig.tests-tsx.json`. Ein DOM-Fall in einer `.ts` wäre im Tor ein Typfehler.
//
// WO DIE QUELLENLISTE STEHT (gelesen, nicht angenommen): die vollständige Quellenliste mit
// `AnswerSourceDetails` hängt seit JOB 3064 im Seitenblatt „Mehr" (`Ask.tsx`, „…" → „Mehr"). Die
// Fälle öffnen es deshalb über genau die Bedienung, die ein Mensch benutzt.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  type Aufbau,
  type Draht,
  ORIGINALNAME,
  ORIGINALTEXT,
  QUELLENBEZEICHNUNG,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "./kette";

adapterUmgebungSetzen();

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";
import { FRAGE } from "./kette";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

beforeAll(async () => {
  await i18n.changeLanguage("de");
  draht = drahtAufbauen();
});

afterAll(() => {
  draht.abbauen();
});

afterEach(async () => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.lage.generierungen = 0;
  draht.lage.vorlagen.length = 0;
});

async function seiteOeffnen(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/fragen"] }, createElement(Ask)),
            ),
          ),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
}

async function absenden(text: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>("form input");
  expect(input, "kein Fragefeld auf der Fläche").not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, text);
    (input as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
  const knopf = container.querySelector<HTMLButtonElement>("form button[type=submit]");
  expect(knopf, "kein Absendeknopf").not.toBeNull();
  expect(
    (knopf as HTMLButtonElement).disabled,
    "ohne freigegebenen Knopf gäbe es nichts zu messen — die Frage wurde nie gestellt",
  ).toBe(false);
  await act(async () => {
    (knopf as HTMLButtonElement).click();
    await durchlaufen();
  });
  await act(durchlaufen);
}

/** „…" → „Mehr" — genau die Bedienung, mit der ein Mensch die volle Quellenliste öffnet. */
async function mehrOeffnen(): Promise<HTMLElement> {
  const menue = document.body.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]');
  expect(menue, 'das „…"-Menü der Antwortkarte fehlt').not.toBeNull();
  await act(async () => {
    (menue as HTMLButtonElement).click();
    await durchlaufen();
  });
  const punkt = document.body.querySelector<HTMLButtonElement>(
    '[data-testid="ask-menu-punkt-mehr"]',
  );
  expect(punkt, 'der Menüpunkt „Mehr" fehlt').not.toBeNull();
  await act(async () => {
    (punkt as HTMLButtonElement).click();
    await durchlaufen();
  });
  await act(durchlaufen);
  const blatt = document.body.querySelector<HTMLElement>('[data-testid="ask-mehr"]');
  expect(blatt, 'das Blatt „Mehr" ist nicht aufgegangen').not.toBeNull();
  return blatt as HTMLElement;
}

async function vorrichtung(): Promise<Aufbau> {
  const a = await appAufbauen();
  aufbau = a;
  draht.setzeApp(a.app);
  return a;
}

/** Als Leser anmelden — der Draht spricht danach mit dessen Sitzung. */
async function alsLeser(a: Aufbau): Promise<void> {
  const leser = await neuesKonto(a.app, "leser", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
}

describe("JOB 4224 · D5 · F — die Fläche führt bis zum Original", () => {
  it("F1 · die Antwortquelle bietet das hinterlegte Original mit seiner echten Adresse an", async () => {
    const a = await vorrichtung();
    const eintrag = await eintragMitOriginal(a.app, a.admin);
    await alsLeser(a);
    await seiteOeffnen();
    await absenden(FRAGE);

    expect(
      draht.lage.generierungen,
      "der kontrollierte Adapter wurde nicht befragt",
    ).toBeGreaterThan(0);
    const karte = document.body.querySelector('[data-testid="ask-answer"]');
    expect(
      karte,
      `keine Antwortkarte: ${(container.textContent ?? "").slice(0, 400)}`,
    ).not.toBeNull();

    const blatt = await mehrOeffnen();
    const originale = [
      ...blatt.querySelectorAll<HTMLAnchorElement>('[data-testid="answer-source-original"]'),
    ];
    expect(
      originale.length,
      `kein Weg zum Original auf der Fläche: ${blatt.textContent?.slice(0, 600)}`,
    ).toBeGreaterThan(0);

    // ============================================================================================
    // DER LINK MUSS AN DER QUELLE HÄNGEN, NICHT IRGENDWO IM BLATT.
    // ============================================================================================
    // GEMESSEN, NICHT VORSICHTSHALBER (Gegenprobe im Cloud-Lauf ce64e454…): mit gekappter
    // Belegverknüpfung blieb dieser Fall GRÜN, solange er nur „irgendein `answer-source-original`
    // trägt diese Adresse" verlangte — denn dann rutscht dasselbe Original in die Liste der
    // unverankerten Dateien und trägt dieselbe Adresse. Die Zusage dieses Auftrags ist aber, dass
    // die QUELLE der Antwort zu IHREM Original führt. Gemessen wird deshalb die Zeile: der Link
    // steht im selben Listeneintrag wie die Bezeichnung der Quelle.
    // Ausdrücklich INNERHALB des Originalblocks und nicht über alle `li` des Blatts: die
    // Quellenzeile der Fragenfläche ist selbst ein `li` und enthält den ganzen Block — ein `find`
    // über alle `li` träfe sie zuerst und wäre damit wieder die schwache Fassung von oben
    // (nachgemessen im Lauf ce64e454…).
    const block = blatt.querySelector<HTMLElement>('[data-testid="answer-source-originals"]');
    expect(block, "der Originalblock fehlt an der Quelle").not.toBeNull();
    const zeile = [...(block as HTMLElement).querySelectorAll<HTMLLIElement>("li")].find((li) =>
      (li.textContent ?? "").includes(QUELLENBEZEICHNUNG),
    );
    expect(
      zeile,
      `die Quelle „${QUELLENBEZEICHNUNG}" steht nicht als eigene Zeile im Blatt`,
    ).toBeDefined();
    const treffer = [
      ...(zeile as HTMLLIElement).querySelectorAll<HTMLAnchorElement>(
        '[data-testid="answer-source-original"]',
      ),
    ].find((el) => el.getAttribute("href") === `/api/objects/${eintrag.objectId}/raw`);
    expect(treffer, "die Quelle selbst führt nicht zu ihrem hinterlegten Original").toBeDefined();
    expect(treffer?.textContent ?? "").toContain(ORIGINALNAME);
    // Und die ehrliche Gegenaussage steht NICHT da, wenn es ein Original gibt.
    expect(blatt.querySelector('[data-testid="answer-source-no-original"]')).toBeNull();

    // ============================================================================================
    // DER BELEG WIRD GEÖFFNET, NICHT NUR GEFUNDEN.
    // ============================================================================================
    // Ein Link, den niemand abruft, ist eine Zusage ohne Deckung — genau die Fehlerklasse, gegen
    // die dieser Auftrag antritt. Die Adresse AUS DEM DOM geht deshalb über denselben Draht an die
    // echte Route, mit der Sitzung genau dieses Menschen. Was zurückkommt, muss der hinterlegte
    // Originalinhalt sein.
    const antwort = await fetch(treffer?.getAttribute("href") ?? "");
    expect(antwort.status, "das Original ist über die angebotene Adresse nicht abrufbar").toBe(200);
    expect(await antwort.text()).toBe(ORIGINALTEXT);
  });

  it("F2 · GEGENPROBE: ein Eintrag ohne Original sagt das ehrlich und erfindet keinen Beleg", async () => {
    const a = await vorrichtung();
    const ohne = await a.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: a.admin.kopf,
      payload: {
        title: "Zylinderkopfdichtung XQ42 wechseln",
        statement: "Die Zylinderkopfdichtung XQ42 wird vor dem Wechsel entlastet.",
        type: "best_practice",
        category: "Betrieb",
        confidentiality: "intern",
        neededValidations: 1,
      },
    });
    expect(ohne.statusCode, ohne.body).toBe(201);
    const koId = (ohne.json() as { id: string }).id;
    expect(
      (
        await a.app.inject({
          method: "PUT",
          url: `/api/kos/${koId}`,
          headers: a.admin.kopf,
          payload: { action: "admin-validate" },
        })
      ).statusCode,
    ).toBe(200);

    await alsLeser(a);
    await seiteOeffnen();
    await absenden(FRAGE);
    const blatt = await mehrOeffnen();

    expect(blatt.querySelector('[data-testid="answer-source-original"]')).toBeNull();
    const satz = blatt.querySelector('[data-testid="answer-source-no-original"]');
    expect(
      satz,
      `die Fläche sagt nicht, dass kein Original vorliegt: ${blatt.textContent?.slice(0, 600)}`,
    ).not.toBeNull();
    expect((satz?.textContent ?? "").trim().length).toBeGreaterThan(0);
    // Der Satz ist ein echter Satz und kein roher Programmschlüssel.
    expect(satz?.textContent ?? "").not.toContain("answerSource.");
  });

  it("F3 · nach dem Entzug steht auf der Fläche weder die Quelle noch ein Weg zum Original", async () => {
    const a = await vorrichtung();
    const eintrag = await eintragMitOriginal(a.app, a.admin);
    await alsLeser(a);
    await seiteOeffnen();
    await absenden(FRAGE);
    await mehrOeffnen();
    // Kalibrierung: vorher war der Weg da. Ohne sie misst F3 eine Fläche, die nie etwas zeigte.
    expect(
      document.body.querySelector('[data-testid="answer-source-original"]'),
      "vor dem Entzug gab es gar keinen Weg zum Original",
    ).not.toBeNull();

    const hoch = await a.app.inject({
      method: "PUT",
      url: `/api/kos/${eintrag.koId}`,
      headers: a.admin.kopf,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);

    // Dieselbe Frage erneut — eine Auffrischung, kein Themenwechsel.
    await absenden(FRAGE);
    await act(durchlaufen);
    const links = () => [
      ...document.body.querySelectorAll<HTMLAnchorElement>(
        '[data-testid="answer-source-original"]',
      ),
    ];
    const zeigtOriginal = () =>
      links().some((el) => el.getAttribute("href") === `/api/objects/${eintrag.objectId}/raw`);
    expect(zeigtOriginal(), "die Fläche bietet das Original der gesperrten Quelle weiter an").toBe(
      false,
    );
    // Die Antwort stützt sich nicht mehr auf den Eintrag: sie ist eine ehrliche Wissenslücke.
    expect(document.body.querySelector('[data-testid="ask-gap"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="ask-answer"]')).toBeNull();

    // ============================================================================================
    // DIE EHRLICHE GRENZE, GEMESSEN STATT VERSCHWIEGEN (Cloud-Lauf c4fd6b01…)
    // ============================================================================================
    // UNMITTELBAR nach dem Entzug stand der TITEL noch auf der Seite — nicht an der Antwort,
    // sondern an den Beispiel-Chips (`buildAskExampleChips` aus dem bereits geladenen Bestand,
    // `useKos()`). Das ist eine LOKALE KOPIE einer Liste, die dieser Mensch eine Sekunde vorher
    // lesen durfte; der Server gibt sie seit dem Entzug nicht mehr heraus
    // (`entzug-sperrt-die-quelle.test.ts` E2 misst genau das). Keine Kopfzeile und keine
    // Oberfläche kann eine schon ausgelieferte Kopie zurückholen — `object-routes.ts` sagt
    // denselben Satz über den Zwischenspeicher des Browsers.
    //
    // WAS DAGEGEN ZUGESAGT IST, und hier gemessen wird: beim nächsten Aufbau der Seite ist der
    // Eintrag weg — der Bestand wird frisch geholt, und der Server ist die Autorität.
    act(() => root?.unmount());
    container.remove();
    root = null;
    await seiteOeffnen();
    expect(
      document.body.textContent ?? "",
      "nach dem Neuaufbau steht der Titel der gesperrten Quelle weiter auf dem Bildschirm",
    ).not.toContain(eintrag.titel);
    expect(zeigtOriginal()).toBe(false);
  });

  // ================================================================================================
  // BEN R2, KORREKTURPFLICHT 1 — DER ENTZUG UND DER FEHLER ZUSAMMEN.
  // ================================================================================================
  //
  // BENS MESSUNG, wörtlich nachgestellt (sein Lauf 3608655f…): Rechteentzug wie in F3, dann ein
  // Serverfehler auf der Auffrischung. `Ask.tsx` behält bei GLEICHER Frage das stehende Ergebnis
  // (`onMutate`, „Cache mit laufender Auffrischung") — und damit blieb der Originalbeleg der
  // gesperrten Quelle als Weg angeboten: „die Fläche bietet das Original der gesperrten Quelle
  // weiter an: expected true to be false".
  //
  // WARUM DAS EIN FEHLER IST UND NICHT NUR EIN ALTER BILDSCHIRM: §9 des Auftrags sagt für den
  // Fehlerfall „Der Quellenstand ist UNBEKANNT" und für den gescheiterten Cache „kein stiller alter
  // Beleg als Tatsache … ein zwischenzeitlicher Rechteentzug darf NIE durch einen Cache überspielt
  // werden". Ein angebotener Link ist eine Aussage über das JETZT („das kannst du öffnen"). Die
  // Antwort selbst darf stehen bleiben — sie war einmal richtig; das ANGEBOT darf es nicht.
  //
  // WAS DIE FLÄCHE STATTDESSEN SAGEN MUSS, und was sie NICHT sagen darf: nicht „gesperrt" (das wäre
  // aus einem Fehler erfunden) und nicht „kein Original vorhanden" (das wäre eine Tatsache, die
  // niemand geprüft hat). Übrig bleibt die dritte, wahre Aussage: der Stand ist nicht bestätigt.
  // F6 misst, dass es wirklich drei verschiedene Sätze sind.
  it("F4 · Entzug UND gescheiterte Auffrischung: der Beleg wird nicht weiter angeboten", async () => {
    const a = await vorrichtung();
    const eintrag = await eintragMitOriginal(a.app, a.admin);
    await alsLeser(a);
    await seiteOeffnen();
    await absenden(FRAGE);
    const blatt = await mehrOeffnen();
    const zeigtOriginal = () =>
      [
        ...document.body.querySelectorAll<HTMLAnchorElement>(
          '[data-testid="answer-source-original"]',
        ),
      ].some((el) => el.getAttribute("href") === `/api/objects/${eintrag.objectId}/raw`);
    // Kalibrierung: vorher war der Weg da, und das Blatt ist offen.
    expect(zeigtOriginal(), "vor dem Entzug gab es gar keinen Weg zum Original").toBe(true);
    expect(blatt).not.toBeNull();

    const hoch = await a.app.inject({
      method: "PUT",
      url: `/api/kos/${eintrag.koId}`,
      headers: a.admin.kopf,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);

    // Dieselbe Frage erneut — und die Auffrischung scheitert unterwegs.
    draht.stoerungEinmal("/api/ask", 500);
    await absenden(FRAGE);
    await act(durchlaufen);

    // Die Antwort BLEIBT stehen (§9) — sie war einmal richtig …
    expect(
      document.body.querySelector('[data-testid="ask-answer"]'),
      "die alte Antwort ist verschwunden — §9 verlangt, dass sie stehen bleibt",
    ).not.toBeNull();
    // … und die Fläche sagt, dass die Auffrischung gescheitert ist.
    expect(
      document.body.querySelector('[data-testid="ask-auffrischung-fehlgeschlagen"]'),
    ).not.toBeNull();
    // ABER: der Beleg wird nicht mehr als Weg angeboten.
    expect(zeigtOriginal(), "die Fläche bietet das Original der gesperrten Quelle weiter an").toBe(
      false,
    );
    // Und sie sagt WARUM — nicht „gesperrt", nicht „kein Original", sondern „nicht bestätigt".
    const satz = document.body.querySelector('[data-testid="answer-source-original-unbestaetigt"]');
    expect(
      satz,
      `kein Hinweis auf den unbestätigten Quellenstand: ${document.body.textContent?.slice(0, 500)}`,
    ).not.toBeNull();
    expect((satz?.textContent ?? "").trim().length).toBeGreaterThan(0);
    expect(satz?.textContent ?? "").not.toContain("answerSource.");
  });

  it("F5 · GEGENFALL Berechtigter: derselbe Fehler erfindet keine Sperre — und der Weg kommt zurück", async () => {
    // Ohne diesen Fall wäre F4 auch dann grün, wenn die Fläche bei JEDEM Fehler den Beleg für immer
    // wegnähme. Hier wird NICHTS entzogen: nur die Auffrischung scheitert. Danach trägt derselbe
    // Weg wieder — der Fehler war eine Störung, keine Entscheidung über ein Recht.
    const a = await vorrichtung();
    const eintrag = await eintragMitOriginal(a.app, a.admin);
    await alsLeser(a);
    await seiteOeffnen();
    await absenden(FRAGE);
    await mehrOeffnen();
    const zeigtOriginal = () =>
      [
        ...document.body.querySelectorAll<HTMLAnchorElement>(
          '[data-testid="answer-source-original"]',
        ),
      ].some((el) => el.getAttribute("href") === `/api/objects/${eintrag.objectId}/raw`);
    expect(zeigtOriginal()).toBe(true);

    draht.stoerungEinmal("/api/ask", 500);
    await absenden(FRAGE);
    await act(durchlaufen);

    // Auch für den Berechtigten wird der Beleg nicht als bestätigt ausgegeben — der Stand ist
    // unbekannt, und das hängt nicht am Recht, sondern an der Leitung.
    expect(zeigtOriginal()).toBe(false);
    expect(
      document.body.querySelector('[data-testid="answer-source-original-unbestaetigt"]'),
    ).not.toBeNull();
    // Und es wird KEINE Sperre erfunden: nirgends steht, die Quelle sei entzogen oder nicht da.
    expect(document.body.querySelector('[data-testid="answer-source-no-original"]')).toBeNull();

    // Die nächste Auffrischung kommt durch — und der Weg ist wieder da.
    await absenden(FRAGE);
    await act(durchlaufen);
    expect(
      document.body.querySelector('[data-testid="ask-auffrischung-fehlgeschlagen"]'),
      "der Fehlerhinweis steht noch, obwohl die Auffrischung durchkam",
    ).toBeNull();
    expect(zeigtOriginal(), "nach der geglückten Auffrischung fehlt der Weg zum Original").toBe(
      true,
    );
    expect(
      document.body.querySelector('[data-testid="answer-source-original-unbestaetigt"]'),
    ).toBeNull();
  });

  it("F6 · die drei Lagen tragen DREI verschiedene Sätze — keiner wird für den anderen benutzt", async () => {
    // „Es gibt ein Original", „es gibt keines" und „der Stand ist nicht bestätigt" sind drei
    // verschiedene Aussagen. Fielen zwei davon auf denselben Satz, könnte die Fläche aus einem
    // Fehler eine Tatsache machen — genau die Verwechslung, gegen die dieser Auftrag antritt.
    const angeboten = i18n.t("answerSource.originalFile");
    const keines = i18n.t("answerSource.noOriginal");
    const unbestaetigt = i18n.t("answerSource.originalUnconfirmed");
    for (const satz of [angeboten, keines, unbestaetigt]) {
      expect(satz.trim().length, "ein leerer Satz ist keine Aussage").toBeGreaterThan(0);
      expect(satz, "roher Programmschlüssel statt Satz").not.toContain("answerSource.");
    }
    expect(new Set([angeboten, keines, unbestaetigt]).size).toBe(3);
    // Und der unbestätigte Stand behauptet weder eine Sperre noch ein Fehlen.
    expect(unbestaetigt.toLowerCase()).not.toMatch(/gesperrt|kein original|nicht vorhanden/);
  });
});
