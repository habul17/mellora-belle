-- The owner's real text for the first three products, in place of the
-- seed's "..." placeholders. Matched by slug, so a database without these
-- products is left alone. Later edits happen on the admin Products page.

UPDATE "Product" SET
  "description" = $txt$Elevate your everyday wardrobe with the Midnight Bloom Designer Kurthi, crafted for women who love timeless elegance with effortless comfort. Featuring a rich dark purple floral print and graceful silhouette, this designer kurthi is perfect for office wear, festive gatherings, casual outings and family occasions. Made from premium rayon fabric, it offers a soft feel, breathable comfort and a flattering drape.$txt$,
  "details" = $txt$Fabric: Premium Rayon
Colour: Dark Purple
Print: Floral Print
Fit: Regular Fit
Neckline: Split Round Neck
Sleeves: 3/4 Sleeves
Length: Calf Length
Style: Casual, Office, Festive & Everyday Wear
Closure: Front Tie-Up
Package Includes: 1 Designer Kurthi
Perfect For: Office Wear • Casual Outings • College • Festive Gatherings • Family Functions • Daily Wear$txt$,
  "sizeChart" = $txt$Size, Bust, Waist, Hip, Length
M, 38, 36, 42, 46
L, 40, 38, 44, 46
XL, 42, 40, 46, 46
XXL, 44, 42, 48, 46$txt$,
  "care" = $txt$Hand wash separately in cold water.
Use a mild detergent.
Do not bleach.
Dry in the shade.
Iron on low to medium heat.$txt$
WHERE "slug" = 'midnight-bloom-designer-kurthi';

UPDATE "Product" SET
  "description" = $txt$Refresh your wardrobe with the Ocean Bloom Designer Kurthi, designed to blend elegance with everyday comfort. The beautiful blue floral print paired with a graceful silhouette makes it an ideal choice for office wear, brunches, festive occasions and casual outings. Crafted from premium rayon fabric, it offers a soft feel, breathable comfort and a flattering drape for all-day wear.$txt$,
  "details" = $txt$Fabric: Premium Rayon
Colour: Navy Blue
Print: Floral Print
Fit: Regular Fit
Neckline: Split Round Neck
Sleeves: 3/4 Sleeves
Length: Calf Length
Style: Casual, Office, Festive & Everyday Wear
Closure: Front Tie-Up
Package Includes: 1 Designer Kurthi$txt$,
  "sizeChart" = $txt$Size, Bust, Waist, Hip, Length
M, 38, 36, 42, 46
L, 40, 38, 44, 46
XL, 42, 40, 46, 46
XXL, 44, 42, 48, 46$txt$,
  "care" = $txt$Hand wash separately in cold water.
Use mild detergent.
Do not bleach.
Dry in shade.
Iron on low to medium heat.$txt$
WHERE "slug" = 'ocean-bloom-designer-kurthi';

UPDATE "Product" SET
  "description" = $txt$Step into effortless elegance with the Olive Aura Co-ord set. Inspired by fresh botanical hues, this beautifully crafted designer kurthi features a soothing olive green floral print that brings together sophistication and everyday comfort. Made from premium rayon fabric, it offers a lightweight feel, breathable comfort and a graceful drape, making it perfect for office wear, brunches, festive gatherings and casual outings. Designed for women who love timeless fashion with a modern touch, this kurthi is a versatile wardrobe essential.$txt$,
  "details" = $txt$Fabric: Premium Rayon
Colour: Olive Green
Print: Floral Print
Fit: Regular Fit
Neckline: V Neck
Sleeves: 3/4 Sleeves
Length: Calf Length
Style: Casual, Office, Festive & Everyday Wear
Package Includes: 1 Co-ord set$txt$,
  "sizeChart" = $txt$Size, Bust, Waist, Hip, Length
M, 38, 36, 42, 46
L, 40, 38, 44, 46
XL, 42, 40, 46, 46
XXL, 44, 42, 48, 46$txt$,
  "care" = $txt$Hand wash separately in cold water.
Use mild detergent.
Do not bleach.
Dry in shade.
Iron on low to medium heat.$txt$
WHERE "slug" = 'olive-aura-co-ordset';
