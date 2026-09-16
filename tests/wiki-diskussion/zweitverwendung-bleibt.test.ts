// ================================================================================================
// JOB 4146 · REGRESSIONSFALL ZWEITVERWENDUNG (HINWEIS.md, Nachtrag 2)
// ================================================================================================
//
// DIE KOMMENTARLISTE IST NICHT NUR DIE DISKUSSION. Sie trägt heute ZWEI weitere Fachvorgänge, und
// beide gehen durch dieselbe Route `action: "comment"`:
//
//   · das PRÜF-FEEDBACK bei Gelb/Rot — geschrieben mit `buildValidationFeedback`
//     (`BibliothekLesen.tsx:450`, `Validation.tsx:544`), gelesen mit `latestValidationFeedback`
//     (`validationFeedback.ts:60`, gerufen in `BibliothekLesen.tsx:1169`);
//   · die QUELLENMELDUNG „Beitrag melden" — geschrieben mit `formatSourceComment`
//     (`MehrAbschnitte.tsx:395`), gelesen mit `parseSourceComment`.
//
// WÜRDE DIESER AUFTRAG EIN PFLICHTFELD EINFÜHREN oder den Text unterwegs anfassen, verlören beide
// Träger ihre Bedeutung — leise, denn ihre Erkennung hängt an einem PRÄFIX im Text, nicht an einem
// Feld. Dieser Fall misst sie gegen die echte Route, NACHDEM die neuen Felder im Spiel sind.
import { describe, expect, it } from "vitest";
import {
  SOURCE_CONTRIBUTION_PREFIX,
  SOURCE_REFERENCE_PREFIX,
  formatSourceComment,
} from "../../apps/web/src/lib/sourceContribution";
import {
  buildValidationFeedback,
  latestValidationFeedback,
} from "../../apps/web/src/lib/validationFeedback";
import { anlegen, beitraege, flaeche, lesen, put } from "./huelle";

describe("JOB 4146 · Zweitverwendung der Kommentare", () => {
  it("Prüf-Feedback bleibt schreib- und lesbar — auch neben Antwort, Fassungsbezug und Klärungsstand", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);

    const feedback = buildValidationFeedback("warn", "Die zweite Quelle fehlt noch.");
    const geschrieben = await put(app, admin, ko.id, { action: "comment", text: feedback });
    expect(geschrieben.statusCode).toBe(200);

    // Ein vollständiger Diskussionsfaden DANEBEN: Frage, Antwort, erledigt.
    const frage = await put(app, admin, ko.id, {
      action: "comment",
      text: "Gilt das für Linie 3?",
    });
    const frageId = beitraege(frage.json()).at(-1)?.id ?? "";
    await put(app, admin, ko.id, { action: "comment", text: "Ja.", replyTo: frageId });
    await put(app, admin, ko.id, { action: "comment-resolve", commentId: frageId });

    const stand = await lesen(app, admin, ko.id);
    const gelesen = latestValidationFeedback(beitraege(stand));
    expect(gelesen).not.toBeNull();
    expect(gelesen?.verdict).toBe("warn");
    expect(gelesen?.body).toBe("Die zweite Quelle fehlt noch.");
    // Der Träger ist ein gewöhnlicher Wurzelbeitrag geblieben: kein Bezug, kein Klärungsstand.
    const traeger = beitraege(stand)[0];
    expect(traeger?.text).toBe(feedback);
    expect(traeger?.replyTo).toBeUndefined();
    expect(traeger?.resolution).toBeUndefined();
  });

  it("die Quellenmeldung bleibt unverändert lesbar", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);
    const text = formatSourceComment({
      contribution: "Der Wert stammt aus der Betriebsanleitung.",
      source: "BA-2026, Seite 14",
    });

    const geschrieben = await put(app, admin, ko.id, { action: "comment", text });
    expect(geschrieben.statusCode).toBe(200);

    const traeger = beitraege(await lesen(app, admin, ko.id))[0];
    // Zeichen für Zeichen: die Erkennung dieses Trägers hängt an seinen zwei Präfixzeilen, nicht an
    // einem Feld — ein unterwegs beschnittener oder umgebauter Text wäre still unlesbar.
    expect(traeger?.text).toBe(text);
    expect((traeger?.text ?? "").split("\n")).toEqual([
      `${SOURCE_CONTRIBUTION_PREFIX} Der Wert stammt aus der Betriebsanleitung.`,
      `${SOURCE_REFERENCE_PREFIX} BA-2026, Seite 14`,
    ]);
  });

  it("beide Träger kommen ohne die neuen Felder aus — sie sind und bleiben optional", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);
    await put(app, admin, ko.id, {
      action: "comment",
      text: buildValidationFeedback("down", "Widerspruch zur Norm."),
    });

    const traeger = beitraege(await lesen(app, admin, ko.id))[0];

    expect(Object.keys(traeger ?? {}).sort()).toEqual(["at", "author", "id", "koVersion", "text"]);
    // `koVersion` ist die EINZIGE Ergänzung am neu geschriebenen Beitrag — und der Server setzt sie,
    // nicht der Aufrufer.
    expect(traeger?.koVersion).toBe(1);
  });
});
