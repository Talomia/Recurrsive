'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface EmptyStateAction {
  label: string;
  /** Internal route to link to. Mutually exclusive with onClick. */
  href?: string;
  /** Click handler for in-page actions. Mutually exclusive with href. */
  onClick?: () => void;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  /** Icon shown in the rounded badge above the title. */
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Primary call-to-action. Optional — some empty states are purely informational. */
  action?: EmptyStateAction;
  /** Optional secondary action rendered as a subtle text link/button. */
  secondaryAction?: EmptyStateAction;
  /** Optional supporting content (e.g. a feature grid) rendered below the CTA. */
  children?: ReactNode;
  /** Compact variant for inline / in-table empty states. */
  compact?: boolean;
  className?: string;
}

/**
 * Shared honest empty state.
 *
 * Used across result surfaces to communicate "there is genuinely no data yet"
 * with a single clear next action — never fabricated numbers or filler.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  compact = false,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon ?? ArrowRight;

  const actionClasses =
    'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]';
  const actionStyle = { background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))' };

  const actionNode = action ? (
    action.href ? (
      <Link href={action.href} className={actionClasses} style={actionStyle}>
        <ActionIcon className="h-4 w-4" aria-hidden="true" />
        {action.label}
      </Link>
    ) : (
      <button type="button" onClick={action.onClick} className={actionClasses} style={actionStyle}>
        <ActionIcon className="h-4 w-4" aria-hidden="true" />
        {action.label}
      </button>
    )
  ) : null;

  const secondaryNode = secondaryAction ? (
    secondaryAction.href ? (
      <Link
        href={secondaryAction.href}
        className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        {secondaryAction.label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={secondaryAction.onClick}
        className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        {secondaryAction.label}
      </button>
    )
  ) : null;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-12 px-6' : 'py-20 px-6'
      } ${className ?? ''}`}
    >
      <div
        className={`inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 ${
          compact ? 'h-12 w-12 mb-4' : 'h-16 w-16 mb-5'
        }`}
      >
        <Icon className={compact ? 'h-6 w-6 text-text-muted' : 'h-8 w-8 text-text-muted'} aria-hidden="true" />
      </div>
      <h3 className={`font-semibold text-text-primary mb-2 ${compact ? 'text-base' : 'text-lg'}`}>{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-md mb-6">{description}</p>
      )}
      {(actionNode || secondaryNode) && (
        <div className="flex items-center gap-4">
          {actionNode}
          {secondaryNode}
        </div>
      )}
      {children}
    </div>
  );
}
