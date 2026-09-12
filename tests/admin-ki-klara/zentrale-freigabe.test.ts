// ================================================================================================
// JOB 3502 · ADMIN-KI-FREIGABE, VERBRAUCHER KLARA UND WORD — DER RESOLVER FOLGT DER ZENTRALEN
// FREIGABE, UND ER LEGT KEINE ZWEITE SPERRE DARÜBER.
// ================================================================================================
//
// DIE FRAGE, DIE HIER GEMESSEN WIRD, ist nicht „darf öffentliche KI benutzt werden" — die
// entscheidet der Administrator zentral, und seit JOB 3549 fällt diese Entscheidung an genau einer
// Stelle (`Reasoner.oeffentlicheKiErlaubt()` in `services/reasoner/src/service.ts`). Gemessen wird,
// ob KLARA sich danach richtet: ob der eine Resolver, an dem sowohl das Aufgabenfenster als auch der
// Word-Weg hängen (`resolveKlaraPolicy`), diese Entscheidung ÜBERNIMMT statt sie zu wiederholen.
//
// DER BEFUND VON CODEX (10.09.2026, 06:41), auf den dieser Auftrag antwortet: Word und Klara
// müssen dieselbe zentrale Adminfreigabe tatsächlich verwenden; es darf keine weitere
// UNÜBERWINDBARE Meldung geben, wenn für die freigegebene Rolle eine gültige zentrale
// Autorisierung vorliegt.
//
// ------------------------------------------------------------------------------------------------
// WAS DER RESOLVER BEKOMMT — EIN URTEIL, KEINE ZWEITE KONFIGURATION
// ------------------------------------------------------------------------------------------------
//
// `zentralFreigegeben` ist ein `boolean`: das ERGEBNIS der zentralen Entscheidung, nicht ihre
// Struktur. Die Adminfreigabe selbst hat zwei Schalter (Grundfreigabe und die getrennte Freigabe
// für vertrauliche Inhalte, `ReasonerKiFreigabe` in `services/reasoner/src/types.ts`); den zweiten
// kann dieser Resolver nicht beantworten, weil er die Einstufung eines Inhalts nirgends erfährt.
// Deshalb trägt er die Struktur NICHT nach — sonst stünde hier ein Feld, das er nicht liest, und
// eine zweite Stelle, die nachgezogen werden müsste, sobald der Vertrag sich rührt.
//
// Diese Datei nennt die Schalternamen deshalb nirgends. Das ist kein Ausweichen vor dem
// Freigabe-Wächter (JOB 3550 F2, `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`), sondern
// dieselbe Aussage von der Testseite her: wer die Namen hier bräuchte, hätte die Freigabe
// verdoppelt.
//
// ------------------------------------------------------------------------------------------------
// DIE ZWEI SPERREN AUSEINANDERGEHALTEN — daran hängt der ganze Auftrag
// ------------------------------------------------------------------------------------------------
//
//   `policy_incomplete`        · UNÜBERWINDBAR für den Menschen. Keine Zustimmung hilft, und der
//                                Resolver sagt das ausdrücklich: `externalConsentProvider === null`
//                                heisst „es gibt keinen Empfänger, den eine Zustimmung
//                                freischalten würde" (`klara-policy.ts`, JOB 3079 R2). Genau hier
//                                landet ab jetzt die verweigerte zentrale Freigabe: sie ist eine
//                                Adminentscheidung, und die kann kein Nutzer wegklicken.
//
//   `external_consent_missing` · ÜBERWINDBAR, und sie MUSS bleiben. Sie ist die bewusste
//                                Bestätigung des Menschen. Die zentrale Freigabe ERLAUBT, sie
//                                überträgt nicht — Einschalten allein sendet nichts.
//
// „Die zweite Sperre entfällt" heisst deshalb genau das: liegt die zentrale Freigabe vor, steht vor
// dem Menschen nur noch SEINE Zustimmung — und die ist mit benanntem Empfänger erteilbar. Es kommt
// keine unüberwindbare Adminsperre obendrauf.
//
// ------------------------------------------------------------------------------------------------
// WARUM „FELD FEHLT" DASSELBE IST WIE „NICHT FREIGEGEBEN" (JOB 3767)
// ------------------------------------------------------------------------------------------------
//
// Pedis Entscheidung ist gefallen und steht hier nicht zur Debatte (10.09. 21:25, wörtlich zitiert
// in `services/reasoner/src/types.ts`): „Keine Freigabe, kein Egress … Im Zweifel gilt: gesperrt."
// Ein vorhandenes `false` ist die Aussage des Administrators — und sie sperrt.
//
// HIER STAND DAS GEGENTEIL, und es hatte drei Tage lang seinen Grund: ein fehlendes Feld sei keine
// Aussage des Administrators, sondern ein BAUZUSTAND, denn die Verdrahtung in der
// Kompositionswurzel lag ausserhalb der Zielpfade von JOB 3502 und stand noch nicht. Sie steht seit
// JOB 3666 (`build-app.ts`, gemessen in `wurzel-verdrahtung.test.ts`), und JOB 3767 hat die Lesart
// nachgezogen: `zentralFreigegeben === true` statt `!== false`. Ein Aufrufer ohne das Feld ist
// seither keine unfertige Instanz mehr, sondern eine VERGESSENE WURZEL — und die darf nicht
// freischalten, was kein Administrator freigegeben hat. Z6 und Z9 messen die neue Gleichheit
// (fehlendes Feld = ausdrückliches `false`), Z10 die Kalibrierung dagegen.
import { describe, expect, it } from "vitest";
import {
  type KlaraPolicyInput,
  klaraPolicyVersion,
  resolveKlaraPolicy,
} from "../../services/reasoner";

const JETZT = Date.parse("2026-09-10T09:00:00.000Z");

/**
 * Die Lage eines Betriebs, in dem der externe Weg an NICHTS ausser der Freigabe und der Zustimmung
 * mehr scheitert: Admin-Wahl `cloud`, Cloud verdrahtet, Anbieter benannt. Jede Abweichung von
 * dieser Lage hätte einen eigenen, anderen Grund — und würde die Aussage dieser Datei verwässern.
 */
function lage(over: Partial<KlaraPolicyInput> = {}): KlaraPolicyInput {
  return {
    choice: "cloud",
    source: "db",
    effectiveAnswerProvider: "cloud",
    cloudConfigured: true,
    localConfigured: false,
    providerLabel: "anthropic",
    modelLabel: "claude",
    localProviderLabel: "Lokaler Testanbieter",
    externalConsentGranted: false,
    now: JETZT,
    resolutionId: "res-3502",
    ...over,
  };
}

describe("JOB 3502 · Z — die zentrale Freigabe entscheidet, Klara wiederholt sie nicht", () => {
  it("Z1 · OHNE zentrale Freigabe bleibt gesperrt — und keine Zustimmung hilft", () => {
    for (const zugestimmt of [false, true]) {
      const r = resolveKlaraPolicy(
        lage({ zentralFreigegeben: false, externalConsentGranted: zugestimmt }),
      );
      expect(r.executionAllowed, `zugestimmt=${zugestimmt}`).toBe(false);
      // Die Adminsperre, nicht die Zustimmungssperre: der Mensch hat hier nichts zu entscheiden.
      expect(r.blockedReason, `zugestimmt=${zugestimmt}`).toBe("policy_incomplete");
      // Und der Resolver sagt es auch dem Panel: es gibt keinen Empfänger, den eine Zustimmung
      // freischalten würde — der Zustimmungsknopf darf gar nicht erst erscheinen.
      expect(r.externalConsentProvider, `zugestimmt=${zugestimmt}`).toBeNull();
      expect(r.externalConsentModel, `zugestimmt=${zugestimmt}`).toBeNull();
    }
  });

  it("Z2 · MIT Freigabe entfällt die zusätzliche Sperre — es bleibt die Zustimmung", () => {
    const r = resolveKlaraPolicy(lage({ zentralFreigegeben: true }));
    // Ausgeführt wird noch nicht — der Mensch hat noch nicht bestätigt.
    expect(r.executionAllowed).toBe(false);
    // ABER: der Grund ist der ÜBERWINDBARE. Keine zweite Adminsperre steht davor.
    expect(r.blockedReason).toBe("external_consent_missing");
    // Und er ist wirklich überwindbar: der Empfänger, den eine Zustimmung freischalten würde,
    // steht benannt da (JOB 3079 R2 — `null` hiesse „keine Zustimmung hilft").
    expect(r.externalConsentProvider).toBe("anthropic");
    expect(r.externalConsentModel).toBe("claude");
  });

  it("Z3 · die Freigabe hebt KEINE der anderen Adminbedingungen auf", () => {
    // Sie ist der DRITTE Teil derselben Frage, nicht ihr Ersatz. Wo die Verdrahtung fehlt, bleibt
    // es gesperrt — sonst wäre sie ein Generalschlüssel statt einer Erlaubnis.
    const ohneVerdrahtung = resolveKlaraPolicy(
      lage({ zentralFreigegeben: true, cloudConfigured: false, externalConsentGranted: true }),
    );
    expect(ohneVerdrahtung.executionAllowed).toBe(false);
    expect(ohneVerdrahtung.blockedReason).toBe("policy_incomplete");
  });

  it("Z4 · die bewusste Bestätigung bleibt in JEDEM Fall erhalten — Einschalten überträgt nichts", () => {
    // Der Kern des Verbots aus §3: die zentrale Freigabe ERLAUBT, sie überträgt nicht. In keiner
    // Kombination darf sie die Zustimmung ersetzen.
    for (const freigegeben of [true, false]) {
      const r = resolveKlaraPolicy(lage({ zentralFreigegeben: freigegeben }));
      expect(r.externalConsentRequired, `freigegeben=${freigegeben}`).toBe(true);
      expect(r.externalConsentGranted, `freigegeben=${freigegeben}`).toBe(false);
      expect(r.executionAllowed, `freigegeben=${freigegeben}`).toBe(false);
    }
    // Und erst die Bestätigung des Menschen führt aus — bei vorliegender Freigabe.
    const mit = resolveKlaraPolicy(
      lage({ zentralFreigegeben: true, externalConsentGranted: true }),
    );
    expect(mit.executionAllowed).toBe(true);
    expect(mit.blockedReason).toBeNull();
    expect(mit.provider).toBe("anthropic");
  });

  it("Z5 · die Freigabe erfindet keine Bindung: ohne verdrahtete Cloud bleibt der interne Weg", () => {
    // Sie ist eine ERLAUBNIS, kein Anbieter. Wo nichts verdrahtet ist, schaltet sie nichts frei —
    // sonst wäre sie ein zweiter Konfigurationsweg neben der Verdrahtung.
    const r = resolveKlaraPolicy(
      lage({
        zentralFreigegeben: true,
        cloudConfigured: false,
        effectiveAnswerProvider: "deterministic",
        externalConsentGranted: true,
      }),
    );
    expect(r.effectiveMode).toBe("deterministic");
    expect(r.executionAllowed).toBe(true);
    expect(r.provider).not.toBe("anthropic");
    // Und die Admin-Wahl allein hebelt sie auch nicht aus: `deterministic` gewählt, Bindung zeigt
    // trotzdem auf Cloud ⇒ Widerspruch, gesperrt (JOB 3079 R2, unverändert gültig).
    const widerspruch = resolveKlaraPolicy(
      lage({ zentralFreigegeben: true, choice: "deterministic", externalConsentGranted: true }),
    );
    expect(widerspruch.executionAllowed).toBe(false);
    expect(widerspruch.blockedReason).toBe("policy_incomplete");
  });

  it("Z6 · FEHLT das Feld, verhält sich der Resolver Feld für Feld wie bei einem ausdrücklichen NEIN", () => {
    // ============================================================================================
    // UMGEKEHRT DURCH JOB 3767. Was dieser Fall bis dahin pinnte, ist abgelöst.
    // ============================================================================================
    //
    // ER LAUTETE: „FEHLT das Feld, verhält sich der Resolver Feld für Feld wie heute" — die
    // Einspiel-Schonung von JOB 3502, damit ein Auftrag, dessen Verdrahtung noch nicht lag, den
    // laufenden Betrieb nicht still abschaltete. Seit JOB 3666 liegt sie (`build-app.ts`,
    // Policyquelle des `KlaraSessionService`), und JOB 3767 hat die Lesart auf `=== true`
    // verschärft. Der Fall behält deshalb seine BAUFORM — exakte Gleichheit ganzer Auflösungen,
    // nicht ein einzelnes Feld — und kehrt seinen Vergleichspartner um: das fehlende Feld wird
    // nicht mehr gegen „erlaubt" gemessen, sondern gegen das ausdrückliche `false`.
    //
    // DASS ES DIESELBE Auflösung ist und nicht bloss dieselbe Sperre, ist der Punkt: es gibt keine
    // zweite Sperrstufe für die vergessene Wurzel, keinen eigenen Grund, keine eigene Meldung.
    for (const zugestimmt of [false, true]) {
      const ausdruecklichNein = resolveKlaraPolicy(
        lage({ externalConsentGranted: zugestimmt, zentralFreigegeben: false }),
      );
      const ohneFeld = resolveKlaraPolicy(lage({ externalConsentGranted: zugestimmt }));
      const mitUndefined = resolveKlaraPolicy(
        lage({ externalConsentGranted: zugestimmt, zentralFreigegeben: undefined }),
      );
      expect(ohneFeld).toEqual(ausdruecklichNein);
      // Weggelassen und ausdrücklich `undefined` sind derselbe Fall — sonst hinge die Sicherheit
      // daran, WIE ein Aufrufer sein Objekt baut.
      expect(mitUndefined).toEqual(ausdruecklichNein);
    }
    // UND DIE KALIBRIERUNG, damit „gleich wie NEIN" nicht heimlich „immer gesperrt" bedeutet: die
    // einzige Belegung, die etwas anderes ergibt, ist das ausdrückliche JA.
    const ohneFeld = resolveKlaraPolicy(lage({ externalConsentGranted: true }));
    const ausdruecklichJa = resolveKlaraPolicy(
      lage({ externalConsentGranted: true, zentralFreigegeben: true }),
    );
    expect(ohneFeld.executionAllowed).toBe(false);
    expect(ausdruecklichJa.executionAllowed).toBe(true);
  });

  it("Z7 · ein Widerruf der Freigabe entwertet eine erteilte Zustimmung — über die Policyversion", () => {
    // Die Zustimmung ist an `policyVersion` und `configurationVersion` gebunden
    // (`klara-session-service.ts`, Deckungsprüfung). Wäre die zentrale Freigabe nicht Teil einer
    // der beiden, überlebte eine Zustimmung den Widerruf der Freigabe — genau die Lücke, die eine
    // zentrale Entscheidung wertlos macht.
    const frei = klaraPolicyVersion({ ...lage(), zentralFreigegeben: true });
    const gesperrt = klaraPolicyVersion({ ...lage(), zentralFreigegeben: false });
    expect(frei).not.toBe(gesperrt);
    // NACHGEFÜHRT DURCH JOB 3767. Hier stand die Einspiel-Schonung von JOB 3502: „ohne Feld bleibt
    // die Version Zeichen für Zeichen die von heute". Sie war nötig, solange keine Wurzel das Feld
    // lieferte; seit JOB 3666 liefert die einzige Konstruktionsstelle im Produkt immer ein
    // `boolean`, im Bestand trägt also jede Version ohnehin ihr Segment. Ein fehlendes Feld heisst
    // ab jetzt auch in der Kennung `gesperrt` — sonst trüge eine Sitzung unter einer vergessenen
    // Wurzel eine Kennung, die von der alten Welt nicht zu unterscheiden ist.
    expect(klaraPolicyVersion({ choice: "cloud", source: "db" })).toBe("policy:db:cloud:gesperrt");
    expect(klaraPolicyVersion({ ...lage(), zentralFreigegeben: undefined })).toBe(
      "policy:db:cloud:gesperrt",
    );
    // Und sie ist ununterscheidbar vom ausdrücklichen NEIN — dieselbe Aussage wie in Z6, hier auf
    // der Versionsebene.
    expect(klaraPolicyVersion({ choice: "cloud", source: "db" })).toBe(gesperrt);
  });

  it("Z9 · eine Wurzel, die das Feld vergisst, ist gesperrt — nicht frei", () => {
    // ============================================================================================
    // JOB 3767 · DIE FAIL-CLOSED-PROBE. Sie ist der Grund dieses Auftrags.
    // ============================================================================================
    //
    // Aufbau: exakt die Lage des Positivfalls Z4 („erst die Bestätigung führt aus") — Adminwahl
    // `cloud`, Cloud verdrahtet, Anbieter benannt, Zustimmung erteilt. Der EINZIGE Unterschied ist,
    // dass `zentralFreigegeben` gar nicht erst hereingereicht wird, wie es eine zweite
    // Kompositionswurzel täte, die die Zeile aus `build-app.ts` vergisst.
    //
    // Bis JOB 3767 lief genau diese Lage durch (`!== false` bei `undefined` ist WAHR): eine
    // vergessene Verdrahtung schaltete öffentliche KI frei, ohne dass ein Administrator je
    // zugestimmt hätte. Ab jetzt sperrt sie — mit demselben einen Adminsgrund wie ein
    // ausdrückliches `false`.
    const vergessen = resolveKlaraPolicy(lage({ externalConsentGranted: true }));
    expect(vergessen.executionAllowed).toBe(false);
    expect(vergessen.blockedReason).toBe("policy_incomplete");
    // Und es ist WIRKLICH derselbe Grund, nicht bloss derselbe Name: keine zweite Sperrstufe, keine
    // eigene Meldung. Feld für Feld gemessen gegen das ausdrückliche `false` (Z1).
    const ausdruecklichNein = resolveKlaraPolicy(
      lage({ externalConsentGranted: true, zentralFreigegeben: false }),
    );
    expect(vergessen).toEqual(ausdruecklichNein);
    // Auch die Versionskennung verschweigt es nicht: eine Sitzung unter einer vergessenen Wurzel
    // trägt nicht die Kennung der alten Welt, sondern `…:gesperrt` (Lieferung 3).
    expect(vergessen.policyVersion.endsWith(":gesperrt")).toBe(true);
    // Und der Zustimmungsknopf erscheint gar nicht erst — hier hülfe keine Zustimmung.
    expect(vergessen.externalConsentProvider).toBeNull();
  });

  it("Z10 · der neue Wächter sperrt nicht einfach alles — mit `true` bleibt derselbe Aufbau erlaubt", () => {
    // Der Gegenbeweis zu Z9. Ohne ihn wäre Z9 auch dann grün, wenn die Umstellung den externen Weg
    // vollständig zugemauert hätte — eine stille Abschaltung statt eines Fail-closed.
    const freigegeben = resolveKlaraPolicy(
      lage({ externalConsentGranted: true, zentralFreigegeben: true }),
    );
    expect(freigegeben.executionAllowed).toBe(true);
    expect(freigegeben.blockedReason).toBeNull();
    expect(freigegeben.policyVersion.endsWith(":frei")).toBe(true);
  });

  it("Z8 · der Resolver merkt sich die Freigabe nicht — kein eigener Zwischenspeicher", () => {
    // §3 Verboten: „Keine zweite Policy, kein eigener Zwischenspeicher für die Freigabe."
    // Gemessen an der einzigen Eigenschaft, die das beweist: dieselbe Funktion, nacheinander mit
    // verschiedenen Freigaben gerufen, antwortet jedes Mal nach der ÜBERGEBENEN Freigabe.
    const folge = [true, false, true, false, true];
    const erlaubt = folge.map(
      (f) =>
        resolveKlaraPolicy(lage({ zentralFreigegeben: f, externalConsentGranted: true }))
          .executionAllowed,
    );
    expect(erlaubt).toEqual([true, false, true, false, true]);
  });
});
