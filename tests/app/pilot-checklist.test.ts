import { describe, expect, it } from "vitest";
import { ALL_ITEMS, ROLE_RANK, type Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import {
  PILOT_CHECKLIST,
  pilotChecklist,
  pilotSchritte,
} from "../../apps/web/src/lib/pilotChecklist";

// SCRUM-305: In-App-Einstiegsführung für den ersten Nutzerlauf — ehrliche Stage-1-Prüfpunkte entlang
// Capture → Validation → Use → Gap → Maintain, nur auf vorhandene App-Routen.
//
// JOB 4022: der Bestandsgedanke bleibt — hier wird die DOM-freie EINE Quelle geprüft, nicht die
// Fläche (die misst `tests/einstieg-gastweg/`). Zwei Prüfungen kommen dazu und keine geht weg:
//   · Die Route jedes Schrittes muss in `ALL_ITEMS` stehen. Das ist STÄRKER als die bisherige
//     Deckung über `HELP_TOPICS`: diese belegte, dass es zum Ziel ein Hilfekapitel gibt, und nur
//     mittelbar, dass die Route existiert. Die Kapiteldeckung bleibt darunter erhalten.
//   · Die Rollenauskunft je Schritt kommt aus derselben Registry und wird hier gegen sie gerechnet.
const SPRACHEN = ["de", "en", "nl"] as const;

/**
 * Die eine begründete Ausnahme der Kapiteldeckung.
 *
 * `/start` ist der Einstieg (JOB 4022, Lieferung 4) und hat in `HELP_TOPICS` kein eigenes Kapitel —
 * die Seite erklärt sich über ihre eigene Seitenhilfe. Die Ausnahme steht hier namentlich, damit
 * ein DRITTER Schritt ohne Kapitel diesen Fall rot macht, statt still durchzurutschen.
 */
const OHNE_HILFEKAPITEL = ["/start"];

function minRolleAusRegistry(to: string): Role {
  const eintrag = ALL_ITEMS.find((item) => item.path === to);
  if (!eintrag) {
    throw new Error(`Route ohne Navigationseintrag: ${to}`);
  }
  return eintrag.minRole;
}

describe("SCRUM-305: pilotChecklist", () => {
  it("liefert genau sieben Schritte in fester Reihenfolge", () => {
    expect(pilotChecklist()).toBe(PILOT_CHECKLIST);
    expect(PILOT_CHECKLIST.map((c) => c.id)).toEqual([
      "start",
      "library",
      "capture",
      "validation",
      "use",
      "gap",
      "maintain",
    ]);
    expect(PILOT_CHECKLIST.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("verweist ausschließlich auf Routen, die es in der EINEN Routenquelle gibt", () => {
    const routen = new Set(ALL_ITEMS.map((item) => item.path));
    for (const item of PILOT_CHECKLIST) {
      expect(routen.has(item.to), `Schritt „${item.id}" zeigt ins Nichts: ${item.to}`).toBe(true);
    }
  });

  it("hat zu jedem Schritt ein Hilfekapitel — bis auf den benannten Einstieg", () => {
    const kapitel = new Set(HELP_TOPICS.map((tp) => tp.to));
    for (const item of PILOT_CHECKLIST.filter((c) => !OHNE_HILFEKAPITEL.includes(c.to))) {
      expect(kapitel.has(item.to), `Kein Hilfekapitel zu ${item.to}`).toBe(true);
    }
  });

  it("JOB 4022: die Rollenauskunft kommt aus der Registry, nicht aus der Liste", () => {
    for (const rolle of ["viewer", "experte", "controller", "admin"] as const) {
      for (const schritt of pilotSchritte(rolle)) {
        const verlangt = minRolleAusRegistry(schritt.item.to);
        if (ROLE_RANK[rolle] >= ROLE_RANK[verlangt]) {
          expect(schritt.zugang, `${schritt.item.id} für ${rolle}`).toBe("offen");
        } else {
          expect(schritt.zugang, `${schritt.item.id} für ${rolle}`).toBe("gesperrt");
          expect(schritt.zugang === "gesperrt" ? schritt.minRole : null).toBe(verlangt);
        }
      }
    }
    // Ein Gast kommt nicht überall hin, ein Administrator überall — sonst prüft der Fall nichts.
    expect(pilotSchritte("viewer").some((s) => s.zugang === "gesperrt")).toBe(true);
    expect(pilotSchritte("admin").every((s) => s.zugang === "offen")).toBe(true);
  });

  it("JOB 4022: ohne bekannte Rolle wird weder geführt noch gesperrt", () => {
    const schritte = pilotSchritte(null);
    expect(schritte).toHaveLength(PILOT_CHECKLIST.length);
    expect(schritte.every((s) => s.zugang === "rolleUnbekannt")).toBe(true);
  });

  it("nutzt stabile i18n-Keys, die in DE, EN und NL vorhanden sind", () => {
    const keys = [
      "pilot.access.title",
      "pilot.access.subtitle",
      "pilot.access.summary",
      "pilot.access.locked",
      "pilot.access.roleUnknown",
      ...PILOT_CHECKLIST.map((c) => c.labelKey),
    ];
    for (const key of keys) {
      for (const lng of SPRACHEN) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${key} fehlt in ${lng}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("bleibt ehrlich: die drei Zusagen stehen weiter in den DE-Texten", () => {
    const de = PILOT_CHECKLIST.map((c) =>
      String(i18n.getResource("de", "translation", c.labelKey) ?? ""),
    ).join(" ");
    // Die Sätze sprechen seit der Steuerungs-Nachführung (14.09. 18:16) Alltagssprache; die drei
    // Zusagen dahinter sind DIESELBEN geblieben und werden hier weiter gehalten:
    // offen gespeichert · nichts automatisch freigegeben/gültig · nichts erfunden.
    expect(de).toMatch(/offen gespeichert/i);
    expect(de).toMatch(/nichts wird automatisch freigegeben/i);
    expect(de).toMatch(/nichts bleibt automatisch für immer gültig/i);
    expect(de).toMatch(/nichts erfunden/i);
  });

  it("JOB 4022: kein interner Begriff in den Texten dieser Karte — in keiner Sprache", () => {
    // Codex' Bedienbefund (14.09. 17:45, Screenshot 13-hilfe.png) und Pedi (16:49): „Es ist ein
    // Unterschied, als wenn ein Anwender daran arbeitet oder du als System." Geprüft werden genau
    // die dort benannten Begriffe — in ALLEN drei Sprachen, denn ein Anwender liest eine davon.
    const intern = ["Stage-1", "Stage 1", "Peers", "peers", "Review", "review"];
    const schluessel = [
      "pilot.access.title",
      "pilot.access.subtitle",
      "pilot.access.summary",
      "pilot.access.locked",
      "pilot.access.roleUnknown",
      ...PILOT_CHECKLIST.map((c) => c.labelKey),
    ];
    for (const lng of SPRACHEN) {
      for (const key of schluessel) {
        const text = String(i18n.getResource(lng, "translation", key) ?? "");
        for (const begriff of intern) {
          expect(text, `${key} (${lng}) trägt den internen Begriff „${begriff}"`).not.toContain(
            begriff,
          );
        }
      }
    }
  });
});
