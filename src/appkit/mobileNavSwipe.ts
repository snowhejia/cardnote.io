import { MOBILE_NAV_SWIPE_AXIS_RATIO } from "./appConstants";

export function mobileNavSwipeMostlyHorizontal(dx: number, dy: number): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return ax > ay * MOBILE_NAV_SWIPE_AXIS_RATIO;
}

export function mobileNavSwipeTargetIsTextual(target: EventTarget | null): boolean {
  const el =
    target instanceof Element
      ? target.closest(
          'input, textarea, select, [contenteditable="true"], .ProseMirror, [role="textbox"]'
        )
      : null;
  return Boolean(el);
}
