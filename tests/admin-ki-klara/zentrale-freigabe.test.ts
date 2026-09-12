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
// WARUM „FELD FEHLT" NICHT DASSELBE IST WIE „NICHT FREIGEGEBEN"
// ------------------------------------------------------------------------------------------------
//
// Pedis Entscheidung ist gefallen und steht hier nicht zur Debatte (10.09. 21:25, wörtlich zitiert
// in `services/reasoner/src/types.ts`): „Keine Freigabe, kein Egress … Im Zweifel gilt: gesperrt."
// Ein vorhandenes `false` ist die Aussage des Administrators — und sie sperrt.
//
// Ein FEHLENDES Feld ist dagegen keine Aussage des Administrators, sondern ein BAUZUSTAND: die
// Verdrahtung in der Kompositionswurzel liegt ausserhalb der Zielpfade dieses Auftrags (s.
// RUECKGABE) und steht noch nicht. Bis sie steht, bekommt der Resolver gar keine Auskunft zu sehen,
// und dann darf sich NICHTS ändern — weder zum Guten noch zum Schlechten. Sobald sie steht, kommt
// immer ein `boolean` an und der Fall entfällt. Z6 misst beide Seiten dieser Unterscheidung
// gegeneinander.
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

  it("Z6 · FEHLT das Feld, verhält sich der Resolver Feld für Feld wie heute", () => {
    // Die Zusage von JOB 3502: bis die Verdrahtung steht, darf sich NICHTS ändern — weder zum Guten
    // noch zum Schlechten. Gemessen als exakte Gleichheit der ganzen Auflösung, nicht an einem
    // einzelnen Feld.
    //
    // SEIT JOB 3666 STEHT SIE (`build-app.ts`, Policyquelle des `KlaraSessionService`), und damit
    // beschreibt dieser Fall keinen Produktionszustand mehr, sondern den BAUZUSTAND eines Aufrufers,
    // der das Feld nicht reicht. Er bleibt stehen, weil `klara-policy.ts:430` weiterhin `!== false`
    // liest — solange diese Lesart gilt, gehört ihr Verhalten gemessen. Wird sie eines Tages auf
    // `=== true` verschärft (fail-closed auch für einen vergesslichen Aufrufer), ist DIESER Fall die
    // Stelle, die das merkt: die Gleichheit unten fällt dann, und das ist richtig so.
    for (const zugestimmt of [false, true]) {
      const heute = resolveKlaraPolicy(lage({ externalConsentGranted: zugestimmt }));
      const mitUndefined = resolveKlaraPolicy(
        lage({ externalConsentGranted: zugestimmt, zentralFreigegeben: undefined }),
      );
      expect(mitUndefined).toEqual(heute);
    }
    // UND DIE GEGENSEITE, damit „wie heute" nicht heimlich „immer erlaubt" bedeutet: ein
    // vorhandenes `false` ist etwas ANDERES als ein fehlendes Feld. Das ist die Stelle, an der
    // Pedis „im Zweifel gesperrt" wirkt, sobald die Verdrahtung steht.
    const ohneFeld = resolveKlaraPolicy(lage({ externalConsentGranted: true }));
    const ausdruecklichNein = resolveKlaraPolicy(
      lage({ externalConsentGranted: true, zentralFreigegeben: false }),
    );
    expect(ohneFeld.executionAllowed).toBe(true);
    expect(ausdruecklichNein.executionAllowed).toBe(false);
  });

  it("Z7 · ein Widerruf der Freigabe entwertet eine erteilte Zustimmung — über die Policyversion", () => {
    // Die Zustimmung ist an `policyVersion` und `configurationVersion` gebunden
    // (`klara-session-service.ts`, Deckungsprüfung). Wäre die zentrale Freigabe nicht Teil einer
    // der beiden, überlebte eine Zustimmung den Widerruf der Freigabe — genau die Lücke, die eine
    // zentrale Entscheidung wertlos macht.
    const frei = klaraPolicyVersion({ ...lage(), zentralFreigegeben: true });
    const gesperrt = klaraPolicyVersion({ ...lage(), zentralFreigegeben: false });
    expect(frei).not.toBe(gesperrt);
    // Und die Rückwärtsverträglichkeit ist Teil derselben Zusage: ohne Feld bleibt die Version
    // Zeichen für Zeichen die von heute — sonst entwertete allein dieser Auftrag jede laufende
    // Sitzung und jede erteilte Zustimmung im Bestand.
    expect(klaraPolicyVersion({ choice: "cloud", source: "db" })).toBe("policy:db:cloud");
    expect(klaraPolicyVersion({ ...lage(), zentralFreigegeben: undefined })).toBe(
      "policy:db:cloud",
    );
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
