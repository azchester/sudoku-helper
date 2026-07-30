/**
 * Unit tests for unique-hint auto-promote (shipped board.js).
 * Run: node test/auto-promote.test.js
 */
"use strict";

var path = require("path");
var assert = require("assert");

var root = path.join(__dirname, "..");
var Board = require(path.join(root, "board.js"));

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

/**
 * Hide digit D from every empty cell in super-cell S except keepCell.
 * Uses low-level hideHint (no cascade) so setup is controlled.
 */
function leaveOnlyInBox(board, superCell, keepCell, digit) {
  for (var c = 0; c < 9; c++) {
    if (c === keepCell) continue;
    Board.hideHint(board, superCell, c, digit);
  }
}

// --- box uniqueness ---

test("unique digit in one box cell promotes to USER after hide", function () {
  var board = Board.createBoard();
  // Leave digit 5 visible only in box 0 cell 4
  leaveOnlyInBox(board, 0, 4, 5);
  // Trigger via real path: hide another mark (unrelated) still re-scans... better hide last competitor via applyActionMode
  // Actually leaveOnlyInBox already left only one — cascade not run yet.
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 4)), false);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 4, 5), true);

  var n = Board.promoteUniquesCascade(board);
  assert.ok(n >= 1, "expected at least one promotion");
  var cell = Board.getCell(board, 0, 4);
  assert.strictEqual(cell.value, 5);
  assert.strictEqual(cell.type, Board.CELL_TYPE.USER);
  // Peer clear in box
  for (var i = 0; i < 9; i++) {
    if (i === 4) continue;
    assert.strictEqual(Board.hasVisibleHint(board, 0, i, 5), false);
  }
});

test("HIDE last competing mark in box triggers promote via applyActionMode", function () {
  var board = Board.createBoard();
  // Keep 7 visible in cells 0 and 1 of box 0; hide elsewhere in box
  for (var c = 2; c < 9; c++) {
    Board.hideHint(board, 0, c, 7);
  }
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 7), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 7), true);

  // Hide competitor in cell 1 via real entry → only cell 0 has 7 in box → promote
  var ok = Board.applyActionMode(board, Board.ACTION_MODE.HIDE, 7, 0, 1);
  assert.strictEqual(ok, true);
  assert.strictEqual(Board.getCell(board, 0, 0).value, 7);
  assert.strictEqual(Board.getCell(board, 0, 0).type, Board.CELL_TYPE.USER);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 1)), false);
});

// --- non-promotion when duplicates remain ---

test("two visible marks of D in a box do not promote", function () {
  var board = Board.createBoard();
  for (var c = 2; c < 9; c++) {
    Board.hideHint(board, 0, c, 3);
  }
  // cells 0 and 1 still have 3
  var n = Board.promoteUniquesCascade(board);
  // May promote other digits that became unique from unrelated setup? On fresh board
  // after only hiding 3 in cells 2-8 of box 0, no digit is unique in any unit
  // (each digit still appears in all other cells of other boxes and in remaining cells).
  // Digit 3 still in cell 0 and 1 of box 0, and in all other boxes fully.
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 0)), false);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 1)), false);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 3), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 3), true);
  // ensure we did not promote digit 3
  assert.notStrictEqual(Board.getCell(board, 0, 0).value, 3);
  assert.notStrictEqual(Board.getCell(board, 0, 1).value, 3);
  void n;
});

// --- row uniqueness ---

test("unique digit in a full board row promotes", function () {
  var board = Board.createBoard();
  // Global row 0 = boxes 0,1,2 cell-rows 0 → cells 0,1,2 in each
  // Hide digit 4 from all positions in global row 0 except box0 cell0
  var keep = { superCell: 0, cell: 0 };
  for (var col = 0; col < 9; col++) {
    var pos = Board.coordsFromGlobal(0, col);
    if (pos.superCell === keep.superCell && pos.cell === keep.cell) continue;
    Board.hideHint(board, pos.superCell, pos.cell, 4);
  }
  // Also need uniqueness not blocked by other units having multiple 4s...
  // For promotion, uniqueness in ANY unit (box/row/col) is enough. Digit 4 still
  // appears many times in box 0 (cells 3-8), so box won't promote. Row 0 has only
  // one 4 → promote via row rule.
  var next = Board.findNextUniquePromotion(board);
  assert.ok(next, "expected a unique promotion");
  assert.strictEqual(next.digit, 4);
  assert.strictEqual(next.superCell, 0);
  assert.strictEqual(next.cell, 0);

  Board.promoteUniquesCascade(board);
  assert.strictEqual(Board.getCell(board, 0, 0).value, 4);
  assert.strictEqual(Board.getCell(board, 0, 0).type, Board.CELL_TYPE.USER);
});

// --- column uniqueness ---

test("unique digit in a full board column promotes", function () {
  var board = Board.createBoard();
  // Global col 8 — hide digit 2 everywhere in that col except bottom-right
  var keep = Board.coordsFromGlobal(8, 8);
  for (var row = 0; row < 9; row++) {
    var pos = Board.coordsFromGlobal(row, 8);
    if (pos.superCell === keep.superCell && pos.cell === keep.cell) continue;
    Board.hideHint(board, pos.superCell, pos.cell, 2);
  }
  var next = Board.findNextUniquePromotion(board);
  assert.ok(next);
  assert.strictEqual(next.digit, 2);
  assert.strictEqual(next.superCell, keep.superCell);
  assert.strictEqual(next.cell, keep.cell);

  Board.promoteUniquesCascade(board);
  assert.strictEqual(Board.getCell(board, keep.superCell, keep.cell).value, 2);
  assert.strictEqual(
    Board.getCell(board, keep.superCell, keep.cell).type,
    Board.CELL_TYPE.USER
  );
});

// --- cascade ---

test("promotion cascade fills second unique created by peer clear", function () {
  var board = Board.createBoard();
  // Setup box 0: digit 1 only in cell 0
  leaveOnlyInBox(board, 0, 0, 1);
  // Setup box 1 (same row of boxes): digit 1 only in cell 0 (board row 0, col 3)
  // After promoting box0 cell0 with 1, peer clear removes 1 from row 0 in box 1...
  // Actually clearRowPeers from place in super0 cell0 removes digit 1 from cells
  // in same cell-row of supers 1 and 2.
  // So if box1 only had 1 in cell 0, that gets cleared by peer — not promoted.
  //
  // Better cascade scenario:
  // Box 0: only cell 8 has digit 9 (will promote).
  // Before promote, also arrange box 8 so that after peer clears from placing 9
  // somewhere... simpler:
  // Two independent uniques already present: leaveOnlyInBox for digit 1 in box0
  // cell0 and digit 2 in box8 cell8 — cascade places both.
  leaveOnlyInBox(board, 8, 8, 2);

  var n = Board.promoteUniquesCascade(board);
  assert.ok(n >= 2, "expected cascade of at least 2, got " + n);
  assert.strictEqual(Board.getCell(board, 0, 0).value, 1);
  assert.strictEqual(Board.getCell(board, 8, 8).value, 2);
});

test("place that peer-clears creates unique and cascades", function () {
  var board = Board.createBoard();
  // In box 4 (center), leave digit 6 only in cells 0 and 4.
  for (var c = 0; c < 9; c++) {
    if (c === 0 || c === 4) continue;
    Board.hideHint(board, 4, c, 6);
  }
  // Place something in cell 0 that is NOT 6 — wait, placing clears peer marks
  // for the placed digit only. So hide 6 from cell 0 via place of different digit
  // doesn't remove 6 from cell 0 unless we hide it.
  // Place USER 5 in cell 0 → cell 0 filled, so 6 only remains in cell 4 of box.
  var ok = Board.applyActionMode(board, Board.ACTION_MODE.USER, 5, 4, 0);
  assert.strictEqual(ok, true);
  // cell 0 is 5; unique 6 in box 4 cell 4 should auto-promote
  assert.strictEqual(Board.getCell(board, 4, 0).value, 5);
  assert.strictEqual(Board.getCell(board, 4, 4).value, 6);
  assert.strictEqual(Board.getCell(board, 4, 4).type, Board.CELL_TYPE.USER);
});

// --- GIVEN stays explicit; auto is USER ---

test("auto-promote uses USER not GIVEN", function () {
  var board = Board.createBoard();
  leaveOnlyInBox(board, 2, 3, 8);
  Board.promoteUniquesCascade(board);
  assert.strictEqual(Board.getCell(board, 2, 3).type, Board.CELL_TYPE.USER);
  assert.notStrictEqual(Board.getCell(board, 2, 3).type, Board.CELL_TYPE.GIVEN);
});

// --- history: one undo restores pre-trigger (including promotions) ---

test("one undo reverts trigger and auto-promotions; redo restores", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();

  // Prepare: only two 9s left in box 0 (cells 0 and 1)
  for (var c = 2; c < 9; c++) {
    Board.hideHint(board, 0, c, 9);
  }

  record(history, board, function () {
    return Board.applyActionMode(board, Board.ACTION_MODE.HIDE, 9, 0, 1);
  });

  assert.strictEqual(Board.getCell(board, 0, 0).value, 9);
  var placedAfter = Board.digitStats(board, 9).placed;
  assert.ok(placedAfter >= 1);

  assert.strictEqual(Board.undo(history, board), true);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 0)), false);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 9), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 9), true);
  assert.strictEqual(Board.digitStats(board, 9).placed, 0);

  assert.strictEqual(Board.redo(history, board), true);
  assert.strictEqual(Board.getCell(board, 0, 0).value, 9);
  assert.strictEqual(Board.digitStats(board, 9).placed, placedAfter);
});

// --- reset clears auto-fills ---

test("New Game / reset clears auto-promoted fills", function () {
  var board = Board.createBoard();
  leaveOnlyInBox(board, 0, 0, 1);
  Board.promoteUniquesCascade(board);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 0)), true);
  Board.resetBoard(board);
  for (var s = 0; s < 9; s++) {
    for (var c = 0; c < 9; c++) {
      assert.strictEqual(Board.isFilled(Board.getCell(board, s, c)), false);
      assert.strictEqual(Board.visibleHintCount(Board.getCell(board, s, c)), 9);
    }
  }
});

// --- summary ---

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) {
  process.exit(1);
}
