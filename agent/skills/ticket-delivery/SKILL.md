---
name: ticket-delivery
description: Follow the required branch, test, PR description, and screenshot evidence format for every Jira ticket implemented in this repository.
---

# Ticket delivery

Use this workflow whenever implementing a Jira story, task, bug, or technical ticket in MapIt.

## Before editing

1. Read the root `AGENTS.md` and the local `AGENTS.md` files for every affected area.
2. Read the Jira issue and its linked dependencies. Record the key, exact ticket name, acceptance criteria, and scope in the work notes.
3. For a user story, create `spec.md`, then `plan.md`, then `tasks.md` under `specs/<ticket-id>-<slug>/`. Do not begin feature code before the spec exists. Keep the three files in that order and update task execution notes before completion.

## Branch and pull request

- Use the authenticated GitHub account handle for the implementer. Determine it with `gh api user --jq .login`; do not substitute the remote owner or display name when they differ.
- Name the branch `feat/<github-handle>/<ticket-id>-<ticket-slug>`. Preserve the ticket ID and slugify every word in the ticket name after the ID as lowercase kebab case, including short words. Example: `feat/GatoCoder282/HU-6.01-buscador-de-disponibilidad`.
- Use the exact Jira ticket name as the PR title, including its story code and punctuation. Repeat it in the PR template's `Nombre exacto del ticket` field. Example: `HU-6.01 — Buscador de Disponibilidad`.
- Keep the PR description to one or two sentences. Include the Jira link and the base branch in the template fields.

## Required verification and evidence

- Run the repository's required checks and every applicable unit, integration, contract, build, and end-to-end test. Fix failures and rerun the checks before requesting review.
- A ticket is not ready for review while required checks are failing or have not completed.
- After all required test workflows pass, capture the current PR's Checks view with every required test check visibly green and attach that screenshot to the PR. The ticket-delivery policy job is a separate gate and does not need to appear in the test screenshot. Local terminal output and screenshots from another PR do not satisfy this requirement.
- Keep the screenshot attached to the PR as image evidence. Do not commit it to the repository unless the ticket specifically asks for a versioned artifact.
- Update the PR template checklist and the ticket's `tasks.md` with the executed commands and a reference to the evidence. If the PR or remote checks do not exist yet, leave the screenshot task open and report it as the remaining handoff.

## Finish

- Confirm the PR title, brief description, Jira traceability, base branch, required green test checks, and attached screenshot.
- Confirm all applicable acceptance criteria and `tasks.md` notes are complete before reporting the ticket finished.
