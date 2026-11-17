# Quantity-aware unit labels

Use Unit only for one, Units for zero and every other quantity. Generic field labels use Units. Apply across Vue screens, notifications, validation messages and generated authorization PDFs. Retain PDF numeric and unit column alignment and existing calculation behavior.

1. Add a shared unitLabel helper with tests for zero, one, two, larger quantities and missing values.
2. Replace quantity-bearing Unit(s) text with the shared helper; replace generic labels with Units. Fix adjacent singular verbs where necessary.
3. Update PDF expectations and regenerate/render the sample. Run affected tests and production build. Audit remaining placeholder text.
