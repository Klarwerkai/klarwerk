// ================================================================================================
// AUFNAHME 20260922 (R-2212, Bens Befund nacharbeit-34) — DIE ZENTRALE KI-FREIGABE ALS VORRICHTUNG.
// ================================================================================================
//
// Eine frische Instanz steht auf „Extern: Blockiert": ohne Grundfreigabe der Instanz ist auch mit
// eingerichtetem Cloud-Modell keine Aufgabe nutzbar. Gemessen in der Browser-Modellprobe vom
// 10.10.2026: „Fragen antwortet ehrlich … @modell" lief bei gesperrter Freigabe, der Fragenknopf
// blieb deaktiviert, es ging KEIN `POST /api/ask` hinaus — der Fall prüfte die Sperre, nicht das
// Modell.
//
// Die Freigabe ist eine Admin-Entscheidung der Instanz. Die Vorrichtung erteilt sie über den
// VORHANDENEN Adminweg `PUT /api/reasoner/config` — ausschliesslich die Grundfreigabe
// (`oeffentlicheKi: true`, `vertraulicheInhalte: false`), mit der gelesenen globalen und
// aufgabenweisen Zuordnung — und stellt danach den vorigen Stand wieder her: alle Smoke-Dateien
// eines Laufs teilen sich EINEN Server. Dieselbe Bauform wie Klara 01 (`klara-basis-browser.spec.ts`).
// Produktpolicy und Sperren bleiben unangetastet; vertrauliche Inhalte bleiben gesperrt.
import { type Page, expect } from "@playwright/test";

export interface Zuordnung {
  global: string;
  perTask: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
}

export async function zuordnungLesen(admin: Page): Promise<Zuordnung> {
  const antwort = await admin.request.get("/api/reasoner/config");
  expect(antwort.status(), await antwort.text()).toBe(200);
  return ((await antwort.json()) as { taskConfig: Zuordnung }).taskConfig;
}

async function freigabeSetzen(
  admin: Page,
  basis: Zuordnung,
  kiFreigabe: { oeffentlicheKi: boolean; vertraulicheInhalte: boolean },
): Promise<Zuordnung> {
  const antwort = await admin.request.put("/api/reasoner/config", {
    data: { global: basis.global, perTask: basis.perTask, kiFreigabe },
  });
  expect(antwort.status(), await antwort.text()).toBe(200);
  return zuordnungLesen(admin);
}

/**
 * Führt `lauf` mit erteilter Grundfreigabe aus und stellt den vorigen Stand danach wieder her —
 * auch wenn der Lauf rot war. Prüft vorher Speicherung (nur die Grundfreigabe, Zuordnung
 * unverändert) und Wirkung (`extern: "frei"`, Aufgabe `aufgabe` nutzbar).
 */
export async function mitGrundfreigabe(
  admin: Page,
  aufgabe: "answer" | "structure",
  lauf: () => Promise<void>,
): Promise<void> {
  const vorher = await zuordnungLesen(admin);
  const gesetzt = await freigabeSetzen(admin, vorher, {
    oeffentlicheKi: true,
    vertraulicheInhalte: false,
  });
  try {
    expect(gesetzt.kiFreigabe?.oeffentlicheKi).toBe(true);
    expect(gesetzt.kiFreigabe?.vertraulicheInhalte ?? false).toBe(false);
    expect(gesetzt.global).toBe(vorher.global);
    expect(gesetzt.perTask).toEqual(vorher.perTask);

    const status = (await (await admin.request.get("/api/reasoner/status")).json()) as {
      active?: boolean;
      reachable?: string;
      kiAbgeschaltet?: boolean;
      extern?: string;
      tasks?: Record<string, boolean | undefined>;
    };
    expect(status.extern, "die Grundfreigabe ist nicht wirksam").toBe("frei");
    // Dieselbe Lesart wie die Oberfläche (`apps/web/src/lib/aiAvailability.ts`): nur ein
    // ausdrückliches `false` stellt die Aufgabe deterministisch. Der eigentliche Modellnachweis
    // steht im Fall selbst — an den Antwortmetadaten, nicht an diesem Status.
    const nutzbar =
      status.active === true &&
      status.tasks?.[aufgabe] !== false &&
      status.kiAbgeschaltet !== true &&
      status.reachable !== "unreachable";
    expect(
      nutzbar,
      `Kein nutzbares Modell für „${aufgabe}“ (Status ${JSON.stringify(status)}) — der volle Smoke braucht KLARWERK_SHIP_SMOKE_API_KEY.`,
    ).toBe(true);

    await lauf();
  } finally {
    await freigabeSetzen(admin, vorher, {
      oeffentlicheKi: vorher.kiFreigabe?.oeffentlicheKi === true,
      vertraulicheInhalte: vorher.kiFreigabe?.vertraulicheInhalte === true,
    });
  }
}
