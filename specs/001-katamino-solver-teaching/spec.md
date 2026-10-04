# Feature Specification: Katamino Combinatorial Optimization Teaching App

**Feature Branch**: `001-katamino-solver-teaching`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Construir uma aplicação web que possa ser hospedada no github.io para ensinar sobre otimização combinatória utilizando o jogo katamino. Na aplicação o usuário poderá jogar manualmente todos os 500 desafios do jogo manualmente ou utilizar algoritmos para resolver automaticamente. A resolução deve ser feita passo a passo de forma visual para que o usuário possa ver como o computador resolve o problema."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play challenges manually (Priority: P1)

A visitor opens the app, picks any one of the 500 Katamino challenges, and solves it by hand: selecting pieces, rotating/flipping them, and placing them on the board until it is completely and correctly filled.

**Why this priority**: This is the core puzzle-game experience and the baseline value of the app even before any teaching content is added — it must work standalone.

**Independent Test**: Can be fully tested by opening the app, selecting a challenge, placing all required pieces to fill the board, and confirming the app recognizes the board as solved — delivers a complete, playable puzzle experience on its own.

**Acceptance Scenarios**:

1. **Given** the app is open and a challenge is selected, **When** the user places all required pieces so the board is fully and validly covered with no overlaps, **Then** the app marks the challenge as solved and confirms it to the user.
2. **Given** a challenge is in progress, **When** the user attempts to place a piece so that it overlaps another piece or extends outside the board, **Then** the app prevents/rejects the placement and gives immediate visual feedback that it is invalid.
3. **Given** a challenge is in progress with some pieces already placed, **When** the user resets the challenge, **Then** the board returns to empty and the user can start over.
4. **Given** the user has solved a challenge and later reopens the app on the same device, **When** they view the challenge list, **Then** that challenge is shown as already completed.

---

### User Story 2 - Watch an algorithm solve a challenge step by step (Priority: P2)

A visitor selects a challenge and asks the app to solve it automatically. Instead of jumping straight to the finished board, the app plays back the solving process one step at a time (placing and, where relevant, removing pieces) so the user can follow how the solution was found.

**Why this priority**: This is the app's core teaching mechanism — turning an abstract algorithm into something observable — and is the main way the app delivers on "teaching combinatorial optimization." It depends on challenges and a board already existing (User Story 1), but does not depend on the user manually solving anything first.

**Independent Test**: Can be fully tested by selecting any challenge, triggering automatic solving, and confirming the app visibly replays a sequence of individual piece placement/removal steps that ends in a fully solved board — delivers the "watch the computer think" experience independently of manual play.

**Acceptance Scenarios**:

1. **Given** a challenge is selected, **When** the user starts automatic solving, **Then** the app shows the solving process unfold as a sequence of discrete visual steps rather than displaying the finished board immediately.
2. **Given** an automatic solve is playing, **When** the user pauses it, **Then** the step-by-step playback stops and the board stays at its current in-progress state until resumed.
3. **Given** an automatic solve is paused, **When** the user steps forward or backward one step at a time, **Then** the board updates to reflect exactly that one step's change (a single piece placed, removed, or a backtrack).
4. **Given** an automatic solve has completed, **When** the user reviews the result, **Then** the board is shown fully and validly solved, matching the same win condition as manual play.

---

### User Story 3 - Compare solving strategies and learn the concepts (Priority: P3)

A visitor who has watched one algorithm solve a challenge chooses a different solving strategy for the same (or another) challenge and compares how the two approaches behave — how many steps they take, whether they backtrack, and a short plain-language description of what each strategy is doing — connecting the visualization to combinatorial optimization ideas.

**Why this priority**: This is what elevates the app from "solver demo" to "teaching tool," but it is an enhancement layered on top of User Story 2 (a single algorithm already demonstrates step-by-step solving); comparison and explanatory framing add pedagogical depth once the core mechanism works.

**Independent Test**: Can be fully tested by running two different solving strategies on the same challenge and confirming the app displays distinguishable behavior and/or metrics (e.g., step count, backtrack count) and a description for each — delivers comparative, concept-linked learning value on its own.

**Acceptance Scenarios**:

1. **Given** a challenge is selected, **When** the user chooses a solving strategy from more than one available option, **Then** the app runs and visualizes that specific strategy.
2. **Given** an automatic solve is playing, **When** the user observes the playback, **Then** the app displays supporting information (such as current step count or number of backtracks) that relates the visualization to combinatorial optimization concepts.
3. **Given** the user has watched two different strategies solve the same challenge, **When** they compare the two runs, **Then** the app has shown visibly and/or numerically different solving behavior between the strategies.

---

### Edge Cases

- What happens when the user places a piece that fits geometrically but does not belong to the current challenge's required set of pieces?
- What happens if the user starts an automatic solve while they already have pieces placed manually on the board?
- What happens when the user switches to a different challenge while a manual attempt is still in progress and unsaved?
- How does the app behave if computing the first visible step of an automatic solve takes noticeably long (e.g., a large search space) — does the user get feedback that it is working rather than appearing frozen?
- What happens when a challenge has more than one valid way to fill the board — is any complete, non-overlapping, boundary-respecting arrangement of the required pieces accepted as solved, or only one canonical layout?
- How does the app behave on a small mobile screen where the board and the full set of pieces may not comfortably fit at once?
- What happens if the browser's local storage is unavailable or cleared — does completion progress degrade gracefully (e.g., reset to unsolved) rather than break the app?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide 500 distinct Katamino challenges, recreated from the official commercial Katamino challenge set, each defined by a board shape/size and a specific set of required pentomino pieces.
- **FR-002**: Users MUST be able to browse and select any of the 500 challenges to attempt.
- **FR-003**: For manual play, users MUST be able to select, rotate, and flip (mirror) each piece belonging to the current challenge, and place it onto the board.
- **FR-004**: The app MUST prevent placements that overlap another placed piece or fall outside the board, and MUST give immediate, clear visual feedback when a placement attempt is invalid.
- **FR-005**: The app MUST detect when the board is completely and validly filled by the challenge's required pieces and MUST clearly confirm successful completion to the user.
- **FR-006**: Users MUST be able to reset their current manual attempt at any time, clearing all placed pieces for that challenge.
- **FR-007**: The app MUST track, per challenge, whether the user has completed it, and MUST persist that completion status across visits on the same device/browser without requiring an account.
- **FR-008**: As an alternative to manual play, users MUST be able to trigger an automatic solver for the currently selected challenge.
- **FR-009**: The app MUST offer exactly two distinct solving strategies, representing different combinatorial optimization approaches — (a) an exhaustive backtracking search that tries placements and undoes them on dead ends, and (b) a constraint-guided/heuristic search that prunes the search space more aggressively (e.g., prioritizing the most constrained board region or piece) — and MUST let the user choose which one to run.
- **FR-010**: The automatic solver MUST reveal its process as a sequence of discrete, visually distinguishable steps (e.g., a piece being placed, or removed during backtracking) rather than jumping directly to the finished board.
- **FR-011**: Users MUST be able to control playback of an automatic solve: play/pause, step forward one step, step backward one step, and reset to the beginning.
- **FR-012**: Users MUST be able to adjust the playback speed of an automatic solve.
- **FR-013**: While an automatic solve is playing, the app MUST display supporting information that connects the visualization to combinatorial optimization concepts (e.g., step count, number of backtracks/dead-ends, a short description of the strategy currently running).
- **FR-014**: Every one of the 500 challenges MUST be solvable by the app's automatic solver(s).
- **FR-015**: The app MUST be fully usable when hosted as a static site with no server-side backend — all challenge data, game logic, and solving algorithms MUST run in the user's browser. *(Required by the "hosted on github.io" constraint in the input.)*
- **FR-016**: The app MUST be usable on both desktop and mobile/touch browsers for manual play and for watching automatic solves.
- **FR-017**: The app MUST present explanatory content connecting what the user sees on screen to combinatorial optimization concepts, written in plain, non-technical language for a general audience (no assumed programming/algorithms background).
- **FR-018**: The app MUST support both Portuguese and English for its interface and educational content, and MUST let the user switch between the two languages.

### Key Entities

- **Challenge**: One of the 500 puzzles; has a number/identifier, a board shape/size, a required set of pentomino pieces, a difficulty indicator, and a per-user completion status.
- **Piece (Pentomino)**: One of the standard pentomino shapes used by Katamino; has an identity/color and, during play, a current orientation (rotation/flip) and position (or "unplaced").
- **Board**: The grid for the currently selected challenge; tracks which cells are occupied and by which piece.
- **Manual Attempt**: The user's in-progress or completed manual placement of pieces for a challenge, including validity state.
- **Solving Strategy (Algorithm)**: A named, distinct approach the automatic solver can use; has a short description of how it searches for a solution.
- **Solve Run**: One execution of a chosen Solving Strategy against a Challenge; an ordered sequence of Solve Steps plus summary metrics (e.g., total steps, backtrack count).
- **Solve Step**: A single unit of the Solve Run's playback — a piece placed, a piece removed/backtracked, identified by its position in the sequence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can open the app and begin manually attempting any of the 500 challenges within 10 seconds, with no account creation or setup required.
- **SC-002**: 100% of the 500 challenges can be automatically solved and replayed step by step by the app.
- **SC-003**: Users can tell, from watching the visualizations alone, that two different solving strategies behave differently (e.g., different step counts or backtracking patterns) without reading external documentation.
- **SC-004**: A returning visitor's challenge-completion progress is still present when they reopen the app on the same device, with no account creation involved.
- **SC-005**: The app becomes interactive (ready for the user to pick a challenge and start playing) within 3 seconds on a typical broadband connection.
- **SC-006**: A user who has never used the app before can, unaided, distinguish an "invalid placement" from a "valid placement" within their first attempt at placing a piece, based on the app's visual feedback alone.
- **SC-007**: A user can complete a full step-by-step playback of an automatic solve for a typical challenge, or skip directly to the finished board, without the interaction taking more than a few seconds of active waiting for the first step to appear.
- **SC-008**: A visitor can switch the app between Portuguese and English at any time and see the interface and educational content fully reflect that choice.

## Assumptions

- Any complete, non-overlapping, boundary-respecting arrangement of a challenge's required pieces that fully fills the board counts as a valid solution — Katamino challenges may have more than one correct layout, and the app does not require matching one single canonical answer.
- No user accounts or server-side backend exist; challenge-completion progress is stored locally in the user's browser, consistent with static GitHub Pages hosting.
- Manual play has no time limit or competitive scoring; the focus is puzzle-solving and learning rather than speed.
- The 500 challenges vary in difficulty (e.g., board size and number of required pieces), consistent with how the physical Katamino game progresses from simpler to harder puzzles.
- Step-by-step automatic playback starts at a moderate default speed, adjustable per FR-012.
- The 500 challenge board/piece definitions are recreated from the official commercial Katamino challenge set; this recreates puzzle mechanics (board dimensions, required pieces per challenge) and does not require reusing any proprietary Katamino branding, artwork, or packaging text.
- The intended audience is general/casual visitors rather than algorithms specialists, so explanatory content favors plain language over formal computer-science terminology; the app supports Portuguese and English.
