-- Olive Aura is a co-ord set, but its description called it a kurthi twice.
UPDATE "Product"
SET "description" = replace(replace("description",
  $txt$this beautifully crafted designer kurthi$txt$, $txt$this beautifully crafted co-ord set$txt$),
  $txt$this kurthi is$txt$, $txt$this co-ord set is$txt$)
WHERE "slug" = 'olive-aura-co-ordset';
