// ================================================================================================
// JOB 4076 · S3 — DIE ABSAGE GIBT KEINE AUSKUNFT, UND DER CODE STEHT IN KEINER PROTOKOLLZEILE
// ================================================================================================
//
// WARUM DAS EIN EIGENER FALL IST. Der Weg der Sitzungsübergabe ins Klara-Seitenfenster
// (`/word-addin/taskpane.html`) legt einen zweiten Weg an die Sitzung — und ein zweiter Weg ist
// ein Angriffsziel. Was ihn begrenzt, sind vier Eigenschaften (S1 misst drei davon) und DIESE:
// wer einen Code vorlegt, erfährt nicht, WARUM er nicht gilt. „Unbekannt", „abgelaufen" und
// „schon verbraucht" sind drei verschiedene Auskünfte, und jede einzelne hilft beim Raten —
// „abgelaufen" verrät, dass der Wert einmal echt war, „verbraucht" verrät dasselbe UND dass die
// Sitzung dazu existiert hat.
//
// GEMESSEN WIRD DIE GLEICHHEIT, nicht ein erwarteter Text: Status UND Rumpf müssen bei allen drei
// Lagen DIESELBEN sein. Ein Fall, der drei feste Texte pinnt, wäre morgen grün, obwohl einer von
// ihnen umformuliert wurde und damit unterscheidbar geworden ist.
import { afterEach, describe, expect, it, vi } from "vitest";
import { baueDraht, schliesseOffeneDraehte, token } from "../demo-zugang-gaeste-route/draht";
import { adminUndGast } from "../demo-zugang-gaeste/aufbau";
import { codeHolen, einloesen } from "./uebergabe";

afterEach(async () => {
  vi.useRealTimers();
  await schliesseOffeneDraehte();
});

describe("JOB 4076 · S3 · unbekannt, abgelaufen und verbraucht sind von aussen nicht zu unterscheiden", () => {
  it("S3 — dieselbe Antwort (Status und Rumpf) für alle drei Lagen", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-09-15T09:00:00.000Z");
    vi.setSystemTime(start);
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "gast@x.de");

    // (a) ABGELAUFEN: echter Code, Frist vorbei.
    const alt = (await codeHolen(app, sitzung)).json().code as string;
    // (b) VERBRAUCHT: echter Code, einmal eingelöst.
    const verbraucht = (await codeHolen(app, sitzung)).json().code as string;
    const erst = await einloesen(app, verbraucht);
    expect(erst.statusCode, erst.body).toBe(200);

    vi.setSystemTime(start + 200_000);
    const abgelaufen = await einloesen(app, alt);
    const schonBenutzt = await einloesen(app, verbraucht);
    // (c) UNBEKANNT: ein Wert derselben Form, der nie ausgegeben wurde.
    const unbekannt = await einloesen(app, "A".repeat(43));

    const lagen = { abgelaufen, schonBenutzt, unbekannt };
    for (const [name, antwort] of Object.entries(lagen)) {
      expect(antwort.statusCode, `${name}: ${antwort.body}`).toBe(401);
    }
    // DER KERN: kein Byte Unterschied. Zwei Vergleiche, damit eine rote Zeile sagt, WELCHE Lage
    // aus der Reihe fällt.
    expect(schonBenutzt.body, "verbraucht ist von abgelaufen unterscheidbar").toBe(abgelaufen.body);
    expect(unbekannt.body, "unbekannt ist von abgelaufen unterscheidbar").toBe(abgelaufen.body);
    // Und kein `Retry-After`, kein eigener Fehlercode, der die Lage doch verrät.
    for (const antwort of Object.values(lagen)) {
      expect(antwort.headers["retry-after"]).toBeUndefined();
      expect(antwort.json().error).toBe("INVALID_CREDENTIALS");
    }
  });

  it("S3b — die Absage ist dieselbe wie die von „nicht angemeldet“ an einer gewöhnlichen Route", async () => {
    // Damit ist der Übergabeweg von aussen nicht einmal als eigener Weg erkennbar: wer einen Code
    // vorlegt, bekommt exakt, was ein Aufruf ohne Sitzung an `GET /api/auth/me` bekommt.
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const absage = await einloesen(app, "unbekannt-aber-formgerecht");
    const nichtAngemeldet = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(absage.statusCode).toBe(nichtAngemeldet.statusCode);
    expect(absage.body).toBe(nichtAngemeldet.body);
  });

  it("S3c — der Code steht in keiner Protokollzeile", async () => {
    // GRENZE DIESES FALLS, ehrlich benannt: mitgelesen wird die Protokollstufe, die
    // `baueDraht({ protokoll })` einschaltet (`error`) — dort landet, was eine Route ausdrücklich
    // schreibt. Der Code selbst reist im RUMPF, und Rümpfe protokolliert Fastify grundsätzlich
    // nicht (auch nicht auf `info`); die Adresse trägt ihn nie. Was dieser Fall also ausschliesst,
    // ist die einzige Art, wie er hineinkäme: eine eigene Zeile des Übergabewegs.
    const zeilen: Record<string, unknown>[] = [];
    const { k, app } = await baueDraht({ protokoll: (z) => zeilen.push(z) });
    await adminUndGast(k);
    const sitzung = await token(app, "gast@x.de");
    const code = (await codeHolen(app, sitzung)).json().code as string;
    await einloesen(app, code);
    await einloesen(app, code); // der verbrauchte Versuch — der wahrscheinlichste Anlass zu loggen
    await einloesen(app, "nie-ausgegeben");

    expect(zeilen.map((z) => JSON.stringify(z)).join("\n")).not.toContain(code);

    // ------------------------------------------------------------------------------------------
    // KALIBRIERUNG DURCH DEN ECHTEN LOGGER (BENs Prüflücke zur Runde 3).
    // ------------------------------------------------------------------------------------------
    // Hier stand `expect(`{"msg":"${code}"}`).toContain(code)` — eine selbst gebaute Zeichenkette,
    // mit sich selbst verglichen. Das ist keine Kalibrierung: bei einem vollständig TAUBEN
    // Mitschnitt (falscher Strom, falsche Stufe, `protokoll` nicht durchgereicht) wäre die Zeile
    // darüber trivial grün geblieben, und „der Code steht in keiner Protokollzeile" hätte nichts
    // mehr bedeutet. Jetzt geht eine kontrollierte Zeile über `app.log` durch DENSELBEN Strom, den
    // `baueDraht({ protokoll })` mitliest. Steht sie nicht drin, hört der Mitschnitt nichts — und
    // dieser Fall wird rot, statt Deckung vorzutäuschen.
    const marke = "job4076-kalibrierzeile-mitschnitt";
    app.log.error({ probe: marke }, "JOB 4076: Kalibrierung des Protokoll-Mitschnitts");
    await new Promise<void>((fertig) => {
      setTimeout(fertig, 0);
    });
    const mitKalibrierung = zeilen.map((z) => JSON.stringify(z)).join("\n");
    expect(
      mitKalibrierung,
      "der Mitschnitt hört nichts — die Aussage über den Code wäre wertlos",
    ).toContain(marke);
    // Und BEIDES gilt gleichzeitig: die Kalibrierzeile ist da, der Code ist es nicht.
    expect(mitKalibrierung).not.toContain(code);
  });
});
