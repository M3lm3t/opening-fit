import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "../context/AuthDataProvider.jsx";
import { trackProductEvent } from "../lib/productAnalytics.js";
import {
  PLAY_FREQUENCIES,
  TRAINING_GOALS,
  WEEKLY_TRAINING_TIMES,
  hasCompleteTrainingPreferences,
  normaliseTrainingPreferences,
  readLocalTrainingPreferences,
  resolveTrainingPreferences,
  shouldStartPostReportOnboarding,
  writeLocalTrainingPreferences,
} from "../lib/trainingPreferences.js";
import "./PostReportOnboarding.css";

const STEPS = [
  { key: "mainGoal", title: "What is your main goal?", options: TRAINING_GOALS },
  { key: "playFrequency", title: "How often do you normally play?", options: PLAY_FREQUENCIES },
  { key: "weeklyMinutes", title: "How much training time do you want each week?", options: WEEKLY_TRAINING_TIMES.map((value) => ({ value, label: `${value} minutes` })) },
];

export const TRAINING_PREFERENCES_EDIT_EVENT = "openingfit:edit-training-preferences";
export const TRAINING_PREFERENCES_UPDATED_EVENT = "openingfit:training-preferences-updated";

export default function PostReportOnboarding({ firstReport = false, reportVisible = false }) {
  const { user, settings, saveSettings, profileLoading, hydrated } = useAuth();
  const authenticated = Boolean(user?.id);
  const stored = useMemo(() => resolveTrainingPreferences({
    authenticated,
    settings,
    localPreferences: readLocalTrainingPreferences(),
  }), [authenticated, settings]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("first_report");

  useEffect(() => { setValues(stored); }, [stored]);

  useEffect(() => {
    if (!shouldStartPostReportOnboarding({ firstReport, reportVisible, hydrated, authenticated, profileLoading, preferences: stored })) return;
    setSource("first_report");
    setOpen(true);
    void trackProductEvent("onboarding_started", { authenticated, source: "first_report" }, { onceKey: user?.id || "anonymous-first-report" });
  }, [authenticated, firstReport, hydrated, profileLoading, reportVisible, stored, user?.id]);

  useEffect(() => {
    const edit = () => {
      setValues(stored);
      setStep(0);
      setError("");
      setSource("settings");
      setOpen(true);
      void trackProductEvent("onboarding_started", { authenticated, source: "settings" });
    };
    window.addEventListener(TRAINING_PREFERENCES_EDIT_EVENT, edit);
    return () => window.removeEventListener(TRAINING_PREFERENCES_EDIT_EVENT, edit);
  }, [authenticated, stored]);

  const persist = async (next) => {
    const value = normaliseTrainingPreferences(next);
    if (authenticated) await saveSettings({ preferences: { trainingPreferences: value } });
    else writeLocalTrainingPreferences(value);
    window.dispatchEvent(new CustomEvent(TRAINING_PREFERENCES_UPDATED_EVENT, { detail: value }));
    return value;
  };

  const skip = async () => {
    setSaving(true);
    setError("");
    try {
      await persist({ ...values, status: "skipped", updatedAt: new Date().toISOString() });
      setOpen(false);
      void trackProductEvent("onboarding_skipped", { authenticated, source });
    } catch (saveError) {
      setError(saveError?.message || "Your choice could not be saved. You can close this and edit it later.");
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    const completed = { ...values, status: "completed", updatedAt: new Date().toISOString() };
    if (!hasCompleteTrainingPreferences(completed)) return;
    setSaving(true);
    setError("");
    try {
      await persist(completed);
      setOpen(false);
      void trackProductEvent("onboarding_completed", { authenticated, source, resultCategory: "completed" });
      void trackProductEvent("training_preference_updated", { authenticated, source, resultCategory: "saved" });
    } catch (saveError) {
      setError(saveError?.message || "Your preferences could not be saved yet.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  const current = STEPS[step];
  const selected = values[current.key];

  return (
    <aside className="postReportOnboarding" role="dialog" aria-modal="false" aria-labelledby="post-report-onboarding-title">
      <header>
        <div><span>Personalise your next week</span><strong id="post-report-onboarding-title">Three quick choices</strong></div>
        <button type="button" aria-label="Close and skip for now" onClick={skip} disabled={saving}><X size={18} /></button>
      </header>
      <div className="postReportOnboardingProgress">
        <span>Step {step + 1} of {STEPS.length}</span>
        <div role="progressbar" aria-valuemin="1" aria-valuemax={STEPS.length} aria-valuenow={step + 1}><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      </div>
      <fieldset>
        <legend>{current.title}</legend>
        <div className="postReportOnboardingOptions">
          {current.options.map((option) => (
            <button key={option.value} type="button" className={selected === option.value ? "is-selected" : ""} onClick={() => setValues((value) => ({ ...value, [current.key]: option.value }))}>
              <span>{option.label}</span>{selected === option.value ? <Check size={17} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </fieldset>
      {error ? <p className="postReportOnboardingError" role="alert">{error}</p> : null}
      <footer>
        <button type="button" className="postReportSkip" onClick={skip} disabled={saving}>Skip for now</button>
        <div>
          {step > 0 ? <button type="button" className="secondaryButton" onClick={() => setStep((value) => value - 1)} disabled={saving}>Back</button> : null}
          {step < STEPS.length - 1 ? <button type="button" className="primaryBtn" onClick={() => setStep((value) => value + 1)} disabled={!selected || saving}>Next</button> : <button type="button" className="primaryBtn" onClick={finish} disabled={!selected || saving}>{saving ? "Saving…" : "Save preferences"}</button>}
        </div>
      </footer>
      <small>Your report stays available. You can edit these choices later in Preferences.</small>
    </aside>
  );
}
