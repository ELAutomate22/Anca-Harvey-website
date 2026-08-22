# Our Corner — Phase 1 Design System

## Direction

An intimate editorial photo-book rather than a dashboard: asymmetric compositions, large literary type, tactile paper surfaces, cinematic dark rooms, restrained motion, and generous breathing space. Design dials: variance 8/10, motion 6/10, density 4/10.

## Foundations

- Display: Cormorant Garamond, medium and italic used selectively.
- Interface/body: Manrope, 16px minimum body and form controls.
- Background: warm ivory `#f3eee4`; elevated paper `#faf6ee`.
- Ink: warm charcoal `#2a211e`; secondary copy `#685d56`.
- Accent: oxblood `#6e2331`; dusty rose `#d6aaa8`; antique gold `#9f8050`.
- Corners are modest and mixed with sharp editorial rules; not every region is a floating card.
- Photography uses quiet 35mm-style fictional stills, natural crops, and subtle overlays.

## Interaction

- Micro-interactions: 150–300ms; route/section entrances no longer than ~480ms.
- Motion uses transform and opacity, with reduced-motion fallbacks.
- Minimum touch target: 44px; visible focus rings; primary actions never depend on hover.
- Mobile uses five bottom destinations with safe-area padding; secondary sections live in one accessible menu.
- Modal focus is trapped, Escape/backdrop close it, and body scroll is locked.

## Responsive Behaviour

- Mobile-first from 320px; layouts recompose rather than merely shrink.
- Desktop editorial split layouts begin around 1024px; full desktop navigation begins at 1200px.
- Content max width: 1400–1600px depending on cinematic context.
- Fixed navigation is offset in document flow; mobile content reserves bottom-bar space.

## Anti-patterns

Avoid generic equal card grids, bright pink/red, gradient text, excessive pills, hover-only information, large continuous animation, custom cursors, dashboard statistics, and Valentine/wedding motifs.
