"use client";

import { useMemo, useState, useTransition } from "react";
import { setCoffeeStatus } from "@/app/actions";
import {
  nextStatuses,
  openedDays,
  restingDays,
  STATUS_LABEL,
  transitionLabel,
  type BeanStatus,
} from "@/lib/status";

type Props = {
  id: number;
  status: BeanStatus;
  roastDate: string | null;
  openedAt: string | null;
  emptiedAt: string | null;
  frozenAt: string | null;
  frozenDays: number;
};


export default function StatusToggle({
  id,
  status,
  roastDate,
  openedAt,
  emptiedAt,
  frozenAt,
  frozenDays,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const resting = useMemo(
    () => restingDays({ roastDate, status, frozenAt, frozenDays, emptiedAt, openedAt }),
    [roastDate, status, frozenAt, frozenDays, emptiedAt, openedAt],
  );
  const opened = useMemo(
    () => (openedAt ? openedDays({ openedAt, emptiedAt }) : null),
    [openedAt, emptiedAt],
  );

  function transitionTo(next: BeanStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await setCoffeeStatus(id, next);
      } catch {
        setError("Could not save status. Is the server reachable?");
      }
    });
  }

  return (
    <div className="status-toggle">
      <div className="status-toggle-head">
        <span className="status-dot" data-status={status} aria-hidden="true" />
        <span className="status-title">{STATUS_LABEL[status]}</span>
        {status === "frozen" ? <span className="status-note">— ageing paused</span> : null}
        {status === "empty" ? <span className="status-note">— resting age locked in</span> : null}
      </div>

      {resting !== null ? (
        <div className="status-meta">
          <span>
            Resting{" "}
            <strong>
              {resting} {resting === 1 ? "day" : "days"}
            </strong>
          </span>
          {opened !== null ? (
            <>
              {" · "}
              <span>
                Opened <strong>{opened}</strong> {opened === 1 ? "day" : "days"} ago
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="status-actions">
        {nextStatuses(status).map((to) => {
          const { label, title } = transitionLabel(status, to);
          return (
            <button
              key={to}
              type="button"
              className="btn btn-small secondary"
              disabled={isPending}
              title={title}
              onClick={() => transitionTo(to)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="status-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
