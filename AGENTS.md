# AGENTS Development Guidelines

- This project uses **SQLite MCP** with the latest stable version of **Node.js**.

## Feature & Code Changes
- For **any new feature, fix, or enhancement**:
  - Update `README.md` if the change is user-facing.
  - Always increment the version number in `package.json` after the task is completed.
  - Add an entry to `CHANGELOG.md` for every version change.
  - Update Last Updated `README.md` with the current date and time and use format `YYYY-MM-DD HH:MM:SS`
  - Update the total tools count if there is any addition or removal of tools in `README.md`

## Documentation Rules
- Do **not** create new documentation files.
- Keep documentation changes concise and include a datetime if applicable.

## Versioning Rules
- Increment the version in `package.json` when:
  - A new feature is added
  - A bug is fixed
  - Documentation is updated
  - Any production code is modified

## Testing & Cleanup
- Any temporary or test files created during development **must be removed** after testing is completed.

## Publishing Rules
- Before publishing to **npmjs**:
  - Ensure the `dist-tag` is set to `latest`
  - Verify the version number matches `CHANGELOG.md`