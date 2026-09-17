// ================================================================================================
// JOB 4154 · F6 — DER GANZE WEG TRÄGT OHNE KI.
// ================================================================================================
//
// Startvertrag, sechster entscheidender Fall:
//   „Ohne KI bleiben Erstellen, Lesen, manuelle Auswirkungsbewertung und berechtigter Workflow
//    moeglich."
// Abnahmefall 8 aus `VERTRAG-QUELLEN-VERSION-PRUEFSTAND.md`:
//   „KI nicht verfuegbar: Lesen, Finden, Kommentieren und berechtigte bestehende menschliche
//    Workflows bleiben erreichbar."
//
// ZWEI NACHWEISE, weil einer allein nicht trägt:
//
//   VERHALTEN — der vollständige Weg (anlegen → aufnehmen → ordnen → Voraussetzung → lesen →
//   vergleichen → vorlegen → entscheiden) läuft in EINEM Zug durch, ohne dass irgendwo ein Modell
//   angeboten, gebraucht oder erwartet würde. Der Prüfstand hat gar keines.
//
//   STRUKTUR — keine der neuen Produktdateien berührt eine KI-Fläche. Ein reiner Verhaltenstest
//   würde eine KI-Kopplung übersehen, die nur in einem Sonderfall zuschlägt (etwa eine
//   Zusammenfassung beim Vorlegen). Der Scan schliesst genau diese Lücke.
//
// GEGENPROBE: In `gesamtanweisung-service.ts` den Reasoner einbinden und im Vorlegen rufen (z. B.
// `import type { Reasoner } from "../../reasoner"` plus ein Aufruf). Dann wird „keine der neuen
// Dateien berührt eine KI-Fläche" namentlich rot und nennt die Datei.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bauDienst, eintrag, sichtbarAls } from "./pruefstand";

const WER = sichtbarAls({ id: "anna", darfPruefen: true });

/**
 * Die überwachten Flächen dieses Auftrags — Modul, Route und Bedienung.
 *
 * Bewusst als ausgeschriebene Liste und nicht als Verzeichnisdurchlauf: eine Datei, die dazukommt
 * und hier fehlt, soll beim Lesen dieses Registers auffallen und nicht stillschweigend ungeprüft
 * bleiben. Der Fall „das Register deckt den Ordner" unten hält das fest.
 */
const NEUE_DATEIEN = [
  "services/knowledge-object/src/gesamtanweisung-types.ts",
  "services/knowledge-object/src/gesamtanweisung-service.ts",
  "services/knowledge-object/src/gesamtanweisung-repo-pg.ts",
  "services/app/src/routes/gesamtanweisung-routes.ts",
  "apps/web/src/components/gesamtanweisung/api.ts",
  "apps/web/src/components/gesamtanweisung/hooks.ts",
  "apps/web/src/components/gesamtanweisung/zustand.ts",
  "apps/web/src/components/gesamtanweisung/GesamtanweisungSeite.tsx",
  "apps/web/src/components/gesamtanweisung/BausteinAufnahme.tsx",
  "apps/web/src/components/gesamtanweisung/LesestandAnsicht.tsx",
  "apps/web/src/components/gesamtanweisung/VergleichAnsicht.tsx",
  "apps/web/src/components/gesamtanweisung/VoraussetzungFeld.tsx",
  "apps/web/src/components/gesamtanweisung/EntscheidungsVorlage.tsx",
  // JOB 4156 (WIKI-GESAMTANWEISUNG-ANSCHLUSS): die Hülle, die den Bereich in der App verankert.
  // Sie steht hier, weil der Fall „das Register deckt den Bedienordner vollständig ab" unten
  // GENAU dafür gebaut ist: eine neue Bedien-Datei, die niemand in dieses Register nimmt, würde
  // sonst still an der KI-Freiheitsprüfung vorbeilaufen. Der Wächter ist planmässig rot geworden
  // und wird hier nachgeführt, nicht gelockert.
  "apps/web/src/components/gesamtanweisung/GesamtanweisungBereich.tsx",
] as const;

/**
 * Die KI-Flächen des Hauses, an ihren tatsächlichen Namen erkannt.
 *
 * Kein Wortmuster wie „alles mit ai": das träfe `aiCheckBadge` genauso wie `Detail` und würde den
 * Wächter entweder falsch-rot oder unbrauchbar machen. Es sind die realen Einstiege.
 */
const KI_FLAECHEN = [
  "reasoner",
  "anthropic",
  "aiAvailability",
  "ai-check",
  "aiCheck",
  "assist",
  "enrich",
  "describeImage",
  "knowledge-check",
  "/ask",
  "useAsk",
] as const;

// `ai-check` träfe auch den Dateinamen `ai-check-worker`, `assist` auch `AiAssistBox` — genau
// deshalb steht hier eine geprüfte Liste und kein Wortmuster.

describe("F6 · ohne KI bedienbar", () => {
  it("der ganze Weg läuft in einem Zug durch — ohne Modell, ohne Netz", async () => {
    const eintraege = [
      eintrag({ id: "ko-a", title: "Schritt A", version: 1 }, [
        { version: 1, bodyHtml: "<p>A</p>" },
      ]),
      eintrag({ id: "ko-b", title: "Schritt B", version: 1 }, [
        { version: 1, bodyHtml: "<p>B</p>" },
      ]),
    ];
    const { dienst } = bauDienst(eintraege);

    const a = await dienst.anlegen(
      { titel: "Anfahren", zweck: "Sicheres Anfahren", geltungsbereich: "Werk 1" },
      "anna",
    );
    const b1 = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "ha" },
      WER,
    );
    const b2 = await dienst.bausteinAufnehmen(
      a.id,
      b1.version,
      { koId: "ko-b", koVersion: 1, nachweisHash: "hb" },
      WER,
    );
    const ids = b2.bausteine.map((b) => b.id);
    const geordnet = await dienst.reihenfolgeSetzen(a.id, b2.version, [...ids].reverse(), WER);
    const erstesId = geordnet.bausteine[0]?.id as string;
    const mitVoraussetzung = await dienst.voraussetzungSetzen(
      a.id,
      geordnet.version,
      erstesId,
      "Anlage steht still",
      WER,
    );

    const stand = await dienst.lesen(a.id, WER);
    expect(stand.bausteine).toHaveLength(2);
    expect(stand.bausteine[0]?.voraussetzung).toBe("Anlage steht still");

    const vergleich = await dienst.vergleichen(a.id, b2.version, mitVoraussetzung.version, WER);
    expect(vergleich.gesamt).toBe("geaendert");

    const vorgelegt = await dienst.vorlegen(a.id, mitVoraussetzung.version, WER);
    expect(vorgelegt.stand).toBe("vorgelegt");
    const entschieden = await dienst.entscheiden(a.id, vorgelegt.version, "angenommen", WER);
    expect(entschieden.stand).toBe("entschieden");
  });

  it("keine der neuen Dateien berührt eine KI-Fläche", () => {
    const funde: string[] = [];
    for (const datei of NEUE_DATEIEN) {
      const quelle = readFileSync(datei, "utf8");
      // Kommentare zählen mit: dieser Wächter soll milde sein, nie falsch-grün. Ein Kommentar, der
      // „reasoner" nennt, wird hier bewusst gemeldet — dann wird er umformuliert.
      for (const flaeche of KI_FLAECHEN) {
        if (quelle.includes(flaeche)) {
          funde.push(`${datei} → ${flaeche}`);
        }
      }
    }
    expect(funde, `KI-Kopplung in neuen Dateien: ${funde.join(", ")}`).toEqual([]);
  });

  it("das Register deckt den Bedienordner vollständig ab", async () => {
    const { readdirSync } = await import("node:fs");
    const ordner = "apps/web/src/components/gesamtanweisung";
    const vorhanden = readdirSync(ordner).filter((n) => n.endsWith(".ts") || n.endsWith(".tsx"));
    const gelistet = NEUE_DATEIEN.filter((d) => d.startsWith(ordner)).map((d) =>
      d.slice(ordner.length + 1),
    );
    expect([...vorhanden].sort()).toEqual([...gelistet].sort());
  });
});
