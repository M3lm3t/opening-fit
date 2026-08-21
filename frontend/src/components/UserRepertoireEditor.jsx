import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthDataProvider.jsx";
import {
  applyRepertoirePreferences,
  getUserRepertoirePreferences,
  REPERTOIRE_PREFERENCES,
  setUserRepertoirePreference,
} from "../services/repertoirePreferenceService.js";
import "./UserRepertoireEditor.css";

const ROLE_LABELS = { white: "White", black_vs_e4: "Black vs 1.e4", black_vs_d4: "Black vs 1.d4" };
const STATUS_LABELS = {
  MAIN_REPERTOIRE: "Main",
  ESTABLISHED: "Established",
  DORMANT: "Dormant",
  CURRENT: "Current",
  EXPERIMENT: "Experimenting",
  INSUFFICIENT_EVIDENCE: "Not enough evidence",
  IGNORED: "Ignored",
};

function RepertoireChoice({ opening, busy, onChange }) {
  const controlId = `repertoire-choice-${opening.repertoireRole}-${opening.canonicalOpeningId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  return (
    <li>
      <div>
        <strong>{opening.opening}</strong>
        <span>{STATUS_LABELS[opening.effectiveClassification] || opening.effectiveClassification}</span>
      </div>
      <label htmlFor={controlId}>Status<span className="srOnly"> for {opening.opening}</span></label>
      <select id={controlId} value={opening.userPreference} disabled={busy} onChange={(event) => onChange(opening, event.target.value)}>
        <option value={REPERTOIRE_PREFERENCES.AUTOMATIC}>Automatic</option>
        <option value={REPERTOIRE_PREFERENCES.MAIN}>Set as main</option>
        <option value={REPERTOIRE_PREFERENCES.EXPERIMENTING}>Mark as experiment</option>
        <option value={REPERTOIRE_PREFERENCES.IGNORE}>Ignore</option>
      </select>
    </li>
  );
}

export default function UserRepertoireEditor({ repertoireHistory }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState([]);
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("");
  const [available, setAvailable] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setPreferences([]); setAvailable(false); return; }
    try {
      setPreferences(await getUserRepertoirePreferences(user.id));
      setAvailable(true);
      setMessage("");
    } catch (error) {
      setAvailable(false);
      setMessage(error.message || "Could not load your repertoire choices.");
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);
  const openings = useMemo(() => applyRepertoirePreferences(repertoireHistory, preferences), [preferences, repertoireHistory]);
  const sections = useMemo(() => {
    const experiments = openings.filter((row) => row.effectiveClassification === "EXPERIMENT");
    const standard = Object.entries(ROLE_LABELS).map(([role, label]) => ({
      key: role, label, openings: openings.filter((row) => row.repertoireRole === role && row.effectiveClassification !== "EXPERIMENT"),
    })).filter((section) => section.openings.length);
    return experiments.length ? [...standard, { key: "experiments", label: "Recent experiments", openings: experiments }] : standard;
  }, [openings]);

  const save = async (opening, preference) => {
    const key = `${opening.repertoireRole}:${opening.canonicalOpeningId}`;
    setBusyKey(key); setMessage("");
    try {
      await setUserRepertoirePreference({
        userId: user.id,
        repertoireRole: opening.repertoireRole,
        canonicalOpeningId: opening.canonicalOpeningId,
        preference,
      });
      await load();
      setMessage(`${opening.opening} updated. Historical game evidence is unchanged.`);
    } catch (error) {
      setMessage(error.message || "Could not save that choice.");
    } finally {
      setBusyKey("");
    }
  };

  if (!user?.id || !available || !openings.length) return null;
  return (
    <section className="userRepertoireEditor" aria-labelledby="user-repertoire-title">
      <header>
        <div><span>Your repertoire</span><h2 id="user-repertoire-title">Confirm your openings</h2></div>
        <small>Choices change labels, never game evidence.</small>
      </header>
      <div className="userRepertoireSections">
        {sections.map((section) => (
          <section key={section.key} aria-labelledby={`user-repertoire-${section.key}`}>
            <h3 id={`user-repertoire-${section.key}`}>{section.label}</h3>
            <ul>{section.openings.map((opening) => <RepertoireChoice key={`${opening.repertoireRole}:${opening.canonicalOpeningId}`} opening={opening} busy={busyKey === `${opening.repertoireRole}:${opening.canonicalOpeningId}`} onChange={save} />)}</ul>
          </section>
        ))}
      </div>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
