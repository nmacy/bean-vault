"use client";

import { useState } from "react";
import { deleteCoffee } from "@/app/actions";

export default function DeleteButton({ id }: { id: number }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="btn danger"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Delete this coffee and its photo?")) return;
        setBusy(true);
        await deleteCoffee(id);
      }}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}