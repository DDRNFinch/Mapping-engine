# Mapping Engine

Basic test repository for the NVQ mapping engine that will eventually compile course packs for Evia.

## Current test

Qualification: City & Guilds Level 3 NVQ Diploma in Trowel Occupations (Construction) 6570-05.

The learner-facing browser is deliberately limited to:

- 5 categories
- maximum 5 sub-categories in each category
- maximum 5 task types in each sub-category
- 125 task types maximum

The Repair route currently uses all 125 positions and maps 779/779 atomic criterion IDs across the eight mandatory units plus optional Unit 690.

## Optional units

The route selector contains:

- 238 Thin Joint
- 690 Repair & Maintenance — current mapped test route
- 828 Specialist Masonry
- 837 Drainage

Only one optional unit is active in a learner route. The other three are excluded.

## Mapping rule

Evia should not perform fuzzy qualification mapping at runtime. A qualification is atomised and reviewed first, then a locked versioned pack is published. Learner evidence is recorded against immutable atomic IDs such as `235.7.4.u`.

The current Repair test pack has complete ID coverage but is still marked `productionReady: false` until the exact-wording audit is locked.

## QR export

The QR contains no learner or personal data. It contains a small `evia-course-url` payload pointing to the versioned course pack in this repository. Evia can later recognise this payload and import the pack.
