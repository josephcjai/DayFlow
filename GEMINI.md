# Agent Guidelines & Safety Rules

## Git Safety & Commit Policies
- **NEVER** run `git commit` or `git push` autonomously or preemptively.
- Always wait for the user to explicitly ask to commit or push changes.
- Before committing, always present:
  1. A clear, concise summary of the modified files.
  2. The exact proposed commit message.
  3. The verification status / test results.
- Only run `git add`, `git commit`, and `git push` when the user has provided unambiguous instruction in their request (e.g., "please check in and push", "commit the changes").

