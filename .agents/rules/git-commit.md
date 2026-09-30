# Git Commit Rules

- **Never use `--no-verify`** when committing. Pre-commit hooks (lint-staged) exist to enforce code quality (eslint, prettier). Let them run.
- If a commit is blocked by lint-staged, **fix the issues** instead of bypassing the hook.
- Commits may take longer due to hooks — wait for them to complete (up to 30s).
- Branch naming: do not include issue numbers (e.g., `feat/api-sport` not `feat/79-sport-crud`).
- Commit convention: granular, one capability per commit, format `type(scope): description`.
- Do not push to remote. Keep commits local for user review.
