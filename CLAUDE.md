# Project notes for Claude

## Standing authorization (set 2026-05-09)

The user wants the full flow automated end-to-end. **Do not ask for
confirmation** at any of these steps:

1. Make code changes
2. `git commit` + `git push` to the current feature branch
3. Open a PR against `main` if one doesn't already exist
4. Merge the PR (squash merge by default)

This applies to all changes Claude makes in this repo unless the user
explicitly says otherwise for a specific task. The user has accepted
the responsibility for any consequences of auto-merge.

Still confirm before:
- Force-pushing
- Deleting branches that aren't the just-merged one
- Anything outside this repo

## Deployment

`docs/` is published via GitHub Pages from the `main` branch, so a merge
to `main` triggers an automatic deploy to `https://maikz91.github.io/the-tribe-bot/`
within ~1-2 minutes.
