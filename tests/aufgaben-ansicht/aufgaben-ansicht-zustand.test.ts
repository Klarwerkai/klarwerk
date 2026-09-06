// ================================================================================================
// JOB 3101 · UX-04 — DER RECHENKERN DER AUFGABENANSICHT, DOM-FREI.
// ================================================================================================
//
// Was hier geprüft wird, ist die Rechenlogik allein: welcher Wert aus der Adresszeile gilt, was
// hineingeschrieben wird, welcher Schlüssel eine Listenposition trägt und wann sie verworfen bzw.
// begrenzt wird. Ohne Browser, ohne Router, ohne React — genau deshalb liegt sie in einem eigenen
// Modul und nicht in `MyTasks.tsx`.
import { describe, expect, it } from "vitest";
import { TASK_FILTERS } from "../../apps/web/src/lib/taskFilters";
import {
  TASK_FILTER_PARAM,
  type Verlaufsort,
  begrenzteListenposition,
  leseListenposition,
  merkeListenposition,
  taskFilterFromParams,
  verwirfUeberholtePositionen,
  writeTaskFilterToParams,
} from "../../apps/web/src/lib/taskViewState";

const p = (s: string): URLSearchParams => new URLSearchParams(s);

describe("UX-04 · die Aufgabenart in der Adresszeile", () => {
  it("Z1 · der Parametername steht an EINER Stelle und heißt „art“", () => {
    expect(TASK_FILTER_PARAM).toBe("art");
  });

  it("Z2 · jeder echte Filterschlüssel wird gelesen — die Wertmenge kommt aus TASK_FILTERS", () => {
    for (const f of TASK_FILTERS) {
      expect(taskFilterFromParams(p(`${TASK_FILTER_PARAM}=${f.key}`))).toBe(f.key);
    }
    // Kalibrierung: die Menge ist nicht leer, sonst prüfte die Schleife nichts.
    expect(TASK_FILTERS.length).toBeGreaterThan(1);
  });

  it("Z3 · fehlend, leer und unbekannt ergeben alle „all“ — kein Filter, keine stille Ausblendung", () => {
    expect(taskFilterFromParams(p(""))).toBe("all");
    expect(taskFilterFromParams(p("q=abc"))).toBe("all");
    expect(taskFilterFromParams(p(`${TASK_FILTER_PARAM}=`))).toBe("all");
    expect(taskFilterFromParams(p(`${TASK_FILTER_PARAM}=erfunden`))).toBe("all");
    // Auch ein Wert, der wie ein Schlüssel AUSSIEHT, aber keiner ist.
    expect(taskFilterFromParams(p(`${TASK_FILTER_PARAM}=Konflikt`))).toBe("all");
  });

  it("Z4 · schreiben setzt den Parameter, „all“ entfernt ihn", () => {
    expect(writeTaskFilterToParams(p(""), "conflict").toString()).toBe("art=conflict");
    expect(writeTaskFilterToParams(p("art=conflict"), "gap").toString()).toBe("art=gap");
    expect(writeTaskFilterToParams(p("art=conflict"), "all").toString()).toBe("");
  });

  it("Z5 · fremde Parameter bleiben unberührt — geschrieben wird genau EINER", () => {
    const raus = writeTaskFilterToParams(p("q=abc&art=gap&seite=2"), "conflict");
    expect(raus.get("q")).toBe("abc");
    expect(raus.get("seite")).toBe("2");
    expect(raus.get("art")).toBe("conflict");
    // Und beim Zurückschalten auf „all“ verschwindet NUR `art`.
    const neutral = writeTaskFilterToParams(raus, "all");
    expect(neutral.get("art")).toBeNull();
    expect(neutral.get("q")).toBe("abc");
    expect(neutral.get("seite")).toBe("2");
  });

  it("Z6 · das Schreiben verändert die übergebene Instanz nicht (reine Funktion)", () => {
    const vorher = p("art=gap");
    writeTaskFilterToParams(vorher, "conflict");
    expect(vorher.get("art")).toBe("gap");
  });
});

// Ein Verlaufsort, kurz geschrieben. Der Schlüssel selbst ist Innenleben des Moduls — geprüft wird,
// WAS ein Ort wiederfindet, nicht wie die Zeichenkette aussieht.
const ort = (pfad: string, index: number | null, eintrag: string | null): Verlaufsort => ({
  pfad,
  index,
  eintrag,
});

describe("UX-04 · welcher Verlaufsort welche Listenposition wiederfindet", () => {
  it("Z7 · zwei Besuche DERSELBEN Seite auf verschiedenen Verlaufsplätzen teilen die Stelle NICHT", () => {
    merkeListenposition(ort("/aufgaben", 4, "k-a"), 640);
    expect(leseListenposition(ort("/aufgaben", 9, "k-b"))).toBeNull();
    // Kalibrierung: gemerkt wurde wirklich etwas.
    expect(leseListenposition(ort("/aufgaben", 4, "k-a"))).toBe(640);
  });

  it("Z8 · derselbe Eintrag findet seine Stelle wieder (Browser-Zurück liefert dieselbe Kennung)", () => {
    merkeListenposition(ort("/aufgaben", 5, "k-c"), 300);
    expect(leseListenposition(ort("/aufgaben", 5, "k-c"))).toBe(300);
  });

  it("Z9 · verschiedene Pfade auf demselben Platz bleiben getrennt", () => {
    merkeListenposition(ort("/aufgaben", 6, "k-d"), 120);
    expect(leseListenposition(ort("/bibliothek", 6, "k-d"))).toBeNull();
  });

  it("Z10 · ohne gestempelten Platz ODER ohne Kennung gibt es keinen Ort — es wird nicht geraten", () => {
    merkeListenposition(ort("/aufgaben", null, "k-e"), 500);
    merkeListenposition(ort("/aufgaben", Number.NaN, "k-f"), 500);
    merkeListenposition(ort("/aufgaben", 7, null), 500);
    merkeListenposition(ort("/aufgaben", 7, ""), 500);
    expect(leseListenposition(ort("/aufgaben", null, "k-e"))).toBeNull();
    expect(leseListenposition(ort("/aufgaben", Number.NaN, "k-f"))).toBeNull();
    expect(leseListenposition(ort("/aufgaben", 7, null))).toBeNull();
    expect(leseListenposition(ort("/aufgaben", 7, ""))).toBeNull();
  });

  // ── KORREKTURPFLICHT 1 (BEN, Runde 2), DOM-frei ────────────────────────────────────────────────
  // Ein Verlaufsindex wird nach Zurück + neuem PUSH ERNEUT vergeben. Der frische Eintrag steht dann
  // auf demselben Platz wie der abgeschnittene alte — und darf dessen Stelle nicht erben.
  it("Z11 · gleicher Platz, ANDERE Eintragskennung ⇒ die alte Stelle wird NICHT vererbt", () => {
    const alt = ort("/aufgaben", 2, "eintrag-alt");
    const neu = ort("/aufgaben", 2, "eintrag-neu");
    merkeListenposition(alt, 820);
    expect(leseListenposition(alt), "Kalibrierung: die 820 liegen wirklich da").toBe(820);
    expect(leseListenposition(neu), "der frische Besuch erbt nichts").toBeNull();
  });

  it("Z12 · und der überholte Zwilling wird WIRKLICH verworfen, nicht nur übergangen", () => {
    const alt = ort("/aufgaben", 12, "zwilling-alt");
    const neu = ort("/aufgaben", 12, "zwilling-neu");
    merkeListenposition(alt, 820);
    verwirfUeberholtePositionen(neu);
    expect(leseListenposition(alt), "der abgeschnittene Eintrag ist weg").toBeNull();
  });

  it("Z13 · das Verwerfen trifft NUR den eigenen Platz und den eigenen Pfad", () => {
    const nachbarplatz = ort("/aufgaben", 14, "nachbar");
    const fremderPfad = ort("/bibliothek", 13, "fremd");
    const eigenerAlt = ort("/aufgaben", 13, "eigen-alt");
    merkeListenposition(nachbarplatz, 111);
    merkeListenposition(fremderPfad, 222);
    merkeListenposition(eigenerAlt, 333);

    verwirfUeberholtePositionen(ort("/aufgaben", 13, "eigen-neu"));

    expect(leseListenposition(eigenerAlt), "der eigene tote Zwilling: weg").toBeNull();
    expect(leseListenposition(nachbarplatz), "der Nachbarplatz bleibt erreichbar").toBe(111);
    expect(leseListenposition(fremderPfad), "ein fremder Pfad geht uns nichts an").toBe(222);
  });

  it("Z14 · ohne belastbaren Ort wird gar nichts verworfen", () => {
    const bestand = ort("/aufgaben", 15, "bestand");
    merkeListenposition(bestand, 444);
    verwirfUeberholtePositionen(ort("/aufgaben", null, "irgendwas"));
    verwirfUeberholtePositionen(ort("/aufgaben", 15, null));
    expect(leseListenposition(bestand)).toBe(444);
  });
});

describe("UX-04 · merken, lesen, begrenzen", () => {
  it("Z15 · unsinnige Werte werden verworfen, der vorhandene Eintrag bleibt stehen", () => {
    const k = ort("/aufgaben", 103, "k-g");
    merkeListenposition(k, 200);
    merkeListenposition(k, Number.NaN);
    merkeListenposition(k, -5);
    expect(leseListenposition(k)).toBe(200);
  });

  it("Z16 · eine Position, zu der die Liste nicht mehr reicht, wird auf das Machbare begrenzt", () => {
    // Die Liste ist kürzer geworden (Aufgabe erledigt): 900 gemerkt, nur 300 scrollbar.
    expect(begrenzteListenposition(900, 300)).toBe(300);
    // Passt sie noch, bleibt sie unangetastet.
    expect(begrenzteListenposition(220, 1200)).toBe(220);
    // Gar nichts mehr scrollbar ⇒ Anfang, kein Sprung ins Leere.
    expect(begrenzteListenposition(900, 0)).toBe(0);
    expect(begrenzteListenposition(900, -40)).toBe(0);
  });

  it("Z17 · ohne gemerkte Position wird NICHTS angefahren (null, nicht 0)", () => {
    // Der Unterschied trägt: 0 hieße „nach ganz oben springen", null heißt „gar nicht anfassen".
    expect(begrenzteListenposition(null, 1200)).toBeNull();
  });
});
