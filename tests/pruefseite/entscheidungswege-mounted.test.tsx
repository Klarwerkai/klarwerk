// @vitest-environment jsdom
// ================================================================================================
// JOB 3061 · H2 — DIE VIER KNÖPFE FÜHREN AUF DIE VORHANDENEN SERVERWEGE, NICHT AUF NEUE.
// ================================================================================================
//
// Die Mockups vom 04.09. geben den Knöpfen neue NAMEN („Links gilt", „Rechts behalten", „Kein
// Widerspruch"). Genau dort liegt die Gefahr dieses Auftrags: ein neuer Name, der auf einen
// anderen — oder gar keinen — Weg zeigt. Ein Knopf „Kein Widerspruch", der in Wahrheit eskaliert,
// sähe im Zielbild richtig aus und wäre eine Lüge.
//
// Diese Datei mountet die ECHTEN Seiten und misst je Knopf, WELCHER Endpunkt gerufen wird und
// welcher NICHT. Sie ist zugleich der Fall, den der Auftrag als Gegenprobe benennt (§8.2): „Knopf
// „Kein Widerspruch" auf `escalate` umhängen → der Mount-Test des Serverwegs rot."
//
// Und sie hält die Ehrlichkeitszusagen aus §8.5 fest, die an genau diesen Wegen hängen:
//   · „Links behalten" führt auf `keepSeparate` — KEIN Merge, KEINE Löschung; der Vermerk sagt nur,
//     welche Seite maßgeblich ist.
//   · „Links gilt" schreibt nichts, bevor ein Mensch die vorbelegte Begründung bestätigt hat.
//   · Kein „Freigegeben" ohne 2xx: der Entscheidungsknopf ist gesperrt, solange der Server läuft.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({
  konflikte: [] as unknown[],
  duplikate: [] as unknown[],
  board: [] as unknown[],
  rufe: [] as { weg: string; args: unknown[] }[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const merk =
    (weg: string, wert: unknown = {}) =>
    (...args: unknown[]) => {
      daten.rufe.push({ weg, args });
      return Promise.resolve(wert);
    };
  return {
    endpoints: {
      conflicts: {
        list: merk("conflicts.list", []),
        escalate: merk("conflicts.escalate"),
        secondOpinion: merk("conflicts.secondOpinion"),
        dismiss: merk("conflicts.dismiss"),
      },
      duplicates: {
        list: merk("duplicates.list", []),
        dismiss: merk("duplicates.dismiss"),
        keepSeparate: merk("duplicates.keepSeparate"),
        linkRelated: merk("duplicates.linkRelated"),
        setStatus: merk("duplicates.setStatus"),
      },
      ko: { list: merk("ko.list", []), act: merk("ko.act"), aiCheckRetry: merk("ko.aiCheckRetry") },
      validation: {
        board: merk("validation.board", []),
        overview: merk("validation.overview", []),
      },
      lifecycle: { pending: merk("lifecycle.pending", []) },
      directory: { list: merk("directory.list", []) },
      aiCheck: {
        coverageSummary: merk("aiCheck.coverageSummary", {
          total: 0,
          incomplete: 0,
          unchecked: 0,
          noCoverage: 0,
        }),
      },
      reasoner: {
        status: merk("reasoner.status", {
          active: false,
          mode: "off",
          reachable: "unknown",
          tasks: {},
        }),
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const KO = (id: string, titel: string, aussage: string) => ({
  id,
  title: titel,
  statement: aussage,
  status: "validiert",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  category: "Konstruktion",
  createdAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [KO("ko-a", "Design Guide", "A gilt."), KO("ko-b", "Nasszonen", "B gilt.")];

const KONFLIKT = {
  id: "c-1",
  koA: "ko-a",
  koB: "ko-b",
  type: "truth",
  description: "Widerspruch",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  origin: "auto",
  detector: { trigger: "background", method: "model", confidence: 0.9, rationale: "Grund" },
  createdAt: "2026-08-01T06:00:00.000Z",
};

const DUPLIKAT = {
  id: "d-1",
  koA: "ko-a",
  koB: "ko-b",
  relation: "identisch",
  aspects: [],
  eigenanteilA: "A",
  eigenanteilB: "B",
  recommendation: "zusammenfuehren_pruefen",
  status: "offen",
  pairKey: "ko-a|ko-b",
  origin: "auto",
  detector: { trigger: "background", method: "model", lexicalScore: 0.9, confidence: 0.9 },
  createdAt: "2026-08-01T06:00:00.000Z",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(seite: () => JSX.Element, pfad: string): Promise<void> {
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
              createElement(MemoryRouter, { initialEntries: [pfad] }, createElement(seite)),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

function knopf(kennung: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="pruefen-knopf-${kennung}"]`);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Knopf ${kennung} nicht auf der gemounteten Fläche`);
  }
  return el;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

function wege(): string[] {
  return daten.rufe.map((r) => r.weg);
}

/** Der deutsche Wortlaut eines Schlüssels — die Probe läuft auf Deutsch. */
const de = (key: string): string => String(i18n.getResource("de", "translation", key));

beforeEach(async () => {
  await i18n.changeLanguage("de");
  daten.rufe = [];
  daten.konflikte = [KONFLIKT];
  daten.duplikate = [DUPLIKAT];
  (endpoints.conflicts.list as unknown as (...a: unknown[]) => unknown) = () => {
    daten.rufe.push({ weg: "conflicts.list", args: [] });
    return Promise.resolve(daten.konflikte);
  };
  (endpoints.duplicates.list as unknown as (...a: unknown[]) => unknown) = () => {
    daten.rufe.push({ weg: "duplicates.list", args: [] });
    return Promise.resolve(daten.duplikate);
  };
  (endpoints.ko.list as unknown as (...a: unknown[]) => unknown) = () => Promise.resolve(KOS);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

// ================================================================================================
// K · KONFLIKTE
// ================================================================================================
describe("JOB 3061 · H2 · Konflikte: die vier Knöpfe und ihre Serverwege", () => {
  it("K1 · „Kein Widerspruch“ ruft `conflicts.dismiss` — und ausdrücklich NICHT `escalate`", async () => {
    await mount(Conflicts, "/konflikte");
    daten.rufe = [];

    await klick(knopf("kein-widerspruch"));

    expect(wege()).toContain("conflicts.dismiss");
    expect(
      wege(),
      "Kein-Widerspruch eskaliert — der Knopf zeigt auf den falschen Weg",
    ).not.toContain("conflicts.escalate");
    expect(wege(), "Kein-Widerspruch löst auf statt zu verwerfen").not.toContain("ko.act");
  });

  it("K2 · „Links gilt“ schreibt NICHTS, bevor der Mensch die vorbelegte Begründung bestätigt", async () => {
    await mount(Conflicts, "/konflikte");
    daten.rufe = [];

    await klick(knopf("links-gilt"));

    // Der Klick öffnet nur das Feld — kein Serveraufruf.
    expect(wege()).not.toContain("ko.act");
    const feld = container.querySelector(
      '[data-testid="pruefen-aufloesung"] textarea',
    ) as HTMLTextAreaElement | null;
    expect(feld, "das Begründungsfeld ist nicht aufgeklappt").not.toBeNull();
    // Vorbelegt UND editierbar: der Titel der linken Seite steht drin, das Feld ist kein Nur-Lese-Feld.
    expect(feld?.value).toContain("Design Guide");
    expect(feld?.readOnly).toBe(false);
  });

  it("K3 · erst die Bestätigung ruft `resolve-conflict` — mit der Begründung des Menschen", async () => {
    await mount(Conflicts, "/konflikte");
    await klick(knopf("links-gilt"));
    daten.rufe = [];

    const bestaetigen = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === i18n.t("con.resolveConfirm"),
    );
    expect(bestaetigen, "der Bestätigungsknopf fehlt").toBeDefined();
    await klick(bestaetigen as HTMLElement);

    expect(wege()).toContain("ko.act");
    const ruf = daten.rufe.find((r) => r.weg === "ko.act");
    expect((ruf?.args[1] as { action?: string })?.action).toBe("resolve-conflict");
    expect((ruf?.args[1] as { decision?: string })?.decision).toContain("Design Guide");
  });

  it("K4 · „Rechts gilt“ belegt die ANDERE Seite vor — sonst wäre die Wahl ohne Wirkung", async () => {
    await mount(Conflicts, "/konflikte");
    await klick(knopf("rechts-gilt"));

    const feld = container.querySelector(
      '[data-testid="pruefen-aufloesung"] textarea',
    ) as HTMLTextAreaElement | null;
    expect(feld?.value).toContain("Nasszonen");
    expect(feld?.value).not.toContain("Design Guide");
  });

  it("K5 · „Beide gelten, je nach Kontext“ belegt den Kontextvermerk vor", async () => {
    await mount(Conflicts, "/konflikte");
    await klick(knopf("beide-gelten"));

    const feld = container.querySelector(
      '[data-testid="pruefen-aufloesung"] textarea',
    ) as HTMLTextAreaElement | null;
    expect(feld?.value).toBe(i18n.t("con.prefill.both"));
  });

  it("K6 · „Zweitmeinung anfragen“ klappt das vorhandene Feld auf und ruft erst auf Bestätigung", async () => {
    await mount(Conflicts, "/konflikte");
    daten.rufe = [];

    await klick(knopf("zweitmeinung"));
    expect(wege()).not.toContain("conflicts.secondOpinion");
    expect(container.querySelector('[data-testid="pruefen-zweitmeinung"] textarea')).not.toBeNull();
  });
});

// ================================================================================================
// D · DUPLIKATE
// ================================================================================================
describe("JOB 3061 · H2 · Duplikate: kein Zusammenführen, kein Löschen", () => {
  it("D1 · „Links behalten“ ruft `keepSeparate` mit dem Vermerk der maßgeblichen Seite", async () => {
    await mount(Duplicates, "/duplikate");
    daten.rufe = [];

    await klick(knopf("links-behalten"));

    expect(wege()).toContain("duplicates.keepSeparate");
    const ruf = daten.rufe.find((r) => r.weg === "duplicates.keepSeparate");
    expect(ruf?.args[0]).toBe("d-1");
    expect(String(ruf?.args[1] ?? "")).toContain("Design Guide");
    // Die Ehrlichkeitszusage aus §8.5: nichts wird zusammengeführt und nichts gelöscht.
    expect(wege()).not.toContain("duplicates.linkRelated");
    expect(wege()).not.toContain("ko.remove");
    expect(wege()).not.toContain("ko.act");
  });

  it("D2 · „Rechts behalten“ vermerkt die ANDERE Seite", async () => {
    await mount(Duplicates, "/duplikate");
    daten.rufe = [];

    await klick(knopf("rechts-behalten"));

    const ruf = daten.rufe.find((r) => r.weg === "duplicates.keepSeparate");
    expect(String(ruf?.args[1] ?? "")).toContain("Nasszonen");
    expect(String(ruf?.args[1] ?? "")).not.toContain("Design Guide");
  });

  it("D3 · „Beide behalten, verknüpfen“ ruft `linkRelated`", async () => {
    await mount(Duplicates, "/duplikate");
    daten.rufe = [];

    await klick(knopf("beide-verknuepfen"));

    expect(wege()).toContain("duplicates.linkRelated");
    expect(wege()).not.toContain("duplicates.keepSeparate");
  });

  it("D4 · „Kein Duplikat“ ruft `dismiss`", async () => {
    await mount(Duplicates, "/duplikate");
    daten.rufe = [];

    await klick(knopf("kein-duplikat"));

    expect(wege()).toContain("duplicates.dismiss");
    expect(wege()).not.toContain("duplicates.keepSeparate");
    expect(wege()).not.toContain("duplicates.linkRelated");
  });
});

// ================================================================================================
// S · DER STATUSÜBERGANG „GESCHLOSSEN" MIT ABSCHLUSSGRUND (bens Korrekturpflicht 1, Runde 4)
// ================================================================================================
//
// Ben verlangt für den Duplikat-Reiter den Beleg: „Mount-/API-Test … löst beide Übergänge aus und
// prüft Request, Serverantwort und anschließend sichtbaren Status."
//
// Die Fälle hier tun das für den Übergang, den es im Produkt GIBT: `offen → geschlossen`, je einmal
// mit jedem der drei Abschlussgründe (`kept_separate`, `linked_related`, `dismissed`). Gemessen
// wird die ganze Kette: welcher Endpunkt mit welchem Argument, was der Server zurückgibt, und was
// danach auf der Fläche steht — Status „Geschlossen" im „Mehr", der Abschlussgrund als Satz, und
// KEINE Entscheidungsknöpfe mehr.
//
// DER ZWEITE ÜBERGANG AUS §5.5, „In Bearbeitung", GIBT ES SEIT RUNDE 6 (bens Korrekturpflicht 1).
// Bis dahin führte `OverlapStatus` den Wert, aber kein Schreiber im ganzen Modul konnte ihn setzen;
// ein Menüeintrag dafür wäre eine Scheinfunktion gewesen. Jetzt trägt ihn
// `OverlapService.takeInProgress` über `POST /api/duplicates/:id/status`. Gemessen wird er NICHT
// hier, sondern im Block ST weiter unten — denn er ist ein MENÜweg und kein Fussband-Knopf, und
// genau diese Verwechslung war bens Befund.
describe("JOB 3061 · H2 · Duplikate: der Abschluss, ganz — Request, Antwort, sichtbarer Status", () => {
  /** Der Server antwortet mit dem GESCHLOSSENEN Eintrag; danach liefert die Liste ihn so aus. */
  const antwortetMitAbschluss = (
    weg: "keepSeparate" | "linkRelated" | "dismiss",
    grund: string,
  ) => {
    const geschlossen = {
      ...DUPLIKAT,
      status: "geschlossen",
      closedAt: "2026-09-04T09:00:00.000Z",
      resolution: { by: "u1", at: "2026-09-04T09:00:00.000Z", reason: grund },
    };
    (endpoints.duplicates[weg] as unknown as (...a: unknown[]) => unknown) = (
      ...args: unknown[]
    ) => {
      daten.rufe.push({ weg: `duplicates.${weg}`, args });
      daten.duplikate = [geschlossen];
      return Promise.resolve(geschlossen);
    };
    return geschlossen;
  };

  const sichtbar = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
  const mehrAufklappen = (): void => {
    for (const d of container.querySelectorAll('[data-testid^="pruefen-mehr-"]')) {
      (d as HTMLDetailsElement).open = true;
    }
  };

  it("S1 · „Links behalten“ → Serverantwort `kept_separate` → Status „Geschlossen“ und der Grund stehen da", async () => {
    const antwort = antwortetMitAbschluss("keepSeparate", "kept_separate");
    await mount(Duplicates, "/duplikate");
    daten.rufe = [];
    // Vorher: offen, und die Entscheidung ist möglich.
    mehrAufklappen();
    expect(sichtbar()).toContain(de("dup.status.offen"));
    expect(sichtbar()).toContain(de("dup.side.left"));

    await klick(knopf("links-behalten"));

    // 1 · Request
    const ruf = daten.rufe.find((r) => r.weg === "duplicates.keepSeparate");
    expect(ruf, "der Endpunkt wurde nicht gerufen").toBeDefined();
    expect(ruf?.args[0]).toBe("d-1");
    // 2 · Serverantwort
    expect(antwort.status).toBe("geschlossen");
    expect(antwort.resolution.reason).toBe("kept_separate");
    // 3 · sichtbarer Status danach
    mehrAufklappen();
    expect(sichtbar()).toContain(de("dup.status.geschlossen"));
    expect(sichtbar()).toContain(de("dup.reason.kept_separate"));
    expect(sichtbar(), "Abschlussgrund ohne den Abschluss-Satz").toContain(de("dup.closed"));
    // Und keine zweite Entscheidung über eine bereits abgeschlossene Sache.
    expect(sichtbar()).not.toContain(de("dup.side.left"));
  });

  it("S2 · „Beide behalten, verknüpfen“ → `linked_related` steht als Abschlussgrund da", async () => {
    antwortetMitAbschluss("linkRelated", "linked_related");
    await mount(Duplicates, "/duplikate");

    await klick(knopf("beide-verknuepfen"));

    mehrAufklappen();
    expect(sichtbar()).toContain(de("dup.status.geschlossen"));
    expect(sichtbar()).toContain(de("dup.reason.linked_related"));
    expect(sichtbar()).not.toContain(de("dup.reason.kept_separate"));
  });

  it("S3 · „Kein Duplikat“ → `dismissed` steht als Abschlussgrund da", async () => {
    antwortetMitAbschluss("dismiss", "dismissed");
    await mount(Duplicates, "/duplikate");

    await klick(knopf("kein-duplikat"));

    mehrAufklappen();
    expect(sichtbar()).toContain(de("dup.status.geschlossen"));
    expect(sichtbar()).toContain(de("dup.reason.dismissed"));
  });

  it("S4 · kein Abschluss ohne 2xx: scheitert der Server, bleibt der Status „Offen“ und der Fehler steht da", async () => {
    (endpoints.duplicates.keepSeparate as unknown as (...a: unknown[]) => unknown) = () => {
      daten.rufe.push({ weg: "duplicates.keepSeparate", args: [] });
      return Promise.reject(new Error("Netz weg"));
    };
    await mount(Duplicates, "/duplikate");

    await klick(knopf("links-behalten"));

    mehrAufklappen();
    expect(wege()).toContain("duplicates.keepSeparate");
    expect(sichtbar(), "Abschluss ohne Serverantwort behauptet").not.toContain(
      de("dup.status.geschlossen"),
    );
    expect(sichtbar()).toContain(de("dup.status.offen"));
    expect(sichtbar()).toContain(de("state.error"));
    // Die Entscheidung bleibt möglich — der Weg ist nicht verbraucht.
    expect(sichtbar()).toContain(de("dup.side.left"));
  });
});

// ================================================================================================
// ST · DUPLIKATE — „STATUS SETZEN" IM „···"-MENÜ (bens Korrekturpflicht 1 aus Runde 5)
// ================================================================================================
//
// Warum diese Fälle NEBEN S1–S4 stehen und sie nicht ersetzen: Das sind zwei verschiedene Wege.
// Oben wählt der KNOPF den Abschlussgrund („Links behalten" ⇒ `kept_separate`); hier wählt ihn der
// MENSCH aus allen dreien. bens Befund war genau diese Verwechslung — Runde 5 hat den Menüweg als
// erfüllt verbucht und dabei einen Fussband-Knopf gedrückt.
//
// Deshalb GEHT JEDER FALL HIER DURCH DAS MENÜ: erst `pruefen-menue-duplikat-a` klicken, dann NUR im
// Bereich `pruefen-menue-panel-duplikat-a` weiterarbeiten. Und gemessen wird die ganze Kette, die
// bens Korrekturpflicht nennt: Request (welcher Endpunkt, welche Argumente), Serverantwort,
// Auffrischung (die Liste wird neu geholt) und der danach SICHTBARE Folgestatus.
describe("JOB 3061 · H2 · Duplikate: „Status setzen“ im „···“-Menü — Request, Antwort, Folgestatus", () => {
  /** Öffnet das „···"-Menü der genannten Karte und gibt seinen Inhaltsbereich zurück. */
  const menueOeffnen = async (kennung: "duplikat-a" | "duplikat-b"): Promise<HTMLElement> => {
    const ausloeser = container.querySelector(`[data-testid="pruefen-menue-${kennung}"]`);
    if (!(ausloeser instanceof HTMLElement)) {
      throw new Error(`Menü ${kennung} nicht auf der gemounteten Fläche`);
    }
    await klick(ausloeser);
    const panel = container.querySelector(`[data-testid="pruefen-menue-panel-${kennung}"]`);
    if (!(panel instanceof HTMLElement)) {
      throw new Error(`Menü ${kennung} liess sich nicht öffnen`);
    }
    return panel;
  };

  /** Ein Eintrag NUR aus dem geöffneten Menü — nicht irgendwo von der Seite. */
  const imMenue = (panel: HTMLElement, text: string): HTMLElement => {
    for (const el of panel.querySelectorAll("button")) {
      if ((el.textContent ?? "").trim() === text) {
        return el as HTMLElement;
      }
    }
    throw new Error(
      `„${text}" steht nicht im Menü (dort: ${(panel.innerText || panel.textContent) ?? ""})`,
    );
  };

  /** Der Text der aufgeklappten „Mehr"-Bereiche — dort wohnt der sichtbare Status. */
  const imMehr = (): string => {
    let text = "";
    for (const d of container.querySelectorAll('[data-testid^="pruefen-mehr-"]')) {
      (d as HTMLDetailsElement).open = true;
      text += ` ${d.textContent ?? ""}`;
    }
    return text.replace(/\s+/g, " ");
  };

  /** Der Server antwortet mit dem fortgeschriebenen Eintrag; die Liste liefert ihn danach so aus. */
  const serverAntwortet = (naechster: Record<string, unknown>): Record<string, unknown> => {
    (endpoints.duplicates.setStatus as unknown as (...a: unknown[]) => unknown) = (
      ...args: unknown[]
    ) => {
      daten.rufe.push({ weg: "duplicates.setStatus", args });
      daten.duplikate = [naechster];
      return Promise.resolve(naechster);
    };
    return naechster;
  };

  it("ST1 · „In Bearbeitung“ aus dem Menü: Request, Serverantwort, Auffrischung, sichtbarer Folgestatus", async () => {
    const antwort = serverAntwortet({ ...DUPLIKAT, status: "in_bearbeitung" });
    await mount(Duplicates, "/duplikate");
    daten.rufe = [];

    const panel = await menueOeffnen("duplikat-a");
    // Vorher: der Vorgang ist offen, und der Menüweg bietet BEIDE Übergänge an.
    expect(imMehr()).toContain(de("dup.status.offen"));
    expect(panel.textContent).toContain(de("dup.setStatus"));
    await klick(imMenue(panel, de("dup.status.in_bearbeitung")));

    // 1 · Request — der neue Endpunkt, mit Kennung und Zielzustand.
    const ruf = daten.rufe.find((r) => r.weg === "duplicates.setStatus");
    expect(ruf, "der Statusweg wurde nicht gerufen").toBeDefined();
    expect(ruf?.args[0]).toBe("d-1");
    expect((ruf?.args[1] as { status: string }).status).toBe("in_bearbeitung");
    // Ein Zustandswechsel ist KEIN Abschluss — es darf kein Grund mitreisen.
    expect((ruf?.args[1] as { reason?: string }).reason).toBeUndefined();
    // 2 · Serverantwort
    expect(antwort.status).toBe("in_bearbeitung");
    // 3 · Auffrischung — die Liste wurde nach der Antwort neu geholt.
    expect(wege(), "keine Auffrischung nach dem Statuswechsel").toContain("duplicates.list");
    // 4 · sichtbarer Folgestatus, und zwar im „Mehr" und nicht bloss irgendwo.
    expect(imMehr()).toContain(de("dup.status.in_bearbeitung"));
    expect(imMehr()).not.toContain(de("dup.status.offen"));
    // Der Vorgang ist NICHT abgeschlossen: die Entscheidung bleibt möglich.
    expect((container.textContent ?? "").replace(/\s+/g, " ")).toContain(de("dup.side.left"));
  });

  it("ST2 · „Geschlossen“ ohne Abschlussgrund geht nicht — der Knopf ist gesperrt und ruft nichts", async () => {
    serverAntwortet({ ...DUPLIKAT, status: "geschlossen" });
    await mount(Duplicates, "/duplikate");
    daten.rufe = [];

    const panel = await menueOeffnen("duplikat-a");
    await klick(imMenue(panel, de("dup.status.geschlossen")));

    const senden = panel.querySelector('[data-testid="pruefen-abschluss-senden"]');
    expect(senden, "das Abschlussformular fehlt").toBeInstanceOf(HTMLButtonElement);
    expect((senden as HTMLButtonElement).disabled, "Abschluss ohne Grund möglich").toBe(true);
    // Und der gesperrte Knopf ist auch wirklich stumm.
    await klick(senden as HTMLElement);
    expect(wege()).not.toContain("duplicates.setStatus");
  });

  it("ST3 · „Geschlossen“ mit gewähltem Abschlussgrund: Request mit `reason`, Antwort, sichtbarer Abschluss", async () => {
    const antwort = serverAntwortet({
      ...DUPLIKAT,
      status: "geschlossen",
      closedAt: "2026-09-04T09:00:00.000Z",
      resolution: {
        by: "u1",
        at: "2026-09-04T09:00:00.000Z",
        reason: "linked_related",
        note: "Beide Fassungen bleiben.",
      },
    });
    await mount(Duplicates, "/duplikate");
    daten.rufe = [];

    const panel = await menueOeffnen("duplikat-a");
    await klick(imMenue(panel, de("dup.status.geschlossen")));

    // Der Mensch wählt den Grund — nicht der Knopf. Genau das ist der Unterschied zu S1–S3.
    const radios = [...panel.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual(["kept_separate", "linked_related", "dismissed"]);
    await klick(radios[1] as HTMLElement);
    const feld = panel.querySelector('input[type="text"]') as HTMLInputElement;
    await act(async () => {
      // React hört auf `input`; der native Setter umgeht den Wert-Tracker.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
        v: string,
      ) => void;
      setter.call(feld, "Beide Fassungen bleiben.");
      feld.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });

    const senden = panel.querySelector(
      '[data-testid="pruefen-abschluss-senden"]',
    ) as HTMLButtonElement;
    expect(senden.disabled, "der Knopf blieb trotz gewähltem Grund gesperrt").toBe(false);
    await klick(senden);

    // 1 · Request — Zielzustand, GEWÄHLTER Grund und der Vermerk.
    const ruf = daten.rufe.find((r) => r.weg === "duplicates.setStatus");
    expect(ruf?.args[0]).toBe("d-1");
    expect(ruf?.args[1]).toMatchObject({
      status: "geschlossen",
      reason: "linked_related",
      note: "Beide Fassungen bleiben.",
    });
    // Und ausdrücklich NICHT über einen der Fussband-Wege.
    expect(wege()).not.toContain("duplicates.keepSeparate");
    expect(wege()).not.toContain("duplicates.linkRelated");
    expect(wege()).not.toContain("duplicates.dismiss");
    // 2 · Serverantwort · 3 · Auffrischung
    expect(antwort.status).toBe("geschlossen");
    expect(wege()).toContain("duplicates.list");
    // 4 · sichtbarer Folgestatus samt Abschlussgrund.
    expect(imMehr()).toContain(de("dup.status.geschlossen"));
    expect(imMehr()).toContain(de("dup.reason.linked_related"));
    const alles = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(alles).toContain(de("dup.closed"));
    expect(alles, "nach dem Abschluss noch entscheidbar").not.toContain(de("dup.side.left"));
  });

  it("ST4 · ein bereits abgeschlossener Vorgang bietet den Statusweg gar nicht erst an", async () => {
    daten.duplikate = [
      {
        ...DUPLIKAT,
        status: "geschlossen",
        resolution: { by: "u1", at: "2026-09-04T09:00:00.000Z", reason: "dismissed", note: null },
      },
    ];
    await mount(Duplicates, "/duplikate");

    const panel = await menueOeffnen("duplikat-a");
    // Die Vergleichswege bleiben — nur der Schreibweg ist weg, weil es nichts mehr zu setzen gibt.
    expect(panel.textContent).toContain(de("dup.compareReadonly"));
    expect(panel.textContent, "Statusweg auf einem geschlossenen Vorgang").not.toContain(
      de("dup.setStatus"),
    );
  });
});
