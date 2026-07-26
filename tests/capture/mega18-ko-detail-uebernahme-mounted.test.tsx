// @vitest-environment jsdom
// ==============================================================================================
// AUFTRAG-mega18 Block A-3 — DER GEMOUNTETE BELEG IM KO-DETAIL.
// ==============================================================================================
//
// bens Urteil zu unserer Restliste, Eintrag #2: „falsch beurteilt". Unsere Verteidigung lautete
// „Body geht nur in den lokalen Edit-Zustand" — und das ist keine Grenze, wenn dieser Zustand
// UNMITTELBAR SPEICHERBAR ist. Genau das war er: der Dokumentinhalt wanderte sofort in
// `edit.bodyHtml`, die Punktquellen liefen als nicht abgewartete Einzelmutationen, ein
// Quellenfehler setzte nur einen Toast, und der Speichern-Knopf hing allein an `save.isPending`.
//
// Dieser Test fährt die ECHTE Komponente (KnowledgeDetail) im DOM und prüft den ZUSTAND, nicht die
// Aufrufreihenfolge. Vier Lagen, wie im Auftrag verlangt — zwei Punkte, Attach-Fehler,
// Quellenfehler und der CAS-Fall —, und in jeder wird gefragt: steht Dokumenttext im Editor, und
// ist er speicherbar?
//
// Die Antwort, die dieser Test festnagelt: Dokumenttext erscheint im Editor ERST, wenn der Server
// ihn GEMEINSAM MIT SEINER HERKUNFT committet hat. Vorher gibt es nichts zu speichern; bei
// unklarem Ausgang ist Speichern gesperrt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  /** Der Bestand, den `ko.get` liefert — wird vom Test gesetzt. */
  ko: {} as Record<string, unknown>,
  /** Was `appendDocument` tun soll: committen, ablehnen (Domänencode) oder gar nicht antworten. */
  appendBehaviour: "commit" as
    | "commit"
    | "upload-fails"
    | "reject-anchor"
    | "reject-stale"
    | "network"
    // AUFTRAG-mega19 Block A: der erste Aufruf committet, seine Antwort geht verloren; die
    // Wiederholung mit derselben Kennung bekommt das AUFGEZEICHNETE Ergebnis (`replayed`).
    | "antwortverlust-dann-replay"
    // Dieselbe Lage, aber mit dem Server VOR mega19: die Wiederholung läuft in das Kapazitätstor
    // und antwortet BAD_REQUEST. Nur als Kalibrierung — so sah der Datenverlust aus.
    | "antwortverlust-dann-400",
  /** Wie oft `objects.upload` und `appendDocument` aufgerufen wurden. */
  uploads: 0,
  appendCalls: [] as Record<string, unknown>[],
  /** Jede `revise`-Mutation (der Speichern-Knopf) — hier darf NICHTS unbelegtes landen. */
  revisions: [] as Record<string, unknown>[],
  /** Löst den hängenden `appendDocument`-Aufruf auf (für die „läuft noch"-Lage). */
  releaseAppend: (): void => {},
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  type P = Record<string, unknown>;
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => box.ko),
        list: leer,
        versions: leer,
        evidence: leer,
        act: vi.fn(async (_id: string, body: P) => {
          if (body.action === "revise") {
            box.revisions.push(body);
          }
          return box.ko;
        }),
        // AUFTRAG-mega18 Block A-1: DIE Operation. Ihr Verhalten steuert der Test.
        appendDocument: vi.fn(async (_id: string, payload: P) => {
          box.appendCalls.push(payload);
          if (box.appendBehaviour === "reject-anchor") {
            throw Object.assign(new Error("kein Beleg"), { code: "MISSING_DOCUMENT_ANCHOR" });
          }
          if (box.appendBehaviour === "reject-stale") {
            throw Object.assign(new Error("nebenläufig geändert"), { code: "STALE_WRITE" });
          }
          // AUFTRAG-mega19 Block A: der erste Aufruf ist DURCH (der Server hat committet), nur
          // die Antwort kommt nicht an. Was der zweite Aufruf liefert, entscheidet über
          // Datenverlust oder Nachziehen — deshalb stehen beide Varianten hier nebeneinander.
          if (
            box.appendBehaviour === "antwortverlust-dann-replay" ||
            box.appendBehaviour === "antwortverlust-dann-400"
          ) {
            if (box.appendCalls.length === 1) {
              throw new Error("network down");
            }
            if (box.appendBehaviour === "antwortverlust-dann-400") {
              // DER SERVER VOR mega19: das Kapazitätstor stand VOR dem Replay-Nachschlag, und der
              // erste Aufruf hatte den letzten Anhangplatz selbst gefüllt.
              throw Object.assign(new Error("Maximal 1 Anhänge je Objekt."), {
                code: "BAD_REQUEST",
              });
            }
            return {
              committed: true,
              operationId: String(payload.operationId),
              replayed: true,
              koVersion: 2,
              attachmentId: "att-1",
              sourceIds: ["src-1", "src-2"],
              ko: box.ko,
            };
          }
          if (box.appendBehaviour === "network") {
            // Antwortet NIE — der Ausgang bleibt unklar, solange der Test ihn nicht auflöst.
            return new Promise((_resolve, reject) => {
              box.releaseAppend = () => reject(new Error("network down"));
            });
          }
          return {
            committed: true,
            operationId: String(payload.operationId),
            replayed: false,
            koVersion: 2,
            attachmentId: "att-1",
            sourceIds: ["src-1", "src-2"],
            ko: box.ko,
          };
        }),
      },
      objects: {
        upload: vi.fn(async () => {
          box.uploads += 1;
          if (box.appendBehaviour === "upload-fails") {
            // Der „Attach-Fehler" von früher ist heute ein UPLOAD-Fehler: nur er kann den Anker
            // noch verhindern, weil das Binden Sache der Operation ist.
            throw Object.assign(new Error("Payload Too Large"), { status: 413 });
          }
          return { id: "obj-1", size: 42 };
        }),
      },
      reasoner: {
        // Zwei Punkte, beide mit Belegstelle (G-2) — die Lage, die der Auftrag verlangt.
        extract: vi.fn(async () => ({
          points: [
            { title: "Punkt eins", summary: "Zusammenfassung eins", sourceExcerpt: "Beleg eins" },
            { title: "Punkt zwei", summary: "Zusammenfassung zwei", sourceExcerpt: "Beleg zwei" },
          ],
          note: null,
        })),
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
        describeImage: vi.fn(async () => ({})),
      },
      audit: { list: leer },
      conflicts: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Pia" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "search_on_click" })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider, useToast } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

// Der ToastProvider stellt nur den Bus bereit — die Toast-Anzeige wohnt in der App-Schale, die
// dieser Test bewusst NICHT mitfährt. Diese winzige Sonde macht die gemeldeten Gründe im DOM
// sichtbar, damit der Test die EHRLICHE MELDUNG prüfen kann und nicht bloß den Zustand.
function ToastProbe(): JSX.Element {
  const { toasts } = useToast();
  return createElement(
    "div",
    { "data-testid": "toasts" },
    toasts.map((toast) => createElement("p", { key: toast.id }, toast.message)),
  );
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const ALTER_BODY = "<p>Alter, geprüfter Absatz.</p>";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
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
              createElement(
                MemoryRouter,
                { initialEntries: ["/wissen/ko-1"] },
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
                  ),
                  createElement(ToastProbe),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

function buttons(part: string): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  ) as HTMLButtonElement[];
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = buttons(part)[0];
  if (!btn) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

/** Der Speichern-Knopf des Edit-Modus. Sein `disabled` IST die Zusage dieses Auftrags. */
function speichernKnopf(): HTMLButtonElement {
  return buttonByText(i18n.t("ko.saveEdit"));
}

/** Die gemeldeten Gründe (Toast-Bus) — der ehrliche Text, den der Nutzer zu sehen bekommt. */
function toastText(): string {
  return container.querySelector('[data-testid="toasts"]')?.textContent ?? "";
}

/** Der Inhalt des Body-Editors — hier darf Dokumenttext nur nach einem Commit auftauchen. */
function editorHtml(): string {
  const el = container.querySelector('[role="textbox"]');
  return el instanceof HTMLElement ? el.innerHTML : "";
}

/** Öffnet Bearbeiten, klappt „Aus Dokument ergänzen" auf, lädt ein Dokument und extrahiert. */
async function bisZurPunkteliste(): Promise<void> {
  await click(buttonByText(i18n.t("ko.edit")));
  await click(buttonByText(i18n.t("xtr.title")));
  // Der Datei-Input des Panels — er trägt die zentrale Dokument-accept-Liste (FILE_IMPORT_ACCEPT);
  // andere Inputs derselben Seite (Bild, Anhang) tun das nicht.
  const input = [...container.querySelectorAll('input[type="file"]')].find(
    (el) =>
      (el.getAttribute("accept") ?? "").includes(".docx") &&
      !(el.getAttribute("accept") ?? "").includes("video/"),
  );
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Datei-Input des Panels nicht gefunden");
  }
  const file = new File(["Pruefbericht: Dichtung nach 500 h tauschen."], "Pruefbericht.txt", {
    type: "text/plain",
  });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await click(buttonByText(i18n.t("capture.file.searchCta")));
}

/** Klickt „Ausgewählte anfügen" — die Übernahme. */
async function uebernehmen(): Promise<void> {
  await click(buttonByText(i18n.t("xtr.applyCta")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.ko = {
    id: "ko-1",
    title: "Dichtungswechsel L4",
    statement: "Dichtung vor jedem Anlauf prüfen.",
    bodyHtml: ALTER_BODY,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Instandhaltung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    history: [{ version: 1, at: "2026-07-01T10:00:00.000Z", author: "u1", note: "erstellt" }],
    comments: [],
    attachments: [],
    sources: [],
  };
  box.appendBehaviour = "commit";
  box.uploads = 0;
  box.appendCalls.length = 0;
  box.revisions.length = 0;
  box.releaseAppend = () => {};
});

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("mega18 A-3: KO-Detail — kein speicherbarer Zwischenstand mehr", () => {
  it("committet: ZWEI Punkte gehen in EINEM Aufruf raus, danach steht der Text im Editor", async () => {
    await mount();
    await bisZurPunkteliste();
    // Vor der Übernahme: nur der alte Absatz.
    expect(editorHtml()).not.toContain("Beleg eins");

    await uebernehmen();

    // EIN Aufruf für BEIDE Punkte — nicht zwei Einzelmutationen gegen einen Vollobjekt-CAS.
    expect(box.appendCalls).toHaveLength(1);
    const call = box.appendCalls[0] as {
      points: unknown[];
      anchor: { objectId: string };
      operationId: string;
      changes: { bodyHtml: string };
    };
    expect(call.points).toHaveLength(2);
    // Der Anker ist ECHT (das Original liegt im Objektspeicher) und reist mit.
    expect(box.uploads).toBe(1);
    expect(call.anchor.objectId).toBe("obj-1");
    expect(call.operationId).toMatch(/^append-/);
    // Der Aufruf trägt den Inhalt MIT — Inhalt und Herkunft gehen gemeinsam raus.
    expect(call.changes.bodyHtml).toContain("Beleg eins");
    expect(call.changes.bodyHtml).toContain("Beleg zwei");

    // Erst JETZT trägt der Editor den Dokumenttext: er ist serverseitig belegt.
    expect(editorHtml()).toContain("Beleg eins");
    // Und Speichern ist frei — es gibt nichts Unbelegtes mehr im Entwurf.
    expect(speichernKnopf().disabled).toBe(false);
    // Der Speichern-Knopf hat KEINE zweite Revision desselben Inhalts erzeugt.
    expect(box.revisions).toHaveLength(0);
  });

  it("ANKER-FEHLER (Upload scheitert): kein Aufruf, kein Dokumenttext, nichts speicherbar Unbelegtes", async () => {
    // Das ist der frühere „Attach-Fehler". Bis mega17 lief die Übernahme trotzdem weiter — das Panel
    // rief `onAppend` OHNE objectId auf und der Body wurde lokal ergänzt.
    box.appendBehaviour = "upload-fails";
    await mount();
    await bisZurPunkteliste();

    await uebernehmen();

    // Die Operation wurde GAR NICHT versucht: ohne gesicherten Anker gibt es keine Übernahme.
    expect(box.appendCalls).toHaveLength(0);
    // Und der entscheidende Zustand: KEIN Dokumenttext im Editor.
    expect(editorHtml()).not.toContain("Beleg eins");
    expect(editorHtml()).toContain("Alter, geprüfter Absatz.");
    // Es gibt also nichts Unbelegtes, das der Speichern-Knopf festschreiben könnte.
    await click(speichernKnopf());
    const revision = box.revisions[0] as { changes: { bodyHtml: string } } | undefined;
    expect(revision?.changes.bodyHtml ?? "").not.toContain("Beleg eins");
  });

  it("QUELLENFEHLER (die Operation lehnt ab): Upload lief, Bestand und Editor bleiben unberührt", async () => {
    // Der Anker ist gesichert, aber die Operation lehnt ab — hier stellvertretend die serverseitige
    // Belegpflicht. Bis mega17 wären die Punktquellen einzeln gelaufen, ein Fehlschlag hätte nur
    // einen Toast gesetzt, und der Dokumenttext wäre im Editor stehen geblieben: speicherbar.
    box.appendBehaviour = "reject-anchor";
    await mount();
    await bisZurPunkteliste();

    await uebernehmen();

    expect(box.uploads).toBe(1); // der Upload lief
    expect(box.appendCalls).toHaveLength(1); // die Operation wurde versucht …
    // … und hat abgelehnt. Also steht NICHTS im Editor, was nicht belegt wäre.
    expect(editorHtml()).not.toContain("Beleg eins");
    expect(editorHtml()).toContain("Alter, geprüfter Absatz.");
    // Der Grund wird BENANNT (nicht „irgendein Fehler") — und zwar der der Belegpflicht, nicht der
    // der Stufe. Zwei Regeln, zwei Meldungen.
    expect(toastText()).toContain("Ohne das Originaldokument als Beleg");
    // Speichern bleibt frei — der Ausgang ist eindeutig, es gibt nichts Unklares.
    expect(speichernKnopf().disabled).toBe(false);
    await click(speichernKnopf());
    const revision = box.revisions[0] as { changes: { bodyHtml: string } } | undefined;
    expect(revision?.changes.bodyHtml ?? "").not.toContain("Beleg eins");
  });

  it("CAS-FALL (STALE_WRITE): eindeutig abgelehnt — Editor unverändert, Speichern bleibt frei", async () => {
    // Ein STALE_WRITE ist eine BELEGTE Ablehnung: der Compare-and-Set hat NICHT geschrieben. Genau
    // deshalb steht er auf der Allowlist der eindeutigen Ausgänge (lib/appendToArticle.ts) — und
    // genau deshalb darf hier nichts gesperrt werden.
    box.appendBehaviour = "reject-stale";
    await mount();
    await bisZurPunkteliste();

    await uebernehmen();

    expect(box.appendCalls).toHaveLength(1); // ein Versuch, KEINE Wiederholung (Ausgang eindeutig)
    expect(editorHtml()).not.toContain("Beleg eins");
    expect(speichernKnopf().disabled).toBe(false);
  });

  it("UNKLARER AUSGANG: Speichern ist GESPERRT — und der Knopf kennt den Grund, nicht nur isPending", async () => {
    // DIE Auflage des Auftrags. Solange die Übernahme läuft, ist die Grundlage in Bewegung; danach
    // ist bei unklarem Ausgang unbekannt, welche Version im Bestand steht. Blind darüber zu
    // revidieren wäre genau der Fehler, den mega18 abschafft.
    box.appendBehaviour = "network";
    await mount();
    await bisZurPunkteliste();
    expect(speichernKnopf().disabled).toBe(false); // vorher frei

    // Übernahme starten. Die Operation antwortet NICHT — der Klick-Handler bleibt offen, act
    // kehrt nach dem Durchlauf der Effekte zurück.
    await act(async () => {
      buttonByText(i18n.t("xtr.applyCta")).click();
      await flush();
    });
    // (a) läuft noch ⇒ gesperrt. Das ist mehr als `save.isPending`: der Knopf kennt die Übernahme.
    expect(speichernKnopf().disabled).toBe(true);

    // Jetzt reißt die Verbindung. `commitDocumentAppend` wiederholt EINMAL mit derselben Kennung;
    // auch die Wiederholung erfährt nichts ⇒ der Ausgang bleibt unklar.
    await act(async () => {
      box.releaseAppend();
      await flush();
    });
    await act(async () => {
      box.releaseAppend();
      await flush();
    });

    // Beide Versuche trugen DIESELBE Kennung — daran hängt die Gefahrlosigkeit der Wiederholung.
    expect(box.appendCalls).toHaveLength(2);
    expect((box.appendCalls[0] as { operationId: string }).operationId).toBe(
      (box.appendCalls[1] as { operationId: string }).operationId,
    );
    // (b) unklarer Ausgang ⇒ weiter gesperrt, mit sichtbarem Grund im DOM.
    expect(speichernKnopf().disabled).toBe(true);
    expect(container.textContent).toContain("Der Ausgang ist unklar");
    // Und: KEIN Dokumenttext im Editor, also auch nichts, das jemand festschreiben könnte.
    expect(editorHtml()).not.toContain("Beleg eins");
    // Es wurde NICHTS zurückgenommen — keine Revision, kein remove-source.
    expect(box.revisions).toHaveLength(0);
  });
});

// ==============================================================================================
// AUFTRAG-mega19 Block A — DER ANTWORTVERLUST AM VOLLEN OBJEKT, GEMOUNTET.
// ==============================================================================================
//
// Hier wird der Zustand geprüft, an dem der Datenverlust hing: `appendUnclear` UND der Inhalt des
// Editors. Beide zusammen, nie einzeln — denn keiner von beiden ist für sich der Fehler.
//
//   `appendUnclear = true`                        → Speichern gesperrt. Sicher, aber unbequem.
//   `appendUnclear = false` + Editor NACHGEZOGEN  → Speichern frei. Richtig: nichts läuft auseinander.
//   `appendUnclear = false` + Editor ALT          → DER FEHLER. Speichern schreibt den alten Body
//                                                    über die bereits committete Fassung.
//
// Genau die dritte Lage war erreichbar, weil die Route den Retry mit BAD_REQUEST beantwortete
// (Kapazitätstor VOR dem Replay-Nachschlag) und der Client einen 400 als eindeutige Ablehnung
// führt. Die beiden Tests unten fahren dieselbe Nutzerlage gegen beide Server-Fassungen.
describe("mega19 A-3: Antwortverlust am vollen Objekt — der Editor läuft nicht mehr auseinander", () => {
  it("Retry liefert `replayed` ⇒ der Editor zieht NACH, und Speichern schreibt die NEUE Fassung", async () => {
    box.appendBehaviour = "antwortverlust-dann-replay";
    await mount();
    await bisZurPunkteliste();

    await uebernehmen();

    // Zwei Versuche, DIESELBE Kennung — daran hängt, dass der zweite überhaupt ein Replay sein kann.
    expect(box.appendCalls).toHaveLength(2);
    expect((box.appendCalls[0] as { operationId: string }).operationId).toBe(
      (box.appendCalls[1] as { operationId: string }).operationId,
    );

    // DER ZUSTAND, auf den es ankommt: der Editor trägt den committeten Dokumenttext. Es gibt
    // keinen alten Stand mehr, der etwas überschreiben könnte.
    expect(editorHtml()).toContain("Beleg eins");
    expect(editorHtml()).toContain("Beleg zwei");
    // Deshalb ist Speichern hier zu Recht frei: `appendUnclear` fällt nur auf `false`, WEIL der
    // Editor nachgezogen ist. Die schädliche Kombination (frei + alter Stand) ist nicht erreichbar.
    expect(speichernKnopf().disabled).toBe(false);

    // Und der Beweis, dass das Freigeben harmlos ist: was der Speichern-Knopf schreibt, ist die
    // committete Fassung — nicht der Stand von vor der Übernahme.
    await click(speichernKnopf());
    const revision = box.revisions[0] as { changes: { bodyHtml: string } } | undefined;
    expect(revision?.changes.bodyHtml ?? "").toContain("Beleg eins");
  });

  it("KALIBRIERUNG (Server VOR mega19): derselbe Retry als 400 ⇒ Speichern frei mit ALTEM Stand", async () => {
    // Dieser Test belegt, dass die obige Zusage nicht von selbst gilt. Er fährt exakt dieselbe
    // Nutzerlage, nur antwortet der Server auf die Wiederholung mit BAD_REQUEST — so, wie es die
    // Route bis mega19 tat, wenn der erste Aufruf den letzten Anhangplatz selbst gefüllt hatte.
    //
    // WAS HIER SICHTBAR WIRD, und warum die Reparatur auf den Server gehört: der Client kann
    // diesen 400 nicht von einer echten Ablehnung unterscheiden. Er tut das Richtige für die
    // Auskunft, die er bekommt — die Auskunft war falsch.
    box.appendBehaviour = "antwortverlust-dann-400";
    await mount();
    await bisZurPunkteliste();

    await uebernehmen();

    expect(box.appendCalls).toHaveLength(2);
    // Der Editor bleibt auf dem ALTEN Stand …
    expect(editorHtml()).not.toContain("Beleg eins");
    expect(editorHtml()).toContain("Alter, geprüfter Absatz.");
    // … und Speichern ist trotzdem frei. Das ist die Datenverlustkante, ausgeschrieben: der
    // Server trägt bereits die neue Fassung, dieser Klick schreibt die alte darüber.
    expect(speichernKnopf().disabled).toBe(false);
    await click(speichernKnopf());
    const revision = box.revisions[0] as { changes: { bodyHtml: string } } | undefined;
    expect(revision?.changes.bodyHtml ?? "").not.toContain("Beleg eins");
    // Genau diese Antwort gibt der Server seit mega19 nicht mehr — belegt in
    // tests/capture/mega19-replay-vor-toren.test.ts (200 `replayed`, nie BAD_REQUEST).
  });
});
