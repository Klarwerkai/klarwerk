// ================================================================================================
// JOB 704 / D3 — DIE BERECHTIGUNGSKONSISTENZ VON `/lifecycle/pending`, VOR JEDEM W9-BAU BELEGT.
// ================================================================================================
//
// DER AUFTRAG DIESER DATEI steht wörtlich im Vollurteil `_relay/kopf/outbox/BEN3-PRUEFUNG-JOB-704-D2.md`:
//
//   §5 VERTRÄGLICHKEIT · „Die Berechtigungskonsistenz zwischen sichtbaren Quellen und
//    `/lifecycle/pending` bleibt VOR EINEM BAU zu belegen."
//   Prüflücke 4 · „Pending-Liste enthält eine vertrauliche, für die Rolle unsichtbare Quell-ID;
//    erwartet wird weder Offenlegung noch Angabe oder Mitzählung auf der Antwortfläche."
//
// WARUM DIESE DATEI JETZT ENTSTEHT UND NICHT ERST MIT W9: Das Urteil verlangt den Beleg
// ausdrücklich VOR dem Bau. W9 selbst hängt an drei offenen Ownerentscheidungen (Zielort A,
// Datumsweg B, Verantwortlichenbegriff C) und an einer gesonderten Freigabe für Teil B — die
// Anzeige darf hier also gar nicht gebaut werden. Die Frage, OB die Quelle überhaupt
// berechtigungssicher ist, hängt an keiner dieser Entscheidungen.
//
// WAS GEMESSEN WIRD — und das Ergebnis steht in den Fällen, nicht in diesem Kommentar:
//
//   `LifecycleService.pendingRevalidation()` nimmt keinen Nutzer entgegen und kennt keine
//   Sichtbarkeitsregel. Sie entfernt nur Kennungen, deren Wissensobjekt nicht mehr existiert
//   (Selbstheilung, SCRUM-420). Die Route `/api/lifecycle/pending` prüft die Berechtigung
//   `ko.read` und reicht das Ergebnis unverändert durch. Der Sichtbarkeitsweg des Bestandes
//   (`darfSehen`/`sichtbareFuer`) entscheidet dagegen sehr wohl rollen- und autorgebunden.
//
// DAS IST KEIN VORWURF AN DIE VORHANDENE ROUTE. Sie bedient heute Arbeitsbereich und Zähler,
// nicht die Antwortfläche. Diese Datei hält fest, was ein künftiger W9-Bau wissen muss, bevor er
// diese Liste als Quelle nimmt: **sie ist nicht getrimmt, und wer sie anzeigt, muss selbst trimmen.**
//
// WAS SIE AUSDRÜCKLICH NICHT TUT: Sie baut keine W9-Anzeige, entscheidet keine der drei
// Ownerfragen, ändert keinen Produktpfad und behauptet nicht, die Lücke geschlossen zu haben.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sichtbareFuer } from "../../services/app/src/sichtbarkeit";
import type { KoService } from "../../services/knowledge-object";
import { InMemoryLifecycleRepo, LifecycleService } from "../../services/lifecycle";

const WURZEL = join(__dirname, "..", "..");

const ROUTE = "services/app/src/routes/lifecycle-routes.ts";
const ENDPOINTS = "apps/web/src/api/endpoints.ts";
const HOOKS = "apps/web/src/api/hooks.ts";

/** Ein vertrauliches Wissensobjekt mit fremdem Autor — der Fall aus Prüflücke 4. */
const VERTRAULICH = {
  id: "ko-vertraulich-704",
  confidentiality: "vertraulich" as const,
  author: "u-anna",
};

/** Eine Leserin, die es nach der Sichtbarkeitsregel NICHT sehen darf. */
const FREMDE: SessionUser = { id: "u-bert", role: "viewer" };
/** Die Autorin — sie darf. Ohne diesen Gegenfall wäre die Regel unten trivial. */
const AUTORIN: SessionUser = { id: "u-anna", role: "viewer" };

/**
 * Ein minimaler KO-Dienst: er beantwortet genau die eine Frage, die `pendingRevalidation()`
 * stellt — „gibt es dieses Objekt noch?". Mehr braucht die Methode nicht, und genau das ist der
 * Befund: sie fragt nie, WER liest.
 */
function koDienst(vorhanden: readonly string[]): KoService {
  return {
    get: (id: string) => Promise.resolve(vorhanden.includes(id) ? { id } : undefined),
  } as unknown as KoService;
}

async function pendingMit(ids: readonly string[], vorhanden: readonly string[]): Promise<string[]> {
  const repo = new InMemoryLifecycleRepo();
  for (const id of ids) {
    await repo.markPending(id);
  }
  const service = new LifecycleService({ repo, koService: koDienst(vorhanden) });
  return service.pendingRevalidation();
}

describe("JOB 704 · P — `/lifecycle/pending` ist keine sichtbarkeitsgetrimmte Quelle", () => {
  it("P1 · die Liste kennt strukturell keinen Nutzer — eine Rollenantwort ist unmöglich", () => {
    // Eine Methode ohne Nutzerparameter KANN nicht rollenabhängig antworten. Das ist keine
    // Auslegung, sondern die Stelligkeit der Funktion.
    expect(LifecycleService.prototype.pendingRevalidation.length).toBe(0);
  });

  it("P2 · VERHALTENSBELEG: eine vertrauliche Kennung steht in der Liste — für jede Rolle gleich", async () => {
    const liste = await pendingMit([VERTRAULICH.id], [VERTRAULICH.id]);
    // Der Fall aus Prüflücke 4, gemessen statt vermutet.
    expect(liste).toContain(VERTRAULICH.id);
    // Und dieselbe Antwort, ganz gleich wer fragt — es gibt keinen zweiten Aufrufweg.
    const nochmal = await pendingMit([VERTRAULICH.id], [VERTRAULICH.id]);
    expect(nochmal).toEqual(liste);
  });

  it("P3 · KALIBRIERUNG: die Messung könnte einen Trim sehr wohl erkennen", async () => {
    // Ohne diesen Fall bewiese P2 nichts: Er wäre auch dann grün, wenn `pendingMit` gar keine
    // Kennungen zurückgeben könnte. Hier wird derselbe Bestand einmal getrimmt.
    const roh = await pendingMit(
      [VERTRAULICH.id, "ko-offen-704"],
      [VERTRAULICH.id, "ko-offen-704"],
    );
    expect(roh).toEqual([VERTRAULICH.id, "ko-offen-704"]);
    const getrimmt = roh.filter((id) => id !== VERTRAULICH.id);
    expect(getrimmt).toEqual(["ko-offen-704"]);
    // Die Selbstheilung wirkt — eine Kennung ohne Objekt fällt heraus. Der Dienst filtert also
    // durchaus, nur eben nach Existenz und nicht nach Sichtbarkeit.
    const verwaist = await pendingMit([VERTRAULICH.id, "ko-weg-704"], [VERTRAULICH.id]);
    expect(verwaist).toEqual([VERTRAULICH.id]);
  });

  it("P4 · der Sichtbarkeitsweg des Bestandes entscheidet dagegen — DAS ist die Inkonsistenz", () => {
    // Derselbe Datensatz, zwei Antworten: die Liste nennt ihn, die Sichtbarkeitsregel verbirgt ihn.
    expect(darfSehen(FREMDE, VERTRAULICH)).toBe(false);
    expect(sichtbareFuer(FREMDE, [VERTRAULICH])).toEqual([]);
    // Gegenprobe, ohne die der Fall darüber nichts sagt: die Regel ist nicht pauschal.
    expect(darfSehen(AUTORIN, VERTRAULICH)).toBe(true);
    expect(sichtbareFuer(AUTORIN, [VERTRAULICH])).toEqual([VERTRAULICH]);
  });

  it("P5 · die Route reicht die Liste ungetrimmt durch — gemessen am Quelltext", () => {
    const quelle = readFileSync(join(WURZEL, ROUTE), "utf8");
    // Der Handler existiert und prüft die Berechtigung …
    const handler = /\/api\/lifecycle\/pending"[\s\S]*?\n {4}\}\);/.exec(quelle)?.[0] ?? "";
    expect(
      handler.length,
      "der Handler wurde nicht gefunden — liest der Fall die richtige Datei?",
    ).toBeGreaterThan(0);
    expect(handler).toContain('requirePermission("ko.read"');
    // … und gibt danach unverändert weiter: kein Sichtbarkeitswort zwischen Prüfung und Antwort.
    for (const wort of ["darfSehen", "sichtbareFuer", "sichtbarkeitsfilterFuer", "trim"]) {
      expect(
        handler.includes(wort),
        `der Handler benutzt ${wort} — dann ist dieser Befund überholt und die Rückgabe nachzuführen`,
      ).toBe(false);
    }
    // Gegenprobe: in derselben Datei gibt es Routen mit Berechtigungsstufen — die Prüfung greift.
    expect(quelle).toContain('requirePermission("ko.validate"');
  });

  it("P6 · der Client ruft genau diesen Endpunkt auf", () => {
    const endpunkte = readFileSync(join(WURZEL, ENDPOINTS), "utf8");
    expect(endpunkte).toMatch(/pending:\s*\(\)\s*=>\s*api\.get<[^>]*>\("\/lifecycle\/pending"\)/);
  });

  it("P7 · der Wiretyp sind NACKTE Kennungen — der Client kann gar nicht selbst trimmen", () => {
    // Keine Stufe, kein Autor, keine Sichtbarkeitsangabe. Wer aus dieser Antwort eine Anzeige
    // baut, hat nichts in der Hand, woraus er die Sichtbarkeit ableiten könnte — er MUSS die
    // Entscheidung von der Serverseite bekommen. Genau das ist der Kern von Prüflücke 4.
    const endpunkte = readFileSync(join(WURZEL, ENDPOINTS), "utf8");
    const treffer = /pending:\s*\(\)\s*=>\s*api\.get<([^>]*)>\("\/lifecycle\/pending"\)/.exec(
      endpunkte,
    );
    expect(treffer, "der Pending-Endpunkt wurde nicht gefunden").not.toBeNull();
    expect(treffer?.[1]?.trim()).toBe("string[]");
  });

  it("P8 · der Hook bindet genau diese Quelle", () => {
    const hooks = readFileSync(join(WURZEL, HOOKS), "utf8");
    expect(hooks).toContain("export const useLifecyclePending");
    expect(hooks).toContain("endpoints.lifecycle.pending");
  });
});
