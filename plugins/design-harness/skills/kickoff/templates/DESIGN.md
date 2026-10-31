---
version: alpha
name: "{Product name}"
description: "{One line: the identity in a sentence}"
colors:
  ink: "#1b1b1f"
  canvas: "#fbfbfa"
  muted: "#6b6b73"
  line: "#e4e4e7"
  accent: "#2f5bd3"
  on-accent: "#ffffff"
typography:
  display:
    fontFamily: "{Display face}"
    fontSize: 2.5rem
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  title:
    fontFamily: "{Text face}"
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "{Text face}"
    fontSize: 1rem
    lineHeight: 1.5
  label:
    fontFamily: "{Text face}"
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.4
rounded:
  control: 8px
  card: 12px
  sheet: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.control}"
    padding: 10px 16px
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
---

<!-- Every value above is a placeholder. Kickoff replaces them from the mood board in two passes; see the
     kickoff skill. Sections below follow Google's DESIGN.md order, then this harness's own sections. -->

## Overview

{The identity in a paragraph: what the mood board contributed, and the feeling in the use scene.}

## Colors

{Each colour, what it is for, and what it is never used for. State the rule for the accent plainly.}

## Typography

{The families and why; the scale; where each step is used.}

## Layout

{Grid, gutters, measure, density per surface mode.}

## Elevation & Depth

{One elevation per object: tone step, border or shadow, chosen once.}

## Shapes

{Radius tiers by object size, and why.}

## Components

{The components the product leans on and their states.}

## Do's and Don'ts

- Do {a rule a reviewer can check}.
- Don't {a rule a reviewer can check}.

## Iconography

{The icon set, stroke weight, sizes, when an icon is allowed on a button.}

## Imagery

{Photography or illustration, its source, its treatment. Where `design/artwork` assets go.}

## Motion

{What moves, the one orchestrated moment, durations and easing, reduced-motion behaviour.}

## Chosen on purpose

Devices from the AI-look register that this brief genuinely calls for, so the reviewer does not flag them:

- {e.g. an uppercase micro-label for section names, because ...}

## Signature move

{The one memorable thing, named concretely, and the surface it lives on.}
