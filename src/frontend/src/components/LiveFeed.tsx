import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Submission } from "../backend";
import { AnswerStatus } from "../backend";

function maskAnswer(answer: string): string {
  if (!answer || answer.length === 0) return "***";
  return `${answer[0]}***`;
}

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts) / 1_000_000;
  const date = new Date(ms);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "oklch(0.55 0.18 270)",
  "oklch(0.58 0.18 300)",
  "oklch(0.62 0.18 145)",
  "oklch(0.65 0.18 80)",
  "oklch(0.60 0.22 25)",
];

function getStatusStyle(status: AnswerStatus): { bg: string; accent: string } {
  if (status === AnswerStatus.correct) {
    return {
      bg: "oklch(0.65 0.18 145 / 0.1)",
      accent: "oklch(0.65 0.18 145)",
    };
  }
  if (status === AnswerStatus.almost) {
    return {
      bg: "oklch(0.75 0.18 80 / 0.08)",
      accent: "oklch(0.75 0.18 80)",
    };
  }
  return { bg: "transparent", accent: "oklch(0.35 0.02 265)" };
}

interface LiveFeedProps {
  submissions: Submission[];
  maxItems?: number;
  winnerName?: string;
}

const FeedItem = function FeedItem({
  sub,
  index,
  isNewest,
}: {
  sub: Submission;
  index: number;
  isNewest: boolean;
}) {
  const { bg, accent } = getStatusStyle(sub.answerStatus);
  const isCorrect = sub.answerStatus === AnswerStatus.correct;

  return (
    <motion.li
      data-ocid={`livefeed.item.${index + 1}`}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`flex items-center gap-3 px-4 py-3 transition-colors${
        isNewest ? " livefeed-item-new" : ""
      }`}
      style={{ background: bg }}
    >
      {/* Status indicator bar */}
      <div
        className="w-0.5 h-8 rounded-full shrink-0"
        style={{ background: accent }}
        aria-hidden="true"
      />

      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{
          backgroundColor:
            AVATAR_COLORS[sub.username.charCodeAt(0) % AVATAR_COLORS.length],
        }}
        aria-hidden="true"
      >
        {getInitials(sub.username)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground truncate">
          {isCorrect ? (
            <span className="text-success">{sub.username}</span>
          ) : (
            sub.username
          )}
        </p>
        <p
          className="text-[11px] font-mono tabular-nums"
          style={{ color: "oklch(0.50 0.02 265)" }}
        >
          {maskAnswer(sub.answer)}
        </p>
      </div>

      <span
        className="text-[10px] tabular-nums shrink-0"
        style={{ color: "oklch(0.45 0.02 265)" }}
      >
        {formatTimestamp(sub.timestamp)}
      </span>
    </motion.li>
  );
};

const MemoFeedItem = FeedItem;

export default function LiveFeed({
  submissions,
  maxItems = 10,
  winnerName,
}: LiveFeedProps) {
  const sorted = [...submissions]
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
    .slice(-maxItems)
    .reverse();

  const [highlightKey, setHighlightKey] = useState<string>("");
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only trigger on count change
  useEffect(() => {
    const current = sortedRef.current;
    if (current.length === 0) return;
    const newestKey = `${current[0].username}-${current[0].timestamp.toString()}`;
    setHighlightKey(newestKey);
    const clearTimer = setTimeout(() => setHighlightKey(""), 1800);
    return () => clearTimeout(clearTimer);
  }, [submissions.length]);

  return (
    <div
      data-ocid="livefeed.panel"
      className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: "oklch(0.65 0.18 145)",
            boxShadow: "0 0 6px oklch(0.65 0.18 145 / 0.8)",
          }}
          aria-hidden="true"
        />
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
          Live Feed
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {submissions.length} answer{submissions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <ScrollArea className="h-[240px]">
        {sorted.length === 0 ? (
          <div
            data-ocid="livefeed.empty_state"
            className="flex flex-col items-center justify-center h-full py-10 gap-2 text-muted-foreground"
          >
            <span className="text-2xl" aria-hidden="true">
              💬
            </span>
            <span className="text-xs">No answers yet. Be first!</span>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {/* Winner special entry */}
            {winnerName && (
              <motion.li
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: "oklch(0.65 0.18 145 / 0.12)",
                  borderBottom: "1px solid oklch(0.65 0.18 145 / 0.25)",
                }}
              >
                <span className="text-base" aria-hidden="true">
                  🎉
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: "oklch(0.72 0.18 145)" }}
                >
                  {winnerName} WON!
                </span>
              </motion.li>
            )}
            <AnimatePresence initial={false}>
              {sorted.map((sub, i) => {
                const key = `${sub.username}-${sub.timestamp.toString()}`;
                return (
                  <MemoFeedItem
                    key={key}
                    sub={sub}
                    index={i}
                    isNewest={key === highlightKey}
                  />
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
