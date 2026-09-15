// @vitest-environment jsdom
// ================================================================================================
// JOB 4025 · DIE FLÄCHE — der Betreiber sieht seine Sicherungen, ohne ein Terminal zu öffnen.
// ================================================================================================
//
// Pedis Auftrag (Eingang `EINGANG-20260914-STARTAUFTRAG-PEDI-ff3fe5bb.md`, Punkt 3): „Backup
// anlegen, Restore einspielen, Update einspielen, jeweils mit sichtbarem Ergebnis im Admin und
// Server-Nachweis." Hier steht das SICHTBARE ERGEBNIS für Backup.
//
// U1 fährt den NUTZERWEG: `/admin?bereich=system` → Zeile → Karte. Kein direkter Sprung in die
// Komponente; eine Karte, die nur ein Test öffnet, hat der Betreiber nicht.
//
// U4 misst dagegen das ZUSTANDSMODELL der Karte (§9) und braucht dafür die Hand am Abrufzustand —
// laden, Fehler, Cache mit laufender und mit gescheiterter Auffrischung lassen sich über eine
// Navigation nicht ansteuern. Er montiert die Karte deshalb unter einem eigenen `QueryClient`,
// aber mit demselben echten Bauteil und derselben echten i18n. Gewartet wird dabei auf den
// ZUSTAND, nie auf die Uhr (Lehre JOB 3945 R2).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => ({ id: "u-admin", name: "Ada", email: "a@x.de", role: "admin" })),
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { SicherungenAuskunft } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { adminHref } from "../../apps/web/src/lib/adminSections";
import { SicherungDetail } from "../../apps/web/src/pages/AdminBetriebDetails";
import {
  type Stand,
  abbauen,
  beruhige,
  klicke,
  montiere,
  setzeStufe2,
  sprache,
} from "../admin-navigation/vorrichtung";

const WEG = "/api/admin/sicherungen";
const t = (key: string): string => i18n.t(key);

const VOLL: SicherungenAuskunft = {
  zustand: "gelesen",
  verzeichnis: "/srv/klarwerk/backups",
  gelesenUtc: "2026-09-14T12:00:00.000Z",
  sicherungen: [
    {
      datei: "klarwerk-20260912T030000Z.dump",
      zeitpunktUtc: "2026-09-12T03:00:00.000Z",
      groesseBytes: 4_194_304,
      beglaubigt: true,
      pruefsumme: "c".repeat(64),
    },
    {
      datei: "klarwerk-20260905T030000Z.dump",
      zeitpunktUtc: "2026-09-05T03:00:00.000Z",
      groesseBytes: 2048,
      beglaubigt: false,
      pruefsumme: null,
    },
  ],
};
const LEER: SicherungenAuskunft = {
  zustand: "gelesen",
  verzeichnis: "/srv/klarwerk/backups",
  gelesenUtc: "2026-09-14T12:00:00.000Z",
  sicherungen: [],
};
const OHNE_VERZEICHNIS: SicherungenAuskunft = {
  zustand: "kein_verzeichnis",
  verzeichnis: "/srv/klarwerk/backups",
  gelesenUtc: "2026-09-14T12:00:00.000Z",
};
const UNLESBAR: SicherungenAuskunft = {
  zustand: "unlesbar",
  verzeichnis: "/srv/klarwerk/backups",
  gelesenUtc: "2026-09-14T12:00:00.000Z",
  grund: "EACCES",
};
/**
 * DER FALL DES PRÜFERS AUS RUNDE 6: eine Sicherung liegt da, ihre Prüfsummendatei NICHT. Genau in
 * dieser Lage behauptete der feste Satz aus Runde 6 die Datei trotzdem („… und dass die
 * Prüfsummendatei danebenliegt"). Am Server ist die Lage seit Runde 2 gemessen
 * (`sicherungen-auskunft.test.ts`, S2) — hier wird gemessen, was die Fläche daraus macht.
 */
const OHNE_SIDECAR: SicherungenAuskunft = {
  zustand: "gelesen",
  verzeichnis: "/srv/klarwerk/backups",
  gelesenUtc: "2026-09-14T12:00:00.000Z",
  sicherungen: [
    {
      datei: "klarwerk-20260914T101500Z.dump",
      zeitpunktUtc: "2026-09-14T10:15:00.000Z",
      groesseBytes: 8192,
      beglaubigt: false,
      pruefsumme: null,
    },
  ],
};
/**
 * DER FALL DES PRÜFERS AUS RUNDE 5, in der Sprache des Drahtes: die Sidecar liegt daneben und ist
 * formgerecht (`beglaubigt: true`), ihr Hash gehört aber NICHT zum Inhalt der Datei. Dass die Route
 * genau das liefert, ist am echten Dateisystem gemessen
 * (`sicherungen-auskunft.test.ts`, S9) — hier wird geprüft, was die Fläche daraus macht.
 */
const FALSCHE_PRUEFSUMME: SicherungenAuskunft = {
  zustand: "gelesen",
  verzeichnis: "/srv/klarwerk/backups",
  gelesenUtc: "2026-09-14T12:00:00.000Z",
  sicherungen: [
    {
      datei: "klarwerk-20260913T060000Z.dump",
      zeitpunktUtc: "2026-09-13T06:00:00.000Z",
      groesseBytes: 1_048_576,
      beglaubigt: true,
      pruefsumme: "b".repeat(64),
    },
  ],
};

// ------------------------------------------------------------------------------------------------
// DAS NETZ — genau eine Adresse, und ihre Antwort steuert der Fall.
// ------------------------------------------------------------------------------------------------
/** Was der nächste Abruf tut. Ein Versprechen, das der Fall selbst auflöst = laufende Auffrischung. */
type Geber = () => Promise<SicherungenAuskunft>;
let geber: Geber = async () => VOLL;
let rufe = 0;
/** Jeder Ruf, den die Fläche an diese Adresse richtet — mit seinem Verfahren. */
let protokoll: { verfahren: string; pfad: string }[] = [];

function netz(): void {
  rufe = 0;
  protokoll = [];
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string }) => {
      const pfad = String(eingabe);
      if (!pfad.endsWith(WEG)) {
        // Jede andere Abfrage der Fläche scheitert ehrlich — die Karte muss auch dann tragen.
        throw new Error(`kein Netz in diesem Prüfstand: ${pfad}`);
      }
      rufe += 1;
      // `api.get` reicht kein `init` durch; ohne Verfahren ist ein `fetch` GET. Ein Schreibweg
      // trüge hier ausdrücklich POST/PUT/PATCH/DELETE — und genau das wird unten gemessen.
      protokoll.push({ verfahren: (init?.method ?? "GET").toUpperCase(), pfad });
      const antwort = await geber();
      return {
        status: 200,
        ok: true,
        statusText: "OK",
        text: async () => JSON.stringify(antwort),
      };
    },
  });
}

/** Ein Versprechen, das der Fall von Hand auflöst oder ablehnt. */
function haltestelle(): {
  warten: Geber;
  liefere: (a: SicherungenAuskunft) => void;
  scheitere: () => void;
} {
  let aufloesen: ((a: SicherungenAuskunft) => void) | null = null;
  let ablehnen: ((f: Error) => void) | null = null;
  const versprechen = new Promise<SicherungenAuskunft>((ja, nein) => {
    aufloesen = ja;
    ablehnen = nein;
  });
  // Ein bereits abgelehntes Versprechen ohne Abnehmer wäre eine unbehandelte Ablehnung.
  versprechen.catch(() => undefined);
  return {
    warten: () => versprechen,
    liefere: (a) => aufloesen?.(a),
    scheitere: () => ablehnen?.(new Error("Auffrischung gescheitert")),
  };
}

let stand: Stand | null = null;

beforeEach(() => {
  setzeStufe2(true);
  geber = async () => VOLL;
  netz();
});

afterEach(async () => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  await sprache("de");
  vi.clearAllMocks();
});

async function admin(adresse: string): Promise<Stand> {
  const s = montiere(adresse);
  stand = s;
  await beruhige();
  return s;
}

function text(s: Stand, testId: string): string | null {
  return s.container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? null;
}

// ================================================================================================
// U1 · DER WEG — von `/admin?bereich=system` bis zum Ehrlichkeitssatz.
// ================================================================================================
describe("JOB 4025 · U1 · der Nutzerweg zur Sicherungsauskunft", () => {
  it("die Zeile steht unter „System“, der Klick öffnet die Karte mit Liste und Ehrlichkeitssatz", async () => {
    const s = await admin(adminHref("system"));

    const zeile = s.container.querySelector('[data-testid="zeile-sicherung"]');
    expect(zeile, "unter „System“ steht keine Zeile „Sicherung“").not.toBeNull();
    expect(zeile?.textContent).toContain(t("adm.backup.title"));

    await klicke(zeile);
    const karte = s.container.querySelector('[data-testid="detail-sicherung"]');
    expect(karte, "der Klick hat die Detailkarte nicht geöffnet").not.toBeNull();
    expect(s.container.querySelector('[data-testid="ort"]')?.textContent).toBe(
      adminHref("system", "sicherung"),
    );

    // Die Liste trägt beide Dateien, jede mit ihrem Beglaubigungswort.
    const eintraege = [...s.container.querySelectorAll("[data-sicherung]")].map(
      (e) => e.getAttribute("data-sicherung") ?? "",
    );
    expect(eintraege).toEqual(["klarwerk-20260912T030000Z.dump", "klarwerk-20260905T030000Z.dump"]);
    const erster = s.container.querySelector(
      '[data-sicherung="klarwerk-20260912T030000Z.dump"]',
    )?.textContent;
    expect(erster).toContain(t("adm.backup.certified"));
    expect(erster, "der Zeitpunkt der Sicherung fehlt").toContain("2026");
    const zweiter = s.container.querySelector(
      '[data-sicherung="klarwerk-20260905T030000Z.dump"]',
    )?.textContent;
    expect(zweiter).toContain(t("adm.backup.uncertified"));
    expect(zweiter).not.toContain(t("adm.backup.certified"));

    // Verzeichnis und Zeitpunkt der Lesung stehen dabei (Lieferung 6).
    expect(text(s, "sicherung-verzeichnis")).toContain("/srv/klarwerk/backups");
    expect(text(s, "sicherung-gelesen"), "der Zeitpunkt der Lesung fehlt").toContain("2026");

    // DER SATZ, DEN DIE FLÄCHE DEM BETREIBER SCHULDET (Lehre JOB 3954: was eine Messung nicht
    // beweist, steht dabei). `docs/operations/restore-drill.md:80` sagt dasselbe für den Drill.
    expect(text(s, "sicherung-ehrlichkeit"), "der Ehrlichkeitssatz fehlt").toBe(
      t("adm.backup.honesty"),
    );
    expect(t("adm.backup.honesty"), "der Schlüssel löst nicht auf").not.toBe("adm.backup.honesty");
  });

  it("U1b · die Zeile nennt die Zahl der Sicherungen, nicht nur ein Chevron", async () => {
    const s = await admin(adminHref("system"));
    expect(s.container.querySelector('[data-testid="zeile-sicherung"]')?.textContent).toContain(
      "2",
    );
  });
});

// ================================================================================================
// U2/U3 · „KEINE" UND „NICHT FESTSTELLBAR" SIND ZWEI VERSCHIEDENE SÄTZE.
// ================================================================================================
describe("JOB 4025 · U2/U3 · Leerbefund und Fehlerbefund sind unterscheidbar", () => {
  async function karte(antwort: SicherungenAuskunft): Promise<Stand> {
    geber = async () => antwort;
    const s = await admin(adminHref("system", "sicherung"));
    expect(
      s.container.querySelector('[data-testid="detail-sicherung"]'),
      "die Karte ging nicht auf",
    ).not.toBeNull();
    return s;
  }

  it("U2 · eine erfolgreiche, leere Lesung sagt „keine Sicherung gefunden“ — mit dem Verzeichnis", async () => {
    const s = await karte(LEER);
    const leer = text(s, "sicherung-leer");
    expect(leer, "die belegte Negativaussage fehlt").not.toBeNull();
    expect(leer).toContain("/srv/klarwerk/backups");
    expect(s.container.querySelector('[data-testid="sicherung-unbekannt"]')).toBeNull();
    expect(s.container.querySelectorAll("[data-sicherung]")).toHaveLength(0);
  });

  it("U3a · ein fehlendes Verzeichnis sagt „nicht feststellbar“, NIE „keine Sicherung“", async () => {
    const s = await karte(OHNE_VERZEICHNIS);
    const unbekannt = text(s, "sicherung-unbekannt");
    expect(unbekannt).not.toBeNull();
    expect(unbekannt).toContain(t("adm.backup.unknown"));
    expect(s.container.querySelector('[data-testid="sicherung-leer"]')).toBeNull();
  });

  it("U3b · ein unlesbares Verzeichnis nennt zusätzlich den technischen Grund", async () => {
    const s = await karte(UNLESBAR);
    const unbekannt = text(s, "sicherung-unbekannt");
    expect(unbekannt).toContain(t("adm.backup.unknown"));
    expect(unbekannt, "der Grund der Störung fehlt").toContain("EACCES");
    expect(s.container.querySelector('[data-testid="sicherung-leer"]')).toBeNull();
  });

  it("U3c · und die beiden Texte sind NACHWEISLICH verschieden", async () => {
    const s1 = await karte(LEER);
    const leerText = text(s1, "sicherung-leer");
    abbauen(s1);
    stand = null;

    const s2 = await karte(OHNE_VERZEICHNIS);
    const fehlerText = text(s2, "sicherung-unbekannt");

    expect(leerText, "der Leertext ist leer — der Vergleich wäre trivial").toBeTruthy();
    expect(fehlerText, "der Fehlertext ist leer — der Vergleich wäre trivial").toBeTruthy();
    expect(fehlerText).not.toBe(leerText);
  });
});

// ================================================================================================
// U4 · DAS ZUSTANDSMODELL (§9) — an der echten Karte, mit der Hand am Abruf.
// ================================================================================================
describe("JOB 4025 · U4 · laden, Fehler, Cache mit laufender und mit gescheiterter Auffrischung", () => {
  let wurzel: Root | null = null;
  let behaelter: HTMLDivElement | null = null;
  let qc: QueryClient | null = null;

  async function montiereKarte(): Promise<HTMLDivElement> {
    behaelter = document.createElement("div");
    document.body.appendChild(behaelter);
    wurzel = createRoot(behaelter);
    qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    act(() => {
      wurzel?.render(
        createElement(
          QueryClientProvider,
          { client: qc as QueryClient },
          createElement(SicherungDetail, { onZurueck: () => undefined }),
        ),
      );
    });
    await beruhige(3);
    return behaelter;
  }

  /** Warten auf einen ZUSTAND, nicht auf die Uhr: bis die Bedingung trägt oder die Runden enden. */
  async function bis(pruefung: () => boolean, was: string): Promise<void> {
    for (let i = 0; i < 60; i += 1) {
      if (pruefung()) {
        return;
      }
      await beruhige(1);
    }
    throw new Error(`Zustand nie erreicht: ${was}`);
  }

  afterEach(() => {
    if (wurzel) {
      const r = wurzel;
      act(() => r.unmount());
      wurzel = null;
    }
    behaelter?.remove();
    behaelter = null;
    qc = null;
  });

  it("U4a · LADEN sagt „wird geladen“ — keine Zahl, keine Liste, kein „keine“", async () => {
    const halt = haltestelle();
    geber = halt.warten;
    const c = await montiereKarte();

    expect(c.querySelector('[data-einst="laedt"]'), "der Ladezustand fehlt").not.toBeNull();
    expect(c.querySelector('[data-testid="sicherung-leer"]'), "„keine“ vor den Daten").toBeNull();
    expect(c.querySelectorAll("[data-sicherung]")).toHaveLength(0);

    halt.liefere(VOLL);
    await bis(
      () => c.querySelectorAll("[data-sicherung]").length === 2,
      "die Liste nach dem Laden",
    );
  });

  it("U4b · FEHLER zeigt die Fehlerbox mit Ausweg — und nie „keine Sicherung“", async () => {
    geber = async () => {
      throw new Error("Serverfehler");
    };
    const c = await montiereKarte();
    await bis(
      () => c.querySelector('[data-einst="abfrage-fehler"]') !== null,
      "der Fehlerzustand der Karte",
    );
    expect(c.querySelector('[data-testid="sicherung-leer"]')).toBeNull();
    expect(c.querySelector('[data-testid="sicherung-unbekannt"]')).toBeNull();
  });

  it("U4c · CACHE MIT LAUFENDER AUFFRISCHUNG: der letzte Stand bleibt sichtbar und trägt ihn", async () => {
    const c = await montiereKarte();
    await bis(() => c.querySelectorAll("[data-sicherung]").length === 2, "der erste Bestand");

    const halt = haltestelle();
    geber = halt.warten;
    act(() => {
      void qc?.refetchQueries({ queryKey: ["admin", "sicherungen"] });
    });
    await bis(() => c.querySelector('[data-einst="stand"]') !== null, "die Standzeile");

    // Der Bestand ist NICHT verschwunden, während nachgeladen wird (REGELN §7).
    expect(c.querySelectorAll("[data-sicherung]")).toHaveLength(2);
    expect(c.querySelector('[data-testid="sicherung-ehrlichkeit"]')).not.toBeNull();
    // Laufende Auffrischung ist KEINE Störung: „nicht aktualisiert" steht hier noch nicht da.
    expect(c.querySelector('[data-einst="stand"]')?.textContent).not.toContain(
      t("einst.wert.nichtAktualisiert"),
    );
    // Und die Altersangabe steht noch, denn die vorliegende Lesung ist unverändert gültig.
    expect(c.querySelector('[data-testid="sicherung-alter"]')).not.toBeNull();

    halt.liefere(VOLL);
    await bis(() => c.querySelector('[data-einst="stand"]') === null, "das Ende der Auffrischung");
  });

  it("U4d · CACHE MIT GESCHEITERTER AUFFRISCHUNG: Bestand bleibt, ist markiert, Alter verschwindet", async () => {
    const c = await montiereKarte();
    await bis(() => c.querySelectorAll("[data-sicherung]").length === 2, "der erste Bestand");
    expect(
      c.querySelector('[data-testid="sicherung-alter"]'),
      "ohne Altersangabe im Gutfall misst der Fall nichts",
    ).not.toBeNull();

    geber = async () => {
      throw new Error("Auffrischung gescheitert");
    };
    act(() => {
      void qc?.refetchQueries({ queryKey: ["admin", "sicherungen"] });
    });
    await bis(
      () =>
        (c.querySelector('[data-einst="stand"]')?.textContent ?? "").includes(
          t("einst.wert.nichtAktualisiert"),
        ),
      "die Markierung „nicht aktualisiert“",
    );

    // Der Bestand bleibt SICHTBAR — nichts wird geleert (REGELN §7).
    expect(c.querySelectorAll("[data-sicherung]")).toHaveLength(2);
    expect(
      c.querySelector('[data-einst="abfrage-fehler"]'),
      "der Bestand wurde verworfen",
    ).toBeNull();
    // Die Altersangabe hängt an einer FRISCHEN, erfolgreichen Lesung (§9) — jetzt fehlt sie.
    expect(
      c.querySelector('[data-testid="sicherung-alter"]'),
      "„vor n Tagen“ ohne frische Lesung ist eine Behauptung",
    ).toBeNull();
  });

  it("U4e · leerer Bestand plus gescheiterte Auffrischung: „keine“ bleibt stehen, aber markiert", async () => {
    geber = async () => LEER;
    const c = await montiereKarte();
    await bis(
      () => c.querySelector('[data-testid="sicherung-leer"]') !== null,
      "die belegte Negativaussage",
    );

    geber = async () => {
      throw new Error("Auffrischung gescheitert");
    };
    act(() => {
      void qc?.refetchQueries({ queryKey: ["admin", "sicherungen"] });
    });
    await bis(
      () =>
        (c.querySelector('[data-einst="stand"]')?.textContent ?? "").includes(
          t("einst.wert.nichtAktualisiert"),
        ),
      "die Markierung „nicht aktualisiert“",
    );
    // Der Satz von vorhin bleibt sichtbar — er ist aber nicht mehr als frische Wahrheit zu lesen.
    expect(c.querySelector('[data-testid="sicherung-leer"]')).not.toBeNull();
  });
});

// ================================================================================================
// U5 · DREI SPRACHEN — jeder neue Schlüssel DE, EN und NL (Lehre JOB 3956).
// ================================================================================================
describe("JOB 4025 · U5 · die Karte spricht Deutsch, Englisch und Niederländisch", () => {
  it("jede Sprache liefert einen nichtleeren, von den anderen verschiedenen Titel — an der Fläche", async () => {
    const titel: Record<string, string> = {};
    for (const lng of ["de", "en", "nl"] as const) {
      await sprache(lng);
      const s = await admin(adminHref("system", "sicherung"));
      const kopf = s.container.querySelector('[data-testid="detail-sicherung"]')?.textContent ?? "";
      const erwartet = i18n.getFixedT(lng)("adm.backup.title");
      expect(erwartet, `${lng}: der Titel löst nicht auf`).not.toBe("adm.backup.title");
      expect(kopf, `${lng}: der Titel steht nicht in der Karte`).toContain(erwartet);
      // Und kein roher Schlüssel steht auf der Fläche.
      expect(kopf, `${lng}: ein roher Schlüssel steht in der Karte`).not.toContain("adm.backup.");
      titel[lng] = erwartet;
      abbauen(s);
      stand = null;
    }
    expect(new Set(Object.values(titel)).size, `drei gleiche Titel: ${JSON.stringify(titel)}`).toBe(
      3,
    );
  });

  it("auch Ehrlichkeitssatz, Leerbefund und Fehlerbefund gibt es in allen drei Sprachen", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      const fest = i18n.getFixedT(lng);
      for (const schluessel of [
        "adm.backup.honesty",
        "adm.backup.none",
        "adm.backup.unknown",
        "adm.backup.reason.missing",
        "adm.backup.reason.unreadable",
        "adm.backup.certified",
        "adm.backup.uncertified",
      ]) {
        const wert = fest(schluessel);
        expect(wert, `${lng}/${schluessel} fehlt`).not.toBe(schluessel);
        expect(String(wert).trim().length, `${lng}/${schluessel} ist leer`).toBeGreaterThan(0);
      }
    }
  });
});

// ================================================================================================
// U7 · DIE MARKE BEHAUPTET KEINEN HASHVERGLEICH — in keiner der drei Sprachen.
// ================================================================================================
//
// DER BEFUND, DER DIESEN FALL ERZWUNGEN HAT (Prüfer BEN, Runde 5): `i18n.ts` sagte auf Englisch
// „checksum verified", während die Route ausschliesslich die Form und den Endnamen der Sidecar
// liest. Bei einer formgerechten Sidecar mit falschem Hash stand damit eine Verifikationsbehauptung
// an einer Datei, deren Prüfsumme niemand verglichen hatte — und die drei Sprachen sagten dabei
// obendrein Verschiedenes (de „beglaubigt", en „checksum verified", nl „controlesom aanwezig").
//
// DIESER FALL IST DIE DAUERPRÜFUNG DAGEGEN. Er fährt GENAU den Zustand des Befunds und liest die
// Marke einzeln (`sicherung-marke`) — nicht den halben Kartentext: der Ehrlichkeitssatz und die
// Seitenhilfe dürfen sehr wohl das Wort „prüft" tragen, sie sagen ja gerade, WER prüft. Verboten
// ist die Behauptung an der MARKE, und sie ist es in jeder Sprache.
describe("JOB 4025 · U7 · „Prüfsummendatei vorhanden“ statt „geprüft“", () => {
  /** Jedes Wort, mit dem eine Fläche einen stattgefundenen Abgleich behaupten würde. */
  const VERIFIKATIONSWORT = /verif|geprüft|geprueft|beglaubig|gecontroleerd|nagerekend|validated/i;
  /** Was die Marke stattdessen benennen MUSS: die DATEI. Sonst wäre das Verbot oben allein erfüllbar,
   *  indem man den Text leert — eine leere Marke behauptet auch nichts und sagt auch nichts. */
  const DATEIWORT: Record<"de" | "en" | "nl", string> = {
    de: "Prüfsummendatei",
    en: "checksum file",
    nl: "controlesombestand",
  };

  it("U7a · an der Fläche: die Marke nennt in de/en/nl die Datei und behauptet keinen Abgleich", async () => {
    const gesehen: Record<string, string> = {};
    for (const lng of ["de", "en", "nl"] as const) {
      await sprache(lng);
      geber = async () => FALSCHE_PRUEFSUMME;
      const s = await admin(adminHref("system", "sicherung"));
      expect(
        s.container.querySelector('[data-testid="detail-sicherung"]'),
        `${lng}: die Karte ging nicht auf`,
      ).not.toBeNull();

      const marke = (text(s, "sicherung-marke") ?? "").trim();
      expect(marke.length, `${lng}: die Marke fehlt — es gäbe nichts zu prüfen`).toBeGreaterThan(0);
      expect(
        VERIFIKATIONSWORT.test(marke),
        `${lng}: die Marke „${marke}“ behauptet einen Abgleich, den niemand gefahren hat`,
      ).toBe(false);
      expect(marke, `${lng}: die Marke nennt die Prüfsummendatei nicht`).toContain(DATEIWORT[lng]);
      expect(marke).toBe(i18n.getFixedT(lng)("adm.backup.certified"));
      gesehen[lng] = marke;

      abbauen(s);
      stand = null;
    }
    // Drei Sprachen, drei Fassungen desselben Satzes — und keine davon ist die deutsche.
    expect(new Set(Object.values(gesehen)).size, JSON.stringify(gesehen)).toBe(3);
  });

  it("U7b · im Wörterbuch: weder `certified` noch `uncertified` trägt in irgendeiner Sprache ein Verifikationswort", () => {
    const verstoesse: string[] = [];
    for (const lng of ["de", "en", "nl"] as const) {
      for (const schluessel of ["adm.backup.certified", "adm.backup.uncertified"]) {
        const wert = String(i18n.getFixedT(lng)(schluessel));
        expect(wert, `${lng}/${schluessel} löst nicht auf`).not.toBe(schluessel);
        if (VERIFIKATIONSWORT.test(wert)) {
          verstoesse.push(`${lng}/${schluessel}: „${wert}“`);
        }
      }
    }
    expect(verstoesse, "eine Marke behauptet einen Abgleich, den die Route nicht fährt").toEqual(
      [],
    );
  });

  it("U7c · der Ehrlichkeitssatz benennt den fehlenden Abgleich — in allen drei Sprachen", async () => {
    // Bis Runde 5 nannte er nur die Wiederherstellung. Genau die Lücke dazwischen — „die Datei ist
    // da, aber stimmt ihr Inhalt?" — war der Befund; also muss der Satz sie ausdrücklich zumachen.
    //
    // ER MUSS SIE ABER ZUMACHEN, OHNE ETWAS VORAUSZUSETZEN: dieser Fall verlangt nur, dass das Wort
    // „Prüfsumme" überhaupt vorkommt. Dass es dabei keine Behauptung über eine VORHANDENE Datei
    // wird, ist die Aussage von U8a — beide Fälle zusammen halten den Satz in der Mitte fest.
    const wort: Record<"de" | "en" | "nl", string> = {
      de: "Prüfsumme",
      en: "checksum",
      nl: "controlesom",
    };
    for (const lng of ["de", "en", "nl"] as const) {
      const satz = String(i18n.getFixedT(lng)("adm.backup.honesty"));
      expect(satz, `${lng}: der Ehrlichkeitssatz schweigt über die Prüfsumme`).toContain(wort[lng]);
    }
    // Und er steht wirklich auf der Fläche, nicht nur im Wörterbuch.
    await sprache("en");
    geber = async () => FALSCHE_PRUEFSUMME;
    const s = await admin(adminHref("system", "sicherung"));
    const sichtbar = text(s, "sicherung-ehrlichkeit") ?? "";
    expect(sichtbar).toBe(i18n.getFixedT("en")("adm.backup.honesty"));
    expect(sichtbar, "der sichtbare Satz schweigt über die Prüfsumme").toContain("checksum");
  });
});

// ================================================================================================
// U8 · DER FESTE SATZ SETZT NICHTS VORAUS — UND JEDE SICHERUNG TRÄGT IHREN EIGENEN BEFUND.
// ================================================================================================
//
// DER BEFUND, DER DIESEN FALL ERZWUNGEN HAT (Prüfer BEN, Runde 6): Runde 6 hatte den fehlenden
// Hashvergleich in den FESTEN Ehrlichkeitssatz geschrieben — „Diese Liste belegt, dass Dateien
// vorliegen UND dass die Prüfsummendatei danebenliegt". Der Prüfer hat einen Eintrag OHNE Sidecar
// gemountet: die Marke sagte richtig, dass sie fehlt, und der Satz darunter behauptete sie trotzdem.
// Es ist derselbe Fehlertyp wie in Runde 5, nur eine Zeile weiter — der sichtbare Wortlaut ging
// über den Nachweis hinaus.
//
// DIE REGEL, DIE HIER GEMESSEN WIRD: Ein Satz, der in JEDER Lage dasteht, darf nur sagen, was in
// JEDER Lage gilt. Alles, was von einer einzelnen Sicherung abhängt, gehört an ihren Eintrag. U8a
// fährt den festen Satz durch vier Lagen und drei Sprachen; U8b/U8c prüfen die Zuordnung Zustand →
// SCHLÜSSEL (nicht Wortlaut, Nachführung Runde 7, Punkt 3).
describe("JOB 4025 · U8 · kein fester Satz über die Prüfsummendatei", () => {
  /** Jedes Wort, mit dem ein Text die Prüfsummendatei als DA behaupten würde. */
  const ANWESENHEIT = /vorhanden|daneben|present|sits next|aanwezig|ernaast/i;

  const LAGEN: { name: string; antwort: SicherungenAuskunft }[] = [
    { name: "gemischte Liste", antwort: VOLL },
    { name: "eine Sicherung OHNE Prüfsummendatei", antwort: OHNE_SIDECAR },
    { name: "erfolgreich leer", antwort: LEER },
    { name: "Verzeichnis unlesbar", antwort: UNLESBAR },
  ];

  it("U8a · der feste Satz behauptet in KEINER Lage und KEINER Sprache eine Prüfsummendatei", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      await sprache(lng);
      for (const lage of LAGEN) {
        geber = async () => lage.antwort;
        const s = await admin(adminHref("system", "sicherung"));
        const satz = (text(s, "sicherung-ehrlichkeit") ?? "").trim();
        // Ohne diese Zeile wäre der Fall trivial wahr: ein fehlender Satz behauptet auch nichts.
        expect(satz.length, `${lng}/${lage.name}: der feste Satz fehlt`).toBeGreaterThan(0);
        expect(
          ANWESENHEIT.test(satz),
          `${lng}/${lage.name}: der feste Satz setzt die Prüfsummendatei voraus: „${satz}“`,
        ).toBe(false);
        abbauen(s);
        stand = null;
      }
    }
  });

  it("U8b · OHNE Prüfsummendatei trägt der Eintrag den `uncertified`-Schlüssel, und nichts sagt „vorhanden“", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      await sprache(lng);
      const fest = i18n.getFixedT(lng);
      geber = async () => OHNE_SIDECAR;
      const s = await admin(adminHref("system", "sicherung"));

      const marke = (text(s, "sicherung-marke") ?? "").trim();
      expect(marke, `${lng}: die Marke trägt nicht den Fehlt-Schlüssel`).toBe(
        String(fest("adm.backup.uncertified")),
      );
      expect(marke, `${lng}: die Marke trägt den Vorhanden-Schlüssel`).not.toBe(
        String(fest("adm.backup.certified")),
      );

      // UND DER GANZE BEFUNDBEREICH DAZU: Liste plus fester Satz. Genau hier stand der Fehler aus
      // Runde 6 — nicht an der Marke, sondern in dem Satz darunter.
      const liste = s.container.querySelector('[data-testid="sicherung-liste"]')?.textContent ?? "";
      const sichtbar = `${liste} ${text(s, "sicherung-ehrlichkeit") ?? ""}`;
      expect(
        ANWESENHEIT.test(sichtbar),
        `${lng}: die Fläche behauptet eine Prüfsummendatei, die es nicht gibt: „${sichtbar}“`,
      ).toBe(false);

      abbauen(s);
      stand = null;
    }
  });

  it("U8c · MIT Prüfsummendatei trägt der Eintrag den `certified`-Schlüssel — je Eintrag einzeln", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      await sprache(lng);
      const fest = i18n.getFixedT(lng);
      geber = async () => VOLL;
      const s = await admin(adminHref("system", "sicherung"));

      // `VOLL` führt beide Lagen nebeneinander: der jüngere Eintrag hat seine Prüfsummendatei, der
      // ältere nicht. Gemessen wird die ZUORDNUNG, Eintrag für Eintrag — eine Karte, die beide
      // gleich markiert, wäre hier rot.
      const marken = [...s.container.querySelectorAll("[data-sicherung]")].map((zeile) =>
        (zeile.querySelector('[data-testid="sicherung-marke"]')?.textContent ?? "").trim(),
      );
      expect(marken, `${lng}: die Zuordnung Zustand → Schlüssel stimmt nicht`).toEqual([
        String(fest("adm.backup.certified")),
        String(fest("adm.backup.uncertified")),
      ]);
      expect(
        String(fest("adm.backup.certified")),
        `${lng}: beide Schlüssel lösen gleich auf — der Vergleich wäre trivial`,
      ).not.toBe(String(fest("adm.backup.uncertified")));

      abbauen(s);
      stand = null;
    }
  });
});

// ================================================================================================
// U6 · DIE KARTE RUFT GENAU EINE ADRESSE, UND ZWAR LESEND.
// ================================================================================================
describe("JOB 4025 · U6 · die Auskunft ist lesend", () => {
  it("Zeile und Karte fragen ausschließlich lesend, und nur diese eine Adresse", async () => {
    const s = await admin(adminHref("system"));
    // Schon die ZEILE fragt — die Zahl im Reiter „System" entsteht nicht erst beim Öffnen.
    expect(rufe, "die Fläche hat gar nicht gefragt").toBeGreaterThan(0);
    await klicke(s.container.querySelector('[data-testid="zeile-sicherung"]'));
    expect(
      s.container.querySelector('[data-testid="detail-sicherung"]'),
      "die Karte ging nicht auf",
    ).not.toBeNull();

    // DIE AUSSAGE DIESES FALLS: ausnahmslos jeder Ruf, den Zeile und Karte zusammen auslösen, ist
    // ein LESENDER Ruf auf genau diese eine Adresse. Kein Auslösen, kein Löschen, kein
    // Herunterladen (Auftrag §10) — und auch kein zweiter Endpunkt, der dieselbe Auskunft anders
    // beantwortete.
    expect(protokoll.length, "kein einziger Ruf aufgezeichnet").toBeGreaterThan(0);
    expect(
      protokoll.filter((r) => r.verfahren !== "GET"),
      "ein schreibender Ruf an der Sicherungsauskunft",
    ).toEqual([]);
    expect([...new Set(protokoll.map((r) => r.pfad))]).toEqual(["/api/admin/sicherungen"]);

    // NICHT GEMESSEN WIRD HIER DIE ZAHL DER RUFE. Zeile und Karte teilen sich denselben
    // Abfrageschlüssel, also denselben Zwischenspeicher; ob das Öffnen der Karte einen zweiten Ruf
    // auslöst, entscheidet allein die Frischezeit des `QueryClient` — im Produkt 30 s
    // (`apps/web/src/main.tsx:43-45`), in diesem Prüfstand keine (`tests/admin-navigation/
    // vorrichtung.tsx:197`). Eine Zahl, die nur von der Bauform des Prüfstands abhängt, wäre kein
    // Befund über das Produkt.
  });
});
