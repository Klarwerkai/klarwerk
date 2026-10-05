// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME m365-anmeldung · ABGELEHNTES ANMELDE-FENSTER — KEIN TOTES WARTEN IM FREMDEN RAHMEN
// ================================================================================================
//
// DER BEFUND AM BASISSTAND (61a09266): öffnete Word den Office-Dialog NICHT (Rückfrage ignoriert,
// vom Browser verhindert — `displayDialogAsync` ruft mit `failed` zurück oder wirft), fiel das
// Seitenfenster auf `window.open` zurück und wartete bis zu fünf Minuten auf die Anmeldung. In
// Word für das Web kann dieses Warten nie grün werden: das Rückfallfenster hat kein
// `messageParent`, und das Lax-Cookie reist nicht in den Rahmen fremder Herkunft. Der Mensch stand
// also fünf Minuten vor „Warte auf die Anmeldung …" — und las danach einen Satz über einen Rahmen,
// obwohl die eigentliche Ursache das abgelehnte Fenster war.
//
// DIESER FALL MISST:
//   A1  fremder Rahmen + abgelehnter Dialog: sofort der Ursachensatz, kein Rückfallfenster, kein
//       Warten, Anmelden wieder frei
//   A2  fremder Rahmen + synchron werfender Dialog: derselbe Ausgang
//   A3  GEGENPROBE ohne Rahmenlage (Mac-Word, Browsertab): das Rückfallfenster bleibt der Weg
//   A4  der Satz steht in allen drei Sprachen, je Sprache eigen, ohne Cookie-Rat
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Dialoglauf, anmeldenDruecken, fahreSeitenfenster } from "./seitenfenster";

let lauf: Dialoglauf | null = null;
let rahmenGestellt = false;

afterEach(() => {
  lauf?.aufraeumen();
  lauf = null;
  if (rahmenGestellt) {
    Reflect.deleteProperty(window, "parent");
    rahmenGestellt = false;
  }
  vi.restoreAllMocks();
});

/** Wie in S6: ein Elternrahmen mit anderer Herkunft (im echten Host wirft der Zugriff). */
function stelleFremdenRahmen(): void {
  Object.defineProperty(window, "parent", {
    value: { location: { origin: "https://word-edit.officeapps.live.com" } },
    configurable: true,
    writable: true,
  });
  rahmenGestellt = true;
}

interface OfficeUiFake {
  context: { ui?: unknown };
}

/** Den Dialog des Fahrstands durch einen ersetzen, den Word nicht öffnet. */
function dialogAbgelehnt(art: "rueckruf" | "wurf"): { versuche: () => number } {
  let versuche = 0;
  const office = (globalThis as unknown as { Office: OfficeUiFake }).Office;
  office.context.ui = {
    displayDialogAsync: (
      _url: string,
      _optionen: unknown,
      rueckruf: (r: { status: string; error?: { code: number } }) => void,
    ): void => {
      versuche += 1;
      if (art === "wurf") {
        throw new Error("Dialog nicht verfügbar");
      }
      // 12009: „The user chose to ignore the dialog box." (Office-Dialog-API)
      rueckruf({ status: "failed", error: { code: 12009 } });
    },
  };
  return { versuche: () => versuche };
}

function starte(): Dialoglauf {
  return fahreSeitenfenster({
    "/api/auth/me": () => ({ status: 401, body: { error: "INVALID_CREDENTIALS" } }),
  });
}

async function ablehnenImRahmen(art: "rueckruf" | "wurf"): Promise<{
  gefahren: Dialoglauf;
  versuche: () => number;
  oeffnen: ReturnType<typeof vi.fn>;
}> {
  stelleFremdenRahmen();
  const gefahren = starte();
  const oeffnen = vi.fn(() => null);
  vi.spyOn(window, "open").mockImplementation(oeffnen);
  const { versuche } = dialogAbgelehnt(art);
  await gefahren.panel.flush();
  anmeldenDruecken(gefahren);
  await gefahren.panel.flush();
  return { gefahren, versuche, oeffnen };
}

describe("Aufnahme m365-anmeldung · abgelehntes Anmelde-Fenster", () => {
  it("A1 — fremder Rahmen, Dialog abgelehnt: Ursachensatz sofort, kein Rückfallfenster", async () => {
    const { gefahren, versuche, oeffnen } = await ablehnenImRahmen("rueckruf");
    lauf = gefahren;
    const panel = gefahren.panel;

    expect(versuche()).toBe(1);
    expect(oeffnen).not.toHaveBeenCalled();
    expect(panel.text("#session-status")).toBe(panel.t("loginDialogDeclined"));
    expect(panel.text("#session-status")).not.toBe(panel.t("loginWaiting"));
    // Kein toter Zustand: der Anmeldeknopf ist sichtbar und wieder frei.
    expect(panel.q("#login-btn")?.className).toBe("primary");
    expect(panel.q("#login-btn")?.disabled).toBe(false);
    // Kein Warten läuft weiter: kein weiterer Sitzungsabruf nach dem Druck.
    const vorher = gefahren.spur.filter((s) => s.url.includes("/api/auth/me")).length;
    await new Promise((fertig) => setTimeout(fertig, 50));
    await panel.flush();
    expect(gefahren.spur.filter((s) => s.url.includes("/api/auth/me")).length).toBe(vorher);
  });

  it("A2 — fremder Rahmen, Dialog wirft synchron: derselbe Ausgang", async () => {
    const { gefahren, oeffnen } = await ablehnenImRahmen("wurf");
    lauf = gefahren;
    expect(oeffnen).not.toHaveBeenCalled();
    expect(gefahren.panel.text("#session-status")).toBe(gefahren.panel.t("loginDialogDeclined"));
    expect(gefahren.panel.q("#login-btn")?.disabled).toBe(false);
  });

  it("A3 — GEGENPROBE ohne Rahmenlage: das Rückfallfenster bleibt der Weg", async () => {
    lauf = starte();
    const oeffnen = vi.fn((_url?: string | URL) => null);
    vi.spyOn(window, "open").mockImplementation(oeffnen);
    dialogAbgelehnt("rueckruf");
    await lauf.panel.flush();
    anmeldenDruecken(lauf);
    await lauf.panel.flush();

    expect(oeffnen).toHaveBeenCalledTimes(1);
    expect(String(oeffnen.mock.calls[0]?.[0] ?? "")).toContain("/word-addin/anmeldung.html");
    // `window.open` gab null zurück → der bisherige Popup-Satz, nicht der neue.
    expect(lauf.panel.text("#session-status")).toBe(lauf.panel.t("loginPopupBlocked"));
  });

  it("A4 — der Satz steht in allen drei Sprachen, je Sprache eigen, ohne Cookie-Rat", async () => {
    lauf = starte();
    await lauf.panel.flush();
    const gesehen = new Set<string>();
    for (const sprache of ["de", "en", "nl"]) {
      lauf.panel.setLang(sprache);
      const satz = lauf.panel.t("loginDialogDeclined");
      expect(satz, sprache).not.toBe("loginDialogDeclined");
      expect(satz.length, sprache).toBeGreaterThan(40);
      expect(satz.toLowerCase(), sprache).not.toContain("cookie");
      gesehen.add(satz);
    }
    expect(gesehen.size).toBe(3);
  });
});
