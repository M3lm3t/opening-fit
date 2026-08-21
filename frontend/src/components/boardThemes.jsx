import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthDataProvider";

export const BOARD_THEMES = {
  openingFit: {
    label: "OpeningFit",
    statusLabel: "OpeningFit slate",
    light: "var(--of-board-light-square, #dbe7ea)",
    dark: "var(--of-board-dark-square, #3f6472)",
  },
  green: {
    label: "Classic green",
    statusLabel: "Classic green",
    light: "#eeeed2",
    dark: "#779954",
  },
  lichess: {
    label: "Lichess brown",
    statusLabel: "Lichess brown",
    light: "#f0d9b5",
    dark: "#b58863",
  },
  blue: {
    label: "Blue",
    light: "#dee3e6",
    dark: "#7d9db3",
  },
  grey: {
    label: "Grey",
    light: "#d8d9dc",
    dark: "#8d949e",
  },
  highContrast: {
    label: "High Contrast",
    light: "#f7f7f7",
    dark: "#4b5563",
  },
};

export const BOARD_THEME_OPTIONS = [
  { key: "openingFit", label: "OpeningFit" },
  { key: "highContrast", label: "High Contrast" },
];

const STORAGE_KEY = "openingFit:boardTheme";
const BOARD_THEME_EVENT = "openingfit:board-theme-change";
const DEFAULT_BOARD_THEME = "openingFit";

function normaliseBoardTheme(value) {
  if (["classic", "lichessGreen", "green", "lichess", "blue", "grey"].includes(value)) return "openingFit";
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
    "--board-border": "var(--of-board-border, rgba(15, 23, 42, 0.5))",
    "--board-selected": "var(--of-board-selected, rgba(37, 99, 235, 0.62))",
    "--board-invalid": "rgba(239, 68, 68, 0.58)",
    "--board-last-move": "var(--of-board-last-move, rgba(45, 212, 191, 0.34))",
    "--board-legal-move": "var(--of-board-legal-move, rgba(13, 148, 136, 0.42))",
  };
}

export function useBoardTheme() {
  const { settings, saveSettings, user } = useAuth();
  const savedTheme = settings?.preferences?.boardTheme || settings?.preferences?.board_theme;
  const [boardTheme, setBoardThemeState] = useState(() => readLocalBoardTheme());
  const persistTimerRef = useRef(null);

  useEffect(() => {
    if (!savedTheme) return;

    const nextTheme = normaliseBoardTheme(savedTheme);
    setBoardThemeState(nextTheme);
    writeLocalBoardTheme(nextTheme);
  }, [savedTheme]);

  useEffect(() => {
    const syncBoardTheme = (event) => {
      const nextTheme = normaliseBoardTheme(event?.detail?.boardTheme);
      setBoardThemeState(nextTheme);
      writeLocalBoardTheme(nextTheme);
    };

    window.addEventListener(BOARD_THEME_EVENT, syncBoardTheme);

    return () => {
      window.removeEventListener(BOARD_THEME_EVENT, syncBoardTheme);
      window.clearTimeout(persistTimerRef.current);
    };
  }, []);

  const setBoardTheme = useCallback(
    (nextTheme) => {
      const theme = normaliseBoardTheme(nextTheme);
      setBoardThemeState(theme);
      writeLocalBoardTheme(theme);
      window.dispatchEvent(new CustomEvent(BOARD_THEME_EVENT, { detail: { boardTheme: theme } }));

      window.clearTimeout(persistTimerRef.current);
      if (!user?.id || !saveSettings) return;

      persistTimerRef.current = window.setTimeout(async () => {
        try {
          await saveSettings({
            preferences: {
              boardTheme: theme,
            },
          });
        } catch (error) {
          console.warn("Could not save board theme preference", error);
        }
      }, 400);
    },
    [saveSettings, user?.id]
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
