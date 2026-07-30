/**
 * Unit tests for naked-single auto-place (exactly one mark left in a cell).
 * Run: node test/naked-single.test.js
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
 * Hide all marks in one cell except keepDigit, using low-level hideHint (no cascade).
 */
function leaveOnlyMarkInCell(board, superCell, cell, keepDigit) {
  for (var d = 1; d <= 9; d++) {
    if (d === keepDigit) continue;
    Board.hideHint(board, superCell, cell, d);
  }
}

// --- naked single promotes ---

test("cell with exactly one visible mark promotes to USER", function () {
  var board = Board.createBoard();
  leaveOnlyMarkInCell(board, 0, 0, 6);
  assert.strictEqual(Board.visibleHintCount(Board.getCell(board, 0, 0)), 1);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 6), true);

  var n = Board.promoteUniquesCascade(board);
  assert.ok(n >= 1, "expected promotion, got " + n);
  var cell = Board.getCell(board, 0, 0);
  assert.strictEqual(cell.value, 6);
  assert.strictEqual(cell.type, Board.CELL_TYPE.USER);
  // Peer clear
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 6), false);
  assert.strictEqual(Board.hasVisibleHint(board, 1, 0, 6), false);
});

test("HIDE last extra mark in cell triggers promote via applyActionMode", function () {
  var board = Board.createBoard();
  // Leave only 3 and 8 in cell (0,2)
  for (var d = 1; d <= 9; d++) {
    if (d === 3 || d === 8) continue;
    Board.hideHint(board, 0, 2, d);
  }
  assert.strictEqual(Board.visibleHintCount(Board.getCell(board, 0, 2)), 2);

  // Hide 8 via real path → only 3 remains → naked single promote
  var ok = Board.applyActionMode(board, Board.ACTION_MODE.HIDE, 8, 0, 2);
  assert.strictEqual(ok, true);
  assert.strictEqual(Board.getCell(board, 0, 2).value, 3);
  assert.strictEqual(Board.getCell(board, 0, 2).type, Board.CELL_TYPE.USER);
});

// --- non-promote when ≥2 marks ---

test("cell with two or more marks is not auto-filled by naked-single rule", function () {
  var board = Board.createBoard();
  // Leave three marks: 1, 2, 3
  for (var d = 4; d <= 9; d++) {
    Board.hideHint(board, 4, 4, d);
  }
  assert.strictEqual(Board.visibleHintCount(Board.getCell(board, 4, 4)), 3);

  // findNextNakedSingle should not pick this cell
  var naked = Board.findNextNakedSingle(board);
  if (naked) {
    assert.ok(
      !(naked.superCell === 4 && naked.cell === 4),
      "must not promote cell with 3 marks"
    );
  }
  // Force cascade — cell 4,4 must stay empty unless unit-unique rule hits another digit
  Board.promoteUniquesCascade(board);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 4, 4)), false);
  assert.strictEqual(Board.visibleHintCount(Board.getCell(board, 4, 4)), 3);
});

// --- findNextNakedSingle API ---

test("findNextNakedSingle returns sole mark digit", function () {
  var board = Board.createBoard();
  leaveOnlyMarkInCell(board, 2, 5, 9);
  var next = Board.findNextNakedSingle(board);
  assert.ok(next);
  assert.strictEqual(next.superCell, 2);
  assert.strictEqual(next.cell, 5);
  assert.strictEqual(next.digit, 9);
});

// --- cascade: naked single + unit unique feed each other ---

test("naked single cascade can create unit-unique promotions", function () {
  var board = Board.createBoard();
  // Cell (0,0): only mark 1 → will naked-promote to 1
  leaveOnlyMarkInCell(board, 0, 0, 1);
  // In box 0, leave digit 2 only in cell 8 (cells 1–7 and 0 lose 2 as hints except
  // cell 0 already has no 2). After placing 1, peer clear of 1 may not alone make
  // 2 unique — set up 2 unique in box now:
  for (var c = 1; c < 8; c++) {
    Board.hideHint(board, 0, c, 2);
  }
  // cell 0 no longer has 2; cell 8 still has 2; cells 1-7 no 2 → unit unique 2 in cell 8
  // Also cell 0 has only 1 → naked single

  var n = Board.promoteUniquesCascade(board);
  assert.ok(n >= 2, "expected ≥2 promotions, got " + n);
  assert.strictEqual(Board.getCell(board, 0, 0).value, 1);
  assert.strictEqual(Board.getCell(board, 0, 8).value, 2);
  assert.strictEqual(Board.getCell(board, 0, 0).type, Board.CELL_TYPE.USER);
  assert.strictEqual(Board.getCell(board, 0, 8).type, Board.CELL_TYPE.USER);
});

// --- history + stats ---

test("one undo reverts naked-single promote; stats match", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();

  // Two marks left: 4 and 5
  for (var d = 1; d <= 9; d++) {
    if (d === 4 || d === 5) continue;
    Board.hideHint(board, 1, 1, d);
  }

  record(history, board, function () {
    return Board.applyActionMode(board, Board.ACTION_MODE.HIDE, 5, 1, 1);
  });

  assert.strictEqual(Board.getCell(board, 1, 1).value, 4);
  var placed = Board.digitStats(board, 4).placed;
  assert.ok(placed >= 1);

  assert.strictEqual(Board.undo(history, board), true);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 1, 1)), false);
  assert.strictEqual(Board.hasVisibleHint(board, 1, 1, 4), true);
  assert.strictEqual(Board.hasVisibleHint(board, 1, 1, 5), true);
  assert.strictEqual(Board.digitStats(board, 4).placed, 0);
});

// --- GIVEN not used ---

test("naked single auto-fill is USER not GIVEN", function () {
  var board = Board.createBoard();
  leaveOnlyMarkInCell(board, 8, 8, 7);
  Board.promoteUniquesCascade(board);
  assert.strictEqual(Board.getCell(board, 8, 8).type, Board.CELL_TYPE.USER);
  assert.notStrictEqual(Board.getCell(board, 8, 8).type, Board.CELL_TYPE.GIVEN);
});

// --- cascade hook on real mutation path ---

test("handleClick/applyActionMode invokes cascade (naked single on path)", function () {
  var board = Board.createBoard();
  for (var d = 1; d <= 9; d++) {
    if (d === 2 || d === 3) continue;
    Board.hideHint(board, 3, 3, d);
  }
  // Real path hides 3 → only 2 left
  Board.handleClick(board, Board.CLICK_TYPE.LEFT, 3, 3, 3);
  assert.strictEqual(Board.getCell(board, 3, 3).value, 2);
});

// --- summary ---

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) {
  process.exit(1);
}
