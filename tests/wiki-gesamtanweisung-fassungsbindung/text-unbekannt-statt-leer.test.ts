// ================================================================================================
// JOB 4233 · TEST 4 — UNBEKANNTER TEXT IST UNBEKANNT UND NICHT LEER.
// ================================================================================================
//
// Dieselbe Regel, die `gesamtanweisung-types.ts:96-101` für Mengen schon aufstellt, jetzt für den
// Rumpf: `null` heisst UNBEKANNT. Es heisst nicht „diese Fassung hat keinen Text", und es wird
// niemals auf die heutige Fassung ausgewichen (F2, `gesamtanweisung-service.ts:311-314`).
//
// ZWEI WEGE FÜHREN ZU „UNBEKANNT", und beide stehen hier:
//   (a) die gebundene Fassung ist gar nicht auffindbar — dann ist auch `herkunft` null;
//   (b) die gebundene Fassung ist da, trägt aber keinen Rumpf.
// Der Fall (a) entsteht NICHT mehr durch Aufnehmen (das verhindert Test 1), sondern durch einen
// Bestand, der die Fassung später nicht mehr hergibt. Genau deshalb wird hier ein zweiter Dienst
// über DENSELBEN Anweisungsbestand mit einem ärmeren Eintragsbestand gebaut — die Anweisung bleibt,
// die Fassung verschwindet.
//
// Den zugehörigen Satz auf der FLÄCHE („Der Inhalt dieser Fassung ist nicht belegt.") prüft
// `lesestand-ansicht.test.tsx`; hier steht die Datenseite.
import { describe, expect, it } from "vitest";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import {
  InMemoryAnweisungRepo,
  eintrag,
  kennungen,
  koLeser,
  sichtbarAls,
  uhr,
} from "../wiki-gesamtanweisung/pruefstand";

const ANNA = sichtbarAls({ id: "anna", darfPruefen: true });

const MIT_FASSUNG = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 1 }, [
    { version: 1, bodyHtml: "<p>Erst absperren.</p>" },
  ]),
  // Fassung vorhanden, aber ohne Rumpf: `bodyHtml` fehlt ganz.
  eintrag({ id: "ko-ohne", title: "Ohne Rumpf", version: 1 }, [{ version: 1 }]),
];

/** Derselbe Eintrag, aber der Fassungssatz 1 liegt nicht mehr vor — heute gilt Fassung 2. */
const OHNE_FASSUNG = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 2 }, [
    { version: 2, bodyHtml: "<p>Ganz neu.</p>" },
  ]),
  eintrag({ id: "ko-ohne", title: "Ohne Rumpf", version: 1 }, [{ version: 1 }]),
];

function dienstUeber(repo: InMemoryAnweisungRepo, eintraege: typeof MIT_FASSUNG) {
  return new GesamtanweisungDienst({
    repo,
    ko: koLeser(eintraege),
    jetzt: uhr(),
    kennung: kennungen("b"),
  });
}

describe("JOB 4233 · unbekannter Text bleibt unbekannt", () => {
  it("(b) eine gebundene Fassung ohne Rumpf ergibt `null` — nicht den leeren String", async () => {
    const repo = new InMemoryAnweisungRepo();
    const dienst = dienstUeber(repo, MIT_FASSUNG);
    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
    const mit = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-ohne", koVersion: 1, nachweisHash: null },
      ANNA,
    );

    const stand = await dienst.lesen(mit.id, ANNA);
    expect(stand.bausteine[0]?.rumpfHtml).toBeNull();
    // Die Herkunft ist trotzdem bekannt — die Fassung gibt es ja, nur ihr Rumpf fehlt.
    expect(stand.bausteine[0]?.herkunft).not.toBeNull();
  });

  it("(a) ist die gebundene Fassung nicht mehr auffindbar, bleibt der Text unbekannt", async () => {
    const repo = new InMemoryAnweisungRepo();
    const vorher = dienstUeber(repo, MIT_FASSUNG);
    const a = await vorher.anlegen({ titel: "Wartung" }, "anna");
    const mit = await vorher.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
      ANNA,
    );

    const spaeter = dienstUeber(repo, OHNE_FASSUNG);
    const stand = await spaeter.lesen(mit.id, ANNA);

    expect(stand.bausteine).toHaveLength(1);
    expect(stand.bausteine[0]?.herkunft).toBeNull();
    expect(stand.bausteine[0]?.rumpfHtml).toBeNull();
    // KEIN AUSWEICHEN: der Text der heutigen Fassung taucht nirgends auf.
    expect(JSON.stringify(stand)).not.toContain("Ganz neu.");
  });

  it("KONTROLLFALL: mit vorhandener Fassung steht der Text da — sonst prüfte oben nichts", async () => {
    const repo = new InMemoryAnweisungRepo();
    const dienst = dienstUeber(repo, MIT_FASSUNG);
    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
    const mit = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
      ANNA,
    );
    const stand = await dienst.lesen(mit.id, ANNA);
    expect(stand.bausteine[0]?.rumpfHtml).toContain("Erst absperren.");
  });
});
