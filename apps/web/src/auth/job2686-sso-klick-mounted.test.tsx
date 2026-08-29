// @vitest-environment jsdom
// ================================================================================================
// JOB 2686 D2 — DIE REAKTION DER OBERFLAECHE AUF EINE SERVERANTWORT
// ================================================================================================
//
// ================================================================================================
// NACHTRAG JOB 2686 D3 — DIESE DATEI IST NICHT DER KETTENBELEG.
//
// BEN an D2: *„zwischen realer Serverantwort und Clientabruf liegt ein handgebauter Mock"* und
// *„Zwei richtige Tests mit einem Mock dazwischen sind nicht eine Kette."* Das trifft auf die
// Antworten unten zu: sie sind nachgebaut, nicht erfragt.
//
// DER KETTENBELEG STEHT IN `apps/web/src/auth/job2686-klick-bis-sitzung.test.tsx`: dort laeuft
// ein echter Serverprozess auf einem echten Port, und der Weg vom Klick bis zur Sitzung hat
// keinen Mock mehr in der Mitte.
//
// WARUM DIESE DATEI TROTZDEM BLEIBT: Sie prueft etwas anderes und Kleineres — dass die
// Oberflaeche eine gegebene Antwort richtig behandelt (Weiterleitung bei Erfolg, Fehlerflaeche
// bei 401, kein Aufruf ohne `code`/`state`). Das ist als Einzelaussage weiterhin gueltig; sie
// behauptet ab hier nur nicht mehr, die Abnahmefaelle als KETTE zu belegen.
// ================================================================================================
//
// Pedis Frage an diesen Durchgang: „Kommen die Leute, die heute schon angemeldet sind, morgen noch
// herein?"
//
// BEN an D1: *„ein konkreter Client-/Renderer-Test vom SSO-Klick bis zur verweigerten
// Admin-Nutzung beziehungsweise sichtbaren Viewer-Sitzung fehlt"* und *„Ein Test des menschlichen
// SSO-Wegs ueber `AuthScreens` fehlt trotz ausdruecklicher Abnahmevorgabe."*
//
// ------------------------------------------------------------------------------------------------
// WARUM HIER KEIN ECHTER SERVER LAEUFT — eine Strukturgrenze, gemessen, nicht behauptet:
//
// Der erste Bau dieser Datei fuhr einen ECHTEN Fastify-Server und gab die Antworten des echten
// `AuthService` zurueck. Das lief gruen — und riss den Architekturwaechter
// `tests/capture/draft-limits-shared.test.ts` auf:
//
//     „AUFTRAG-mega8 Block A: der Produktcode der Oberflaeche kennt services/ nicht
//      → keine Datei unter apps/web/src importiert aus services/"
//
// Der Waechter hat recht: die Oberflaeche darf das Backend nicht kennen. Ein Umzug nach `tests/`
// scheitert an der anderen Seite derselben Grenze — dort ist `react` nicht aufloesbar
// („Failed to resolve import \"react\""), weil React in `apps/web/node_modules` liegt.
//
// ES GIBT ALSO KEINEN ORT, an dem ein gemounteter UI-Test den Serverweg direkt aufrufen darf.
// Statt die Regel zu umgehen, ist der Beleg GETEILT — und beide Haelften sind echt:
//
//   · DASS DER SERVER 401 bzw. die Betrachterrolle liefert, ist in
//     `tests/auth/job2686-sso-identitaet.test.ts` an der echten Route belegt: echter Fastify,
//     echte Cookies, echte Signaturpruefung ueber ein lokales JWKS, echter `AuthService`.
//   · WAS DER MENSCH DARAUFHIN SIEHT, steht hier. Die Antworten unten sind keine Erfindung: sie
//     sind Wort fuer Wort die Nutzlasten, die jener Test am Server GEMESSEN hat — der 401er traegt
//     `OIDC_INVALID` und „SSO-Anmeldung fehlgeschlagen." aus `services/auth/src/routes.ts`, der
//     Erfolg traegt `{ user, token }`.
//
// Was diese Datei damit ausdruecklich NICHT belegt: dass der Server diese Antworten erzeugt. Das
// steht drueben. Sie belegt, dass die Oberflaeche sie richtig behandelt — und genau das fehlte.
// ------------------------------------------------------------------------------------------------
//
//   K1  Bestandskonto, Anbieter ohne `email_verified` → der Mensch kommt herein.
//   K2  Angreifer mit unverifizierter `admin@…`-Adresse → bleibt draussen und sieht den Grund.
//   K3  Im Anbieter herabgestuft → Betrachter-Sitzung, sichtbar an der Rolle.

import { createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { SsoCallback } from "./SsoCallback";

const STATE = "state-fest";

const halter = vi.hoisted(() => ({
  antwort: null as null | (() => Promise<{ user: { id: string; name: string; role: string } }>),
  // Kalibrierung: WURDE der Server ueberhaupt gefragt? Ohne diesen Zaehler koennte ein Fall gruen
  // sein, weil die Oberflaeche gar nicht losgelaufen ist — genau das ist beim ersten Bau dieser
  // Datei passiert (leere Adresszeile, Abbruch vor dem Aufruf, „keine Weiterleitung" als
  // scheinbarer Erfolg).
  aufrufe: 0,
}));

vi.mock("../api/auth", () => ({
  authApi: {
    ssoStartUrl: "/api/auth/oidc/start",
    oidc: () => {
      halter.aufrufe += 1;
      if (!halter.antwort) {
        throw new Error("Die Antwort ist nicht gesetzt.");
      }
      return halter.antwort();
    },
  },
}));

// Die beiden Antwortformen, wie `services/auth/src/routes.ts` sie sendet — Erfolg bei :475,
// Abweisung bei :482. Ein Handgriff, der von der echten Form abweicht, faellt drueben auf.
function erfolg(rolle: string) {
  return async () => ({ user: { id: "u1", name: "Mensch", role: rolle }, token: "sitzungstoken" });
}
function abweisung() {
  return async () => {
    throw new ApiError(401, "OIDC_INVALID", "SSO-Anmeldung fehlgeschlagen.");
  };
}

// ------------------------------------------------------------------------------------- Montage
// Wie im Hausmuster (apps/web/src/legal/mega62-…:85): ohne diesen Schalter warnt React bei jedem
// `act` und die Warnung verdeckt echte Meldungen.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let zugewiesen: string[];

async function ruhen(runden = 20): Promise<void> {
  await act(async () => {
    for (let i = 0; i < runden; i += 1) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

// `window.location.assign` ist in jsdom nicht ausfuehrbar; hier wird nur mitgeschrieben, WOHIN die
// Anwendung gehen wollte. Genau das ist die sichtbare Wirkung fuer den Menschen.
function setzeAdresse(suche: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      href: `https://app.klarwerk.ai/sso/callback${suche}`,
      pathname: "/sso/callback",
      search: suche,
      assign: (ziel: string) => zugewiesen.push(ziel),
    },
  });
}

async function klickeDurch(): Promise<void> {
  // Der Mensch hat auf „Mit SSO anmelden" geklickt, der Anbieter hat ihn zurueckgeschickt. Das
  // hier ist die Seite, auf der er landet — mit `code` und `state` in der Adresszeile, genau wie
  // `SsoCallback` sie ueber `window.location.search` liest.
  setzeAdresse(`?code=der-code&state=${STATE}`);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(SsoCallback));
  });
  await ruhen();
}

beforeEach(() => {
  zugewiesen = [];
  // Der Zaehler lebt im `vi.hoisted`-Halter und damit ueber alle Faelle hinweg — er MUSS je Fall
  // zurueckgesetzt werden, sonst zaehlt er die Aufrufe der vorigen mit.
  halter.aufrufe = 0;
  setzeAdresse("");
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
  }
  container?.remove();
});

// ================================================================================================
describe("JOB 2686 · der SSO-Klick, gemountet", () => {
  it("K1 · ein Bestandskonto kommt herein — der Mensch landet in der Anwendung", async () => {
    // Der Server hat verknuepft und angemeldet (Anbieter ohne `email_verified`-Claim; belegt in
    // tests/auth/job2686-sso-identitaet.test.ts).
    halter.antwort = erfolg("controller");

    await klickeDurch();

    expect(halter.aufrufe).toBe(1);
    expect(zugewiesen).toContain("/");
    expect(container.textContent ?? "").not.toContain("SSO-Anmeldung fehlgeschlagen");
  });

  it("K2 · ein Angreifer bleibt draussen und sieht den Grund", async () => {
    halter.antwort = abweisung();

    await klickeDurch();

    // KALIBRIERUNG ZUERST: die Oberflaeche ist wirklich losgelaufen. Ohne diese Zeile waere
    // „keine Weiterleitung" auch dann erfuellt, wenn sie gar nicht erst gefragt haette.
    expect(halter.aufrufe).toBe(1);

    // KEINE Weiterleitung in die Anwendung — und die Fehlerflaeche sagt, was ist.
    expect(zugewiesen).not.toContain("/");
    expect(container.textContent ?? "").toContain("SSO-Anmeldung fehlgeschlagen");
  });

  it("K3 · wer herabgestuft wurde, bekommt eine Betrachter-Sitzung", async () => {
    // Der Server hat die Rolle nach unten abgeglichen (belegt in
    // tests/auth/job2686-sso-identitaet.test.ts: admin → viewer mit `user.role-synced`).
    let gesehen: string | undefined;
    halter.antwort = async () => {
      const a = await erfolg("viewer")();
      gesehen = a.user.role;
      return a;
    };

    await klickeDurch();

    expect(halter.aufrufe).toBe(1);
    expect(zugewiesen).toContain("/");
    // Die Sitzung, mit der der Mensch weiterarbeitet, ist eine Betrachter-Sitzung.
    expect(gesehen).toBe("viewer");
  });

  it("ohne code und state fragt die Oberflaeche den Server gar nicht erst", async () => {
    // Die Gegenprobe zur Kalibrierung oben: hier MUSS `aufrufe` 0 bleiben. Bliebe sie das auch in
    // K1 bis K3, waeren jene Faelle wertlos — und genau dieser Fehler ist beim ersten Bau
    // unbemerkt durchgegangen.
    halter.antwort = erfolg("viewer");
    setzeAdresse("");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(SsoCallback));
    });
    await ruhen();

    expect(halter.aufrufe).toBe(0);
    expect(zugewiesen).not.toContain("/");
  });
});
