// ================================================================================================
// JOB 4146 · D3 — EINE ANTWORT HÄNGT AN EINEM VORHANDENEN BEITRAG, ODER SIE ENTSTEHT NICHT
// ================================================================================================
//
// DER VERTRAG: „Antworten verweisen auf einen vorhandenen Faden DESSELBEN zugänglichen Dokuments."
// Zwei Hälften, beide gemessen: der gültige Bezug wird zugeordnet (H1/H2), und ein unbekannter
// Bezug wird an der Route mit 400 abgewiesen, OHNE dass ein Beitrag entsteht (H3).
//
// WARUM DER BESTAND NACHGELESEN WIRD und nicht nur der Status: JOB 4141 R1 (LEHREN, 15.09.) — eine
// passende HTTP-Antwort allein belegt die Wirkung nicht. Ein 400, nach dem der Beitrag trotzdem im
// Objekt steht, wäre genau der Befund, den eine reine Statusprüfung durchgehen liesse.
import { describe, expect, it } from "vitest";
import { anlegen, beitraege, flaeche, konto, lesen, put } from "./huelle";

describe("JOB 4146 · D3 — Antwort am Beitrag", () => {
  it("ordnet die Antwort dem Beitrag zu, auf den sie sich bezieht", async () => {
    const { app, admin } = await flaeche();
    const eva = await konto(app, admin, "experte", "eva@klarwerk.test");
    const ko = await anlegen(app, admin);

    const frage = await put(app, admin, ko.id, {
      action: "comment",
      text: "Gilt das auch für Linie 3?",
    });
    expect(frage.statusCode).toBe(200);
    const frageId = beitraege(frage.json()).at(-1)?.id;
    expect(frageId).toBeTruthy();

    const antwort = await put(app, eva, ko.id, {
      action: "comment",
      text: "Ja, seit der Umrüstung im Mai.",
      replyTo: frageId,
    });

    expect(antwort.statusCode).toBe(200);
    const liste = beitraege(antwort.json());
    expect(liste).toHaveLength(2);
    expect(liste[0]?.replyTo).toBeUndefined();
    expect(liste[1]?.replyTo).toBe(frageId);
  });

  it("ein unbekanntes replyTo wird mit 400 und Grund abgewiesen — und es entsteht KEIN Beitrag", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);
    await put(app, admin, ko.id, { action: "comment", text: "Gilt das auch für Linie 3?" });
    const vorher = beitraege(await lesen(app, admin, ko.id));
    expect(vorher).toHaveLength(1);

    const antwort = await put(app, admin, ko.id, {
      action: "comment",
      text: "Antwort ins Leere.",
      replyTo: "gibt-es-nicht",
    });

    expect(antwort.statusCode).toBe(400);
    expect(String(antwort.json().message ?? "")).toMatch(/Beitrag/i);
    const nachher = beitraege(await lesen(app, admin, ko.id));
    expect(nachher).toEqual(vorher);
  });

  it("ein replyTo auf einen Beitrag eines FREMDEN Objekts entsteht nicht — der Faden bleibt am Dokument", async () => {
    const { app, admin } = await flaeche();
    const eins = await anlegen(app, admin, false, "Objekt eins");
    const zwei = await anlegen(app, admin, false, "Objekt zwei");
    const fremd = await put(app, admin, zwei.id, {
      action: "comment",
      text: "Beitrag am zweiten Objekt.",
    });
    const fremdeId = beitraege(fremd.json()).at(-1)?.id;

    const antwort = await put(app, admin, eins.id, {
      action: "comment",
      text: "Antwort über die Objektgrenze.",
      replyTo: fremdeId,
    });

    expect(antwort.statusCode).toBe(400);
    expect(beitraege(await lesen(app, admin, eins.id))).toEqual([]);
  });

  it("ein leeres replyTo ist ein Formfehler, kein stilles Weglassen", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);

    const antwort = await put(app, admin, ko.id, {
      action: "comment",
      text: "Text da.",
      replyTo: "   ",
    });

    expect(antwort.statusCode).toBe(400);
    expect(beitraege(await lesen(app, admin, ko.id))).toEqual([]);
  });
});
