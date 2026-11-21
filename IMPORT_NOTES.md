# IMPORT_NOTES.md — Known problems in the imported games

This file lists the issues found while importing `data/Games_details_xlsx_-_Games.csv`
into `data/games.seed.csv`. It is a record, not a promise that everything is fine.

## Documentation choices already made

- **Mafia (Hidden Game) is inactive** (`Active = FALSE`). This is in the seed.
- **Futsal Divisions:** the Sheet import says the Prizes column has only one
  division, but the spec says **Futsal Divisions = Boys**. Both the spec and the
  code agree: divisions are Boys.
- **Feel the Beat:** active, age groups blank, `U15` and `Open` default to
  eligible. Age group is blank in the source.
- **Snake Game (Mafia) without category:** it is in `Other` in the current data,
  and it is inactive. If you want it active later, it needs a real category.

## Items in the generated seed that need review

1. **Squid Game (G08)** has no category and no Rules/Prizes text in the source
   CSV.
2. **Mafia (G35)** is inactive, has no category and no Rules/Prizes text.
3. **Feel the Beat (G34)** has no age group. It accepts U15 and Open by default.
4. **Player notes:** the source has player counts like
   `Players 7 + 2 extra` or `Players 5 + 2 extra`. The seed keeps this text as
   `MinPlayers` and `MaxPlayers` values. If the numbers are wrong, change them.
5. **Cardo, Ludo and Chess** share a Board Games description from the spec. That
   is accepted and documented here.
6. **All E-games** share one generic description. This is the original text,
   not a bug, but flag it before registration opens.

## Test-data rule

If you must add test entries for a manual test, use:

- A game with no category only if you are testing the `Other` category.
- Do not mark these games `Rejected` unless you want to lock capacity permanently.

## Formula safety for imported text

The build script calls `sanitizeCell`-equivalent normalization through the sheet
workflow, but source CSV text such as a name that starts with `=`, `+`, `-` or
`@` will be stored as-is by the importer if it appears in the Details column.
The Apps Script writes cells with `sanitizeCell` for the columns that matter, but
defensive review of the first exported CSV should be done by a person.

## Total revenue examples

If you need to check numbers, the test game set is:

- **Cricket** + **Chess** + **Badminton (Doubles)**
- Early bird total: **Rs 8,700**
- Regular total: **Rs 10,200**
- Chess has equal early and regular fees, so it should not show a strikethrough.

These numbers come from `shared/rules.js` and are tested.
