/** Page activity shared between the video player and the background shader. */
export const activity = { videos: 0, scrolling: false };

const listeners: (() => void)[] = [];
export const onActivity = (fn: () => void) => listeners.push(fn);

export function setActivity(next: Partial<typeof activity>) {
  if (Object.entries(next).every(([k, v]) => activity[k as keyof typeof activity] === v)) return;
  Object.assign(activity, next);
  for (const fn of listeners) fn();
}

let settle = 0;
addEventListener(
  "scroll",
  () => {
    setActivity({ scrolling: true });
    clearTimeout(settle);
    settle = window.setTimeout(() => setActivity({ scrolling: false }), 150);
  },
  { passive: true },
);
