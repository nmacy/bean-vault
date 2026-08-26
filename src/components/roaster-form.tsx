"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Roaster } from "@/db/schema";
import type { RoasterFormState } from "@/app/actions";

type Props = {
  action: (prev: RoasterFormState, formData: FormData) => Promise<RoasterFormState>;
  roaster?: Roaster;
  submitLabel: string;
};

export default function RoasterForm({ action, roaster, submitLabel }: Props) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [removeLogo, setRemoveLogo] = useState(false);
  const logoHref = roaster?.logoFile ? `/api/photos/${roaster.logoFile}` : null;

  return (
    <div className="form-card">
      {state.message ? <div className="form-error">{state.message}</div> : null}
      <form action={formAction}>
        {removeLogo ? <input type="hidden" name="removePhoto" value="on" /> : null}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="roasterName">Name *</label>
            <input id="roasterName" name="roasterName" required defaultValue={roaster?.name ?? ""} placeholder="e.g. Onyx Coffee Lab" maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="roasterWebsite">Website</label>
            <input id="roasterWebsite" name="roasterWebsite" type="url" defaultValue={roaster?.website ?? ""} placeholder="https://…" maxLength={500} />
          </div>
          <div className="field">
            <label htmlFor="roasterCity">City</label>
            <input id="roasterCity" name="roasterCity" defaultValue={roaster?.city ?? ""} placeholder="e.g. Springdale" maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="roasterState">State</label>
            <input id="roasterState" name="roasterState" defaultValue={roaster?.state ?? ""} placeholder="e.g. Arkansas" maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="roasterCountry">Country</label>
            <input id="roasterCountry" name="roasterCountry" defaultValue={roaster?.country ?? ""} placeholder="e.g. United States" maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="roasterFoundedYear">Founded</label>
            <input id="roasterFoundedYear" name="roasterFoundedYear" type="text" inputMode="numeric" defaultValue={roaster?.foundedYear ?? ""} placeholder="e.g. 2012" maxLength={4} />
          </div>
          <div className="field">
            <label htmlFor="roasterSpecialty">Specialty</label>
            <input id="roasterSpecialty" name="roasterSpecialty" defaultValue={roaster?.specialty ?? ""} placeholder="e.g. single-origin light roasts" maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="photo">Logo <span className="hint">(JPG, PNG, WebP, AVIF, GIF; max 10 MB)</span></label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              onChange={() => setRemoveLogo(false)}
            />
          </div>
          {logoHref ? (
            <div className="field wide">
              <span className="hint">Current logo:</span>
              <div className="current-photo">
                {removeLogo ? (
                  <span className="current-photo-removed">Logo will be removed.</span>
                ) : (
                  <img src={logoHref} alt="Current logo" style={{ maxHeight: 120, objectFit: "contain" }} />
                )}
                <label className="check-line">
                  <input
                    type="checkbox"
                    name="removePhoto"
                    value="on"
                    checked={removeLogo}
                    onChange={(e) => setRemoveLogo(e.target.checked)}
                  />
                  Remove logo
                </label>
              </div>
            </div>
          ) : null}
          <div className="field wide">
            <label htmlFor="roasterDescription">Blurb</label>
            <textarea id="roasterDescription" name="roasterDescription" defaultValue={roaster?.description ?? ""} placeholder="A short description of this roaster…" />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn" disabled={isPending}>
            {isPending ? "Saving…" : submitLabel}
          </button>
          <Link href={roaster ? `/roasters/${roaster.id}` : "/roasters"} className="btn secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
