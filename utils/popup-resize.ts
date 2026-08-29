/**
 * Chrome sizes the toolbar popup panel to its content, and re-measures it on
 * every DOM change. Mounting a Radix portal (popper wrapper, focus guards, the
 * RemoveScroll style tag) triggers such a re-measure, and Chrome then fires a
 * `resize` event even though the viewport is exactly the same size.
 *
 * Radix Select closes an open menu on `resize`, so in the popup every dropdown
 * slammed shut the instant its portal mounted — while the same code worked in
 * the standalone window, which is not auto-sized. Dropping the no-op events
 * before any library listener sees them keeps the menus open; a real resize
 * still gets through and still closes them.
 */
export function dropNoopResizeEvents(): void {
  let width = window.innerWidth;
  let height = window.innerHeight;
  // Zooming keeps the CSS pixel size but changes the ratio, and counts as a
  // real resize: an open menu should close, as it does everywhere else.
  let ratio = window.devicePixelRatio;

  window.addEventListener(
    'resize',
    (event) => {
      if (
        window.innerWidth === width &&
        window.innerHeight === height &&
        window.devicePixelRatio === ratio
      ) {
        // Capture phase runs before the bubble-phase listeners libraries use,
        // so this stops the event before Radix reacts to it.
        event.stopImmediatePropagation();
        return;
      }
      width = window.innerWidth;
      height = window.innerHeight;
      ratio = window.devicePixelRatio;
    },
    true,
  );
}
