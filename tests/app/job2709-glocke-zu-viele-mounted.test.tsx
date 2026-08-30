// @vitest-environment jsdom
// ================================================================================================
// JOB 2709 · D4 — DIE GLOCKE NIMMT ZURÜCK UND SAGT WARUM.
// ================================================================================================
//
// PEDIS FRAGE: „Wenn ‚Alle gelesen' nicht klappt — sagt die Glocke es mir jetzt?"
//
// DER BEFUND AUS D3, am Quelltext belegt und hier zum ersten Mal am laufenden Client gemessen:
// `persistSeen` setzte die Gelesen-Optik SOFORT, rief dann `markSeen` mit `void` und OHNE `catch`.
// Lehnte der Server ab, blieb die Markierung stehen: `unreadCount` fiel auf 0, der Knopf „Alle
// gelesen" verschwand (er hängt an `unreadCount > 0`), gespeichert war nichts. Beim nächsten Laden
// waren alle Meldungen wieder da — ohne dass jemals ein Fehler zu sehen war.
//
// DIE PRÜFLÜCKE, WÖRTLICH (`BEN-PRUEFUNG-JOB-2709-D2.md:14`):
//
//   „Ort: Clienthandler und Renderer des vorhandenen ‚Alle gelesen'-Steuerelements samt UI-Test;
//    Fall: Klick mit 5.001 IDs, Serverantwort 400 `TOO_MANY_IDS` mit verständlicher Nachricht;
//    erwartet: Die konkrete Nachricht wird für den Menschen sichtbar, kein generischer
//    500-/Serverfehler erscheint, und kein Eintrag wird teilweise als gelesen dargestellt oder
//    gespeichert."
//
// ================================================================================================
// WAS HIER ECHT IST — UND WAS DER EINZIGE ERSATZ IST.
// ================================================================================================
//
// Die ECHTE `Topbar` mit ihren echten Providern, der ECHTE `ToastProvider` samt `ToastViewport`
// (sonst landete der Toast nirgends im DOM), der echte Knopf über seine sichtbare Beschriftung
// `topbar.notifMarkAll`. Einziger Ersatz sind die `endpoints` — sie geben die Serverantwort vor
// und schreiben mit, was der Client wirklich abgesendet hat.
//
// GEMESSEN WIRD AM GERENDERTEN DOM, nicht an einem Zustand: was der Mensch sieht, nicht was die
// Komponente denkt. BEN in `2614 D4`: „`answered=true` plus KO in `sources` am API-Endpunkt ist
// ein Scheinbeleg." Hier ist das wörtlich zu nehmen — am API-Endpunkt sah in D2 alles in Ordnung
// aus, und der Fehler war trotzdem da.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Der Bestand der Glocke und das Verhalten des Servers — beides von aussen steuerbar.
const lage = vi.hoisted(() => ({
  meldungen: [] as Array<{ id: string; kind: string; title: string; seen: boolean }>,
  antwort: { art: "erfolg" } as
    | { art: "erfolg" }
    | { art: "apiFehler"; status: number; code: string; message: string }
    | { art: "netzfehler" },
  gesendet: [] as string[][],
  // ============================================================================================
  // JOB 2709 D5 — ZWEI STEUERBARE ANTWORTEN, fuer den Ueberlappungsfall.
  // ============================================================================================
  // Bis D4 hatte die Attrappe EINE Antwort fuer alle Aufrufe; damit ist eine Ueberlappung nicht
  // darstellbar. Ist `handbetrieb` gesetzt, gibt `markSeen` ein Promise zurueck, dessen Aufloeser
  // hier landet — der Test entscheidet dann, WELCHER Aufruf wann und wie endet.
  handbetrieb: false,
  offen: [] as Array<{
    ids: string[];
    erfuellen: () => void;
    scheitern: (fehler: unknown) => void;
  }>,
  // JOB 2709 D5: Ist das gesetzt, scheitert auch der Neuabruf der Liste. Das ist der KOHAERENTE
  // Fall und kein Kunstgriff: Was `persistSeen` scheitern laesst — ein Netzproblem —, trifft den
  // Refetch genauso. Ohne ihn holt react-query den Serverstand nach und `n.seen` rettet die
  // Anzeige; dann bleibt der Rollback-Fehler unsichtbar, obwohl er da ist (gemessen: der Test war
  // gegen den D4-Stand gruen, bevor dieser Schalter existierte).
  listeScheitert: false,
  // JOB 2709 D5: der SERVERZUSTAND, getrennt von dem, was die UI gerade haelt.
  //
  // Zuerst hatte die Attrappe `m.seen = true` direkt auf den Objekten gesetzt, die react-query
  // bereits ausgeliefert hatte — die UI sah die Bestaetigung dadurch OHNE Neuabruf, und der
  // Rollback-Fehler blieb unsichtbar (gemessen: der Test war gegen den D4-Stand zweimal gruen).
  // Das war ein Fehler im Testaufbau, nicht im Produkt: Ein echter Server aendert nichts an
  // Objekten, die der Client schon hat. Bestaetigungen stehen deshalb hier, und `list` baut daraus
  // FRISCHE Objekte — sichtbar werden sie erst nach einem gelungenen Neuabruf.
  serverSeen: new Set<string>(),
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    reasoner: {
      status: vi.fn(async () => ({ active: true, mode: "cloud", reachable: "active" })),
      config: vi.fn(async () => null),
    },
    notifications: {
      list: vi.fn(async () => {
        if (lage.listeScheitert) {
          throw new TypeError("Failed to fetch");
        }
        // FRISCHE Objekte aus dem Serverzustand — nie die, die die UI schon haelt.
        return lage.meldungen.map((m) => ({ ...m, seen: m.seen || lage.serverSeen.has(m.id) }));
      }),
      markSeen: vi.fn(async (ids: string[]) => {
        lage.gesendet.push(ids);
        // JOB 2709 D5: Im Handbetrieb entscheidet der Test, wann und wie dieser Aufruf endet.
        // Nur so lassen sich zwei Aufrufe wirklich ueberlappen: A bleibt offen, B laeuft durch.
        if (lage.handbetrieb) {
          return await new Promise<{ unseenCount: number }>((erfuellenRoh, ablehnen) => {
            lage.offen.push({
              ids,
              erfuellen: () => {
                // Der Server merkt es sich — die UI erfaehrt es erst beim naechsten Abruf.
                for (const id of ids) {
                  lage.serverSeen.add(id);
                }
                erfuellenRoh({
                  unseenCount: lage.meldungen.filter((m) => !m.seen && !lage.serverSeen.has(m.id))
                    .length,
                });
              },
              scheitern: (fehler: unknown) => ablehnen(fehler),
            });
          });
        }
        if (lage.antwort.art === "apiFehler") {
          throw new ApiError(lage.antwort.status, lage.antwort.code, lage.antwort.message);
        }
        if (lage.antwort.art === "netzfehler") {
          // Kein Statuscode — der Fall, in dem es gar keine Serverantwort gibt.
          throw new TypeError("Failed to fetch");
        }
        for (const m of lage.meldungen) {
          if (ids.includes(m.id)) {
            m.seen = true;
          }
        }
        return { unseenCount: lage.meldungen.filter((m) => !m.seen).length };
      }),
    },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { Topbar } from "../../apps/web/src/shell/Topbar";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die Servermeldung, die `notifications-routes.ts` bei mehr als 5.000 Kennungen liefert. */
const SERVERSATZ = "Zu viele Meldungen auf einmal: 5001. Höchstens 5000 pro Vorgang.";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/start"] },
                  createElement(Topbar),
                  // OHNE den Viewport landet der Toast nirgends im DOM — dann wäre „sichtbar"
                  // nicht messbar, und der Test bewiese nichts über das, was der Mensch sieht.
                  createElement(ToastViewport),
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

function seitentext(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

function knopfMit(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
}

async function klick(knopf: HTMLButtonElement): Promise<void> {
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

/** Die Glocke öffnen — sie markiert dabei NICHT, weil der Bestand hier schon `seen` trägt. */
async function glockeOeffnen(): Promise<void> {
  const glocke = [...document.body.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === i18n.t("topbar.notifications"),
  );
  if (!glocke) {
    throw new Error(`Glocken-Knopf nicht gefunden. Sichtbar: ${seitentext().slice(0, 300)}`);
  }
  await klick(glocke as HTMLButtonElement);
}

function meldungen(n: number, seen = false) {
  return Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    kind: "conflict",
    title: `Meldung ${i}`,
    seen,
  }));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  lage.meldungen = [];
  lage.antwort = { art: "erfolg" };
  lage.gesendet = [];
  // JOB 2709 D5: auch der Handbetrieb muss je Fall frisch sein — sonst zaehlt der naechste Fall
  // die offenen Aufrufe des vorigen mit. Genau das ist mir beim ersten Lauf passiert.
  lage.handbetrieb = false;
  lage.offen = [];
  lage.listeScheitert = false;
  lage.serverSeen = new Set<string>();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

// ================================================================================================
describe("JOB 2709 D4 · die Glocke bei ablehnendem Server", () => {
  it("U1 · DER BEFUNDFALL: der Satz des Servers wird für den Menschen SICHTBAR", async () => {
    lage.meldungen = meldungen(5001);
    lage.antwort = { art: "apiFehler", status: 400, code: "TOO_MANY_IDS", message: SERVERSATZ };
    await mount();
    await glockeOeffnen();

    const knopf = knopfMit(i18n.t("topbar.notifMarkAll"));
    expect(knopf, "der Knopf Alle gelesen fehlt").toBeTruthy();
    await klick(knopf as HTMLButtonElement);

    expect(seitentext(), "die Servermeldung steht nicht am Bildschirm").toContain(SERVERSATZ);
  });

  it("U2 · kein generischer Serverfehler — die Meldung nennt beide Zahlen", async () => {
    lage.meldungen = meldungen(5001);
    lage.antwort = { art: "apiFehler", status: 400, code: "TOO_MANY_IDS", message: SERVERSATZ };
    await mount();
    await glockeOeffnen();
    await klick(knopfMit(i18n.t("topbar.notifMarkAll")) as HTMLButtonElement);

    const text = seitentext();
    expect(text).toContain("5001");
    expect(text).toContain("5000");
    expect(text, "es erscheint ein technischer Serverfehler").not.toMatch(/500\b|Serverfehler/i);
  });

  it("U3 · KEINE DARGESTELLTE TEILMARKIERUNG: der Knopf steht noch da", async () => {
    // Der Kern. Ohne die Rücknahme fällt `unreadCount` auf 0, und der Knopf verschwindet — die
    // Glocke behauptet dann, alles sei gelesen, obwohl nichts gespeichert wurde.
    lage.meldungen = meldungen(5001);
    lage.antwort = { art: "apiFehler", status: 400, code: "TOO_MANY_IDS", message: SERVERSATZ };
    await mount();
    await glockeOeffnen();
    await klick(knopfMit(i18n.t("topbar.notifMarkAll")) as HTMLButtonElement);

    expect(
      knopfMit(i18n.t("topbar.notifMarkAll")),
      "der Knopf verschwand — die Glocke hält die Meldungen für gelesen",
    ).toBeTruthy();
  });

  it("U4 · KEINE PERSISTIERTE TEILMARKIERUNG: genau ein Versuch, nichts gespeichert", async () => {
    lage.meldungen = meldungen(5001);
    lage.antwort = { art: "apiFehler", status: 400, code: "TOO_MANY_IDS", message: SERVERSATZ };
    await mount();
    await glockeOeffnen();
    // Das Öffnen ist selbst schon ein Markierversuch (siehe U7). Hier interessiert der KLICK,
    // deshalb wird ab hier neu gezählt — sonst misst der Fall zwei Vorgänge und behauptet einen.
    lage.gesendet = [];
    await klick(knopfMit(i18n.t("topbar.notifMarkAll")) as HTMLButtonElement);

    expect(lage.gesendet, "der Client schob nach").toHaveLength(1);
    expect(lage.gesendet[0]).toHaveLength(5001);
    expect(
      lage.meldungen.filter((m) => m.seen),
      "es wurde trotz Ablehnung etwas gespeichert",
    ).toHaveLength(0);
  });

  it("U5 · KALIBRIERUNG ERFOLG: bei 200 bleibt der Knopf weg und es erscheint KEIN Toast", async () => {
    // Ohne diesen Fall wäre auch eine Rücknahme grün, die IMMER greift — dann wäre „Alle gelesen"
    // im Normalfall kaputt, und niemand hätte es gemerkt.
    //
    // Gemessen am ÖFFNEN, nicht am Knopf: Bei Erfolg markiert schon das Öffnen alles, und der
    // Knopf ist danach zu Recht verschwunden (er hängt an `unreadCount > 0`). Ein Klick auf einen
    // Knopf, den es nicht mehr gibt, wäre kein Fall, sondern ein Fehler im Test.
    lage.meldungen = meldungen(3);
    lage.antwort = { art: "erfolg" };
    await mount();

    await glockeOeffnen();

    expect(lage.gesendet, "das Öffnen markierte gar nicht").toHaveLength(1);
    expect(
      lage.meldungen.every((m) => m.seen),
      "der Server hat nicht gespeichert",
    ).toBe(true);
    expect(
      knopfMit(i18n.t("topbar.notifMarkAll")),
      "der Knopf blieb trotz Erfolg stehen — die Rücknahme greift auch im Erfolgsfall",
    ).toBe(undefined);
    expect(seitentext(), "im Erfolgsfall erschien eine Fehlermeldung").not.toContain(
      i18n.t("topbar.notifSeenReverted"),
    );
  });

  it("U6 · KALIBRIERUNG NETZABBRUCH: ohne Serverantwort erscheint der Auffangsatz", async () => {
    // Der Fall, der über die 5.000er-Grenze hinausgeht und der D3-Befund erst gross macht: JEDER
    // Fehlschlag verhielt sich bisher gleich stumm.
    lage.meldungen = meldungen(3);
    lage.antwort = { art: "netzfehler" };
    await mount();
    await glockeOeffnen();
    await klick(knopfMit(i18n.t("topbar.notifMarkAll")) as HTMLButtonElement);

    expect(seitentext()).toContain(i18n.t("topbar.notifSeenFailed"));
    expect(knopfMit(i18n.t("topbar.notifMarkAll")), "auch hier fehlt die Rücknahme").toBeTruthy();
  });

  it("U7 · DAS ÖFFNEN DES PANELS ist derselbe Weg — und keine stille Ausnahme", async () => {
    // `toggleOpen` markiert alles Sichtbare, ohne dass jemand den Knopf drückt. Ohne diesen Fall
    // bliebe der häufigste Weg ungeprüft.
    lage.meldungen = meldungen(5001);
    lage.antwort = { art: "apiFehler", status: 400, code: "TOO_MANY_IDS", message: SERVERSATZ };
    await mount();

    await glockeOeffnen(); // allein das Öffnen löst `persistSeen` aus

    expect(seitentext(), "das Öffnen blieb stumm").toContain(SERVERSATZ);
    expect(lage.gesendet).toHaveLength(1);
    expect(lage.meldungen.filter((m) => m.seen)).toHaveLength(0);
  });

  it("U8 · die Meldung sagt AUCH, was die Glocke getan hat", async () => {
    // Der Server nennt den Grund; was mit der Anzeige geschehen ist, kann nur der Client sagen.
    // Ohne diesen Satz bliebe offen, ob die Meldungen nun gelesen sind.
    lage.meldungen = meldungen(5001);
    lage.antwort = { art: "apiFehler", status: 400, code: "TOO_MANY_IDS", message: SERVERSATZ };
    await mount();
    await glockeOeffnen();
    await klick(knopfMit(i18n.t("topbar.notifMarkAll")) as HTMLButtonElement);

    expect(seitentext()).toContain(i18n.t("topbar.notifSeenReverted"));
  });
});

// ================================================================================================
// JOB 2709 · D5 — DIE RUECKNAHME NIMMT NUR DAS EIGENE ZURUECK.
// ================================================================================================
//
// DER BEFUND (BEN zu D4, PRODUKT ROT bei CODE-URTEIL GRUEN):
//
//   „Die sichtbare Ruecknahme funktioniert im isolierten Fehlerfall, aber der weiterhin gebaute
//    Vollsnapshot-Rollback kann eine spaeter erfolgreich bestaetigte Gelesen-Markierung wieder
//    loeschen."
//
// D4 merkte sich den GANZEN `readIds`-Stand vor dem Request und schrieb ihn bei Fehlschlag zurueck.
// Passiert dazwischen etwas Erfolgreiches, ist es weg:
//
//     A startet   (markiert Eintraege, Request laeuft)
//     B startet   (markiert einen weiteren Eintrag)  -> Server bestaetigt B
//     A scheitert -> Vollsnapshot von VOR A zurueck  -> Bs bestaetigte Markierung ist geloescht
//
// Der Mensch sieht eine Meldung wieder auftauchen, die der Server schon als gelesen gespeichert
// hat — beim naechsten Laden verschwindet sie erneut. Dasselbe Verwirrungsmuster wie in D3, nur
// andersherum. Ich habe diese Falle im D4-Kommentar selbst benannt und dann die umgekehrte gebaut.
//
// AUFBAU NACH DEM SKELETT AUS §3 DES AUFTRAGS. Abweichungen sind unten an Ort und Stelle benannt.
describe("JOB 2709 D5 · zwei ueberlappende Aufrufe", () => {
  /** Wartet, bis die Bedingung gilt — Eigenbau, weil es keine Testing-Library im Projekt gibt. */
  async function warteBis(bedingung: () => boolean, was: string, grenzeMs = 2000): Promise<void> {
    const ende = Date.now() + grenzeMs;
    while (Date.now() < ende) {
      if (bedingung()) {
        return;
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
    }
    throw new Error(`Zeitueberschreitung beim Warten darauf, dass ${was}`);
  }

  /** Die Zahl an der Glocke, so wie der Mensch sie sieht. */
  function glockenZahl(): number {
    const glocke = [...document.body.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === i18n.t("topbar.notifications"),
    );
    const text = (glocke?.textContent ?? "").replace(/\D+/g, "");
    return text === "" ? 0 : Number(text);
  }

  /** Wie oft der Fehlersatz im DOM steht — genau einmal, nicht zweimal. */
  function fehlerToasts(): number {
    const marke = i18n.t("topbar.notifSeenReverted");
    return [...document.body.querySelectorAll("*")].filter(
      (el) => el.children.length === 0 && (el.textContent ?? "").includes(marke),
    ).length;
  }

  it("U9 · A scheitert, B war erfolgreich — Bs Markierung BLEIBT", async () => {
    // ---- SETUP ---------------------------------------------------------------------------------
    // Fuenf ungelesene Meldungen. A markiert die ersten vier, B die fuenfte.
    lage.meldungen = meldungen(5);
    lage.handbetrieb = true;
    await mount();

    // ---- 1. A ausloesen: bleibt OFFEN ----------------------------------------------------------
    // Das Oeffnen des Panels markiert alles Sichtbare (`toggleOpen`) — das ist Aufruf A.
    await glockeOeffnen();
    await warteBis(() => lage.offen.length === 1, "Aufruf A den Server erreicht");
    const a = lage.offen[0];
    expect(a?.ids, "A markierte nicht alle fuenf").toHaveLength(5);

    // ---- 2. B ausloesen ------------------------------------------------------------------------
    //
    // ABWEICHUNG VOM SKELETT, benannt und begruendet: Das Skelett sagt „B markiert EINEN
    // ZUSAETZLICHEN Eintrag". Am Produkt geht das nicht — A erfasst beim Oeffnen ALLES Sichtbare,
    // ein sechster ungelesener Eintrag entsteht nur durch einen Refetch, und der laeuft erst nach
    // einem ERFOLGREICHEN `persistSeen` (`invalidateQueries` im `.then`). Solange A haengt, gibt es
    // keinen.
    //
    // Deshalb ist B hier eine TEILMENGE von A: der Klick auf den Meldungstitel
    // (`openTarget`, `Topbar.tsx:232-233`) ruft `markRead(n.id)` und ist der einzige Auslöser, der
    // auch bei optisch gelesener Zeile noch da ist (der ✓-Knopf verschwindet bei `read`).
    //
    // FACHLICH IST DAS DERSELBE KONFLIKT, um den BEN es geht — sogar der schaerfere: dieselbe
    // Kennung, einmal unbestaetigt aus A, einmal BESTAETIGT aus B. Ein Vollsnapshot-Rollback von A
    // loescht sie; eine mengenbezogene Ruecknahme darf sie nicht anfassen.
    //
    // Und es ist ein echter Nutzerweg: die Glocke oeffnen und sofort eine Meldung anklicken.
    const titelKnopf = [...document.body.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("Meldung 0"),
    );
    expect(titelKnopf, "kein Meldungstitel zum Anklicken gefunden").toBeTruthy();
    await klick(titelKnopf as HTMLButtonElement);
    await warteBis(() => lage.offen.length === 2, "Aufruf B den Server erreicht");
    const b = lage.offen[1];
    expect(b?.ids, "B markierte nicht genau einen Eintrag").toHaveLength(1);
    const bKennung = b?.ids[0] as string;

    // ---- 3. B aufloesen: der Server bestaetigt -------------------------------------------------
    //
    // Das Netz ist ab hier weg — dasselbe Netz, an dem A gleich scheitert. Der Neuabruf, den
    // Bs Erfolg anstoesst, kommt deshalb nicht durch, und die Glocke muss aus EIGENER Kraft
    // wissen, was bestaetigt ist. Ohne diesen Schalter holt react-query den Serverstand nach,
    // `n.seen` rettet die Anzeige, und der Rollback-Fehler bleibt unsichtbar — gemessen: genau so
    // war dieser Test gegen den D4-Stand zuerst gruen.
    lage.listeScheitert = true;
    await act(async () => {
      b?.erfuellen();
      await flush();
    });
    await act(flush);
    expect(lage.serverSeen.has(bKennung), "der Server hat B nicht gespeichert").toBe(true);

    // ---- 4. A scheitern lassen -----------------------------------------------------------------
    await act(async () => {
      a?.scheitern(new TypeError("Failed to fetch"));
      await flush();
    });
    await act(flush);

    // ---- ERWARTUNG, vier eigene Assertions -----------------------------------------------------
    //
    // Gemessen wird an der GLOCKENZAHL, nicht an den Panelzeilen: Der Titelklick schliesst das
    // Panel (`openTarget` ruft `setOpen(false)`), die Zeilen sind danach nicht mehr im DOM. Die
    // Zahl am Glockensymbol ist ohnehin das, was der Mensch dauerhaft sieht.

    // (1) As unbestaetigte Wirkung ist ZURUECKGENOMMEN — die vier anderen sind wieder ungelesen.
    //     Waere gar nichts zurueckgenommen worden, stuende hier 0.
    expect(
      glockenZahl(),
      "die Ruecknahme von A greift nicht — die Glocke behauptet weiter, alles sei gelesen",
    ).toBeGreaterThan(0);

    // (2) Bs BESTAETIGTE Wirkung ist ERHALTEN — die Assertion, an der der D4-Stand faellt.
    //     Vier statt fuenf: die eine von B bestaetigte Meldung bleibt gelesen.
    expect(
      glockenZahl(),
      "Bs bestaetigte Markierung wurde vom Vollsnapshot-Rollback mitgeloescht",
    ).toBe(4);

    // (3) Die Glockenzahl entspricht dem Serverstand.
    expect(glockenZahl()).toBe(
      lage.meldungen.filter((m) => !m.seen && !lage.serverSeen.has(m.id)).length,
    );

    // (4) Genau EIN Fehler-Toast, und zwar fuer A.
    expect(fehlerToasts(), "es erschien kein oder mehr als ein Fehler-Toast").toBe(1);
    expect(seitentext()).toContain(i18n.t("topbar.notifSeenFailed"));
  });

  // ==============================================================================================
  // JOB 2709 D7 — DER INVERSE FALL: NICHT DIE BESTAETIGUNG IST BEDROHT, SONDERN DER OFFENE ANSPRUCH.
  // ==============================================================================================
  //
  // BEN zu D5 (GRUEN, mit genau dieser Pruefluecke): D5 schuetzt eine BESTAETIGTE Kennung vor der
  // Ruecknahme eines fremden Aufrufs — `bestaetigt` ist das Sieb. Ungeschuetzt bleibt der
  // umgekehrte Fall, und er ist derselbe Nutzerweg:
  //
  //     A startet   (markiert x, Aufruf laeuft NOCH)
  //     B startet   (markiert x ebenfalls)  -> B SCHEITERT
  //     Bs Catch loescht x                  -> obwohl A noch offen ist und x weiter beansprucht
  //
  // `bestaetigt` hilft hier NICHT: A hat noch nichts bestaetigt, x steht also nicht darin, und Bs
  // `delete` greift durch. Der Mensch sieht eine Meldung wieder aufspringen, die er gerade gelesen
  // hat — und wenn A gleich darauf gelingt, springt sie ein zweites Mal um. Zwei Sprunge fuer einen
  // einzigen Fehlschlag.
  //
  // WARUM DAS EINE REFERENZZAEHLUNG BRAUCHT und kein zweites Set: Ein Set kennt nur „drin" oder
  // „draussen". Hier ist die Frage aber, WIE VIELE Aufrufe eine Kennung gerade beanspruchen —
  // und geloescht werden darf sie erst, wenn der letzte davon gescheitert ist. Das ist eine Zahl,
  // kein Ja/Nein.
  //
  // DIE DREI SICHTBAREN ZUSICHERUNGEN stehen einzeln, jede am gemounteten Client, keine am
  // Response: der Gelesen-Zustand der Zeile, die Glockenzahl und die Zahl der Toasts.
  it("U11 · DER INVERSE FALL: B scheitert, waehrend A fuer dieselbe Kennung noch OFFEN ist", async () => {
    // ---- SETUP ---------------------------------------------------------------------------------
    lage.meldungen = meldungen(5);
    lage.handbetrieb = true;
    await mount();

    // ---- 1. A ausloesen: markiert alles Sichtbare, bleibt OFFEN ---------------------------------
    await glockeOeffnen();
    await warteBis(() => lage.offen.length === 1, "Aufruf A den Server erreicht");
    expect(lage.offen[0]?.ids, "A markierte nicht alle fuenf").toHaveLength(5);
    // Die Ausgangslage wird GEMESSEN, nicht angenommen: A haelt alle fuenf optimistisch gelesen.
    expect(glockenZahl(), "A hat nicht optimistisch markiert").toBe(0);

    // ---- 2. B ausloesen: dieselbe Kennung, ueber den Titelklick ---------------------------------
    // Derselbe echte Nutzerweg wie in U9 — Glocke oeffnen, sofort eine Meldung anklicken. Der
    // Unterschied zu U9 liegt nicht im Weg, sondern darin, WER scheitert.
    const titelKnopf = [...document.body.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("Meldung 0"),
    );
    expect(titelKnopf, "kein Meldungstitel zum Anklicken gefunden").toBeTruthy();
    await klick(titelKnopf as HTMLButtonElement);
    await warteBis(() => lage.offen.length === 2, "Aufruf B den Server erreicht");
    const b = lage.offen[1];
    expect(b?.ids, "B markierte nicht genau einen Eintrag").toHaveLength(1);
    const x = b?.ids[0] as string;

    // ---- 3. B scheitern lassen — A bleibt ausdruecklich OFFEN -----------------------------------
    await act(async () => {
      b?.scheitern(new TypeError("Failed to fetch"));
      await flush();
    });
    await act(flush);
    // Die Voraussetzung des Falls wird GEPRUEFT: A darf nicht nebenbei fertig geworden sein, sonst
    // misst der Test etwas anderes als den offenen Anspruch.
    expect(
      lage.serverSeen.has(x),
      "der Server hat x gespeichert — dann ist es nicht dieser Fall",
    ).toBe(false);

    // ---- ZUSICHERUNG 1 · GLOCKENZAHL -----------------------------------------------------------
    // x bleibt gelesen, weil A es weiterhin beansprucht. Steigt die Zahl auf 1, hat Bs Ruecknahme
    // den fremden, noch offenen Anspruch mitgeloescht — genau der Befund.
    expect(
      glockenZahl(),
      "x wurde zurueckgesetzt, obwohl A es noch beansprucht — die Ruecknahme von B griff zu weit",
    ).toBe(0);

    // ---- ZUSICHERUNG 2 · TOAST -----------------------------------------------------------------
    // Genau EINER, fuer den gescheiterten Aufruf B. Nicht null (dann bliebe der Fehlschlag stumm),
    // nicht zwei (dann meldete auch der noch laufende A etwas).
    expect(fehlerToasts(), "es erschien kein oder mehr als ein Fehler-Toast").toBe(1);
    expect(seitentext()).toContain(i18n.t("topbar.notifSeenFailed"));

    // ---- ZUSICHERUNG 3 · GELESEN-ZUSTAND DER ZEILE ---------------------------------------------
    // Der Titelklick schliesst das Panel (`openTarget` ruft `setOpen(false)`), fuer die Zeile muss
    // es wieder geoeffnet werden. Das ist unbedenklich UND zugleich eine eigene Aussage: Ist x
    // korrekt weiterhin gelesen, gibt es nichts Ungelesenes, `persistSeen` steigt bei leerer Liste
    // sofort aus — es entsteht KEIN dritter Aufruf. Waere x faelschlich zurueckgesetzt, entstuende
    // einer und wuerde x optisch gleich wieder markieren; die Zeilenpruefung allein waere dann
    // blind. Die Aufrufzahl schliesst diese Luecke.
    await glockeOeffnen();
    await act(flush);
    expect(
      lage.offen.length,
      "das Oeffnen loeste einen dritten Aufruf aus — x war also ungelesen",
    ).toBe(2);
    const zeile = [...document.body.querySelectorAll("li")].find((li) =>
      (li.textContent ?? "").includes("Meldung 0"),
    );
    expect(zeile, "die Zeile von x ist nicht im Panel").toBeTruthy();
    expect(
      zeile?.className.includes("opacity-50"),
      "die Zeile von x wird als UNGELESEN dargestellt, obwohl A sie noch beansprucht",
    ).toBe(true);
  });

  it("U12 · DIE FORTSETZUNG: A gelingt danach — x bleibt gelesen, die Zahl trifft den Serverstand", async () => {
    // Ohne diesen Fall bliebe offen, ob der Anspruch von A nach Bs Fehlschlag ueberhaupt noch
    // existiert oder nur die Anzeige zufaellig stehen blieb. Hier wird er eingeloest.
    lage.meldungen = meldungen(5);
    lage.handbetrieb = true;
    await mount();

    await glockeOeffnen();
    await warteBis(() => lage.offen.length === 1, "Aufruf A den Server erreicht");
    const a = lage.offen[0];

    const titelKnopf = [...document.body.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("Meldung 0"),
    );
    await klick(titelKnopf as HTMLButtonElement);
    await warteBis(() => lage.offen.length === 2, "Aufruf B den Server erreicht");
    const x = lage.offen[1]?.ids[0] as string;

    // DAS NETZ IST AB HIER WEG — und das ist der Kern dieses Falls, nicht Beiwerk.
    //
    // GEMESSEN (erster Lauf dieses Durchgangs): OHNE diese Zeile war U12 gegen den D5-Stand GRUEN.
    // Nicht weil der Fehler fehlte, sondern weil As Erfolg `invalidateQueries` ausloest, die Liste
    // neu kommt und `n.seen` die Anzeige rettet. Der Test haette dann den Refetch gemessen statt
    // des Anspruchs. Das ist DIESELBE Falle, die mich in D5 zweimal erwischt hat; hier ist sie
    // beim dritten Mal erkannt und geschlossen.
    //
    // Mit dem Schalter muss die Glocke aus EIGENER Kraft wissen, dass x gelesen ist — und genau
    // das leistet nur der durchgehaltene Anspruch von A.
    lage.listeScheitert = true;

    // B scheitert ...
    await act(async () => {
      lage.offen[1]?.scheitern(new TypeError("Failed to fetch"));
      await flush();
    });
    await act(flush);

    // ... und A gelingt.
    await act(async () => {
      a?.erfuellen();
      await flush();
    });
    await act(flush);

    // Der Server fuehrt x jetzt als gelesen — und die Glocke sagt dasselbe.
    expect(lage.serverSeen.has(x), "A hat x nicht gespeichert").toBe(true);
    expect(
      glockenZahl(),
      "die Glocke weicht vom Serverstand ab, nachdem A den Anspruch eingeloest hat",
    ).toBe(lage.meldungen.filter((m) => !m.seen && !lage.serverSeen.has(m.id)).length);
    expect(glockenZahl(), "x ist nicht gelesen, obwohl der Server es bestaetigt hat").toBe(0);
    // Immer noch genau EIN Toast: der Erfolg von A meldet nichts, und Bs Fehlschlag wird nicht
    // nachtraeglich zu einem zweiten.
    expect(fehlerToasts()).toBe(1);
  });

  it("U10 · KALIBRIERUNG: scheitert NUR A und gab es kein B, wird alles von A zurueckgenommen", async () => {
    // Ohne diesen Fall waere auch eine Fassung gruen, die gar nichts mehr zurueoecknimmt.
    lage.meldungen = meldungen(3);
    lage.handbetrieb = true;
    await mount();

    await glockeOeffnen();
    await warteBis(() => lage.offen.length === 1, "der Aufruf den Server erreicht");

    await act(async () => {
      lage.offen[0]?.scheitern(new TypeError("Failed to fetch"));
      await flush();
    });
    await act(flush);

    expect(glockenZahl(), "die Ruecknahme greift nicht mehr").toBe(3);
    expect(knopfMit(i18n.t("topbar.notifMarkAll"))).toBeTruthy();
    expect(fehlerToasts()).toBe(1);
  });
});
