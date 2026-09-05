# CommerceAgent — Project Instructions

## Standing rules (always apply)
- **After every change (code, config, docs — anything), commit and push it to GitHub.**
  - Commit with a clear, concise message describing the change.
  - Push to the project's remote (`git push`) before finishing the task.
  - If the remote/repo is not yet set up, ask the user for the GitHub repo URL, initialize git, connect it, and push.
- **After every change, compile and check for ALL TypeScript errors, then fix them.**
  - Run `npm run typecheck` (i.e. `tsc --noEmit`) and/or `npm run build` after making changes.
  - Do not stop at the first error — fix every reported TS error until the compile is fully clean.
  - Never leave the codebase in a state where `npm run build` fails.
  - Push only after the build/typecheck passes.

## Notes
- Do not push if the working tree has secrets (.env is gitignored — keep it that way).

