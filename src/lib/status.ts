/**
 * Coffee-bag lifecycle state machine.
 *
 * A bag moves through at most four states; resting is the default:
 *
 *     ┌─────────┐  freeze   ┌────────┐
 *     │ resting │ ─────────▶ │ frozen │
 *     └────┬────┘ ◀───────── └───┬────┘
 *          │    unfreeze         │
 *     open │                open│   empty
 *          ▼                     ▼     │
 *       ┌────────┐   empty    ┌──────┐ │
 *       │ opened │ ─────────▶ │ empty│◀┘
 *       └────────┘            └──────┘
 *     (re-freezable)            ─
 *        freeze                 ▲
 *     ─────────────────────────┘
 *
 * Transitions are intentionally small: no "pending" corrections mid-bag —
 * reach a state through its predecessor, and undo a mistaken "empty" through
 * empty → resting.
 */

/** Current lifecycle state of a bag. */
export type BeanStatus = "resting" | "frozen" | "opened" | "empty";

/** All possible states, in display order. */
export const ALL_STATUSES: readonly BeanStatus[] = ["resting", "frozen", "opened", "empty"];

const TRANSITIONS: Record<BeanStatus, readonly BeanStatus[]> = {
  resting: ["frozen", "opened"],
  frozen: ["resting", "empty"],
  opened: ["frozen", "empty"],
  // "empty" is terminal; anything that reopens the bag comes back to resting.
  empty: ["resting"],
};

/** Whether `to` is a legal transition from `from` (identity is always legal). */
export function canTransition(from: BeanStatus, to: BeanStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

const isBeanStatus = (v: unknown): v is BeanStatus =>
  typeof v === "string" && (ALL_STATUSES as readonly string[]).includes(v);

/** Width-safe cast from unknown DB/API value; falls back to `resting`. */
export function toBeanStatus(v: unknown): BeanStatus {
  return isBeanStatus(v) ? v : "resting";
}

/** Current local date as YYYY-MM-DD (system, not UTC, so "today" is right everywhere). */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole days from `a` to `b` (b − a), both YYYY-MM-DD. */
export function dayDiff(a: string, b: string): number {
  const ta = new Date(`${a}T12:00:00Z`).getTime();
  const tb = new Date(`${b}T12:00:00Z`).getTime();
  return Math.round((tb - ta) / 86_400_000);
}

/** Everything the date math needs off a bag; subset of the coffees row. */
export type BagDates = {
  roastDate: string | null;
  status: BeanStatus;
  openedAt: string | null;
  emptiedAt: string | null;
  frozenAt: string | null;
  unfrozenAt: string | null;
  /** Injectable for tests. Defaults to today. */
  today?: string;
};

/**
 * Days spent frozen, assuming a bag is only ever frozen once. There's no
 * running "cumulative frozen days" counter to keep in sync — the span comes
 * straight from frozenAt/unfrozenAt (or frozenAt→today while still frozen).
 * A re-freeze after an unfreeze would overwrite frozenAt/unfrozenAt and lose
 * the earlier span; deliberately out of scope under that assumption.
 */
function frozenSpanDays({
  status,
  frozenAt,
  unfrozenAt,
  today,
}: Pick<BagDates, "status" | "frozenAt" | "unfrozenAt"> & { today: string }): number {
  if (!frozenAt) return 0;
  if (unfrozenAt) return Math.max(0, dayDiff(frozenAt, unfrozenAt));
  if (status === "frozen") return Math.max(0, dayDiff(frozenAt, today));
  return 0;
}

/**
 * Days the bag has been resting — i.e. since roast, minus any time frozen.
 * Stops accumulating once `emptiedAt` is set; `today` only for tests.
 * Returns null when there is no roast date.
 */
export function restingDays({
  roastDate,
  status,
  frozenAt,
  unfrozenAt,
  emptiedAt,
  today = todayStr(),
}: BagDates): number | null {
  if (!roastDate) return null;
  const end = emptiedAt ?? today;
  const total = dayDiff(roastDate, end);
  if (total <= 0) return 0;
  return Math.max(0, total - frozenSpanDays({ status, frozenAt, unfrozenAt, today: end }));
}

/**
 * Days since the bag was opened. Stops accumulating once emptied.
 * Null when never opened.
 */
export function openedDays({
  openedAt,
  emptiedAt,
  today = todayStr(),
}: Pick<BagDates, "openedAt" | "emptiedAt" | "today">): number | null {
  if (!openedAt) return null;
  const end = emptiedAt ?? today;
  return Math.max(0, dayDiff(openedAt, end));
}

/** Stable human label for a status. */
export const STATUS_LABEL: Record<BeanStatus, string> = {
  resting: "Resting",
  frozen: "Frozen",
  opened: "Opened",
  empty: "Empty",
};
type LifecycleDates = {
  openedAt?: string | null;
  emptiedAt?: string | null;
  frozenAt?: string | null;
  unfrozenAt?: string | null;
};

/**
 * Derive status from lifecycle dates. Precedence (empty wins, then an
 * in-progress freeze, then opened), so a bag that was opened then frozen
 * reports "frozen" until unfrozen.
 *
 * - `emptiedAt` set → "empty"
 * - `frozenAt` set and `unfrozenAt` unset → "frozen"
 * - `openedAt` set → "opened"
 * - otherwise → "resting"
 */
export function deriveStatus(d: LifecycleDates = {}): BeanStatus {
  if (d.emptiedAt) return "empty";
  if (d.frozenAt && !d.unfrozenAt) return "frozen";
  if (d.openedAt) return "opened";
  return "resting";
}

/** Label + title for the transition button that moves a bag to `to` from `from`. */
export function transitionLabel(
  from: BeanStatus,
  to: BeanStatus,
): { label: string; title: string } {
  switch (to) {
    case "resting":
      return from === "frozen"
        ? { label: "Unfreeze", title: "Resume the resting clock" }
        : { label: "Resting", title: "Back to resting" };
    case "frozen":
      return { label: "Freeze", title: "Pause the resting clock" };
    case "opened":
      return { label: "Open", title: "Start tracking open days" };
    case "empty":
      return { label: "Empty", title: "Finished the bag" };
  }
}

/** All legal single-step transitions from `from` (excludes identity). */
export function nextStatuses(from: BeanStatus): BeanStatus[] {
  return ALL_STATUSES.filter((to) => to !== from && canTransition(from, to));
}
