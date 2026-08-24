# Our Corner effects system

Phase 6 treats motion as editorial punctuation. Effects should reinforce memory, time, anticipation, choice, connection, nostalgia, or celebration; they should not compete with the archive itself.

## Toolkit

- React and the already-installed Framer Motion package handle route, modal, layout, reveal, and state transitions.
- CSS handles film grain, light leaks, envelope layers, focus/hover responses, vinyl depth, and the global reduced-motion fallback.
- Lucide remains the only icon language.
- GSAP, Three.js, React Three Fiber, smooth-scroll libraries, cursor libraries, and continuous WebGL scenes are deliberately not used. The current interactions do not justify their bundle, cleanup, accessibility, or battery cost.

## Shared tokens

JavaScript motion tokens live in `src/lib/motion.ts`. Matching CSS custom properties live in `src/index.css`.

| Token | Duration | Intended use |
| --- | ---: | --- |
| instant | 120 ms | immediate acknowledgement |
| fast | 180 ms | exits and small state changes |
| base | 280 ms | buttons, modals, and navigation |
| reveal | 480 ms | section and content reveals |
| cinematic | 680 ms | one-off photographic or emotional sequences |

The primary easing is `cubic-bezier(0.22, 1, 0.36, 1)`. Enters are slower than exits. Springs are limited to gentle layout continuity and tactile controls.

The shared z-index scale is atmosphere 0, content 10, navigation 40, modal 50, grain 60, and full-screen success transition 70.

## Device tiers

`src/hooks/useEffectTier.ts` provides conservative `low`, `medium`, and `high` tiers.

- Low: compact/coarse-pointer devices, devices reporting four or fewer logical cores, devices reporting 4 GB or less memory, and every reduced-motion session.
- Medium: the default for capable devices where hardware confidence is incomplete.
- High: desktop-class pointer devices reporting at least eight logical cores and 8 GB memory at a device-pixel ratio no greater than 2.

The tier is a progressive-enhancement hint, never an authorization boundary. Content and controls do not depend on it. The Home pointer-depth treatment is high-tier only; every other tier receives the same static composition.

## Global atmosphere

- The existing low-opacity SVG noise layer remains fixed and pointer-transparent.
- `CinematicAtmosphere` adds two static ambient gradients and a slightly warmer light leak only on emotional archive routes.
- Route changes use the shared page variants and keep focus management in `AppShell`.
- Desktop and mobile navigation use Framer Motion layout indicators for spatial continuity.
- Skeletons use the existing warm shimmer and reserve content space.

No atmosphere runs an infinite JavaScript animation loop.

## Reusable primitives

- `PageTransition`: route-level fade and slight vertical continuity.
- `Reveal`: one-time in-view section reveal.
- `PhotoReveal`: one-time film-develop veil with opacity/scale fallback.
- `Modal`: focus-trapped, Escape-dismissible sheet/dialog transition.
- `CinematicButton` and `CinematicLink`: shared visual state, tactile press, and focus treatment.
- `useReducedMotionPreference`: the canonical motion preference hook.
- `useEffectTier`: optional capability-based progressive enhancement.

## Page behavior

### Home

The heading, description, and actions enter as a short editorial sequence. The two hero photographs develop independently. High-tier desktop pointers add a maximum ten-pixel spring depth shift to the whole stack; touch, low-tier, and reduced-motion sessions remain static. Feature cards retain restrained lift while their Lucide icons respond according to the room they represent.

### Story

The timeline accent line is bound to page scroll progress with a damped spring. Milestones reveal once, and photographs use the shared develop treatment. Future nodes remain outlined with a quiet halo. Reduced motion shows the completed line immediately.

### Memories

The static archive keeps lazy image decoding and controlled video playback. Living-memory cards retain bounded lift and the focus-safe lightbox. “Take Me Back” chooses only from the memories already loaded in the browser, shows one short time-shift title/date scene, then opens that memory. It does not refetch or cycle through hidden data.

### Movies

Poster cards have subtle perspective depth and border emphasis while preserving keyboard activation and TMDB image fallbacks. Catalogue, modal, random-result, and trailer behavior remains request-driven. The random result crossfades only after the Worker-backed request resolves; no API request is made per animation frame.

### Games

The picker retains a short, bounded wait followed by a physical paper-card replacement. It remains intentionally playful rather than slot-machine-like. Saved winner/history feedback stays textual and attributed to the two live profile names.

### Soundtrack

The existing sleeve/vinyl spring reveal remains bounded to hover. CSS adds equivalent focus-within and active/tap feedback. Our Song retains the larger cinematic turntable composition without autoplaying or storing audio.

### Activities and Bucket List

Both random choices retain result-card continuity and visible working states. Status, plan, completion, and linked-Memory mutations remain server-first; the UI only transitions to the accepted state after the request succeeds. No confetti or continuous particle system is used.

### Letters

Envelope cards are built from CSS layers and respond gently on hover or focus. Sealing first persists the draft and waits for the Worker seal response; only then does the wax-seal sequence run. Opening first waits for the authorized Worker response; only then does the flap open and the viewer appear. Reduced motion skips both sequences and uses the authorized result immediately. Locked content is never preloaded by the visual layer.

## Reduced motion and accessibility

- Framer components use the shared reduced-motion hook to omit displacement, spring depth, and staged delays where appropriate.
- The global `prefers-reduced-motion: reduce` block reduces every CSS animation and transition to one near-instant iteration, disables smooth scroll, removes the photographic veil, and keeps all content visible.
- Hover effects have keyboard focus equivalents. Primary actions never depend on hover.
- Existing focus traps, focus restoration, route focus management, skip link, semantic buttons, live regions, and 44-pixel minimum touch targets remain intact.
- Decorative atmosphere is `aria-hidden` or CSS-only and never intercepts input.

## Performance rules

- Animate transform and opacity wherever practical; do not animate layout dimensions in loops.
- Keep entrance stagger between 30 and 50 ms and cap visible sequences.
- Lazy-load route modules and below-fold media.
- Do not create scroll listeners for timeline drawing; Framer Motion values update outside React renders.
- Do not decode or autoplay archive videos before the user opens them.
- Avoid persistent `requestAnimationFrame` loops, WebGL contexts, and decorative timers.
- Clean up media-query listeners and transition timers on unmount.

## Deliberate rejections

- No global smooth scrolling or scroll hijacking: native scrolling is more predictable and accessible.
- No custom cursor: the archive must remain usable on touch and assistive technology.
- No Three.js/R3F or Zdog scene: CSS perspective gives the needed depth without a new rendering runtime.
- No GSAP/ScrollTrigger: Framer Motion already covers the single progressive timeline and state sequences.
- No autoplay audio, generated soundtrack, or stored copyrighted media.
- No large confetti/particle effects: celebrations remain warm and brief.
- No animation that masks a pending write, changes business state early, or exposes Future Letter content.
