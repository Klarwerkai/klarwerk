import type { Role } from "../../../auth";
import type { EvidenceRecord, KoVersionSnapshot } from "../../../knowledge-object";
import type { ObjectStore } from "../../../object-store";
import type { OfficeAblage } from "../office-ablage";
import type { OfficeEditorEinrichtung, OfficeKoDienst } from "../office-artikel";
import type { DatenpunktAblage } from "../praesentation-daten-ablage";

export interface OfficeKonto {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  readonly approved: boolean;
}

export interface OfficeRoutesDeps {
  readonly datenpunkte?: DatenpunktAblage;
  readonly ko: OfficeKoDienst & {
    versionsOf(id: string): Promise<KoVersionSnapshot[]>;
    evidenceOf(id: string): Promise<EvidenceRecord[]>;
  };
  readonly objekte: ObjectStore;
  readonly einrichtung: OfficeEditorEinrichtung;
  readonly konten: () => Promise<readonly OfficeKonto[]>;
  readonly spaceLesbar: (user: { id: string; role: Role }) => Promise<ReadonlySet<string>>;
  /** Liest die Discovery; austauschbar für Tests. */
  readonly holeDiscovery?: (url: string) => Promise<string>;
  readonly jetzt?: () => number;
  /** Sitzungen und gesicherte Stände; ohne Angabe die Speicherfassung (ohne Neustartschutz). */
  readonly ablage?: OfficeAblage;
}
