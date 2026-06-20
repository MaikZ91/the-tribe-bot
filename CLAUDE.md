# Project notes for Claude & DeepSeek

## Mode

Simple mode: read the repository, understand the codebase, and perform tasks
as requested. No auto-commit, no auto-push, no auto-PR, no auto-merge.
Confirm before any write operation.

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
