// @vitest-environment jsdom
// JOB 3140 · UX-11 — DAS PRÜFPROTOKOLL, GEMOUNTET GELESEN.
//
// Der Ausgangsstand (`AdminSicherheitDetails.tsx:133-144`) rendert je Eintrag vier Spans: Zeit, den
// ROHEN Aktionscode, die Ziel-UUID und die Akteur-UUID. Keine Beschriftung sagt, welche Kennung wer
// ist; `payload` wird gar nicht gelesen. Wer hier eine Rollenänderung nachvollziehen will, braucht
// eine fremde Zuordnungstabelle.
//
// Dieser Test misst am echten Bauteil, was danach dasteht — und zwar an ZWEI Einträgen zugleich:
//   · dem FRISCHEN (voller Payload: previousRole + beide Namen)  → vier verständliche Angaben,
//   · dem ALTEINTRAG (nur `{ role }`, Konten NICHT im Verzeichnis) → „nicht gespeichert" und
//     „Konto nicht mehr vorhanden", NIEMALS der Name einer heute existierenden Person.
//
// Dazu der Zustandsvertrag aus §9: solange das Verzeichnis lädt oder nicht abrufbar ist, darf die
// TATSACHENAUSSAGE „Konto nicht mehr vorhanden" nicht erscheinen — sie setzt eine erfolgreiche,
// frische Verzeichnisantwort voraus, in der die Kennung fehlt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verzeichnis } = vi.hoisted(() => ({
  // Veränderlich, damit derselbe Mock den geladenen, den hängenden, den gescheiterten und den
  // VERZÖGERTEN Fall bedienen kann. Letzterer ist der Kern von Runde 2: eine Auffrischung, die
  // unterwegs ist, während ein älterer Bestand aus dem Zwischenspeicher schon auf der Fläche steht.
  verzeichnis: {
    art: "geladen" as "geladen" | "haengt" | "fehler" | "verzoegert",
    rows: [] as unknown[],
    freigeben: null as null | (() => void),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      audit: { list: ok([] as unknown[]), verify: ok({ ok: true, count: 0 }) },
      directory: {
        list: vi.fn(async () => {
          if (verzeichnis.art === "haengt") {
            return new Promise(() => {
              /* antwortet nie — der Ladezustand */
            });
          }
          if (verzeichnis.art === "verzoegert") {
            // Antwortet erst, wenn der Test sie freigibt — dazwischen läuft der Abruf WIRKLICH.
            return new Promise((resolve) => {
              verzeichnis.freigeben = () => resolve(verzeichnis.rows);
            });
          }
          if (verzeichnis.art === "fehler") {
            throw new Error("Verzeichnis nicht abrufbar");
          }
          return verzeichnis.rows;
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
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { PruefprotokollDetail } from "../../apps/web/src/pages/AdminSicherheitDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const kette = (seq: number) => ({
  seq,
  at: "2026-09-06T10:00:00.000Z",
  prevHash: `p${seq}`,
  hash: `h${seq}`,
});

/** Der Alteintrag: nur die neue Rolle, keine Namen — und zwei Kennungen ohne heutiges Konto. */
const ALT = {
  ...kette(1),
  actor: "geloescht-admin",
  target: "geloescht-konto",
  action: "user.role-change",
  payload: { role: "admin" },
};

/** Der frische Eintrag: alles, was Lieferung 1 ab jetzt speichert. */
const FRISCH = {
  ...kette(2),
  actor: "a-1",
  target: "t-1",
  action: "user.role-change",
  payload: {
    role: "controller",
    previousRole: "experte",
    actorName: "Ada Admin",
    targetName: "Tom Test",
  },
};

/**
 * JOB 3140 R2 (BENs Korrekturpflicht 1): das Prüfprotokoll ist NICHT nur ein Kontoprotokoll.
 * `services/knowledge-object/src/service.ts:2598` schreibt `ko.created` mit `target: ko.id` — einer
 * Objektkennung. Wer jedes Ziel als Konto liest, behauptet bei jedem Wissensobjekt „Konto nicht mehr
 * vorhanden", weil im Verzeichnis natürlich kein Konto mit dieser Kennung steht.
 */
const KO = {
  ...kette(3),
  actor: "lebt-1",
  target: "ko-existiert",
  action: "ko.created",
  payload: { title: "Reinigung Spritzzone" },
};

/** Ein Kontoereignis ohne Rollenzeilen — für den Zwischenspeicher-Fall. */
const ANMELDUNG = {
  ...kette(4),
  actor: "frisch-1",
  target: "frisch-1",
  action: "auth.login",
  payload: {},
};

const VERZEICHNIS = [{ id: "lebt-1", name: "Lea Lebt" }];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Ein ÄLTERER Verzeichnisbestand im Zwischenspeicher — wie nach einem Seitenwechsel. */
interface Vorbestand {
  readonly rows: readonly { id: string; name: string }[];
  readonly alterMs: number;
}

async function mount(eintraege: readonly unknown[], vorbestand?: Vorbestand): Promise<void> {
  (endpoints.audit.list as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async () => eintraege,
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (vorbestand) {
    // Echter react-query-Zwischenspeicher mit echtem Alter: `staleTime` ist 0, react-query frischt
    // beim Einhängen also wirklich nach — kein von Hand gesetztes Frische-Merkmal.
    qc.setQueryData(["directory"], [...vorbestand.rows], {
      updatedAt: Date.now() - vorbestand.alterMs,
    });
  }
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(PruefprotokollDetail, { onZurueck: () => undefined }),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

const text = (el: Element | null): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function eintrag(seq: number): Element {
  const el = container.querySelector(`[data-audit-eintrag="${seq}"]`);
  if (!el) {
    throw new Error(`Eintrag ${seq} nicht im DOM`);
  }
  return el;
}

function zeile(seq: number, labelKey: string): Element {
  const el = eintrag(seq).querySelector(`[data-audit-zeile="${labelKey}"]`);
  if (!el) {
    throw new Error(`Zeile „${labelKey}“ fehlt bei Eintrag ${seq}`);
  }
  return el;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  verzeichnis.art = "geladen";
  verzeichnis.rows = [...VERZEICHNIS];
  verzeichnis.freigeben = null;
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

describe("JOB 3140 · das Prüfprotokoll sagt, wer wem welche Rolle gegeben hat", () => {
  it("1 DE · das Ereignis heißt „Rolle geändert“, nicht „user.role-change“", async () => {
    await mount([ALT, FRISCH]);
    expect(text(eintrag(2))).toContain(i18n.t("audit.action.user_role_change"));
    expect(i18n.t("audit.action.user_role_change")).toBe("Rolle geändert");
    // Nirgends auf der Fläche steht noch der rohe Code.
    expect(container.textContent).not.toContain("user.role-change");
  });

  it("2 DE · der frische Eintrag nennt beide Namen und beide Rollen", async () => {
    await mount([ALT, FRISCH]);
    expect(text(zeile(2, "audit.detail.actor"))).toContain("Ada Admin");
    expect(text(zeile(2, "audit.detail.target"))).toContain("Tom Test");
    expect(text(zeile(2, "audit.detail.roleBefore"))).toContain(i18n.t("role.name.experte"));
    expect(text(zeile(2, "audit.detail.roleAfter"))).toContain(i18n.t("role.name.controller"));
    // Die Beschriftungen stehen dabei, sonst wäre wieder nicht klar, wer wer ist.
    expect(text(eintrag(2))).toContain(i18n.t("audit.detail.actor"));
    expect(text(eintrag(2))).toContain(i18n.t("audit.detail.target"));
    // Die Kennungen bleiben erreichbar — sie beherrschen die Zeile nur nicht mehr.
    expect(text(zeile(2, "audit.detail.actor"))).toContain("a-1");
    expect(text(zeile(2, "audit.detail.target"))).toContain("t-1");
  });

  it("3 DE · der Alteintrag sagt „nicht gespeichert“ und klebt keinen fremden Namen an", async () => {
    await mount([ALT, FRISCH]);
    expect(text(zeile(1, "audit.detail.roleBefore"))).toBe(i18n.t("audit.detail.notStored"));
    expect(text(zeile(1, "audit.detail.actor"))).toContain(i18n.t("audit.detail.accountGone"));
    expect(text(zeile(1, "audit.detail.actor"))).toContain("geloescht-admin");
    expect(text(zeile(1, "audit.detail.target"))).toContain(i18n.t("audit.detail.accountGone"));
    // Der einzige Name im Verzeichnis darf beim Alteintrag NIRGENDS auftauchen.
    expect(text(eintrag(1))).not.toContain("Lea Lebt");
    // Die NEUE Rolle des Alteintrags ist gespeichert und steht als Rollenname da.
    expect(text(zeile(1, "audit.detail.roleAfter"))).toContain(i18n.t("role.name.admin"));
  });

  it("4 EN · dieselben Angaben, kein Deutsch", async () => {
    await i18n.changeLanguage("en");
    await mount([ALT, FRISCH]);
    expect(text(eintrag(2))).toContain("Role changed");
    expect(text(zeile(2, "audit.detail.actor"))).toContain("Ada Admin");
    expect(text(zeile(2, "audit.detail.roleBefore"))).toContain(i18n.t("role.name.experte"));
    expect(text(zeile(1, "audit.detail.roleBefore"))).toBe(i18n.t("audit.detail.notStored"));
    expect(text(zeile(1, "audit.detail.actor"))).toContain(i18n.t("audit.detail.accountGone"));
    // Kein deutscher Rest in der englischen Fassung.
    expect(text(eintrag(1))).not.toContain("nicht gespeichert");
    expect(text(eintrag(1))).not.toContain("Konto nicht mehr vorhanden");
  });

  it("5 §9 · Verzeichnis lädt → „Name wird geladen“, NIE „Konto nicht mehr vorhanden“", async () => {
    verzeichnis.art = "haengt";
    await mount([ALT, FRISCH]);
    expect(text(zeile(1, "audit.detail.actor"))).toContain(i18n.t("audit.detail.nameLoading"));
    expect(container.textContent).not.toContain(i18n.t("audit.detail.accountGone"));
    // Der frische Eintrag trägt seine Namen im Eintrag selbst — kein Ladezustand für ihn.
    expect(text(zeile(2, "audit.detail.actor"))).toContain("Ada Admin");
  });

  it("6 §9 · Verzeichnis nicht abrufbar → „Name nicht abrufbar“, keine negative Tatsache", async () => {
    verzeichnis.art = "fehler";
    await mount([ALT, FRISCH]);
    expect(text(zeile(1, "audit.detail.actor"))).toContain(i18n.t("audit.detail.nameUnavailable"));
    expect(container.textContent).not.toContain(i18n.t("audit.detail.accountGone"));
    // Die tragende Quelle bleibt sichtbar: das Verzeichnis darf die Karte nicht in einen
    // Fehlerzustand zwingen.
    expect(text(eintrag(2))).toContain("Ada Admin");
    expect(container.querySelector('[data-einst="abfrage-fehler"]')).toBeNull();
  });

  it("7 Lieferung 5 · die Detailzeilen sind reiner Text — kein Tabstopp, kein Bedienelement", async () => {
    await mount([ALT, FRISCH]);
    // Zuerst: es gibt überhaupt Detailzeilen. Ohne diesen Anker wäre der Fall auch dann grün, wenn
    // gar nichts gerendert würde — ein Test, der die Abwesenheit belohnt, pinnt einen Defekt.
    expect(container.querySelectorAll("[data-audit-zeile]").length).toBeGreaterThan(0);
    const bedienbar = container.querySelectorAll(
      "[data-audit-eintrag] button, [data-audit-eintrag] a, [data-audit-eintrag] input, [data-audit-eintrag] [tabindex]",
    );
    expect(bedienbar).toHaveLength(0);
    // Die echten Bedienelemente der Karte bleiben erreichbar (kein tabIndex={-1} eingeschleppt).
    const knoepfe = [...container.querySelectorAll("button")].filter(
      (b) => b.getAttribute("tabindex") !== "-1",
    );
    expect(knoepfe.length).toBeGreaterThan(0);
  });

  it("8 Lieferung 3 · der Druckauszug nimmt die Detailzeilen mit", async () => {
    await mount([ALT, FRISCH]);
    const flaeche = container.querySelector(".print-area");
    expect(flaeche?.contains(eintrag(2))).toBe(true);
    for (const z of container.querySelectorAll("[data-audit-zeile]")) {
      expect(z.closest(".print-hide")).toBeNull();
    }
  });

  // ————————————————————————————————————————————————————————————————————————————————————————
  // JOB 3140 · RUNDE 2 — BENs zwei Korrekturpflichten, je als Laufzeitfall auf der echten Fläche.
  // ————————————————————————————————————————————————————————————————————————————————————————

  it("9 KP1 · gemischtes Protokoll: ein Wissensobjekt als Ziel ist KEIN gelöschtes Konto", async () => {
    // Verzeichnis erfolgreich UND frisch geladen — genau die Lage, in der die negative Aussage
    // erlaubt wäre. Sie gilt trotzdem nur für Kontoziele.
    await mount([ALT, FRISCH, KO]);
    // Der KO-Eintrag nennt sein Ziel als OBJEKT, mit Kennung, ohne jede Aussage über ein Konto.
    const ziel = zeile(3, "audit.detail.targetObject");
    expect(text(ziel)).toContain("ko-existiert");
    expect(text(ziel)).not.toContain(i18n.t("audit.detail.accountGone"));
    expect(text(eintrag(3))).not.toContain(i18n.t("audit.detail.accountGone"));
    // Der Handelnde IST ein Konto und wird weiter aufgelöst.
    expect(text(zeile(3, "audit.detail.actor"))).toContain("Lea Lebt");
    // Keine Rollenzeilen bei einem Ereignis, das keine Rolle kennt.
    expect(eintrag(3).querySelector('[data-audit-zeile="audit.detail.roleBefore"]')).toBeNull();
    // Und die Rollenwechselfälle bleiben unverändert grün (BENs ausdrückliche Auflage).
    expect(text(zeile(2, "audit.detail.target"))).toContain("Tom Test");
    expect(text(zeile(1, "audit.detail.target"))).toContain(i18n.t("audit.detail.accountGone"));
    expect(text(zeile(1, "audit.detail.roleBefore"))).toBe(i18n.t("audit.detail.notStored"));
  });

  it("10 KP2 · alter Bestand mit LAUFENDER Auffrischung behauptet keine Löschung", async () => {
    // Der Zwischenspeicher ist 60 s alt und kennt „frisch-1" nicht — das Konto wurde seither
    // angelegt. Die Auffrischung ist unterwegs und bringt es mit.
    verzeichnis.art = "verzoegert";
    verzeichnis.rows = [{ id: "frisch-1", name: "Nina Neu" }];
    await mount([ANMELDUNG], { rows: [], alterMs: 60_000 });

    // WÄHREND des Abrufs: keine Tatsachenaussage über ein fehlendes Konto (§9).
    expect(container.textContent).not.toContain(i18n.t("audit.detail.accountGone"));
    expect(text(zeile(4, "audit.detail.actor"))).toContain(i18n.t("audit.detail.nameLoading"));
    expect(text(zeile(4, "audit.detail.actor"))).toContain("frisch-1");

    // NACH der erfolgreichen Antwort: der Name steht da.
    await act(async () => {
      verzeichnis.freigeben?.();
      await flush();
    });
    expect(text(zeile(4, "audit.detail.actor"))).toContain("Nina Neu");
    expect(container.textContent).not.toContain(i18n.t("audit.detail.accountGone"));
  });

  it("11 KP2 · erst die erfolgreiche Antwort belegt, dass das Konto wirklich fehlt", async () => {
    // Gegenstück zu Fall 10: dieselbe Lage, aber die Auffrischung bestätigt das Fehlen. Ohne diesen
    // Fall wäre die Korrektur auch dann grün, wenn „nicht mehr vorhanden" NIE mehr erschiene.
    verzeichnis.art = "verzoegert";
    verzeichnis.rows = [{ id: "lebt-1", name: "Lea Lebt" }];
    await mount([ANMELDUNG], { rows: [], alterMs: 60_000 });
    expect(container.textContent).not.toContain(i18n.t("audit.detail.accountGone"));

    await act(async () => {
      verzeichnis.freigeben?.();
      await flush();
    });
    expect(text(zeile(4, "audit.detail.actor"))).toContain(i18n.t("audit.detail.accountGone"));
    expect(text(zeile(4, "audit.detail.actor"))).not.toContain("Lea Lebt");
  });
});
