# Project notes for Claude & DeepSeek

## Standing authorization (set 2026-05-09, extended 2026-05-27)

The user wants the full flow automated end-to-end. **Do not ask for
confirmation** at any of these steps:

1. Make code changes
2. `git commit` + `git push` to the current feature branch
3. Open a PR against `main` if one doesn't already exist
4. Merge the PR (squash merge by default)

This applies to all changes Claude or DeepSeek make in this repo unless the user
explicitly says otherwise for a specific task. The user has accepted
the responsibility for any consequences of auto-merge.

Still confirm before:
- Force-pushing
- Deleting branches that aren't the just-merged one
- Anything outside this repo

## Known issue: space in user path

The Windows username `Maik Zschach` contains a space. This workspace sits at
`C:\Users\Maik Zschach\the-tribe` — many tools (shell, read_file with offsets,
git, path-based operations) break on or misbehave with the space.

### Workarounds (apply in order of preference)

1. **Open workspace from a junction without spaces.** Create it once as admin:
   ```
   mklink /J C:\Users\MaikZschach "C:\Users\Maik Zschach"
   ```
   Then open `C:\Users\MaikZschach\the-tribe` as workspace in DeepSeek TUI.

2. **Clone/move the repo to a path without spaces**, e.g. `C:\dev\the-tribe`.

3. **When stuck:** use `grep_files` instead of `read_file` with offsets for
   targeted lookups. For shell commands, escape or avoid paths with spaces;
   prefer `git` operations that work on the current directory implicitly.

4. **If `read_file` returns file from line 1 regardless of offset**, the tool
   is hitting the space-in-path bug — use `grep_files` for the specific lines
   and verify with `exec_shell` (PowerShell) quoting the path carefully.

## Deployment

`docs/` is published via GitHub Pages from the `main` branch, so a merge
to `main` triggers an automatic deploy to `https://maikz91.github.io/the-tribe-bot/`
within ~1-2 minutes.
