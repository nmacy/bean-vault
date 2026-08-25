"use client";

import { useState } from "react";
import { deleteRoaster } from "@/app/actions";

export default function DeleteRoasterButton({ id, coffeeCount }: { id: number; coffeeCount: number }) {
  const [busy, setBusy] = useState(false);

  if (coffeeCount > 0) {
    return (
      <p className="hint">
        This roaster has {coffeeCount} coffee{coffeeCount === 1 ? "" : "s"} —
        reassign or delete {coffeeCount === 1 ? "it" : "them"} first to delete this roaster.
      </p>
    );
  }

  return (
    <button
      type="button"
      className="btn danger"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Delete this roaster?")) return;
        setBusy(true);
        await deleteRoaster(id);
      }}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
