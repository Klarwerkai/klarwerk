// ================================================================================================
// JOB 3549 · DER KERN DER ADMIN-KI-FREIGABE — OHNE FREIGABE GEHT NICHTS HINAUS.
// ================================================================================================
//
// PEDIS ENTSCHEIDUNG (10.09. 21:25, über Codex 07cc6d07), gegen die hier gemessen wird:
//   „Öffentliche KI nur nach AUSDRÜCKLICHER Adminfreigabe. Keine Freigabe, kein Egress — auch nicht
//    bei einer Instanz, die heute läuft. Vertrauliche Inhalte zusätzlich mit Warnhinweis. Eine
//    bereits ausdrücklich DOKUMENTIERTE Freigabe darf erhalten bleiben. Bloße frühere NUTZUNG ist
//    KEINE Zustimmung. Im Zweifel gilt: gesperrt."
//
// WIE HIER GEMESSEN WIRD, und warum so: JEDER Fall zählt die ECHTEN Aufrufe am Modellclient
// (`rufe()`), nicht nur das Ergebnis. Ein Test, der bloß `demo === true` prüft, ginge auch dann
// grün durch, wenn der Text längst draußen war und der Rückweg scheiterte — und genau das ist der
// Fehler, den eine Egress-Sperre nicht machen darf. Wo eine Sperre behauptet wird, steht deshalb
// IMMER die Null daneben.
//
// DIE ANDERE RICHTUNG WIRD EBENSO GEMESSEN. Eine Sperre, die einfach alles sperrt, ist keine
// Freigabe, sondern ein Ausfall. Jede Sperre hier hat ihr Gegenstück: derselbe Aufbau, ein Schalter
// weiter, und der Weg ist offen. Ohne dieses Paar wäre nicht belegt, dass die Sperre GENAU an der
// Freigabe hängt und nicht an einer kaputten Verdrahtung.
import { describe, expect, it } from "vitest";
import { DeterministicProvider } from "../../services/reasoner/src/provider";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
import {
  InMemoryReasonerPolicyRepo,
  type ReasonerPolicyRepo,
} from "../../services/reasoner/src/reasoner-policy";
import { ConfidentialCloudBlockedError, Reasoner } from "../../services/reasoner/src/service";
import type {
  ReasonerTaskConfig,
  ReasonerTaskConfigEingabe,
} from "../../services/reasoner/src/types";

// ------------------------------------------------------------------------------------------------
// Aufbau
// ------------------------------------------------------------------------------------------------

/** Ein Cloud-Client, der jeden Aufruf mitzählt — die Zählung IST der Egress-Beleg. */
// Die Antwort ist gültiges JSON, weil die Modellwege sie PARSEN (`provider-model.ts:1793`). Ein
// unparsbarer Text ließe den Aufruf scheitern und die Kette weiterfallen — der Fall sähe dann aus
// wie eine Sperre, obwohl der Text längst draußen war. Genau diese Verwechslung darf hier nicht
// möglich sein.
function zaehlenderClient(name = "anthropic:test-modell", antwort = "{}") {
  const gesehen: string[] = [];
  const client: ModelClient = {
    name,
    complete: async (prompt: string) => {
      gesehen.push(prompt);
      return antwort;
    },
  };
  return { client, rufe: () => gesehen.length, gesehen };
}

/**
 * Ein Reasoner wie im Betrieb: EIN eingerichteter Cloud-Anbieter, ein echtes Policy-Repo.
 *
 * Bewusst ohne lokalen LLM: dieser Auftrag entscheidet über den Weg NACH DRAUSSEN, und ein
 * eingesprungener lokaler LLM würde die Frage „ist etwas hinausgegangen?" mit einer zweiten Antwort
 * verdecken. Der lokale Weg hat seinen eigenen Fall (Gruppe 5).
 */
function aufbau(opts: { repo?: ReasonerPolicyRepo; antwort?: string } = {}) {
  const cloud = zaehlenderClient("anthropic:test-modell", opts.antwort ?? "{}");
  const repo = opts.repo ?? new InMemoryReasonerPolicyRepo();
  const reasoner = new Reasoner(
    new ModelProvider(cloud.client),
    undefined,
    undefined,
    undefined,
    undefined,
    repo,
  );
  return { reasoner, cloud, repo };
}

/**
 * Die Freigabe setzen — über den ECHTEN Schreibweg des Dienstes, nicht über ein Feld von Hand.
 *
 * Der Testhelfer aus JOB 3550 (`testhelfer-ki-freigabe.ts`) ist hier ausdrücklich NICHT im Spiel:
 * er kann nur `true` schreiben, und dieser Ordner muss auch `false`, `{}` und Unfug messen können
 * (Gruppe 4). Diese Dateien gehören dem Kern und dürfen die Feldnamen deshalb nennen — der
 * Freigabe-Wächter aus JOB 3550 nimmt `tests/admin-ki-freigabe/**` genau dafür aus
 * (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`, Konstante `KERN`).
 */
async function setze(
  reasoner: Reasoner,
  kiFreigabe: unknown,
  rest: Partial<ReasonerTaskConfigEingabe> = {},
): Promise<ReasonerTaskConfig> {
  return reasoner.setTaskConfig({
    global: rest.global ?? "auto",
    perTask: rest.perTask ?? {},
    kiFreigabe,
  } as ReasonerTaskConfigEingabe);
}

/**
 * Ein Repo, das wie PostgreSQL über TEXT geht — kein geteiltes Objekt, echte Serialisierung.
 *
 * JOB 3549 R3: steht jetzt hier oben statt in Gruppe 6, weil Gruppe 7 dieselbe Bauart braucht. Die
 * Serialisierung ist der Punkt: ein geteiltes Objekt würde beweisen, dass ein Feld im GEDÄCHTNIS
 * überlebt — gefragt ist aber, ob es die ZEILE überlebt, denn das ist der Weg über einen Neustart.
 */
function jsonRepo(): ReasonerPolicyRepo & { zeile: () => string | null } {
  let zeile: string | null = null;
  return {
    async get() {
      return zeile === null ? null : (JSON.parse(zeile) as ReasonerTaskConfig);
    },
    async set(config) {
      zeile = JSON.stringify(config);
    },
    zeile: () => zeile,
  };
}

const VERTRAULICH = true;

/**
 * Ein deterministischer Ersatz, der bei `assistText` OHNE Ergebnis bleibt — für 3.1c.
 *
 * Wortgleich zu `ErsatzOhneErgebnis` in `services/app/src/routes/reasoner-routes.test.ts:171`, und
 * bewusst so: 3.1c ist der Dienst-nahe Wächter für genau den Fall, den die Route dort als B10 über
 * die ganze Kette misst. Stehen die beiden Aufbauten auseinander, bewacht 3.1c etwas anderes.
 */
class ErsatzOhneErgebnis extends DeterministicProvider {
  override async assistText(): Promise<never> {
    throw new Error("Ersatz: kein Ergebnis");
  }
}

/**
 * Einen KI-Weg fahren und einen ehrlichen Ausfall NICHT als Testfehler werten.
 *
 * `assistText` wirft bei fehlendem Vorschlag absichtlich (JOB 3276: lieber ein ehrlicher Satz als
 * ein Scheinvorschlag). Gemessen wird hier aber nicht, WIE der Weg endet, sondern OB etwas
 * hinausgegangen ist — und das sagt allein der Zähler. Den Ausfall zu verschlucken schwächt den
 * Fall deshalb nicht: die Aussage steht danach in `cloud.rufe()`, nicht im Rückgabewert.
 */
const ruhig = (p: Promise<unknown>): Promise<unknown> => p.catch(() => undefined);

/** Ein validierter Wissensbezug — `answer` ohne Kontext fragt kein Modell. */
const KONTEXT = [
  {
    id: "ko-1",
    title: "Pumpe P2",
    statement: "Pumpe P2 wird alle 200 Betriebsstunden geschmiert.",
    status: "validiert" as const,
    trust: 92,
  },
];

// ------------------------------------------------------------------------------------------------
// 1 · DIE SPERRE: ohne Freigabe verlässt nichts das Haus
// ------------------------------------------------------------------------------------------------

describe("JOB 3549 · 1 — ohne Freigabe kein Egress, auf JEDEM KI-Weg", () => {
  // Alle Wege, die einen Anbieter erreichen können, in EINER Tabelle. Ein neuer Weg gehört hier
  // hinein; steht er nicht da, ist er ungeprüft — und ein ungeprüfter Weg ist der einzige, auf dem
  // eine zentrale Sperre je gebrochen wurde.
  const wege: readonly [string, (r: Reasoner) => Promise<unknown>][] = [
    ["assistText", (r) => r.assistText("Ein roher Satz.", "de")],
    ["structure", (r) => r.structure("Protokoll: Pumpe P2 alle 200 h schmieren.", "de")],
    ["answer", (r) => r.answer("Wie oft wird Pumpe P2 geschmiert?", KONTEXT, "de")],
    ["enrichPublic", (r) => r.enrichPublic("Unkritische Testfrage", "de")],
    ["groupCandidates", (r) => r.groupCandidates([{ id: "a", title: "Pumpe" }], "de")],
    ["deriveImportCriteria", (r) => r.deriveImportCriteria("Alles zu Pumpen", "de", false)],
    ["judgeConflictOutcome", (r) => r.judgeConflictOutcome("Rezeptur 3 %", "Rezeptur 4 %", "de")],
    ["judgeDuplicateOutcome", (r) => r.judgeDuplicateOutcome("Text A", "Text B", "de")],
  ];

  for (const [name, ruf] of wege) {
    it(`1.1 · ${name}: keine Freigabe ⇒ NULL Modellaufrufe (der Anbieter ist eingerichtet)`, async () => {
      const { reasoner, cloud } = aufbau();
      // Der Anbieter IST verdrahtet und verfügbar — die Null kommt von der Freigabe, nicht von
      // einer fehlenden Verdrahtung. Ohne diese Zeile wäre der Fall wertlos.
      expect(reasoner.configStatus().cloudProviders.anthropic.configured).toBe(true);
      await ruhig(ruf(reasoner));
      expect([name, cloud.rufe()]).toEqual([name, 0]);
    });

    it(`1.2 · ${name}: MIT Grundfreigabe geht derselbe Aufruf hinaus (Gegenstück zu 1.1)`, async () => {
      const { reasoner, cloud } = aufbau();
      await setze(reasoner, { oeffentlicheKi: true });
      await ruhig(ruf(reasoner));
      expect([name, cloud.rufe() > 0]).toEqual([name, true]);
    });
  }

  it("1.3 · auch eine AUSDRÜCKLICHE Anbieterwahl ist keine Freigabe — bloße Nutzung ist keine Zustimmung", async () => {
    const { reasoner, cloud } = aufbau();
    // „Der Administrator hat ChatGPT/Claude gewählt" ist eine Wahl ZWISCHEN Anbietern, keine
    // Zustimmung DAZU, dass überhaupt etwas an eine öffentliche KI geht. Pedi: „Bloße frühere
    // NUTZUNG ist KEINE Zustimmung. Im Zweifel gilt: gesperrt."
    await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });
    expect(reasoner.configStatus().taskConfig.global).toBe("anthropic");
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();
    const res = await reasoner.structure("Ein roher Satz.", "de");
    expect(cloud.rufe()).toBe(0);
    expect(res.demo).toBe(true);
  });

  it("1.4 · der deterministische Ersatz trägt weiter — gesperrt heißt nicht kaputt", async () => {
    const { reasoner } = aufbau();
    const res = await reasoner.structure("Protokoll: Pumpe P2 alle 200 h schmieren.", "de");
    expect(res.demo).toBe(true);
    // FR-RSN-04: es kommt IMMER eine Antwort. Eine Sperre, die den Flow zerlegt, wäre keine.
    expect(res.statement).toBeTruthy();
  });
});

// ------------------------------------------------------------------------------------------------
// 2 · DIE ZWEITE, GETRENNTE FREIGABE für vertrauliche Inhalte
// ------------------------------------------------------------------------------------------------

describe("JOB 3549 · 2 — vertrauliche Inhalte brauchen die ZWEITE Freigabe", () => {
  it("2.1 · Grundfreigabe allein: nicht vertraulich geht hinaus, VERTRAULICHES nicht", async () => {
    const { reasoner, cloud } = aufbau();
    await setze(reasoner, { oeffentlicheKi: true });

    await reasoner.structure("Normaler Rohtext.", "de", false);
    expect(cloud.rufe()).toBe(1);

    const vertraulich = await reasoner.structure(
      "Vertrauliche Rezeptur: 3 % Zusatz Z.",
      "de",
      VERTRAULICH,
    );
    // Kein zweiter Aufruf — der vertrauliche Text ist NICHT hinausgegangen.
    expect(cloud.rufe()).toBe(1);
    expect(vertraulich.demo).toBe(true);
    // Und die Ursache ist ehrlich unterscheidbar: es fehlt nicht das Modell, es darf den Text nicht sehen.
    expect(vertraulich.fallbackReason).toBe("confidential");
  });

  it("2.2 · BEIDE Freigaben: derselbe vertrauliche Text geht hinaus (Gegenstück zu 2.1)", async () => {
    const { reasoner, cloud } = aufbau();
    await setze(reasoner, { oeffentlicheKi: true, vertraulicheInhalte: true });
    const res = await reasoner.structure("Vertrauliche Rezeptur: 3 % Zusatz Z.", "de", VERTRAULICH);
    expect(cloud.rufe()).toBe(1);
    expect(res.demo).toBe(false);
  });

  it("2.3 · die zweite Freigabe ALLEIN ist wirkungslos — sie erweitert die erste, sie ersetzt sie nicht", async () => {
    const { reasoner, cloud } = aufbau();
    await setze(reasoner, { vertraulicheInhalte: true });
    await reasoner.structure("Normaler Rohtext.", "de", false);
    await reasoner.structure("Vertrauliche Rezeptur.", "de", VERTRAULICH);
    expect(cloud.rufe()).toBe(0);
  });

  it("2.4 · die Einstufung wird NICHT verändert — nur die Erlaubnis", async () => {
    const { reasoner, cloud } = aufbau();
    await setze(reasoner, { oeffentlicheKi: true, vertraulicheInhalte: true });
    // Das Paar-Bit reist unverändert bis zum Client durch (SCRUM-502 Schicht 2). Die Freigabe hebt
    // den Riegel, sie fälscht keine Einstufung — sonst wäre der Warnhinweis in 3501 eine Lüge.
    await reasoner.structure("Vertraulicher Text.", "de", VERTRAULICH);
    expect(cloud.rufe()).toBe(1);
    const res = await reasoner.structure("Nicht vertraulich.", "de", false);
    expect(res.demo).toBe(false);
    expect(cloud.rufe()).toBe(2);
  });
});

// ------------------------------------------------------------------------------------------------
// 3 · EINE ENTSCHEIDUNGSSTELLE: alle Fundstellen antworten gleich
// ------------------------------------------------------------------------------------------------

describe("JOB 3549 · 3 — eine Entscheidung, überall dieselbe Antwort", () => {
  // ----------------------------------------------------------------------------------------------
  // 3.1/3.2 · DIE URSACHENFRAGE IST FREIGABE-NEUTRAL — und warum das in Runde 2 zurückgedreht wurde.
  //
  // Runde 1 ließ die Ursache dem Riegel folgen: ohne Grundfreigabe hieß sie „no-model", weil der Weg
  // ohnehin zu war. Das war nachweislich ein Rückschritt. `runTask` wirft den typisierten
  // `ConfidentialCloudBlockedError` NUR bei „confidential" (`service.ts:1297`); wurde die Ursache
  // durch die fehlende Freigabe zu „no-model", blieb der ROHE Providerfehler übrig und die Route
  // antwortete mit **HTTP 500** statt mit 409 — gemessen an
  // `services/app/src/routes/reasoner-routes.test.ts:443` („expected 500 to be 409").
  //
  // Deshalb misst 3.1 jetzt das Gegenteil, und zwar bewusst: die Ursache benennt die Wirkung des
  // VERTRAULICHKEITS-Bits und nichts sonst. Sie wird nicht dadurch unwahr, dass daneben auch die
  // Freigabe fehlt — der Text IST vertraulich, eine Cloud IST verdrahtet. Die fehlende Freigabe hat
  // ihre eigene, ehrliche Stelle: `configStatus().taskConfig.kiFreigabe`.
  // ----------------------------------------------------------------------------------------------
  it("3.1 · OHNE Freigabe sagen BEIDE Fundstellen ‚confidential‘ — und nichts geht dabei hinaus", async () => {
    const { reasoner, cloud } = aufbau();
    // aufgabenbezogen (`cloudExcludedByConfidentiality`) …
    const res = await reasoner.structure("Vertraulicher Text.", "de", VERTRAULICH);
    expect(res.fallbackReason).toBe("confidential");
    // … und aufgabenlos (`judgeProviders`). Zwei Wahrheiten über denselben Sachverhalt sind genau
    // der Fehler, den dieser Auftrag beseitigt.
    const urteil = await reasoner.judgeConflictOutcome("A", "B", "de", VERTRAULICH);
    expect(urteil.failure).toBe("confidential");
    // Die Ursache ist eine AUSKUNFT, keine Erlaubnis: der Riegel steht unverändert.
    expect(cloud.rufe()).toBe(0);
  });

  it("3.2 · MIT Grundfreigabe dieselbe Antwort an denselben zwei Stellen — die Ursache hängt nicht am Riegel", async () => {
    const { reasoner, cloud } = aufbau();
    await setze(reasoner, { oeffentlicheKi: true });
    const res = await reasoner.structure("Vertraulicher Text.", "de", VERTRAULICH);
    expect(res.fallbackReason).toBe("confidential");
    const urteil = await reasoner.judgeConflictOutcome("A", "B", "de", VERTRAULICH);
    expect(urteil.failure).toBe("confidential");
    // Der Unterschied zu 3.1 ist NICHT die Ursache, sondern allein die Erlaubnis — hier fehlt die
    // zweite Freigabe, also bleibt der vertrauliche Text drinnen wie in 3.1.
    expect(cloud.rufe()).toBe(0);
  });

  // Das Gegenstück, das 3.1 erst zu einem Beleg macht: OHNE verdrahtete Cloud gibt es nichts, was
  // die Vertraulichkeit ausschließen könnte — dann ist „no-model" die ehrliche Ursache, und zwar an
  // beiden Fundstellen. Ohne diesen Fall wäre nicht belegt, dass „confidential" von der Verdrahtung
  // kommt und nicht einfach immer dasteht.
  it("3.1b · ohne verdrahtete Cloud bleibt die Ursache ‚no-model‘ — an beiden Fundstellen", async () => {
    const reasoner = new Reasoner(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new InMemoryReasonerPolicyRepo(),
    );
    const res = await reasoner.structure("Vertraulicher Text.", "de", VERTRAULICH);
    expect(res.fallbackReason).toBe("no-model");
    const urteil = await reasoner.judgeConflictOutcome("A", "B", "de", VERTRAULICH);
    expect(urteil.failure).toBe("no-model");
  });

  // DER FALL, DEN RUNDE 1 GEBROCHEN HAT — hier als eigener Wächter, damit er nicht wieder
  // unbemerkt kippt. Kein Modell in der Kette, der deterministische Ersatz bleibt ohne Ergebnis:
  // dann ist der typisierte Fehler die EINZIGE Form, in der die Auskunft den Aufrufer erreicht.
  // Bleibt er aus, wird daraus auf der Route ein nichtssagendes HTTP 500.
  it("3.1c · vertraulich, Cloud verdrahtet, KEINE Freigabe, Ersatz ohne Ergebnis ⇒ typisierter Fehler statt roher Fehler", async () => {
    // Der deterministische Ersatz bleibt ohne Ergebnis — wie im Betrieb, wenn er nichts anzubieten
    // hat. Genau diese Lage fährt `services/app/src/routes/reasoner-routes.test.ts:418` (B10), und
    // dort wird aus dem rohen Fehler auf der Route ein HTTP 500.
    const cloud = zaehlenderClient();
    const reasoner = new Reasoner(
      new ModelProvider(cloud.client),
      new ErsatzOhneErgebnis(),
      undefined,
      undefined,
      undefined,
      new InMemoryReasonerPolicyRepo(),
    );

    const fehler = await reasoner
      .assistText("the customer recieved the router.", "de", undefined, VERTRAULICH)
      .then(
        () => undefined,
        (e: unknown) => e,
      );

    expect(fehler).toBeInstanceOf(ConfidentialCloudBlockedError);
    // Und die Schutzregel, um die es die ganze Zeit geht: hinausgegangen ist nichts.
    expect(cloud.rufe()).toBe(0);
  });

  it("3.3 · je Aufgabe abweichend gestellt: die Freigabe gilt trotzdem zentral", async () => {
    const { reasoner, cloud } = aufbau();
    await setze(
      reasoner,
      { oeffentlicheKi: true },
      { global: "auto", perTask: { assist: "deterministic" } },
    );
    await ruhig(reasoner.assistText("Roh.", "de"));
    // `assist` ist bewusst deterministisch gestellt — die Freigabe erlaubt, sie verlangt nicht.
    expect(cloud.rufe()).toBe(0);
    await reasoner.structure("Roh.", "de");
    expect(cloud.rufe()).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// 4 · NUR `true` ZÄHLT
// ------------------------------------------------------------------------------------------------

describe("JOB 3549 · 4 — nur `true` erlaubt; `false` und „fehlt“ sperren gleich", () => {
  const sperrend: readonly [string, unknown][] = [
    ["fehlt ganz", undefined],
    ["leeres Objekt", {}],
    ["ausdrückliches false", { oeffentlicheKi: false }],
    ["Zeichenkette 'true'", { oeffentlicheKi: "true" }],
    ["Zahl 1", { oeffentlicheKi: 1 }],
    ["null", null],
    ["kein Objekt", "oeffentlicheKi"],
  ];

  for (const [name, wert] of sperrend) {
    it(`4.1 · ${name} ⇒ gesperrt, und das Feld steht danach NICHT in der Zuordnung`, async () => {
      const { reasoner, cloud } = aufbau();
      await setze(reasoner, wert);
      await ruhig(reasoner.assistText("Roh.", "de"));
      expect([name, cloud.rufe()]).toEqual([name, 0]);
      // „Gesperrt" hat genau EINE Darstellung. Bliebe hier `{ oeffentlicheKi: false }` stehen,
      // müsste jede spätere Prüfung zwei Arten von „nicht freigegeben" kennen.
      expect([name, reasoner.configStatus().taskConfig.kiFreigabe]).toEqual([name, undefined]);
    });
  }

  it("4.2 · eine Rücknahme auf `false` schaltet eine erteilte Freigabe wieder ab", async () => {
    const { reasoner, cloud } = aufbau();
    await setze(reasoner, { oeffentlicheKi: true });
    await ruhig(reasoner.assistText("eins", "de"));
    expect(cloud.rufe()).toBe(1);

    await setze(reasoner, { oeffentlicheKi: false });
    await ruhig(reasoner.assistText("zwei", "de"));
    expect(cloud.rufe()).toBe(1); // kein weiterer Aufruf
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();
  });

  it("4.3 · Teilrücknahme: die zweite Freigabe fällt, die erste bleibt", async () => {
    const { reasoner, cloud } = aufbau();
    await setze(reasoner, { oeffentlicheKi: true, vertraulicheInhalte: true });
    await setze(reasoner, { oeffentlicheKi: true, vertraulicheInhalte: false });
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toEqual({ oeffentlicheKi: true });
    await reasoner.structure("Vertraulich.", "de", VERTRAULICH);
    expect(cloud.rufe()).toBe(0);
    await reasoner.structure("Normal.", "de", false);
    expect(cloud.rufe()).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// 5 · ANZEIGE UND EGRESS SIND GETRENNT
// ------------------------------------------------------------------------------------------------

describe("JOB 3549 · 5 — der Anbieter bleibt sichtbar, der Weg bleibt zu", () => {
  it("5.1 · ohne Freigabe: Anbieter, Modell und `mode: model` stehen da — es gibt keinen Demo-Sonderweg", async () => {
    const { reasoner, cloud } = aufbau();
    const cfg = reasoner.configStatus();
    // Pedis Wortlaut (PRIORITAETEN.md): „Der Anbieter bleibt sichtbar, es gibt keinen
    // Demo-Sonderweg." Stünde hier „kein KI-Modell", fände niemand den Schalter, der zu setzen wäre.
    expect(cfg.provider).toBe("anthropic:test-modell");
    expect(cfg.mode).toBe("model");
    expect(cfg.configured).toBe(true);
    expect(cfg.cloudConfigured).toBe(true);
    expect(cfg.effectiveAnbieter.structure).toBe("anthropic");
    expect(cfg.effectiveProvider.structure).toBe("cloud");
    expect(reasoner.status().active).toBe(true);
    // … UND TROTZDEM GEHT NICHTS HINAUS. Sichtbarkeit ist keine Erlaubnis.
    await reasoner.structure("Roh.", "de");
    expect(cloud.rufe()).toBe(0);
  });

  it("5.2 · was WIRKLICH läuft, steht daneben und ist ehrlich: `effective`, `tasks`, `billable`", async () => {
    const { reasoner } = aufbau();
    const ohne = reasoner.configStatus();
    // Das ist die Auskunft, aus der JOB 3501 „eingerichtet · Freigabe fehlt" baut: der Anbieter
    // steht oben, hier steht, dass er nicht arbeitet.
    expect(ohne.effective.structure).toBe("deterministic");
    expect(reasoner.publicStatus().tasks.structure).toBe(false);
    // Und der Kostenhinweis lügt nicht: ein Klick kann nichts kosten, wenn nichts hinausgeht.
    expect(reasoner.publicStatus().billable.structure).toBe(false);

    await setze(reasoner, { oeffentlicheKi: true });
    const mit = reasoner.configStatus();
    expect(mit.effective.structure).toBe("model");
    expect(reasoner.publicStatus().tasks.structure).toBe(true);
    expect(reasoner.publicStatus().billable.structure).toBe(true);
    // Die ANZEIGE hat sich dabei NICHT geändert — nur der Weg hat sich geöffnet.
    expect(mit.provider).toBe(ohne.provider);
    expect(mit.mode).toBe(ohne.mode);
    expect(mit.effectiveAnbieter).toEqual(ohne.effectiveAnbieter);
  });

  it("5.3 · der lokale LLM bleibt unberührt — die Freigabe regelt den Weg NACH DRAUSSEN", async () => {
    const cloud = zaehlenderClient("anthropic:test-modell", "AUS DER CLOUD");
    const lokal = zaehlenderClient("local:Qwen3-32B-AWQ", "AUS DEM HAUS");
    const reasoner = new Reasoner(
      new ModelProvider(cloud.client),
      undefined,
      undefined,
      undefined,
      new ModelProvider(lokal.client),
    );
    // Ohne Freigabe: die Cloud fällt aus der Kette, der eigene LLM trägt weiter. Er verlässt das
    // Haus nicht, also hat die Freigabe über ihn nichts zu sagen.
    // Hier NICHT `ruhig`: dieser Fall behauptet, dass der lokale LLM wirklich antwortet — ein
    // verschluckter Ausfall würde genau die Aussage entwerten.
    const res = await reasoner.assistText("Roh.", "de");
    expect(res.text).toBe("AUS DEM HAUS");
    expect(res.demo).toBe(false);
    expect(cloud.rufe()).toBe(0);
    expect(lokal.rufe()).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// 6 · PERSISTENZ: die Freigabe überlebt den Neustart, die fehlende Freigabe auch
// ------------------------------------------------------------------------------------------------

describe("JOB 3549 · 6 — die Freigabe übersteht das Neuladen", () => {
  it("6.1 · erteilt, Instanz neu gebaut: die Freigabe gilt weiter — und der Weg ist offen", async () => {
    const repo = jsonRepo();
    const erste = aufbau({ repo });
    await setze(erste.reasoner, { oeffentlicheKi: true, vertraulicheInhalte: true });
    // Sie liegt WIRKLICH in der gespeicherten Zeile, nicht nur im Prozessgedächtnis.
    expect(repo.zeile()).toContain("oeffentlicheKi");

    const zweite = aufbau({ repo });
    const geladen = await zweite.reasoner.loadPersistedPolicy();
    expect(geladen.source).toBe("persisted");
    expect(zweite.reasoner.configStatus().taskConfig.kiFreigabe).toEqual({
      oeffentlicheKi: true,
      vertraulicheInhalte: true,
    });
    await zweite.reasoner.structure("Vertraulich.", "de", VERTRAULICH);
    expect(zweite.cloud.rufe()).toBe(1);
  });

  it("6.2 · nie erteilt, Instanz neu gebaut: gesperrt bleibt gesperrt", async () => {
    const repo = jsonRepo();
    const erste = aufbau({ repo });
    await erste.reasoner.setTaskConfig({ global: "anthropic", perTask: {} });

    const zweite = aufbau({ repo });
    await zweite.reasoner.loadPersistedPolicy();
    expect(zweite.reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();
    await ruhig(zweite.reasoner.assistText("Roh.", "de"));
    expect(zweite.cloud.rufe()).toBe(0);
  });

  it("6.3 · ein LADEFEHLER erteilt nichts — fail-closed bleibt fail-closed", async () => {
    const kaputt: ReasonerPolicyRepo = {
      async get() {
        throw new Error("DB weg");
      },
      async set() {
        /* egal */
      },
    };
    const { reasoner, cloud } = aufbau({ repo: kaputt });
    const geladen = await reasoner.loadPersistedPolicy();
    expect(geladen.source).toBe("load-error");
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();
    await ruhig(reasoner.assistText("Roh.", "de"));
    expect(cloud.rufe()).toBe(0);
  });

  // JOB 3549 R3 · DAS GEGENSTÜCK ZU GRUPPE 4 AUF DEM ANDEREN WEG HEREIN.
  //
  // Gruppe 4 misst „nur `true` zählt" am SCHREIBWEG (`setTaskConfig`). Die Datenbank ist aber eine
  // ZWEITE Eingangsstelle mit eigenem Code (`loadFromRepoOrFailClosed` → `normalizeTaskConfig`), und
  // sie ist die gefährlichere: eine Zeile kann aus einer älteren Version stammen, von Hand geändert
  // oder halb geschrieben sein. Wäre die Verengung nur im Schreibweg, käme ein `"true"` aus der Zeile
  // ungeprüft in die Laufzeit — und die Sperre hinge an der Zufälligkeit, wie ein Wert gespeichert
  // wurde. Deshalb hier dieselbe Tabelle wie in 4.1, aber durch die ZEILE statt durch den Adminweg.
  it("6.4 · ein verfälschter Freigabewert AUS DER GESPEICHERTEN ZEILE wird beim Laden verworfen", async () => {
    const unfug: readonly string[] = [
      '{"oeffentlicheKi":"true"}', // Zeichenkette statt Boolean (der klassische JSON-Fehler)
      '{"oeffentlicheKi":1}', // Zahl statt Boolean
      '{"oeffentlicheKi":false}', // ausdrückliches Nein
      "{}", // leeres Objekt — „gefragt, aber nichts erlaubt"
      "null", // Feld da, Wert weg
      '"ja"', // gar kein Objekt
    ];
    for (const wert of unfug) {
      const zeile = `{"global":"anthropic","perTask":{},"kiFreigabe":${wert}}`;
      const repo: ReasonerPolicyRepo = {
        async get() {
          return JSON.parse(zeile) as ReasonerTaskConfig;
        },
        async set() {
          /* dieser Fall schreibt nicht */
        },
      };
      const { reasoner, cloud } = aufbau({ repo });
      const geladen = await reasoner.loadPersistedPolicy();
      expect(geladen.source).toBe("persisted");
      // Die ZUORDNUNG kommt an (die Zeile ist nicht kaputt, nur die Freigabe ist keine) …
      expect(reasoner.configStatus().taskConfig.global).toBe("anthropic");
      // … und „gesperrt" hat genau EINE Darstellung: kein Feld. Kein `{}`, kein `false`-Rest.
      expect(reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();
      await ruhig(reasoner.assistText("Roh.", "de"));
      expect(cloud.rufe(), `Zeile mit kiFreigabe=${wert} hat Egress erlaubt`).toBe(0);
    }
  });

  // Das Gegenstück, ohne das 6.4 auch dann grün wäre, wenn das Laden die Freigabe IMMER verwirft.
  it("6.4b · … und ein echtes `true` aus derselben Zeile kommt sehr wohl an", async () => {
    const repo: ReasonerPolicyRepo = {
      async get() {
        return JSON.parse(
          '{"global":"anthropic","perTask":{},"kiFreigabe":{"oeffentlicheKi":true}}',
        ) as ReasonerTaskConfig;
      },
      async set() {
        /* dieser Fall schreibt nicht */
      },
    };
    const { reasoner, cloud } = aufbau({ repo });
    await reasoner.loadPersistedPolicy();
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toEqual({ oeffentlicheKi: true });
    await ruhig(reasoner.assistText("Roh.", "de"));
    expect(cloud.rufe()).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// 7 · NIE EINE FREIGABE ALS VORGABEWERT
// ------------------------------------------------------------------------------------------------

describe("JOB 3549 · 7 — keine Freigabe entsteht von selbst", () => {
  it("7.1 · frisch gebaut, nichts geladen: keine Freigabe", () => {
    const { reasoner } = aufbau();
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();
  });

  it("7.2 · leeres Repo (‚nie konfiguriert‘) ⇒ Default ohne Freigabe", async () => {
    const { reasoner, cloud } = aufbau();
    const geladen = await reasoner.loadPersistedPolicy();
    expect(geladen.source).toBe("default");
    expect(geladen.config.kiFreigabe).toBeUndefined();
    await ruhig(reasoner.assistText("Roh.", "de"));
    expect(cloud.rufe()).toBe(0);
  });

  it("7.3 · der Deploy-ENV-Weg erteilt keine Freigabe — auch nicht mit einem Anbieter darin", async () => {
    const { reasoner, cloud } = aufbau();
    const geladen = await reasoner.loadPersistedPolicy({ envGlobal: "anthropic" });
    expect(geladen.source).toBe("env");
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();
    await ruhig(reasoner.assistText("Roh.", "de"));
    expect(cloud.rufe()).toBe(0);
  });

  it("7.4 · ein migrierter Altwert (`cloud`) erteilt keine Freigabe", async () => {
    const { reasoner, cloud } = aufbau();
    await reasoner.setTaskConfig({ global: "cloud", perTask: {} } as ReasonerTaskConfigEingabe);
    // Der abgelöste Wert wird migriert und gemeldet — aber er ist eine ZUORDNUNG, keine Erlaubnis.
    expect(reasoner.configStatus().migration).toEqual({
      global: { von: "cloud", nach: "anthropic" },
      perTask: {},
    });
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();
    await ruhig(reasoner.assistText("Roh.", "de"));
    expect(cloud.rufe()).toBe(0);
  });

  // ==============================================================================================
  // JOB 3549 R3 · DER FALL, DEN §4 SATZ 3 MEINT — UND SEIN PREIS. BEIDES GEMESSEN, NICHTS BEHAUPTET.
  // ==============================================================================================
  //
  // 7.3 misst den ENV-Weg auf einer Instanz OHNE gespeicherte Freigabe: er erteilt keine. Der
  // interessante Fall ist der andere, und er war bis hierher ungeprüft: eine Instanz, auf der ein
  // Administrator die Freigabe AUSDRÜCKLICH erteilt hat, bekommt beim nächsten Start einen
  // Deploy-ENV-Override (`KLARWERK_REASONER_POLICY`) — der regelt die ZUORDNUNG, nicht die
  // Zustimmung. Was gilt dann?
  //
  // GEMESSEN GILT: während des Overrides ist der Weg ZU (7.5), und sobald der Override wieder weg
  // ist, gilt dieselbe dokumentierte Freigabe unverändert (7.6). Sie wird also unterdrückt, nicht
  // gelöscht — die gespeicherte Zeile bleibt unberührt, weil der ENV-Weg nie in die Datenbank
  // schreibt (`service.ts:1057-1063`, „TRANSIENT, wird NICHT persistiert").
  //
  // WARUM DAS SO RICHTIG IST und nicht bloß so herauskommt: der ENV-Zustand sperrt zugleich den
  // Adminweg (`ReasonerPolicyLockedError` → 409, Fall R10). Auf einer ENV-gepinnten Instanz könnte
  // ein Administrator eine wirksame Freigabe also nicht mehr ZURÜCKNEHMEN. Von den beiden möglichen
  // Antworten — „wirksam, aber unwiderruflich" und „unwirksam, jederzeit wiederherstellbar" — ist
  // nur die zweite mit Pedis Satz „Im Zweifel gilt: gesperrt" verträglich. Der Preis steht daneben
  // und wird hier ausdrücklich mitgemessen: eine ENV-gepinnte Instanz fährt ohne öffentliche KI,
  // bis die ENV entfernt wird. Das ist eine Betriebsfolge, kein Datenverlust — 7.6 ist ihr Beleg.
  it("7.5 · erteilt, dann ein ENV-Override: der Weg ist ZU — und die gespeicherte Zeile bleibt", async () => {
    const repo = jsonRepo();
    const erste = aufbau({ repo });
    await setze(erste.reasoner, { oeffentlicheKi: true, vertraulicheInhalte: true });
    const zeileVorher = repo.zeile();
    expect(zeileVorher).toContain("oeffentlicheKi");

    const zweite = aufbau({ repo });
    const geladen = await zweite.reasoner.loadPersistedPolicy({ envGlobal: "anthropic" });
    expect(geladen.source).toBe("env");
    // Die Freigabe ist NICHT wirksam …
    expect(zweite.reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();
    await ruhig(zweite.reasoner.assistText("Roh.", "de"));
    expect(zweite.cloud.rufe()).toBe(0);
    // … der Anbieter aber weiterhin sichtbar (Gruppe 5 gilt auch hier: Sichtbarkeit ≠ Erlaubnis) …
    expect(zweite.reasoner.configStatus().provider).toBe("anthropic:test-modell");
    expect(zweite.reasoner.configStatus().effectiveAnbieter.structure).toBe("anthropic");
    // … und die Zeile ist Zeichen für Zeichen dieselbe: unterdrückt, nicht gelöscht.
    expect(repo.zeile()).toBe(zeileVorher);
  });

  it("7.6 · ohne den ENV-Override gilt dieselbe dokumentierte Freigabe wieder — sie war nie weg", async () => {
    const repo = jsonRepo();
    const erste = aufbau({ repo });
    await setze(erste.reasoner, { oeffentlicheKi: true, vertraulicheInhalte: true });

    // Start MIT Override (der Weg ist zu, s. 7.5) …
    await aufbau({ repo }).reasoner.loadPersistedPolicy({ envGlobal: "anthropic" });
    // … und der nächste Start OHNE ihn.
    const danach = aufbau({ repo });
    const geladen = await danach.reasoner.loadPersistedPolicy();
    expect(geladen.source).toBe("persisted");
    expect(danach.reasoner.configStatus().taskConfig.kiFreigabe).toEqual({
      oeffentlicheKi: true,
      vertraulicheInhalte: true,
    });
    // Und zwar wirksam, bis in den vertraulichen Weg hinein — nicht nur als Feld im Status.
    await danach.reasoner.structure("Vertraulich.", "de", VERTRAULICH);
    expect(danach.cloud.rufe()).toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// 8 · WEGLASSEN LÄSST DIE FREIGABE UNVERÄNDERT
// ------------------------------------------------------------------------------------------------

describe("JOB 3549 · 8 — ein Speichern der Zuordnung rührt die Freigabe nicht an", () => {
  it("8.1 · erteilt, dann nur die Zuordnung gespeichert: die Freigabe bleibt", async () => {
    const { reasoner, cloud } = aufbau();
    await setze(reasoner, { oeffentlicheKi: true });
    // Genau das tut die Bestands-Oberfläche: sie schickt `global`/`perTask` und kennt das neue Feld
    // (noch) nicht. Sie darf die Freigabe dabei nicht löschen.
    await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toEqual({ oeffentlicheKi: true });
    await ruhig(reasoner.assistText("Roh.", "de"));
    expect(cloud.rufe()).toBe(1);
  });

  it("8.2 · NICHT erteilt, nur die Zuordnung gespeichert: es entsteht keine Freigabe", async () => {
    const { reasoner, cloud } = aufbau();
    await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });
    await reasoner.setTaskConfig({ global: "auto", perTask: {} });
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toBeUndefined();
    await ruhig(reasoner.assistText("Roh.", "de"));
    expect(cloud.rufe()).toBe(0);
  });

  it("8.3 · das Weglassen überlebt auch die Persistenz (kein Verlust über die Zeile)", async () => {
    const repo = new InMemoryReasonerPolicyRepo();
    const { reasoner } = aufbau({ repo });
    await setze(reasoner, { oeffentlicheKi: true });
    await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });
    const gespeichert = await repo.get();
    expect(gespeichert?.kiFreigabe).toEqual({ oeffentlicheKi: true });
  });

  it("8.4 · der gespeicherte Wert ist eine KOPIE — eine spätere Änderung wirkt nicht rückwärts", async () => {
    const repo = new InMemoryReasonerPolicyRepo();
    const { reasoner } = aufbau({ repo });
    await setze(reasoner, { oeffentlicheKi: true });
    const ersteLesung = await repo.get();
    // Am gelesenen Objekt herumschreiben darf den Speicher nicht verändern.
    if (ersteLesung?.kiFreigabe) {
      (ersteLesung.kiFreigabe as { vertraulicheInhalte?: boolean }).vertraulicheInhalte = true;
    }
    const zweiteLesung = await repo.get();
    expect(zweiteLesung?.kiFreigabe).toEqual({ oeffentlicheKi: true });
    // Und auch die Laufzeit ist davon unberührt geblieben.
    expect(reasoner.configStatus().taskConfig.kiFreigabe).toEqual({ oeffentlicheKi: true });
  });
});
