// @vitest-environment jsdom
// ================================================================================================
// JOB 3098 (Q6b) — DIE DRITTE FLÄCHE: DIE KARTE „FÜR DICH" AUF `/start`.
// ================================================================================================
//
// JOB 3084 hat die Offline-Regel gebaut und an ZWEI Flächen gereicht (Lesefläche, Menüblatt „Eigene
// Objekte"). Der DRITTE Aufrufer, `pages/Start.tsx`, rief `eigeneKollisionStart` mit EINEM Argument
// und fiel damit auf den Vorgabewert `ONLINE_WENN_UNGEFRAGT = true` — die Kollisionszeile in „FÜR
// DICH" stand nach einer Netztrennung ohne jeden Vorbehalt da. Genau das ist Codex' Befund R-1585,
// nur an der dritten Fläche.
//
// ZWEI FEHLERRICHTUNGEN, UND BEIDE WERDEN HIER GEMESSEN:
//   · zu VIEL behaupten: die Karte gilt als frisch, obwohl das Gerät offline ist (S-1, S-2).
//   · zu WENIG zeigen: der bereits bekannte Befund verschwindet offline still (ebenfalls S-1, S-2,
//     die auf die Zeile bestehen). Das wäre A27 rückwärts — „eine Kollision, die der Autorin
//     verschwiegen wird" (`lib/eigeneKollision.ts:426-428`).
// Dazwischen liegt der kalte Einstieg (S-3): ohne früheren Stand entsteht KEINE Zeile und KEINE
// Zahl, sondern die Störung.
//
// UND DIE KARTE MUSS DIE QUELLEN KENNEN, AUS DENEN IHRE ZEILEN STAMMEN (S-4, S-5): die
// Kollisionszeile entsteht allein aus `duplicate-signal` und `ko.list`; standen die zwei nicht in
// `arbeitsQuellen`, behauptete die Karte Frische über eine Zeile, deren Quelle noch lud oder
// gescheitert war. Dieselbe Regel, aus der `eigeneKollision.ts:467-479` die KO-Liste in die
// Gesamtlage nimmt.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 3 — DER WEG AUS DER STÖRUNG HERAUS.
// ------------------------------------------------------------------------------------------------
//
// Ben hat an Runde 1 einen zweiten Fehler gefunden, der nicht die Anzeige betrifft, sondern die
// HANDLUNG: die Karte war um zwei Quellen gewachsen, ihr Wiederholen-Weg nicht. Wörtlich: „Nach
// behobenem Serverfehler erzeugt der Klick jeweils null Abrufe der betroffenen Quelle." Ein Knopf,
// der die Störung nicht behebt, die er anbietet. Das ist in S-7/S-8 gemessen und behoben.
//
// ------------------------------------------------------------------------------------------------
// JOB 3118 (Q6e) — WAS BIS HIERHER AUSDRÜCKLICH FEHLTE, STEHT JETZT DA.
// ------------------------------------------------------------------------------------------------
//
// Bis JOB 3118 hielten S-1 und S-3 den HEUTIGEN, mangelhaften Stand fest — samt der drei
// Unwahrheiten, die Ben an der gemounteten Seite gemessen hat: „online leer laden, Netz trennen, am
// selben QueryClient neu mounten ergibt wörtlich `Nichts offen.Veraltet – Aktualisierung
// fehlgeschlagenErneut versuchen`." Alle drei sassen in `components/start/StartKarten.tsx`, das
// AUSSERHALB der Zielpfade von JOB 3098 lag; die Vorprüfung des Tors hat Runde 2 genau daran rot
// gemacht (`ZIELPFAD-VERSTOSS`). Der Kopfkommentar sagte deshalb hier zu, die Fälle nachzuführen,
// sobald die Datei aufgenommen ist — das ist mit JOB 3118 geschehen:
//   · S-1 und S-3 messen jetzt den behobenen Stand (Offline-Satz statt „Aktualisierung
//     fehlgeschlagen"; kein Wiederholen-Knopf ohne Netz).
//   · S-6 und S-9 sind die zwei Wege des Befunds selbst: leer geladen und mit Bestand, jeweils
//     offline WIEDERBETRETEN — der kalte Start der Komponente, nicht das Ereignis am stehenden Baum.
//   · Z2b und Z4b messen dasselbe an der Nachbarkarte „ZULETZT": zwei verschiedene Sätze
//     („Nichts offen." / „Noch nichts erfasst."), EINE Entscheidungsregel.
//   · T-3 prüft die drei Entscheidungen ohne Mount, so wie T-1/T-2 die Lage.
//
// S-10 misst das Gegengewicht: bei einer wirklich GESCHEITERTEN Auffrischung bleibt alles, wie es
// war — die Werte verschwinden nicht (REGELN §7), der Satz nennt den Fehlschlag, und der Knopf ist
// da und wirkt. Ohne diesen Fall wäre „offline sagt die Karte nichts mehr" die billige Halbheit,
// mit der sich der ganze Auftrag erfüllen liesse.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — DIE DRITTE LÜCKE: NICHT DAS NETZ, SONDERN DIE ZEIT.
// ------------------------------------------------------------------------------------------------
//
// Ben hat an Runde 1 gemessen, was zwischen „offline" und „gescheitert" liegt und von beidem nicht
// erfasst war: ein Abruf, der GERADE LÄUFT. Wörtlich: „Nach leerem Erstabruf und anschließend
// hängendem Nachlauf steht bei bestätigtem `fetchStatus: fetching` weiterhin ‚Nichts offen.'." Das
// ist die Zeile „Cache + laufende Auffrischung → keine Verneinung" aus §9 des Auftrags. Sie steht
// jetzt in `entwarnungErlaubt()` und wird hier gemessen:
//   · S-11a/Z11a — die Behauptung geht, WÄHREND der Abruf läuft, und kommt nach seinem ABSCHLUSS
//     zurück. Der zweite Halbsatz ist der wichtigere: eine Karte, die nach einem Nachlauf für
//     immer schweigt, hätte den Fall auch „erfüllt".
//   · S-11b/Z11b — und die geholten WERTE bleiben derweil stehen (REGELN §7).
//   · S-10/Z10 messen seit Runde 2 nicht mehr nur, DASS ein Wiederholen-Knopf dasteht, sondern
//     seine WIRKUNG: Server gesund, Klick, Abrufzähler, und die Störung ist wirklich weg.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  kanal: {} as Record<"kos" | "conflicts" | "signal" | "wall", () => Promise<unknown>>,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: { list: vi.fn(() => box.kanal.kos()) },
      conflicts: { list: vi.fn(() => box.kanal.conflicts()) },
      duplicateSignal: { list: vi.fn(() => box.kanal.signal()) },
      validation: { board: leer },
      lifecycle: { pending: leer },
      gaps: { summary: vi.fn(async () => ({ open: 0, byPriority: { hoch: 0 } })) },
      learningPaths: { byRole: vi.fn(async () => null), progress: leer },
      livewall: { get: vi.fn(() => box.kanal.wall()) },
      notifications: { list: vi.fn(async () => []) },
      admin: { demoStatus: vi.fn(async () => ({ present: false, count: 0 })) },
      analytics: { overview: vi.fn(async () => ({ total: 0, byStatus: {} })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { EigenerBefund } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import {
  type ForYouLage,
  type ForYouQuelle,
  type Kartenlage,
  auffrischungLaeuft,
  datenlageKey,
  entwarnungErlaubt,
  forYouLage,
  wiederholenSinnvoll,
} from "../../apps/web/src/components/start/forYou";
import i18n from "../../apps/web/src/i18n";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// ------------------------------------------------------------------------------------------------
// T · OHNE MOUNT: `forYouLage` fragt das Netz
// ------------------------------------------------------------------------------------------------
//
// Die Lage der Karte entsteht aus Skalaren — genau wie `quellenlage()` in `eigeneKollision.ts`, und
// aus demselben Grund: eine Regel, die nur über einen Mount prüfbar ist, wird nicht in einer
// Tabelle geprüft. `isPaused` kannte die Funktion schon; der Onlinezustand fehlte ihr — dieselbe
// Lücke, die `quellenlage()` bis JOB 3084 hatte.
describe("JOB 3098 · T · forYouLage kennt den Onlinezustand", () => {
  const mitDaten: readonly ForYouQuelle[] = [
    { data: [], isError: false, isPaused: false },
    { data: [], isError: false, isPaused: false },
  ];

  it("T-1 · alle Quellen haben Daten, keine ist gestört, aber offline → `veraltet`", () => {
    expect(forYouLage(mitDaten, false)).toBe("veraltet");
    // Das Gegenstück in derselben Zeile: ohne die Netzfrage wäre T-1 auch dann grün, wenn die
    // Funktion IMMER `veraltet` sagte.
    expect(forYouLage(mitDaten, true)).toBe("frisch");
  });

  it("T-2 · eine Quelle ohne Daten und offline → `gescheitert`, nicht `laedt`", () => {
    const eineOhneDaten: readonly ForYouQuelle[] = [
      ...mitDaten,
      { data: undefined, isError: false, isPaused: false },
    ];
    expect(forYouLage(eineOhneDaten, false)).toBe("gescheitert");
    // Online ist derselbe Zustand ein laufender Erstabruf — und der darf NIE wie eine Störung
    // aussehen (dieselbe Unterscheidung wie `quellenlage()` zwischen `laedt` und `erstfehler`).
    expect(forYouLage(eineOhneDaten, true)).toBe("laedt");
  });
});

// ------------------------------------------------------------------------------------------------
// T-3 · OHNE MOUNT: die drei Entscheidungen, die JOB 3118 aus der Anzeige herausgelöst hat
// ------------------------------------------------------------------------------------------------
//
// Sie stehen hier und nicht in einer eigenen Datei, weil sie dieselbe Frage beantworten wie T-1/T-2
// — was das fehlende Netz für die Karte bedeutet — nur eine Stufe später. Die gemounteten Fälle
// darunter messen die WIRKUNG; diese drei messen die REGEL, samt der Fälle, die eine Fläche gar
// nicht herbeiführen kann.
describe("JOB 3118 · T-3 · die drei Entscheidungen der Karte", () => {
  /** Am Netz, nichts unterwegs — der Normalfall, von dem die Fälle unten abweichen. */
  const am = (lage: ForYouLage): Kartenlage => ({ lage, online: true, auffrischung: false });
  const ohneNetz = (lage: ForYouLage): Kartenlage => ({ ...am(lage), online: false });
  const imAbruf = (lage: ForYouLage): Kartenlage => ({ ...am(lage), auffrischung: true });

  it("T-3a · eine VERNEINUNG entsteht nur aus `frisch` — nie ohne Netz, nie während eines Abrufs", () => {
    expect(entwarnungErlaubt(am("frisch"))).toBe(true);
    expect(entwarnungErlaubt(am("veraltet"))).toBe(false);
    expect(entwarnungErlaubt(am("gescheitert"))).toBe(false);
    expect(entwarnungErlaubt(am("laedt"))).toBe(false);
    // Die Zusage steht ausgesprochen da, statt aus `forYouLage` hergeleitet zu werden: ein
    // Aufrufer, der die Lage aus einer anderen Netzablesung bildet, bekommt trotzdem kein „Nichts
    // offen." (JOB 3118, Kommentar an `entwarnungErlaubt`).
    expect(entwarnungErlaubt(ohneNetz("frisch"))).toBe(false);
    // RUNDE 2 · Bens Korrekturpflicht 1: die Zeile „Cache + laufende Auffrischung" aus §9. Ein
    // laufender Abruf sagt selbst, dass der Stand von vorhin nicht mehr für JETZT einsteht.
    expect(entwarnungErlaubt(imAbruf("frisch"))).toBe(false);
  });

  it("T-3d · `auffrischungLaeuft` liest jede Quelle, nicht nur die erste", () => {
    const ruht = { data: [], isFetching: false };
    expect(auffrischungLaeuft([ruht, ruht])).toBe(false);
    expect(auffrischungLaeuft([ruht, { data: [], isFetching: true }])).toBe(true);
    // Eine Quelle ohne die Angabe gilt als ruhend — sonst hinge die Verneinung an einer Vermutung
    // in die andere Richtung und verschwände überall dort, wo niemand sie meldet.
    expect(auffrischungLaeuft([{ data: [] }])).toBe(false);
  });

  it("T-3b · der Datenlagesatz unterscheidet den gescheiterten Versuch vom ruhenden und vom laufenden", () => {
    // Online: es hat wirklich einen Versuch gegeben, und er ist gescheitert.
    expect(datenlageKey(am("veraltet"), true)).toBe("loadstate.stale");
    // Offline: die Abfrage RUHT. Mit sichtbarem Stand nennt der Satz ihn, ohne Stand nennt er
    // nichts — „Stand von zuletzt" ohne Stand wäre eine Erfindung (eigeneKollision.ts:180-198).
    expect(datenlageKey(ohneNetz("veraltet"), true)).toBe("kollision.lage.pausiert");
    expect(datenlageKey(ohneNetz("veraltet"), false)).toBe("kollision.lage.pausiertOhneStand");
    expect(datenlageKey(ohneNetz("gescheitert"), false)).toBe("kollision.lage.pausiertOhneStand");
    // RUNDE 3 · Bens Korrekturpflicht 1: WÄHREND der nächste Versuch läuft, ist „Aktualisierung
    // fehlgeschlagen" ein Satz über den vorletzten Stand der Dinge. §9 sagt hier „nichts".
    expect(datenlageKey(imAbruf("veraltet"), true)).toBeNull();
    expect(datenlageKey(imAbruf("gescheitert"), false)).toBeNull();
    // Frisch trägt die Sache selbst, `laedt` ausdrücklich nichts (§9), und die Störung am Netz
    // trägt ihren Knopf statt eines Erklärtexts.
    expect(datenlageKey(am("frisch"), true)).toBeNull();
    expect(datenlageKey(am("laedt"), false)).toBeNull();
    expect(datenlageKey(am("gescheitert"), false)).toBeNull();
  });

  it("T-3c · ein Wiederholen-Knopf steht nur, wo ein Versuch etwas ändern kann", () => {
    expect(wiederholenSinnvoll(am("gescheitert"))).toBe(true);
    expect(wiederholenSinnvoll(am("veraltet"))).toBe(true);
    expect(wiederholenSinnvoll(am("laedt"))).toBe(false);
    expect(wiederholenSinnvoll(am("frisch"))).toBe(false);
    // Ohne Netz scheitert jeder Versuch — ein Knopf wäre eine Scheinfunktion (REGELN §7).
    expect(wiederholenSinnvoll(ohneNetz("gescheitert"))).toBe(false);
    expect(wiederholenSinnvoll(ohneNetz("veraltet"))).toBe(false);
    // RUNDE 3: und während der ausgelöste Versuch noch läuft, fügt ein zweiter Klick nichts hinzu
    // — §9, „nein (läuft schon)".
    expect(wiederholenSinnvoll(imAbruf("gescheitert"))).toBe(false);
    expect(wiederholenSinnvoll(imAbruf("veraltet"))).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// S · GEMOUNTET: die echte Startseite
// ------------------------------------------------------------------------------------------------
const DUBLETTE: EigenerBefund = {
  koId: "ko-1",
  dublette: true,
  konflikt: false,
  deckung: { lage: "kein_lauf", geprueft: null, bestand: null },
};

/** Die Karte „ZULETZT" hat ihre eigene Quelle — Z2b/Z4b brauchen sie einmal leer, einmal gefüllt. */
const LEERE_WAND = { saved: [], helped: [], helpedToday: 0 };
const WAND_MIT_EINTRAG = {
  saved: [
    {
      koId: "ko-9",
      title: "Halterungen ohne waagerechte Oberseiten",
      author: "Eva",
      at: new Date().toISOString(),
      status: "offen" as const,
    },
  ],
  helped: [],
  helpedToday: 0,
};
/** Der Bestand NACH einem geglückten Wiederholen — an einem anderen Titel erkennbar (Z10). */
const WAND_NEUER_EINTRAG = {
  saved: [
    {
      koId: "ko-10",
      title: "Fluchtwege am Standort Nord",
      author: "Eva",
      at: new Date().toISOString(),
      status: "offen" as const,
    },
  ],
  helped: [],
  helpedToday: 0,
};

/**
 * Ein Abruf, der LÄUFT und den der Test selbst abschließt — RUNDE 2, Bens Korrekturpflicht 1.
 *
 * `haengt` unten hängt für immer; damit lässt sich „während der Nachlauf läuft" messen, aber nicht
 * „…und danach ist er fertig". Genau diesen zweiten Halbsatz verlangt die Korrekturpflicht
 * („anschließend erfolgreichem Abschluss"), und ohne ihn wäre „keine Verneinung" auch von einer
 * Karte erfüllbar, die nie wieder etwas sagt.
 */
function aufschieber<T>(): { holen: () => Promise<T>; erfuellen: (wert: T) => void } {
  let loesen: ((wert: T) => void) | null = null;
  const versprechen = new Promise<T>((res) => {
    loesen = res;
  });
  return { holen: () => versprechen, erfuellen: (wert) => loesen?.(wert) };
}

const leerAntwort = async (): Promise<unknown> => [];
const haengt = (): Promise<never> => new Promise<never>(() => {});
const scheitert = async (): Promise<never> => {
  throw new Error("Abruf gescheitert");
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | undefined;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  await act(async () => {
    neu.render(
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
                NavGuardProvider,
                null,
                createElement(MemoryRouter, { initialEntries: ["/start"] }, [
                  createElement(Start, { key: "s" }),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Zwei Runden: die Sitzung löst in zwei Stufen auf (`/auth/status`, dann `/auth/me`).
  await act(flush);
  await act(flush);
}

/** Die Karte „FÜR DICH" — nicht das Menüblatt. Hier steht die Zeile, um die es geht. */
function karte(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="h5-fuerdich"]');
  if (!el) {
    throw new Error("Die Karte „FÜR DICH“ fehlt");
  }
  return el;
}

const kartenText = (): string => (karte().textContent ?? "").replace(/\s+/g, " ");
const zeilen = (): readonly string[] =>
  [...container.querySelectorAll('[data-testid="h5-fuerdich-zeile"]')].map((z) =>
    (z.textContent ?? "").replace(/\s+/g, " "),
  );
const pille = (): string | null =>
  container.querySelector('[data-testid="h5-fuerdich-pille"]')?.textContent ?? null;
const veraltetMarke = (): string | null =>
  container.querySelector('[data-testid="h5-fuerdich-veraltet"]')?.textContent ?? null;
const wiederholenKnopf = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="h5-fuerdich-wiederholen"]');
const wiederholenDa = (): boolean => wiederholenKnopf() !== null;
/** Klickt den echten Knopf der echten Karte — keine Abkürzung über den Rückruf. */
async function wiederholenKlicken(): Promise<void> {
  const knopf = wiederholenKnopf();
  if (!knopf) {
    throw new Error("kein Wiederholen-Knopf in der Karte „FÜR DICH“");
  }
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

// ---- Dieselben Ablesungen an der Nachbarkarte „ZULETZT" (Z2b/Z4b) -------------------------------
function zuletztKarte(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="h5-zuletzt"]');
  if (!el) {
    throw new Error("Die Karte „ZULETZT“ fehlt");
  }
  return el;
}
const zuletztText = (): string => (zuletztKarte().textContent ?? "").replace(/\s+/g, " ");
const zuletztZeilen = (): number =>
  container.querySelectorAll('[data-testid="h5-zuletzt-zeile"]').length;
const zuletztMarke = (): string | null =>
  container.querySelector('[data-testid="h5-zuletzt-veraltet"]')?.textContent ?? null;
const zuletztWiederholenDa = (): boolean =>
  container.querySelector('[data-testid="h5-zuletzt-wiederholen"]') !== null;
/** Klickt den echten Knopf DIESER Karte — sie hat ihren eigenen Wiederholen-Weg (`Start.tsx`). */
async function zuletztWiederholenKlicken(): Promise<void> {
  const knopf = container.querySelector<HTMLButtonElement>(
    '[data-testid="h5-zuletzt-wiederholen"]',
  );
  if (!knopf) {
    throw new Error("kein Wiederholen-Knopf in der Karte „ZULETZT“");
  }
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

const DUBLETTEN_SATZ = (): string => i18n.t("kollision.start.dublette", { n: 1 });

async function netzTrennen(): Promise<void> {
  await act(async () => {
    onlineManager.setOnline(false);
    await flush();
  });
}

/** Die ganze Seite ab und neu — mit DEMSELBEN `QueryClient`, also mit erhaltenem Zwischenspeicher. */
async function neuBetreten(): Promise<void> {
  const alt = root;
  await act(async () => {
    alt?.unmount();
  });
  container.remove();
  await mount();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.kanal = {
    kos: leerAntwort,
    conflicts: leerAntwort,
    signal: leerAntwort,
    wall: async () => LEERE_WAND,
  };
  onlineManager.setOnline(true);
  window.localStorage.clear();
  // Dieselbe Frist wie im Betrieb (`main.tsx:21`) — sie ERZEUGT den Fall: innerhalb der 30 s will
  // beim Zurückkommen niemand einen Abruf, also gibt es kein `paused`, aus dem die Regel den
  // Offline-Zustand ablesen könnte.
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
});

afterEach(() => {
  // Die T-Fälle oben montieren nichts — sie prüfen die Regel als Funktion. Ohne diese Abfrage
  // scheiterte der Abbau an ihnen und ihre echte Aussage ginge in einem zweiten Fehler unter.
  const alt = root;
  if (alt !== undefined) {
    act(() => alt.unmount());
    container.remove();
  }
  root = undefined;
  qc.clear();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe("JOB 3098 · der Befund bleibt, die Frischebehauptung geht", () => {
  it("S-0 · KALIBRIERUNG: online steht die Zeile OHNE Veraltet-Markierung", async () => {
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    expect(pille()).toBe("1");
    expect(veraltetMarke()).toBeNull();
  });

  it("S-1 · Netz fällt weg, während die Seite offen steht → Zeile bleibt, Karte ist markiert", async () => {
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    await netzTrennen();

    // A27 rückwärts wäre der zweite Fehler: der bekannte Befund darf NICHT still verschwinden.
    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    // …und die Karte behauptet nicht länger, sie sei frisch.
    expect(kartenText()).not.toContain(i18n.t("task.none"));
    // JOB 3118: NACHGEFÜHRT. Bis hierher stand da „Veraltet – Aktualisierung fehlgeschlagen" samt
    // Wiederholen-Knopf — eine Aktualisierung, die es offline nie gab, und eine Handlung, die ohne
    // Netz nichts bewirken kann. Der Stand ist sichtbar (die Zeile oben), also nennt ihn der Satz.
    expect(veraltetMarke()).toBe(i18n.t("kollision.lage.pausiert"));
    expect(kartenText()).not.toContain(i18n.t("loadstate.stale"));
    expect(wiederholenDa(), "ein Knopf ohne Wirkung ist eine Scheinfunktion").toBe(false);
  });

  it("S-2 · Seite ab, offline, Seite neu am selben QueryClient → dasselbe Ergebnis", async () => {
    // DER SCHÄRFERE WEG (Codex' Korrekturpflicht 1 an JOB 3084 R1): der Baum läuft von vorn an,
    // der Hook wird neu abonniert, und der Onlinezustand muss aus dem KALTEN Start der Komponente
    // in die Karte finden — nicht aus einem Ereignis am stehenden Baum.
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    expect(veraltetMarke()).toBeNull();

    await netzTrennen();
    await neuBetreten();

    // KALIBRIERUNG: die Abfragen RUHEN wirklich (kein `paused`) — sonst misst der Fall den Weg,
    // den JOB 3084 schon abgedeckt hat, statt den Weg des Befunds R-1585.
    expect(qc.getQueryState(["duplicate-signal"])?.fetchStatus).toBe("idle");
    expect(qc.getQueryState(["duplicate-signal"])?.status).toBe("success");

    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    // JOB 3118: NACHGEFÜHRT, mit derselben Begründung wie S-1.
    expect(veraltetMarke()).toBe(i18n.t("kollision.lage.pausiert"));
    expect(wiederholenDa()).toBe(false);
  });

  it("S-3 · kalt offline, kein früherer Stand → keine Zeile, keine Zahl, der Satz ohne Stand", async () => {
    onlineManager.setOnline(false);
    await mount();

    expect(zeilen()).toEqual([]);
    expect(pille()).toBeNull();
    // Keine Verneinung aus dem Nichts: „Nichts offen." ist eine Aussage über den Bestand.
    expect(kartenText()).not.toContain(i18n.t("task.none"));
    // JOB 3118: NACHGEFÜHRT. Eine Störung darf nicht wie Leere aussehen (REGELN §7) — sichtbar ist
    // sie jetzt als SATZ statt als Knopf. „Stand von zuletzt" wäre hier falsch: es gab nie einen.
    expect(veraltetMarke()).toBe(i18n.t("kollision.lage.pausiertOhneStand"));
    expect(kartenText()).not.toContain(i18n.t("loadstate.error.retry"));
    expect(wiederholenDa()).toBe(false);
  });

  it("S-6 · leer geladen, offline WIEDERBETRETEN → keine Verneinung, kein Knopf", async () => {
    // DER WEG AUS BENS MESSUNG, wörtlich: „online leer laden, Netz trennen, am selben QueryClient
    // neu mounten ergibt `Nichts offen.Veraltet – Aktualisierung fehlgeschlagenErneut versuchen`."
    // Drei Aussagen, keine davon gedeckt. Vor JOB 3118 ist dieser Fall rot.
    await mount();
    expect(kartenText(), "Kalibrierung: online und leer steht die Verneinung zu Recht").toContain(
      i18n.t("task.none"),
    );

    await netzTrennen();
    await neuBetreten();

    // Kalibrierung wie in S-2: die Abfragen RUHEN wirklich, es gibt kein `paused` zum Ablesen.
    expect(qc.getQueryState(["conflicts"])?.fetchStatus).toBe("idle");

    expect(kartenText()).not.toContain(i18n.t("task.none"));
    expect(kartenText()).not.toContain(i18n.t("loadstate.stale"));
    expect(veraltetMarke()).toBe(i18n.t("kollision.lage.pausiertOhneStand"));
    expect(wiederholenKnopf()).toBeNull();
  });

  it("S-9 · offline mit Bestand → die Werte BLEIBEN, der Satz nennt den Stand, kein Knopf", async () => {
    // Die andere Flanke von S-6: hier gibt es einen sichtbaren Stand. Er verschwindet nicht
    // (REGELN §7), und genau deshalb darf der Satz ihn nennen.
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    expect(zeilen()).toHaveLength(1);

    await netzTrennen();
    await neuBetreten();

    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    expect(pille()).toBe("1");
    expect(veraltetMarke()).toBe(i18n.t("kollision.lage.pausiert"));
    expect(kartenText()).not.toContain(i18n.t("task.none"));
    expect(wiederholenDa()).toBe(false);
  });

  it("S-10 · GEGENGEWICHT: gescheiterte Auffrischung — Werte bleiben, und der Knopf HILFT wirklich", async () => {
    // Ohne diesen Fall wäre der ganze Auftrag mit „offline sagt die Karte nichts mehr" erfüllbar —
    // und mit ihm ginge die Zusage aus REGELN §7 verloren: bei einem gescheiterten Versuch bleiben
    // die Werte sichtbar, der Satz nennt den Fehlschlag, und der Knopf wirkt weiterhin.
    box.kanal.signal = async () => [DUBLETTE];
    await mount();

    await act(async () => {
      box.kanal.signal = scheitert;
      void qc.invalidateQueries({ queryKey: ["duplicate-signal"] });
      await flush();
    });

    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    expect(veraltetMarke()).toBe(i18n.t("loadstate.stale"));
    expect(wiederholenDa()).toBe(true);
    expect(kartenText()).not.toContain(i18n.t("task.none"));

    // RUNDE 2 · Bens Korrekturpflicht 3: bis hierher maß dieser Fall nur, DASS ein Knopf dasteht.
    // Ein Knopf, der nichts bewirkt, ist aber genau die Scheinfunktion, gegen die der ganze Job
    // gebaut ist — gemessen wird deshalb die WIRKUNG: Server gesund, Klick, Abrufzähler, Anzeige.
    let abrufe = 0;
    box.kanal.signal = async () => {
      abrufe += 1;
      return [];
    };
    expect(abrufe, "der Server wurde ohne Klick gefragt").toBe(0);
    await wiederholenKlicken();

    expect(abrufe, "der Klick hat die gestörte Quelle gar nicht erreicht").toBe(1);
    // Die Störung ist weg, und die Anzeige übernimmt die NEUE Antwort (kein Befund mehr) — hier
    // darf die Verneinung wieder stehen, denn jetzt trägt sie ein frischer, fertiger Abruf.
    expect(veraltetMarke()).toBeNull();
    expect(wiederholenDa()).toBe(false);
    expect(zeilen()).toEqual([]);
    expect(kartenText()).toContain(i18n.t("task.none"));
  });

  it("S-12 · Fehler → Wiederholen → VERZÖGERTE Antwort → Erfolg: der ganze Weg, Schritt für Schritt", async () => {
    // BENS GEGENPROBE AUS RUNDE 2, wörtlich: „Bestand laden → Auffrischung scheitert → Wiederholen
    // klicken → Antwort verzögern. Bei bestätigtem `fetchStatus: fetching` zeigen beide Karten
    // weiterhin ‚Veraltet – Aktualisierung fehlgeschlagenErneut versuchen'." S-10 endete bis dahin
    // zu früh: dort war die Wiederholung im selben Atemzug fertig, und die Sekunden dazwischen —
    // die der Mensch wirklich sieht — hat niemand gemessen.
    box.kanal.signal = async () => [DUBLETTE];
    await mount();

    await act(async () => {
      box.kanal.signal = scheitert;
      void qc.invalidateQueries({ queryKey: ["duplicate-signal"] });
      await flush();
    });
    expect(veraltetMarke()).toBe(i18n.t("loadstate.stale"));
    expect(wiederholenDa()).toBe(true);

    // Der Klick löst einen Versuch aus, der NICHT sofort antwortet.
    let abrufe = 0;
    const nachlauf = aufschieber<unknown>();
    box.kanal.signal = () => {
      abrufe += 1;
      return nachlauf.holen();
    };
    await wiederholenKlicken();

    // WÄHRENDDESSEN: der Versuch läuft wirklich …
    expect(abrufe, "der Klick hat die gestörte Quelle nicht erreicht").toBe(1);
    expect(qc.getQueryState(["duplicate-signal"])?.fetchStatus).toBe("fetching");
    // … die Werte von vorhin bleiben stehen (REGELN §7) …
    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    expect(pille()).toBe("1");
    // … und die Karte sagt weder „fehlgeschlagen" (der Satz gälte dem VORIGEN Versuch) noch bietet
    // sie einen zweiten Knopf an, der nichts hinzufügt (§9: „läuft schon").
    expect(veraltetMarke()).toBeNull();
    expect(kartenText()).not.toContain(i18n.t("loadstate.stale"));
    expect(wiederholenDa()).toBe(false);
    expect(kartenText()).not.toContain(i18n.t("task.none"));

    // DANACH: die verzögerte Antwort kommt an und wird übernommen.
    await act(async () => {
      nachlauf.erfuellen([]);
      await flush();
    });
    expect(qc.getQueryState(["duplicate-signal"])?.fetchStatus).toBe("idle");
    expect(zeilen()).toEqual([]);
    expect(veraltetMarke()).toBeNull();
    expect(wiederholenDa()).toBe(false);
    expect(kartenText()).toContain(i18n.t("task.none"));
  });

  // ----------------------------------------------------------------------------------------------
  // S-11 · WÄHREND EIN ABRUF LÄUFT (Bens Korrekturpflicht 1)
  // ----------------------------------------------------------------------------------------------
  //
  // Bens Messung an Runde 1, wörtlich: „Nach leerem Erstabruf und anschließend hängendem Nachlauf
  // steht bei bestätigtem `fetchStatus: fetching` weiterhin ‚Nichts offen.'." Das ist die Zeile
  // „Cache + laufende Auffrischung → keine Verneinung" aus §9, und sie fehlte. Beide Hälften stehen
  // hier: die Behauptung geht (S-11a), die Werte bleiben (S-11b) — und beide Male kommt die
  // Auskunft nach dem ABSCHLUSS des Abrufs zurück, statt für immer zu verstummen.
  it("S-11a · leer geladen, Nachlauf läuft → keine Verneinung; nach Abschluss steht sie wieder", async () => {
    await mount();
    expect(kartenText(), "Kalibrierung: nach fertigem leerem Abruf steht die Verneinung").toContain(
      i18n.t("task.none"),
    );

    const nachlauf = aufschieber<unknown>();
    box.kanal.signal = nachlauf.holen;
    await act(async () => {
      void qc.invalidateQueries({ queryKey: ["duplicate-signal"] });
      await flush();
    });

    // KALIBRIERUNG: der Abruf läuft wirklich — sonst misst dieser Fall gar nichts.
    expect(qc.getQueryState(["duplicate-signal"])?.fetchStatus).toBe("fetching");
    expect(kartenText()).not.toContain(i18n.t("task.none"));
    // Und er ist kein Fehler und keine Pause: kein Datenlagesatz, kein Knopf (§9, „läuft schon").
    expect(veraltetMarke()).toBeNull();
    expect(wiederholenDa()).toBe(false);

    await act(async () => {
      nachlauf.erfuellen([]);
      await flush();
    });

    expect(qc.getQueryState(["duplicate-signal"])?.fetchStatus).toBe("idle");
    expect(kartenText(), "nach dem Abschluss schweigt die Karte weiter").toContain(
      i18n.t("task.none"),
    );
  });

  it("S-11b · mit Bestand, Nachlauf läuft → Zeile und Pille BLEIBEN stehen", async () => {
    // Die andere Hälfte der Korrekturpflicht: „und vorhandene Werte bleiben". Ein Nachlauf, der die
    // Karte leerräumt, wäre REGELN §7 rückwärts.
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    expect(zeilen()).toHaveLength(1);

    const nachlauf = aufschieber<unknown>();
    box.kanal.signal = nachlauf.holen;
    await act(async () => {
      void qc.invalidateQueries({ queryKey: ["duplicate-signal"] });
      await flush();
    });

    expect(qc.getQueryState(["duplicate-signal"])?.fetchStatus).toBe("fetching");
    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    expect(pille()).toBe("1");
    expect(veraltetMarke()).toBeNull();
    expect(wiederholenDa()).toBe(false);

    await act(async () => {
      nachlauf.erfuellen([DUBLETTE]);
      await flush();
    });
    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
  });
});

// ------------------------------------------------------------------------------------------------
// Z2b/Z4b · DIE NACHBARKARTE — zwei Sätze, EINE Regel
// ------------------------------------------------------------------------------------------------
//
// Die naheliegende Halbheit wäre, nur „FÜR DICH" anzufassen: die zwei Karten liegen nebeneinander,
// Ben hat beide gemessen, und „Noch nichts erfasst." ist genauso eine Verneinung des Bestands wie
// „Nichts offen.". Die Sätze bleiben verschieden (hier ist nichts ERFASST, dort nichts OFFEN); die
// Entscheidung, ob sie stehen dürfen, ist dieselbe.
describe("JOB 3118 · „ZULETZT“ folgt derselben Regel wie „FÜR DICH“", () => {
  it("Z2b · leer geladen, offline wiederbetreten → kein „nichts erfasst“, kein Knopf", async () => {
    await mount();
    expect(zuletztText(), "Kalibrierung: online und leer steht der Satz zu Recht").toContain(
      i18n.t("start.zuletzt.leer"),
    );

    await netzTrennen();
    await neuBetreten();

    expect(zuletztText()).not.toContain(i18n.t("start.zuletzt.leer"));
    expect(zuletztText()).not.toContain(i18n.t("loadstate.stale"));
    expect(zuletztMarke()).toBe(i18n.t("kollision.lage.pausiertOhneStand"));
    expect(zuletztWiederholenDa()).toBe(false);
  });

  it("Z4b · mit Bestand, offline wiederbetreten → die Einträge BLEIBEN, Satz mit Stand, kein Knopf", async () => {
    box.kanal.wall = async () => WAND_MIT_EINTRAG;
    await mount();
    expect(zuletztZeilen()).toBe(1);

    await netzTrennen();
    await neuBetreten();

    expect(zuletztZeilen(), "die zuletzt geholten Einträge wurden geleert").toBe(1);
    expect(zuletztText()).toContain(WAND_MIT_EINTRAG.saved[0]?.title ?? "");
    expect(zuletztMarke()).toBe(i18n.t("kollision.lage.pausiert"));
    expect(zuletztWiederholenDa()).toBe(false);
  });

  it("Z10 · GEGENGEWICHT: gescheiterte Auffrischung — Satz, Knopf, und der Knopf HILFT wirklich", async () => {
    // Dasselbe Gegengewicht wie S-10, an dieser Karte: ohne es wäre Z2b/Z4b mit „der Knopf ist
    // weg" erfüllbar, und die Zusage aus REGELN §7 ginge an der Nachbarkarte verloren.
    box.kanal.wall = async () => WAND_MIT_EINTRAG;
    await mount();

    await act(async () => {
      box.kanal.wall = scheitert;
      void qc.invalidateQueries({ queryKey: ["livewall"] });
      await flush();
    });

    expect(zuletztZeilen()).toBe(1);
    expect(zuletztMarke()).toBe(i18n.t("loadstate.stale"));
    expect(zuletztWiederholenDa()).toBe(true);

    // RUNDE 2 · Bens Korrekturpflicht 3, an dieser Karte: der Weg aus der Störung heraus wird an
    // der WIRKUNG gemessen. Die Karte hat ihren EIGENEN Wiederholen-Weg (`liveWall.refetch`), und
    // dass sie ihn hat, sieht man nur, wenn danach ihr eigener Bestand steht.
    let abrufe = 0;
    box.kanal.wall = async () => {
      abrufe += 1;
      return WAND_NEUER_EINTRAG;
    };
    await zuletztWiederholenKlicken();

    expect(abrufe, "der Klick hat die Live-Wall gar nicht erreicht").toBe(1);
    expect(zuletztMarke()).toBeNull();
    expect(zuletztWiederholenDa()).toBe(false);
    expect(zuletztText()).toContain(WAND_NEUER_EINTRAG.saved[0]?.title ?? "");
    expect(zuletztText()).not.toContain(WAND_MIT_EINTRAG.saved[0]?.title ?? "");
  });

  it("Z12 · Fehler → Wiederholen → VERZÖGERTE Antwort → Erfolg, an der Nachbarkarte", async () => {
    // Bens Gegenprobe traf BEIDE Karten; sie steht deshalb auch hier, mit dem eigenen
    // Wiederholen-Weg dieser Karte (`liveWall.refetch`).
    box.kanal.wall = async () => WAND_MIT_EINTRAG;
    await mount();

    await act(async () => {
      box.kanal.wall = scheitert;
      void qc.invalidateQueries({ queryKey: ["livewall"] });
      await flush();
    });
    expect(zuletztMarke()).toBe(i18n.t("loadstate.stale"));
    expect(zuletztWiederholenDa()).toBe(true);

    let abrufe = 0;
    const nachlauf = aufschieber<unknown>();
    box.kanal.wall = () => {
      abrufe += 1;
      return nachlauf.holen();
    };
    await zuletztWiederholenKlicken();

    expect(abrufe).toBe(1);
    expect(qc.getQueryState(["livewall"])?.fetchStatus).toBe("fetching");
    expect(zuletztZeilen(), "die Einträge wurden während des Versuchs geleert").toBe(1);
    expect(zuletztMarke()).toBeNull();
    expect(zuletztText()).not.toContain(i18n.t("loadstate.stale"));
    expect(zuletztWiederholenDa()).toBe(false);
    expect(zuletztText()).not.toContain(i18n.t("start.zuletzt.leer"));

    await act(async () => {
      nachlauf.erfuellen(WAND_NEUER_EINTRAG);
      await flush();
    });
    expect(qc.getQueryState(["livewall"])?.fetchStatus).toBe("idle");
    expect(zuletztText()).toContain(WAND_NEUER_EINTRAG.saved[0]?.title ?? "");
    expect(zuletztText()).not.toContain(WAND_MIT_EINTRAG.saved[0]?.title ?? "");
    expect(zuletztMarke()).toBeNull();
    expect(zuletztWiederholenDa()).toBe(false);
  });

  it("Z11a · leer geladen, Nachlauf läuft → kein „nichts erfasst“; nach Abschluss steht es wieder", async () => {
    await mount();
    expect(zuletztText(), "Kalibrierung: nach fertigem leerem Abruf steht der Satz").toContain(
      i18n.t("start.zuletzt.leer"),
    );

    const nachlauf = aufschieber<unknown>();
    box.kanal.wall = nachlauf.holen;
    await act(async () => {
      void qc.invalidateQueries({ queryKey: ["livewall"] });
      await flush();
    });

    expect(qc.getQueryState(["livewall"])?.fetchStatus).toBe("fetching");
    expect(zuletztText()).not.toContain(i18n.t("start.zuletzt.leer"));
    expect(zuletztMarke()).toBeNull();
    expect(zuletztWiederholenDa()).toBe(false);

    await act(async () => {
      nachlauf.erfuellen(LEERE_WAND);
      await flush();
    });

    expect(qc.getQueryState(["livewall"])?.fetchStatus).toBe("idle");
    expect(zuletztText()).toContain(i18n.t("start.zuletzt.leer"));
  });

  it("Z11b · mit Bestand, Nachlauf läuft → die Einträge BLEIBEN stehen", async () => {
    box.kanal.wall = async () => WAND_MIT_EINTRAG;
    await mount();
    expect(zuletztZeilen()).toBe(1);

    const nachlauf = aufschieber<unknown>();
    box.kanal.wall = nachlauf.holen;
    await act(async () => {
      void qc.invalidateQueries({ queryKey: ["livewall"] });
      await flush();
    });

    expect(qc.getQueryState(["livewall"])?.fetchStatus).toBe("fetching");
    expect(zuletztZeilen(), "der laufende Nachlauf hat die Karte geleert").toBe(1);
    expect(zuletztText()).toContain(WAND_MIT_EINTRAG.saved[0]?.title ?? "");
    expect(zuletztMarke()).toBeNull();

    await act(async () => {
      nachlauf.erfuellen(WAND_MIT_EINTRAG);
      await flush();
    });
    expect(zuletztZeilen()).toBe(1);
  });
});

describe("JOB 3098 · die Karte kennt die Quellen, aus denen ihre Zeilen stammen", () => {
  it("S-4 · alle Quellen frisch, nur `ko.list` lädt → Karte leer, keine Pille, kein „lädt“-Text", async () => {
    box.kanal.signal = async () => [DUBLETTE];
    box.kanal.kos = haengt;
    await mount();

    expect(zeilen()).toEqual([]);
    expect(pille()).toBeNull();
    expect(kartenText()).toBe("");
    expect(wiederholenDa()).toBe(false);
  });

  it("S-5 · alle Quellen frisch, nur `duplicate-signal` scheitert → Karte leer, Störung sichtbar", async () => {
    box.kanal.signal = scheitert;
    await mount();

    expect(zeilen()).toEqual([]);
    expect(pille()).toBeNull();
    expect(kartenText()).not.toContain(i18n.t("task.none"));
    expect(wiederholenDa()).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// S-7/S-8 · DER WEG AUS DER STÖRUNG HERAUS (Bens Korrekturpflicht 1)
// ------------------------------------------------------------------------------------------------
//
// S-4/S-5 messen, dass die zwei neuen Quellen die Karte in eine Störung bringen KÖNNEN. Was Runde 1
// nicht gemessen hat: ob der Knopf, den die Karte daraufhin anbietet, sie auch wieder herausbringt.
// Er tat es nicht — `wiederholen()` refetchte fünf andere Quellen. Ben, wörtlich: „Nach behobenem
// Serverfehler erzeugt der Klick jeweils null Abrufe der betroffenen Quelle."
//
// GEMESSEN WIRD AN DER WIRKUNG, NICHT AM QUELLTEXT: der echte Knopf wird geklickt, die Antwort des
// Servers ist inzwischen gesund, und danach muss die Kollisionszeile dastehen. Eine Zusicherung
// über die Zeile `for (const quelle of arbeitsQuellen)` wäre eine Quelltextkopie, keine Messung.
describe("JOB 3098 · Wiederholen erreicht JEDE Quelle, die die Störung ausgelöst hat", () => {
  for (const fall of [
    { name: "duplicate-signal", kanal: "signal" as const },
    { name: "ko.list", kanal: "kos" as const },
  ]) {
    it(`S-7/8 · Erstfehler in \`${fall.name}\` → Server gesund → Klick → der Befund steht`, async () => {
      let abrufe = 0;
      const gesund: Record<"signal" | "kos", () => Promise<unknown>> = {
        signal: async () => [DUBLETTE],
        kos: leerAntwort,
      };
      box.kanal.signal = gesund.signal;
      box.kanal.kos = gesund.kos;
      box.kanal[fall.kanal] = async () => {
        abrufe += 1;
        throw new Error(`${fall.name} kaputt`);
      };

      await mount();
      expect(abrufe, "die Quelle wurde beim Aufbau überhaupt gefragt").toBe(1);
      expect(zeilen()).toEqual([]);
      expect(wiederholenDa()).toBe(true);

      // Der Server ist wieder gesund — allein davon ändert sich nichts (react-query holt von sich
      // aus nichts nach). Erst der Klick darf es richten.
      box.kanal[fall.kanal] = () => {
        abrufe += 1;
        return gesund[fall.kanal]();
      };
      await wiederholenKlicken();

      expect(abrufe, "der Klick hat diese Quelle gar nicht erreicht").toBe(2);
      expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
      expect(pille()).toBe("1");
      expect(veraltetMarke()).toBeNull();
      expect(wiederholenDa()).toBe(false);
    });
  }
});
