// ================================================================================================
// JOB 1174 D1 — KIPPT DIE MATRIX, KIPPT DIE DECKUNG.
// ================================================================================================
//
// DER BEFUND (OFFEN.md Zeile 162, G26 Punkt 3, wörtlich):
//
//   > Für die drei rollenimpliziten Lesewege (`ai-check`, `restore`, `trash-delete`) fehlt ein
//   > Matrix-Kopplungstest — sie sind heute gedeckt, weil `users.manage` und `ko.validate` nur
//   > Rollen mit voller Sicht tragen; kippt die Rechtematrix, kippt die Deckung stillschweigend.
//
// DIE DREI WEGE, gemessen im Bestand (nicht abgeschrieben — der Test liest sie unten selbst aus
// dem AUSGEFÜHRTEN `requirePermission`-Aufruf):
//
//   POST   /api/kos/:id/ai-check     ko-routes.ts:1062, Aufruf :1063  → ko.validate
//   POST   /api/kos/:id/restore      ko-routes.ts:1155, Aufruf :1156  → users.manage
//   DELETE /api/kos/trash/:id        ko-routes.ts:1167, Aufruf :1168  → users.manage
//
// Alle drei prüfen NUR das Recht. Keiner ruft `sichtbaresKoOder404` — anders als etwa
// `DELETE /api/kos/:id` (:1187), das zusätzlich durch das Sichtbarkeitstor geht. Ihre Deckung ist
// deshalb eine NEBENWIRKUNG der Rechteverteilung, keine Zusicherung.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESER TEST ZUSICHERT, und warum in dieser Form
// ------------------------------------------------------------------------------------------------
//
//   (1) DAS RECHT KOMMT AUS DEM AUSGEFÜHRTEN AUFRUF, nicht aus einer Liste hier. Wird ein Zweig
//       später abgesenkt (`ko.validate` → `ko.create`), wird HIER rot — nicht irgendwann im
//       Betrieb. Dieselbe Haltung wie mega80-kennung-ist-kein-leserecht.ts:238-254, an dem BEN
//       genau diese Bauform verlangt hat.
//
//   (2) „VOLLE SICHT" WIRD NICHT GERATEN, SONDERN GEFRAGT. Die Definition steht in
//       `services/app/src/sichtbarkeit.ts:67-77` (`darfSehen`) und lautet dort:
//         - nicht vertraulich  → jeder mit `ko.read`
//         - vertraulich        → nur `can(role, "ko.validate")` ODER der Autor selbst (`:71`, `:76`)
//       Volle Sicht heisst also: das Prädikat sagt auch bei einem FREMDEN VERTRAULICHEN Objekt
//       `true`. Genau so wird unten gefragt — mit einem Aufruf von `darfSehen`, nicht mit einer
//       Kopie seiner Regel.
//
//   (3) DIE KOPPLUNG WIRD AUS DER MATRIX BERECHNET. Für jedes ausgelesene Recht läuft die Prüfung
//       über ALLE Rollen der Matrix (`ROLE_PERMISSIONS`), nicht über eine hier notierte Auswahl.
//       Eine neue Rolle ist damit automatisch Teil der Prüfung.
//
// ------------------------------------------------------------------------------------------------
// EIN BEFUND ZU G26 SELBST, gemessen — die Registerzeile ist zu weit gefasst
// ------------------------------------------------------------------------------------------------
//
// G26 nennt `ko.validate` und `users.manage` in einem Atemzug. Gemessen sind sie NICHT gleich:
//
//   · `ko.validate` IST die Sichtbarkeitsregel (`darfSehen:71`). Wer es bekommt, hat damit im
//     selben Moment volle Sicht — die Deckung von `ai-check` kann durch eine Verschiebung von
//     `ko.validate` gar nicht kippen. Das ist eine Identität, keine Nebenwirkung.
//   · `users.manage` hat mit `darfSehen` NICHTS zu tun. Es trägt heute nur `admin`, und der hält
//     `ko.validate` ohnehin. GENAU HIER liegt das Risiko: eine Rolle ohne `ko.validate`, die
//     `users.manage` bekommt, öffnet `restore` und `trash-delete` für jemanden ohne volle Sicht.
//
// Beide Richtungen stehen unten als eigene Zusicherung — die Kopplung UND die Identität. Ohne die
// zweite wäre die erste bei einer Änderung an `darfSehen` still wirkungslos geworden.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen } from "../../services/app/src/sichtbarkeit";
import type { Role } from "../../services/auth";
import { ROLE_PERMISSIONS, can } from "../../services/rbac";

const KO_ROUTES = join(__dirname, "../../services/app/src/routes/ko-routes.ts");

/** Die drei Wege aus G26 — als ROUTENMUSTER, nicht als Recht. Das Recht wird gelesen. */
const DREI_WEGE = [
  { name: "ai-check", methode: "post", pfad: "/api/kos/:id/ai-check" },
  { name: "restore", methode: "post", pfad: "/api/kos/:id/restore" },
  { name: "trash-delete", methode: "delete", pfad: "/api/kos/trash/:id" },
] as const;

/**
 * Das Recht, das diese Route TATSÄCHLICH verlangt — gelesen aus dem AUSGEFÜHRTEN
 * `requirePermission`-Aufruf im Rumpf der Registrierung, nicht aus einer Liste in diesem Test.
 *
 * Der Rumpf endet an der nächsten `app.<methode>(`-Registrierung; nur der eigene Aufruf zählt.
 */
function rechtDerRoute(methode: string, pfad: string): string {
  const quelltext = readFileSync(KO_ROUTES, "utf8");
  const anker = `app.${methode}`;
  const ab = quelltext.indexOf(`"${pfad}"`);
  if (ab < 0) {
    throw new Error(
      `Die Route ${methode.toUpperCase()} ${pfad} steht nicht mehr in ko-routes.ts. G26 Punkt 3 nennt sie als rollenimpliziten Leseweg — entweder ist sie umbenannt oder entfallen; beides gehört gemeldet, nicht stillschweigend übergangen.`,
    );
  }
  // Rückwärts bis zur eigenen Registrierung, vorwärts bis zur nächsten.
  const start = quelltext.lastIndexOf(anker, ab);
  if (start < 0) {
    throw new Error(`Zu ${pfad} wurde keine ${anker}-Registrierung gefunden.`);
  }
  const rest = quelltext.slice(start + anker.length);
  const naechste = rest.search(/\n\s{4}app\.(get|post|put|delete|patch)[<(]/);
  const rumpf = naechste < 0 ? rest : rest.slice(0, naechste);
  const treffer = rumpf.match(/requirePermission\("([a-z.]+)"/);
  if (!treffer?.[1]) {
    throw new Error(
      `${methode.toUpperCase()} ${pfad} ruft kein requirePermission auf — die Deckung dieses Weges stützt sich damit auf gar keine Rechteschwelle.`,
    );
  }
  return treffer[1];
}

/**
 * Hat diese Rolle VOLLE SICHT? Gefragt wird das Prädikat selbst (`sichtbarkeit.ts:67`), nicht eine
 * Kopie seiner Regel: volle Sicht heisst, auch ein FREMDES VERTRAULICHES Objekt sehen zu dürfen.
 *
 * Der Autor ist bewusst ein anderer als der Betrachter — sonst griffe die Autor-Ausnahme (`:76`)
 * und jede Rolle hätte scheinbar volle Sicht.
 */
function hatVolleSicht(rolle: Role): boolean {
  const betrachter = { id: "betrachter-job1174", role: rolle } as SessionUser;
  return darfSehen(betrachter, {
    confidentiality: "vertraulich",
    author: "jemand-anderes-job1174",
  });
}

const ALLE_ROLLEN = Object.keys(ROLE_PERMISSIONS) as Role[];

describe("JOB 1174 · kippt die Matrix, kippt die Deckung", () => {
  it("die drei rollenimpliziten Wege existieren und nennen jeder ein Recht — aus dem Aufruf gelesen", () => {
    // Schrumpfsicherung: verschwindet einer der drei, ist das ein Befund und kein „nichts zu tun".
    expect(DREI_WEGE).toHaveLength(3);

    const gemessen = Object.fromEntries(
      DREI_WEGE.map((w) => [w.name, rechtDerRoute(w.methode, w.pfad)]),
    );
    // Der heute gemessene Stand, gepinnt: wird ein Zweig abgesenkt, wird DIESE Zeile rot — und die
    // Kopplung unten läuft dann gegen das neue Recht, nicht gegen eine veraltete Annahme.
    expect(gemessen).toEqual({
      "ai-check": "ko.validate",
      restore: "users.manage",
      "trash-delete": "users.manage",
    });
  });

  it("DIE KOPPLUNG: jede Rolle, die eines dieser Rechte trägt, hat volle Sicht", () => {
    // DAS IST DIE ZUSICHERUNG, die G26 fehlt. Sie wird aus der Matrix BERECHNET: über alle Rollen,
    // die `ROLE_PERMISSIONS` führt, und über die Rechte, die eben aus den Routen gelesen wurden.
    const verletzt: string[] = [];
    for (const weg of DREI_WEGE) {
      const recht = rechtDerRoute(weg.methode, weg.pfad) as Parameters<typeof can>[1];
      for (const rolle of ALLE_ROLLEN) {
        if (can(rolle, recht) && !hatVolleSicht(rolle)) {
          verletzt.push(
            `${weg.methode.toUpperCase()} ${weg.pfad} verlangt "${recht}"; Rolle "${rolle}" trägt es, sieht aber ein fremdes vertrauliches Objekt NICHT. Der Weg prüft keine Sichtbarkeit — er gibt Bestand an jemanden heraus, der ihn nicht sehen darf.`,
          );
        }
      }
    }
    expect(
      verletzt,
      `\nDie Deckung der rollenimpliziten Lesewege ist gekippt:\n${verletzt.join("\n")}\n`,
    ).toEqual([]);
  });

  it("DIE GEGENRICHTUNG: volle Sicht hängt genau an `ko.validate` — sonst wäre die Kopplung wertlos", () => {
    // Ohne diese Zusicherung bliebe die Kopplung oben grün, wenn jemand `darfSehen` von
    // `ko.validate` löst: dann hätte plötzlich JEDE Rolle volle Sicht, und der Fall darüber wäre
    // ein No-op. Geprüft wird die Gleichheit beider Mengen, nicht nur eine Richtung.
    const mitVollerSicht = ALLE_ROLLEN.filter(hatVolleSicht).sort();
    const mitValidate = ALLE_ROLLEN.filter((r) => can(r, "ko.validate")).sort();
    expect(
      mitVollerSicht,
      "\nLinks die Rollen, denen `darfSehen` ein fremdes vertrauliches Objekt zeigt; rechts die mit `ko.validate`. Laufen sie auseinander, trägt `sichtbarkeit.ts:71` die Sichtbarkeit nicht mehr allein — und die Kopplung oben prüft dann etwas anderes, als sie behauptet.\n",
    ).toEqual(mitValidate);

    // Und der Nachweis, dass die Trennung überhaupt etwas trennt: nicht jede Rolle sieht alles.
    // Ohne diese zwei Zeilen wäre auch eine allmächtige Matrix grün.
    expect(hatVolleSicht("experte"), "`experte` darf kein fremdes Vertrauliches sehen").toBe(false);
    expect(hatVolleSicht("admin"), "`admin` muss volle Sicht haben").toBe(true);
  });

  it("KALIBRIERUNG: `hatVolleSicht` misst wirklich die Sichtbarkeit, nicht eine Konstante", () => {
    // Drei Gegenproben am selben Prädikat — ohne sie könnte `hatVolleSicht` schlicht immer
    // dasselbe liefern, und alle Zusicherungen oben wären wertlos.
    const experte = { id: "e-1", role: "experte" as Role } as SessionUser;

    // (a) Ein NICHT vertrauliches Objekt sieht auch der Experte (`darfSehen:68-70`).
    expect(darfSehen(experte, { confidentiality: "intern", author: "fremd" })).toBe(true);
    // (b) Sein EIGENES vertrauliches Objekt ebenfalls — die Autor-Ausnahme (`darfSehen:76`).
    expect(darfSehen(experte, { confidentiality: "vertraulich", author: "e-1" })).toBe(true);
    // (c) Ein FREMDES vertrauliches nicht — genau der Fall, den `hatVolleSicht` stellt.
    expect(darfSehen(experte, { confidentiality: "vertraulich", author: "fremd" })).toBe(false);
  });
});
