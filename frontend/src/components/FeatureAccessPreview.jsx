import { useEffect } from "react";
import { LockKeyhole } from "lucide-react";
import { featurePreview } from "../lib/premiumEntitlement.js";
import "./FeatureAccessPreview.css";

export default function FeatureAccessPreview({ feature, eyebrow = "OpeningFit paid", title, children, benefits = [], onViewed, onUpgrade, actionClassName = "primaryBtn" }) {
  useEffect(() => { onViewed?.(); }, [onViewed]);
  return (
    <section className="featureAccessPreview" aria-label={`${title} preview`}>
      <div className="featureAccessPreview__icon" aria-hidden="true"><LockKeyhole size={20} /></div>
      <div className="featureAccessPreview__copy">
        <span>{eyebrow}</span><h2>{title}</h2><p>{featurePreview(feature)}</p>{benefits.length ? <ul>{benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul> : null}{children}
      </div>
      {onUpgrade ? <button type="button" className={actionClassName} onClick={onUpgrade} aria-label={`See OpeningFit Plus options for ${title}`}>See OpeningFit Plus options</button> : null}
    </section>
  );
}
