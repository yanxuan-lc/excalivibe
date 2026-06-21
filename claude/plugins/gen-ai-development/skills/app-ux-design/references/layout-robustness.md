# Layout robustness — the #1 source of "looks broken"

Default-generated layouts most often fail by **wrapping text awkwardly or
overflowing their container** in the narrow case (a 2-col KPI grid on a 375px
phone, a flex row where a fixed-width chart sits next to a long number). Build so
the *smallest* target holds together, and the rest follows:

- **Flex rows that mix flexible + fixed children:** give the flexible child
  `min-w-0` (so it can shrink) and the fixed child (chart, icon, sparkline)
  `shrink-0`. Without `min-w-0`, the fixed child pushes past the edge — that's the
  classic sparkline-bleeding-past-the-card bug.
- **Short labels next to a value/badge:** wrap the pair in `flex items-center
  gap-* whitespace-nowrap` so "+12.5% 较上周期" never breaks mid-phrase into two
  lines. Hide non-essential labels on the narrowest breakpoint (`hidden sm:inline`)
  rather than letting them wrap.
- **Long single-line text** (names, titles, metric labels): `truncate` (needs a
  `min-w-0` flex parent) instead of letting it wrap or overflow.
- **Scale type down on mobile:** big numbers/headings often overflow 2-col cards —
  `text-xl md:text-2xl`, not a fixed `text-2xl`.
- **Dense card grids must step columns, not crush cells:** a KPI row should be
  `grid-cols-2 lg:grid-cols-4`, never a flat `grid-cols-4`. With a sidebar, a
  4-col grid at tablet width shrinks each card to ~125px — too narrow for a
  number + sparkline, so the sparkline bleeds out. Step the column count up with
  the breakpoint; same for chart rows (`grid-cols-1 lg:grid-cols-3`). Use the
  bundled `Sparkline` (it's `shrink-0` and won't push past its card).
- **Wide tables:** wrap in `overflow-x-auto` (with a sensible `min-w-[…]`), or swap
  to a stacked card/list layout under `md:` — don't let a table force horizontal
  page scroll.
- **Spacing:** stick to the Tailwind scale (`gap-2/3/4`, `p-4 md:p-6`); don't
  hand-pick one-off pixel paddings per element — inconsistent padding is what
  reads as "unstable whitespace".
- **Don't fake device chrome.** The shell already draws the phone status bar
  (clock / signal / battery), notch, and home indicator, and reserves that space —
  your screen renders *below* it. Don't add your own status bar, and don't pad the
  top for a notch; just build the screen content. (Web mode is full-bleed, no
  chrome — the app fills the whole viewport.)

Verify both ends before handing off: open `/__ued/shell`, check the Mobile frame
*and* the Web (full-bleed) view; nothing should clip, bleed, or wrap into a
two-line mess.
