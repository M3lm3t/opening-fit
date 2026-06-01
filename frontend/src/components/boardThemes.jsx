import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthDataProvider";

export const BOARD_THEMES = {
  classic: {
    label: "Classic",
    light: "#F0D9B5",
    dark: "#B58863",
  },
  lichess: {
    label: "Green",
    statusLabel: "Green High Contrast",
    light: "#EEEED2",
    dark: "#769656",
  },
  highContrast: {
    label: "High Contrast",
    light: "#F7F7F7",
    dark: "#4A5568",
  },
};

export const BOARD_THEME_OPTIONS = [
  { key: "classic", label: "Classic" },
  { key: "lichess", label: "Green" },
  { key: "highContrast", label: "High Contrast" },
];

const STORAGE_KEY = "openingFit:boardTheme";
const DEFAULT_BOARD_THEME = "lichess";

function normaliseBoardTheme(value) {
  if (value === "green") return "lichess";
  return BOARD_THEMES[value] ? value : DEFAULT_BOARD_THEME;
}

function readLocalBoardTheme() {
  try {
    return normaliseBoardTheme(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_BOARD_THEME;
  }
}

function writeLocalBoardTheme(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Board theme should never block chess practice if storage is unavailable.
  }
}

export function getBoardThemeVariables(themeKey) {
  const theme = BOARD_THEMES[normaliseBoardTheme(themeKey)];

  return {
    "--board-light-square": theme.light,
    "--board-dark-square": theme.dark,
    "--board-border": "rgba(15, 23, 42, 0.32)",
    "--board-selected": "rgba(59, 130, 246, 0.45)",
    "--board-invalid": "rgba(239, 68, 68, 0.48)",
    "--board-last-move": "rgba(255, 221, 87, 0.50)",
    "--board-legal-move": "rgba(34, 197, 94, 0.35)",
  };
}

export function useBoardTheme() {
  const { settings, saveSettings, user } = useAuth();
  const savedTheme = settings?.preferences?.boardTheme || settings?.preferences?.board_theme;
  const [boardTheme, setBoardThemeState] = useState(() => readLocalBoardTheme());

  useEffect(() => {
    if (!savedTheme) return;

    const nextTheme = normaliseBoardTheme(savedTheme);
    setBoardThemeState(nextTheme);
    writeLocalBoardTheme(nextTheme);
  }, [savedTheme]);

  const setBoardTheme = useCallback(
    async (nextTheme) => {
      const theme = normaliseBoardTheme(nextTheme);
      setBoardThemeState(theme);
      writeLocalBoardTheme(theme);

      if (user?.id && saveSettings) {
        try {
          await saveSettings({
            preferences: {
              ...(settings?.preferences || {}),
              boardTheme: theme,
            },
          });
        } catch (error) {
          console.warn("Could not save board theme preference", error);
        }
      }
    },
    [saveSettings, settings, user?.id]
  );

  const boardThemeVars = useMemo(() => getBoardThemeVariables(boardTheme), [boardTheme]);

  return {
    boardTheme,
    setBoardTheme,
    boardThemeVars,
    boardThemeLabel: BOARD_THEMES[boardTheme]?.label || BOARD_THEMES[DEFAULT_BOARD_THEME].label,
  };
}

export function BoardThemeStatusLabel({ boardTheme }) {
  const theme = normaliseBoardTheme(boardTheme);

  return (
    <span className="boardThemeDebugLabel">
      Board theme:{" "}
      {BOARD_THEMES[theme]?.statusLabel ||
        BOARD_THEMES[theme]?.label ||
        BOARD_THEMES[DEFAULT_BOARD_THEME].label}
    </span>
  );
}

export function BoardThemeToggle({ boardTheme, onChange }) {
  return (
    <div className="boardThemeToggle" aria-label="Chess board theme">
      {BOARD_THEME_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          className={boardTheme === option.key ? "boardThemeToggleActive" : ""}
          onClick={() => onChange?.(option.key)}
          aria-pressed={boardTheme === option.key}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
