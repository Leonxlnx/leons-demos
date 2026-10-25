/*
 * Smooth wheel scrolling (Lenis) wherever there is a mouse or trackpad: the wheel's steps become
 * one glide, so the pinned intro and everything tied to the scroll move without stutter. Touch
 * keeps the browser's own scrolling, and reduced motion keeps plain scrolling. The page still
 * scrolls natively underneath, so scroll events, sticky parts and in-page links work as before.
 */
import Lenis from "lenis";
import "lenis/dist/lenis.css";

if (matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) {
  new Lenis({ autoRaf: true, lerp: 0.11, anchors: true });
}
