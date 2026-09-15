// JOB 4086 — DIE KENNUNG DES SHAREPOINT-BEREICHS, EINMAL.
//
// Sie hat eine EIGENE, abhängigkeitsfreie Datei, und das ist kein Ordnungstick: Die Quellen-Galerie
// (`components/ImportSourceGallery.tsx`) braucht sie als Linkziel, und diese Galerie wird auch ohne
// Router, ohne Abfrage-Klienten und ohne Rollenkontext gerendert — die SSR-Fixture der
// Import-Erklärseite tut genau das (`tests/m6-import-erklaerweg/gallery-fixture.tsx`). Zöge die
// Galerie die Kennung aus dem Bereichs-Bauteil, hinge an einer Zeichenkette der gesamte
// Abfrage-/Kontext-Baum.
//
// Und getippt wird sie nirgends zweimal: der Bereich setzt sie als `id`, die Kachel zeigt als
// `#<Kennung>` darauf. Zwei Abschriften wären die Form, in der ein Link eines Tages ins Leere zeigt.
export const SHAREPOINT_BEREICH_ANKER = "sharepoint-import";
