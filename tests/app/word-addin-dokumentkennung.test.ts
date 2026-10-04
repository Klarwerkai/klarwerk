// @vitest-environment jsdom
// ================================================================================================
// R-0169 (Nacharbeit 8, bens F1) — DIE DOKUMENTKENNUNG IM WORD-PANEL, AUCH WENN DAS SPEICHERN SCHEITERT.
// ================================================================================================
//
// Gefahren wird das AUSGELIEFERTE `apps/web/public/word-addin/taskpane.html` über die vorhandene
// Panel-Fixture (`tests/app/klara-panel-fixture.ts`): Rumpf und Skript werden aus der Datei
// geschnitten und wirklich ausgeführt. Der Office-Fake bekommt Dokumenteinstellungen
// (`dokumentEinstellungen`), deren `saveAsync` gezielt scheitert oder gelingt.
//
// WAS DAS BELEGT: dass das Panel das Ergebnis des Speicherns AUSWERTET, eine unvollständige
// Bindung sichtbar meldet, eine Wiederholung dieselbe Serverkennung trägt (statt still ein neues
// Dokument zu senden), und dass eine erfolgreich gespeicherte Kennung beim nächsten Öffnen wieder
// gesendet wird. WAS ES NICHT BELEGT: dass echtes Word die Einstellung im .docx behält und nach
// Schliessen und Wiederöffnen herausgibt — das bleibt eine Prüfung am echten Word-Host.
import { afterEach, describe, expect, it } from "vitest";
import {
  type FakeDokumentEinstellungen,
  type KlaraPanel,
  createKlaraPanel,
  reply,
} from "./klara-panel-fixture";

const MARKIERUNG = "Erster Absatz der Markierung.\nZweiter Absatz der Markierung.";
const SCHLUESSEL = "klarwerkDokumentId";

let panel: KlaraPanel | null = null;
afterEach(() => {
  panel?.restore();
  panel = null;
  Reflect.deleteProperty(globalThis, "Word");
});

/**
 * Ein Server-Ersatz für `POST /api/drafts`: ohne mitgebrachte Kennung vergibt er eine neue (wie
 * `DokumentaktenService.festschreiben`), mit Kennung bleibt er bei ihr.
 */
function draftServer() {
  let vergeben = 0;
  return (_url: string, init: Record<string, unknown> | undefined) => {
    const rumpf = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
      dokumentId?: string;
    };
    vergeben += 1;
    const dokumentId = rumpf.dokumentId ?? `dok-${vergeben}`;
    return reply(201, {
      id: `entwurf-${vergeben}`,
      dokumentHerkunft: { dokumentId, fassung: vergeben, fassungId: `fassung-${vergeben}` },
    });
  };
}

function oeffnen(einstellungen?: FakeDokumentEinstellungen): KlaraPanel {
  panel = createKlaraPanel({
    selectionText: MARKIERUNG,
    routes: {
      "/api/categories": reply(200, { categories: [] }),
      "/api/drafts": draftServer(),
    },
    ...(einstellungen ? { dokumentEinstellungen: einstellungen } : {}),
  });
  return panel;
}

async function senden(p: KlaraPanel): Promise<void> {
  p.sendSelection();
  await p.flush();
}

function gesendeteKennungen(p: KlaraPanel): Array<unknown> {
  return p.calls
    .filter((c) => c.method === "POST" && c.url === "/api/drafts")
    .map((c) => (JSON.parse(c.body ?? "{}") as { dokumentId?: unknown }).dokumentId);
}

describe("R-0169 · Word-Panel: Dokumentkennung speichern, Fehlschlag melden, Kennung halten", () => {
  it("F1 · saveAsync scheitert: Bindung erkennbar unvollständig, die Wiederholung trägt DIESELBE Serverkennung", async () => {
    const gespeichert: Record<string, unknown> = {};
    const p = oeffnen({ speichernScheitert: true, gespeichert });
    await p.flush();
    p.setTab("capture");
    await p.flush();

    await senden(p);
    expect(p.text("#send-status"), "der Speicherfehler blieb unbemerkt").toBe(
      p.t("sendDocIdUnsaved"),
    );
    expect(gespeichert[SCHLUESSEL], "ein gescheitertes Speichern hat etwas hinterlassen").toBe(
      undefined,
    );

    await senden(p);
    expect(
      gesendeteKennungen(p),
      "die Wiederholung ging ohne die vergebene Kennung hinaus",
    ).toEqual([undefined, "dok-1"]);
    expect(p.text("#send-status")).toBe(p.t("sendDocIdUnsaved"));
  });

  it("F1 · ohne Einstellungs-Schnittstelle: ebenfalls gemeldet und in der Sitzung gehalten", async () => {
    const p = oeffnen();
    await p.flush();
    p.setTab("capture");
    await p.flush();
    await senden(p);
    expect(p.text("#send-status")).toBe(p.t("sendDocIdUnsaved"));
    await senden(p);
    expect(gesendeteKennungen(p)).toEqual([undefined, "dok-1"]);
  });

  it("Positiv · saveAsync gelingt: Kennung gespeichert, keine Warnung, nach dem Wiederöffnen wieder gesendet", async () => {
    const gespeichert: Record<string, unknown> = {};
    const erst = oeffnen({ gespeichert });
    await erst.flush();
    erst.setTab("capture");
    await erst.flush();
    await senden(erst);
    expect(gespeichert[SCHLUESSEL]).toBe("dok-1");
    expect(erst.text("#send-status")).not.toBe(erst.t("sendDocIdUnsaved"));
    erst.restore();
    panel = null;

    // „Wiederöffnen": ein neues Panel über einem Dokument, das den gespeicherten Stand mitbringt.
    const wieder = oeffnen({ werte: { ...gespeichert } });
    await wieder.flush();
    wieder.setTab("capture");
    await wieder.flush();
    await senden(wieder);
    expect(gesendeteKennungen(wieder)).toEqual(["dok-1"]);
  });
});
