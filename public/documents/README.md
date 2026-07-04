# SqueegeeKing agreement templates

Drop designer PDFs here for signed agreement overlay:

| File | Tier |
|------|------|
| `squeegeeking-biannual-agreement.pdf` | Bi-Annual — Consistent Care |
| `squeegeeking-quarterly-agreement.pdf` | Quarterly — Total Protection (White-Glove) |

Legacy fallback: `homeatlas-agreement.pdf`

When no template exists, the API generates a programmatic agreement with full benefit copy from `SQUEEGEEKING_TIERS` in `lib/membership/tier-config.ts`, including add-on discount terms (20% Bi-Annual · 25% Quarterly).

Designer PDF templates should include the **Add-On Service Discount** clause under Terms (see `ADDON_DISCOUNT_FINE_PRINT` in tier-config).

Adjust signature coordinates in `lib/agreement/generate-signed-pdf.ts` after adding templates.

Default visit prices (before sqft multiplier):

- Bi-Annual: $320/visit
- Quarterly: $249/visit

RainBlock retail: $95/visit · Hard Water retail: $75/visit · Quarterly included value: $680/yr
