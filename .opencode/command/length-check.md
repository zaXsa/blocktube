---
description: Run the readability scan (over-long / over-nested functions) and get split proposals.
agent: readability
---

Run the readability scan per your instructions: scan the scope given after the
command ($ARGUMENTS — files, dirs, or --staged for staged changes; default is
the whole src tree), list every offender with file:line evidence, and propose
a concrete split per function.

Rules: read-only — do not edit, commit, or push anything. $ARGUMENTS
