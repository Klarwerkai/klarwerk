// ================================================================================================
// JOB 4146 · R5 / BEN-KORREKTURPFLICHT 1 — DIE WIEDERHOLUNG HÄNGT AM INHALT, NICHT NUR AM SCHLÜSSEL
// ================================================================================================
//
// WAS BEN IN RUNDE 4 GEMESSEN HAT (`jobs/4146/runde-4/ben.md`, Cloud 7eb2e216): „anderer Text mit
// bereits gespeichertem Schlüssel → HTTP 200, neuer Text fehlt beim anschließenden Lesen". Die
// Deduplizierung sah nur auf `clientKey` und `author` — der Server bestätigte einen Beitrag, den er
// gar nicht geschrieben hatte, und die Fläche leerte daraufhin das Feld. Das ist Datenverlust, und
// er entsteht genau in der Lage, für die es den Schlüssel gibt.
//
// DIE UNTERSCHEIDUNG, um die es geht, und sie ist die ganze Sache:
//   DIESELBE ABSENDUNG ZWEIMAL  → ein Beitrag. Der Aufrufer weiss nicht, ob der erste Versuch ankam.
//   EINE ANDERE ABSENDUNG       → ein eigener Beitrag. Ein geänderter Text ist nicht die Wiederholung
//                                 des alten, auch wenn derselbe Entwurf ihn trägt.
//
// „Absendung" heisst hier: Verfasser · Text · Antwortbezug. Der Bezug gehört dazu, weil dieselben
// Worte an einem anderen Faden eine andere Aussage sind (Auftrag der Steuerung für R5, Punkt 1:
// „EINSCHLIESSLICH Antwortbezug").
//
// WARUM DER ABWEICHENDE FALL GESCHRIEBEN UND NICHT ABGEWIESEN WIRD: abweisen hiesse, den Menschen in
// eine Sackgasse zu stellen — sein Entwurf trägt denselben Schlüssel, und er käme nie durch. Die
// Diskussion ist anfügend; zwei Beiträge sind sichtbar und behebbar, ein verschluckter ist es nicht.
// Ehrlichkeit vor Optik: lieber ein Beitrag zu viel als ein stiller Verlust.
import { describe, expect, it } from "vitest";
import { anlegen, beitraege, flaeche, lesen, put } from "./huelle";

const SCHLUESSEL = "beitrag-4146-r5";

describe("JOB 4146 R5 · W — Wiederholen verliert keinen Inhalt", () => {
  it("W1 · Speichern gelang, die Antwort ging verloren, der Text wurde geändert: der neue Text steht im Bestand", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);

    // Der erste Versuch KOMMT AN — nur seine Antwort geht auf dem Rückweg verloren. Genau diese Lage
    // sieht der Server nicht von der eines nie angekommenen Versuchs unterschieden; er sieht nur die
    // zweite Absendung.
    const erst = await put(app, admin, ko.id, {
      action: "comment",
      text: "Gilt das für Linie 3?",
      clientKey: SCHLUESSEL,
    });
    expect(erst.statusCode).toBe(200);

    // Der Mensch sieht keinen Erfolg, bessert seinen Entwurf nach und sendet erneut. Der Entwurf ist
    // derselbe, also ist es auch der Schlüssel.
    const nochmal = await put(app, admin, ko.id, {
      action: "comment",
      text: "Gilt das auch für Linie 3 und 4?",
      clientKey: SCHLUESSEL,
    });
    expect(nochmal.statusCode).toBe(200);

    const texte = beitraege(await lesen(app, admin, ko.id)).map((c) => c.text);
    // DER FANG: vor der Korrektur stand hier nur der ALTE Text, und die 200 darüber war eine
    // Erfolgsmeldung über etwas, das nicht geschehen war.
    expect(texte).toContain("Gilt das auch für Linie 3 und 4?");
    expect(texte).toContain("Gilt das für Linie 3?");
  });

  it("W1b · die Antwort der abweichenden Absendung trägt den neuen Text — HTTP 200 allein ist kein Beleg", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);

    await put(app, admin, ko.id, { action: "comment", text: "Erst.", clientKey: SCHLUESSEL });
    const nochmal = await put(app, admin, ko.id, {
      action: "comment",
      text: "Dann anders.",
      clientKey: SCHLUESSEL,
    });

    // BENs Prüfauftrag wörtlich: „Miss danach den gespeicherten Inhalt und den verbleibenden
    // Entwurf; HTTP 200 allein ist kein Erfolgsbeleg." Also wird die ANTWORT selbst gemessen.
    expect(beitraege(nochmal.json()).map((c) => c.text)).toEqual(["Erst.", "Dann anders."]);
  });

  it("W2 · die IDENTISCHE Wiederholung erzeugt weiterhin genau EINEN Beitrag (Vertrag Fall 5 bleibt)", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);

    const erst = await put(app, admin, ko.id, {
      action: "comment",
      text: "Wortgleich.",
      clientKey: SCHLUESSEL,
    });
    const nochmal = await put(app, admin, ko.id, {
      action: "comment",
      text: "Wortgleich.",
      clientKey: SCHLUESSEL,
    });

    expect(beitraege(nochmal.json())).toHaveLength(1);
    // Und es ist DERSELBE Beitrag, nicht ein zweiter mit gleichem Wortlaut.
    expect(beitraege(nochmal.json())[0]).toEqual(beitraege(erst.json())[0]);
    expect(beitraege(await lesen(app, admin, ko.id))).toHaveLength(1);
  });

  it("W3 · derselbe Text unter demselben Schlüssel, aber an einem ANDEREN Faden, ist eine eigene Aussage", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);

    const wurzel = await put(app, admin, ko.id, { action: "comment", text: "Die Frage." });
    const wurzelId = beitraege(wurzel.json())[0]?.id as string;
    expect(typeof wurzelId).toBe("string");

    // Einmal ohne Bezug …
    await put(app, admin, ko.id, { action: "comment", text: "Ja.", clientKey: SCHLUESSEL });
    // … und einmal als Antwort auf die Frage. Gleicher Verfasser, gleicher Text, gleicher Schlüssel —
    // und trotzdem nicht dieselbe Absendung.
    await put(app, admin, ko.id, {
      action: "comment",
      text: "Ja.",
      clientKey: SCHLUESSEL,
      replyTo: wurzelId,
    });

    const liste = beitraege(await lesen(app, admin, ko.id));
    expect(liste).toHaveLength(3);
    expect(liste.filter((c) => c.replyTo === wurzelId)).toHaveLength(1);
  });

  it("W3b · die Wiederholung DERSELBEN Antwort bleibt eine Antwort — der Bezug macht sie nicht doppelt", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegen(app, admin);

    const wurzel = await put(app, admin, ko.id, { action: "comment", text: "Die Frage." });
    const wurzelId = beitraege(wurzel.json())[0]?.id as string;

    await put(app, admin, ko.id, {
      action: "comment",
      text: "Ja.",
      clientKey: SCHLUESSEL,
      replyTo: wurzelId,
    });
    await put(app, admin, ko.id, {
      action: "comment",
      text: "Ja.",
      clientKey: SCHLUESSEL,
      replyTo: wurzelId,
    });

    // Zwei Beiträge insgesamt: die Frage und GENAU EINE Antwort.
    expect(beitraege(await lesen(app, admin, ko.id))).toHaveLength(2);
  });
});
