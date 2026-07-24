import { LockKeyhole } from "lucide-react";
import { featurePreview } from "../lib/premiumEntitlement.js";
import "./FeatureAccessPreview.css";

export default function FeatureAccessPreview({ feature, eyebrow = "OpeningFit paid", title, children, onUpgrade }) {
  return (
    <section className="featureAccessPreview" aria-label={`${title} preview`}>
      <div className="featureAccessPreview__icon" aria-hidden="true"><LockKeyhole size={20} /></div>
      <div className="featureAccessPreview__copy">
        <span>{eyebrow}</span><h2>{title}</h2><p>{featurePreview(feature)}</p>{children}
      </div>
      {onUpgrade ? <button type="button" className="primaryBtn" onClick={onUpgrade} aria-label={`See OpeningFit Plus options for ${title}`}>See OpeningFit Plus options</button> : null}
    </section>
  );
}
