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
  frozenDays: number;
  /** Injectable for tests. Defaults to today. */
  today?: string;
};

/**
 * `frozenDays` is meant to already include the most recent completed freeze
 * (frozenAt → unfrozenAt) — that's what setCoffeeStatus's fold-on-unfreeze
 * does. But frozenAt/unfrozenAt/frozenDays are also directly editable (the
 * edit form's raw lifecycle fields), which can complete a freeze span
 * without anyone updating frozenDays to match.
 *
 * If this edit is what changed the span (frozenAt or unfrozenAt differs
 * from what's stored) and the submitted frozenDays is otherwise identical
 * to what's stored (so nobody typed a deliberate override), fold the new
 * span in automatically. Otherwise trust the submitted value as-is.
 */
export function reconcileFrozenDays(
  existing: { frozenAt: string | null; unfrozenAt: string | null; frozenDays: number },
  input: { frozenAt: string | null; unfrozenAt: string | null; frozenDays: number },
): number {
  const spanChanged = input.frozenAt !== existing.frozenAt || input.unfrozenAt !== existing.unfrozenAt;
  const frozenDaysUntouched = input.frozenDays === existing.frozenDays;
  if (input.frozenAt && input.unfrozenAt && spanChanged && frozenDaysUntouched) {
    return input.frozenDays + Math.max(0, dayDiff(input.frozenAt, input.unfrozenAt));
  }
  return input.frozenDays;
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
  frozenDays,
  emptiedAt,
  today = todayStr(),
}: BagDates): number | null {
  if (!roastDate) return null;
  const end = emptiedAt ?? today;
  const total = dayDiff(roastDate, end);
  if (total <= 0) return 0;
  const activeFreeze = status === "frozen" && frozenAt ? Math.max(0, dayDiff(frozenAt, end)) : 0;
  return Math.max(0, total - frozenDays - activeFreeze);
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
