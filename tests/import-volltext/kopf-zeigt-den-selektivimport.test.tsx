// @vitest-environment jsdom
// ================================================================================================
// JOB 3288 · LIEFERUNG 3, DIE SICHTBARE HAELFTE — DER KOPF DER IMPORTSEITE, AM ECHTEN DOM.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (BEN, Runde 3, KORREKTURPFLICHT 2): `selektivimport-hat-eine-lauf-
// kennung.test.ts` L4 misst ZWEI SERVERABRUFE — `/api/import/confluence/zugang` vor und nach der
// Uebernahme. Das belegt, dass der Server den Abschlusszeitpunkt kennt. Es belegt NICHT, dass ein
// Mensch ihn sieht. Genau diese Luecke hat Ben gefunden, und sie war in meiner Rueckgabe der
// Runde 3 als „Kopf zeigt ihn" behauptet. Hier wird sie gemessen, nicht behauptet.
//
// DER SEHNAHT-VERLAUF, und wo diese Datei ansetzt:
//
//     Uebernahme (`POST .../apply`) → ImportRun in der Ablage → `/zugang` → useImportAccess →
//     ImportAccessPanel → DOM
//     └── belegt in L1–L4 ────────────────────────┘└── belegt HIER ─────────────────────────┘
//
// Die Naht zwischen beiden ist die ABLAGE (`ImportRunRepo`) — dasselbe Objekt, das die
// Uebernahme-Route beschreibt (`confluence-import-routes.ts:460-495`) und das der Zugangsdienst
// liest (`import-access-service.ts:90`). Diese Datei setzt den Lauf ueber genau diese Ablage und
// liest danach ueber den ECHTEN Server, den ECHTEN Client und das ECHTE Bauteil. Kein Ersatz einer
// Antwort, kein zweiter Wiretyp: die Bruecke aus JOB 2703 leitet `fetch` an die echte App.
//
// ================================================================================================
// K3 UND DER PRODUKTWEG — bens Korrekturpflicht 2 aus Runde 4, woertlich: „Entfernen der
// Produktinvalidierung muss ihn rot machen."
// ================================================================================================
//
// In Runde 4 rief K3 `invalidateQueries` SELBST. Damit bewies er den Mechanismus, aber nicht die
// Verdrahtung — er waere auch dann gruen geblieben, wenn das Produkt nie auffrischt. Genau das war
// der Fall, und Ben hat es nachgewiesen.
//
// K3 fuehrt jetzt den ECHTEN Rueckruf des Produkts aus: `ImportSelect` uebergibt sein `onApplied`
// an `ImportGroups` (`ImportSelect.tsx:808`), und dort loest die abgeschlossene Uebernahme ihn aus
// (`ImportGroups.tsx:406`, gepinnt in `tests/library/import-apply-invalidate.test.ts`). ERSETZT ist
// in dieser Datei allein `ImportGroups` — durch einen Ausloeser, der nichts tut als den
// hereingereichten `onApplied` aufzurufen. Damit steht der Rueckruf, um den es geht, als ECHTER
// Produktcode unter dem Fall: streicht jemand die Zugangs-Auffrischung aus `ImportSelect`, wird K3
// rot. Die Gruppierungs-/Uebernahme-Fläche selbst ist NICHT Gegenstand dieses Auftrags; ihre
// Naht zu `onApplied` haelt der genannte Pin.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

// Der Ersatz fuer Schritt 4+5: ein Knopf, der GENAU das tut, was die echte Fläche nach einer
// erfolgreichen Uebernahme tut — den Rueckruf des Elternteils aufrufen. Kein Nachbau der Bilanz,
// keine zweite Uebernahme-Logik.
vi.mock("../../apps/web/src/components/ImportGroups", async () => {
  const { createElement: h } = await import("../../apps/web/node_modules/react");
  return {
    ImportGroups: ({ onApplied }: { onApplied?: () => void }) =>
      h(
        "button",
        {
          type: "button",
          "data-testid": "test-uebernahme-fertig",
          onClick: () => onApplied?.(),
        },
        "Uebernahme abgeschlossen",
      ),
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ImportAccessPanel } from "../../apps/web/src/components/ImportAccessPanel";
import { ImportSelect } from "../../apps/web/src/components/ImportSelect";
import { ImportCockpitProvider } from "../../apps/web/src/components/ImportStepper";
import i18n from "../../apps/web/src/i18n";
import { ImportRunPanel } from "../../apps/web/src/pages/Stufe2";
import type { ImportRun } from "../../services/library-analytics";
import { type Bruecke, bruecke } from "../library/job2703-bruecke";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let b: Bruecke;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;
const flush = () => new Promise((r) => setTimeout(r, 0));

/**
 * Der Lauf, wie ihn die Uebernahme hinterlaesst — ueber DIESELBE Ablage, die die Route beschreibt.
 *
 * Die Felder sind nicht frei gewaehlt: `sourceSystem: "confluence"` und `status: "COMPLETED"` sind
 * genau die beiden, nach denen `findLastSuccessAt` sucht (`repo.ts:861`), und `completedAt` ist der
 * Wert, den der Kopf anzeigt. Was die Uebernahme sonst noch schreibt (Zaehler, `sourceScope`),
 * steht hier vollstaendig, damit kein Halbling in der Ablage liegt.
 */
async function laufAblegen(completedAt: string): Promise<string> {
  const importId = `job3288-${completedAt}`;
  const lauf: ImportRun = {
    importId,
    sourceSystem: "confluence",
    externalId: null,
    sourceScope: "ADV",
    requestedSourceVersion: null,
    status: "QUEUED",
    sourceRecordId: null,
    startedAt: completedAt,
    completedAt: null,
    failureCode: null,
    failureReason: null,
    counters: { itemsTotal: 2, itemsCreated: 0, itemsBound: 0, itemsSkipped: 0, itemsFailed: 0 },
  };
  await b.dienste.importRuns.insertIfAbsent(lauf);
  await b.dienste.importRuns.advance(importId, {
    status: "COMPLETED",
    completedAt,
    counters: { itemsTotal: 2, itemsCreated: 2, itemsBound: 0, itemsSkipped: 0, itemsFailed: 0 },
  });
  return importId;
}

async function mounten(): Promise<HTMLElement> {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(RoleProvider, null, createElement(ImportAccessPanel)),
        ),
      ),
    );
    await flush();
  });
  for (let i = 0; i < 10; i += 1) {
    await act(flush);
  }
  return container;
}

/**
 * Der Kopf UND die Auswahl-Fläche unter EINEM QueryClient — so, wie sie auf `/import` stehen.
 *
 * Ein gemeinsamer Client ist hier nicht Bequemlichkeit, sondern die Sache selbst: die Wirkung, um
 * die es geht, ist genau, dass `ImportSelect` eine Abfrage ungueltig macht, die der Kopf liest.
 * Zwei Clients waeren zwei Welten und der Fall waere wertlos.
 */
async function seiteMounten(): Promise<HTMLElement> {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
            createElement(ToastProvider, null, [
              createElement(ImportAccessPanel, { key: "kopf" }),
              // `children` steht hier IM Props-Objekt, nicht als dritter Aufrufparameter:
              // `ImportCockpitProvider` deklariert `children` als Pflichtfeld seiner Props
              // (`ImportStepper.tsx:73`), und `createElement` prueft das Props-Objekt gegen genau
              // diese Pflicht — ein separat gereichtes Kind erfuellt sie fuer den Typpruefer nicht
              // (TS2769). Gerendert wird dasselbe.
              createElement(ImportCockpitProvider, {
                key: "fluss",
                children: createElement(ImportSelect, {
                  chip: { themes: [], authors: [], spaces: [] },
                }),
              }),
            ]),
          ),
        ),
      ),
    );
    await flush();
  });
  for (let i = 0; i < 10; i += 1) {
    await act(flush);
  }
  return container;
}

/**
 * Die EINE Antwort, die diese Datei ersetzt: die Auswahl-Vorschau.
 *
 * `POST /admin/import/confluence/select` haengt am Feature-Schalter UND am Confluence-Adapter (vier
 * Umgebungsvariablen, echter Egress). Die Vorschau ist hier aber nicht Gegenstand — sie ist nur die
 * Vorbedingung dafuer, dass `ImportSelect` Schritt 4+5 ueberhaupt rendert und damit sein `onApplied`
 * uebergibt. Ersetzt wird deshalb GENAU dieser eine Pfad; alles andere (Zugang, Reasoner-Status,
 * Kandidaten) geht unveraendert an die echte App. Dasselbe Muster, das die Bruecke fuer
 * `/api/reasoner/status` schon kennt (`knopfFreigeben`).
 */
function vorschauAntwortStellen(): void {
  const echt = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    if (String(eingabe).endsWith("/api/admin/import/confluence/select")) {
      const antwort = {
        matched: 1,
        limited: false,
        truncated: false,
        criteria: {},
        preview: [{ id: "p1", title: "Netzentgelte", hasImage: false, themes: [] }],
        alreadyImported: 0,
        alreadyQueued: 0,
      };
      return {
        ok: true,
        status: 200,
        statusText: "200",
        headers: { get: () => null },
        text: async () => JSON.stringify(antwort),
        json: async () => antwort,
      };
    }
    return echt(eingabe as RequestInfo, init);
  }) as typeof globalThis.fetch;
}

/** Klickt den Knopf mit genau dieser Beschriftung. */
async function klickeKnopf(beschriftung: string): Promise<void> {
  const knopf = [...container.querySelectorAll("button")].find((k) =>
    (k.textContent ?? "").includes(beschriftung),
  );
  expect(knopf, `Knopf „${beschriftung}" fehlt`).toBeTruthy();
  await act(async () => {
    (knopf as HTMLButtonElement).click();
    await flush();
  });
  for (let i = 0; i < 10; i += 1) {
    await act(flush);
  }
}

/** Die Lauf-Kachel derselben Seite — dort steht der Satz, der auf die Kopfzeile verweist. */
async function laufKachelMounten(): Promise<HTMLElement> {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ToastProvider, null, createElement(ImportRunPanel)),
      ),
    );
    await flush();
  });
  for (let i = 0; i < 10; i += 1) {
    await act(flush);
  }
  return container;
}

/** Der Wortlaut der Kopfzeile, wie er auf dem Bildschirm steht. */
function kopfzeile(): string {
  const knoten = container.querySelector("[data-testid=import-access-lastconnected]");
  expect(knoten, "die Zeile des letzten Imports steht gar nicht im Baum").toBeTruthy();
  return ((knoten as HTMLElement).textContent ?? "").replace(/\s+/g, " ").trim();
}

/** „Nichts festgehalten" oder „festgehalten am …" — als Urteil, nicht als roher Text. */
function nenntEinenImport(): boolean {
  const zeile = kopfzeile();
  const unbekannt = i18n.t("imp.access.lastConnectedUnknown");
  return zeile !== unbekannt && zeile.length > 0;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  b = await bruecke();
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    container.remove();
    root = null;
  }
  b.abbauen();
  await i18n.changeLanguage("de");
});

describe("JOB 3288 · der Kopf der Importseite und der Selektivimport-Lauf", () => {
  it("K1 · ohne Lauf sagt der Kopf ehrlich, dass nichts festgehalten ist — am echten Server gelesen", async () => {
    await mounten();
    expect({
      zeile: kopfzeile(),
      nenntEinenImport: nenntEinenImport(),
      // Der Beleg, dass der Client wirklich ueber die Bruecke ging und nicht aus dem Nichts las.
      zugangGefragt: b.aufrufe.some((a) => a.url.includes("/import/confluence/zugang")),
    }).toEqual({
      zeile: i18n.t("imp.access.lastConnectedUnknown"),
      nenntEinenImport: false,
      zugangGefragt: true,
    });
  });

  it("K2 · liegt der Lauf in der Ablage, nennt der frisch geoeffnete Kopf seinen Abschlusszeitpunkt", async () => {
    const completedAt = "2026-09-08T09:41:00.000Z";
    await laufAblegen(completedAt);
    await mounten();
    // Der Server und der Bildschirm sagen dasselbe — beide gefragt, keiner geglaubt.
    const zugang = await b.a.inject({
      method: "GET",
      url: "/api/import/confluence/zugang",
      headers: b.kopf,
    });
    expect({
      serverKennt: (zugang.json() as { lastConnectedAt: string | null }).lastConnectedAt,
      nenntEinenImport: nenntEinenImport(),
      zeileTraegtDasJahr: kopfzeile().includes("2026"),
      zeileIstNichtDerUnbekanntSatz: kopfzeile() !== i18n.t("imp.access.lastConnectedUnknown"),
    }).toEqual({
      serverKennt: completedAt,
      nenntEinenImport: true,
      zeileTraegtDasJahr: true,
      zeileIstNichtDerUnbekanntSatz: true,
    });
  });

  it("K3 · DER BEREITS OFFENE KOPF wandert nach der Uebernahme — ohne Neuladen, ueber den echten Rueckruf des Produkts", async () => {
    // Der Fall, den Ben verlangt: kein Seitenwechsel, kein Neuladen, kein zweites Mounten — und
    // KEINE Ungueltigkeit aus der Testhand. Was hier ungueltig macht, ist `ImportSelect.onApplied`.
    vorschauAntwortStellen();
    await seiteMounten();
    const vorher = kopfzeile();
    const wurzelVorher = container.firstElementChild;

    // Schritt 3: Vorschau holen — erst danach uebergibt `ImportSelect` sein `onApplied`.
    await klickeKnopf(i18n.t("imp.select.previewCta"));
    const ausloeser = container.querySelector('[data-testid="test-uebernahme-fertig"]');
    expect(
      ausloeser,
      "ImportSelect rendert Schritt 4+5 nicht — ohne ihn gibt es kein `onApplied` zu pruefen",
    ).toBeTruthy();

    // Waehrend der Kopf offen steht, hinterlaesst die Uebernahme ihren Lauf (das tut serverseitig
    // `POST .../apply`, belegt in L1–L4; hier liegt er ueber dieselbe Ablage).
    const completedAt = "2026-09-08T10:12:00.000Z";
    await laufAblegen(completedAt);

    // ZWISCHENSTAND — und er ist der eigentliche Befund: die Ablage weiss es, der Bildschirm nicht.
    // Ohne diese Zeile waere K3 auch dann gruen, wenn der Kopf ohnehin bei jedem Herzschlag neu
    // laedt; dann bewiese der Klick darunter gar nichts.
    const zwischenstand = kopfzeile();

    // Und JETZT der Produktweg: die abgeschlossene Uebernahme meldet sich nach oben.
    await act(async () => {
      (ausloeser as HTMLButtonElement).click();
      await flush();
    });
    for (let i = 0; i < 10; i += 1) {
      await act(flush);
    }

    expect({
      vorher,
      zwischenstand,
      nachher: nenntEinenImport(),
      nachherTraegtDasJahr: kopfzeile().includes("2026"),
      // KEINE NEUMONTAGE: derselbe DOM-Knoten wie vor der Uebernahme. Ein neu gemounteter Baum
      // wuerde den Zeitpunkt auch zeigen — und nichts ueber die offene Seite aussagen.
      derselbeBaum: container.firstElementChild === wurzelVorher,
    }).toEqual({
      vorher: i18n.t("imp.access.lastConnectedUnknown"),
      zwischenstand: i18n.t("imp.access.lastConnectedUnknown"),
      nachher: true,
      nachherTraegtDasJahr: true,
      derselbeBaum: true,
    });
  });

  it("K4 · auf Englisch derselbe Weg — die Vorfuehrung laeuft auf Englisch", async () => {
    await i18n.changeLanguage("en");
    await laufAblegen("2026-09-08T11:03:00.000Z");
    await mounten();
    expect({
      nenntEinenImport: nenntEinenImport(),
      englisch: kopfzeile().startsWith("Last successfully completed import:"),
      nichtDerUnbekanntSatz: kopfzeile() !== i18n.t("imp.access.lastConnectedUnknown"),
    }).toEqual({ nenntEinenImport: true, englisch: true, nichtDerUnbekanntSatz: true });
  });

  it("K5 · der Satz der Lauf-Kachel verspricht GENAU das, was K2 und K3 messen — nicht mehr", async () => {
    // BENS PRUEFPUNKT 4 aus Runde 3: „Der neue Verweis … führt unmittelbar nach Apply zur falschen
    // Auskunft." Das stimmte, solange der Kopf nicht auffrischte. Seit K3 frischt er auf, und der
    // Satz darf den Ort deshalb OHNE Einschränkung nennen — der Nebensatz „die beim Öffnen dieser
    // Seite gelesen wird" ist mit der Ursache weggefallen, nicht mit ihr stehen geblieben. Dieser
    // Fall bindet den Satz an die gemessene Lage: er darf den Ort nennen, aber nichts behaupten,
    // was seit Lieferung 3 falsch wäre.
    await laufKachelMounten();
    const roh = container.querySelector('[data-testid="f0140-idle"]')?.textContent ?? "";
    const satz = roh.replace(/\s+/g, " ");
    expect({
      // 1. Er sagt, dass die Übernahme überhaupt festgehalten wird — das war vor Lieferung 3 falsch
      //    und ist es seit L1 nicht mehr.
      nenntDieUebernahme: satz.includes("Auswahl übernehmen"),
      sagtDassSieFestgehaltenWird: satz.includes("festgehalten"),
      // 2. Er nennt den Ort, an dem sie erscheint — wörtlich so, wie die Zeile dort beschriftet ist.
      nenntDieKopfzeile: satz.includes("Zuletzt erfolgreich abgeschlossener Import"),
      kopfzeileHeisstWirklichSo: i18n
        .t("imp.access.lastConnected", { date: "X" })
        .startsWith("Zuletzt erfolgreich abgeschlossener Import"),
      // 3. Was er NICHT sagt: den Satz aus Runde 2, der seit L1 falsch wäre.
      behauptetNichtsUngezaehltes: !satz.includes("gar nicht als Lauf"),
      // 4. Und ebenso wenig die Einschränkung aus Runde 4: sie war wahr, solange der Kopf nicht
      //    auffrischte, und wäre jetzt eine Untertreibung — ein Satz, der WENIGER verspricht als
      //    das Produkt kann, ist genauso eine Falschauskunft wie einer, der mehr verspricht.
      keineUeberholteEinschraenkung: !satz.includes("beim Öffnen dieser Seite gelesen"),
    }).toEqual({
      nenntDieUebernahme: true,
      sagtDassSieFestgehaltenWird: true,
      nenntDieKopfzeile: true,
      kopfzeileHeisstWirklichSo: true,
      behauptetNichtsUngezaehltes: true,
      keineUeberholteEinschraenkung: true,
    });
  });
});
