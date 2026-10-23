# Zodiac sign artwork — complete

Owner approved storing these 12 original, non-personal constellation illustrations here on 2026-10-22. This is an explicit exception to the earlier instruction to keep zodiac artwork outside the repository. The folder spelling `zodic-sign` follows the owner request.

One transparent square SVG per Western sign, each with a 400 × 400 viewBox. Total: 56,886 bytes; combined individual gzip sizes: 13,414 bytes. No embedded fonts, scripts, external resources, raster images, filters or animation. Coordinates are decorative, not scientific charts. `manifest.json` records dimensions, sizes and SHA-256 checksums. Artwork delivery is done; dashboard upload, processing and runtime integration are pending.

## Integration contract

- These source illustrations contain no personal content. Production artwork remains page-owned content uploaded through the dashboard and stored privately (§3.3); this directory does not authorize public storage of personal uploads.
- Keep one square picture per sign. Target approximately 150 KB or less per processed picture; do not inflate these smaller SVGs. Confirm supported upload formats before integration; sanitize SVG uploads or rasterize safely to WebP if the pipeline disallows SVG.
- When the Zodiac screen opens, load all 12 images together through the same page-access checks. Calculate the sign locally. Do not select image requests by birthday or result, or send birthdays/signs through URLs, analytics or logs. Requests still reveal that the Zodiac screen opened. Explicit profile-save consent is a separate existing flow.
- Static images now; add dynamic stars, glows and constellation effects at integration, with a still-image path for reduced motion.
- Retain the celestial style and elegant serif direction. The generated concept has no identifiable font file; select a licensed Vietnamese-capable web font later. Keep localized names in HTML rather than embedding type in images.

Validation: 12 unique expected signs, XML parsing, square dimensions, manifest checksums and byte budget. Browser rendering verification remains pending because the available browser could not launch in this environment.
