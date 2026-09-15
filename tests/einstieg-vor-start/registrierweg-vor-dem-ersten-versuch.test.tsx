// @vitest-environment jsdom
// ================================================================================================
// JOB 4105 · EINSTIEG-HILFE — DIE MASKE WEISS VOR DEM ERSTEN TIPPEN, OB ZUGÄNGE SELBST ANGELEGT
// WERDEN KÖNNEN.
// ================================================================================================
//
// DER BEFUND (Produkt-main b949390). JOB 4081 hat den Kreis nach dem Fehlversuch geschlossen: Wer
// abgewiesen wurde, liest seitdem die Auskunft mit dem Ausweg. Offen blieb der Weg DAVOR — die
// Absage kam erst NACH vier ausgefüllten Feldern. Der Serverschalter war der Maske unbekannt:
// `GET /api/auth/status` meldete nur `needsSetup` und `oidcEnabled`, und der Merker
// `registrierungGeschlossen` (`AuthScreens.tsx:50`) ist beim ersten Aufbau immer `false`. Der Knopf
// „Noch kein Konto? Registrieren" stand also auch auf einer Instanz da, die gar keine Konten
// annimmt.
//
// WAS HIER GEMESSEN WIRD. Die ECHTE Maske am echten `AuthProvider` gegen eine gestellte Auth-API,
// deren `status`-Antwort je Fall gestellt wird. Gemessen wird am DOM VOR jeder Eingabe und am
// Aufrufzähler von `authApi.register` — nicht am Datentyp und nicht am Quelltext. Ein Feld in einer
// JSON-Antwort, das keine Fläche verändert, hilft keiner Besucherin.
//
// DIE FÄLLE:
//   V1  Server sagt AUS: die Auskunft steht sofort, der Knopf in die Absage ist weg.
//   V2  Server sagt AN: alles wie bisher, bis hin zum tatsächlichen Registrieraufruf.
//   V3  Server hat noch nichts gesagt / ist nicht erreichbar: die Maske behauptet NICHTS.
//   V4  Älterer Server ohne das Feld: unbekannt ist nicht „aus".
//   V5  Bei AUS ist der Weg auch VON INNEN zu — weder Klick noch Eingabetaste schicken etwas ab.
//   V6  de/en/nl: je eigener Satz, keiner ist der deutsche.
//   V8  Gescheiterte Auffrischung kippt die Aussage NICHT von „aus" nach „an".
//   V9  GEGENPROBE Ersteinrichtung: bei `needsSetup` blendet die neue Bedingung nichts ein.
//   V10 GEGENPROBE Nachbarwege: bei AUS melden sich Anmeldung und „Passwort vergessen" normal.
//
// Der Serververtrag (V7) liegt daneben in `statusauskunft-serververtrag.test.ts` — er braucht die
// echte App und keine jsdom-Umgebung.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die gestellte HTTP-Grenze. NUR `api/auth` wird ersetzt; `ApiError`, die Maske, der
// Sitzungskontext und i18n sind echt.
const server = vi.hoisted(() => ({
  // Was `GET /auth/status` antwortet. `null` = die Antwort bleibt aus (hängende Abfrage),
  // `"fehler"` = das Backend ist nicht erreichbar.
  statusAntwort: { needsSetup: false } as Record<string, unknown> | null | "fehler",
  // Wird gesetzt, solange eine hängende Statusabfrage offen ist — damit V5 sie gezielt beantworten
  // kann, NACHDEM die Person den Knopf gedrückt hat.
  statusAufloesen: null as null | ((antwort: Record<string, unknown>) => void),
  statusAufrufe: 0,
  // Die drei Aufrufzähler. Am DOM allein ist nicht zu erkennen, ob ein Aufruf hinausgegangen ist.
  registerAufrufe: 0,
  loginAufrufe: 0,
  forgotAufrufe: 0,
}));

vi.mock("../../apps/web/src/api/auth", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const abgelehnt = (): Promise<never> =>
    Promise.reject(new ApiError(401, "UNAUTHORIZED", "keine Sitzung"));
  return {
    authApi: {
      status: () => {
        server.statusAufrufe += 1;
        const antwort = server.statusAntwort;
        if (antwort === "fehler") {
          return Promise.reject(new ApiError(500, "INTERNAL", "Backend nicht erreichbar"));
        }
        if (antwort === null) {
          return new Promise<Record<string, unknown>>((fertig) => {
            server.statusAufloesen = (spaeter) => {
              server.statusAntwort = spaeter;
              server.statusAufloesen = null;
              fertig(spaeter);
            };
          });
        }
        return Promise.resolve(antwort);
      },
      me: abgelehnt,
      notice: abgelehnt,
      acknowledgeNotice: abgelehnt,
      logout: () => Promise.resolve(),
      login: () => {
        server.loginAufrufe += 1;
        return Promise.resolve({});
      },
      setup: () => Promise.resolve({}),
      forgot: () => {
        server.forgotAufrufe += 1;
        return Promise.resolve();
      },
      register: () => {
        server.registerAufrufe += 1;
        return Promise.resolve({});
      },
      ssoStartUrl: "/api/auth/oidc/start",
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { AuthScreens } from "../../apps/web/src/auth/AuthScreens";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

/** Der Wortlaut EINER Sprache, unabhängig davon, welche gerade eingestellt ist. */
const wort = (sprache: Sprache, schluessel: string): string =>
  String(i18n.getResource(sprache, "translation", schluessel) ?? "");

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
// Der Abfragespeicher dieser Montage — `abbauen()` leert ihn, damit kein `gcTime`-Zeitgeber diese
// Datei überlebt (Begründung ausführlich in der Nachbardatei
// `anmeldemaske-fuehrt-nicht-in-die-absage.test.tsx`).
let klient: QueryClient | null = null;

async function durchlaufen(): Promise<void> {
  // Genug Makrotasks, damit Antwort UND Zustandswechsel wirklich durch den Baum laufen. Zu knapp
  // gewartet wäre jeder „nichts da"-Fall grün, ohne etwas zu prüfen.
  for (let i = 0; i < 30; i += 1) {
    await new Promise((fertig) => setTimeout(fertig, 0));
  }
}

async function abbauen(): Promise<void> {
  const wurzel = root;
  if (wurzel) {
    await act(async () => {
      wurzel.unmount();
    });
  }
  container?.remove();
  klient?.clear();
  container = null;
  root = null;
  klient = null;
}

async function montieren(
  optionen: { sprache?: Sprache; needsSetup?: boolean } = {},
): Promise<void> {
  const sprache = optionen.sprache ?? "de";
  await abbauen();
  await i18n.changeLanguage(sprache);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  klient = client;
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          AuthProvider,
          null,
          createElement(AuthScreens, { needsSetup: optionen.needsSetup ?? false }),
        ),
      ),
    );
  });
  await act(durchlaufen);
}

beforeEach(() => {
  server.statusAntwort = { needsSetup: false };
  server.statusAufloesen = null;
  server.statusAufrufe = 0;
  server.registerAufrufe = 0;
  server.loginAufrufe = 0;
  server.forgotAufrufe = 0;
});

afterEach(async () => {
  await abbauen();
  await i18n.changeLanguage("de");
});

function baum(): HTMLDivElement {
  if (!container) {
    throw new Error("nicht montiert");
  }
  return container;
}

const flaechentext = (): string => (baum().textContent ?? "").replace(/\s+/g, " ");
const felder = (): HTMLInputElement[] => [...baum().querySelectorAll("input")];
const knopfMit = (teil: string): HTMLButtonElement | undefined =>
  [...baum().querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(teil));
const absage = (): HTMLElement | null =>
  baum().querySelector("[data-testid=auth-registration-closed]");
const absageText = (): string => (absage()?.textContent ?? "").replace(/\s+/g, " ");
const absendeknopf = (): HTMLButtonElement | null =>
  baum().querySelector<HTMLButtonElement>("form button[type=submit]");

async function klick(knopf: HTMLButtonElement | undefined): Promise<void> {
  expect(knopf, "Knopf nicht gefunden").toBeDefined();
  await act(async () => {
    knopf?.click();
    await durchlaufen();
  });
}

/** Schreibt in ein Eingabefeld so, wie React es sieht. */
async function tippen(feld: HTMLInputElement | undefined, wert: string): Promise<void> {
  expect(feld, "Eingabefeld nicht gefunden").toBeDefined();
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
}

const mailfeld = (): HTMLInputElement | undefined => felder().find((f) => f.type === "email");
const passwortfelder = (): HTMLInputElement[] => felder().filter((f) => f.type === "password");

async function absenden(): Promise<void> {
  const formular = baum().querySelector("form");
  expect(formular, "kein Formular gefunden").not.toBeNull();
  await act(async () => {
    formular?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await durchlaufen();
  });
}

/** Die vier Felder des Registrierformulars ausfüllen (ohne Absenden). */
async function registrierfelderFuellen(): Promise<void> {
  const eingaben = felder();
  await tippen(eingaben[0], "Neue Person");
  await tippen(mailfeld(), "neu@example.org");
  const pws = passwortfelder();
  await tippen(pws[0], "geheim12345");
  await tippen(pws[1], "geheim12345");
}

describe("JOB 4105 · die Auskunft steht VOR dem ersten Registrierversuch", () => {
  it("V1 · Server sagt AUS: die Auskunft steht sofort, der Weg in die Absage wird nicht angeboten", async () => {
    server.statusAntwort = { needsSetup: false, selfRegistrationEnabled: false };
    await montieren();

    // Kalibrierung: die Maske ist wirklich da, sonst prüfte der Rest nichts.
    expect(flaechentext()).toContain(wort("de", "auth.title.login"));
    // Und es wurde nichts getippt und nichts abgeschickt — genau darum geht es.
    expect(server.registerAufrufe, "es ging ein Registrierversuch hinaus").toBe(0);

    const flaeche = absage();
    expect(flaeche, "die Auskunft fehlt, obwohl der Server „aus“ gemeldet hat").not.toBeNull();
    expect(absageText()).toContain(wort("de", "auth.registrationClosed.upfrontFact"));
    expect(absageText()).toContain(wort("de", "auth.registrationClosed.upfrontNext"));
    // Der Zustand wird berichtet, nicht ein Versuch: der Bestandssatz aus JOB 4081 spricht von
    // einer abgewiesenen Anlage und hat hier nichts zu suchen.
    expect(absageText()).not.toContain(wort("de", "auth.registrationClosed.fact"));
    // Kein Schlüsselname, kein interner Begriff auf der Fläche.
    expect(absageText()).not.toContain("auth.registrationClosed");
    expect(absageText()).not.toMatch(/REGISTRATION_DISABLED|fail-closed|Endpunkt|Schalter/i);

    expect(
      knopfMit(wort("de", "auth.toRegister")),
      "der Weg in die Absage steht weiter offen",
    ).toBeUndefined();
    // Der Alltagsfall bleibt unberührt.
    expect(knopfMit(wort("de", "auth.toForgot"))).toBeDefined();
  });

  it("V2 · Server sagt AN: Knopf statt Auskunft, und der Weg führt bis zum echten Registrieraufruf", async () => {
    server.statusAntwort = { needsSetup: false, selfRegistrationEnabled: true };
    await montieren();

    expect(absage(), "die Auskunft steht da, obwohl der Server „an“ gemeldet hat").toBeNull();
    const knopf = knopfMit(wort("de", "auth.toRegister"));
    expect(knopf, "der Registrierweg wurde zugemacht, obwohl er offen ist").toBeDefined();

    await klick(knopf);
    expect(flaechentext()).toContain(wort("de", "auth.title.register"));
    expect(
      absendeknopf()?.disabled,
      "der Absendeknopf ist gesperrt, obwohl der Weg offen ist",
    ).toBe(false);
    await registrierfelderFuellen();
    await absenden();
    expect(server.registerAufrufe, "der Registrierversuch kam nicht am Server an").toBe(1);
    expect(flaechentext()).toContain(wort("de", "auth.title.waiting"));
  });

  it("V3 · Antwort steht aus / Backend nicht erreichbar: die Maske behauptet NICHTS", async () => {
    // (a) Die Abfrage hängt — es gibt noch keine Antwort, über die zu berichten wäre.
    server.statusAntwort = null;
    await montieren();
    expect(server.statusAufrufe, "die Statusabfrage lief gar nicht").toBeGreaterThan(0);
    expect(absage(), "die Maske behauptet „aus“, bevor der Server geantwortet hat").toBeNull();
    expect(
      knopfMit(wort("de", "auth.toRegister")),
      "ohne Antwort verschwindet der Bestandsweg",
    ).toBeDefined();

    // (b) Das Backend antwortet mit einem Fehler — Unwissen, keine Aussage über den Schalter.
    server.statusAntwort = "fehler";
    await montieren();
    expect(absage(), "die Maske behauptet „aus“, obwohl sie nichts weiß").toBeNull();
    expect(knopfMit(wort("de", "auth.toRegister"))).toBeDefined();
  });

  it("V4 · älterer Server ohne das Feld: unbekannt ist nicht „aus“", async () => {
    server.statusAntwort = { needsSetup: false, oidcEnabled: false };
    await montieren();

    expect(absage(), "ein fehlendes Feld wurde als „aus“ gelesen").toBeNull();
    const knopf = knopfMit(wort("de", "auth.toRegister"));
    expect(knopf, "der Registrierweg wurde ohne Serveraussage zugemacht").toBeDefined();
    // Und der Weg funktioniert vollständig weiter — das Netz aus JOB 4081 liegt darunter.
    await klick(knopf);
    expect(absendeknopf()?.disabled).toBe(false);
  });

  // ================================================================================================
  // V5 — DER WEG IST AUCH VON INNEN ZU (Fortschreibung der Korrekturpflicht aus JOB 4081 R2).
  // ================================================================================================
  // Die Person ist schneller als das Netz: Sie drückt „Registrieren", solange die Statusabfrage noch
  // hängt (dort steht der Knopf zu Recht, V3a), und erst DANN kommt die Antwort „aus". Sie steht nun
  // in einem geöffneten Formular, dessen Weg der Server ablehnt — ohne dass je ein Versuch lief.
  // Gemessen wird der Aufrufzähler, nicht das Aussehen: „der Weg ist zu" ist etwas anderes als
  // „der Weg sieht zu aus".
  it("V5 · Server sagt AUS, während das Formular offen steht: weder Klick noch Eingabetaste schicken etwas ab", async () => {
    server.statusAntwort = null;
    await montieren();

    await klick(knopfMit(wort("de", "auth.toRegister")));
    expect(flaechentext()).toContain(wort("de", "auth.title.register"));
    await registrierfelderFuellen();

    // Jetzt antwortet der Server.
    const aufloesen = server.statusAufloesen;
    expect(aufloesen, "keine hängende Statusabfrage gefunden").not.toBeNull();
    await act(async () => {
      aufloesen?.({ needsSetup: false, selfRegistrationEnabled: false });
      await durchlaufen();
    });

    // Die Auskunft steht im Formular, dort wo die Person gerade ist.
    expect(absage(), "im geöffneten Formular fehlt die Auskunft").not.toBeNull();
    expect(absageText()).toContain(wort("de", "auth.registrationClosed.upfrontFact"));

    // Weg 1: der sichtbare Absendeknopf.
    const knopf = absendeknopf();
    expect(knopf, "kein Absendeknopf im Formular").not.toBeNull();
    await act(async () => {
      knopf?.click();
      await durchlaufen();
    });
    expect(server.registerAufrufe, "der Klick hat einen Registrierversuch abgeschickt").toBe(0);

    // Weg 2: die Eingabetaste. Sie gibt das Formular ab, ohne den Knopf zu berühren.
    await absenden();
    expect(server.registerAufrufe, "die Eingabetaste hat einen Versuch abgeschickt").toBe(0);

    // Erst jetzt das Aussehen: ein Knopf, der nachweislich nichts auslöst, darf nicht bedienbar
    // aussehen.
    expect(
      absendeknopf()?.disabled,
      "der Knopf löst nichts aus, sieht aber weiter bedienbar aus",
    ).toBe(true);
    // Und die eingetippte E-Mail bleibt stehen — es wird nichts weggeräumt.
    expect(mailfeld()?.value).toBe("neu@example.org");
  });

  it("V6 · de/en/nl tragen je einen eigenen Satz — keine Sprache erbt eine andere", async () => {
    for (const sprache of SPRACHEN) {
      server.statusAntwort = { needsSetup: false, selfRegistrationEnabled: false };
      await montieren({ sprache });
      expect(absage(), `keine Auskunft in ${sprache}`).not.toBeNull();
      expect(absageText(), `${sprache} zeigt nicht den ${sprache}-Text`).toContain(
        wort(sprache, "auth.registrationClosed.upfrontFact"),
      );
      expect(absageText()).toContain(wort(sprache, "auth.registrationClosed.upfrontNext"));
      if (sprache !== "de") {
        expect(absageText(), `${sprache} zeigt den deutschen Satz`).not.toContain(
          wort("de", "auth.registrationClosed.upfrontFact"),
        );
      }
    }

    for (const schluessel of [
      "auth.registrationClosed.upfrontFact",
      "auth.registrationClosed.upfrontNext",
    ]) {
      const werte = SPRACHEN.map((s) => wort(s, schluessel));
      for (const [i, w] of werte.entries()) {
        expect(w.length, `${schluessel} fehlt in ${SPRACHEN[i]}`).toBeGreaterThan(0);
      }
      expect(new Set(werte).size, `zwei Sprachen tragen denselben ${schluessel}`).toBe(
        SPRACHEN.length,
      );
    }
  });

  // ================================================================================================
  // V8 — EIN NETZFEHLER IST KEINE AUSSAGE ÜBER DEN SCHALTER (Zustandsmodell, Auftrag §9).
  // ================================================================================================
  // Dieselbe Unterscheidung, die `AuthContext.tsx` für den 401-Fall ausdrücklich trifft: Scheitert
  // eine AUFFRISCHUNG, gilt die letzte erfolgreiche Antwort weiter. Die Fläche darf nicht von „aus"
  // nach „an" kippen — sonst stünde nach einem Wackler wieder der Knopf da, der in die Absage führt.
  it("V8 · gescheiterte Auffrischung: die letzte erfolgreiche Antwort gilt weiter", async () => {
    server.statusAntwort = { needsSetup: false, selfRegistrationEnabled: false };
    await montieren();
    expect(absage()).not.toBeNull();

    server.statusAntwort = "fehler";
    const speicher = klient;
    expect(speicher, "kein Abfragespeicher").not.toBeNull();
    const vorher = server.statusAufrufe;
    await act(async () => {
      await speicher?.refetchQueries({ queryKey: ["auth", "status"] });
      await durchlaufen();
    });
    expect(server.statusAufrufe, "die Auffrischung lief gar nicht").toBeGreaterThan(vorher);

    expect(absage(), "ein Netzfehler hat die Auskunft weggenommen").not.toBeNull();
    expect(absageText()).toContain(wort("de", "auth.registrationClosed.upfrontFact"));
    expect(
      knopfMit(wort("de", "auth.toRegister")),
      "nach einem Netzfehler steht der Weg in die Absage wieder offen",
    ).toBeUndefined();
  });

  it("V9 · GEGENPROBE Ersteinrichtung: bei needsSetup blendet die neue Bedingung nichts ein", async () => {
    server.statusAntwort = { needsSetup: true, selfRegistrationEnabled: false };
    await montieren({ needsSetup: true });

    expect(flaechentext()).toContain(wort("de", "auth.title.setup"));
    expect(absage(), "die Auskunft drängt sich in die Ersteinrichtung").toBeNull();
    expect(absendeknopf()?.disabled, "die Ersteinrichtung wurde mitgesperrt").toBe(false);
  });

  it("V10 · GEGENPROBE Nachbarwege: bei AUS melden sich Anmeldung und „Passwort vergessen“ normal", async () => {
    server.statusAntwort = { needsSetup: false, selfRegistrationEnabled: false };
    await montieren();
    expect(absage()).not.toBeNull();

    // Anmelden: zwei Felder, abschicken — der Aufruf geht hinaus.
    await tippen(mailfeld(), "bekannt@example.org");
    await tippen(passwortfelder()[0], "geheim12345");
    await absenden();
    expect(server.loginAufrufe, "die Anmeldung wurde mitgesperrt").toBe(1);
    expect(server.registerAufrufe).toBe(0);

    // Passwort vergessen: eigener Weg, eigene Bestätigung.
    await montieren();
    await klick(knopfMit(wort("de", "auth.toForgot")));
    await tippen(mailfeld(), "bekannt@example.org");
    await absenden();
    expect(server.forgotAufrufe, "„Passwort vergessen“ wurde mitgesperrt").toBe(1);
    expect(flaechentext()).toContain(wort("de", "auth.forgotNote"));
  });
});
