import { afterEach, beforeEach, vi } from "vitest";
import { assistenzProfilApi } from "../../apps/web/src/api/assistenzProfil";
import {
  ladeAssistenzProfil,
  verwerfeAssistenzProfil,
} from "../../apps/web/src/lib/assistenzProfil";

/** Kontoeinstellung für Tests, die genau den manuellen Anstoß zur Bildbeschreibung messen. */
export function verwendeManuellesBildprofil(): void {
  const lesen = () =>
    vi.spyOn(assistenzProfilApi, "lesen").mockResolvedValue({
      profil: {
        name: "Klara",
        avatar: null,
        bewegung: "standard",
        eingerichtetAm: "2026-11-01T00:00:00Z",
        geaendertAm: "2026-11-01T00:00:00Z",
        fassung: 1,
        bildAutomatik: false,
      },
      einrichtungOffen: false,
    });
  let profil: ReturnType<typeof lesen>;
  beforeEach(async () => {
    profil = lesen();
    await ladeAssistenzProfil("u1");
  });
  afterEach(() => {
    verwerfeAssistenzProfil();
    profil.mockRestore();
  });
}
