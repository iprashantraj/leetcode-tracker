---
name: User's LeetCode keyboard shortcuts
description: This user customized their LeetCode shortcuts — Run and Submit are mapped differently from LeetCode defaults.
type: user
originSessionId: 0549dd88-73ad-4a5d-8d42-3b826b871dca
---
User's LeetCode shortcut mapping (custom, not defaults):

- **Ctrl+'** → Run
- **Ctrl+Enter** → Submit

**Why:** User stated this on 2026-05-16 after I incorrectly assumed default LeetCode bindings (Ctrl+Enter = Run, Ctrl+Shift+Enter = Submit) in the extension. Their actual setup tracks Submit on Ctrl+Enter, which was being mislabeled as Run by the extension before the fix.

**How to apply:** When working on the extension's keyboard shortcut detection in content.js, use this mapping. If we ever build the settings page (still deferred), this needs to be the default for this user but configurable per-user since LeetCode lets each account customize.

Code location: `extension/content.js`, `SHORTCUT_MAP` constant.

Default LeetCode bindings (for reference, in case other users join):
- Ctrl+Enter → Run (LeetCode default, immutable for some accounts)
- No built-in Submit shortcut
