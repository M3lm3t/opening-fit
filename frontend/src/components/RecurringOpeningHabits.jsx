import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Target } from "lucide-react";
import { buildRecurringOpeningHabits } from "../services/openingHabits";
import "./RecurringOpeningHabits.css";

const ICONS = {
  "Most costly habit": AlertTriangle,
  "Strongest habit": CheckCircle2,
  "One focus for next games": Target,
};

function toneFor(slot) {
  if (slot === "Most costly habit") return "costly";
  if (slot === "Strongest habit") return "strong";
  return "focus";
}

export default function RecurringOpeningHabits({ data }) {
  const habits = useMemo(() => buildRecurringOpeningHabits(data || {}), [data]);

  return (
    <section className="recurringOpeningHabits" aria-labelledby="recurring-opening-habits-title">
      <div className="recurringOpeningHabitsHeader">
        <p className="eyebrow">Recurring habits</p>
        <h2 id="recurring-opening-habits-title">Your Recurring Opening Habits</h2>
        <p>Practical patterns from repeated opening data in this report.</p>
      </div>

      {!habits.hasHabits ? (
        <div className="recurringOpeningHabitsEmpty">
          <strong>Keep playing to reveal patterns.</strong>
          <span>OpeningFit needs repeated openings, weak-line evidence, or clear consistency data before it can name a useful habit.</span>
        </div>
      ) : (
        <div className="recurringOpeningHabitsGrid">
          {habits.cards.map((card) => {
            const Icon = ICONS[card.slot] || Target;
            return (
              <article className={`recurringOpeningHabitCard recurringOpeningHabitCard--${toneFor(card.slot)}`} key={`${card.slot}-${card.openingKey}`}>
                <div className="recurringOpeningHabitTop">
                  <span aria-hidden="true"><Icon size={18} /></span>
                  <div>
                    <p>{card.slot}</p>
                    <h3>{card.title}</h3>
                  </div>
                </div>
                <strong>{card.category}</strong>
                <p>{card.evidence}</p>
                <small>{card.action}</small>
                <details>
                  <summary>How we found this</summary>
                  <span>{card.howFound}</span>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
