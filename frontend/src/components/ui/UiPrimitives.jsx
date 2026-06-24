import { createElement, forwardRef } from "react";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function AppShell({ children, className = "", as: Component = "div", ...props }) {
  return createElement(Component, { className: cx("of-app-shell", className), ...props }, children);
}

export function PageContainer({ children, className = "", size = "default", as: Component = "main", ...props }) {
  return createElement(
    Component,
    {
      className: cx("of-page-container", size !== "default" && `of-page-container--${size}`, className),
      ...props,
    },
    children
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
  compact = false,
  as: Component = "header",
  ...props
}) {
  return createElement(
    Component,
    { className: cx("of-page-header", compact && "of-page-header--compact", className), ...props },
    <>
      <div className="of-page-header__copy">
        {eyebrow ? <p className="of-eyebrow">{eyebrow}</p> : null}
        {title ? <h1>{title}</h1> : null}
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="of-page-header__actions">{actions}</div> : null}
    </>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
  as: Component = "header",
  ...props
}) {
  return createElement(
    Component,
    { className: cx("of-section-header", className), ...props },
    <>
      <div className="of-section-header__copy">
        {eyebrow ? <p className="of-eyebrow">{eyebrow}</p> : null}
        {title ? <h2>{title}</h2> : null}
        {description ? <p>{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="of-section-header__actions">{actions}</div> : null}
    </>
  );
}

export function Surface({
  children,
  className = "",
  variant = "default",
  interactive = false,
  as: Component = "section",
  ...props
}) {
  return createElement(
    Component,
    {
      className: cx(
        "of-surface",
        variant !== "default" && `of-surface--${variant}`,
        interactive && "of-surface--interactive",
        className
      ),
      ...props,
    },
    children
  );
}

export const Card = Surface;

const ButtonBase = forwardRef(function ButtonBase(
  {
    children,
    className = "",
    variant = "secondary",
    size = "default",
    fullWidth = false,
    as: Component = "button",
    type,
    ...props
  },
  ref
) {
  const buttonType = Component === "button" ? type || "button" : type;

  return createElement(
    Component,
    {
      ref,
      type: buttonType,
      className: cx(
        "of-button",
        `of-button--${variant}`,
        size !== "default" && `of-button--${size}`,
        fullWidth && "of-button--full",
        className
      ),
      ...props,
    },
    children
  );
});

export function PrimaryButton(props) {
  return <ButtonBase variant="primary" {...props} />;
}

export function SecondaryButton(props) {
  return <ButtonBase variant="secondary" {...props} />;
}

export function IconButton({ label, children, className = "", ...props }) {
  return (
    <ButtonBase className={cx("of-icon-button", className)} aria-label={label} title={label} {...props}>
      {children}
    </ButtonBase>
  );
}

export function StatusBadge({ children, tone = "neutral", className = "", ...props }) {
  return (
    <span className={cx("of-status-badge", `of-status-badge--${tone}`, className)} {...props}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, children, action, className = "", compact = false, ...props }) {
  return (
    <div className={cx("of-empty-state", compact && "of-empty-state--compact", className)} {...props}>
      {icon ? <div className="of-empty-state__icon" aria-hidden="true">{icon}</div> : null}
      <div className="of-empty-state__copy">
        {title ? <h3>{title}</h3> : null}
        {children ? <p>{children}</p> : null}
      </div>
      {action ? <div className="of-empty-state__action">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "", width, height, ...props }) {
  return (
    <span
      className={cx("of-skeleton", className)}
      style={{ width, height, ...props.style }}
      aria-hidden="true"
      {...props}
    />
  );
}

export function LoadingState({ title = "Loading", children, className = "", ...props }) {
  return (
    <div className={cx("of-loading-state", className)} role="status" {...props}>
      <span className="of-loading-state__spinner" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}

export function TabNavigation({ items = [], activeKey, onSelect, className = "", ariaLabel = "Sections" }) {
  return (
    <nav className={cx("of-tab-navigation", className)} aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.key === activeKey || item.active;
        return (
          <button
            key={item.key}
            type="button"
            className={cx("of-tab-navigation__item", isActive && "is-active", item.className)}
            aria-current={isActive ? "page" : undefined}
            disabled={item.disabled}
            onClick={() => onSelect?.(item)}
          >
            {item.icon ? <span className="of-tab-navigation__icon" aria-hidden="true">{item.icon}</span> : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function ResponsiveGrid({
  children,
  className = "",
  min = "260px",
  columns,
  as: Component = "div",
  ...props
}) {
  return createElement(
    Component,
    {
      className: cx("of-responsive-grid", columns && `of-responsive-grid--${columns}`, className),
      style: { "--of-grid-min": min, ...props.style },
      ...props,
    },
    children
  );
}

export function FormField({
  label,
  helpText,
  error,
  children,
  className = "",
  required = false,
  ...props
}) {
  return (
    <label className={cx("of-form-field", error && "of-form-field--error", className)} {...props}>
      {label ? (
        <span className="of-form-field__label">
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="of-form-field__message" role="alert">{error}</span> : null}
      {!error && helpText ? <span className="of-form-field__help">{helpText}</span> : null}
    </label>
  );
}

export { cx };
