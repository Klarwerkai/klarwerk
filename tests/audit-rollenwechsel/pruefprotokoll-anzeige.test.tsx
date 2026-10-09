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
      // produkt:20261009:admin-audit-verstaendlich: die Karte liest SEITENWEISE (`audit.seite`).
      audit: { seite: ok({} as unknown), verify: ok({ ok: true, count: 0 }) },
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
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

/**
 * produkt:20261009:admin-audit-verstaendlich: die Einträge als EINE Seite, wie `GET /api/audit/seite`
 * sie liefert — jüngster zuerst, keine ältere Seite, kein freigegebenes Objekt, keine Namensbelege.
 */
function alsSeite(eintraege: readonly unknown[]): {
  entries: unknown[];
  nextBefore: number | null;
  limit: number;
  objekte: Record<string, { titel: string }>;
  namensbelege: unknown[];
} {
  return {
    entries: [...eintraege].reverse(),
    nextBefore: null,
    limit: 25,
    objekte: {},
    namensbelege: [],
  };
}

/** Der Seitentext OHNE die eingeklappten technischen Angaben — das, was in den Spalten steht. */
function spaltentext(): string {
  const kopie = container.cloneNode(true) as HTMLElement;
  for (const technik of kopie.querySelectorAll("[data-audit-technik]")) {
    technik.remove();
  }
  return kopie.textContent ?? "";
}

/** Was der Seitenweg auf eine Anfrage antwortet — Vorgabe: alle Einträge als eine Seite. */
type Seitenantwort = (anfrage: { before?: number }) => unknown;

async function mount(
  eintraege: readonly unknown[],
  vorbestand?: Vorbestand,
  antwort?: Seitenantwort,
): Promise<void> {
  (endpoints.audit.seite as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (anfrage: { before?: number } = {}) => (antwort ? antwort(anfrage) : alsSeite(eintraege)),
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
          // produkt:20261009:admin-audit-verstaendlich: Filter und Seite stehen in der Adresse.
          createElement(
            MemoryRouter,
            { initialEntries: ["/admin?bereich=sicherheit&detail=protokoll"] },
            createElement(PruefprotokollDetail, { onZurueck: () => undefined }),
          ),
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

/** Ein Spaltenkopf der Protokolltabelle (Verwalteransicht, N-0027). */
function spalte(labelKey: string): Element {
  const el = container.querySelector(`th[data-audit-spalte="${labelKey}"]`);
  if (!el) {
    throw new Error(`Spaltenkopf „${labelKey}“ fehlt`);
  }
  return el;
}

/** Eine Kennung in der Detailansicht „Technische Angaben“ eines Eintrags. */
function kennung(seq: number, key: string): Element {
  const el = eintrag(seq).querySelector(`[data-audit-technik] [data-audit-kennung="${key}"]`);
  if (!el) {
    throw new Error(`Kennung „${key}“ fehlt in der Detailansicht von Eintrag ${seq}`);
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
    // In keiner Spalte steht der rohe Code.
    expect(spaltentext()).not.toContain("user.role-change");
    // produkt:20261009:admin-audit-verstaendlich (K2): für die Prüfung bleibt er erreichbar — in
    // den technischen Angaben des Eintrags, zusammen mit dem gespeicherten Zeitpunkt in UTC.
    expect(text(kennung(2, "action"))).toBe("user.role-change");
    expect(text(kennung(2, "at"))).toBe("2026-09-06T10:00:00.000Z");
  });

  it("2 DE · der frische Eintrag nennt beide Namen und beide Rollen", async () => {
    await mount([ALT, FRISCH]);
    expect(text(zeile(2, "audit.detail.actor"))).toContain("Ada Admin");
    expect(text(zeile(2, "audit.detail.target"))).toContain("Tom Test");
    expect(text(zeile(2, "audit.detail.roleBefore"))).toContain(i18n.t("role.name.experte"));
    expect(text(zeile(2, "audit.detail.roleAfter"))).toContain(i18n.t("role.name.controller"));
    // Die Beschriftungen stehen dabei, sonst wäre wieder nicht klar, wer wer ist — seit der
    // Verwalteransicht (N-0027) als Spaltenköpfe der Tabelle.
    expect(text(spalte("audit.detail.actor"))).toBe(i18n.t("audit.detail.actor"));
    expect(text(spalte("audit.detail.target"))).toBe(i18n.t("audit.detail.target"));
    // Die Kennungen bleiben erreichbar — in der Detailansicht des Eintrags, nicht in der Spalte.
    expect(text(kennung(2, "audit.detail.actor"))).toBe("a-1");
    expect(text(kennung(2, "audit.detail.target"))).toBe("t-1");
    expect(text(zeile(2, "audit.detail.actor"))).not.toContain("a-1");
    expect(text(zeile(2, "audit.detail.target"))).not.toContain("t-1");
  });

  it("3 DE · der Alteintrag sagt „nicht gespeichert“ und klebt keinen fremden Namen an", async () => {
    await mount([ALT, FRISCH]);
    expect(text(zeile(1, "audit.detail.roleBefore"))).toBe(i18n.t("audit.detail.notStored"));
    expect(text(zeile(1, "audit.detail.actor"))).toContain(i18n.t("audit.detail.accountGone"));
    expect(text(kennung(1, "audit.detail.actor"))).toBe("geloescht-admin");
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

  it("7 Lieferung 5 · die Detailzeilen sind reiner Text — einziges Bedienelement ist die Detailansicht", async () => {
    await mount([ALT, FRISCH]);
    // Zuerst: es gibt überhaupt Detailzeilen. Ohne diesen Anker wäre der Fall auch dann grün, wenn
    // gar nichts gerendert würde — ein Test, der die Abwesenheit belohnt, pinnt einen Defekt.
    expect(container.querySelectorAll("[data-audit-zeile]").length).toBeGreaterThan(0);
    const bedienbar = container.querySelectorAll(
      "[data-audit-eintrag] button, [data-audit-eintrag] a, [data-audit-eintrag] input, [data-audit-eintrag] [tabindex]",
    );
    expect(bedienbar).toHaveLength(0);
    // Verwalteransicht (N-0027): je Eintrag genau EIN Aufklapper für die Kennungen — und keiner in
    // einer Spalte mit Namen oder Rollen.
    for (const seq of [1, 2]) {
      expect(eintrag(seq).querySelectorAll("summary")).toHaveLength(1);
    }
    for (const z of container.querySelectorAll("[data-audit-zeile]")) {
      expect(z.querySelector("summary, details")).toBeNull();
    }
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
    expect(text(kennung(4, "audit.detail.actor"))).toBe("frisch-1");

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

// ————————————————————————————————————————————————————————————————————————————————————————————————
// Verwalteransicht (aufnahme:20260922:gesamt-auditprotokoll:verwalteransicht) — N-0027 / R-1085.
// Beschriftete deutsche Spalten, Kennungen ergänzend in der Detailansicht, gelöschte Konten benannt,
// letzte Aktionen mit Gesamtzahl.
// ————————————————————————————————————————————————————————————————————————————————————————————————

/** Eine frühere Anmeldung des später gelöschten Kontos — ohne gespeicherten Namen (wie jeder Login). */
const LOGIN_SPAETER_GELOESCHT = {
  ...kette(5),
  actor: "weg-1",
  target: "weg-1",
  action: "auth.login",
  payload: {},
};

/** Die Löschung selbst — seit dieser Lieferung mit dem Namen von damals (`AuthService.deleteUser`). */
const LOESCHUNG = {
  ...kette(6),
  actor: "lebt-1",
  target: "weg-1",
  action: "user.delete",
  payload: { targetName: "Gerd Gelöscht", actorName: "Lea Lebt" },
};

describe("Verwalteransicht · Spalten, Detailansicht, gelöschte Konten, Gesamtzahl", () => {
  it("V1 DE · die Tabelle hat beschriftete deutsche Spalten", async () => {
    await mount([ALT, FRISCH]);
    const koepfe = [...container.querySelectorAll("th[data-audit-spalte]")].map(text);
    expect(koepfe).toEqual([
      "Zeitpunkt",
      "Ereignis",
      "Ausgeführt von",
      "Betroffen",
      "Rolle vorher",
      "Rolle nachher",
      "Technische Angaben",
    ]);
    // Jede Zelle mit Namen oder Rolle steht unter ihrem Kopf: gleiche Position in der Zeile.
    const reihe = eintrag(2) as HTMLTableRowElement;
    const kopfzeile = container.querySelector("thead tr") as HTMLTableRowElement;
    for (const key of ["audit.detail.actor", "audit.detail.roleBefore", "audit.detail.roleAfter"]) {
      const zelle = zeile(2, key) as HTMLTableCellElement;
      const kopf = kopfzeile.cells[zelle.cellIndex];
      expect(kopf?.getAttribute("data-audit-spalte"), key).toBe(key);
    }
    expect(reihe.cells.length).toBe(kopfzeile.cells.length);
  });

  it("V2 · ein Rollenwechsel zeigt in den Spalten Namen und Rollen, die Kennungen nur im Detail", async () => {
    await mount([FRISCH]);
    expect(text(zeile(2, "audit.detail.event"))).toBe("Rolle geändert");
    expect(text(zeile(2, "audit.detail.actor"))).toBe("Ada Admin");
    expect(text(zeile(2, "audit.detail.target"))).toBe("Tom Test");
    expect(text(zeile(2, "audit.detail.roleBefore"))).toBe(i18n.t("role.name.experte"));
    expect(text(zeile(2, "audit.detail.roleAfter"))).toBe(i18n.t("role.name.controller"));
    const detail = eintrag(2).querySelector("[data-audit-technik]");
    expect(detail?.tagName).toBe("DETAILS");
    // Eingeklappt: die Kennungen sind ergänzend, nicht vorrangig.
    expect((detail as HTMLDetailsElement).open).toBe(false);
    expect(text(detail?.querySelector("summary") ?? null)).toBe("Kennungen anzeigen");
    expect(text(kennung(2, "seq"))).toBe("2");
    expect(text(kennung(2, "hash"))).toBe("h2");
  });

  it("V3 · ein gelöschtes Konto bleibt benannt — an der Löschung UND an früheren Einträgen", async () => {
    // Verzeichnis frisch geladen, „weg-1" ist nicht mehr darin: genau die Lage nach einer Löschung.
    await mount([LOGIN_SPAETER_GELOESCHT, LOESCHUNG]);
    expect(text(zeile(6, "audit.detail.target"))).toContain("Gerd Gelöscht");
    expect(text(zeile(6, "audit.detail.actor"))).toContain("Lea Lebt");
    // Die frühere Anmeldung trug keinen Namen — die Kette kennt ihn aus der Löschung.
    expect(text(zeile(5, "audit.detail.actor"))).toContain("Gerd Gelöscht");
    expect(text(zeile(5, "audit.detail.actor"))).toContain(i18n.t("audit.detail.accountGone"));
    expect(text(zeile(5, "audit.detail.target"))).toContain("Gerd Gelöscht");
    // Kein fremder Name klebt am gelöschten Konto.
    expect(text(zeile(5, "audit.detail.actor"))).not.toContain("Lea Lebt");
    expect(text(kennung(5, "audit.detail.actor"))).toBe("weg-1");
  });

  it("V4 §9 · ohne belastbares Verzeichnis: Name aus der Kette, aber keine Löschaussage", async () => {
    verzeichnis.art = "fehler";
    await mount([LOGIN_SPAETER_GELOESCHT, LOESCHUNG]);
    expect(text(zeile(5, "audit.detail.actor"))).toContain("Gerd Gelöscht");
    expect(container.textContent).not.toContain(i18n.t("audit.detail.accountGone"));
  });

  it("V6 · die Quellabgleich-Belege tragen in der Spalte „Ereignis“ einen deutschen Namen", async () => {
    // Bens Befund Nacharbeit 5: `KoService` schreibt diese vier Codes mit dem Objekt als Ziel; ohne
    // Schlüssel stand hier die Humanisierung „ko source removed in origin“.
    const codes = [
      "ko.source-removed-in-origin",
      "ko.source-restored-in-origin",
      "ko.source-attachments-synced",
      "ko.source-restriction-synced",
    ];
    await mount(
      codes.map((action, i) => ({
        ...kette(10 + i),
        actor: "lebt-1",
        target: "ko-existiert",
        action,
        payload: { provider: "confluence", externalId: "123" },
      })),
    );
    const erwartet = {
      "ko.source-removed-in-origin": "Quelle im Ursprungssystem gelöscht",
      "ko.source-restored-in-origin": "Quelle im Ursprungssystem wiederhergestellt",
      "ko.source-attachments-synced": "Anhänge der Quelle abgeglichen",
      "ko.source-restriction-synced": "Leseeinschränkung der Quelle abgeglichen",
    } as const;
    codes.forEach((code, i) => {
      expect(text(zeile(10 + i, "audit.detail.event")), code).toBe(
        erwartet[code as keyof typeof erwartet],
      );
      // Das Ziel ist ein Objekt, kein Konto — keine Löschaussage.
      expect(text(zeile(10 + i, "audit.detail.targetObject"))).toContain("ko-existiert");
    });
    // In den Spalten kein Rohcode und keine Humanisierung — der Rohcode steht nur noch in den
    // technischen Angaben (K2, produkt:20261009:admin-audit-verstaendlich).
    for (const code of codes) {
      expect(spaltentext()).not.toContain(code);
      expect(container.textContent).not.toContain(code.replace(/[._-]/g, " "));
    }
    expect(container.textContent).not.toContain(i18n.t("audit.detail.accountGone"));
  });

  it("V7 · der SCORM-Export trägt in der Spalte „Ereignis“ einen deutschen Namen", async () => {
    // Bens Befund Nacharbeit 7: `lms-export-routes.ts` schreibt `output.lms-export` mit dem
    // Exportpaket als Ziel; ohne Schlüssel stand hier „output lms export“.
    await mount([
      {
        ...kette(20),
        actor: "lebt-1",
        target: "lms-export:EXP-1",
        action: "output.lms-export",
        payload: { format: "SCORM 1.2", objekte: [{ koId: "ko-existiert", version: 1 }] },
      },
    ]);
    expect(text(zeile(20, "audit.detail.event"))).toBe("Für Lernplattform exportiert (SCORM)");
    // produkt:20261009:admin-audit-verstaendlich (K3): der Eintrag hat keinen Namen gespeichert —
    // „Lea Lebt“ ist der HEUTIGE Name aus dem Verzeichnis und steht ausdrücklich so da.
    expect(text(zeile(20, "audit.detail.actor"))).toBe(
      `Lea Lebt ${i18n.t("auditprotokoll.name.heute")}`,
    );
    // Das Paket ist kein Konto — Objektzeile, keine Löschaussage.
    expect(text(zeile(20, "audit.detail.targetObject"))).toContain("lms-export:EXP-1");
    expect(container.textContent).not.toContain("output lms export");
    expect(spaltentext()).not.toContain("output.lms-export");
    expect(container.textContent).not.toContain(i18n.t("audit.detail.accountGone"));
    // Und EN ist eine eigene Fassung, kein deutscher Rest.
    await i18n.changeLanguage("en");
    expect(i18n.t("audit.action.output_lms_export")).toBe("Exported for learning platform (SCORM)");
    await i18n.changeLanguage("de");
  });

  // produkt:20261009:admin-audit-verstaendlich (K4): statt „die 12 jüngsten von insgesamt N" aus der
  // geladenen Gesamtliste liest die Karte SEITENWEISE. Die ältere Seite kommt über den Zeiger des
  // Servers (`nextBefore`), nicht über einen Ausschnitt im Browser.
  it("V5 R-1085 · jüngste Aktionen seitenweise, ältere über den Zeiger, Knopf zur Kettenprüfung", async () => {
    const viele = Array.from({ length: 14 }, (_, i) => ({
      ...kette(i + 1),
      actor: "lebt-1",
      target: "lebt-1",
      action: "auth.login",
      payload: {},
    }));
    // Der Server liefert zwölf Einträge (14 … 3) und den Zeiger 3; die ältere Seite enthält 2 und 1.
    await mount(viele, undefined, (anfrage) =>
      anfrage.before === undefined
        ? { ...alsSeite(viele.slice(2)), nextBefore: 3 }
        : alsSeite(viele.filter((e) => e.seq < (anfrage.before ?? 0))),
    );
    const seite = endpoints.audit.seite as unknown as ReturnType<typeof vi.fn>;
    // Die Karte fordert die erste Seite OHNE Zeiger an — nie eine Gesamtliste.
    expect(seite.mock.calls[0]?.[0]).toEqual({});
    expect(container.querySelectorAll("[data-audit-eintrag]")).toHaveLength(12);
    // Die jüngste Aktion steht oben.
    expect(
      container.querySelector("[data-audit-eintrag]")?.getAttribute("data-audit-eintrag"),
    ).toBe("14");
    expect(text(container.querySelector("caption"))).toBe(
      i18n.t("auditprotokoll.tabelle.seite", { shown: 12 }),
    );
    const knopf = [...container.querySelectorAll("button")].find(
      (b) => text(b) === i18n.t("adm.sich.verify.button"),
    );
    expect(knopf, "Knopf zur Kettenprüfung fehlt").toBeDefined();

    // Ältere Einträge: derselbe Weg, jetzt mit dem Zeiger des Servers.
    const aelter = [...container.querySelectorAll("button")].find(
      (b) => text(b) === i18n.t("auditprotokoll.seite.aelter"),
    );
    expect(aelter, "Knopf „Ältere Einträge“ fehlt").toBeDefined();
    await act(async () => {
      aelter?.click();
      await flush();
    });
    expect(seite.mock.calls.at(-1)?.[0]).toEqual({ before: 3 });
    expect(
      [...container.querySelectorAll("[data-audit-eintrag]")].map((e) =>
        e.getAttribute("data-audit-eintrag"),
      ),
    ).toEqual(["2", "1"]);
    expect(container.textContent).toContain(i18n.t("auditprotokoll.seite.ende"));
    const neueste = [...container.querySelectorAll("button")].find(
      (b) => text(b) === i18n.t("auditprotokoll.seite.neueste"),
    );
    expect(neueste, "Rückweg zu den neuesten Einträgen fehlt").toBeDefined();
  });
});
