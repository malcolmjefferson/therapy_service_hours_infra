# Ticket generator

Source of truth for the ticket drafts. Edit `tickets_*.py`, then run:

```
python3 tools/ticket-generator/gen.py --write
```

It validates (unique ids, estimates <= 2 days, dependencies exist and point backwards, acyclic, every requirement and story covered) and regenerates `jira/*.md`, `jira/tickets.csv` and `08-traceability-matrix.md`. Run without `--write` for a check only.
