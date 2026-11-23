# Product Catalog Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify Products to an aligned spreadsheet table with only the requested fields and Medi-Cal coverage tags.

**Architecture:** Replace the product page's duplicate card/grid render paths with one semantic table. Reuse ordered editor field definitions for the first ten approved columns; retain product API and editor unchanged.

**Tech Stack:** Nuxt, Vue, TypeScript, Vitest, Vue SSR renderer.

**Spec:** docs/superpowers/specs/2026-11-20-product-catalog-table-design.md

## Global Constraints
- Show the ten approved fields in the documented order, plus a dedicated Edit column.
- No WIC tags or filters; only covered products get a Medi-Cal tag.
- Existing product detail fields and quantities remain unchanged.
- No push or deployment requested.

## Review Focus
- Missing description/name and blank values must not move other cells.
- Explicit false coverage must override stale legacy medical coverage.
- Leading zeroes and numeric zero must display unchanged.
- Empty search/filter results must retain aligned headers and a spanning message.
- Long values and narrow screens must scroll without shifting column boundaries.

### Task 1: Catalog table

- [x] Add compiled Vue SSR tests for exact headers, same cell count for each row, correct value mapping, links, blank/zero values and coverage/filter behavior.
- [x] Run tests and observe failure on the old grid layout.
- [x] Implement the semantic table, same coverage predicate for tags/filtering and correctly labeled form choices; remove obsolete grid-only styles.
- [x] Run focused and full tests, production build and diff check; get a fresh code review.

## Verification

Compiled Vue render tests verify the exact headers and values, old view-cookie compatibility, empty rows, blank values, numeric zero, leading zeroes, Medi-Cal tags and filters, text/form filtering, and supplier-reference search. Browser check with 130 local products confirmed 11 aligned headers/cells, contained horizontal scrolling at a 654px viewport, and an Edit link opening the individual product. Independent review found removed supplier-reference search; reproduced with a failing test and restored it. Full suite and production build checked at completion. No push or deployment performed.

## Approved filter follow-up

- [x] Replace Form and Coverage with McKesson PO and WIC Category selectors.
- [x] Include All and Not specified; use actual PO values and only the four standard WIC categories.
- [x] Combine filters with search and natural alphabetical formula order.
- [x] Verify compiled render behavior, blank selection, legacy values, and browser interaction (Y + Exempt yields 20 local products).
- [x] Run full suite, production build and independent review at completion.
