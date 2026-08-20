// ================================================================================================
// JOB 1164 · D1 — TV1 STUFE 1: DER TITELVORSCHLAG KOMMT AN DER DIENSTGRENZE HERAUS.
// ================================================================================================
//
// REICHWEITE, VORWEG UND OHNE BESCHÖNIGUNG: Dieser Test belegt SERVERINTERNE VORARBEIT. Er sagt
// nichts darüber, dass irgendein Anwender einen Titelvorschlag sieht — der Renderer ist Stufe 2
// und existiert nicht. Wer aus diesem grünen Test einen sichtbaren Nutzen liest, liest ihn falsch.
//
// WAS ER BELEGT, in drei Schichten:
//
//   1. DIE DIENSTGRENZE. `describeImage` setzt das Feld dort, wo auch `aiGenerated` zentral gesetzt
//      wird. Die Methode hat ZWEI Rückgabewege (Modell hat geantwortet / deterministischer Rückfall
//      mit Ursache) — genau diese zwei Ausgänge sind der Grund, warum die Kennzeichnung im Bestand
//      zentral gesetzt wird und nicht in den Providern (service.ts:969-972). Für den Titelvorschlag
//      gilt dasselbe, und der zweite Weg ist der, den man beim Bauen vergisst.
//
//   2. DER NEGATIVFALL, und er ist der wichtigere. Ohne ableitbaren Titel ist das Feld ABWESEND —
//      nicht null, nicht ein leerer String, nicht ein Objekt mit `titel: null`. „Kein Feld" ist eine
//      eindeutige Aussage; ein leeres Feld wäre eine, die man für einen Vorschlag halten kann.
//
//   3. BEIDE WIRETYPEN. Server und Client tragen denselben optionalen Zusatz. Der Client-Vertrag
//      wird über den QUELLTEXT geprüft und nicht über einen Import: `apps/web/src` darf nicht aus
//      `services/` importieren (der webbuild-Stage im Dockerfile kopiert nur `apps/web`; s.
//      `apps/web/src/api/types.ts:1079-1086` und `tests/reasoner/job615-public-status-task-
//      contract.test.ts`, das für die Aufgabenliste an genau dieser Stelle antritt).
//
// DER VERTRAULICHKEITSFALL IST KEIN RANDFALL. Ein vertrauliches Bild geht bewusst nicht an die
// Cloud-Vision. Entstünde daraus über den Umweg eines Titels doch noch eine Aussage, wäre der
// Egress-Ausschluss inhaltlich unterlaufen (titel-vorschlag.ts:43-48). Deshalb steht er hier als
// eigener Fall und nicht als Variante von „kein Text".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ModelProvider, Reasoner } from "../../services/reasoner";

const PNG_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

const SERVER_TYPES = join(__dirname, "../../services/reasoner/src/types.ts");
const WEB_TYPES = join(__dirname, "../../apps/web/src/api/types.ts");

/** Ein Vision-Provider, der genau den übergebenen Text liefert. Kein Netz, kein Schlüssel. */
function visionMit(text: string): ModelProvider {
  return new ModelProvider({
    name: "anthropic:test",
    complete: async () => "",
    completeVision: async () => text,
  });
}

/**
 * Der Rumpf von `DescribeImageResult` aus einer Quelldatei.
 *
 * Bewusst über den Quelltext: Für den Client gibt es keinen erlaubten Import (s. Kopf), und ein
 * Textvergleich sieht auch ein Feld, das zwar deklariert ist, aber niemanden mehr interessiert.
 */
function describeRumpf(datei: string): string {
  const text = readFileSync(datei, "utf8");
  const treffer = /export interface DescribeImageResult \{([\s\S]*?)\n\}/.exec(text);
  return treffer?.[1] ?? "";
}

describe("JOB 1164 · Dienstgrenze — der Vorschlag kommt aus describeImage heraus", () => {
  it("POSITIV: mit Vision-Modell trägt das Ergebnis den abgeleiteten Titel", async () => {
    const res = await new Reasoner(
      visionMit("Eine Kreiselpumpe mit blauem Gehäuse auf einem Prüfstand."),
    ).describeImage(PNG_URL, "de");

    expect(res.titelVorschlag).toBeDefined();
    expect(res.titelVorschlag?.grund).toBe("abgeleitet");
    // Der Titel ist die GEKÜRZTE Beschreibung, kein zweiter Modellaufruf: erster Satz, ohne
    // Schlusspunkt. Genau das unterscheidet eine Ableitung von einer Erfindung.
    expect(res.titelVorschlag?.titel).toBe(
      "Eine Kreiselpumpe mit blauem Gehäuse auf einem Prüfstand",
    );
  });

  it("POSITIV: der Titel ist der ERSTE Satz — die Erzählung bleibt draußen", async () => {
    const res = await new Reasoner(
      visionMit("Ein Kegelradgetriebe. Daneben liegt ein Schlüssel."),
    ).describeImage(PNG_URL, "de");

    expect(res.titelVorschlag?.titel).toBe("Ein Kegelradgetriebe");
  });

  it("NEGATIV: ohne Modell ist das Feld ABWESEND — nicht leer, nicht erfunden", async () => {
    const res = await new Reasoner().describeImage(PNG_URL, "de");

    // Die schärfste Form der Zusage: der Schlüssel existiert nicht. `toBeUndefined()` allein
    // wäre auch bei `titelVorschlag: undefined` grün — das wäre ein gesetztes Feld ohne Wert.
    expect("titelVorschlag" in res).toBe(false);
    // Die bestehende Ehrlichkeit bleibt unberührt daneben stehen.
    expect(res.titelVorschlag).toBeUndefined();
  });

  it("NEGATIV: leerer Modelltext erzeugt keinen Titel aus dem Nichts", async () => {
    const res = await new Reasoner(visionMit("   ")).describeImage(PNG_URL, "de");

    expect("titelVorschlag" in res).toBe(false);
  });

  it("NEGATIV: ein VERTRAULICHES Bild erzeugt auch über den Titel keine Aussage", async () => {
    // Cloud-Vision ist verdrahtet, das Bild ist vertraulich → die Cloud fällt aus der Kette, es
    // gibt keinen Text, und es darf auch keinen Titel geben. Würde hier ein Feld erscheinen, wäre
    // der Egress-Ausschluss inhaltlich unterlaufen.
    const res = await new Reasoner(visionMit("Der Bauplan der Anlage XY-7.")).describeImage(
      PNG_URL,
      "de",
      true,
    );

    expect(res.fallbackReason).toBe("confidential");
    expect("titelVorschlag" in res).toBe(false);
  });

  it("die bestehende Zusage bleibt unangetastet: aiGenerated wird weiter zentral gesetzt", async () => {
    // Das additive Feld darf nichts verdrängen. Beide Rückgabewege der Methode werden geprüft.
    const mitModell = await new Reasoner(visionMit("Eine Pumpe.")).describeImage(PNG_URL, "de");
    const ohneModell = await new Reasoner().describeImage(PNG_URL, "de");

    expect(mitModell.aiGenerated?.task).toBe("describe");
    expect(mitModell.demo).toBe(false);
    expect(ohneModell.aiGenerated?.task).toBe("describe");
    expect(ohneModell.fallbackReason).toBe("no-model");
  });
});

describe("JOB 1164 · Wiretyp — Server und Client tragen denselben optionalen Zusatz", () => {
  it("der Server-Wiretyp führt titelVorschlag additiv und OPTIONAL", () => {
    const rumpf = describeRumpf(SERVER_TYPES);
    expect(rumpf).toMatch(/titelVorschlag\?:/);
    // Additiv heißt: die Bestandsfelder stehen unverändert daneben. Wäre eines von ihnen zur
    // Pflicht geworden oder verschwunden, wäre das ein Bruch und kein Zusatz.
    expect(rumpf).toMatch(/text: string \| null/);
    expect(rumpf).toMatch(/demo: boolean/);
    expect(rumpf).toMatch(/fallbackReason\?:/);
    expect(rumpf).toMatch(/withContext\?:/);
    expect(rumpf).toMatch(/aiGenerated\?:/);
  });

  it("der Client-Wiretyp führt denselben optionalen Zusatz", () => {
    const rumpf = describeRumpf(WEB_TYPES);
    expect(rumpf).toMatch(/titelVorschlag\?:/);
    expect(rumpf).toMatch(/text: string \| null/);
    expect(rumpf).toMatch(/demo: boolean/);
    expect(rumpf).toMatch(/fallbackReason\?:/);
    expect(rumpf).toMatch(/withContext\?:/);
  });

  it("beide Seiten führen dieselbe geschlossene Gründemenge — keine stille Drift", () => {
    // Der Client darf nicht importieren, also hält er die Form selbst. Dieser Vergleich IST der
    // Ersatz für den verbotenen Import — dasselbe Verfahren wie bei REASONER_TASKS und
    // DRAFT_LIMITS. Läuft eine Seite weg, wird genau hier rot.
    const gruende = (rumpf: string): string[] =>
      [...rumpf.matchAll(/"(abgeleitet|kein_text|demo|vertraulich|leer)"/g)]
        .map((m) => m[1] as string)
        .filter((wert, i, alle) => alle.indexOf(wert) === i)
        .sort();

    const server = gruende(describeRumpf(SERVER_TYPES));
    expect(server).toEqual(["abgeleitet", "demo", "kein_text", "leer", "vertraulich"]);
    expect(gruende(describeRumpf(WEB_TYPES))).toEqual(server);
  });
});
