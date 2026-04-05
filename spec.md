# Real-Time Quiz App — UI/UX Overhaul

## Current State

The app is fully functional with all major features implemented:
- User view (`/`) with join flow, answer input, live feed, leaderboard, wallet/coins, winner overlay
- Admin panel (`/admin`) with quiz creation, player management, withdrawal approvals, auto mode, coin settings
- Components: `App.tsx`, `UserView.tsx`, `AdminPanel.tsx`, `Leaderboard.tsx`, `WinnerOverlay.tsx`, `LiveFeed.tsx`, `TimerRing.tsx`, `NameEntry.tsx`, `StatusBadge.tsx`
- Dark theme exists but is inconsistently applied
- Layout has known issues: awkward spacing, mobile breakage, cluttered navbar
- Admin panel is a long scrollable page with no tab organization
- Animations exist but are basic/inconsistent
- Error states show raw or unclear messages

## Requested Changes (Diff)

### Add
- Comprehensive design token system in `index.css` using OKLCH color space: dark base, vibrant blue/purple primary, green/yellow/red semantic colors, consistent spacing scale, border-radius tokens
- Smooth CSS/Framer Motion transitions: page changes, answer feed entries, winner overlay entrance, round transitions
- Sticky bottom answer input bar on mobile
- Clean error UI components: wrong room code, not enough coins, blocked/kicked states with friendly messages and icons
- Subtle glow effects on primary interactive elements (input focus, active timer, winner card)
- Gradient accents on key cards (question card header, winner overlay)
- Tab-based navigation in admin panel (Room Controls | Players | Coins | Withdrawals | Auto Mode | Logs)
- Compact navbar with player name, 🪙 coins, ₹ wallet, 👥 count — all in one tight row
- Animated feedback overlays for correct/almost/wrong answer states (brief, satisfying, non-blocking)
- Loading skeleton states where data is being fetched
- Hover/tap animations on all interactive buttons (scale + brightness)

### Modify
- `index.css`: Replace current CSS with a comprehensive design system using OKLCH tokens, consistent typography scale (Inter/system font), spacing utilities, animation keyframes
- `App.tsx`: Add route-level transition wrapper; clean up routing logic
- `UserView.tsx`: Full redesign — responsive two-column layout (question+input left, leaderboard right on desktop; stacked on mobile), sticky answer input bottom bar on mobile, cleaner wallet card, improved join flow with animated transitions between states, better feedback messages with icons
- `AdminPanel.tsx`: Full redesign — tabbed layout replacing the long scroll page, each section in a clean card, form fields with proper labels and spacing, submission table with better badges, clear CTAs
- `Leaderboard.tsx`: Cleaner card design, better rank badges (gold/silver/bronze), streak/referral badges more visually distinct, current winner highlight with glow effect
- `WinnerOverlay.tsx`: More polished full-screen overlay with gradient background, animated entrance, confetti improvement, dismiss animation
- `LiveFeed.tsx`: Smoother entry animations for new answers, better color coding, auto-scroll behavior preserved
- `TimerRing.tsx`: Keep functionality, improve visual ring with color transitions (green → yellow → red as time runs low)
- `NameEntry.tsx`: Cleaner join card design, better input styling, room code input with OTP-style 4-digit fields
- `StatusBadge.tsx`: Consistent badge styling matching design system

### Remove
- Dead/unused CSS variables and styles
- Redundant inline styles that should use Tailwind classes
- Any console.log statements left in production code

## Implementation Plan

1. **Design System** (`index.css`): Set up OKLCH color tokens, typography scale, spacing, animation keyframes. This is the foundation everything else references.

2. **App.tsx**: Add page transition wrapper. Clean routing.

3. **NameEntry.tsx**: Redesign join card — 4-digit room code input (OTP-style), name input, clear error states, welcome-back screen variant.

4. **UserView.tsx**: Major overhaul:
   - Responsive grid: 2-col on desktop, single col on mobile
   - Question card with gradient header accent
   - Sticky bottom answer bar on mobile with send button
   - Wallet/coins card compact version
   - Answer feedback animations (correct: green flash, almost: yellow pulse, wrong: red shake)
   - "Not enough coins" inline message with Get Free Coins shortcut
   - Blocked/kicked state with friendly explanation card
   - Timer pulse effect when under 10s
   - Invite link button in sidebar

5. **AdminPanel.tsx**: Tab-based redesign:
   - Tab 1 "Room": Room code display, regenerate button, current question, start/end round controls
   - Tab 2 "Players": Player list with kick/block actions, suspicious highlighting, player count
   - Tab 3 "Coins": Entry fee setting, win bonus, give coins to player
   - Tab 4 "Withdrawals": Pending requests table with Mark as Paid
   - Tab 5 "Auto Mode": Toggle, reward/timer settings, question bank category stats
   - Tab 6 "Logs": Last 10 rounds with winner and answer time
   - New quiz creation form accessible from Room tab

6. **Leaderboard.tsx**: Rank cards with medal icons, streak flame, referral badges, coin display, winner glow.

7. **WinnerOverlay.tsx**: Gradient overlay, entrance animation, winner stats display, dismiss CTA.

8. **LiveFeed.tsx**: Slide-in animation for new entries, color-coded by answer status.

9. **TimerRing.tsx**: Color-transitioning ring (green/yellow/red), pulse animation at low time.

10. **Validate and fix** any TypeScript/lint errors.
