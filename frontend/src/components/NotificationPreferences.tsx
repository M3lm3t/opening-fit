import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

type NotificationPreferencesProps = {
  userId?: string | null;
};

type Preferences = {
  streak_reminders: boolean;
  weekly_report_reminders: boolean;
  achievement_notifications: boolean;
  email_notifications: boolean;
};

const DEFAULT_PREFERENCES: Preferences = {
  streak_reminders: true,
  weekly_report_reminders: true,
  achievement_notifications: true,
  email_notifications: false,
};

const PREFERENCE_OPTIONS: Array<{
  key: keyof Preferences;
  title: string;
  description: string;
}> = [
  {
    key: "streak_reminders",
    title: "Streak reminders",
    description: "Prepare reminder jobs to nudge you before your streak is at risk.",
  },
  {
    key: "weekly_report_reminders",
    title: "Weekly report reminders",
    description: "Prepare reminder jobs for weekly progress reports.",
  },
  {
    key: "achievement_notifications",
    title: "Achievement notifications",
    description: "Show unlock notifications when new badges are earned.",
  },
  {
    key: "email_notifications",
    title: "Email notifications",
    description: "Store opt-in for future email reminders. No emails are sent yet.",
  },
];

function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("openingfit-toast", { detail: message }));
}

export default function NotificationPreferences({ userId }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(Boolean(userId));
  const [savingKey, setSavingKey] = useState<keyof Preferences | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPreferences() {
      if (!isSupabaseConfigured || !supabase || !userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { data, error: fetchError } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!mounted) return;

        if (data) {
          setPreferences({
            streak_reminders: Boolean(data.streak_reminders),
            weekly_report_reminders: Boolean(data.weekly_report_reminders),
            achievement_notifications: Boolean(data.achievement_notifications),
            email_notifications: Boolean(data.email_notifications),
          });
          return;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("notification_preferences")
          .upsert(
            {
              user_id: userId,
              ...DEFAULT_PREFERENCES,
            },
            { onConflict: "user_id" }
          )
          .select("*")
          .single();

        if (insertError) throw insertError;

        if (mounted && inserted) {
          setPreferences({
            streak_reminders: Boolean(inserted.streak_reminders),
            weekly_report_reminders: Boolean(inserted.weekly_report_reminders),
            achievement_notifications: Boolean(inserted.achievement_notifications),
            email_notifications: Boolean(inserted.email_notifications),
          });
        }
      } catch (preferenceError) {
        console.error("OpeningFit Supabase query failed", {
          table: "notification_preferences",
          operation: "load/upsert notification preferences",
          details: { userId },
          error: preferenceError,
        });
        if (mounted) {
          setError("Could not load notification preferences.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPreferences();

    return () => {
      mounted = false;
    };
  }, [userId]);

  async function updatePreference(key: keyof Preferences) {
    if (!isSupabaseConfigured || !supabase || !userId) return;

    const nextValue = !preferences[key];
    const nextPreferences = {
      ...preferences,
      [key]: nextValue,
    };

    setPreferences(nextPreferences);
    setSavingKey(key);
    setError("");

    try {
      const { error: saveError } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: userId,
            ...nextPreferences,
          },
          { onConflict: "user_id" }
        );

      if (saveError) throw saveError;
      toast("Notification preferences saved.");
    } catch (preferenceError) {
      console.error("OpeningFit Supabase query failed", {
        table: "notification_preferences",
        operation: "save notification preferences",
        details: { userId, key },
        error: preferenceError,
      });
      setPreferences(preferences);
      setError("Could not save notification preferences.");
    } finally {
      setSavingKey("");
    }
  }

  if (!userId) return null;

  return (
    <section className="notificationPreferences" aria-label="Notification preferences">
      <div className="todayPanelTop">
        <div>
          <span>Reminder preferences</span>
          <strong>Notification-ready settings</strong>
        </div>
        <Bell size={20} />
      </div>

      <div className="notificationPreferenceList">
        {PREFERENCE_OPTIONS.map((option) => (
          <label className="notificationPreferenceToggle" key={option.key}>
            <input
              type="checkbox"
              checked={preferences[option.key]}
              disabled={loading || savingKey === option.key}
              onChange={() => updatePreference(option.key)}
            />
            <span className="notificationSwitch" aria-hidden="true" />
            <span>
              <strong>{option.title}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>

      <p className="notificationPreferenceNote">
        These settings only store reminder preferences for future jobs. OpeningFit is not sending emails yet.
      </p>

      {error ? <p className="notificationPreferenceError">{error}</p> : null}
    </section>
  );
}
