# HMR dock v6.0 changelog (from v5.1, md5 da690d65)

Source: /home/claude/site/assets/hmr-dock.js (tasks 23 to 34, item 33 not built). Not copied to any repo, nothing committed.

## Speak here (23, 24, 29)
- Mic starts OFF. Header "Do us a big favor, tell us what you think" with a heart, one line, X at right.
- "Talk as long as you like." line, a one-line reason it matters, a note to wait half a second after pressing the mic, status line above the text box: "Press the record button and begin speaking".
- Removed "Speak here and someone will listen" and every "you can fix words" line.
- Outside clicks and other dock buttons no longer close it while recording. X, Escape, or the Speak button still do.
- Always-free line: "Always free forever. Nothing we make will ever ask you to pay." (in the Speak pop-up and under the "Part of the HMR family" ribbon at the end of each page).

## Submissions (24)
- One shared control for Speak, Feedback sheet, and Design notes: "Submit with my email" (first press shows the email field, second press sends) and "Submit anonymously". Posts to Web3Forms with the existing key. No copy-all-ratings control exists in the dock.

## Ratings (25, 26)
- Design ratings and React use a hate / neutral / love slider (-5 to 5, labels Hate, Neutral, Love, neutral in the middle). Thumbs removed, React "Like" and "Dislike" chips removed. Old thumbs ratings migrate to +4 and -4.
- React panel: one line saying it is a two-way deal (their signal helps builders improve sites for free).

## Highlight tool (27)
- Select text and it is marked at once (several at a time); hover a highlight for the menu (tap on touch screens). Menu stays while anything is highlighted and follows the highlight on scroll.
- Tutorial line in the menu and a one-time toast after the first highlight.
- X on the menu clears all highlights in progress.
- Buttons, two lines each: Share / with others, Feedback / for us, Email / myself, Remove / highlight. Share, Feedback, and Email act on all highlights; Remove acts on the hovered one. Share links carry every highlight as a text fragment.
- Fixes: no more hide-and-reshow flicker (menu is no longer tied to the selection). Marks are computed from the page's flat text index, so the last letter is never dropped (verified: marked text equals selected text, single and multi-element).

## Forward button (28)
- Never greyed out. Hover or focus tooltip and title: our bar has a forward button even on a first visit, because on many sites the next best step is forward. If nothing is ahead, a toast explains it.

## Funsies (30)
- Play menu overlap: the menu's classes (card, grid, fb, play) collided with site CSS; now unique hmr-f* names with layout reset. Measured zero overlaps on five sites.
- Dragons: three original dragons, each with a rider and a pennant, circling the screen, breathing fire that leaves burning patches and scorch marks.

## Pop-ups with a page or model (31)
- Play overlay is vertical (640px wide max, 96 percent of screen height), wheel scrolls, +/- zoom buttons with a percent readout, "New tab" link. Pages loaded in it ignore wheel zoom (the dock inside the embedded page blocks wheel events from reaching the page's own handlers; same-origin frames are handled by the parent too).

## Bug: dock collapsed to Design + Funsies (32)
- Cause as far as can be told: a history page restored from the browser's cache (back/forward) can run an older cached copy of hmr-dock.js, which only had those two buttons. Cannot be reproduced locally with v5.1 (all six buttons survived four back/forward steps).
- Fixes in v6: self-repair (pageshow incl. bfcache, visibility, focus, and a 3 second check) re-attaches the dock, its buttons, and its styles; if an older dock (version below 6) is already on the page, v6 removes its DOM and takes over.
- Needed outside this file: sites should load the dock with a version query (for example hmr-dock.js?v=6.0) so history pages do not reuse an old cached copy. universemodel.ai already uses ?v=da690d65.

## Design studio (34, plus tasks 20 and 21)
- Each design is built fresh from the page's own text plus a design prompt (the 48 existing genre themes: colors, type, shapes, and now a layout and a 3D background each). It renders in a shadow-DOM overlay; the original layout is never restyled.
- Layouts: stack, cards, magazine, poster, timeline, sidebar, terminal, deck. Backgrounds: full-screen canvas 3D with real perspective (tunnel, wireframe cubes, synthwave terrain, starfield, orbs, helix, waves, rotating tensegrity). The canvas and reading position persist when you switch designs.
- "Text only (proofread)": the page's text in reading order as numbered chunks (heading, paragraph, list, card), with a chunk and word count.
- Shuffle history: "Previous design" steps back through every change.
- Removed: text hover effect and letter animation. Kept: mouse pointer and trails, notes (with voice typing).
- Pages with under 12 words of text keep the original and say so.
- Limits: the highlight tool and the Funsies page physics work on the rebuilt page only partly (Funsies physics yes; highlights are paused while a design is showing). Pages that are mostly canvas or app UI have little text to rebuild.

## Other
- No "Leo" in any UI text (the fallback mailto address still starts with leo@; see report).
- Version: header v6.0, HMRDock.version 6.
