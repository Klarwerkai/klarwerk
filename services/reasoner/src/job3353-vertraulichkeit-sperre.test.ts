import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "./provider";
import { ModelProvider } from "./provider-model";
import type { ModelClient } from "./provider-model";
import { ConfidentialCloudBlockedError, Reasoner } from "./service";
import type { AssistResult } from "./types";

// ================================================================================================
// JOB 3353 · B — WANN DARF EIN LEERER LAUF „DIE VERTRAULICHKEIT WAR ES" SAGEN?
// ================================================================================================
//
// DER ANLASS (Codex 21:57 live, 73217c82 in der Vorprüfung): Aus dem Erfassen-Blatt kam ein HTTP 500,
// dessen Text den richtigen Grund trug — der Statuscode aber nicht. Die Route soll daraus eine
// typisierte, anzeigbare Antwort machen. Der erste Anlauf hat den Fall in der ROUTE erraten (jeder
// nicht einordenbare Fehler galt als Sperre); das deckt auch einen Programmfehler ab und hätte dem
// Menschen erzählt, er solle eine Einstufung ändern, die mit dem Fehler nichts zu tun hat.
//
// HIER STEHT DER POSITIVE BELEG AUF DEM PRÜFSTAND: `Reasoner.runTask` wirft
// `ConfidentialCloudBlockedError` NUR, wenn in der Kette kein Modell stand UND die Cloud genau
// wegen der Vertraulichkeit fehlte (`cloudExcludedByConfidentiality` — dasselbe Maß wie
// `structure`/`describe`/`groupCandidates` seit WP-SHIP9-S1/S2).
//
// Gemessen wird am ECHTEN `Reasoner` mit echter Providerkette; die Provider sind gestellt, weil ein
// Modellaufruf im Test nicht stattfinden darf.

/** Ein Cloud-Client, der JEDEN Aufruf zählt — bei vertraulichem Text muss er bei 0 bleiben. */
function cloudSpyClient(): { client: ModelClient; calls: () => number } {
  let calls = 0;
  const client: ModelClient = {
    name: "cloud:spy",
    complete: async () => {
      calls += 1;
      return "irgendein Text";
    },
    completeVision: async () => {
      calls += 1;
      return "Ein Bild.";
    },
  };
  return { client, calls: () => calls };
}

/**
 * Ein Anbieter, der bei `assistText` scheitert — sonst der deterministische Bestand.
 *
 * WARUM ÜBERHAUPT: Der Lauf, um den es geht, ist der, in dem am Ende NICHTS herauskommt. Seit
 * JOB 3276 stellt ihn der Bestand selbst her (ein Ersatz, der nur den geglätteten Originaltext
 * zurückgibt, ist kein Vorschlag mehr, sondern eine ehrliche Meldung); dieser Provider macht ihn
 * unabhängig davon reproduzierbar und benennbar, wer in der Kette gescheitert ist.
 */
class WerfenderProvider extends DeterministicProvider {
  /** Wie oft dieser Anbieter WIRKLICH gefragt wurde — der Beleg, dass er in der Kette stand. */
  aufrufe = 0;
  constructor(private readonly kennung: string) {
    super();
  }
  override async assistText(): Promise<AssistResult> {
    this.aufrufe += 1;
    throw new Error(`${this.kennung}: kein Ergebnis`);
  }
}

/**
 * Ein zulässiger LOKALER Anbieter, der wirklich etwas beiträgt — der Ausweg, den die Sperrmeldung
 * selbst nennt („lokale KI wählen").
 *
 * Er muss einen ECHTEN Vorschlag liefern (nicht den Eingabetext): seit JOB 3276 zählt ein
 * unveränderter Text nicht mehr als Antwort, und der Lauf gälte als gescheitert.
 */
class LokalerProvider extends DeterministicProvider {
  aufrufe = 0;
  override async assistText(): Promise<AssistResult> {
    this.aufrufe += 1;
    return {
      text: "The customer received the router and the installation was completed.",
      demo: false,
    };
  }
}

const TEXT = "the customer recieved the router and the instalation was completed.";

describe("JOB 3353 B · der Reasoner belegt die Vertraulichkeitssperre selbst", () => {
  it("S1 POSITIV — vertraulich, Cloud verdrahtet, kein Ergebnis → ConfidentialCloudBlockedError, Cloud-Spy 0", async () => {
    const { client, calls } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client), new WerfenderProvider("ersatz"));

    const fehler = await reasoner.assistText(TEXT, "en", "Spelling", true).catch((e: unknown) => e);

    expect(fehler).toBeInstanceOf(ConfidentialCloudBlockedError);
    expect((fehler as ConfidentialCloudBlockedError).task).toBe("assist");
    // Der ursprüngliche Fehler geht nicht verloren — er ist die Ursache, nicht der Ersatz.
    expect(((fehler as ConfidentialCloudBlockedError).ursache as Error).message).toContain(
      "kein Ergebnis",
    );
    // Die Schutzregel selbst: die Cloud wurde NIE gerufen.
    expect(calls()).toBe(0);
  });

  it("S2 NEGATIV — ein zulässiger LOKALER Anbieter stand in der Kette und scheiterte → gewöhnlicher Fehler", async () => {
    // Die Cloud war zwar wegen der Vertraulichkeit aus der Kette, aber es GAB einen zulässigen
    // Antwortgeber. Sein Scheitern ist eine Störung — und darf den Menschen nicht zum Umstufen
    // schicken.
    const { client } = cloudSpyClient();
    const lokal = new WerfenderProvider("lokal");
    const reasoner = new Reasoner(
      new ModelProvider(client),
      new WerfenderProvider("ersatz"),
      undefined,
      undefined,
      lokal,
    );

    const fehler = await reasoner.assistText(TEXT, "en", "Spelling", true).catch((e: unknown) => e);

    // Er stand wirklich in der Kette und wurde wirklich gefragt — daran hängt die Aussage dieses
    // Falles; ohne diese Zeile prüfte er nur, dass irgendetwas schiefging.
    expect(lokal.aufrufe).toBe(1);
    expect(fehler).toBeInstanceOf(Error);
    expect(fehler).not.toBeInstanceOf(ConfidentialCloudBlockedError);
  });

  it("S3 NEGATIV — gar keine Cloud verdrahtet (‹no-model›): ein leerer Lauf ist keine Sperre", async () => {
    // Ohne verdrahtete Cloud hat die Vertraulichkeit nichts entfernt. „Es gibt hier kein Modell" und
    // „dein Text darf nicht zur Cloud" sind zwei verschiedene Auskünfte.
    const reasoner = new Reasoner(undefined, new WerfenderProvider("ersatz"));

    const fehler = await reasoner.assistText(TEXT, "en", "Spelling", true).catch((e: unknown) => e);

    expect(fehler).not.toBeInstanceOf(ConfidentialCloudBlockedError);
    expect((fehler as Error).message).toContain("ersatz");
  });

  it("S4 NEGATIV — NICHT vertraulicher Lauf ohne Ergebnis → gewöhnlicher Fehler", async () => {
    const { client } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client), new WerfenderProvider("ersatz"));

    const fehler = await reasoner
      .assistText(TEXT, "en", "Spelling", false)
      .catch((e: unknown) => e);

    expect(fehler).not.toBeInstanceOf(ConfidentialCloudBlockedError);
  });

  it("S5 ERFOLG — vertraulich, aber ein zulässiger LOKALER Anbieter antwortet → Ergebnis, kein Fehler, Cloud-Spy 0", async () => {
    // Der Kern der Grenze: die Vertraulichkeit allein erzeugt nichts. Nur der Lauf, der ohne
    // Ergebnis bleibt, meldet die Sperre — und genau der Ausweg, den die Meldung nennt, muss
    // weiterhin funktionieren.
    //
    // RUNDE 3, GEMESSEN: dieser Fall stand hier zuerst mit dem deterministischen Ersatz als
    // Antwortgeber. Auf der neuen Basis (JOB 3276, ab 1.202) gibt es ihn so NICHT MEHR — der Ersatz
    // gibt bei `assist` nur den geglätteten Originaltext zurück, und das ist seit 3276 bewusst kein
    // Vorschlag, sondern eine ehrliche Meldung. Der Fall wurde deshalb auf den Antwortgeber
    // umgestellt, den es wirklich gibt: den lokalen Anbieter.
    const { client, calls } = cloudSpyClient();
    const lokal = new LokalerProvider();
    const reasoner = new Reasoner(
      new ModelProvider(client),
      new WerfenderProvider("ersatz"),
      undefined,
      undefined,
      lokal,
    );

    const res = await reasoner.assistText(TEXT, "en", "Spelling", true);

    expect(lokal.aufrufe).toBe(1);
    expect(res.text).toContain("received");
    // Der vertrauliche Text hat den Rechner nicht verlassen.
    expect(calls()).toBe(0);
  });

  it("S6 POSITIV am ECHTEN Bestand — normaler DeterministicProvider, kein gestellter Ersatz: die Sperre entsteht von selbst", async () => {
    // S1 stellt den leeren Lauf mit einem eigenen Provider her, damit der Fall benennbar ist. DIESER
    // Fall stellt gar nichts: die Kette ist die des Produkts (Cloud verdrahtet, deterministischer
    // Ersatz), und der leere Ausgang entsteht durch JOB 3276 selbst — der Ersatz könnte nur den
    // geglätteten Originaltext zurückgeben, und das ist seit 3276 kein Vorschlag mehr. Genau diese
    // Lage hat Codex am 8.9. um 21:57 live gemessen.
    const { client, calls } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client), new DeterministicProvider());

    const fehler = await reasoner.assistText(TEXT, "en", "Spelling", true).catch((e: unknown) => e);

    expect(fehler).toBeInstanceOf(ConfidentialCloudBlockedError);
    // UND die Meldung ist die des Bestands (JOB 3276), nicht eine zweite Fassung derselben Tatsache:
    // der Typ ordnet ein, er formuliert nicht um.
    expect((fehler as Error).message).toContain("The AI returned no answer");
    expect((fehler as Error).message).toContain("classified as confidential");
    // Kein Nutzertext in der Meldung, und die Cloud wurde nie gerufen.
    expect((fehler as Error).message).not.toContain("router");
    expect(calls()).toBe(0);
  });
});
