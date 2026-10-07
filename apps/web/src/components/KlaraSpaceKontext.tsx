// Klaras Spacekontext (produkt:20261007:spaces): wo Klara gerade steht — in welchem Space, mit
// welchem Zweck und welcher Zuständigkeit, und bei einem Artikel getrennt davon dessen
// Verantwortung. Die Auskunft kommt vom Server und nur, wenn dieses Konto Space bzw. Artikel sehen
// darf (sonst 404 → Klara sagt dazu nichts). Kein zweiter Rechteweg im Client.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { spacesApi } from "../api/spaces";

function ortAus(pfad: string): { art: "artikel" | "space"; id: string } | null {
  const artikel = /^\/wissen\/([^/]+)/.exec(pfad);
  if (artikel?.[1]) {
    return { art: "artikel", id: decodeURIComponent(artikel[1]) };
  }
  const space = /^\/spaces\/([^/]+)/.exec(pfad);
  if (space?.[1]) {
    return { art: "space", id: decodeURIComponent(space[1]) };
  }
  return null;
}

export function KlaraSpaceKontext({ pfad }: { pfad: string }): JSX.Element | null {
  const { t } = useTranslation();
  const ort = ortAus(pfad);
  const artikel = useQuery({
    queryKey: ["space-kontext", ort?.id ?? ""],
    queryFn: () => spacesApi.kontext(ort?.id ?? ""),
    enabled: ort?.art === "artikel",
    retry: false,
  });
  const space = useQuery({
    queryKey: ["space", ort?.id ?? ""],
    queryFn: () => spacesApi.eintrag(ort?.id ?? ""),
    enabled: ort?.art === "space",
    retry: false,
  });

  let zeilen: string[] = [];
  if (ort?.art === "artikel" && artikel.isSuccess) {
    const k = artikel.data;
    const verantwortung = k.artikelVerantwortung.name ?? k.artikelVerantwortung.person;
    zeilen = k.space
      ? [
          t("spaces.klara.artikelInSpace", { name: k.space.name }),
          t("spaces.klara.zweck", { zweck: k.space.zweck }),
          t("spaces.klara.zustaendig", {
            name: k.space.verantwortlichName ?? k.space.verantwortlich,
            verantwortung,
          }),
          t(`spaces.eigenesRecht.${k.space.eigenesRecht}`),
        ]
      : [t("spaces.klara.artikelOhneSpace")];
  } else if (ort?.art === "space" && space.isSuccess) {
    const s = space.data.space;
    zeilen = [
      t("spaces.klara.inSpace", { name: s.name }),
      t("spaces.klara.zweck", { zweck: s.zweck }),
      t("spaces.klara.zustaendigSpace", { name: s.verantwortlichName ?? s.verantwortlich }),
      t(`spaces.eigenesRecht.${s.eigenesRecht}`),
    ];
  }
  if (zeilen.length === 0) {
    return null;
  }
  return (
    <div data-testid="klara-space-kontext">
      <div className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("spaces.klara.label")}
      </div>
      {zeilen.map((z) => (
        <p key={z} className="text-[12px] leading-relaxed text-muted">
          {z}
        </p>
      ))}
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-2">
        {t("spaces.klara.antwortGrenze")}
      </p>
    </div>
  );
}
