// @vitest-environment jsdom
// ================================================================================================
// JOB 4021 · ERSTEINRICHTUNG-GAST, TEIL 2 — DER WEG ZUM MENSCHEN.
// ================================================================================================
//
// DER BEFUND, am main `b0315de` (1.0.0-beta.1.503) selbst aufgeschlagen: Der Server kann die
// Befristung eines Zugangs seit JOB 3665/3755 vollständig — er nimmt sie an
// (`services/auth/src/routes.ts:764-769`, Formwache `:813-819`, Schreibweg `:836-842`), er gibt sie
// mit jeder Nutzerantwort heraus (`services/auth/src/types.ts:51`, `PublicUser` `:60`,
// `GET /api/users` `routes.ts:623-629`), und `null` ist der ausdrücklich vorgesehene Weg, sie
// wieder zu NEHMEN (`routes.ts:839`). Die Oberfläche kannte das Feld an KEINER Stelle:
// `apps/web/src/api/types.ts` warf es typseitig weg, `apps/web/src/api/endpoints.ts` hatte keinen
// Aufruf, der es hätte senden können (`setRole` schickt `put<void>` mit `{ role }`), und in
// `apps/web/src/pages/AdminKontenDetails.tsx` kam `accessExpiresAt` nicht vor.
//
// Ein Gast, dessen Zugang morgen abläuft, sah für den Admin also aus wie ein unbefristetes Konto —
// bis die Anmeldung ihn aussperrte (`tests/demo-zugang-gaeste/ablauf-sperrt-anmeldung.test.ts`).
//
// ------------------------------------------------------------------------------------------------
// WIE HIER GEMESSEN WIRD — an der echten Kette, nicht an einem Nachbau
// ------------------------------------------------------------------------------------------------
// Gemountet wird die ECHTE Karte (`NutzerDetail`) an einem ECHTEN QueryClient, mit dem ECHTEN
// Toast-Bus samt seinem ECHTEN Sichtfenster (`shell/ToastViewport.tsx`) — gelesen wird
// ausschliesslich am DOM. Gefälscht ist genau EINE Stelle: `fetch`. Damit laufen `endpoints` und
// `api/client.ts` unverändert mit, und die Prüfungen sehen METHODE, PFAD und RUMPF so, wie sie beim
// Server ankämen. Ein Mock auf `endpoints` hätte genau die Hälfte weggenommen, um die es geht: den
// Unterschied zwischen `null` (Befristung nehmen) und einem fehlenden Feld (nichts sagen) — der
// entsteht erst in `JSON.stringify`.
//
// Der gefälschte Server bildet `routes.ts:836-842` nach und NUR das: String ⇒ setzen, `null` ⇒
// entfernen, Feld fehlt ⇒ unverändert. Antwort ist 200 mit dem vollen Konto.
//
// F1 Anzeige · F2 unbefristet · F3 setzen · F4 beenden · F5 abgelaufen · F6 DE/EN/NL ·
// F7 Fehlervertrag · F8 unlesbarer Bestand.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — DIE DREI GEGENBEISPIELE, DIE BEN AN DER RUNDE 1 GEMESSEN HAT
// ------------------------------------------------------------------------------------------------
// Die Karte war im Normalfall richtig und behauptete in drei Fällen einen falschen Zugangsstand.
// Jeder davon bekommt hier einen Fall, der ihn DAUERHAFT misst:
//
//   F9  Antwortverlust ... Der Server SCHRIEB, und die Antwort ging auf dem Rückweg verloren.
//                          Runde 1 sagte danach „Nichts wurde geändert." — eine Tatsachenaussage
//                          über fremde Daten, die der Client nie belegt hat. Eine fehlende
//                          Bestätigung beweist keine unveränderten Daten.
//   F10 Kalenderüberlauf .. `"2026-02-30T12:00:00.000Z"` ist für `Date.parse` KEIN NaN: es rechnet
//                          still auf den 2. März um. Runde 1 zeigte „Abgelaufen am 2.3.2026" für
//                          einen Wert, den der Server ausdrücklich als unlesbar verwirft
//                          (`services/auth/src/service.ts:52-67`) — die Karte behauptete damit eine
//                          Sperre, die es nicht gibt.
//   F11 Zeitübergang ...... Der Ablaufzeitpunkt verstrich bei OFFENER Karte; sie zeigte weiter
//                          „Gültig bis …", weil `Date.now()` nur beim Rendern gelesen wird.
//
// F12 fährt setzen UND beenden vollständig in EN und NL — in Runde 1 liefen beide Wege nur auf
// Deutsch, und ein fehlender Schlüssel wäre erst beim Nutzer aufgefallen.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 3 — DIE UHR, GEGEN DIE GEMESSEN WIRD (BEN R2, Korrekturpflicht 1)
// ------------------------------------------------------------------------------------------------
// Runde 2 hat den Zeitübergang mit einem Wecker geschlossen (F11) — und dabei die Uhrzeit des
// KARTENAUFSCHLAGS als Bezugspunkt eingefroren. Solange der Ablaufwert von Anfang an dastand, fiel
// das nicht auf. Trifft er SPÄTER ein (Auffrischung, Nachladen, zweite Antwort), wird er gegen eine
// Uhrzeit gemessen, die nicht mehr gilt:
//
//   F13a … ein Wert, der bei seinem Eintreffen bereits abgelaufen ist, liegt trotzdem NACH der
//          eingefrorenen Uhrzeit — die Karte nannte ihn „Gültig bis …".
//   F13b … die Restfrist wurde als `Ablauf − Uhrzeit des Aufschlags` gerechnet statt gegen die
//          laufende Uhr; der Übergang verspätete sich um die bisherige Verweildauer.
//
// Beide werden am DOM gemessen, an derselben echten Karte wie alles andere hier.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { PublicUser } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Admin } from "../../apps/web/src/pages/Admin";
import { NutzerAnlegenDetail, NutzerDetail } from "../../apps/web/src/pages/AdminKontenDetails";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Sprache = "de" | "en" | "nl";
const SPRACHEN: Sprache[] = ["de", "en", "nl"];

/**
 * Die Formwache des Servers, WÖRTLICH aus `services/auth/src/service.ts:47-48` übernommen.
 *
 * Sie steht hier, damit die Prüfung den VERTRAG misst und nicht die Rechnung der Oberfläche: was
 * die Karte sendet, muss diese Form haben, sonst weist `setAccessExpiry` es mit 403 ab
 * (`service.ts:426-428`). Eine Kopie des erwarteten Zeichenkettenwertes hätte dagegen nur
 * nachgeschrieben, was die Oberfläche ohnehin tut.
 */
const ISO_ZEITSTEMPEL =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const GAST: PublicUser = {
  id: "u-gast",
  name: "Gerda Gast",
  email: "gerda@job4021.test",
  role: "experte",
  approved: true,
  createdAt: "2026-09-01T08:00:00.000Z",
};

/**
 * Der Satz, mit dem der Server ein unlesbares Ablaufdatum beantwortet — wörtlich aus
 * `services/auth/src/meldungen.ts` (`ACCESS_EXPIRY_UNREADABLE`, DE).
 *
 * Er steht hier als FIXTURE, nicht als Sollwert: geprüft wird, dass GENAU DIESER Satz auf der
 * Fläche ankommt, also der des Servers und nicht ein eigener erfundener. Formuliert der Katalog
 * eines Tages um, bleibt die Aussage dieses Falls dieselbe — nur die Fixture ist dann ein anderer
 * echter Serversatz. Absichtlich die deutsche Fassung: der Herkunftswächter
 * (`tests/q9-serverfehlertexte/katalogschluessel-herkunft.test.ts`, H4) zählt EN/NL-Sätze als
 * Routendeckung, und diese Datei fährt keine Route.
 */
const ABLAUF_UNLESBAR =
  "Ablaufdatum nicht lesbar. Bitte einen vollständigen Zeitpunkt mit Datum, Uhrzeit und Zeitzone angeben, zum Beispiel 2026-12-31T23:59:00Z.";

/** Die Stammdaten, die A1–A5 in das Anlegeformular tippen. */
const NEU_NAME = "Interessent";
const NEU_EMAIL = "interessent@job4103.test";
const NEU_PASSWORT = "Gastzugang2026";

interface Aufruf {
  methode: string;
  pfad: string;
  /** Der Rumpf als ROHE Zeichenkette — nur so ist „`null` steht wirklich drin" messbar. */
  roh: string | undefined;
  rumpf: Record<string, unknown> | undefined;
}

let aufrufe: Aufruf[] = [];
/** Der Bestand des gefälschten Servers — er trägt den Stand, den `GET /api/users` herausgibt. */
let bestand: PublicUser;
/** Ab hier beantwortet der Server die LISTE nicht mehr: die Auffrischung bleibt offen. */
let listeHaengt = false;
/** Ab hier SCHEITERT die Liste: die Auffrischung bekommt eine Fehlerantwort. */
let listeFehler = false;
/** Wenn gesetzt, beantwortet der Server jedes PUT mit diesem Fehler statt zu schreiben. */
let putFehler: { status: number; error: string; message: string } | null = null;
/**
 * Der Server SCHREIBT das PUT — und die Antwort geht auf dem Rückweg verloren.
 *
 * Genau so sieht ein abgebrochenes Netz aus: `fetch` lehnt mit einem `TypeError` ab, NICHT mit
 * einem `ApiError`. Der Unterschied ist die ganze Aussage dieses Falls — eine Statusantwort belegt
 * eine Ablehnung des Servers, eine ausgebliebene Antwort belegt gar nichts.
 */
let putAntwortVerloren = false;

// ------------------------------------------------------------------------------------------------
// JOB 4103 · DER ANLAGEWEG DESSELBEN SERVERS (`POST /api/users`, `routes.ts`)
// ------------------------------------------------------------------------------------------------
/** Was dieser gefälschte Server bisher angelegt hat — der Bestand, an dem „kein Konto" messbar ist. */
let angelegt: PublicUser[] = [];
/** Wenn gesetzt, beantwortet der Server jedes POST mit diesem Fehler statt anzulegen. */
let postFehler: { status: number; error: string; message: string } | null = null;
/** Der Server LEGT AN — und die Antwort geht auf dem Rückweg verloren (wie `putAntwortVerloren`). */
let postAntwortVerloren = false;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
/** Der QueryClient der gemounteten Karte — nur so lässt sich eine SPÄTERE Antwort einspielen (F13). */
let qcDerKarte: QueryClient;

function antwort(status: number, koerper: unknown): unknown {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: String(status),
    text: async () => JSON.stringify(koerper),
  };
}

/** Der gefälschte Server: `GET /api/users` und `PUT /api/users/:id` nach `routes.ts:836-842`. */
async function serverFetch(eingabe: unknown, init?: RequestInit): Promise<unknown> {
  const pfad = String(eingabe);
  const methode = init?.method ?? "GET";
  const roh = init?.body === undefined ? undefined : String(init.body);
  const rumpf = roh === undefined ? undefined : (JSON.parse(roh) as Record<string, unknown>);
  aufrufe.push({ methode, pfad, roh, rumpf });

  if (methode === "GET" && pfad === "/api/users") {
    if (listeHaengt) {
      return new Promise(() => undefined);
    }
    if (listeFehler) {
      return antwort(503, { error: "UPSTREAM", message: "Liste nicht abrufbar." });
    }
    // JOB 4103 R2: die Liste gibt AUCH die neu angelegten Konten heraus. In Runde 1 lieferte sie
    // nur `[bestand]` — damit war der Rundweg „Formular → Liste" gar nicht messbar, und die
    // Rückgabe behauptete eine Sichtbarkeit, die niemand geprüft hatte (BEN R1). Ein Testserver,
    // der vergisst, was er gerade angelegt hat, ist kein Server, sondern ein Echo.
    return antwort(200, [bestand, ...angelegt]);
  }
  // JOB 4103 · DER ANLAGEWEG, nachgebildet nach `routes.ts` und NUR das: die Wachen stehen VOR
  // `register` (Form, dann Lesbarkeit), ein unlesbarer Wert lässt also GAR NICHTS entstehen; `null`
  // und ein fehlendes Feld heissen beide „unbefristet"; die Antwort ist 201 mit dem vollen Konto.
  if (methode === "POST" && pfad === "/api/users") {
    if (postFehler) {
      return antwort(postFehler.status, { error: postFehler.error, message: postFehler.message });
    }
    const b = rumpf ?? {};
    const ablauf = b.accessExpiresAt;
    if (typeof ablauf === "string" && !ISO_ZEITSTEMPEL.test(ablauf)) {
      return antwort(403, { error: "FORBIDDEN", message: ABLAUF_UNLESBAR });
    }
    const neu: PublicUser = {
      id: `u-neu-${angelegt.length + 1}`,
      name: String(b.name),
      email: String(b.email),
      role: (b.role as PublicUser["role"]) ?? "experte",
      approved: true,
      createdAt: new Date().toISOString(),
      ...(typeof ablauf === "string" ? { accessExpiresAt: ablauf } : {}),
    };
    angelegt.push(neu);
    // NACH dem Anlegen, und die Reihenfolge IST der Fall (wie bei `putAntwortVerloren`): das Konto
    // steht, nur der Weg zurück ist zu. Alles, was die Karte jetzt darüber sagt, ist ungedeckt.
    if (postAntwortVerloren) {
      throw new TypeError("Failed to fetch");
    }
    return antwort(201, neu);
  }
  if (methode === "PUT" && pfad === `/api/users/${bestand.id}`) {
    if (putFehler) {
      return antwort(putFehler.status, { error: putFehler.error, message: putFehler.message });
    }
    // GENAU die Unterscheidung aus `routes.ts:836-842`: Feld fehlt ⇒ nichts sagen; `null` ⇒ nehmen;
    // Zeichenkette ⇒ setzen. Sie ist der Grund, warum diese Prüfung den ROHEN Rumpf liest.
    if (rumpf && "accessExpiresAt" in rumpf) {
      const wert = rumpf.accessExpiresAt;
      if (wert === null) {
        const { accessExpiresAt: _weg, ...ohne } = bestand;
        bestand = ohne;
      } else {
        bestand = { ...bestand, accessExpiresAt: String(wert) };
      }
    }
    // NACH dem Schreiben, und die Reihenfolge IST der Fall: der Bestand trägt den neuen Wert, nur
    // der Weg zurück ist zu. Alles, was die Karte jetzt über die Daten sagt, ist ungedeckt.
    if (putAntwortVerloren) {
      throw new TypeError("Failed to fetch");
    }
    return antwort(200, bestand);
  }
  // ------------------------------------------------------------------------------------------------
  // JOB 4103 R2 · WAS DIE GANZE VERWALTUNGSSEITE SONST NOCH ABRUFT (nur für die L-Fälle nötig)
  // ------------------------------------------------------------------------------------------------
  // Die L-Fälle mounten die ECHTE Seite `pages/Admin.tsx`, und die fragt beim Aufbau ein Dutzend
  // weiterer Auskünfte ab (Prüfstand, Analyse, Reasoner, Demodaten, Sicherungen …). Zwei davon
  // entscheiden, ob überhaupt eine Verwaltung erscheint — die Sitzung. Sie werden deshalb WIRKLICH
  // beantwortet.
  if (methode === "GET" && pfad === "/api/auth/status") {
    return antwort(200, { needsSetup: false, oidcEnabled: false });
  }
  if (methode === "GET" && pfad === "/api/auth/me") {
    return antwort(200, {
      id: "u-admin",
      name: "Pia Admin",
      email: "pia@job4103.test",
      role: "admin",
    });
  }
  // ALLES ANDERE bekommt eine ehrliche FEHLERANTWORT und keine erfundenen Daten. Die Zeilen jener
  // Themen zeigen dann „nicht abrufbar" — genau den Zustand, für den sie gebaut sind
  // (`components/einstellungen/zeilenWert.ts`). Ein erfundener Erfolg wäre hier schlimmer als ein
  // Fehler: er machte Aussagen über Flächen, die diese Datei gar nicht misst.
  if (methode === "GET") {
    return antwort(503, { error: "UPSTREAM", message: `nicht Gegenstand dieser Prüfung: ${pfad}` });
  }
  // Schreibwege bleiben streng: ein POST/PUT/DELETE, den niemand erwartet hat, ist ein Befund und
  // darf nicht in einer freundlichen Fehlerantwort verschwinden.
  throw new Error(`unerwarteter Aufruf: ${methode} ${pfad}`);
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function ruhe(runden = 6): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await flush();
  }
}

/**
 * Echte Zeit verstreichen lassen — mit ECHTEN Uhren, nicht mit gestellten.
 *
 * F11 misst, was die Karte von SICH AUS tut, wenn der Ablaufzeitpunkt vorbeigeht. Gestellte
 * Zeitgeber (`vi.useFakeTimers`) würden dabei genau die Frage wegnehmen: sie verschieben `Date.now`
 * und feuern Wecker auf Kommando, und ein Bauteil, das gar keinen Wecker stellt, sähe darunter
 * genauso aus wie eines, das einen stellt. Der Preis ist knapp eine Sekunde Laufzeit in EINEM Fall.
 */
async function warte(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
  await ruhe();
}

/**
 * Welche Karte gerade steht — `karte()` und alles, was daran hängt, lesen sie hier ab.
 *
 * JOB 4103: die Anlagekarte trägt eine EIGENE Kennung (`detail-nutzer-neu`). Ohne diese Variable
 * fänden `knopf`, `kartenText` und `meldungen` in den neuen Fällen still gar nichts und jede
 * Aussage darüber wäre leer statt rot.
 */
let kartenId = "detail-nutzer";

/** Die geöffnete Kontokarte dieses Nutzers, in dieser Sprache. */
async function mitKarte(nutzer: PublicUser, sprache: Sprache): Promise<void> {
  await i18n.changeLanguage(sprache);
  kartenId = "detail-nutzer";
  bestand = nutzer;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qcDerKarte = qc;
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(NutzerDetail, { nutzerId: nutzer.id, onZurueck: () => undefined }),
          createElement(ToastViewport),
        ),
      ),
    );
  });
  for (let i = 0; i < 10 && container.querySelector("select") === null; i += 1) {
    await flush();
  }
  // Kalibrierung: ohne sie liesse sich jede Aussage über die Karte auch dann treffen, wenn nie
  // etwas gerendert wurde.
  expect(kartenText(), "die Karte trägt den Nutzer nicht").toContain(nutzer.email);
}

/** Die Anlagekarte, in dieser Sprache — dieselbe Bühne wie `mitKarte`, nur ein anderes Bauteil. */
async function mitAnlegekarte(sprache: Sprache): Promise<void> {
  await i18n.changeLanguage(sprache);
  kartenId = "detail-nutzer-neu";
  // Ein Bestand, falls die Karte die Liste doch abruft — dann fällt es hier nicht als Fehler,
  // sondern in den Aufrufen auf, wo die Fälle ihn zählen.
  bestand = { ...GAST };
  angelegt = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qcDerKarte = qc;
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(NutzerAnlegenDetail, { onZurueck: () => undefined }),
          createElement(ToastViewport),
        ),
      ),
    );
  });
  for (let i = 0; i < 10 && container.querySelector("select") === null; i += 1) {
    await flush();
  }
  // Kalibrierung, wie bei `mitKarte`: ohne sie liesse sich jede Aussage auch an einer leeren
  // Bühne treffen.
  expect(kartenText(), "die Anlagekarte trägt ihr Formular nicht").toContain(
    i18n.getFixedT(sprache)("adm.createTitle"),
  );
}

/**
 * JOB 4103 R2 · DIE GANZE VERWALTUNGSSEITE — Liste UND Anlegeweg an EINER Bühne.
 *
 * Die L-Fälle messen den RUNDWEG: Formular ausfüllen, einmal anlegen, Liste auffrischen lassen, und
 * dann am neuen Listeneintrag das Datum lesen — ohne eine Detailkarte zu öffnen. Das geht nur an
 * der echten Seite `pages/Admin.tsx`, denn sie ist es, die die Zeilen zeichnet. Gemountet wird sie
 * mit derselben Umgebung, die sie in der Anwendung hat (Router, Sitzung, Rolle, Navigationswächter);
 * gefälscht ist weiterhin genau EINE Stelle, `fetch`.
 */
async function mitVerwaltung(sprache: Sprache, nutzer: PublicUser = { ...GAST }): Promise<void> {
  await i18n.changeLanguage(sprache);
  kartenId = "detail-nutzer-neu";
  bestand = nutzer;
  angelegt = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qcDerKarte = qc;
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
                { initialEntries: ["/admin?bereich=konten"] },
                createElement(NavGuardProvider, null, createElement(Admin)),
              ),
              createElement(ToastViewport),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe(12);
  // Kalibrierung: ohne sie liesse sich jede Aussage über die Liste auch an einer leeren Bühne
  // treffen. Der Bestandsnutzer MUSS als Zeile dastehen, sonst misst kein L-Fall etwas.
  expect(zeilenWert(nutzer.name), "die Kontenliste trägt den Bestandsnutzer nicht").not.toBe(null);
}

/** Die Kontenliste der Verwaltungsseite (`Admin.tsx`, `testId="flaeche-nutzer"`). */
function liste(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="flaeche-nutzer"]');
  if (el === null) {
    throw new Error(
      `die Kontenliste fehlt; sichtbar: ${(container.textContent ?? "").slice(0, 400)}`,
    );
  }
  return el;
}

/**
 * Der gerenderte WERT der Zeile dieses Nutzers — oder `null`, wenn es keine solche Zeile gibt.
 *
 * Gelesen wird an der Bedeutung der Zeile (`data-einst="label"` / `data-einst="wert"`,
 * `components/einstellungen/Zeilenkarte.tsx`), nicht am Gesamttext der Seite: sonst genügte es,
 * dass das Datum IRGENDWO steht — etwa in einer geöffneten Detailkarte —, und genau diese
 * Verwechslung war der Befund von Runde 1.
 */
function zeilenWert(name: string): string | null {
  const zeile = [...liste().querySelectorAll('[data-einst="zeile"]')].find(
    (z) => (z.querySelector('[data-einst="label"]')?.textContent ?? "") === name,
  );
  if (zeile === undefined) {
    return null;
  }
  return zeile.querySelector('[data-einst="wert"]')?.textContent ?? "";
}

/** Ein Knopf IRGENDWO auf der Verwaltungsseite (die L-Fälle stehen nicht in einer Karte). */
function seitenKnopf(teil: string): HTMLButtonElement {
  const treffer = [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").includes(teil),
  );
  if (treffer.length !== 1) {
    throw new Error(
      `Knopf „${teil}" ${treffer.length}× auf der Seite; sichtbar: ${(container.textContent ?? "").slice(0, 400)}`,
    );
  }
  return treffer[0] as HTMLButtonElement;
}

function karte(): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-testid="${kartenId}"]`);
  if (el === null) {
    throw new Error(`die Karte „${kartenId}" fehlt`);
  }
  return el;
}

function kartenText(): string {
  return karte().textContent ?? "";
}

/** Die Meldungen im Sichtfenster — alles ausserhalb der Karte, also die echten Toasts. */
function meldungen(): string[] {
  return [...container.querySelectorAll("output")]
    .filter((o) => !karte().contains(o))
    .map((o) => o.textContent ?? "");
}

function knopf(teil: string): HTMLButtonElement {
  const treffer = [...karte().querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").includes(teil),
  );
  if (treffer.length !== 1) {
    throw new Error(
      `Knopf „${teil}" ${treffer.length}× gefunden; sichtbar: ${kartenText().slice(0, 400)}`,
    );
  }
  return treffer[0] as HTMLButtonElement;
}

function datumsfeld(): HTMLInputElement | null {
  return karte().querySelector<HTMLInputElement>('input[type="date"]');
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
  });
  await ruhe();
}

async function tippe(feld: HTMLInputElement, wert: string): Promise<void> {
  // React verfolgt den Wert über einen internen Tracker; der native Prototyp-Setter umgeht ihn.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

async function tippeDatum(tag: string): Promise<void> {
  const feld = datumsfeld();
  if (feld === null) {
    throw new Error("das Datumsfeld ist nicht offen");
  }
  await tippe(feld, tag);
}

/**
 * Das Eingabefeld unter DIESER Beschriftung — gesucht an der Bedeutung, nicht an einer Reihenfolge.
 *
 * `Field` (`apps/web/src/components/ui.tsx`) rendert `<label><span>Beschriftung</span>…</label>`;
 * eine Suche über den Index würde still auf ein anderes Feld zeigen, sobald das Formular umgestellt
 * wird, und der Fall bliebe grün.
 */
function eingabe(beschriftung: string): HTMLInputElement {
  const treffer = [...karte().querySelectorAll("label")].filter(
    (l) => (l.querySelector("span")?.textContent ?? "") === beschriftung,
  );
  if (treffer.length !== 1) {
    throw new Error(
      `Feld „${beschriftung}" ${treffer.length}× gefunden; sichtbar: ${kartenText().slice(0, 400)}`,
    );
  }
  const feld = treffer[0]?.querySelector("input");
  if (!feld) {
    throw new Error(`Feld „${beschriftung}" trägt keine Eingabe`);
  }
  return feld;
}

/** Name, E-Mail und beide Passwortfelder — alles, was `newUserIssues` verlangt, und nichts sonst. */
async function fuelleStammdaten(sprache: Sprache = "de"): Promise<void> {
  const t = i18n.getFixedT(sprache);
  await tippe(eingabe(t("adm.name")), NEU_NAME);
  await tippe(eingabe(t("adm.email")), NEU_EMAIL);
  await tippe(eingabe(t("adm.password")), NEU_PASSWORT);
  await tippe(eingabe(t("adm.newPasswordRepeat")), NEU_PASSWORT);
}

/**
 * Der Server gibt ab jetzt diesen Stand heraus — und die offene Karte holt ihn (F13).
 *
 * Das ist der Weg, auf dem ein Ablaufwert SPÄTER eintrifft: keine Mutation, kein Zutun des Admins,
 * nur eine Auffrischung, die etwas Neues mitbringt. Genau dieser Weg war in Runde 2 ungemessen —
 * dort stand der Wert immer schon beim Aufbau da.
 */
async function neuerBestand(nutzer: PublicUser): Promise<void> {
  bestand = nutzer;
  await act(async () => {
    await qcDerKarte.invalidateQueries({ queryKey: ["users"] });
  });
  await ruhe();
}

function puts(): Aufruf[] {
  return aufrufe.filter((a) => a.methode === "PUT");
}

function posts(): Aufruf[] {
  return aufrufe.filter((a) => a.methode === "POST");
}

/** Der lokale Kalendertag eines Zeitpunkts in der Form des Datumsfeldes (`YYYY-MM-DD`). */
function lokalerTag(d: Date): string {
  const zwei = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

/** Das Datum, wie die Oberfläche es in DIESER Sprache schreibt. */
function datumstext(iso: string, sprache: Sprache): string {
  return new Date(iso).toLocaleDateString(sprache);
}

/** Ein Zeitpunkt in der Zukunft bzw. Vergangenheit, als Ende des jeweiligen lokalen Tages. */
function tagEnde(versatzTage: number): { iso: string; tag: string } {
  const d = new Date();
  d.setDate(d.getDate() + versatzTage);
  d.setHours(23, 59, 59, 999);
  return { iso: d.toISOString(), tag: lokalerTag(d) };
}

const ZUKUNFT = tagEnde(30);
const VERGANGENHEIT = tagEnde(-5);

beforeEach(() => {
  aufrufe = [];
  listeHaengt = false;
  listeFehler = false;
  putFehler = null;
  putAntwortVerloren = false;
  angelegt = [];
  postFehler = null;
  postAntwortVerloren = false;
  vi.stubGlobal("fetch", vi.fn(serverFetch));
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("de");
});

// ================================================================================================
// F1 · DIE KARTE ZEIGT DEN STAND
// ================================================================================================
describe.each(SPRACHEN)("JOB 4021 · F1 (%s): die Karte nennt die Befristung", (sprache) => {
  it("ein Zugang mit Ablauf in der Zukunft zeigt sein Datum", async () => {
    await mitKarte({ ...GAST, accessExpiresAt: ZUKUNFT.iso }, sprache);
    const t = i18n.getFixedT(sprache);

    expect(kartenText(), "die Überschrift der Befristung fehlt").toContain(
      t("adm.gastfrist.titel"),
    );
    expect(kartenText(), "das Ablaufdatum steht nicht auf der Karte").toContain(
      t("adm.gastfrist.gueltigBis", { datum: datumstext(ZUKUNFT.iso, sprache) }),
    );
    expect(kartenText(), "ein befristeter Zugang wird als unbefristet ausgegeben").not.toContain(
      t("adm.gastfrist.unbefristet"),
    );
  });
});

// ================================================================================================
// F2 · UNBEFRISTET IST EINE AUSSAGE, KEIN LEERES FELD
// ================================================================================================
describe.each(SPRACHEN)("JOB 4021 · F2 (%s): ohne Ablauf steht unbefristet", (sprache) => {
  it("sagt unbefristet und zeigt weder Datum noch leeres Datumsfeld", async () => {
    await mitKarte({ ...GAST }, sprache);
    const t = i18n.getFixedT(sprache);

    expect(kartenText()).toContain(t("adm.gastfrist.unbefristet"));
    // Kein leeres Feld als Ersatz für die Aussage (Lieferpunkt 5, Auftrag §9).
    expect(datumsfeld(), "das Datumsfeld steht ungefragt offen").toBe(null);
    // Und kein „Befristung beenden" an einem Konto, das keine hat.
    expect(kartenText()).not.toContain(t("adm.gastfrist.beenden"));
    expect(kartenText()).toContain(t("adm.gastfrist.setzen"));
  });
});

// ================================================================================================
// F3 · SETZEN — EIN PUT, EIN VERTRAGSTREUER RUMPF, UND DANACH DER NEUE STAND
// ================================================================================================
describe("JOB 4021 · F3: der Admin setzt eine Befristung", () => {
  it("sendet genau EIN PUT mit dem gewählten Tag als lesbarem ISO-Zeitpunkt", async () => {
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");

    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    // Die Auffrischung nach der Mutation bleibt ab hier OFFEN. Damit kann der neue Stand nur aus der
    // ANTWORT des PUT kommen (Lieferpunkt 2) — nicht aus einem nachgeholten Listenabruf.
    listeHaengt = true;
    await klick(knopf(t("adm.gastfrist.speichern")));

    expect(puts(), `PUT-Aufrufe: ${JSON.stringify(puts())}`).toHaveLength(1);
    const gesendet = puts()[0];
    expect(gesendet?.pfad).toBe(`/api/users/${GAST.id}`);
    const wert = gesendet?.rumpf?.accessExpiresAt;
    expect(typeof wert, "der Rumpf trägt keine Zeichenkette").toBe("string");
    expect(String(wert), "der Server weist diese Form mit 403 ab").toMatch(ISO_ZEITSTEMPEL);
    // Der gesendete Zeitpunkt ist das ENDE des gewählten Tages: „gültig bis 31.10." heisst, dass
    // der 31.10. noch dazugehört. Gemessen an der Grenze, nicht an einer abgeschriebenen Zahl.
    const zeitpunkt = new Date(String(wert));
    expect(lokalerTag(zeitpunkt), "der gesendete Zeitpunkt liegt auf einem anderen Tag").toBe(
      ZUKUNFT.tag,
    );
    expect(
      lokalerTag(new Date(zeitpunkt.getTime() + 1)),
      "der gesendete Zeitpunkt ist nicht der letzte Augenblick des Tages",
    ).not.toBe(ZUKUNFT.tag);
  });

  it("zeigt danach den neuen Stand — aus der Antwort, nicht aus dem alten Bestand", async () => {
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");

    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    listeHaengt = true;
    await klick(knopf(t("adm.gastfrist.speichern")));

    const gesendet = String(puts()[0]?.rumpf?.accessExpiresAt);
    expect(kartenText(), "die Karte zeigt weiter den Stand von vorher").toContain(
      t("adm.gastfrist.gueltigBis", { datum: datumstext(gesendet, "de") }),
    );
    expect(kartenText()).not.toContain(t("adm.gastfrist.unbefristet"));
    // Speicherbestätigung: der Admin erfährt, dass geschrieben wurde (Codex-Auflage 14.09.).
    expect(meldungen().join(" · ")).toContain(t("adm.gastfrist.gespeichert"));
    // Und das Eingabefeld ist wieder zu — die Karte behauptet keine offene Eingabe.
    expect(datumsfeld()).toBe(null);
  });

  it("verlängern öffnet dieselbe Eingabe mit dem geltenden Wert — ohne Vorgabedauer", async () => {
    await mitKarte({ ...GAST, accessExpiresAt: ZUKUNFT.iso }, "de");
    const t = i18n.getFixedT("de");

    await klick(knopf(t("adm.gastfrist.verlaengern")));

    expect(datumsfeld()?.value, "die Eingabe ist nicht mit dem geltenden Wert vorbelegt").toBe(
      ZUKUNFT.tag,
    );
    // Gegenprobe zur Auflage „kein Vorgabewert": ohne Befristung ist dasselbe Feld LEER.
    expect(puts(), "das Öffnen der Eingabe hat bereits geschrieben").toHaveLength(0);
  });

  it("ohne Befristung startet die Eingabe leer — keine Vorgabedauer", async () => {
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");

    await klick(knopf(t("adm.gastfrist.setzen")));

    expect(datumsfeld()?.value, "die leere Eingabe trägt eine Vorgabe").toBe("");
  });
});

// ================================================================================================
// F4 · BEENDEN — `null` STEHT WIRKLICH IM RUMPF
// ================================================================================================
describe("JOB 4021 · F4: der Admin beendet eine Befristung", () => {
  it("sendet genau EIN PUT mit ausdrücklichem null — nicht fehlend, nicht leer", async () => {
    await mitKarte({ ...GAST, accessExpiresAt: ZUKUNFT.iso }, "de");
    const t = i18n.getFixedT("de");

    listeHaengt = true;
    await klick(knopf(t("adm.gastfrist.beenden")));

    expect(puts()).toHaveLength(1);
    const gesendet = puts()[0];
    // Am ROHEN Rumpf gemessen: `undefined` verschwindet in `JSON.stringify` spurlos, und der Server
    // ginge über ein fehlendes Feld ausdrücklich hinweg (`routes.ts:836`).
    expect(gesendet?.roh, "der Rumpf trägt kein ausdrückliches null").toContain(
      '"accessExpiresAt":null',
    );
    expect(Object.keys(gesendet?.rumpf ?? {})).toContain("accessExpiresAt");
    expect(gesendet?.rumpf?.accessExpiresAt).toBeNull();
  });

  it("die Karte sagt danach unbefristet — und der Knopf sagt vorher, was er tut", async () => {
    await mitKarte({ ...GAST, accessExpiresAt: ZUKUNFT.iso }, "de");
    const t = i18n.getFixedT("de");
    // Der Handgriff ist als Beenden BENANNT, nicht als leeres Feld versteckt (Lieferpunkt 5).
    expect(knopf(t("adm.gastfrist.beenden")).textContent).toContain(t("adm.gastfrist.beenden"));

    listeHaengt = true;
    await klick(knopf(t("adm.gastfrist.beenden")));

    expect(kartenText(), "die Karte zeigt weiter eine Befristung").toContain(
      t("adm.gastfrist.unbefristet"),
    );
    expect(kartenText()).not.toContain(datumstext(ZUKUNFT.iso, "de"));
    expect(meldungen().join(" · ")).toContain(t("adm.gastfrist.beendet"));
  });
});

// ================================================================================================
// F5 · EIN DATUM IN DER VERGANGENHEIT IST KEINE GÜLTIGKEIT
// ================================================================================================
describe.each(SPRACHEN)("JOB 4021 · F5 (%s): abgelaufen wird abgelaufen genannt", (sprache) => {
  it("nennt den Zugang abgelaufen und behauptet keine Gültigkeit", async () => {
    await mitKarte({ ...GAST, accessExpiresAt: VERGANGENHEIT.iso }, sprache);
    const t = i18n.getFixedT(sprache);

    expect(kartenText()).toContain(
      t("adm.gastfrist.abgelaufen", { datum: datumstext(VERGANGENHEIT.iso, sprache) }),
    );
    expect(kartenText(), "ein abgelaufener Zugang wird als gültig dargestellt").not.toContain(
      t("adm.gastfrist.gueltigBis", { datum: datumstext(VERGANGENHEIT.iso, sprache) }),
    );
    expect(kartenText()).not.toContain(t("adm.gastfrist.unbefristet"));
    // Der Ausweg bleibt: verlängern und beenden stehen auch an einem abgelaufenen Zugang.
    expect(kartenText()).toContain(t("adm.gastfrist.verlaengern"));
    expect(kartenText()).toContain(t("adm.gastfrist.beenden"));
  });
});

// ================================================================================================
// F6 · DREI SPRACHEN, DREI WORTLAUTE — KEINE FÄLLT AUF EINE ANDERE ZURÜCK
// ================================================================================================
const NEUE_SCHLUESSEL = [
  "adm.gastfrist.titel",
  "adm.gastfrist.unbefristet",
  "adm.gastfrist.gueltigBis",
  "adm.gastfrist.abgelaufen",
  "adm.gastfrist.unlesbar",
  "adm.gastfrist.hinweis",
  "adm.gastfrist.setzen",
  "adm.gastfrist.verlaengern",
  "adm.gastfrist.beenden",
  "adm.gastfrist.datum",
  "adm.gastfrist.speichern",
  "adm.gastfrist.abbrechen",
  "adm.gastfrist.gespeichert",
  "adm.gastfrist.beendet",
  "adm.gastfrist.datumFehlt",
  "adm.gastfrist.fehlerHilfe",
  // Runde 2: der Satz für den UNBESTÄTIGTEN Ausgang. Er ist kein Zusatz zum Fehlersatz, sondern
  // seine Alternative — „Nichts wurde geändert" gilt nur noch, wenn der Server abgelehnt HAT.
  "adm.gastfrist.fehlerOffen",
];

describe("JOB 4021 · F6: DE, EN und NL haben je einen eigenen Wortlaut", () => {
  it("jeder neue Schlüssel löst in allen drei Sprachen auf — und nirgends auf den Schlüsselnamen", () => {
    for (const schluessel of NEUE_SCHLUESSEL) {
      for (const sprache of SPRACHEN) {
        const wert = i18n.getFixedT(sprache)(schluessel, { datum: "1.1.2027" });
        expect(wert, `${schluessel} fehlt in ${sprache}`).not.toBe(schluessel);
        expect(wert.length, `${schluessel} ist in ${sprache} leer`).toBeGreaterThan(0);
      }
    }
  });

  it("keine Sprache erbt den Wortlaut einer anderen", () => {
    for (const schluessel of NEUE_SCHLUESSEL) {
      const [de, en, nl] = SPRACHEN.map((s) =>
        i18n.getFixedT(s)(schluessel, { datum: "1.1.2027" }),
      );
      expect(en, `${schluessel}: EN ist wörtlich DE`).not.toBe(de);
      expect(nl, `${schluessel}: NL ist wörtlich DE`).not.toBe(de);
      expect(nl, `${schluessel}: NL ist wörtlich EN`).not.toBe(en);
    }
  });

  it.each(["en", "nl"] as const)(
    "die gemountete Karte spricht %s — nicht Deutsch",
    async (sprache) => {
      await mitKarte({ ...GAST, accessExpiresAt: ZUKUNFT.iso }, sprache);
      const eigen = i18n.getFixedT(sprache);
      const deutsch = i18n.getFixedT("de");

      expect(kartenText()).toContain(eigen("adm.gastfrist.titel"));
      expect(kartenText(), "die Karte fällt auf Deutsch zurück").not.toContain(
        deutsch("adm.gastfrist.titel"),
      );
      expect(kartenText()).toContain(eigen("adm.gastfrist.beenden"));
    },
  );
});

// ================================================================================================
// F7 · DER FEHLERVERTRAG — DER SATZ DES SERVERS KOMMT AN, UND NICHTS WIRD BEHAUPTET
// ================================================================================================
describe("JOB 4021 · F7: eine abgewiesene Befristung", () => {
  it("zeigt die Meldung des Servers, nicht eine eigene erfundene", async () => {
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");
    putFehler = { status: 403, error: "FORBIDDEN", message: "Unerwarteter Fehler." };

    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.gastfrist.speichern")));

    expect(meldungen().join(" · "), "der Satz des Servers kommt nicht an").toContain(
      "Unerwarteter Fehler.",
    );
    expect(meldungen().join(" · ")).not.toContain(t("adm.gastfrist.gespeichert"));
    // Der angezeigte Stand bleibt der alte — kein Erfolg, der nicht stattgefunden hat.
    expect(kartenText()).toContain(t("adm.gastfrist.unbefristet"));
    // Und der nächste Schritt steht dabei (Codex-Auflage: verständliche Fehlerhilfe).
    expect(kartenText()).toContain(t("adm.gastfrist.fehlerHilfe"));
  });

  it("ohne gewähltes Datum wird gar nicht erst gesendet — mit ehrlichem Grund", async () => {
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");

    await klick(knopf(t("adm.gastfrist.setzen")));
    await klick(knopf(t("adm.gastfrist.speichern")));

    expect(puts(), "es wurde ohne Datum gesendet").toHaveLength(0);
    expect(meldungen().join(" · ")).toContain(t("adm.gastfrist.datumFehlt"));
  });
});

// ================================================================================================
// F8 · EIN UNLESBARER BESTAND WIRD WEDER ALS DATUM NOCH ALS „UNBEFRISTET" AUSGEGEBEN
// ================================================================================================
describe("JOB 4021 · F8: unlesbarer Ablaufwert", () => {
  it("nennt ihn unlesbar und behauptet keine Sperre — so urteilt auch der Server", async () => {
    // `service.ts:317-322`: ein unlesbarer Wert sperrt NICHT, er wird vermerkt. Die Karte darf
    // daraus weder ein Datum machen noch „unbefristet" als frische Tatsache behaupten.
    await mitKarte({ ...GAST, accessExpiresAt: "irgendwann" }, "de");
    const t = i18n.getFixedT("de");

    expect(kartenText()).toContain(t("adm.gastfrist.unlesbar"));
    expect(kartenText()).not.toContain(t("adm.gastfrist.unbefristet"));
    // Der Ausweg steht bereit: beenden nimmt den kaputten Wert.
    expect(kartenText()).toContain(t("adm.gastfrist.beenden"));
  });
});

// ================================================================================================
// F9 · EIN UNBESTÄTIGTER AUSGANG IST KEIN BELEG FÜR UNVERÄNDERTE DATEN (BEN-Korrekturpflicht 1)
// ================================================================================================
describe("JOB 4021 · F9: das Schreiben lief, die Antwort ging verloren", () => {
  it("behauptet NICHT, dass nichts geändert wurde — und holt den Stand neu", async () => {
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");
    putAntwortVerloren = true;

    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.gastfrist.speichern")));

    // Gesendet wurde einmal, und der Server HAT geschrieben — sein Bestand trägt die Befristung.
    expect(puts(), "es wurde nicht genau einmal gesendet").toHaveLength(1);
    expect(bestand.accessExpiresAt, "der Testserver hat gar nicht geschrieben").toBeDefined();

    // DIE EIGENTLICHE AUSSAGE: der Satz „Nichts wurde geändert." steht nicht da. Er wäre falsch —
    // geändert wurde alles, nur bestätigt ist es nicht.
    expect(kartenText(), "die Karte behauptet unveränderte Daten ohne jeden Beleg").not.toContain(
      t("adm.gastfrist.fehlerHilfe"),
    );
    expect(kartenText(), "der unbestätigte Ausgang wird nicht benannt").toContain(
      t("adm.gastfrist.fehlerOffen"),
    );
    // Kein Erfolg wird gemeldet, den niemand bestätigt hat.
    expect(meldungen().join(" · ")).not.toContain(t("adm.gastfrist.gespeichert"));

    // Und der angezeigte Stand kommt danach vom SERVER, nicht aus einer Vermutung: die
    // Auffrischung ist gelaufen und zeigt, was wirklich gilt.
    expect(kartenText(), "der Stand wurde nach dem offenen Ausgang nicht neu geholt").toContain(
      t("adm.gastfrist.gueltigBis", { datum: datumstext(ZUKUNFT.iso, "de") }),
    );
    expect(kartenText()).not.toContain(t("adm.gastfrist.unbefristet"));
  });

  it("eine ABLEHNUNG des Servers belegt dagegen sehr wohl, dass nichts geändert wurde", async () => {
    // Die Gegenrichtung desselben Falls: der Dienst prüft die Form VOR dem Schreiben
    // (`services/auth/src/service.ts:422-428`), eine 4xx-Antwort ist also ein echter Beleg.
    // Ohne diesen Fall hätte man den Fehlersatz auch ersatzlos streichen können.
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");
    putFehler = { status: 403, error: "FORBIDDEN", message: "Unerwarteter Fehler." };

    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.gastfrist.speichern")));

    expect(kartenText()).toContain(t("adm.gastfrist.fehlerHilfe"));
    expect(kartenText()).not.toContain(t("adm.gastfrist.fehlerOffen"));
  });

  it("scheitert danach auch die Auffrischung, sagt die Karte, dass der Stand nicht frisch ist", async () => {
    // Auftrag §9, Zeile „Cache mit gescheiterter Auffrischung": der zuletzt bekannte Stand darf
    // stehen bleiben — als frische Tatsache darf er nicht durchgehen.
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");
    putAntwortVerloren = true;
    listeFehler = true;

    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.gastfrist.speichern")));
    await ruhe();

    expect(kartenText()).toContain(t("adm.gastfrist.fehlerOffen"));
    expect(kartenText(), "der ungedeckte Stand geht als frisch durch").toContain(
      t("einst.wert.nichtAktualisiert"),
    );
    expect(kartenText()).not.toContain(t("adm.gastfrist.fehlerHilfe"));
  });
});

// ================================================================================================
// F10 · KALENDERÜBERLÄUFE (BEN-Korrekturpflicht 2)
// ================================================================================================
describe("JOB 4021 · F10: ein Tag, den es im Kalender nicht gibt", () => {
  it("wird unlesbar genannt statt still auf einen anderen Tag umgerechnet", async () => {
    // `Date.parse("2026-02-30T12:00:00.000Z")` liefert KEIN NaN, sondern den 2. März. Der Dienst
    // verwirft solche Werte ausdrücklich (`services/auth/src/service.ts:52-67`) und sperrt mit
    // ihnen NIEMANDEN aus (`:317-322`) — eine Karte, die „Abgelaufen am 2.3.2026" sagt, behauptet
    // also zweierlei Unwahres: einen Tag, der nirgends steht, und eine Sperre, die es nicht gibt.
    await mitKarte({ ...GAST, accessExpiresAt: "2026-02-30T12:00:00.000Z" }, "de");
    const t = i18n.getFixedT("de");

    expect(kartenText()).toContain(t("adm.gastfrist.unlesbar"));
    expect(kartenText(), "der 30. Februar wurde still zum 2. März").not.toContain("2.3.2026");
    expect(kartenText()).not.toContain(t("adm.gastfrist.unbefristet"));
    expect(kartenText()).not.toContain(
      t("adm.gastfrist.abgelaufen", { datum: datumstext("2026-03-02T12:00:00.000Z", "de") }),
    );
  });

  it("ein echter Schalttag bleibt ein gültiges Datum — die Prüfung ist keine Pauschalsperre", async () => {
    // Die Gegenrichtung: 2028 ist ein Schaltjahr, der 29. Februar existiert. Ohne diesen Fall
    // wäre „alles im Februar ist unlesbar" eine grüne Lösung.
    const schalttag = "2028-02-29T12:00:00.000Z";
    await mitKarte({ ...GAST, accessExpiresAt: schalttag }, "de");
    const t = i18n.getFixedT("de");

    expect(kartenText()).toContain(
      t("adm.gastfrist.gueltigBis", { datum: datumstext(schalttag, "de") }),
    );
    expect(kartenText()).not.toContain(t("adm.gastfrist.unlesbar"));
  });

  it("wird beim Verlängern nicht als Vorbelegung in die Eingabe geschrieben", async () => {
    // Folgefehler derselben Wurzel: ein unlesbarer Bestand darf kein Datum in das Feld setzen, das
    // der Admin dann versehentlich bestätigt.
    await mitKarte({ ...GAST, accessExpiresAt: "2026-02-30T12:00:00.000Z" }, "de");
    const t = i18n.getFixedT("de");

    await klick(knopf(t("adm.gastfrist.verlaengern")));

    expect(datumsfeld()?.value, "ein unlesbarer Wert wurde als Tag vorgeschlagen").toBe("");
  });

  it("ein unmöglicher Tag verlässt die Karte gar nicht erst als anderer Tag", async () => {
    // Zwei Wege sind hier möglich, und BEIDE sind richtig: eine regelkonforme Datumseingabe
    // bereinigt „2026-02-30" selbst zu "" (HTML-Wertbereinigung), und dann ist der Weg schon dort
    // zu. Lässt sie den Wert durch, muss die Karte ihn abfangen. Gemessen wird deshalb die eine
    // Aussage, die in beiden Fällen gelten muss: es geht KEIN PUT hinaus, das einen anderen Tag
    // trägt als den gewählten.
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");

    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum("2026-02-30");
    await klick(knopf(t("adm.gastfrist.speichern")));

    expect(
      puts(),
      `ein unmöglicher Tag wurde gesendet (Feldwert: ${JSON.stringify(datumsfeld()?.value)}, Rumpf: ${puts()[0]?.roh})`,
    ).toHaveLength(0);
  });
});

// ================================================================================================
// F11 · DER ABLAUF TRITT EIN, WÄHREND DIE KARTE OFFEN STEHT (BEN-Korrekturpflicht 3)
// ================================================================================================
describe("JOB 4021 · F11: der Zeitübergang bei offener Karte", () => {
  it("wechselt ohne Zutun des Admins von gültig zu abgelaufen", async () => {
    // Der Ablauf liegt knapp vor uns. Die erste Aussage unten ist zugleich die Kalibrierung: wäre
    // der Zeitpunkt beim Aufbau schon vorbei, stünde dort „abgelaufen" und der Fall schlüge fehl,
    // statt still nichts zu messen.
    const gleich = new Date(Date.now() + 700);
    const nutzer = { ...GAST, accessExpiresAt: gleich.toISOString() };
    await mitKarte(nutzer, "de");
    const t = i18n.getFixedT("de");
    const datum = datumstext(gleich.toISOString(), "de");

    expect(kartenText(), "der Zugang galt beim Aufbau schon nicht mehr").toContain(
      t("adm.gastfrist.gueltigBis", { datum }),
    );

    await warte(900);

    expect(kartenText(), "die Karte behauptet Gültigkeit über den Ablauf hinaus").not.toContain(
      t("adm.gastfrist.gueltigBis", { datum }),
    );
    expect(kartenText()).toContain(t("adm.gastfrist.abgelaufen", { datum }));
    // Ohne jedes Zutun: es wurde nichts geschrieben, nur neu geurteilt.
    expect(puts(), "der Übergang hat am Server geschrieben").toHaveLength(0);
  });

  it("ein weit entfernter Ablauf zeichnet die Karte nicht dauernd neu", async () => {
    // Die Gegenrichtung: ein Sekundentakt würde diesen Fall auch grün machen, aber die Karte
    // 86400-mal am Tag neu zeichnen, um einmal etwas zu ändern. Der Wecker steht auf dem
    // ZEITPUNKT — solange er nicht erreicht ist, ändert sich die Aussage nicht.
    await mitKarte({ ...GAST, accessExpiresAt: ZUKUNFT.iso }, "de");
    const t = i18n.getFixedT("de");
    const datum = datumstext(ZUKUNFT.iso, "de");

    await warte(300);

    expect(kartenText()).toContain(t("adm.gastfrist.gueltigBis", { datum }));
    expect(kartenText()).not.toContain(t("adm.gastfrist.abgelaufen", { datum }));
  });
});

// ================================================================================================
// F12 · SETZEN UND BEENDEN VOLLSTÄNDIG IN EN UND NL (BEN-Prüflücke 6)
// ================================================================================================
describe.each(["en", "nl"] as const)(
  "JOB 4021 · F12 (%s): der ganze Weg in dieser Sprache",
  (sprache) => {
    it("setzen sendet den gewählten Tag und meldet den Erfolg in dieser Sprache", async () => {
      await mitKarte({ ...GAST }, sprache);
      const t = i18n.getFixedT(sprache);
      const deutsch = i18n.getFixedT("de");

      await klick(knopf(t("adm.gastfrist.setzen")));
      await tippeDatum(ZUKUNFT.tag);
      await klick(knopf(t("adm.gastfrist.speichern")));

      expect(puts(), "es wurde nicht genau einmal gesendet").toHaveLength(1);
      const gesendet = puts()[0]?.rumpf?.accessExpiresAt;
      expect(typeof gesendet).toBe("string");
      expect(String(gesendet), "der gesendete Wert hat nicht die Form des Servers").toMatch(
        ISO_ZEITSTEMPEL,
      );
      expect(meldungen().join(" · ")).toContain(t("adm.gastfrist.gespeichert"));
      expect(meldungen().join(" · "), "die Erfolgsmeldung fällt auf Deutsch zurück").not.toContain(
        deutsch("adm.gastfrist.gespeichert"),
      );
      expect(kartenText()).toContain(
        t("adm.gastfrist.gueltigBis", { datum: datumstext(ZUKUNFT.iso, sprache) }),
      );
    });

    it("beenden sendet ausdrückliches null und meldet es in dieser Sprache", async () => {
      await mitKarte({ ...GAST, accessExpiresAt: ZUKUNFT.iso }, sprache);
      const t = i18n.getFixedT(sprache);
      const deutsch = i18n.getFixedT("de");

      await klick(knopf(t("adm.gastfrist.beenden")));

      expect(puts()).toHaveLength(1);
      expect(puts()[0]?.roh, "null steht nicht im Rumpf").toContain('"accessExpiresAt":null');
      expect(meldungen().join(" · ")).toContain(t("adm.gastfrist.beendet"));
      expect(meldungen().join(" · "), "die Meldung fällt auf Deutsch zurück").not.toContain(
        deutsch("adm.gastfrist.beendet"),
      );
      expect(kartenText()).toContain(t("adm.gastfrist.unbefristet"));
    });
  },
);

// ================================================================================================
// F13 · DER ABLAUFWERT TRIFFT SPÄTER EIN (BEN R2, Korrekturpflicht 1)
// ================================================================================================
// Die Verweildauer ist der ganze Fall: Die Karte steht eine Weile offen, und ERST DANN bringt eine
// Auffrischung den Ablaufwert mit. Wird er gegen die Uhrzeit des Aufschlags gemessen, urteilt die
// Karte mit einer Uhr, die um genau diese Verweildauer nachgeht.
describe("JOB 4021 · F13: ein Ablaufwert, der erst nach einer Weile eintrifft", () => {
  it("ein bei seinem Eintreffen bereits abgelaufener Wert wird sofort abgelaufen genannt", async () => {
    // Der Zeitpunkt liegt NACH dem Kartenaufschlag und VOR dem Augenblick des Eintreffens. Genau in
    // diesem Fenster gingen beide Uhren auseinander: gegen die eingefrorene Uhrzeit gemessen liegt
    // er in der Zukunft („Gültig bis …"), gegen die laufende Uhr ist er vorbei.
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");
    const aufbau = Date.now();

    await warte(1200);

    const abgelaufenSeit = new Date(aufbau + 600);
    // Kalibrierung: ohne sie könnte der Fall auch dann grün sein, wenn gar keine Zeit verstrich.
    expect(
      Date.now(),
      "die Verweildauer hat den gewählten Zeitpunkt nicht überholt — der Fall misst nichts",
    ).toBeGreaterThan(abgelaufenSeit.getTime());
    await neuerBestand({ ...GAST, accessExpiresAt: abgelaufenSeit.toISOString() });

    const datum = datumstext(abgelaufenSeit.toISOString(), "de");
    expect(
      kartenText(),
      "die Karte behauptet Gültigkeit für einen Zeitpunkt, der beim Eintreffen schon vorbei war",
    ).not.toContain(t("adm.gastfrist.gueltigBis", { datum }));
    expect(kartenText()).toContain(t("adm.gastfrist.abgelaufen", { datum }));
    expect(kartenText()).not.toContain(t("adm.gastfrist.unbefristet"));
    // Ohne jedes Zutun: geurteilt wurde neu, geschrieben wurde nichts.
    expect(puts(), "der Übergang hat am Server geschrieben").toHaveLength(0);
  });

  it("die Restfrist eines später eingetroffenen Wertes läuft gegen die laufende Uhr", async () => {
    // Derselbe Weg, nur mit einem Wert, der beim Eintreffen noch GILT. Wird die Restfrist gegen die
    // Uhrzeit des Aufschlags gerechnet, steht der Wecker um die Verweildauer zu weit — die Karte
    // zeigte dann auch 300 ms NACH dem Ablauf noch „Gültig bis …".
    await mitKarte({ ...GAST }, "de");
    const t = i18n.getFixedT("de");

    await warte(1200);

    const gleich = new Date(Date.now() + 500);
    await neuerBestand({ ...GAST, accessExpiresAt: gleich.toISOString() });
    const datum = datumstext(gleich.toISOString(), "de");
    // Kalibrierung und zugleich die Gegenrichtung: ein später eingetroffener Wert, der noch gilt,
    // wird auch als geltend gezeigt — die Reparatur macht nicht pauschal alles „abgelaufen".
    expect(kartenText(), "der Zugang galt beim Eintreffen schon nicht mehr").toContain(
      t("adm.gastfrist.gueltigBis", { datum }),
    );

    await warte(800);

    expect(kartenText(), "die Karte behauptet Gültigkeit über den Ablauf hinaus").not.toContain(
      t("adm.gastfrist.gueltigBis", { datum }),
    );
    expect(kartenText()).toContain(t("adm.gastfrist.abgelaufen", { datum }));
    expect(puts(), "der Übergang hat am Server geschrieben").toHaveLength(0);
  });
});

// ================================================================================================
// JOB 4103 · ERSTEINRICHTUNG-GAST, TEIL 3 — BEFRISTET ANLEGEN, IN EINEM VORGANG.
// ================================================================================================
//
// DER BEFUND, am main `b949390` (1.0.0-beta.1.520) selbst nachgelesen: Der Server legt seit
// JOB 4011 in EINEM Aufruf befristet an (`services/auth/src/routes.ts`, `Body: { …;
// accessExpiresAt?: unknown }`, Wache 1 „DIE FORM" und Wache 2 „DIE LESBARKEIT" VOR `register`),
// und `tests/gast-befristung/gast-in-einem-schritt.test.ts` misst diesen Vertrag (G1: 201 mit dem
// Feld; G5: ohne Angabe entsteht ein Konto OHNE das Feld). Die Oberfläche rief ihn nicht auf:
// `apps/web/src/api/endpoints.ts` schickte vier Felder (`{ name, email, password, role }`), und
// `NutzerAnlegenDetail` kannte `accessExpiresAt` an keiner Stelle.
//
// Der Admin musste deshalb zweimal handeln: anlegen, dann das Konto in der Liste wiederfinden und
// in seiner Karte befristen (JOB 4021, F1–F13 oben). Dazwischen stand ein freigegebenes,
// UNBEFRISTETES Konto — und unterblieb der zweite Handgriff, blieb es dort.
//
// A1 ein POST mit dem Tagesende · A2 ohne Tag fehlt das Feld ganz · A3 ein unmöglicher Tag legt
// nichts an · A4 der Fehlervertrag beider Ausgänge · A5 DE/EN/NL.
//
// GEMESSEN WIRD AN DER ZAHL DER AUFRUFE UND AM RUMPF, nicht an der Fläche allein: eine Lösung, die
// anlegt und danach `setAccessExpiry` hinterherruft, sähe auf dem Bildschirm gleich aus und wäre
// genau die Lücke, gegen die JOB 4011 gebaut wurde. A1 schliesst sie aus (`puts()` bleibt leer).

// ================================================================================================
// A1 · EIN VORGANG, EIN POST, UND ER TRÄGT DEN GEWÄHLTEN TAG
// ================================================================================================
describe("JOB 4103 · A1: der Admin legt einen befristeten Gast an", () => {
  it("sendet genau EIN POST, dessen Rumpf das Tagesende des gewählten Tages trägt", async () => {
    await mitAnlegekarte("de");
    const t = i18n.getFixedT("de");

    await fuelleStammdaten();
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.create")));

    expect(posts(), `POST-Aufrufe: ${JSON.stringify(posts())}`).toHaveLength(1);
    // DIE EIGENTLICHE AUSSAGE: kein zweiter Aufruf reicht die Befristung nach. Ein `setAccessExpiry`
    // im Anschluss wäre ein PUT — und genau der darf hier nicht stehen.
    expect(puts(), "die Befristung wurde in einem zweiten Aufruf nachgereicht").toHaveLength(0);

    const gesendet = posts()[0];
    expect(gesendet?.pfad).toBe("/api/users");
    const wert = gesendet?.rumpf?.accessExpiresAt;
    expect(typeof wert, "der Rumpf trägt keine Zeichenkette").toBe("string");
    expect(String(wert), "der Server weist diese Form ab").toMatch(ISO_ZEITSTEMPEL);
    // Der gesendete Zeitpunkt ist das ENDE des gewählten Tages — an der Grenze gemessen, nicht an
    // einer abgeschriebenen Zahl (dieselbe Messung wie F3).
    const zeitpunkt = new Date(String(wert));
    expect(lokalerTag(zeitpunkt), "der gesendete Zeitpunkt liegt auf einem anderen Tag").toBe(
      ZUKUNFT.tag,
    );
    expect(
      lokalerTag(new Date(zeitpunkt.getTime() + 1)),
      "der gesendete Zeitpunkt ist nicht der letzte Augenblick des Tages",
    ).not.toBe(ZUKUNFT.tag);
    // Die Stammdaten und die Rolle reisen im SELBEN Rumpf mit (Prüflücke 6c des Auftrags).
    expect(gesendet?.rumpf?.name).toBe(NEU_NAME);
    expect(gesendet?.rumpf?.email).toBe(NEU_EMAIL);
    expect(gesendet?.rumpf?.role).toBe("experte");
    // Und am Bestand des Servers steht danach EIN Konto, das sein Ende trägt.
    expect(angelegt).toHaveLength(1);
    expect(angelegt[0]?.accessExpiresAt).toBe(String(wert));
  });

  it("meldet den Erfolg und macht die Nutzerliste ungültig — die Wirkung wird sichtbar", async () => {
    await mitAnlegekarte("de");
    const t = i18n.getFixedT("de");
    // Die Liste dieses QueryClients trägt einen Stand OHNE den neuen Gast. Wird sie nach dem
    // Anlegen nicht ungültig, bliebe genau dieser veraltete Stand stehen.
    qcDerKarte.setQueryData<PublicUser[]>(["users"], [GAST]);

    await fuelleStammdaten();
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.create")));

    expect(meldungen().join(" · ")).toContain(t("adm.created"));
    expect(
      qcDerKarte.getQueryState(["users"])?.isInvalidated,
      "die Nutzerliste wurde nicht ungültig gemacht — der neue Gast bliebe unsichtbar",
    ).toBe(true);
  });
});

// ================================================================================================
// A2 · OHNE TAG FEHLT DAS FELD GANZ — NICHT `null`, NICHT `""`
// ================================================================================================
describe("JOB 4103 · A2: dieselbe Anlage ohne Tag", () => {
  it("sendet genau ein POST, und `accessExpiresAt` steht nicht im Rumpf", async () => {
    await mitAnlegekarte("de");
    const t = i18n.getFixedT("de");

    await fuelleStammdaten();
    await klick(knopf(t("adm.create")));

    expect(posts()).toHaveLength(1);
    const gesendet = posts()[0];
    // Am ROHEN Rumpf gemessen: eine Lösung, die immer ein Feld mitschickt, bestünde A1 und zerstörte
    // den Bestandsweg. `null` und `""` wären am Anlageweg zwar auch „unbefristet"
    // (`routes.ts`, „DREI EINGABEN, ZWEI AUSSAGEN") — aber `""` ist ein STRING und liefe damit in
    // die Lesbarkeitswache, also in ein 403 für einen Vorgang, der gar keine Befristung wollte.
    expect(
      Object.hasOwn(gesendet?.rumpf ?? {}, "accessExpiresAt"),
      `der Rumpf trägt das Feld: ${gesendet?.roh}`,
    ).toBe(false);
    expect(gesendet?.roh ?? "").not.toContain("accessExpiresAt");
    // Und es entsteht ein Zugang ohne Ende — dieselbe Aussage, die G5 am Server misst.
    expect(angelegt).toHaveLength(1);
    expect(angelegt[0]?.accessExpiresAt).toBeUndefined();
    expect(meldungen().join(" · ")).toContain(t("adm.created"));
  });

  it("die Eingabe steht zu, bis der Admin sie öffnet — und startet dann leer", async () => {
    await mitAnlegekarte("de");
    const t = i18n.getFixedT("de");

    // Kein leeres Datumsfeld als Ersatz für die Aussage (Auftrag §9, wie F2 an der Kontokarte).
    expect(datumsfeld(), "das Ablauffeld steht ungefragt offen").toBe(null);

    await klick(knopf(t("adm.gastfrist.setzen")));

    expect(datumsfeld(), "das Ablauffeld fehlt").not.toBe(null);
    expect(datumsfeld()?.value, "die Eingabe trägt eine Vorgabedauer").toBe("");
    expect(posts(), "das Öffnen der Eingabe hat bereits angelegt").toHaveLength(0);
  });

  it("wer die Eingabe wieder schliesst, legt unbefristet an — ohne das Feld im Rumpf", async () => {
    // Die Gegenrichtung zum Schalter: er ist kein Einbahnweg, und ein einmal getippter Tag, den
    // der Admin verwirft, reist nicht heimlich mit.
    await mitAnlegekarte("de");
    const t = i18n.getFixedT("de");

    await fuelleStammdaten();
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.gastfrist.abbrechen")));
    await klick(knopf(t("adm.create")));

    expect(posts()).toHaveLength(1);
    expect(posts()[0]?.roh ?? "").not.toContain("accessExpiresAt");
    expect(angelegt[0]?.accessExpiresAt).toBeUndefined();
  });
});

// ================================================================================================
// A3 · EIN TAG, DEN ES IM KALENDER NICHT GIBT, LEGT GAR NICHTS AN
// ================================================================================================
describe("JOB 4103 · A3: ein unmöglicher Tag im Anlegeformular", () => {
  it("sendet nicht, legt nichts an und sagt ehrlich, was fehlt", async () => {
    // Nachgemessen an dieser jsdom-Fassung: eine regelkonforme Datumseingabe BEREINIGT
    // „2026-02-30" selbst zu "" (HTML-Wertbereinigung; „2028-02-29" bleibt stehen). Genau deshalb
    // hängt der Weg an einem SCHALTER und nicht am leeren Feld: ohne ihn entstünde hier still ein
    // Zugang OHNE ENDE, und niemand hätte das gewollt. Gemessen wird die Aussage, die in beiden
    // Welten gelten muss — es entsteht kein Konto, und es geht kein Aufruf hinaus.
    await mitAnlegekarte("de");
    const t = i18n.getFixedT("de");

    await fuelleStammdaten();
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum("2026-02-30");
    await klick(knopf(t("adm.create")));

    expect(
      posts(),
      `es wurde gesendet (Feldwert: ${JSON.stringify(datumsfeld()?.value)}, Rumpf: ${posts()[0]?.roh})`,
    ).toHaveLength(0);
    expect(angelegt, "es ist ein Konto entstanden").toHaveLength(0);
    expect(meldungen().join(" · ")).toContain(t("adm.gastfrist.datumFehlt"));
    // Die Eingaben bleiben stehen — der Admin tippt nichts erneut.
    expect(eingabe(t("adm.name")).value).toBe(NEU_NAME);
  });

  it("ein echter Schalttag geht dagegen hinaus — die Prüfung ist keine Pauschalsperre", async () => {
    // Die Gegenrichtung: ohne diesen Fall wäre „im Februar wird nie gesendet" eine grüne Lösung.
    await mitAnlegekarte("de");
    const t = i18n.getFixedT("de");

    await fuelleStammdaten();
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum("2028-02-29");
    await klick(knopf(t("adm.create")));

    expect(posts(), `Feldwert: ${JSON.stringify(datumsfeld()?.value)}`).toHaveLength(1);
    const wert = String(posts()[0]?.rumpf?.accessExpiresAt);
    expect(wert).toMatch(ISO_ZEITSTEMPEL);
    expect(lokalerTag(new Date(wert))).toBe("2028-02-29");
    expect(angelegt).toHaveLength(1);
  });
});

// ================================================================================================
// A4 · DER FEHLERVERTRAG — BEIDE AUSGÄNGE, UND NUR EINER DARF „KEIN KONTO" SAGEN
// ================================================================================================
describe("JOB 4103 · A4: der Server weist die Anlage ab", () => {
  it("zeigt den Satz des Servers, sendet kein zweites Mal und behält die Eingaben", async () => {
    await mitAnlegekarte("de");
    const t = i18n.getFixedT("de");
    postFehler = { status: 400, error: "BAD_REQUEST", message: ABLAUF_UNLESBAR };

    await fuelleStammdaten();
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.create")));

    expect(posts(), "es wurde nicht genau einmal gesendet").toHaveLength(1);
    expect(puts(), "nach der Abweisung lief noch ein Änderungsaufruf").toHaveLength(0);
    expect(meldungen().join(" · "), "der Satz des Servers kommt nicht an").toContain(
      ABLAUF_UNLESBAR,
    );
    expect(kartenText(), "die Auskunft blitzt nur als Toast auf").toContain(ABLAUF_UNLESBAR);
    // Nach einer ABLEHNUNG steht fest, dass nichts entstanden ist — der Dienst prüft die Form VOR
    // `register` (`routes.ts`, Wache 1 und 2).
    expect(kartenText()).toContain(t("adm.gastfrist.anlageFehlerHilfe"));
    expect(kartenText()).not.toContain(t("adm.gastfrist.anlageFehlerOffen"));
    expect(meldungen().join(" · ")).not.toContain(t("adm.created"));
    expect(angelegt, "es ist ein Konto entstanden").toHaveLength(0);
    // Die Eingaben bleiben stehen, samt gewähltem Tag.
    expect(eingabe(t("adm.name")).value).toBe(NEU_NAME);
    expect(eingabe(t("adm.email")).value).toBe(NEU_EMAIL);
    expect(datumsfeld()?.value).toBe(ZUKUNFT.tag);
  });

  it("bleibt der Ausgang offen, wird NICHT behauptet, dass kein Konto entstand", async () => {
    // Dieselbe Klasse wie F9 an der Kontokarte (BEN-Korrekturpflicht 1 aus JOB 4021 R1): der Server
    // HAT angelegt, nur die Antwort ging auf dem Rückweg verloren. „Es wurde kein Konto angelegt."
    // wäre hier eine Tatsachenaussage über fremde Daten ohne jeden Beleg.
    await mitAnlegekarte("de");
    const t = i18n.getFixedT("de");
    postAntwortVerloren = true;
    // Ein Stand, der ungültig werden KANN — ohne ihn liefe die Auffrischung ins Leere und die
    // letzte Prüfung dieses Falls wäre eine Aussage über nichts.
    qcDerKarte.setQueryData<PublicUser[]>(["users"], [GAST]);

    await fuelleStammdaten();
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.create")));

    expect(posts(), "es wurde nicht genau einmal gesendet").toHaveLength(1);
    expect(angelegt, "der Testserver hat gar nicht angelegt").toHaveLength(1);
    expect(
      kartenText(),
      "die Karte behauptet ein nicht entstandenes Konto ohne Beleg",
    ).not.toContain(t("adm.gastfrist.anlageFehlerHilfe"));
    expect(kartenText(), "der unbestätigte Ausgang wird nicht benannt").toContain(
      t("adm.gastfrist.anlageFehlerOffen"),
    );
    expect(meldungen().join(" · ")).not.toContain(t("adm.created"));
    // Und der Stand kommt danach vom SERVER statt aus einer Annahme.
    expect(
      qcDerKarte.getQueryState(["users"])?.isInvalidated,
      "der Bestand wurde nach dem offenen Ausgang nicht neu geholt",
    ).toBe(true);
  });
});

// ================================================================================================
// A5 · DREI SPRACHEN — DIE BESCHRIFTUNG IST DA UND IST NIRGENDS DER SCHLÜSSELNAME
// ================================================================================================
const NEUE_SCHLUESSEL_4103 = [
  "adm.gastfrist.anlageHinweis",
  "adm.gastfrist.anlageFehlerHilfe",
  "adm.gastfrist.anlageFehlerOffen",
];

describe("JOB 4103 · A5: DE, EN und NL", () => {
  it("jeder neue Schlüssel löst in allen drei Sprachen auf — und nirgends auf den Schlüsselnamen", () => {
    for (const schluessel of NEUE_SCHLUESSEL_4103) {
      for (const sprache of SPRACHEN) {
        const wert = i18n.getFixedT(sprache)(schluessel);
        expect(wert, `${schluessel} fehlt in ${sprache}`).not.toBe(schluessel);
        expect(wert.length, `${schluessel} ist in ${sprache} leer`).toBeGreaterThan(0);
      }
    }
  });

  it("keine Sprache erbt den Wortlaut einer anderen", () => {
    for (const schluessel of NEUE_SCHLUESSEL_4103) {
      const [de, en, nl] = SPRACHEN.map((s) => i18n.getFixedT(s)(schluessel));
      expect(en, `${schluessel}: EN ist wörtlich DE`).not.toBe(de);
      expect(nl, `${schluessel}: NL ist wörtlich DE`).not.toBe(de);
      expect(nl, `${schluessel}: NL ist wörtlich EN`).not.toBe(en);
    }
  });
});

describe.each(SPRACHEN)("JOB 4103 · A5 (%s): die Anlagekarte spricht diese Sprache", (sprache) => {
  it("trägt Überschrift, Hinweis und die Beschriftung des Ablauffeldes", async () => {
    await mitAnlegekarte(sprache);
    const t = i18n.getFixedT(sprache);

    expect(kartenText(), "die Überschrift der Befristung fehlt").toContain(
      t("adm.gastfrist.titel"),
    );
    expect(kartenText(), "der Hinweis zur Anlage fehlt").toContain(
      t("adm.gastfrist.anlageHinweis"),
    );

    await klick(knopf(t("adm.gastfrist.setzen")));

    expect(kartenText(), "die Beschriftung des Ablauffeldes fehlt").toContain(
      t("adm.gastfrist.datum"),
    );
    expect(datumsfeld(), "das Ablauffeld fehlt").not.toBe(null);
  });
});

// ================================================================================================
// JOB 4103 R2 · L — DIE BEFRISTUNG AM LISTENEINTRAG (BEN-Korrekturpflicht 1 aus Runde 1)
// ================================================================================================
//
// DER BEFUND VON BEN, am Prüfstand `dd9e693` nachgelesen: A1–A5 oben belegen, dass der EINE POST die
// Befristung trägt — aber `pages/Admin.tsx:518` zeichnete in der Kontenliste nur Name, Rolle und
// Freigabestatus. Wer einen befristeten Gast angelegt hatte, sah dessen Ende erst, wenn er die
// Kontokarte öffnete. Lieferung 6 („der neue Eintrag trägt seine Befristung") war damit NICHT
// erfüllt, und die Rückgabe von Runde 1 behauptete das Gegenteil: sie prüfte `isInvalidated`, also
// dass eine Auffrischung ANGESTOSSEN wurde — nicht, was danach auf der Fläche steht.
//
// DIESE FÄLLE MESSEN DEN RUNDWEG und nichts Kleineres: echte Verwaltungsseite, Formular ausfüllen,
// EINMAL anlegen, Auffrischung abwarten, Datum am gerenderten Listeneintrag lesen — ohne eine
// Detailkarte zu öffnen. Gelesen wird am `data-einst="wert"` GENAU DIESER Zeile, nicht am Seitentext:
// sonst genügte es, dass das Datum irgendwo steht, und das war ja gerade der Irrtum.
//
// Der gefälschte Server gibt seit dieser Runde in `GET /api/users` auch die neu angelegten Konten
// heraus (`[bestand, ...angelegt]`). Ohne das war der Rundweg überhaupt nicht messbar.
//
// L1 Rundweg mit Tag · L2 Rundweg ohne Tag (Kalibrierung) · L3 verzögerte Auffrischung ·
// L4 gescheiterte Auffrischung · L5 unlesbarer Bestandswert · L6 DE/EN/NL.
describe("JOB 4103 R2 · L1: der angelegte Gast trägt seine Befristung in der Liste", () => {
  it("zeigt das Datum am neuen Listeneintrag — ohne dass eine Detailkarte geöffnet wird", async () => {
    await mitVerwaltung("de");
    const t = i18n.getFixedT("de");
    // Kalibrierung: vorher gibt es diese Zeile nicht. Ohne sie könnte der Fall auch grün sein,
    // wenn die Liste den Eintrag schon immer getragen hätte.
    expect(zeilenWert(NEU_NAME), "der Interessent stand schon vor dem Anlegen in der Liste").toBe(
      null,
    );

    await klick(seitenKnopf(t("einst.konten.hinzufuegen")));
    await fuelleStammdaten();
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.create")));
    await ruhe(12);

    // Weiterhin EIN Aufruf für den ganzen Vorgang — der Rundweg hat daran nichts geändert.
    expect(posts(), `POST-Aufrufe: ${JSON.stringify(posts())}`).toHaveLength(1);
    expect(puts(), "die Befristung wurde in einem zweiten Aufruf nachgereicht").toHaveLength(0);

    const gesendet = String(posts()[0]?.rumpf?.accessExpiresAt);
    const wert = zeilenWert(NEU_NAME);
    expect(wert, "der neue Gast steht nicht in der Kontenliste").not.toBe(null);
    // Das Datum der ZEILE ist das Datum des gesendeten Zeitpunkts — abgeleitet, nicht abgeschrieben.
    expect(wert ?? "", "die Zeile nennt die Befristung nicht").toContain(
      t("einst.konten.befristet", { datum: datumstext(gesendet, "de") }),
    );
    // Die Rolle bleibt daneben stehen; die Befristung verdrängt sie nicht.
    expect(wert ?? "").toContain(t("role.name.experte"));
    // DIE EIGENTLICHE ZUSAGE: dafür musste niemand eine Karte öffnen.
    expect(
      container.querySelector('[data-testid="detail-nutzer"]'),
      "das Datum war nur in einer geöffneten Kontokarte zu sehen",
    ).toBe(null);
  });

  it("ohne Tag bleibt die Zeile bei der Rolle — kein erfundenes Ende", async () => {
    // Die Kalibrierung zu L1: eine Lösung, die an JEDE Zeile etwas anhängt, bestünde L1 und wäre
    // hier rot. Gemessen wird der GANZE Wert der Zeile, nicht ein `toContain`.
    await mitVerwaltung("de");
    const t = i18n.getFixedT("de");

    await klick(seitenKnopf(t("einst.konten.hinzufuegen")));
    await fuelleStammdaten();
    await klick(knopf(t("adm.create")));
    await ruhe(12);

    expect(posts()).toHaveLength(1);
    expect(posts()[0]?.roh ?? "").not.toContain("accessExpiresAt");
    expect(zeilenWert(NEU_NAME), "die Zeile trägt eine Befristung, die niemand gesetzt hat").toBe(
      t("role.name.experte"),
    );
  });
});

// ================================================================================================
// L3/L4 · DIE LISTE BEHAUPTET NICHTS, WAS SIE NICHT GEHOLT HAT
// ================================================================================================
describe("JOB 4103 R2 · L3/L4: Auffrischung verzögert und gescheitert", () => {
  it("L3 — solange die Auffrischung läuft, steht der neue Zugang NICHT als Tatsache da", async () => {
    await mitVerwaltung("de");
    const t = i18n.getFixedT("de");

    await klick(seitenKnopf(t("einst.konten.hinzufuegen")));
    await fuelleStammdaten();
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    // Ab hier beantwortet der Server die LISTE nicht mehr. Der POST läuft durch, die Auffrischung
    // bleibt offen — genau das Fenster aus Auftrag §9, Zeile „Cache mit laufender Auffrischung".
    listeHaengt = true;
    await klick(knopf(t("adm.create")));
    await ruhe(12);

    const gesendet = String(posts()[0]?.rumpf?.accessExpiresAt);
    // Der Server HAT das Konto — die Liste weiss es nur noch nicht.
    expect(angelegt, "der Testserver hat gar nicht angelegt").toHaveLength(1);
    expect(
      zeilenWert(NEU_NAME),
      "die Liste zeigt einen Eintrag, den sie nie vom Server geholt hat",
    ).toBe(null);
    expect(
      liste().textContent ?? "",
      "die Liste nennt ein Ablaufdatum, das sie nicht geholt hat",
    ).not.toContain(datumstext(gesendet, "de"));

    // Und wenn die Auffrischung ankommt, steht die Befristung da.
    listeHaengt = false;
    await act(async () => {
      await qcDerKarte.invalidateQueries({ queryKey: ["users"] });
    });
    await ruhe(12);

    expect(zeilenWert(NEU_NAME) ?? "").toContain(
      t("einst.konten.befristet", { datum: datumstext(gesendet, "de") }),
    );
  });

  it("L4 — scheitert die Auffrischung, sagt die Liste, dass ihr Stand nicht frisch ist", async () => {
    await mitVerwaltung("de");
    const t = i18n.getFixedT("de");

    await klick(seitenKnopf(t("einst.konten.hinzufuegen")));
    await fuelleStammdaten();
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    listeFehler = true;
    await klick(knopf(t("adm.create")));
    await ruhe(12);

    expect(angelegt, "der Testserver hat gar nicht angelegt").toHaveLength(1);
    // Der zuletzt belegte Stand bleibt SICHTBAR (REGELN §7) — er wird nicht geleert …
    expect(zeilenWert(GAST.name), "der zuletzt belegte Stand wurde geleert").not.toBe(null);
    // … er geht aber auch nicht als frisch durch, und der neue Zugang wird nicht erfunden.
    expect(container.textContent ?? "", "der ungedeckte Stand geht als frisch durch").toContain(
      t("einst.wert.nichtAktualisiert"),
    );
    expect(zeilenWert(NEU_NAME), "die Liste erfindet einen Eintrag ohne Beleg").toBe(null);
  });
});

// ================================================================================================
// L5 · EIN UNLESBARER BESTANDSWERT WIRD BENANNT, NICHT VERSCHWIEGEN
// ================================================================================================
describe("JOB 4103 R2 · L5: unlesbarer Ablaufwert in der Liste", () => {
  it("nennt ihn unlesbar statt still auf einen anderen Tag umzurechnen", async () => {
    // Dieselbe Klasse wie F10 an der Karte: `Date.parse("2026-02-30T12:00:00.000Z")` liefert kein
    // NaN, sondern den 2. März. Schwiege die Zeile stattdessen, läse sich das neben befristeten
    // Nachbarzeilen als „endet nicht" — auch das ohne Beleg.
    await mitVerwaltung("de", { ...GAST, accessExpiresAt: "2026-02-30T12:00:00.000Z" });
    const t = i18n.getFixedT("de");

    const wert = zeilenWert(GAST.name) ?? "";
    expect(wert).toContain(t("einst.konten.fristUnlesbar"));
    expect(wert, "der 30. Februar wurde still zum 2. März").not.toContain("2.3.2026");
  });

  it("ein echter Schalttag bleibt ein Datum — die Prüfung ist keine Pauschalsperre", async () => {
    const schalttag = "2028-02-29T12:00:00.000Z";
    await mitVerwaltung("de", { ...GAST, accessExpiresAt: schalttag });
    const t = i18n.getFixedT("de");

    const wert = zeilenWert(GAST.name) ?? "";
    expect(wert).toContain(t("einst.konten.befristet", { datum: datumstext(schalttag, "de") }));
    expect(wert).not.toContain(t("einst.konten.fristUnlesbar"));
  });

  it("ein bereits verstrichener Zeitpunkt wird abgelaufen genannt, nicht als Frist ausgegeben", async () => {
    await mitVerwaltung("de", { ...GAST, accessExpiresAt: VERGANGENHEIT.iso });
    const t = i18n.getFixedT("de");

    const wert = zeilenWert(GAST.name) ?? "";
    expect(wert).toContain(
      t("einst.konten.abgelaufen", { datum: datumstext(VERGANGENHEIT.iso, "de") }),
    );
    expect(wert, "ein abgelaufener Zugang wird als laufende Befristung dargestellt").not.toContain(
      t("einst.konten.befristet", { datum: datumstext(VERGANGENHEIT.iso, "de") }),
    );
  });
});

// ================================================================================================
// L6 · DIE LISTE SPRICHT DE, EN UND NL
// ================================================================================================
const NEUE_SCHLUESSEL_LISTE = [
  "einst.konten.befristet",
  "einst.konten.abgelaufen",
  "einst.konten.fristUnlesbar",
];

describe("JOB 4103 R2 · L6: DE, EN und NL in der Kontenliste", () => {
  it("jeder neue Schlüssel löst in allen drei Sprachen auf — und nirgends auf den Schlüsselnamen", () => {
    for (const schluessel of NEUE_SCHLUESSEL_LISTE) {
      for (const sprache of SPRACHEN) {
        const wert = i18n.getFixedT(sprache)(schluessel, { datum: "1.1.2027" });
        expect(wert, `${schluessel} fehlt in ${sprache}`).not.toBe(schluessel);
        expect(wert.length, `${schluessel} ist in ${sprache} leer`).toBeGreaterThan(0);
      }
    }
  });

  it("keine Sprache erbt den Wortlaut einer anderen", () => {
    for (const schluessel of NEUE_SCHLUESSEL_LISTE) {
      const [de, en, nl] = SPRACHEN.map((s) =>
        i18n.getFixedT(s)(schluessel, { datum: "1.1.2027" }),
      );
      expect(en, `${schluessel}: EN ist wörtlich DE`).not.toBe(de);
      expect(nl, `${schluessel}: NL ist wörtlich DE`).not.toBe(de);
      expect(nl, `${schluessel}: NL ist wörtlich EN`).not.toBe(en);
    }
  });
});

describe.each(SPRACHEN)("JOB 4103 R2 · L6 (%s): die gerenderte Zeile", (sprache) => {
  it("nennt die Befristung in dieser Sprache — und nicht auf Deutsch", async () => {
    await mitVerwaltung(sprache, { ...GAST, accessExpiresAt: ZUKUNFT.iso });
    const eigen = i18n.getFixedT(sprache);
    const deutsch = i18n.getFixedT("de");

    const wert = zeilenWert(GAST.name) ?? "";
    expect(wert, "die Zeile nennt die Befristung nicht").toContain(
      eigen("einst.konten.befristet", { datum: datumstext(ZUKUNFT.iso, sprache) }),
    );
    if (sprache !== "de") {
      expect(wert, "die Zeile fällt auf Deutsch zurück").not.toContain(
        deutsch("einst.konten.befristet", { datum: datumstext(ZUKUNFT.iso, "de") }),
      );
    }
  });
});

describe.each(["en", "nl"] as const)("JOB 4103 · A5 (%s): kein Rückfall auf Deutsch", (sprache) => {
  it("der ganze Weg läuft in dieser Sprache — Feld, Anlage und Erfolgsmeldung", async () => {
    await mitAnlegekarte(sprache);
    const t = i18n.getFixedT(sprache);
    const deutsch = i18n.getFixedT("de");

    expect(kartenText(), "die Karte fällt auf Deutsch zurück").not.toContain(
      deutsch("adm.gastfrist.anlageHinweis"),
    );

    await fuelleStammdaten(sprache);
    await klick(knopf(t("adm.gastfrist.setzen")));
    await tippeDatum(ZUKUNFT.tag);
    await klick(knopf(t("adm.create")));

    expect(posts(), "es wurde nicht genau einmal gesendet").toHaveLength(1);
    expect(String(posts()[0]?.rumpf?.accessExpiresAt)).toMatch(ISO_ZEITSTEMPEL);
    expect(meldungen().join(" · ")).toContain(t("adm.created"));
    expect(meldungen().join(" · "), "die Erfolgsmeldung fällt auf Deutsch zurück").not.toContain(
      deutsch("adm.created"),
    );
  });
});
