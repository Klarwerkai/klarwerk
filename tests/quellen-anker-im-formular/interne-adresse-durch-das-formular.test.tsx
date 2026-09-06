// @vitest-environment jsdom
// ================================================================================================
// JOB 3133 · UX-22 RUNDE 4 — DER DURCHGEHENDE FALL MIT NICHTLEERER INTERNER ALLOWLIST.
// ================================================================================================
//
// DER FEHLER, DEN DIESE DATEI FESTNAGELT (Codex R3, Korrekturpflicht 1): Runde 3 machte aus JEDEM
// Hinweis eine harte Knopfsperre. `sourceAttachHint` kennt die Origin-Allowlist des Betreibers
// aber nicht (externalAttachGate.ts:50-52) und stuft JEDE absolute http(s)-Adresse als
// „public-url" ein — auch `https://confluence.werk.local/…`, die der Betreiber ausdrücklich als
// intern eingetragen hat und die der Server mit 200 annimmt. Die Oberfläche sperrte damit einen
// Weg, den der Nutzer hat. Codex' Messung: Basisstand `{"reach":"internal","calls":1}` gegen
// Runde 3 `{"reach":"internal","ariaDisabled":"true","calls":0}`.
//
// WARUM HIER EIN ECHTER SERVER STEHT UND KEIN SPION: Die Prüflücke, die Codex benannt hat, ist
// genau die Stelle, an der Oberfläche und Server auseinanderlaufen können. Ein Prüfstand, der die
// Antwort selbst erfindet, könnte diese Lücke nicht sehen — er würde die Annahme messen, die zu
// prüfen ist. Deshalb läuft hier die ECHTE App (`buildApp(buildServices())`) mit einer ECHT
// gesetzten `KLARWERK_INTERNAL_SOURCE_ORIGINS`, und das Formular spricht über
// `globalThis.fetch` → `app.inject` mit ihr. Ersetzt ist allein der TRANSPORT (der Cookie-Beutel
// des Browsers; der Client schickt `credentials: "include"`, hier steht dafür der Bearer-Kopf) —
// keine Regel, keine Route, kein Urteil.
//
// DIE DREI FÄLLE DES KORRIGIERTEN §5.7, jeder vom Formular bis zum gespeicherten Bestand:
//   I1 sicher erlaubt   · interne Adresse aus der Allowlist  → Hinweis sichtbar, KEINE Sperre,
//                         Absenden geht durch, die Quelle steht danach im Bestand des Servers.
//   I2 sicher verboten  · öffentliche Adresse                → Absenden erlaubt, aber der SERVER
//                         weist ab (403), und es liegt hinterher KEINE Quelle im Bestand.
//   I3 sicher verboten  · ohne Adresse, ohne Anker           → hier weiss die Oberfläche es selbst
//                         (dieselbe Frage wie ko-routes.ts:1926-1930): harte Sperre, NULL Aufrufe.
//   I4 sicher erlaubt   · ohne Adresse, MIT Anker            → geht durch und wird gespeichert.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { SOURCE_ATTACH_HINT_KEYS } from "../../apps/web/src/lib/externalAttachGate";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type Prüfstand,
  anhangAuswahl,
  ausloesen,
  feldMitPlatzhalter,
  knopfMitText,
  montierenGegenServer,
  quellenAbschnitt,
  text,
  tippen,
  waehlen,
} from "./flaeche";

type App = ReturnType<typeof buildApp>;

// Genau die Konfiguration, mit der `tests/app/external-attach-gate-e2e.test.ts:43` arbeitet — die
// Allowlist ist Betreibersache und kommt aus der Umgebung, nie aus dem Code.
const INTERNE_ORIGINS = "intranet.werk.local, https://confluence.werk.local/";
const INTERNE_ADRESSE = "https://confluence.werk.local/pages/WN4711";
const OEFFENTLICHE_ADRESSE = "https://de.wikipedia.org/wiki/Dichtung_(Technik)";
const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

let vorherigeOrigins: string | undefined;
let stand: Prüfstand;

interface Aufbau {
  app: App;
  headers: Record<string, string>;
  koId: string;
}

/** Eine echte App mit Admin, Stufe `search_on_click` und einem echt hinterlegten Anhang. */
async function serverAufbauen(): Promise<Aufbau> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${anmeldung.json().token}` };

  const stufe = await app.inject({
    method: "PUT",
    url: "/api/external/policy",
    headers,
    payload: { stage: "search_on_click" },
  });
  expect(stufe.statusCode, "die Stufe liess sich nicht setzen").toBe(200);

  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      type: "best_practice",
      category: "Instandhaltung",
    },
  });
  const koId = ko.json().id as string;

  // Der Anker entsteht über die ECHTEN Routen — ein direkt geschriebener Anhang umginge die
  // Prüfung, die hier belegt werden soll.
  const objekt = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name: "Pruefbericht.pdf", mime: "application/pdf", data: PDF_DATA_URL },
  });
  expect(objekt.statusCode).toBeLessThan(300);
  const angehaengt = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: {
      action: "attach",
      attachment: {
        name: "Pruefbericht.pdf",
        mime: "application/pdf",
        objectId: objekt.json().id as string,
      },
    },
  });
  expect(angehaengt.statusCode).toBe(200);

  return { app, headers, koId };
}

/** Die Quellen, die WIRKLICH im Bestand des Servers liegen — gelesen, nicht angenommen. */
async function gespeicherteQuellen(
  aufbau: Aufbau,
): Promise<{ label: string; url: string | null }[]> {
  const ko = await aufbau.app.inject({
    method: "GET",
    url: `/api/kos/${aufbau.koId}`,
    headers: aufbau.headers,
  });
  return (ko.json().sources ?? []) as { label: string; url: string | null }[];
}

let aufbau: Aufbau;

const sperrhinweis = (): HTMLElement | null =>
  quellenAbschnitt(stand.container).querySelector("output");

const hinzufuegen = (): HTMLButtonElement => knopfMitText(stand.container, i18n.t("ko.sourceAdd"));

beforeEach(async () => {
  vorherigeOrigins = process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
  process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = INTERNE_ORIGINS;
  await i18n.changeLanguage("de");
  aufbau = await serverAufbauen();
  stand = await montierenGegenServer(aufbau.app, aufbau.headers, aufbau.koId);
});

afterEach(() => {
  stand.abbauen();
  if (vorherigeOrigins === undefined) {
    // `Reflect.deleteProperty` statt `delete`: die Ausnahme für `noDelete` in `biome.json:20-26`
    // gilt nur für `*.test.ts`, und ein `= undefined` schriebe in Node den STRING „undefined" in
    // die Umgebung — der Schlüssel muss wirklich weg, sonst hinge der nächste Test daran.
    Reflect.deleteProperty(process.env, "KLARWERK_INTERNAL_SOURCE_ORIGINS");
  } else {
    process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = vorherigeOrigins;
  }
});

describe("JOB 3133 · UX-22 R4 — die interne Adresse geht durch das Formular bis in den Bestand", () => {
  it("I0 · KALIBRIERUNG: die echte Fläche steht am echten Server, Stufe und Anhang sind da", async () => {
    expect(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceUrl"))).toBeTruthy();
    // Die Stufe kam über die echte Route — sonst stünde hier gar kein Grund.
    expect(
      sperrhinweis(),
      "ohne geladene Stufe misst alles Weitere ein leeres Blatt",
    ).not.toBeNull();
    // Der Anker ist wirklich am Objekt: das Auswahlfeld hat ihn.
    expect(anhangAuswahl(stand.container)).not.toBeNull();
  });

  it("I1 · interne Adresse: Grund sichtbar, KEINE Sperre — und die Quelle liegt danach im Bestand", async () => {
    await tippen(
      feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")),
      "Werksnorm WN-4711",
    );
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceUrl")), INTERNE_ADRESSE);

    // Der Hinweis BLEIBT — die Oberfläche kennt die Allowlist nicht und behauptet nichts anderes.
    const grund = sperrhinweis();
    expect(grund, "der vorsichtige Grund gehört weiterhin an die Fläche").not.toBeNull();
    expect(text(grund as HTMLElement)).toContain(
      i18n.t(SOURCE_ATTACH_HINT_KEYS["public-url"].body),
    );

    // Aber er ist eben nur ein Hinweis: der Knopf bleibt bedienbar.
    const knopf = hinzufuegen();
    expect(
      knopf.getAttribute("aria-disabled"),
      "aus Nichtwissen wurde wieder eine Ablehnung gemacht",
    ).toBe("false");
    expect(knopf.disabled).toBe(false);

    await ausloesen(knopf);

    const quellen = await gespeicherteQuellen(aufbau);
    expect(
      quellen.map((q) => q.label),
      "die vom Betreiber erlaubte interne Quelle kam nicht im Bestand an",
    ).toEqual(["Werksnorm WN-4711"]);
    expect(quellen[0]?.url).toBe(INTERNE_ADRESSE);
  });

  it("I2 · öffentliche Adresse: absendbar, aber der SERVER weist ab — nichts wird gespeichert", async () => {
    await tippen(
      feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")),
      "Dichtung (Technik)",
    );
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceUrl")), OEFFENTLICHE_ADRESSE);

    expect(sperrhinweis(), "auch hier steht der Grund").not.toBeNull();
    await ausloesen(hinzufuegen());

    // Die Grenze zieht die Stelle, die sie ziehen kann. Fail-closed bleibt fail-closed.
    expect(
      await gespeicherteQuellen(aufbau),
      "eine öffentliche Quelle ist auf dieser Stufe verboten und darf nicht im Bestand liegen",
    ).toEqual([]);
  });

  it("I3 · ohne Adresse und ohne Anker: hier WEISS die Oberfläche es — harte Sperre, kein Aufruf", async () => {
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")), "Handnotiz");

    const knopf = hinzufuegen();
    expect(knopf.getAttribute("aria-disabled")).toBe("true");
    // In der Tab-Folge bleibt er trotzdem (JOB-3126-Lehre).
    expect(knopf.disabled).toBe(false);
    expect(knopf.tabIndex).toBe(0);

    await ausloesen(knopf);
    expect(
      await gespeicherteQuellen(aufbau),
      "die sicher verbotene Aktion wurde trotzdem abgesetzt",
    ).toEqual([]);
  });

  it("I4 · ohne Adresse, MIT Anker: geht durch und wird gespeichert", async () => {
    await tippen(
      feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")),
      "Seite 4, Absatz 2",
    );
    const auswahl = anhangAuswahl(stand.container) as HTMLSelectElement;
    const ankerWert = [...auswahl.options].map((o) => o.value).find((v) => v.length > 0);
    expect(ankerWert, "das Objekt trägt keinen ankerfähigen Anhang").toBeTruthy();
    await waehlen(auswahl, ankerWert as string);

    expect(sperrhinweis(), "mit gültigem Anker gilt die Sperre nicht mehr").toBeNull();
    await ausloesen(hinzufuegen());

    const quellen = await gespeicherteQuellen(aufbau);
    expect(quellen.map((q) => q.label)).toEqual(["Seite 4, Absatz 2"]);
    // Der Anker ist Zulassungsnachweis, kein gespeichertes Feld — die Adresse bleibt leer.
    expect(quellen[0]?.url).toBeNull();
  });
});
