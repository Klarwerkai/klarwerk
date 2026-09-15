// @vitest-environment jsdom
// ================================================================================================
// JOB 4081 · EINSTIEG-HILFE — DIE ANMELDEMASKE SCHICKT NIEMANDEN MEHR IN DIE ABSAGE.
// ================================================================================================
//
// DER BEFUND (Produkt-main 8cffff8). Die Anmeldemaske ist die EINZIGE Fläche, die eine neue Person
// ohne Konto überhaupt sieht — der Weg VOR `/start`. Sie bot „Registrieren" jedem an, ließ vier
// Felder ausfüllen und antwortete danach mit einer Absage im allgemeinen Fehlerkasten
// (`AuthScreens.tsx:52-55` → `:205-209`). Der Ausweg, den der Server selbst nennt
// („Einladung", `tests/security/vip2-gate.test.ts:67`), ging dabei verloren; danach stand die Maske
// wieder im Anfangszustand (`go()`, `:69-73` löscht `err`) und bot denselben Weg erneut an.
//
// WAS HIER GEMESSEN WIRD. Die ECHTE Maske am echten `AuthProvider` (Muster: mega61 Fall A3,
// `apps/web/src/legal/mega61-rechtsseiten.test.tsx:155-169`) gegen eine gestellte API, die auf
// `POST /auth/register` mit `403` und `REGISTRATION_DISABLED` antwortet — genau die Antwort, die
// `tests/security/vip2-gate.test.ts:65-67` am echten Server misst. Gemessen wird am DOM, nicht am
// Quelltext: ein Satz im Wörterbuch, den niemand rendert, hilft keiner Besucherin.
//
// DIE SECHS FÄLLE:
//   R1  Nach dem abgewiesenen Versuch steht die eigene Fläche da und nennt den Ausweg.
//   R2  Danach führt kein Klickpfad zurück in dasselbe leere Formular — die Auskunft bleibt.
//   R3  Die eingetippte E-Mail bleibt stehen, nur das Passwortpaar wird geleert.
//   R4  de/en/nl, jede Sprache mit eigenem Text — keine erbt eine andere.
//   R5  GEGENPROBE: ein ANDERER Fehler bekommt weiter den allgemeinen Kasten, nicht die neue
//       Fläche. Ohne diesen Fall dürfte die neue Fläche jeden Fehler vereinnahmen.
//   R6  GEGENPROBE: OHNE Fehlversuch bleibt „Registrieren" ein Knopf, der das Formular öffnet, und
//       der Absendeknopf ist bedienbar. Der Weg wird nicht vorsorglich zugemacht — die Maske
//       behauptet nichts über den Serverschalter, sie berichtet nur, was geantwortet wurde.
//   R7  Auch das STEHENGEBLIEBENE Formular schickt keinen zweiten Versuch mehr ab — weder per
//       Klick noch per Eingabetaste. Gemessen am Aufrufzähler des Servers, nicht an der Fläche.
//       (BENs Gegenprobe B1 aus Runde 2: R2 deckte nur den Rückweg über „Anmelden" ab.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die gestellte HTTP-Grenze. NUR `api/auth` wird ersetzt; `ApiError` (aus `api/client`), die Maske,
// der Sitzungskontext und i18n sind echt — `AuthScreens` prüft `e instanceof ApiError`, eine
// nachgebaute Fehlerklasse würde dort stillschweigend vorbeilaufen.
const server = vi.hoisted(() => ({
  registerFehler: null as null | { status: number; code: string; message: string },
  // Wie oft der Server einen Registrierversuch gesehen hat. Am DOM allein ist nicht zu erkennen,
  // ob ein zweiter Versuch hinausgegangen ist — die Maske sähe danach genauso aus. Dieser Zähler
  // ist deshalb die einzige Stelle, an der sich „der Weg ist zu" von „der Weg sieht zu aus"
  // unterscheiden lässt.
  registerAufrufe: 0,
}));

vi.mock("../../apps/web/src/api/auth", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const abgelehnt = (): Promise<never> =>
    Promise.reject(new ApiError(401, "UNAUTHORIZED", "keine Sitzung"));
  return {
    authApi: {
      status: () => Promise.resolve({ needsSetup: false, oidcEnabled: false }),
      me: abgelehnt,
      notice: abgelehnt,
      acknowledgeNotice: abgelehnt,
      logout: () => Promise.resolve(),
      login: () => Promise.resolve({}),
      setup: () => Promise.resolve({}),
      forgot: () => Promise.resolve(),
      register: () => {
        server.registerAufrufe += 1;
        const fehler = server.registerFehler;
        return fehler
          ? Promise.reject(new ApiError(fehler.status, fehler.code, fehler.message))
          : Promise.resolve({});
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
// Der Abfragespeicher dieser Montage wird festgehalten, damit `abbauen()` ihn leeren kann — warum
// das nötig ist, steht dort.
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
  // KEIN ZEITGEBER ÜBERLEBT DIESE DATEI. React Query legt für jede abgemeldete Abfrage einen
  // Aufräum-Zeitgeber an (`gcTime`, Vorgabe fünf Minuten); das `unmount()` des Baums darüber beendet
  // ihn NICHT. Sechs Fälle mit je einer Montage — R4 mountet sogar dreimal — hinterließen so ein
  // Dutzend laufender Zeitgeber, während Vitest die jsdom-Umgebung dieser Datei längst abgebaut hat.
  // Ein Zeitgeber, der nach dem Abbau in einen toten Baum greift, meldet sich als „unhandled error"
  // und färbt das Tor rot, ohne dass ein einziger Testfall rot wäre; der Fund landet dann bei der
  // NÄCHSTEN Datei. `clear()` verwirft die Abfragen und mit ihnen ihre Zeitgeber — diese Datei
  // hinterlässt nichts.
  klient?.clear();
  container = null;
  root = null;
  klient = null;
}

async function montieren(sprache: Sprache = "de"): Promise<void> {
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
        createElement(AuthProvider, null, createElement(AuthScreens, { needsSetup: false })),
      ),
    );
  });
  await act(durchlaufen);
}

beforeEach(() => {
  server.registerFehler = null;
  server.registerAufrufe = 0;
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

/**
 * Der ganze Weg einer neuen Person: „Noch kein Konto? Registrieren", vier Felder, abschicken.
 * Der Moduswechsel läuft über den SICHTBAREN Knopf — so, wie eine Nutzerin es täte.
 */
async function registrierversuch(sprache: Sprache = "de"): Promise<void> {
  await klick(knopfMit(wort(sprache, "auth.toRegister")));
  const eingaben = felder();
  await tippen(eingaben[0], "Neue Person");
  await tippen(mailfeld(), "neu@example.org");
  const pws = passwortfelder();
  await tippen(pws[0], "geheim12345");
  await tippen(pws[1], "geheim12345");
  const formular = baum().querySelector("form");
  expect(formular, "kein Formular gefunden").not.toBeNull();
  await act(async () => {
    formular?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await durchlaufen();
  });
}

const ABGESCHALTET = {
  status: 403,
  code: "REGISTRATION_DISABLED",
  // Wörtlich der Satz, den der echte Server liefert (vip2-gate.test.ts:67 prüft „Einladung").
  message: "Registrierung nur per Einladung.",
};

describe("JOB 4081 · die Anmeldemaske führt nicht mehr im Kreis", () => {
  it("R1 · der abgewiesene Versuch bekommt eine eigene Fläche, und sie nennt den Ausweg", async () => {
    server.registerFehler = ABGESCHALTET;
    await montieren();
    // Kalibrierung: die Maske ist wirklich da, sonst prüfte der Rest nichts.
    expect(flaechentext()).toContain(wort("de", "auth.title.login"));
    await registrierversuch();

    const flaeche = absage();
    expect(flaeche, "keine eigene Fläche für die abgewiesene Registrierung").not.toBeNull();
    const gesagt = (flaeche?.textContent ?? "").replace(/\s+/g, " ");
    expect(gesagt).toContain(wort("de", "auth.registrationClosed.fact"));
    expect(gesagt).toContain(wort("de", "auth.registrationClosed.next"));
    // Der Ausweg steht wirklich drin und ist kein Schlüsselname.
    expect(gesagt).toMatch(/Einladung/i);
    expect(gesagt).not.toContain("auth.registrationClosed");
    // Anwendersprache: kein interner Begriff steht auf der Fläche.
    expect(gesagt).not.toMatch(/REGISTRATION_DISABLED|fail-closed|Endpunkt|Schalter/i);
  });

  it("R2 · danach führt Anmelden → Registrieren NICHT zurück ins leere Formular", async () => {
    server.registerFehler = ABGESCHALTET;
    await montieren();
    await registrierversuch();
    expect(absage()).not.toBeNull();

    // Zurück zur Anmeldung — der einzige Weg, der aus dem Registrierformular herausführt.
    await klick(knopfMit(wort("de", "auth.toLogin")));
    expect(flaechentext()).toContain(wort("de", "auth.title.login"));

    // Der Knopf, der in dieselbe Absage führte, ist nicht mehr da; die Auskunft steht an seiner
    // Stelle. Genau hier war die Maske vorher im Anfangszustand.
    expect(
      knopfMit(wort("de", "auth.toRegister")),
      "der Weg in die Absage steht wieder offen",
    ).toBeUndefined();
    expect(absage(), "die Auskunft ist nach dem Moduswechsel verschwunden").not.toBeNull();
    expect(flaechentext()).toContain(wort("de", "auth.registrationClosed.next"));

    // Und „Passwort vergessen?" bleibt erreichbar — der Alltagsfall hat damit nichts zu tun.
    expect(knopfMit(wort("de", "auth.toForgot"))).toBeDefined();
  });

  it("R3 · die eingetippte E-Mail bleibt stehen, die Passwortfelder sind leer", async () => {
    server.registerFehler = ABGESCHALTET;
    await montieren();
    await registrierversuch();

    // Kein selbsttätiger Moduswechsel: wer im Formular stand, steht dort weiter.
    expect(flaechentext()).toContain(wort("de", "auth.title.register"));
    expect(mailfeld()?.value).toBe("neu@example.org");
    for (const pw of passwortfelder()) {
      expect(pw.value, "ein Passwort blieb nach der Absage stehen").toBe("");
    }
  });

  it("R4 · de/en/nl tragen je einen eigenen Text — keine Sprache erbt eine andere", async () => {
    for (const sprache of SPRACHEN) {
      server.registerFehler = ABGESCHALTET;
      await montieren(sprache);
      await registrierversuch(sprache);
      const gesagt = (absage()?.textContent ?? "").replace(/\s+/g, " ");
      expect(gesagt, `keine Fläche in ${sprache}`).not.toBe("");
      expect(gesagt, `${sprache} zeigt nicht den ${sprache}-Text`).toContain(
        wort(sprache, "auth.registrationClosed.fact"),
      );
      expect(gesagt).toContain(wort(sprache, "auth.registrationClosed.next"));
      if (sprache !== "de") {
        // Kein deutscher Rückfall auf der fremdsprachigen Fläche.
        expect(gesagt).not.toContain(wort("de", "auth.registrationClosed.fact"));
      }
    }

    for (const schluessel of ["auth.registrationClosed.fact", "auth.registrationClosed.next"]) {
      const werte = SPRACHEN.map((s) => wort(s, schluessel));
      for (const [i, w] of werte.entries()) {
        expect(w.length, `${schluessel} fehlt in ${SPRACHEN[i]}`).toBeGreaterThan(0);
      }
      expect(new Set(werte).size, `zwei Sprachen tragen denselben ${schluessel}`).toBe(
        SPRACHEN.length,
      );
    }
  });

  it("R5 · GEGENPROBE: ein anderer Fehler bekommt weiter den allgemeinen Kasten", async () => {
    server.registerFehler = {
      status: 409,
      code: "EMAIL_TAKEN",
      message: "Diese E-Mail ist bereits vergeben.",
    };
    await montieren();
    await registrierversuch();

    expect(absage(), "die neue Fläche vereinnahmt jeden Fehler").toBeNull();
    expect(flaechentext()).toContain("Diese E-Mail ist bereits vergeben.");
    expect(flaechentext()).not.toContain(wort("de", "auth.registrationClosed.fact"));

    // Und der Weg bleibt danach offen — abgewiesen wurde ja nicht der Weg, sondern diese E-Mail.
    await klick(knopfMit(wort("de", "auth.toLogin")));
    expect(knopfMit(wort("de", "auth.toRegister"))).toBeDefined();
  });

  // ================================================================================================
  // R7 — DIE LÜCKE, DIE BEN IN RUNDE 2 GEFUNDEN HAT (Gegenprobe B1).
  // ================================================================================================
  // R2 prüfte nur den Rückweg über „Schon ein Konto? Anmelden". Der kürzere Weg blieb offen: WER IM
  // FORMULAR STEHEN BLEIBT (das sagt R3 ausdrücklich zu), hatte dort weiter einen Absendeknopf, der
  // `authApi.register` ein zweites Mal rief — in dieselbe Absage. Gemessen wird deshalb nicht die
  // Fläche, sondern der Zähler am Server: nach dem ersten Versuch bleibt er bei EINS, über beide
  // Wege, mit denen ein Formular abgeschickt werden kann.
  it("R7 · das stehengebliebene Formular löst keinen zweiten Versuch mehr aus (Klick und Eingabetaste)", async () => {
    server.registerFehler = ABGESCHALTET;
    await montieren();
    await registrierversuch();

    // Kalibrierung: der ERSTE Versuch ist wirklich hinausgegangen. Ohne diese Zeile wäre „bleibt
    // bei eins" auch dann grün, wenn die Maske überhaupt nichts mehr abschickte.
    expect(server.registerAufrufe, "der erste Versuch kam gar nicht am Server an").toBe(1);
    expect(absage()).not.toBeNull();
    expect(flaechentext()).toContain(wort("de", "auth.title.register"));

    // Die Person füllt das Passwortpaar erneut aus — das Formular ist wieder vollständig und
    // gültig. Genau hier ging der zweite Versuch bisher hinaus.
    const pws = passwortfelder();
    await tippen(pws[0], "geheim12345");
    await tippen(pws[1], "geheim12345");

    // Weg 1: der sichtbare Absendeknopf. Gemessen wird zuerst die WIRKUNG — ob ein zweiter Versuch
    // hinausgeht —, nicht das Aussehen des Knopfes. Genau diese Zeile war BENs Befund B1.
    const absenden = absendeknopf();
    expect(absenden, "kein Absendeknopf im Formular").not.toBeNull();
    await act(async () => {
      absenden?.click();
      await durchlaufen();
    });
    expect(server.registerAufrufe, "der Klick hat einen zweiten Versuch abgeschickt").toBe(1);

    // Weg 2: die Eingabetaste im Feld. Sie gibt das Formular ab, ohne den Knopf zu berühren — ein
    // gesperrter Knopf allein genügt also nicht, die Sperre muss im Absenden selbst sitzen.
    const formular = baum().querySelector("form");
    expect(formular, "kein Formular gefunden").not.toBeNull();
    await act(async () => {
      formular?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await durchlaufen();
    });
    expect(server.registerAufrufe, "die Eingabetaste hat einen zweiten Versuch abgeschickt").toBe(
      1,
    );

    // Erst jetzt das Aussehen: ein Knopf, der nachweislich nichts mehr auslöst, darf nicht
    // bedienbar aussehen. Sonst drückt die Person ihn weiter und hält das Ausbleiben jeder
    // Reaktion für einen Fehler der Maske.
    expect(
      absendeknopf()?.disabled,
      "der Knopf löst nichts mehr aus, sieht aber weiter bedienbar aus",
    ).toBe(true);

    // Und es wird nichts weggeräumt: Modus, E-Mail und Auskunft stehen weiter da.
    expect(flaechentext()).toContain(wort("de", "auth.title.register"));
    expect(mailfeld()?.value).toBe("neu@example.org");
    expect(absage()).not.toBeNull();
  });

  it("R6 · GEGENPROBE: ohne Fehlversuch öffnet der Registrierweg ganz normal das Formular", async () => {
    await montieren();
    expect(absage(), "die Absage steht da, ohne dass etwas abgewiesen wurde").toBeNull();

    const knopf = knopfMit(wort("de", "auth.toRegister"));
    expect(knopf, "der Registrierweg wurde vorsorglich zugemacht").toBeDefined();
    await klick(knopf);
    expect(flaechentext()).toContain(wort("de", "auth.title.register"));
    expect(passwortfelder().length, "kein Passwortpaar — das Formular ging nicht auf").toBe(2);
    expect(absage()).toBeNull();
    // Und der Absendeknopf ist bedienbar. Diese Zeile hält die Sperre aus R7 an ihren Anlass
    // gebunden: wer sie ohne gemessene Absage setzt, macht diesen Fall rot.
    expect(absendeknopf()?.disabled, "der Absendeknopf ist vorsorglich gesperrt").toBe(false);
  });
});
