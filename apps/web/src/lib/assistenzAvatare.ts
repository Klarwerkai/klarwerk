// ================================================================================================
// produkt:20261010:assistenz-name-avatar — DIE DREIZEHN FREIGEGEBENEN AVATAR-MOTIVE (Erstauswahl v1).
// ================================================================================================
//
// Stabile Kennungen, Gruppe und Datei. Spiegel von `ASSISTENZ_AVATARE` in
// `services/app/src/assistenz-profil.ts`; `tests/assistenz-profil/katalog.test.ts` hält beide gleich.
//
// „Original" ist das UNVERÄNDERTE orange Maskottchen — dieselbe Datei und dieselbe Anbindung wie
// bisher (`KLARA_AVATAR_DATEI`, Prüfsumme in `components/klara-vorschau/avatar.ts`), keine zweite
// Kopie. Die zwölf neuen Basisbilder liegen lokal im Bau unter `assistenz/erstauswahl-v1/`; die
// Auswahl braucht keinen externen Bilddienst. Personenporträts und menschliche Büsten aus
// historischen Entwürfen gehören NICHT dazu.
import { KLARA_AVATAR_DATEI } from "../components/klara-vorschau/avatar";

export type AvatarGruppe = "ausdrucksstark" | "sachlich";

export interface AssistenzAvatarMotiv {
  /** Stabile Kennung — so steht sie am Konto. */
  readonly id: string;
  readonly gruppe: AvatarGruppe;
  /** Relativer Pfad im Bau (`apps/web/public/…`). */
  readonly datei: string;
}

export const ASSISTENZ_AVATAR_VERZEICHNIS = "assistenz/erstauswahl-v1";

const neu = (id: string, gruppe: AvatarGruppe): AssistenzAvatarMotiv => ({
  id,
  gruppe,
  datei: `${ASSISTENZ_AVATAR_VERZEICHNIS}/${id}.png`,
});

export const ASSISTENZ_AVATAR_KATALOG: readonly AssistenzAvatarMotiv[] = [
  { id: "original", gruppe: "ausdrucksstark", datei: KLARA_AVATAR_DATEI },
  neu("lichtwesen", "ausdrucksstark"),
  neu("roboter", "ausdrucksstark"),
  neu("eule", "ausdrucksstark"),
  neu("fuchs", "ausdrucksstark"),
  neu("pinguin", "ausdrucksstark"),
  neu("wolke", "ausdrucksstark"),
  neu("kompass", "sachlich"),
  neu("prisma", "sachlich"),
  neu("wissensbuch", "sachlich"),
  neu("verbindungsknoten", "sachlich"),
  neu("monolith", "sachlich"),
  neu("leuchtkreis", "sachlich"),
];

export const AVATAR_GRUPPEN: readonly AvatarGruppe[] = ["ausdrucksstark", "sachlich"];

/** Ohne gespeicherte Wahl zeigt die Assistenz das bisherige Original — wie vor diesem Auftrag. */
export const STANDARD_AVATAR = "original";

export function avatarMotiv(id: string | null | undefined): AssistenzAvatarMotiv | null {
  return ASSISTENZ_AVATAR_KATALOG.find((m) => m.id === id) ?? null;
}
