import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react'

/**
 * QA Known-Issues banner.
 *
 * Shows the real bugs found in the Time Tracker audit (docs/TIME-TRACKER-BUG-AUDIT.md)
 * so testers can see them. This is explicitly a QA / internal diagnostics panel — the
 * header says so. It is NOT a disguised system-failure alert and must stay labeled.
 *
 * Severity + one-line title only, grouped by severity.
 */

type Severity = 'SEV1' | 'SEV2' | 'SEV3'

interface KnownIssue {
  severity: Severity
  title: string
}

const KNOWN_ISSUES: KnownIssue[] = [
  // SEV1 — data loss / wrong money / wrong duration
  { severity: 'SEV1', title: 'Editing a duration that is not HH:MM:SS writes NaN and corrupts totals/invoices' },
  { severity: 'SEV1', title: 'Saved duration is not re-derived from start/end, so time range and billed hours can disagree' },
  { severity: 'SEV1', title: 'datetime-local round-trip shifts edited entry times by the UTC offset (wrong-day bucketing)' },
  // SEV2 — broken feature / correctness / tenant
  { severity: 'SEV2', title: 'Stop-modal project/description/client data is silently dropped on stop' },
  { severity: 'SEV2', title: 'Double-start race can create two concurrent running timers' },
  { severity: 'SEV2', title: 'Admin time-entry list is filtered client-side (possible cross-company exposure — verify server)' },
  { severity: 'SEV2', title: 'Opening the edit modal on a running entry silently finalizes/stops it' },
  { severity: 'SEV2', title: 'Billable "$ earned" freezes while the timer keeps counting' },
  { severity: 'SEV2', title: 'Billable time and $ earned use different time windows/zones and can diverge' },
  { severity: 'SEV2', title: 'Recent-entries pagination hides pages past 5' },
  // SEV3 — minor / robustness
  { severity: 'SEV3', title: 'Duration unit (seconds vs ms) is unvalidated across the API boundary' },
  { severity: 'SEV3', title: 'Entry with a directly-set client can lose it on save' },
  { severity: 'SEV3', title: 'new Date(undefined) → Invalid Date when server omits created/updated timestamps' },
  { severity: 'SEV3', title: 'AI timer-intent regex false-positives (e.g. "stop wasting time")' },
  { severity: 'SEV3', title: 'Reminder scheduler reports success even when some reminders fail' },
  { severity: 'SEV3', title: 'Poller can overwrite optimistic edits; loading can stick on repeated poll errors' },
  { severity: 'SEV3', title: 'Future/clock-skewed entries silently dropped from billable sum' },
  { severity: 'SEV3', title: 'Non-solo isBillable default read before company loads' },
]

const SEV_STYLES: Record<Severity, string> = {
  SEV1: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  SEV2: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  SEV3: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
}

export default function KnownIssuesBanner() {
  const [open, setOpen] = useState(false)

  const counts = KNOWN_ISSUES.reduce(
    (acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] || 0) + 1 }),
    {} as Record<Severity, number>
  )

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <FlaskConical className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded bg-amber-200 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-800 dark:text-amber-100">
              <AlertTriangle className="h-3 w-3" /> QA · Known Issues
            </span>
            <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Time Tracker — {KNOWN_ISSUES.length} known issues under QA
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-300">
              ({counts.SEV1 || 0} SEV1 · {counts.SEV2 || 0} SEV2 · {counts.SEV3 || 0} SEV3)
            </span>
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-amber-200 px-4 py-3 dark:border-amber-800">
          <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
            Internal QA diagnostics — tracked in <code>docs/TIME-TRACKER-BUG-AUDIT.md</code>. Not a system outage.
          </p>
          <ul className="space-y-1.5">
            {KNOWN_ISSUES.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${SEV_STYLES[issue.severity]}`}
                >
                  {issue.severity}
                </span>
                <span className="text-gray-800 dark:text-gray-200">{issue.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
