/** Whether the page is scrolling: the /demos video player waits for it to settle before it starts videos. */
export const activity = { scrolling: false };

let settle = 0;
addEventListener(
  "scroll",
  () => {
    activity.scrolling = true;
    clearTimeout(settle);
    settle = window.setTimeout(() => (activity.scrolling = false), 150);
  },
  { passive: true },
);
