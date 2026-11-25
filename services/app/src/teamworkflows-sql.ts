// Die Versionsbindung gilt für die Quellen jedes einzelnen Assistenten.
// Ein Konflikt zwischen zwei getrennten Quellmengen gehört zu keiner der beiden Proben.
export function workflowQuellschutzSql(
  quellgruppenParameter: number,
  konfliktstandParameter: number,
  sichtbedingung: string,
): string {
  return `NOT EXISTS (
    SELECT 1 FROM jsonb_each($${quellgruppenParameter}::jsonb) gruppe(assistent, quellen)
    WHERE EXISTS (
      SELECT 1 FROM jsonb_each_text(gruppe.quellen) ref(id, version)
      WHERE NOT EXISTS (
        SELECT 1 FROM kos k WHERE k.id=ref.id AND k.status='validiert'
        AND k.data->>'version'=ref.version
        AND COALESCE(k.data->'schutzdatenQuarantaene','null'::jsonb) IN ('null'::jsonb,'false'::jsonb)
        AND (${sichtbedingung})
      )
    ) OR (
      SELECT COALESCE(jsonb_agg(c.id ORDER BY c.id COLLATE "C"), '[]'::jsonb)
      FROM conflicts c
      WHERE c.data->>'type'='truth' AND c.data->>'status' IS DISTINCT FROM 'geloest'
        AND (SELECT count(*) FROM jsonb_object_keys(gruppe.quellen)) >= 2
        AND gruppe.quellen ? (c.data->>'koA') AND gruppe.quellen ? (c.data->>'koB')
        AND (NOT (c.data ? 'koAVersion') OR c.data->'koAVersion' = gruppe.quellen->(c.data->>'koA'))
        AND (NOT (c.data ? 'koBVersion') OR c.data->'koBVersion' = gruppe.quellen->(c.data->>'koB'))
    ) IS DISTINCT FROM (($${konfliktstandParameter}::jsonb ->> gruppe.assistent)::jsonb)
  )`;
}
