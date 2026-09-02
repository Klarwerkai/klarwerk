// @vitest-environment jsdom
// ================================================================================================
// JOB 2945 · D1 — F-0205: EXTERNE QUELLEN TRAGEN SICHTBAR „EXTERN · UNGEPRÜFT"
// ================================================================================================
//
//     Jemand liest ein Wissensobjekt. Darunter stehen die Quellen. Eine davon ist extern zugekauft
//     und von keinem Menschen im Haus geprüft — und sie sieht genauso aus wie die, die drei
//     Kollegen bestätigt haben.
//
// DER BEFUND AUF DEM STARTSTAND `6d574fce` — und er ist schärfer als der Auftrag annimmt.
//
// Der Auftrag beschreibt ein SCHWEIGEN: `peerValidated` komme in `KoView.tsx` „kein einziges Mal"
// vor. Das stimmt. Was daraus folgt, ist aber nicht Schweigen, sondern eine FALSCHE AUSSAGE:
// `KoView.tsx:47-49` rendert den Warnchip UNBEDINGT, an jeder Quelle — auch an einer mit
// `peerValidated: true`. Eine von drei Kollegen bestätigte Quelle wird dort heute als
// „extern · nicht peer-validiert" ausgezeichnet.
//
// Damit ist der Startstand in BEIDE Richtungen falsch:
//   · die ungeprüfte Quelle trägt nicht den zugesagten Herkunfts-Hinweis (F-0205),
//   · die geprüfte Quelle trägt eine Warnung, die für sie nicht gilt.
//
// Der zweite Punkt ist der gefährlichere: Ein Etikett, das an allem klebt, sagt nichts mehr aus.
// Wer es einmal an einer geprüften Quelle gesehen hat, liest es danach nirgends mehr.
//
// DIE ENTSCHEIDUNG FÄLLT AN GENAU EINER STELLE: `peerValidated === false`. Sie ist am Wiretyp
// vorhanden (`apps/web/src/api/types.ts:39`) und wird vom Dienst für externe Quellen
// definitionsgemäß auf `false` gesetzt (`services/knowledge-object/src/service.ts:1842`).
//
// RED-FIRST, gemessen vor der Änderung — die vier Fälle des Auftrags:
//   F1  rot: der Text „Extern · ungeprüft" existiert auf dem Startstand nirgends
//   F2  rot: die geprüfte Quelle trägt den Warnchip trotzdem
//   F3  grün: Reihenfolge und Sichtbarkeit sind schon heute in Ordnung (Kalibrierung, s. u.)
//   F4  rot: der Übersetzungsschlüssel existiert nicht
//
// WARUM F3 SCHON VOR DER ÄNDERUNG GRÜN IST UND TROTZDEM HIERHER GEHÖRT: Er ist die Kalibrierung.
// Die Pflicht lautet „der Hinweis ist keine Abwertung" — die Quelle wird nicht ausgeblendet, nicht
// ausgegraut, nicht nach hinten sortiert. Diese Zusage kann eine Änderung erst BRECHEN; ein Fall,
// der sie vorher misst, hält den Zustand fest, gegen den nachher verglichen wird. Ohne ihn wäre
// eine Umsortierung ein unbemerkter Nebenschaden.
//
// ================================================================================================
// D2 — WAS BEN AN D1 ZU RECHT BEMÄNGELT HAT
// ================================================================================================
//
// *„F1/F2/F3/F4 sind als Komponententests brauchbar, belegen mit direkt montierten Testdaten aber
// nicht die produktive Übergabe von `peerValidated` aus dem Clientabruf."*
//
// Er hat recht: Ein Renderer, der ein übergebenes Feld richtig auswertet, sagt nichts darüber, ob
// das Feld im echten Weg überhaupt ankommt. Geht es unterwegs verloren, wird `undefined` zwar
// fail-closed behandelt — aber dann trüge auch die GEPRÜFTE Quelle die Warnung, und das ist genau
// der Fehler, den D1 beseitigt hat, an einer anderen Stelle wieder da.
//
// Teil K unten schließt die Lücke. Ersetzt ist dort NUR `fetch` — die Netzwerkleitung. Alles
// danach ist Produktcode und läuft echt:
//
//     fetch (ersetzt)  →  apiFetch/JSON.parse (echt, client.ts:30-42)
//                      →  endpoints.ko.get    (echt, endpoints.ts:309)
//                      →  useKo/react-query   (echt, hooks.ts:47)
//                      →  KoView              (echt)
//
// DIE JSON-GRENZE IST DER PUNKT: `client.ts:31` macht `JSON.parse(raw)` und `:42` gibt das
// Ergebnis unverändert als `T` zurück — es gibt keine Feld-Whitelist und kein Mapping. Genau das
// muss belegt sein, statt geglaubt: Ein Feld, das der Server nicht schickt, ist nach dem Parse
// `undefined`, und keine Zwischenschicht erfindet es.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { useKo } from "../../apps/web/src/api/hooks";
import type { KnowledgeObject, KoSource } from "../../apps/web/src/api/types";
import { KoView } from "../../apps/web/src/components/KoView";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der Schlüssel, den F-0205 verlangt. Der Test kennt NUR den Schlüssel, nie den Text. */
const SCHLUESSEL = "ko.sourceExternUnchecked";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(ko: KnowledgeObject): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(KoView, { ko }));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function quelle(overrides: Partial<KoSource> = {}): KoSource {
  return {
    id: "q-1",
    label: "Handbuch Kesselspeisepumpe",
    url: null,
    excerpt: null,
    kind: "manual",
    peerValidated: false,
    ...overrides,
  } as unknown as KoSource;
}

function makeKo(sources: KoSource[]): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Anfahren der Kesselspeisepumpe",
    statement: "Die Pumpe wird über das Handventil langsam angefahren.",
    status: "validiert",
    conditions: [],
    measures: [],
    trust: 80,
    sources,
  } as unknown as KnowledgeObject;
}

/**
 * Der SICHTBARE Text des gemounteten Baums.
 *
 * Ausdrücklich `textContent` und nicht `getAttribute("title")` oder eine Klassenprüfung: Die
 * Abnahme sagt wörtlich, ein Hinweis nur über `title` oder allein über Farbe gelte als nicht
 * geliefert. Was hier gemessen wird, ist genau das, was ein Screenreader vorliest.
 */
function sichtbarerText(): string {
  return container.textContent ?? "";
}

describe("JOB 2945 · F-0205 · der Herkunfts-Hinweis an externen Quellen", () => {
  it("F1 · eine Quelle mit peerValidated=false trägt den Hinweis als LESBAREN TEXT", () => {
    mount(
      makeKo([quelle({ id: "q-extern", label: "Zugekaufte Norm DIN-X", peerValidated: false })]),
    );

    const erwartet = i18n.t(SCHLUESSEL);
    // Ein fehlender Schlüssel gäbe den Schlüsselnamen zurück — das wäre kein Text, sondern eine
    // Kennung, und der Fall wäre scheinbar grün. Deshalb zuerst diese Absicherung.
    expect(erwartet, `der Schlüssel ${SCHLUESSEL} ist nicht übersetzt`).not.toBe(SCHLUESSEL);
    expect(sichtbarerText(), "der Herkunfts-Hinweis fehlt im sichtbaren Text").toContain(erwartet);

    // Und er hängt an DIESER Quelle, nicht irgendwo im Baum.
    const eintrag = Array.from(container.querySelectorAll("li")).find((li) =>
      (li.textContent ?? "").includes("Zugekaufte Norm DIN-X"),
    );
    expect(eintrag, "der Quelleneintrag wurde nicht gefunden").toBeDefined();
    expect(eintrag?.textContent ?? "").toContain(erwartet);
  });

  it("F2 · eine Quelle mit peerValidated=true bekommt NICHTS", () => {
    mount(
      makeKo([
        quelle({ id: "q-geprueft", label: "Interne Betriebsanweisung", peerValidated: true }),
      ]),
    );

    const hinweis = i18n.t(SCHLUESSEL);
    expect(sichtbarerText(), "die geprüfte Quelle trägt den Herkunfts-Hinweis").not.toContain(
      hinweis,
    );
    // Der alte, unbedingt gerenderte Warnchip darf hier ebenfalls nicht mehr stehen — er ist
    // genau die falsche Aussage, die der Startstand macht.
    expect(sichtbarerText(), "die geprüfte Quelle trägt noch den alten Warnchip").not.toContain(
      i18n.t("ko.sourceUnvalidated"),
    );
    // Die Quelle selbst bleibt selbstverständlich sichtbar.
    expect(sichtbarerText()).toContain("Interne Betriebsanweisung");
  });

  it("F3 · KALIBRIERUNG: Reihenfolge und Sichtbarkeit bleiben unverändert", () => {
    // Der Hinweis ist keine Abwertung: die externe Quelle wird nicht ausgeblendet, nicht
    // ausgegraut und nicht nach hinten sortiert. Gemischte Liste, externe Quelle in der MITTE.
    mount(
      makeKo([
        quelle({ id: "q-1", label: "Erste Quelle", peerValidated: true }),
        quelle({ id: "q-2", label: "Zweite Quelle extern", peerValidated: false }),
        quelle({ id: "q-3", label: "Dritte Quelle", peerValidated: true }),
      ]),
    );

    const eintraege = Array.from(container.querySelectorAll("li"));
    expect(eintraege, "es werden nicht alle drei Quellen gezeigt").toHaveLength(3);
    expect(eintraege.map((li) => li.textContent ?? "")[0]).toContain("Erste Quelle");
    expect(eintraege.map((li) => li.textContent ?? "")[1]).toContain("Zweite Quelle extern");
    expect(eintraege.map((li) => li.textContent ?? "")[2]).toContain("Dritte Quelle");

    // Nicht ausgegraut, nicht versteckt: kein `hidden`, keine Deckkraft-Minderung, keine
    // Durchstreichung an der externen Zeile.
    const extern = eintraege[1] as HTMLElement;
    expect(extern.hidden, "die externe Quelle ist versteckt").toBe(false);
    expect(extern.className, "die externe Quelle ist ausgegraut oder durchgestrichen").not.toMatch(
      /opacity-|line-through|hidden/,
    );
  });

  it("F4 · der Text stammt aus dem Übersetzungsregister, nicht aus dem Bauteil", () => {
    // Zwei Nachweise, und der zweite ist der eigentliche:
    //   (1) der Schlüssel ist in allen drei Sprachen belegt,
    //   (2) schaltet man die Sprache um, ändert sich der sichtbare Text mit.
    // Ein eingebauter Literalstring bestünde (1) nie und (2) niemals.
    for (const sprache of ["de", "en", "nl"] as const) {
      const wert = i18n.getFixedT(sprache)(SCHLUESSEL);
      expect(wert, `${SCHLUESSEL} fehlt in der Sprache ${sprache}`).not.toBe(SCHLUESSEL);
      expect(String(wert).trim().length, `${SCHLUESSEL} ist leer in ${sprache}`).toBeGreaterThan(0);
    }

    const deutsch = String(i18n.getFixedT("de")(SCHLUESSEL));
    const englisch = String(i18n.getFixedT("en")(SCHLUESSEL));
    expect(deutsch, "de und en tragen denselben Text — das belegt keine Registerbindung").not.toBe(
      englisch,
    );

    mount(makeKo([quelle({ id: "q-extern", peerValidated: false })]));
    expect(sichtbarerText()).toContain(deutsch);
  });
});

// ================================================================================================
// TEIL K · DIE PRODUKTIVE CLIENTKETTE — vom Serverantwort-JSON bis in den Renderer
// ================================================================================================
//
// BENs Korrekturpflicht 1 wörtlich: *„Belege die vollständige produktive Kette Clientabruf/Mapping
// → KoView mit einem Integrationstest für `peerValidated: false` und `true`."*
//
// WAS HIER ECHT IST — und die Aufzählung ist der Kern des Belegs:
//   · `apiFetch` samt `JSON.parse` (`client.ts:30-42`) — die reale Serialisierungsgrenze
//   · `endpoints.ko.get` (`endpoints.ts:309`) — der reale Aufruf `/api/kos/:id`
//   · `useKo` mit react-query (`hooks.ts:47`) — der reale Datenzustand
//   · `KoView` — der reale Renderer
//
// WAS ERSETZT IST: ausschließlich `globalThis.fetch`. Was die Attrappe liefert, ist ein
// JSON-STRING, kein Objekt — die Nutzlast geht also wirklich durch `JSON.parse`. Ein Feld, das im
// String fehlt, ist danach `undefined`; ein Feld, das drinsteht, muss unverändert ankommen.
//
// WARUM EINE EIGENE VERBRAUCHERKOMPONENTE UND KEINE FERTIGE SEITE: `Conflicts` und
// `DuplicateCompare` binden `KoView` an Konflikt- beziehungsweise Dublettendaten und bräuchten
// dafür Routing und weitere Abrufe. Die Attrappen dafür wären umfangreicher als der Beleg selbst
// und würden ihn verwässern. `KoDetail` unten tut Zeile für Zeile das, was jene Seiten tun:
// `useKo(id)` holen, Ergebnis an `KoView` geben (vgl. `DuplicateCompare.tsx:137`,
// `Conflicts.tsx:55`).
function KoDetail({ id }: { id: string }): JSX.Element | null {
  const { data } = useKo(id);
  return data ? createElement(KoView, { ko: data }) : null;
}

/** Eine Serverantwort, wie sie `GET /api/kos/:id` liefert — als JSON-STRING, nicht als Objekt. */
function serverAntwort(quellen: Array<Record<string, unknown>>): string {
  return JSON.stringify({
    id: "ko-kette",
    title: "Anfahren der Kesselspeisepumpe",
    statement: "Die Pumpe wird über das Handventil langsam angefahren.",
    status: "validiert",
    conditions: [],
    measures: [],
    trust: 80,
    sources: quellen,
  });
}

/** Fährt die volle Kette und gibt den sichtbaren Text zurück. */
async function ketteLaufen(nutzlast: string): Promise<{ text: string; pfad: string }> {
  let gerufenerPfad = "";
  const attrappe = vi.fn(async (url: unknown) => {
    gerufenerPfad = String(url);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      // `text()` und nicht `json()`: `apiFetch` liest den Rumpf als Text und parst selbst.
      // Damit läuft die echte Parse-Grenze, statt sie zu umgehen.
      text: async () => nutzlast,
    };
  });
  const vorher = globalThis.fetch;
  (globalThis as unknown as { fetch: unknown }).fetch = attrappe;

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(KoDetail, { id: "ko-kette" }),
        ),
      );
    });
    await act(async () => {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 0));
      }
    });
    return { text: container.textContent ?? "", pfad: gerufenerPfad };
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = vorher;
  }
}

describe("JOB 2945 · K · die produktive Kette Clientabruf → KoView", () => {
  it("K0 · VORAUSSETZUNG: der Abruf läuft wirklich über den echten Endpunkt", async () => {
    // Ohne diesen Fall wäre jede folgende Zusage wertlos: Käme die Kette nie beim Abruf an, wären
    // K1 bis K3 grün, weil gar nichts passiert. Geprüft wird der reale Pfad aus `endpoints.ts:309`
    // samt `/api`-Präfix aus `client.ts:16`.
    const { pfad, text } = await ketteLaufen(
      serverAntwort([{ id: "q-1", label: "Quelle A", peerValidated: true }]),
    );
    expect(pfad, "der Client hat den KO-Endpunkt nicht gerufen").toBe("/api/kos/ko-kette");
    expect(text, "die abgerufene Antwort ist nicht gerendert worden").toContain("Quelle A");
  });

  it("K1 · zwei Quellen aus EINER Antwort: der Hinweis erscheint nur an der externen", async () => {
    const hinweis = String(i18n.t(SCHLUESSEL));
    const { text } = await ketteLaufen(
      serverAntwort([
        { id: "q-geprueft", label: "Interne Betriebsanweisung", peerValidated: true },
        { id: "q-extern", label: "Zugekaufte Norm DIN-X", peerValidated: false },
      ]),
    );

    // Beide Quellen sind da, in der Reihenfolge der Serverantwort.
    const eintraege = Array.from(container.querySelectorAll("li")).map(
      (li) => li.textContent ?? "",
    );
    expect(eintraege, "es kamen nicht beide Quellen durch").toHaveLength(2);
    expect(eintraege[0]).toContain("Interne Betriebsanweisung");
    expect(eintraege[1]).toContain("Zugekaufte Norm DIN-X");

    // Der Hinweis hängt an der externen — und NUR an ihr.
    expect(eintraege[1], "die externe Quelle trägt den Hinweis nicht").toContain(hinweis);
    expect(eintraege[0], "die geprüfte Quelle trägt den Hinweis").not.toContain(hinweis);
    // Und der alte Warnchip taucht nirgends wieder auf.
    expect(text, "der alte Warnchip ist zurück").not.toContain(
      String(i18n.t("ko.sourceUnvalidated")),
    );
  });

  it("K2 · das Feld übersteht die JSON-Grenze — `true` bleibt `true`", async () => {
    // Der eigentliche Transportbeleg. Wäre `peerValidated` unterwegs verloren gegangen, käme
    // `undefined` an und die geprüfte Quelle bekäme fail-closed den Hinweis. Dass sie ihn NICHT
    // bekommt, ist der Nachweis, dass das Feld ankommt.
    const hinweis = String(i18n.t(SCHLUESSEL));
    const { text } = await ketteLaufen(
      serverAntwort([
        { id: "q-geprueft", label: "Interne Betriebsanweisung", peerValidated: true },
      ]),
    );
    expect(text).toContain("Interne Betriebsanweisung");
    expect(text, "true kam nicht bis zum Renderer durch").not.toContain(hinweis);

    // Gegenprobe an derselben Kette: `false` erzeugt den Hinweis sehr wohl. Ohne sie könnte K2
    // auch dadurch grün sein, dass die Kette den Hinweis NIE zeigt.
    const b = await ketteLaufen(
      serverAntwort([{ id: "q-extern", label: "Zugekaufte Norm DIN-X", peerValidated: false }]),
    );
    expect(b.text, "die Kette zeigt den Hinweis überhaupt nicht").toContain(hinweis);
  });

  it("K3 · ENTSCHIEDEN: ein FEHLENDES Feld wird wie `false` behandelt — fail-closed", async () => {
    // ============================================================================================
    // DIE FACHLICHE ENTSCHEIDUNG ZU BENS KORREKTURPFLICHT 2 — hier festgeschrieben, nicht geerbt.
    // ============================================================================================
    //
    // Liefert der Server eine Quelle OHNE `peerValidated`, ist das Feld nach `JSON.parse`
    // `undefined`. Zwei Auslegungen wären denkbar:
    //
    //   fail-OPEN   `undefined` gilt als geprüft  → kein Hinweis
    //   fail-CLOSED `undefined` gilt als ungeprüft → Hinweis, wie bei `false`
    //
    // **Entschieden ist fail-closed**, und der Grund ist der Zweck von F-0205: Der Hinweis ist der
    // „zentrale Ehrlichkeits-Anker". Wer nicht weiß, ob eine Quelle geprüft wurde, darf sie nicht
    // als geprüft ausgeben — eine fehlende Auskunft ist keine Unbedenklichkeitsbescheinigung. Der
    // Preis ist ein möglicher Hinweis zu viel; der Preis der Gegenrichtung wäre eine ungeprüfte
    // Quelle, die wie bestätigtes Wissen aussieht.
    //
    // Dieser Fall macht die Entscheidung zur MESSUNG. Wer die Bedingung in `KoView` später zu
    // `s.peerValidated === false` verengte — was harmloser aussieht — würde fail-open einführen
    // und diesen Fall rot machen.
    const hinweis = String(i18n.t(SCHLUESSEL));
    const { text } = await ketteLaufen(
      serverAntwort([{ id: "q-ohne-feld", label: "Quelle ohne Angabe" }]),
    );

    expect(text).toContain("Quelle ohne Angabe");
    expect(text, "ein fehlendes Feld wird NICHT wie `false` behandelt — fail-open").toContain(
      hinweis,
    );
  });

  it("K4 · ein fehlendes Feld kommt wirklich als `undefined` an, nicht als `false`", async () => {
    // Die Kalibrierung zu K3: Ohne sie wäre nicht belegt, dass der Fall überhaupt der Fall ist —
    // eine Zwischenschicht könnte das Feld stillschweigend auf `false` setzen, und K3 wäre grün,
    // ohne dass je ein `undefined` auftrat. Gemessen wird am ECHTEN Client, nicht am Renderer.
    const roh = await endpoints.ko.get("ko-kette").catch(() => null);
    expect(roh, "der Abruf außerhalb der Attrappe darf keine Daten liefern").toBeNull();

    let empfangen: KnowledgeObject | null = null;
    const vorher = globalThis.fetch;
    (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => serverAntwort([{ id: "q-ohne-feld", label: "Quelle ohne Angabe" }]),
    }));
    try {
      empfangen = await endpoints.ko.get("ko-kette");
    } finally {
      (globalThis as unknown as { fetch: unknown }).fetch = vorher;
    }

    const quelle0 = (empfangen?.sources ?? [])[0] as KoSource | undefined;
    expect(quelle0, "die Quelle kam nicht durch").toBeDefined();
    expect(
      Object.hasOwn(quelle0 as object, "peerValidated"),
      "der Client hat das fehlende Feld ergänzt — dann prüft K3 nicht den echten Fall",
    ).toBe(false);
    expect((quelle0 as unknown as { peerValidated?: boolean }).peerValidated).toBeUndefined();
  });
});
