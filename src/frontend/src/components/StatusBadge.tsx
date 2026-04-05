import { AnswerStatus } from "../backend";

const STATUS_CONFIG = {
  [AnswerStatus.correct]: {
    bg: "oklch(0.65 0.18 145 / 0.15)",
    border: "oklch(0.65 0.18 145 / 0.4)",
    text: "oklch(0.72 0.18 145)",
    dot: "oklch(0.65 0.18 145)",
    label: "Correct",
  },
  [AnswerStatus.almost]: {
    bg: "oklch(0.75 0.18 80 / 0.12)",
    border: "oklch(0.75 0.18 80 / 0.4)",
    text: "oklch(0.78 0.18 80)",
    dot: "oklch(0.75 0.18 80)",
    label: "Almost",
  },
  [AnswerStatus.wrong]: {
    bg: "oklch(0.62 0.22 25 / 0.1)",
    border: "oklch(0.62 0.22 25 / 0.3)",
    text: "oklch(0.72 0.2 25)",
    dot: "oklch(0.62 0.22 25)",
    label: "Wrong",
  },
};

interface StatusBadgeSmallProps {
  status: AnswerStatus;
}

export function StatusBadgeSmall({ status }: StatusBadgeSmallProps) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}

import { QuizStatus } from "../backend";

interface StatusBadgeProps {
  status: QuizStatus | null;
  winner?: string;
}

export default function StatusBadge({ status, winner }: StatusBadgeProps) {
  if (!status) {
    return (
      <span
        data-ocid="quiz.status.badge"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
        style={{
          background: "oklch(0.22 0.025 265 / 0.6)",
          color: "oklch(0.55 0.02 265)",
          border: "1px solid oklch(0.28 0.025 265)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "oklch(0.45 0.02 265)" }}
        />
        Connecting
      </span>
    );
  }

  if (status === QuizStatus.live) {
    return (
      <span
        data-ocid="quiz.status.badge"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider animate-badge-pulse"
        style={{
          background: "oklch(0.65 0.18 145 / 0.14)",
          color: "oklch(0.72 0.18 145)",
          border: "1px solid oklch(0.65 0.18 145 / 0.35)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: "oklch(0.65 0.18 145)" }}
        />
        Live
      </span>
    );
  }

  if (status === QuizStatus.finished) {
    if (winner) {
      return (
        <span
          data-ocid="quiz.status.badge"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
          style={{
            background: "oklch(0.82 0.18 85 / 0.12)",
            color: "oklch(0.82 0.18 85)",
            border: "1px solid oklch(0.82 0.18 85 / 0.3)",
          }}
        >
          <span className="text-xs">🏆</span>
          Winner!
        </span>
      );
    }
    return (
      <span
        data-ocid="quiz.status.badge"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
        style={{
          background: "oklch(0.62 0.22 25 / 0.12)",
          color: "oklch(0.72 0.18 25)",
          border: "1px solid oklch(0.62 0.22 25 / 0.3)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: "oklch(0.62 0.22 25)" }}
        />
        Time&apos;s Up
      </span>
    );
  }

  return (
    <span
      data-ocid="quiz.status.badge"
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
      style={{
        background: "oklch(0.65 0.22 270 / 0.1)",
        color: "oklch(0.65 0.15 270)",
        border: "1px solid oklch(0.65 0.22 270 / 0.25)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: "oklch(0.65 0.22 270)" }}
      />
      Waiting
    </span>
  );
}
