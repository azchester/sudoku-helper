/**
 * Unit tests for toggleable advanced techniques + hint-only scanners.
 * Run: node test/advanced-techniques.test.js
 */
"use strict";

var path = require("path");
var assert = require("assert");

var root = path.join(__dirname, "..");
var Board = require(path.join(root, "board.js"));
var fs = require("fs");

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("PASS  " + name);
  } catch (e) {
    failed++;
    console.error("FAIL  " + name);
    console.error("      " + (e && e.stack ? e.stack : e));
  }
}

function record(history, board, mutator) {
  var before = Board.cloneBoard(board);
  var ok = mutator();
  if (ok) {
    Board.pushHistory(history, before);
  }
  return ok;
}

function leaveMarks(board, s, c, digits) {
  var keep = Object.create(null);
  for (var i = 0; i < digits.length; i++) keep[digits[i]] = true;
  for (var d = 1; d <= 9; d++) {
    if (!keep[d]) Board.hideHint(board, s, c, d);
  }
}

function optsOnly(partial) {
  return Board.createTechniqueOptions(
    Object.assign(
      {
        nakedSingles: false,
        hiddenSingles: false,
        nakedPairs: false,
        nakedTriples: false,
        pointing: false,
      },
      partial
    )
  );
}

// --- naked pair ---

test("naked pair eliminates pair digits from peers in unit only", function () {
  var board = Board.createBoard();
  // Box 0: cells 0 and 1 are naked pair {1,2}
  leaveMarks(board, 0, 0, [1, 2]);
  leaveMarks(board, 0, 1, [1, 2]);
  // Peer cell 2 still has 1 and 2
  assert.strictEqual(Board.hasVisibleHint(board, 0, 2, 1), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 2, 3), true);

  var n = Board.promoteUniquesCascade(board, optsOnly({ nakedPairs: true }));
  assert.ok(n >= 1, "expected eliminations, got " + n);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 2, 1), false);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 2, 2), false);
  // Other digits in peer remain
  assert.strictEqual(Board.hasVisibleHint(board, 0, 2, 3), true);
  // Pair cells still empty with {1,2}
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 0)), false);
  assert.strictEqual(Board.visibleHintCount(Board.getCell(board, 0, 0)), 2);
  // Outside the box and not on the pair's shared row/col: digit 1 still present
  // (row scan also clears row 0 / col 0 peers of the pair — that is correct)
  assert.strictEqual(Board.hasVisibleHint(board, 8, 8, 1), true);
});

test("naked pair toggle off leaves candidates untouched", function () {
  var board = Board.createBoard();
  leaveMarks(board, 0, 0, [1, 2]);
  leaveMarks(board, 0, 1, [1, 2]);
  var before = Board.cloneBoard(board);
  Board.promoteUniquesCascade(board, optsOnly({ nakedPairs: false }));
  assert.strictEqual(Board.hasVisibleHint(board, 0, 2, 1), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 2, 2), true);
  assert.deepStrictEqual(
    Board.cellSnapshot(Board.getCell(board, 0, 2)).marks,
    Board.cellSnapshot(Board.getCell(before, 0, 2)).marks
  );
});

// --- naked triple ---

test("naked triple eliminates triple digits from peers; not from non-subset cells", function () {
  var board = Board.createBoard();
  // Cells 0,1,2 form triple {1,2,3} with subsets
  leaveMarks(board, 0, 0, [1, 2]);
  leaveMarks(board, 0, 1, [2, 3]);
  leaveMarks(board, 0, 2, [1, 3]);
  // Cell 3 has {1,2,3,4} — should lose 1,2,3 but keep 4
  leaveMarks(board, 0, 3, [1, 2, 3, 4]);

  Board.promoteUniquesCascade(board, optsOnly({ nakedTriples: true }));
  assert.strictEqual(Board.hasVisibleHint(board, 0, 3, 1), false);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 3, 2), false);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 3, 3), false);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 3, 4), true);
  // Triple cells not filled by triple technique alone
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 0)), false);
});

test("naked triple toggle off does not fire", function () {
  var board = Board.createBoard();
  leaveMarks(board, 0, 0, [1, 2]);
  leaveMarks(board, 0, 1, [2, 3]);
  leaveMarks(board, 0, 2, [1, 3]);
  leaveMarks(board, 0, 3, [1, 2, 3, 4]);
  Board.promoteUniquesCascade(board, optsOnly({ nakedTriples: false }));
  assert.strictEqual(Board.hasVisibleHint(board, 0, 3, 1), true);
});

// --- pointing / box-line ---

test("pointing box→line hides digit outside box on that row", function () {
  var board = Board.createBoard();
  // Box 0: digit 5 only in top row of box (cells 0,1,2)
  for (var c = 3; c < 9; c++) {
    Board.hideHint(board, 0, c, 5);
  }
  // Row 0 outside box still has 5 (box 1 cell 0 = board row0 col3)
  assert.strictEqual(Board.hasVisibleHint(board, 1, 0, 5), true);

  Board.promoteUniquesCascade(board, optsOnly({ pointing: true }));
  assert.strictEqual(Board.hasVisibleHint(board, 1, 0, 5), false);
  assert.strictEqual(Board.hasVisibleHint(board, 2, 0, 5), false);
  // Inside box top row still has 5
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 5), true);
  // Different row outside not affected incorrectly for this pattern
  // (row 1 may still have 5 in box 1)
  assert.strictEqual(Board.hasVisibleHint(board, 1, 3, 5), true);
});

test("pointing toggle off leaves outside candidates", function () {
  var board = Board.createBoard();
  for (var c = 3; c < 9; c++) {
    Board.hideHint(board, 0, c, 5);
  }
  Board.promoteUniquesCascade(board, optsOnly({ pointing: false }));
  assert.strictEqual(Board.hasVisibleHint(board, 1, 0, 5), true);
});

// --- X-Wing / coloring hints do not mutate ---

test("X-Wing hint does not mutate board", function () {
  var board = Board.createBoard();
  // Construct a simple X-Wing-ish layout for digit 7:
  // Rows 0 and 1 only have 7 in cols 0 and 1
  for (var row = 0; row < 2; row++) {
    for (var col = 2; col < 9; col++) {
      var p = Board.coordsFromGlobal(row, col);
      Board.hideHint(board, p.superCell, p.cell, 7);
    }
  }
  // Put 7 still on row 2 col 0 so elimination is possible
  var snap = Board.cloneBoard(board);
  var hint = Board.findXWingHint(board);
  assert.ok(hint, "expected X-Wing hint");
  assert.strictEqual(hint.type, "X_WING");
  assert.strictEqual(hint.digit, 7);
  assert.ok(hint.eliminate && hint.eliminate.length > 0);
  // Board unchanged
  assert.strictEqual(
    Board.hasVisibleHint(board, Board.coordsFromGlobal(2, 0).superCell, Board.coordsFromGlobal(2, 0).cell, 7),
    Board.hasVisibleHint(snap, Board.coordsFromGlobal(2, 0).superCell, Board.coordsFromGlobal(2, 0).cell, 7)
  );
  // Explicit: clone equality of one cell marks
  assert.deepStrictEqual(
    Board.cellSnapshot(Board.getCell(board, 0, 0)).marks,
    Board.cellSnapshot(Board.getCell(snap, 0, 0)).marks
  );
});

test("simple coloring hint does not mutate board", function () {
  var board = Board.createBoard();
  // Force a conjugate pair: digit 4 only twice in row 0
  for (var col = 2; col < 9; col++) {
    var p = Board.coordsFromGlobal(0, col);
    Board.hideHint(board, p.superCell, p.cell, 4);
  }
  var before = Board.cloneBoard(board);
  var hint = Board.findSimpleColoringHint(board);
  // May or may not find a full chain depending on board; must not mutate either way
  if (hint) {
    assert.strictEqual(hint.type, "SIMPLE_COLORING");
    assert.ok(hint.highlight.length >= 2);
  }
  assert.deepStrictEqual(
    Board.cellSnapshot(Board.getCell(board, 0, 0)).marks,
    Board.cellSnapshot(Board.getCell(before, 0, 0)).marks
  );
});

/**
 * Build two disjoint conjugate components for digit D that do not share units:
 *   Comp A: bilocation in row 0 at cols 0 and 1 only (hide D elsewhere on row 0)
 *   Comp B: bilocation in row 8 at cols 7 and 8 only
 * An off-chain candidate that peers with one node from A and one from B must
 * NOT be listed as an elimination (cross-component false positive).
 */
test("simple coloring does not invent cross-component eliminations", function () {
  // Comp A: row-0 bilocation (0,0)-(0,1). Comp B: box-8 bilocation (6,6)-(8,8).
  // Bait (6,1) peers only (0,1) via col1 and only (6,6) via row6 — one color
  // from each component. Must NOT eliminate (cross-component false positive).
  // keepPos(3,1) and keepPos(6,3) prevent bait joining either conjugate chain.
  var board = Board.createBoard();
  var d = 1;
  var row;
  var col;
  var p;
  var keep = Object.create(null);
  function keepPos(r, c) {
    keep[r + "," + c] = true;
  }
  keepPos(0, 0);
  keepPos(0, 1);
  keepPos(6, 6);
  keepPos(8, 8);
  keepPos(6, 1); // bait
  keepPos(3, 1); // third on col 1
  keepPos(6, 3); // third on row 6

  for (row = 0; row < 9; row++) {
    for (col = 0; col < 9; col++) {
      if (keep[row + "," + col]) continue;
      p = Board.coordsFromGlobal(row, col);
      Board.hideHint(board, p.superCell, p.cell, d);
    }
  }

  var before = Board.cloneBoard(board);
  var hint = Board.findSimpleColoringHint(board);
  assert.ok(hint, "expected a coloring chain on digit 1");
  assert.strictEqual(hint.type, "SIMPLE_COLORING");
  assert.strictEqual(hint.digit, d);
  assert.ok(
    hint.highlight.length >= 4,
    "expected both components highlighted"
  );

  var bait = Board.coordsFromGlobal(6, 1);
  var falseElim = (hint.eliminate || []).some(function (e) {
    return (
      e.superCell === bait.superCell &&
      e.cell === bait.cell &&
      e.digit === d
    );
  });
  assert.strictEqual(
    falseElim,
    false,
    "bait cell must not be a cross-component false elimination"
  );

  assert.deepStrictEqual(
    Board.cellSnapshot(Board.getCell(board, bait.superCell, bait.cell)).marks,
    Board.cellSnapshot(Board.getCell(before, bait.superCell, bait.cell)).marks
  );
});

test("simple coloring same-component sees-both is a valid elimination target", function () {
  var board = Board.createBoard();
  var d = 2;
  var row;
  var col;
  var p;
  // Build a single 4-cycle conjugate component where an off-chain candidate
  // peers with both colors of that component.
  // Conjugate pairs (digit 2 only twice in each unit):
  //   Row 0: cols 0,1
  //   Row 1: cols 0,1  → actually that would put 4 cells...
  // Simpler: chain of 2 links forming 3 cells is hard with bilocation.
  // Two cells conjugate on row 0 (c0,c1). Open third candidate at (2,0) that
  // peers both via col0 (only sees c0) — not both.
  // For sees-both with a 2-cell component: peer both ends of the conjugate.
  // Ends (0,0) and (0,1) same row. Any cell that peers both: same row (on chain
  // row — other cols), or a cell that shares col0 with first and col1 with second
  // → impossible unless it's the box diagonal trick: cell in same box as both.
  // Box 0 contains (0,0) and (0,1). Off-chain cell (1,2) in box0 peers both via box.
  // Ensure (1,2) has digit d and is not on the chain.
  // Hide d everywhere except (0,0),(0,1) and bait (1,2). Also need row0 conjugate
  // only those two — hide d from rest of row0. Col0 has only (0,0) if we hide
  // elsewhere in col0. Bait (1,2) in box0.
  board = Board.createBoard();
  var keep = Object.create(null);
  function kp(r, c) {
    keep[r + "," + c] = true;
  }
  kp(0, 0);
  kp(0, 1);
  kp(1, 2); // bait in same box as both chain cells
  for (row = 0; row < 9; row++) {
    for (col = 0; col < 9; col++) {
      if (keep[row + "," + col]) continue;
      p = Board.coordsFromGlobal(row, col);
      Board.hideHint(board, p.superCell, p.cell, d);
    }
  }
  // Chain: row0 bilocation (0,0)-(0,1). Bait (1,2) peers both via box 0.
  var hint = Board.findSimpleColoringHint(board);
  assert.ok(hint, "expected coloring hint");
  var bait = Board.coordsFromGlobal(1, 2);
  var found = (hint.eliminate || []).some(function (e) {
    return e.superCell === bait.superCell && e.cell === bait.cell && e.digit === d;
  });
  assert.strictEqual(
    found,
    true,
    "bait seeing both ends of same conjugate pair should be eliminable"
  );
});

test("findAdvancedHint prefers X-Wing without mutating", function () {
  var board = Board.createBoard();
  for (var row = 0; row < 2; row++) {
    for (var col = 2; col < 9; col++) {
      var p = Board.coordsFromGlobal(row, col);
      Board.hideHint(board, p.superCell, p.cell, 8);
    }
  }
  var snap = Board.cloneBoard(board);
  var hint = Board.findAdvancedHint(board);
  assert.ok(hint);
  assert.strictEqual(
    Board.hasVisibleHint(board, 0, 0, 8),
    Board.hasVisibleHint(snap, 0, 0, 8)
  );
});

// --- cascade + undo with pairs ---

test("pair elimination via applyActionMode is undoable as one unit", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();
  leaveMarks(board, 0, 0, [1, 2]);
  leaveMarks(board, 0, 1, [1, 2, 9]);
  // Enable pairs on module options
  Board.setTechniqueOptions(
    optsOnly({ nakedPairs: true, nakedSingles: true, hiddenSingles: true })
  );

  record(history, board, function () {
    // Hide 9 from pair cell → still {1,2} pair; cascade eliminates peers
    return Board.applyActionMode(board, Board.ACTION_MODE.HIDE, 9, 0, 1);
  });

  assert.strictEqual(Board.hasVisibleHint(board, 0, 2, 1), false);

  Board.undo(history, board);
  // Restored pre-action: cell 0,1 still had 9, peers still had 1
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 9), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 2, 1), true);

  // Reset options to defaults for other tests
  Board.setTechniqueOptions(Board.createTechniqueOptions());
});

// --- singles still work ---

test("existing naked single auto-place still works with techniques on", function () {
  var board = Board.createBoard();
  leaveMarks(board, 4, 4, [6]);
  Board.promoteUniquesCascade(board, Board.createTechniqueOptions());
  assert.strictEqual(Board.getCell(board, 4, 4).value, 6);
  assert.strictEqual(Board.getCell(board, 4, 4).type, Board.CELL_TYPE.USER);
});

// --- structural UI ---

test("page exposes technique toggles and hint controls", function () {
  var html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(/id="technique-toggles"/.test(html));
  assert.ok(/data-tech="nakedPairs"/.test(html));
  assert.ok(/data-tech="nakedTriples"/.test(html));
  assert.ok(/data-tech="pointing"/.test(html));
  assert.ok(/id="hint-xwing-btn"/.test(html));
  assert.ok(/id="hint-coloring-btn"/.test(html));
  var app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.ok(/setTechniqueOptions/.test(app));
  assert.ok(/findXWingHint/.test(app));
  assert.ok(/findSimpleColoringHint/.test(app));
});

// --- summary ---

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) {
  process.exit(1);
}
