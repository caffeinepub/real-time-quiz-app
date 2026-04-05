import { ScrollArea } from "@/components/ui/scroll-area";
import { Crown, History, Medal, Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo } from "react";
import type { ScoreboardData } from "../backend";

function formatTimeTaken(nanoseconds: bigint): string {
  const seconds = Number(nanoseconds) / 1_000_000_000;
  return `${seconds.toFixed(1)}s`;
}

function getRankIcon(rank: number) {
  if (rank === 1)
    return (
      <Crown className="w-3.5 h-3.5" style={{ color: "oklch(0.82 0.18 85)" }} />
    );
  if (rank === 2)
    return (
      <Medal
        className="w-3.5 h-3.5"
        style={{ color: "oklch(0.78 0.05 240)" }}
      />
    );
  if (rank === 3)
    return (
      <Medal className="w-3.5 h-3.5" style={{ color: "oklch(0.68 0.14 55)" }} />
    );
  return (
    <span
      className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold tabular-nums"
      style={{ color: "oklch(0.45 0.02 265)" }}
    >
      {rank}
    </span>
  );
}

const RANK_STYLES: Record<
  number,
  { bg: string; border: string; text: string }
> = {
  1: {
    bg: "oklch(0.82 0.18 85 / 0.07)",
    border: "oklch(0.82 0.18 85 / 0.3)",
    text: "oklch(0.82 0.18 85)",
  },
  2: {
    bg: "oklch(0.78 0.05 240 / 0.07)",
    border: "oklch(0.78 0.05 240 / 0.25)",
    text: "oklch(0.78 0.05 240)",
  },
  3: {
    bg: "oklch(0.68 0.14 55 / 0.07)",
    border: "oklch(0.68 0.14 55 / 0.25)",
    text: "oklch(0.68 0.14 55)",
  },
};

function getMilestoneBadge(
  inviteCount: number,
): { emoji: string; label: string } | null {
  if (inviteCount >= 10) return { emoji: "👑", label: "King" };
  if (inviteCount >= 5) return { emoji: "🔥", label: "Promoter" };
  if (inviteCount >= 3) return { emoji: "🔹", label: "Starter" };
  return null;
}

interface LeaderboardRowProps {
  entry: { username: string; wins: bigint; streak: bigint };
  rank: number;
  isCurrentWinner: boolean;
  isMyself: boolean;
  inviteCount: number;
}

const LeaderboardRow = memo(function LeaderboardRow({
  entry,
  rank,
  isCurrentWinner,
  isMyself,
  inviteCount,
}: LeaderboardRowProps) {
  const streak = Number(entry.streak ?? 0n);
  const rankStyle = RANK_STYLES[rank];
  const milestoneBadge = getMilestoneBadge(inviteCount);

  let rowBg = rankStyle ? rankStyle.bg : "transparent";
  let rowBorder = rankStyle
    ? `2px solid ${rankStyle.border}`
    : "2px solid transparent";
  let nameColor = rankStyle ? rankStyle.text : "oklch(var(--foreground))";

  if (isCurrentWinner) {
    rowBg = "oklch(0.65 0.18 145 / 0.1)";
    rowBorder = "2px solid oklch(0.65 0.18 145 / 0.5)";
    nameColor = "oklch(0.72 0.18 145)";
  } else if (isMyself) {
    rowBg = "oklch(0.65 0.22 270 / 0.08)";
    rowBorder = "2px solid oklch(0.65 0.22 270 / 0.3)";
    nameColor = "oklch(0.75 0.18 270)";
  }

  return (
    <motion.li
      data-ocid={`leaderboard.item.${rank}`}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.03, duration: 0.25 }}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all"
      style={{
        background: rowBg,
        borderLeft: rowBorder,
        boxShadow: isCurrentWinner
          ? "0 0 12px oklch(0.65 0.18 145 / 0.15)"
          : undefined,
      }}
    >
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {getRankIcon(rank)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span
            className="text-xs font-semibold truncate max-w-[100px]"
            style={{ color: nameColor }}
          >
            {entry.username}
          </span>
          {isCurrentWinner && (
            <span className="text-[9px] font-bold text-success shrink-0">
              ← winner
            </span>
          )}
          {streak >= 3 && (
            <span
              className="text-xs"
              title={`${streak} win streak`}
              aria-label={`${streak} streak`}
            >
              🔥
            </span>
          )}
          {streak > 0 && streak < 3 && (
            <span
              className="inline-flex items-center text-[9px] font-bold px-1 py-0.5 rounded-full shrink-0"
              style={{
                background: "oklch(0.65 0.18 55 / 0.18)",
                color: "oklch(0.78 0.16 55)",
              }}
            >
              {streak}🔥
            </span>
          )}
          {milestoneBadge && (
            <span
              className="text-[9px] font-bold shrink-0"
              title={`${milestoneBadge.label}: ${inviteCount} invites`}
            >
              {milestoneBadge.emoji}
            </span>
          )}
        </div>
        {inviteCount > 0 && (
          <p className="text-[9px]" style={{ color: "oklch(0.45 0.08 270)" }}>
            {inviteCount} invite{inviteCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span
          className="text-xs font-bold tabular-nums"
          style={{
            color: rankStyle
              ? rankStyle.text
              : "oklch(var(--muted-foreground))",
          }}
        >
          {Number(entry.wins)}
        </span>
        <span className="text-[10px]" style={{ color: "oklch(0.38 0.02 265)" }}>
          {Number(entry.wins) === 1 ? "win" : "wins"}
        </span>
      </div>
    </motion.li>
  );
});

interface LeaderboardProps {
  scoreboard: ScoreboardData | null;
  currentWinner?: string;
  myUsername?: string;
  roundTitle?: string;
  referralCounts?: Map<string, number>;
}

export default function Leaderboard({
  scoreboard,
  currentWinner,
  myUsername,
  roundTitle,
  referralCounts,
}: LeaderboardProps) {
  const entries = scoreboard?.scoreboard ?? [];
  const winHistory = scoreboard?.winHistory?.slice(0, 5) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      data-ocid="leaderboard.panel"
      className="rounded-xl border border-border bg-card shadow-card overflow-hidden"
    >
      {/* Gradient header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b border-border"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.65 0.22 270 / 0.08) 0%, transparent 100%)",
        }}
      >
        <Trophy className="w-4 h-4" style={{ color: "oklch(0.82 0.18 85)" }} />
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
          Leaderboard
        </h3>
        {roundTitle && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "oklch(0.65 0.22 270 / 0.12)",
              color: "oklch(0.72 0.15 270)",
            }}
          >
            {roundTitle}
          </span>
        )}
      </div>

      {/* Player list */}
      <div className="p-3">
        <ScrollArea className="max-h-[200px]">
          {entries.length === 0 ? (
            <div
              data-ocid="leaderboard.empty_state"
              className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground"
            >
              <Trophy className="w-7 h-7 opacity-20" />
              <span className="text-xs">No wins yet. Be first!</span>
            </div>
          ) : (
            <ul className="space-y-1">
              <AnimatePresence>
                {entries.map((entry, i) => (
                  <LeaderboardRow
                    key={entry.username}
                    entry={
                      entry as {
                        username: string;
                        wins: bigint;
                        streak: bigint;
                      }
                    }
                    rank={i + 1}
                    isCurrentWinner={
                      !!currentWinner &&
                      entry.username.toLowerCase() ===
                        currentWinner.toLowerCase()
                    }
                    isMyself={
                      !!myUsername &&
                      entry.username.toLowerCase() === myUsername.toLowerCase()
                    }
                    inviteCount={referralCounts?.get(entry.username) ?? 0}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Recent winners */}
      {winHistory.length > 0 && (
        <>
          <div className="mx-3 border-t border-border" />
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <History
                className="w-3 h-3"
                style={{ color: "oklch(0.45 0.02 265)" }}
              />
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "oklch(0.45 0.02 265)" }}
              >
                Recent Winners
              </p>
            </div>
            <ul className="space-y-1">
              {winHistory.map((win, i) => (
                <li
                  key={`${win.username}-${i}`}
                  data-ocid={`leaderboard.row.${i + 1}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1"
                  style={{ background: "oklch(0.19 0.018 265 / 0.5)" }}
                >
                  <span
                    className="text-[10px] font-bold shrink-0 tabular-nums"
                    style={{ color: "oklch(0.82 0.18 85 / 0.6)" }}
                  >
                    #{i + 1}
                  </span>
                  <span className="flex-1 text-[11px] font-medium text-foreground truncate">
                    {win.username}
                  </span>
                  <span
                    className="text-[10px] font-mono shrink-0 tabular-nums"
                    style={{ color: "oklch(var(--success))" }}
                  >
                    {formatTimeTaken(win.timeTaken)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </motion.div>
  );
}
