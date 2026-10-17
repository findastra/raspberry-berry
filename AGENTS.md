# AGENTS.md: Raspberry Berry

Raspberry Berry is a pet app by Astra. Its pet is Raspberry Pi, drawn in the shape of the berry logo. It manages Astra's Raspberry Pi projects. Status: **growing**.

Rules for any assistant working here:

- Follow the pet rules in Astra's PetOS ([findastra/astras-pet-os](https://github.com/findastra/astras-pet-os), `PET-FILES.md`): `pet.json` must stay valid, `sprite` and `entry` must be real files, and status is hatching, growing or grown.
- Changes to the job, status, moods or audit are submitted to the Friendly Farmer through `cage.submit` in `pet.json`, with the date.
- Before changing anything, check the hub's newest handoff (`docs/handoff-*.md` on its `main`). Do not touch the hub from this repo.
- The pet art comes from `scripts/draw-berry.mjs`. Change the drawing there and re-run it; never hand-edit `sprite.json`, `sprite.js` or `logo.svg`. Keep the logo shape: two leaves, packed drupelets, black seams.
- Project data stays in Astra's browser. Do not add keys, `.env` files or personal data. Public credit is Astra.
- Update `pet.json` `built_with` with the model and date of any change.

built_with: Claude Haiku 5.5 (claude-haiku-5-5), 2026-10-09; Claude Opus 5.5 (claude-opus-5-5), 2026-10-10

Desktop pet revision by OpenAI Codex (GPT-6), 2026-10-11. See desktop-pet-20261011.json for the current artwork, size and behavior. Desktop art remains a draft; no sparkles.
