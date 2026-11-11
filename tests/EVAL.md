# Evaluation before a release

Automated part: `npm run eval` (or the **Skill evaluation** workflow) runs the `claude plugin eval` suite in `plugins/project-setup-kit/evals/`: the analysis of every fixture compared with its `expected.json`, and four behavior cases (one question on the first turn, consent before writing, `status` read-only, `remove` asks first), each with and without the plugin. After editing an `expected.json`, run `npm run build-evals`; `npm run check` fails while the cases are out of date. Run the suite first; the manual part below covers the multi-turn flow it cannot see.

## Manual walk-through

The script tests (`npm test`) cover the guard and check scripts. The skill itself is instructions for a model, so it is evaluated by running it on the fixtures.

For each folder in `tests/fixtures/`:

1. Copy it to a scratch folder and make it a repo: `cp -R tests/fixtures/<name> /tmp/kit-eval-<name> && cd /tmp/kit-eval-<name> && git init -q && git add -A && git commit -qm init`.
2. Start Claude Code there with the plugin loaded from this checkout: `claude --plugin-dir <path-to-this-repo>/plugins/project-setup-kit`.
3. Run `/setup-kit` and stop after the analysis report.
4. Compare with `expected.json`: parts, `has`, already configured, partial, not applicable. Every mismatch is a bug in `references/detection.md` or `references/catalog.md`.
5. Continue with "accept group" for groups A–C and check:
   - every item asks one question with a recommendation and a reason,
   - nothing is written before a yes,
   - after each item the created/modified files are listed and confirmation is requested,
   - `.ai-kit.json` records each item,
   - `node .ai-kit/scripts/*.mjs` run without errors in the fixture,
   - the git guard blocks `git commit` from the agent and the env guard blocks `cat .env`.
6. Run `/setup-kit status`, then `/setup-kit remove 18` and check that the files are gone and `AGENTS.md` and `.ai-kit.json` are updated.

Record the result in the release notes in `CHANGELOG.md`.
