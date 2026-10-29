# Vegenus

A phone-first memory-keeping website opened by an NFC tap.

- [Product requirements](docs/vegenus_PRD.md)
- [Implementation plan](docs/plans/vegenus_plan.md)
- [Progress](docs/vegenus_progress.md)
- [Design documents](docs/design/): start with the design map in [screens](docs/design/vegenus_screens.md#design-map-which-file-owns-what); security and the per-phase audit gate in [security](docs/design/vegenus_security.md)
- [Approved logo assets and usage](assets/logo/README.md)

## Setting up a machine

`scripts/setup.sh` checks that this machine has what the project needs (Node, Docker, dependencies, Playwright browsers, local Supabase, harness-os, the pinned security-audit skill, graphify). `scripts/setup.sh --install` offers to fix what it can: it names each download host and asks before running. Private local data such as `.design/` is not in Git; bring it over yourself.
