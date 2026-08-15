"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findCoffeePhoto } from "@/app/actions";

export default function FindPhotoButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const res = await findCoffeePhoto(id);
          setBusy(false);
          if (res.ok) {
            router.refresh();
          } else {
            setMessage(res.message);
          }
        }}
      >
        {busy ? "Searching…" : "Find a photo"}
      </button>
      {message ? <span className="form-error" style={{ margin: 0 }}>{message}</span> : null}
    </>
  );
}