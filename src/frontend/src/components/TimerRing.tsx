interface TimerRingProps {
  remaining: number;
  total: number;
  size?: number;
}

export default function TimerRing({
  remaining,
  total,
  size = 160,
}: TimerRingProps) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? remaining / total : 0;
  const dashOffset = circumference * (1 - progress);

  const pct = progress * 100;
  const isUrgent = remaining < 10 && total > 0;
  const isLow = remaining < total * 0.2 && total > 0;
  const displayTime = Math.ceil(remaining);

  // Color transitions: green -> yellow -> red
  const strokeColor = isUrgent
    ? "oklch(0.62 0.22 25)"
    : pct < 50
      ? "oklch(0.75 0.18 80)"
      : "oklch(0.65 0.18 145)";

  const textColor = isUrgent
    ? "oklch(0.62 0.22 25)"
    : pct < 50
      ? "oklch(0.75 0.18 80)"
      : "oklch(0.90 0.01 265)";

  const ringClass = isUrgent
    ? "timer-ring-red"
    : isLow
      ? "timer-ring-yellow"
      : "timer-ring-green";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${displayTime} seconds remaining`}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(0.22 0.025 265)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={ringClass}
          style={{
            transition: "stroke-dashoffset 0.5s linear, stroke 0.4s ease",
          }}
        />
      </svg>

      {/* Center number */}
      <div className="relative z-10 flex flex-col items-center select-none">
        <span
          className={`font-display font-bold leading-none tabular-nums${
            isUrgent ? " animate-timer-pulse" : ""
          }`}
          style={{
            fontSize:
              displayTime >= 100 ? `${size * 0.22}px` : `${size * 0.28}px`,
            color: textColor,
            textShadow: isUrgent
              ? "0 0 18px oklch(0.62 0.22 25 / 0.9)"
              : "none",
            transition: "color 0.4s ease",
          }}
        >
          {displayTime}
        </span>
        <span
          className="text-xs font-body uppercase tracking-widest mt-1"
          style={{ color: "oklch(0.50 0.02 265)" }}
        >
          secs
        </span>
      </div>
    </div>
  );
}
