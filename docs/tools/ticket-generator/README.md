# Ticket generator

Source of truth for the ticket drafts. Edit `tickets_*.py`, then run:

```
python3 tools/ticket-generator/gen.py --write
```

It validates (unique ids, estimates <= 2 days, dependencies exist and point backwards, acyclic, every requirement and story covered) and regenerates `jira/*.md`, `jira/tickets.csv` and `08-traceability-matrix.md`. Run without `--write` for a check only.

## Execution status

`status.json` records the dated S0/S1 status snapshot, merged PR references and completion or
remaining acceptance notes. Update this file when execution progress changes; the generator
retains this evidence in the slice documents. Tickets without a status entry in a tracked
slice default to `not started`. Merge evidence checks only the Implementation merged box;
it does not automatically check manual, production or full acceptance criteria.

To refresh only the two status documents, without changing the CSV or traceability matrix:

```
python3 tools/ticket-generator/gen.py --write --slices S0,S1
```

Status keys and values are validated against the ticket definitions. Full `--write`
generation also includes the execution status in the tracked slice documents.
For open PR references, set `merged: false`; their links are labelled Open PRs and the
Implementation merged checkbox remains unchecked. Omitted `merged` means verified merged PRs.
