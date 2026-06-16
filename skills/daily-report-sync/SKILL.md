---
name: daily-report-sync
description: Reads today's git commits by the current user in the mbfs-cmc-dtqg-frontend repo, summarizes them concisely (prioritizing Jira ticket codes if present), then updates the "1. What did you do yesterday?" section of the corresponding Daily Report cell in the Google Sheet "[MBFS_Báo Cáo] Dev Tracking". Use when the user asks to "update daily report", "sync daily report", "cập nhật daily report từ commit", or similar.
---

# Daily Report Sync

Requirements: MCP `google` must already be installed (see `mcp-google-sotatek`), and the Sheet must
already be shared with `mcp-google-bot@bctk-sotatek.iam.gserviceaccount.com`.

Fixed spreadsheet:
```
spreadsheetId: 1wPqcwUD8qO_-34IIlB3KkPmlvTam6DQXIKs_XikbEj8
sheet name:    Daily Report
```

## Step 1: Determine the current user

Run:
```
git config user.name
```
This name is used both to filter commits and to match against the "Member" column in the sheet
(do not ask the user to type it manually, unless the match fails at Step 4).

## Step 2: Get today's commits

Run inside the repo (current branch):
```
git log --author="<name from Step 1>" --since=midnight --pretty=format:"%h %s"
```
If there are no commits today → tell the user and stop (never update the cell with empty content).

## Step 3: Summarize + prioritize ticket codes

For each commit message:
1. Extract a ticket code using the regex `[A-Z]{2,}[-_][A-Z0-9]+` (matches both `MPHBC-55` and
   report-style codes like `FDI_AIII4`, `EZ_A4`...).
2. If a code is found → format: `<TICKET_CODE>: <short summary of the commit>`
3. If no code is found → format: `- <short summary of the commit>`
4. Keep summaries short (< 15 words), preserve the main intent, and strip repetitive conventional-commit
   prefixes like `fix:`/`feat:`.

Join all lines into a single multi-line text block (one commit per line).

## Step 4: Locate the target cell

1. Read `Daily Report!A1:A50` (Member column) using `mcp__google__read_sheet`, find the row whose
   value matches (case-insensitive) the name from Step 1.
   - If no matching row is found → ask the user to confirm the exact display name used in the sheet.
     Never guess or create a new row.
2. Read `Daily Report!A1:<last column>1` (header row) to find the column whose value is today's date
   in `MM/DD/YYYY` format.
   - If no column for today is found → tell the user (the sheet hasn't been extended to the current
     date yet) and stop. Never add a new column automatically.
3. The target cell = `<date column><member row>`, e.g. `Daily Report!BN16`.

## Step 5: Read the current cell content, replace only section 1

1. Read the current value of the cell with `mcp__google__read_sheet`.
2. The cell follows a standard 3-section template, delimited by these markers:
   ```
   1. What did you do yesterday?
   ...
   2. What is your plan for today?
   ...
   3. Any blocker?
   ...
   ```
3. If the cell is empty or doesn't follow the template (e.g. "Weekend") → keep sections 2 and 3 as
   blank placeholders (`-`), and only build a new section 1.
4. If the cell already has all 3 sections → keep the text of sections 2 and 3 exactly as-is, and only
   replace the content of section 1 with the summary from Step 3.
5. Reassemble into one full string with all 3 sections, matching the original format.

## Step 6: Write back to the sheet

Use `mcp__google__write_sheet` with `range` = the cell identified in Step 4, `values = [[<merged content from Step 5>]]`.

After writing, report back to the user: which cell was updated, and the list of commits/tickets summarized into it.

## Notes

- Never overwrite section 2 (today's plan) or section 3 (blocker) if they already contain content.
- Never create a new row/column in the sheet — if missing, tell the user instead.
- If multiple commits share the same ticket code, merge them into a single summary line for that
  code instead of repeating it.
