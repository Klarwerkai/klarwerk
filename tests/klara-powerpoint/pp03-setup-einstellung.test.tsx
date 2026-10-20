// ================================================================================================
// produkt:20261015:klara-powerpoint-validierung (PP-03) · SETUP › KLARA „OFFENE DATENPUNKTE“.
// ================================================================================================
//
// Die Einstellung liegt im vorhandenen Assistenzprofil (`assistenz-profil.ts`, derselbe Weg wie
// OCR-03 `bildAutomatik`). Geprüft am echten Dienst mit der Speicherablage; den Weg über Route,
// Fläche und Neuladen misst `pp03-anschluss-flaeche.test.tsx` (F3).
//
//   S1  Ohne Wahl kein Feld (Voreinstellung `alle`); eine Wahl wird gespeichert und übersteht
//       weitere Profiländerungen; andere Felder bleiben unberührt.
//   S2  Ein ungültiger Wert wird mit 400 und eigenem Grund abgewiesen; nichts wird geschrieben.
//   S3  Der Browserstand liest `alle`, solange das Profil lädt, fehlt oder nicht lesbar ist — im
//       Zweifel wird mehr gezeigt, nie weniger.
import { describe, expect, it } from "vitest";
import type { AssistenzStand } from "../../apps/web/src/lib/assistenzProfil";
import { offenePunkteWahl } from "../../apps/web/src/lib/datenkontrolleEinstellung";
import {
  AssistenzProfilDienst,
  AssistenzProfilFehler,
  InMemoryAssistenzProfilRepo,
} from "../../services/app/src/assistenz-profil";

describe("PP-03 · Setup › Klara „Offene Datenpunkte in der Datenlage“", () => {
  it("S1 · ohne Wahl kein Feld; die Wahl wird gespeichert und bleibt bei anderen Änderungen", async () => {
    const dienst = new AssistenzProfilDienst({ repo: new InMemoryAssistenzProfilRepo() });
    const erst = await dienst.aendere("ada", { name: "Klara", fassung: 0 });
    expect(erst.datenkontrolleOffenePunkte).toBeUndefined();
    const gewaehlt = await dienst.aendere("ada", {
      datenkontrolleOffenePunkte: "nur_klaerung",
      fassung: erst.fassung,
    });
    expect(gewaehlt.datenkontrolleOffenePunkte).toBe("nur_klaerung");
    expect(gewaehlt.name).toBe("Klara");
    const danach = await dienst.aendere("ada", { bildAutomatik: false, fassung: gewaehlt.fassung });
    expect(danach.datenkontrolleOffenePunkte).toBe("nur_klaerung");
    expect(danach.bildAutomatik).toBe(false);
    expect((await dienst.hole("ada"))?.datenkontrolleOffenePunkte).toBe("nur_klaerung");
    const zurueck = await dienst.aendere("ada", {
      datenkontrolleOffenePunkte: "alle",
      fassung: danach.fassung,
    });
    expect(zurueck.datenkontrolleOffenePunkte).toBe("alle");
  });

  it("S2 · ein ungültiger Wert wird abgewiesen, nichts geschrieben", async () => {
    const dienst = new AssistenzProfilDienst({ repo: new InMemoryAssistenzProfilRepo() });
    const erst = await dienst.aendere("ada", { name: "Klara", fassung: 0 });
    for (const falsch of ["keine", true, 1, null]) {
      const fehler = await dienst
        .aendere("ada", { datenkontrolleOffenePunkte: falsch, fassung: erst.fassung })
        .catch((f: unknown) => f);
      expect(fehler).toBeInstanceOf(AssistenzProfilFehler);
      expect(fehler).toMatchObject({ status: 400, grund: "datenkontrolleOffenePunkte" });
    }
    expect((await dienst.hole("ada"))?.fassung).toBe(erst.fassung);
  });

  it("S3 · im Zweifel `alle`", () => {
    const stand = (s: Partial<AssistenzStand>): AssistenzStand => ({
      kontoId: "ada",
      status: "bereit",
      antwort: null,
      ...s,
    });
    const profil = (wahl?: "alle" | "nur_klaerung") => ({
      profil: {
        name: "Klara",
        avatar: null,
        bewegung: "standard" as const,
        eingerichtetAm: null,
        fassung: 2,
        geaendertAm: "2026-10-17T00:00:00Z",
        ...(wahl === undefined ? {} : { datenkontrolleOffenePunkte: wahl }),
      },
      einrichtungOffen: true,
    });
    expect(offenePunkteWahl(stand({ kontoId: null, status: "leer" }))).toBe("alle");
    expect(offenePunkteWahl(stand({ status: "laedt", antwort: profil("nur_klaerung") }))).toBe(
      "alle",
    );
    expect(offenePunkteWahl(stand({ status: "fehler" }))).toBe("alle");
    expect(offenePunkteWahl(stand({ antwort: profil() }))).toBe("alle");
    expect(offenePunkteWahl(stand({ antwort: profil("nur_klaerung") }))).toBe("nur_klaerung");
  });
});
