import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

const CONFETTI_COLORS = [
  "oklch(0.65 0.22 270)",
  "oklch(0.65 0.18 145)",
  "oklch(0.75 0.18 80)",
  "oklch(0.65 0.22 25)",
  "oklch(0.65 0.2 300)",
  "oklch(0.72 0.2 200)",
  "oklch(0.82 0.18 85)",
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotate: number;
  shape: "rect" | "circle";
}

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: seededRandom(i * 7) * 100,
    delay: seededRandom(i * 13) * 2.5,
    duration: 3.5 + seededRandom(i * 17) * 3.5,
    color:
      CONFETTI_COLORS[
        Math.floor(seededRandom(i * 11) * CONFETTI_COLORS.length)
      ],
    size: 6 + Math.floor(seededRandom(i * 19) * 7),
    rotate: Math.floor(seededRandom(i * 23) * 360),
    shape: seededRandom(i * 3) > 0.5 ? "circle" : "rect",
  }));
}

const AUTO_DISMISS_MS = 8000;

interface WinnerOverlayProps {
  winner: string;
  timeTaken?: number; // seconds
  coinsWon?: number;
  rewardWon?: number;
  onDismiss: () => void;
  isAdmin?: boolean;
}

export default function WinnerOverlay({
  winner,
  timeTaken,
  coinsWon,
  rewardWon,
  onDismiss,
  isAdmin,
}: WinnerOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const confetti = useMemo(() => generateConfetti(50), []);
  const startTimeRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);

  // Auto-dismiss with progress bar
  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        setVisible(false);
        setTimeout(onDismiss, 300);
        return;
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onDismiss]);

  const handleDismiss = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  const initials = winner
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-ocid="winner.modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-winner"
          style={{ backgroundColor: "oklch(0.08 0.04 270 / 0.97)" }}
          aria-modal="true"
          // biome-ignore lint/a11y/useSemanticElements: motion.div used for animation
          role="dialog"
          aria-label="Winner Declared"
        >
          {/* Confetti */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            {confetti.map((piece) => (
              <div
                key={piece.id}
                className="confetti-piece"
                style={{
                  left: `${piece.left}%`,
                  top: `-${piece.size * 2}px`,
                  width: `${piece.size}px`,
                  height:
                    piece.shape === "circle"
                      ? `${piece.size}px`
                      : `${piece.size * 1.5}px`,
                  backgroundColor: piece.color,
                  borderRadius: piece.shape === "circle" ? "50%" : "2px",
                  animationDelay: `${piece.delay}s`,
                  animationDuration: `${piece.duration}s`,
                  transform: `rotate(${piece.rotate}deg)`,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>

          {/* Winner card */}
          <motion.div
            className="animate-winner-pop relative z-10 flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 max-w-sm w-full mx-4 text-center"
            style={{
              boxShadow:
                "0 0 60px oklch(0.65 0.22 270 / 0.35), 0 8px 32px oklch(0 0 0 / 0.6)",
              borderColor: "oklch(0.65 0.22 270 / 0.4)",
              animation:
                "winner-pop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
          >
            {/* Avatar */}
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white animate-pulse-ring"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                }}
              >
                {initials}
              </div>
              <div
                className="absolute -top-1.5 -right-1.5 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "oklch(0.82 0.18 85)" }}
              >
                <Trophy
                  className="w-4 h-4"
                  style={{ color: "oklch(0.20 0.04 85)" }}
                />
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: "oklch(0.65 0.18 145)" }}
              >
                🎉 Winner Declared!
              </p>
              <h2 className="text-3xl font-display font-bold text-foreground">
                {winner}
              </h2>
              {timeTaken !== undefined && (
                <p
                  className="text-sm"
                  style={{ color: "oklch(0.72 0.15 270)" }}
                >
                  ⚡ Answered in {timeTaken.toFixed(1)}s
                </p>
              )}
            </div>

            {/* Rewards row */}
            {(coinsWon !== undefined || rewardWon !== undefined) && (
              <div
                className="flex items-center gap-4 px-4 py-2.5 rounded-lg w-full justify-center"
                style={{
                  background: "oklch(0.65 0.22 270 / 0.08)",
                  border: "1px solid oklch(0.65 0.22 270 / 0.2)",
                }}
              >
                {coinsWon !== undefined && coinsWon > 0 && (
                  <span
                    className="text-sm font-bold"
                    style={{ color: "oklch(0.78 0.18 80)" }}
                  >
                    +{coinsWon} 🪙
                  </span>
                )}
                {rewardWon !== undefined && rewardWon > 0 && (
                  <span
                    className="text-sm font-bold"
                    style={{ color: "oklch(0.72 0.18 145)" }}
                  >
                    +₹{rewardWon}
                  </span>
                )}
              </div>
            )}

            {/* Dismiss button */}
            <Button
              data-ocid="winner.close_button"
              onClick={handleDismiss}
              className="w-full font-bold uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-transform"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                color: "white",
                boxShadow: "0 0 20px oklch(0.65 0.22 270 / 0.3)",
              }}
            >
              {isAdmin ? "Start Next Round →" : "View Scoreboard"}
            </Button>

            {/* Auto-dismiss progress bar */}
            <div className="w-full space-y-1.5">
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: "oklch(0.22 0.025 265)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress}%`,
                    background:
                      "linear-gradient(90deg, oklch(0.65 0.22 270), oklch(0.65 0.25 290))",
                    boxShadow: "0 0 6px oklch(0.65 0.22 270 / 0.5)",
                  }}
                />
              </div>
              <p
                className="text-[11px] text-center"
                style={{ color: "oklch(0.55 0.02 265)" }}
              >
                {isAdmin
                  ? "Waiting for next round..."
                  : `Closing in ${Math.ceil(((100 - progress) / 100) * 8)}s — or click above`}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
