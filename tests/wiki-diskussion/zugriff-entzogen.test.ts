// ================================================================================================
// JOB 4146 · VERTRAG FALL 4 (aus HINWEIS.md, Runde 1) — DER FADEN VERRÄT NICHTS
// ================================================================================================
//
// DER VERTRAG: „Entzogener Zugriff: weder Faden, Zitat, Benachrichtigung noch KI-Eingabe verraten
// geschützten Inhalt. Antworten verweisen nur auf einen vorhandenen Faden DESSELBEN zugänglichen
// Dokuments; die Route prüft den Zugriff auf das Dokument, bevor sie Fadeninhalt liefert oder
// annimmt."
//
// DER MECHANISMUS IST DA UND WIRD NICHT VERDOPPELT: `ZIELOBJEKT_TOR` (ko-routes.ts) stellt EIN Tor
// vor den Switch — erst WER, dann OB SICHTBAR, dann WAS ER DARF (mega80 A). Dieser Fall misst, dass
// die ZWEI NEUEN Aktionen dieses Auftrags dort eingetragen sind und nichts durchlassen. Ohne ihn
// wäre „kein Sonderloch" eine Behauptung — der Wächter `tests/security/mega80-…` prüft die Form der
// Tabelle, dieser Fall prüft den Inhalt des Fadens.
import { describe, expect, it } from "vitest";
import { anlegen, beitraege, flaeche, konto, lesen, put } from "./huelle";

const GEHEIM = "GEHEIMER-FADENINHALT-JOB4146";

describe("JOB 4146 · Fall 4 — entzogener Zugriff", () => {
  it("ein Fremder bekommt am vertraulichen Objekt 404 für jede Diskussionsaktion — ohne Fadeninhalt", async () => {
    const { app, admin } = await flaeche();
    const fremd = await konto(app, admin, "experte", "fremd@klarwerk.test");
    const ko = await anlegen(app, admin, true);

    const frage = await put(app, admin, ko.id, { action: "comment", text: GEHEIM });
    expect(frage.statusCode).toBe(200);
    const frageId = beitraege(frage.json()).at(-1)?.id ?? "";
    expect(frageId).not.toBe("");

    const versuche = [
      { action: "comment", text: "Antwort von aussen.", replyTo: frageId },
      { action: "comment-resolve", commentId: frageId },
      { action: "comment-reopen", commentId: frageId },
    ];

    // Erst sammeln, dann urteilen — eine Schleife mit sofortigem `expect` verschwiege die übrigen.
    const befund: Record<string, string> = {};
    for (const payload of versuche) {
      const res = await put(app, fremd, ko.id, payload);
      befund[String(payload.action)] = res.body.includes(GEHEIM)
        ? `${res.statusCode} MIT FADENINHALT`
        : `${res.statusCode}`;
    }
    expect(befund).toEqual({ comment: "404", "comment-resolve": "404", "comment-reopen": "404" });
  });

  it("und der Faden steht danach unverändert da — die 404 haben nichts angenommen", async () => {
    const { app, admin } = await flaeche();
    const fremd = await konto(app, admin, "experte", "fremd@klarwerk.test");
    const ko = await anlegen(app, admin, true);
    const frage = await put(app, admin, ko.id, { action: "comment", text: GEHEIM });
    const frageId = beitraege(frage.json()).at(-1)?.id ?? "";
    const vorher = beitraege(await lesen(app, admin, ko.id));

    await put(app, fremd, ko.id, {
      action: "comment",
      text: "Antwort von aussen.",
      replyTo: frageId,
    });
    await put(app, fremd, ko.id, { action: "comment-resolve", commentId: frageId });

    expect(beitraege(await lesen(app, admin, ko.id))).toEqual(vorher);
  });

  it("am INTERNEN Objekt laufen dieselben Aktionen desselben Nutzers durch — die 404 kommt von der Stufe", async () => {
    const { app, admin } = await flaeche();
    const fremd = await konto(app, admin, "experte", "fremd@klarwerk.test");
    const ko = await anlegen(app, admin, false);
    const frage = await put(app, admin, ko.id, { action: "comment", text: "Offene Frage." });
    const frageId = beitraege(frage.json()).at(-1)?.id ?? "";

    const antwort = await put(app, fremd, ko.id, {
      action: "comment",
      text: "Antwort von der Kollegin.",
      replyTo: frageId,
    });
    const geklaert = await put(app, fremd, ko.id, {
      action: "comment-resolve",
      commentId: frageId,
    });
    const offen = await put(app, fremd, ko.id, { action: "comment-reopen", commentId: frageId });

    expect([antwort.statusCode, geklaert.statusCode, offen.statusCode]).toEqual([200, 200, 200]);
  });
});
