/**
 * Unit tests against shipped sudoku/board.js (Java Sudoku helper parity).
 * Run: node sudoku/test/board.test.js
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

// --- init structure ---

test("createBoard: 9 super-cells × 9 cells, each with hints 1–9 visible", function () {
  var board = Board.createBoard();
  assert.strictEqual(board.superCells.length, 9);
  for (var s = 0; s < 9; s++) {
    assert.strictEqual(board.superCells[s].length, 9);
    for (var c = 0; c < 9; c++) {
      var cell = Board.getCell(board, s, c);
      assert.strictEqual(Board.isFilled(cell), false);
      assert.strictEqual(Board.visibleHintCount(cell), 9);
      var snap = Board.cellSnapshot(cell);
      assert.deepStrictEqual(snap.marks, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  }
  assert.strictEqual(board.highlightValue, null);
});

// --- left-click: hide only that mark ---

test("LEFT click hides only the target mark in that cell", function () {
  var board = Board.createBoard();
  var ok = Board.handleClick(board, Board.CLICK_TYPE.LEFT, 5, 0, 0);
  assert.strictEqual(ok, true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 5), false);
  // Other marks in same cell remain
  for (var d = 1; d <= 9; d++) {
    if (d === 5) continue;
    assert.strictEqual(Board.hasVisibleHint(board, 0, 0, d), true, "mark " + d);
  }
  // Same mark still visible in a different cell
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 5), true);
  assert.strictEqual(Board.hasVisibleHint(board, 1, 0, 5), true);
});

test("LEFT click on already-hidden mark is no-op", function () {
  var board = Board.createBoard();
  Board.handleClick(board, Board.CLICK_TYPE.LEFT, 3, 2, 4);
  var ok = Board.handleClick(board, Board.CLICK_TYPE.LEFT, 3, 2, 4);
  assert.strictEqual(ok, false);
  assert.strictEqual(Board.visibleHintCount(Board.getCell(board, 2, 4)), 8);
});

// --- right-click: USER + peer clear ---

test("RIGHT click places USER and clears digit from box/row/col peers", function () {
  var board = Board.createBoard();
  // Place 7 as USER in super-cell 0 (top-left box), cell 0 (top-left of box)
  // Board position (row 0, col 0)
  var ok = Board.handleClick(board, Board.CLICK_TYPE.RIGHT, 7, 0, 0);
  assert.strictEqual(ok, true);

  var placed = Board.getCell(board, 0, 0);
  assert.strictEqual(Board.isFilled(placed), true);
  assert.strictEqual(placed.value, 7);
  assert.strictEqual(placed.type, Board.CELL_TYPE.USER);

  // Box peers (super 0, cells 1–8): 7 hidden
  for (var i = 1; i < 9; i++) {
    assert.strictEqual(
      Board.hasVisibleHint(board, 0, i, 7),
      false,
      "box peer cell " + i
    );
  }

  // Row peers: boxes 1 and 2 (same box-row), cells in row 0 of each box
  // (cells 0,1,2 within those boxes share cell-row 0 with cell 0)
  for (var s = 1; s <= 2; s++) {
    for (var c = 0; c <= 2; c++) {
      assert.strictEqual(
        Board.hasVisibleHint(board, s, c, 7),
        false,
        "row peer s=" + s + " c=" + c
      );
    }
  }

  // Col peers: boxes 3 and 6 (same box-col), cells with cell-col 0 (0,3,6)
  for (var s2 = 3; s2 <= 6; s2 += 3) {
    for (var r = 0; r < 3; r++) {
      var cellIdx = r * 3 + 0;
      assert.strictEqual(
        Board.hasVisibleHint(board, s2, cellIdx, 7),
        false,
        "col peer s=" + s2 + " c=" + cellIdx
      );
    }
  }

  // Unrelated cell (e.g. bottom-right of board) still has 7
  assert.strictEqual(Board.hasVisibleHint(board, 8, 8, 7), true);
  // Another mark in a peer cell is untouched
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 1), true);
});

// --- middle-click: GIVEN + peer clear ---

test("MIDDLE click places GIVEN with same peer clear", function () {
  var board = Board.createBoard();
  // super 4 (center box), cell 4 (center cell) → board center
  var ok = Board.handleClick(board, Board.CLICK_TYPE.MIDDLE, 9, 4, 4);
  assert.strictEqual(ok, true);

  var placed = Board.getCell(board, 4, 4);
  assert.strictEqual(placed.value, 9);
  assert.strictEqual(placed.type, Board.CELL_TYPE.GIVEN);

  // Box peers
  for (var i = 0; i < 9; i++) {
    if (i === 4) continue;
    assert.strictEqual(Board.hasVisibleHint(board, 4, i, 9), false);
  }

  // placeValue path also used via placeValue API
  var board2 = Board.createBoard();
  assert.strictEqual(
    Board.placeValue(board2, 8, 8, 2, Board.CELL_TYPE.GIVEN),
    true
  );
  assert.strictEqual(Board.getCell(board2, 8, 8).type, Board.CELL_TYPE.GIVEN);
  assert.strictEqual(Board.hasVisibleHint(board2, 8, 0, 2), false);
});

// --- filled cell rejects further edits ---

test("filled cell rejects further place/eliminate", function () {
  var board = Board.createBoard();
  Board.handleClick(board, Board.CLICK_TYPE.RIGHT, 1, 1, 1);

  assert.strictEqual(
    Board.handleClick(board, Board.CLICK_TYPE.LEFT, 2, 1, 1),
    false
  );
  assert.strictEqual(
    Board.handleClick(board, Board.CLICK_TYPE.RIGHT, 3, 1, 1),
    false
  );
  assert.strictEqual(
    Board.handleClick(board, Board.CLICK_TYPE.MIDDLE, 4, 1, 1),
    false
  );
  assert.strictEqual(
    Board.placeValue(board, 1, 1, 5, Board.CELL_TYPE.USER),
    false
  );
  assert.strictEqual(Board.hideHint(board, 1, 1, 6), false);

  var cell = Board.getCell(board, 1, 1);
  assert.strictEqual(cell.value, 1);
  assert.strictEqual(cell.type, Board.CELL_TYPE.USER);
});

// --- reset ---

test("reset restores full pencil marks", function () {
  var board = Board.createBoard();
  Board.handleClick(board, Board.CLICK_TYPE.LEFT, 4, 0, 0);
  Board.handleClick(board, Board.CLICK_TYPE.RIGHT, 5, 3, 2);
  Board.handleClick(board, Board.CLICK_TYPE.MIDDLE, 6, 8, 8);
  Board.setHighlight(board, 5);

  Board.resetBoard(board);

  assert.strictEqual(board.highlightValue, null);
  for (var s = 0; s < 9; s++) {
    for (var c = 0; c < 9; c++) {
      var cell = Board.getCell(board, s, c);
      assert.strictEqual(Board.isFilled(cell), false);
      assert.strictEqual(Board.visibleHintCount(cell), 9);
    }
  }
});

// --- highlight set ---

test("getHighlightTargets returns HINT and FILLED matches", function () {
  var board = Board.createBoard();
  // Hide 8 in one cell so it won't be in highlight as HINT there
  Board.handleClick(board, Board.CLICK_TYPE.LEFT, 8, 0, 0);
  // Place 8 as USER elsewhere
  Board.handleClick(board, Board.CLICK_TYPE.RIGHT, 8, 8, 0);

  Board.setHighlight(board, 8);
  var targets = Board.getHighlightTargets(board);
  assert.ok(targets.length > 0);

  var kinds = { HINT: 0, FILLED: 0 };
  var sawFilledAt80 = false;
  var sawHidden00 = false;
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    kinds[t.kind]++;
    assert.strictEqual(t.value, 8);
    if (t.superCell === 8 && t.cell === 0 && t.kind === "FILLED") {
      sawFilledAt80 = true;
      assert.strictEqual(t.type, Board.CELL_TYPE.USER);
    }
    if (t.superCell === 0 && t.cell === 0) {
      sawHidden00 = true;
    }
  }
  assert.strictEqual(sawFilledAt80, true);
  assert.strictEqual(sawHidden00, false, "hidden mark must not highlight");
  assert.ok(kinds.HINT > 0, "some pencil marks of 8 still highlighted");
  assert.strictEqual(kinds.FILLED, 1);

  Board.setHighlight(board, null);
  assert.deepStrictEqual(Board.getHighlightTargets(board), []);
});

// --- peer clear geometry for a non-corner cell ---

test("peer clear for mid-box cell uses correct row/col boxes", function () {
  var board = Board.createBoard();
  // super 1 (top-middle box), cell 5 (row1 col2 of box → board row 1, col 5)
  Board.placeValue(board, 1, 5, 3, Board.CELL_TYPE.USER);

  // Same box peers cleared
  assert.strictEqual(Board.hasVisibleHint(board, 1, 0, 3), false);
  assert.strictEqual(Board.hasVisibleHint(board, 1, 8, 3), false);

  // Box-row peers: super 0 and 2; cell-row of 5 is floor(5/3)=1 → cells 3,4,5
  assert.strictEqual(Board.hasVisibleHint(board, 0, 3, 3), false);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 4, 3), false);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 5, 3), false);
  // cell 0 in super 0 is different cell-row → still has 3
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 3), true);

  // Box-col peers: super 1%3=1 → supers 4 and 7; cell-col of 5 is 5%3=2 → cells 2,5,8
  assert.strictEqual(Board.hasVisibleHint(board, 4, 2, 3), false);
  assert.strictEqual(Board.hasVisibleHint(board, 4, 5, 3), false);
  assert.strictEqual(Board.hasVisibleHint(board, 4, 8, 3), false);
  assert.strictEqual(Board.hasVisibleHint(board, 7, 2, 3), false);
  // cell 0 in super 4 is col 0 → still has 3
  assert.strictEqual(Board.hasVisibleHint(board, 4, 0, 3), true);
});

// --- summary ---

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) {
  process.exit(1);
}
