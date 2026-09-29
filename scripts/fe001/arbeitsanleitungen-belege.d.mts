// Typen der exportierten Schritte aus `arbeitsanleitungen-belege.mjs` — für den Import aus
// `tests/fe001-arbeitsanleitungen/bilder-im-browser.integration.test.ts`.
import type { Browser, Page } from "@playwright/test";

export type Log = (zeile: string) => void;

export interface Bild {
  readonly datei: string;
  readonly name: string;
  readonly url: string;
  readonly viewport: { readonly width: number; readonly height: number };
}

export declare const BEISPIELBESTAND: readonly (readonly [string, string, string])[];
export declare const SUCHBEGRIFFE: readonly string[];
export declare const BREITEN: readonly number[];
export declare const KOPF: {
  readonly zweck: string;
  readonly geltungsbereich: string;
  readonly voraussetzungen: string;
};

export declare function starteBrowser(): Promise<Browser>;
export declare function neuesProtokoll(): { zeilen: string[]; log: Log };
export declare function aufBreite(seite: Page, breite: number): Promise<void>;
export declare function richteEin(seite: Page, basis: string, log?: Log): Promise<string[]>;
export declare function oeffneEinstieg(seite: Page, basis: string): Promise<void>;
export declare function anleitungAnlegen(seite: Page, titel: string): Promise<string>;
export declare function kopfSpeichern(seite: Page, log?: Log): Promise<void>;
export declare function nimmAuf(
  seite: Page,
  begriff: string,
  koId: string,
  log?: Log,
): Promise<void>;
export declare function einstiegsbild(
  seite: Page,
  aus: string,
  breite: number,
  log?: Log,
): Promise<Bild>;
export declare function auswahlbild(
  seite: Page,
  aus: string,
  breite: number,
  begriff: string,
  koId: string,
  log?: Log,
): Promise<Bild>;
export declare function lesestandbild(
  seite: Page,
  aus: string,
  breite: number,
  log?: Log,
): Promise<Bild>;
export declare function sha256(datei: string): string;
export declare function pngMasse(datei: string): { width: number; height: number } | null;
export declare function kandidat(): {
  commit: string;
  arbeitsbaumSauber: boolean;
  build: { indexHtmlSha256: string; skripte: string[] } | null;
};
