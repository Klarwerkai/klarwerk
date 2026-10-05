// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME m365-anmeldung · SITZUNGSABLAUF IM SEITENFENSTER — WAS DER MENSCH SIEHT, UND WIE ES
// WEITERGEHT
// ================================================================================================
//
// DER BEFUND (Ben, Runde 2): der Ablauf einer Sitzung war nur als Kennwort-Reset gemessen, und
// nicht an der Fläche. Dieser Fall fährt das AUSGELIEFERTE Seitenfenster (`taskpane.html`) im
// Office-Dialog-Fall (Word für das Web: Zugang nur über die Übergabe, nie über ein Cookie):
//   A1  Anmelden über die Übergabe, Markierung senden → „Entwurf angelegt" (bestätigte Arbeit).
//   A2  Die Sitzung läuft am Server ab (jede Anfrage mit dem Schlüssel → 401). Beim nächsten
//       Senden steht der verständliche Satz „Nicht angemeldet …" mit GENAU einem Knopf
//       „Anmelden", nichts wird als angelegt behauptet, und der tote Schlüssel reist nicht weiter.
//   A3  Der Knopf am Satz öffnet das Anmelde-Fenster; die Übergabe bringt einen NEUEN Schlüssel,
//       und dieselbe Markierung wird mit ihm angelegt.
// Der Server-Teil desselben Ablaufs — die Frist läuft wirklich ab, und der erste Entwurf ist
// danach unverändert da — steht in `sitzungsablauf-am-draht.test.ts`.
import { afterEach, describe, expect, it } from "vitest";
import {
  type Dialoglauf,
  anmeldenDruecken,
  fahreSeitenfenster,
  uebergabeNachricht,
} from "./seitenfenster";

const ALT = "schluessel-vor-dem-ablauf";
const NEU = "schluessel-nach-der-wiederanmeldung";

let lauf: Dialoglauf | null = null;

afterEach(() => {
  lauf?.aufraeumen();
  lauf = null;
});

interface Server {
  gueltig: Set<string>;
  angelegt: string[];
  naechsterSchluessel: string;
}

function istGueltig(server: Server, auth: string | undefined): boolean {
  return auth !== undefined && server.gueltig.has(auth.replace(/^Bearer /, ""));
}

/**
 * Ein Server, der NUR den Schlüssel kennt (kein Cookie im fremden Rahmen). Der Fahrstand liest den
 * `Authorization`-Kopf in `spur` mit; die Antworten entscheiden über den zuletzt gesehenen Kopf.
 */
function starte(): { lauf: Dialoglauf; server: Server } {
  const server: Server = { gueltig: new Set(), angelegt: [], naechsterSchluessel: ALT };
  let gefahren: Dialoglauf | null = null;
  const letzterKopf = (): string | undefined => gefahren?.spur.at(-1)?.authorization;
  gefahren = fahreSeitenfenster({
    "/api/auth/me": () =>
      istGueltig(server, letzterKopf())
        ? { status: 200, body: { id: "u-1", name: "Anna", role: "experte" } }
        : { status: 401, body: { error: "INVALID_CREDENTIALS" } },
    "/api/auth/office-handover/redeem": () => {
      const schluessel = server.naechsterSchluessel;
      server.gueltig.add(schluessel);
      return { status: 200, body: { token: schluessel, user: { id: "u-1", name: "Anna" } } };
    },
    "/api/drafts": () => {
      if (!istGueltig(server, letzterKopf())) {
        return { status: 401, body: { error: "UNAUTHORIZED" } };
      }
      const id = `draft-${server.angelegt.length + 1}`;
      server.angelegt.push(id);
      return { status: 201, body: { id } };
    },
  });
  return { lauf: gefahren, server };
}

function draftPosts(gefahren: Dialoglauf): { authorization: string | undefined }[] {
  return gefahren.spur.filter((a) => a.url === "/api/drafts" && a.methode === "POST");
}

describe("Aufnahme m365-anmeldung · Sitzungsablauf im Seitenfenster (Word für das Web)", () => {
  it("A1–A3 — Ablauf zeigt einen verständlichen Satz, Wiederanmeldung im Panel, Arbeit geht weiter", async () => {
    const gestartet = starte();
    lauf = gestartet.lauf;
    const { server } = gestartet;
    const panel = lauf.panel;
    await panel.flush();

    // A1 — anmelden über die Übergabe und bestätigte Arbeit anlegen.
    anmeldenDruecken(lauf);
    await panel.flush();
    expect(lauf.nachricht(uebergabeNachricht("code-1"))).toBe(true);
    await panel.flush();
    expect(panel.text("#session-status")).toBe(panel.t("sessionOk", { name: "Anna" }));
    panel.sendSelection();
    await panel.flush();
    expect(server.angelegt).toEqual(["draft-1"]);
    expect(draftPosts(lauf).at(-1)?.authorization).toBe(`Bearer ${ALT}`);
    expect(panel.q("#open-link")?.href).toContain("draft=draft-1");

    // A2 — die Sitzung läuft am Server ab.
    server.gueltig.clear();
    panel.sendSelection();
    await panel.flush();
    expect(server.angelegt, "nach dem Ablauf wurde nichts angelegt").toEqual(["draft-1"]);
    expect(panel.text("#send-status")).toBe(panel.t("sendAuth"));
    expect(panel.q("#send-status-btn")?.className).toBe("ghost capture-knopf");
    expect(panel.text("#send-status-btn")).toBe(panel.t("captureLogin"));
    expect(panel.q("#capture-ergebnis")?.className, "kein vorgetäuschter Erfolg").toBe("hidden");
    // Die Sitzungszeile sagt es auch — kein toter Zustand, der Anmeldeknopf ist frei.
    expect(panel.text("#session-status")).toBe(panel.t("sessionOff"));
    expect(panel.q("#login-btn")?.disabled).toBe(false);
    // Der abgelaufene Schlüssel reist nicht weiter: nach dem 401 trägt kein Abruf ihn mehr.
    const posts = lauf.spur
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.url === "/api/drafts" && a.methode === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[1]?.a.authorization, "der abgelehnte Versuch trug den alten Schlüssel").toBe(
      `Bearer ${ALT}`,
    );
    const nachDem401 = lauf.spur.slice((posts[1]?.i ?? lauf.spur.length) + 1);
    expect(nachDem401.length, "Kalibrierung: nach dem 401 gab es Abrufe").toBeGreaterThan(0);
    for (const abruf of nachDem401) {
      expect(abruf.authorization, abruf.url).not.toBe(`Bearer ${ALT}`);
    }

    // A3 — Wiederanmeldung über den Knopf am Satz, dieselbe Markierung geht mit dem neuen Schlüssel.
    server.naechsterSchluessel = NEU;
    const geoeffnetVorher = lauf.geoeffnet.length;
    panel.q("#send-status-btn")?.click();
    await panel.flush();
    expect(lauf.geoeffnet.length).toBe(geoeffnetVorher + 1);
    expect(lauf.geoeffnet.at(-1)).toMatch(/\/word-addin\/anmeldung\.html$/);
    expect(panel.text("#session-status")).toBe(panel.t("loginWaiting"));
    expect(lauf.nachricht(uebergabeNachricht("code-2"))).toBe(true);
    await panel.flush();
    expect(panel.text("#session-status")).toBe(panel.t("sessionOk", { name: "Anna" }));
    panel.sendSelection();
    await panel.flush();
    expect(server.angelegt).toEqual(["draft-1", "draft-2"]);
    expect(draftPosts(lauf).at(-1)?.authorization).toBe(`Bearer ${NEU}`);
    expect(panel.q("#open-link")?.href).toContain("draft=draft-2");
  });
});
