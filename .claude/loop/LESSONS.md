# LESSONS — accumulated scar tissue (append; never delete)

- RLS regressions hide in test clients: tests passed while prod broke
  because tests used privileged clients. Always regression-test protected
  flows with a REAL anon-key client. (migration 030 incident)
- Migration drift is real: 019 was missing in prod for months. Run the
  ledger/audit before assuming schema; never trust repo == prod.
- git add with one bad pathspec stages NOTHING from that command but a
  prior `git rm` still commits — audit `git show --stat HEAD` after every
  commit before pushing. (manifest.ts partial-commit incident)
- Duplicate <link rel=manifest> — global convention files (app/manifest.ts)
  inject on every page and silently beat per-page metadata.
- Next route dirs must exist before heredoc writes (mkdir -p first);
  a failed file write + successful commit = shipped half a feature.
- Generated-media prompts with mood words ("slow", "wet", "intimate")
  trip false-positive NSFW filters; re-describe as plain product film.
- qlmanage drops SVG group transforms; pre-flatten coordinates.
- Postgres check constraints in prod may lag app enums (archived lead
  status) — verify constraint before writing new enum values.
- Letter-spacing on uppercase micro-labels reads as clipped text; cancel
  trailing tracking with negative margin-right.
- Vercel deploys lag pushes by minutes; verify the NEW behavior is live
  (probe a new route) before running prod tests.
