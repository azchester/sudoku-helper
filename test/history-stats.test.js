/**
 * Unit tests for shipped undo/redo history and digit frequency (board.js).
 * Run: node test/history-stats.test.js
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

// --- empty undo/redo no-ops ---

test("empty undo/redo return false and leave board unchanged", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();
  assert.strictEqual(Board.canUndo(history), false);
  assert.strictEqual(Board.canRedo(history), false);
  assert.strictEqual(Board.undo(history, board), false);
  assert.strictEqual(Board.redo(history, board), false);
  assert.strictEqual(Board.visibleHintCount(Board.getCell(board, 0, 0)), 9);
});

// --- hide → place → undo twice restores ---

test("hide then place; undo twice restores prior states", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();

  assert.strictEqual(
    record(history, board, function () {
      return Board.handleClick(board, Board.CLICK_TYPE.LEFT, 5, 0, 0);
    }),
    true
  );
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 5), false);

  assert.strictEqual(
    record(history, board, function () {
      return Board.handleClick(board, Board.CLICK_TYPE.RIGHT, 7, 1, 1);
    }),
    true
  );
  assert.strictEqual(Board.getCell(board, 1, 1).value, 7);
  assert.strictEqual(Board.getCell(board, 1, 1).type, Board.CELL_TYPE.USER);

  // Undo place → still missing mark 5 in (0,0)
  assert.strictEqual(Board.undo(history, board), true);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 1, 1)), false);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 5), false);

  // Undo hide → mark 5 restored
  assert.strictEqual(Board.undo(history, board), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 5), true);
  assert.strictEqual(Board.canUndo(history), false);
});

// --- redo re-applies ---

test("redo re-applies undone hide and place", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();

  record(history, board, function () {
    return Board.handleClick(board, Board.CLICK_TYPE.LEFT, 3, 2, 2);
  });
  record(history, board, function () {
    return Board.handleClick(board, Board.CLICK_TYPE.MIDDLE, 4, 0, 4);
  });

  Board.undo(history, board);
  Board.undo(history, board);
  assert.strictEqual(Board.hasVisibleHint(board, 2, 2, 3), true);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 4)), false);

  assert.strictEqual(Board.redo(history, board), true);
  assert.strictEqual(Board.hasVisibleHint(board, 2, 2, 3), false);

  assert.strictEqual(Board.redo(history, board), true);
  assert.strictEqual(Board.getCell(board, 0, 4).value, 4);
  assert.strictEqual(Board.getCell(board, 0, 4).type, Board.CELL_TYPE.GIVEN);
  assert.strictEqual(Board.canRedo(history), false);
});

// --- new edit after undo drops redo branch ---

test("new edit after undo clears redo branch", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();

  record(history, board, function () {
    return Board.handleClick(board, Board.CLICK_TYPE.LEFT, 1, 0, 0);
  });
  record(history, board, function () {
    return Board.handleClick(board, Board.CLICK_TYPE.LEFT, 2, 0, 0);
  });

  Board.undo(history, board);
  assert.strictEqual(Board.canRedo(history), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 2), true);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 1), false);

  // New edit on different path
  record(history, board, function () {
    return Board.handleClick(board, Board.CLICK_TYPE.LEFT, 9, 8, 8);
  });
  assert.strictEqual(Board.canRedo(history), false);
  assert.strictEqual(Board.redo(history, board), false);
  assert.strictEqual(Board.hasVisibleHint(board, 8, 8, 9), false);
  // Prior undone hide of 2 stays undone
  assert.strictEqual(Board.hasVisibleHint(board, 0, 0, 2), true);
});

// --- New Game is undoable ---

test("New Game/reset is recorded; undo restores previous board", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();

  record(history, board, function () {
    return Board.placeValue(board, 0, 0, 1, Board.CELL_TYPE.USER);
  });
  assert.strictEqual(Board.getCell(board, 0, 0).value, 1);

  record(history, board, function () {
    Board.resetBoard(board);
    return true;
  });
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 0)), false);
  assert.strictEqual(Board.visibleHintCount(Board.getCell(board, 0, 0)), 9);

  assert.strictEqual(Board.undo(history, board), true);
  assert.strictEqual(Board.getCell(board, 0, 0).value, 1);
});

// --- peer clear survives undo restore ---

test("undo after place restores peer pencil marks", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();

  record(history, board, function () {
    return Board.placeValue(board, 0, 0, 7, Board.CELL_TYPE.USER);
  });
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 7), false);
  assert.strictEqual(Board.hasVisibleHint(board, 1, 0, 7), false);

  Board.undo(history, board);
  assert.strictEqual(Board.hasVisibleHint(board, 0, 1, 7), true);
  assert.strictEqual(Board.hasVisibleHint(board, 1, 0, 7), true);
  assert.strictEqual(Board.isFilled(Board.getCell(board, 0, 0)), false);
});

// --- digit frequency ---

test("digitFrequency: after N placements placed=N remaining=9-N", function () {
  var board = Board.createBoard();
  var freq0 = Board.digitFrequency(board);
  assert.strictEqual(freq0.length, 9);
  for (var i = 0; i < 9; i++) {
    assert.strictEqual(freq0[i].digit, i + 1);
    assert.strictEqual(freq0[i].placed, 0);
    assert.strictEqual(freq0[i].remaining, 9);
    assert.strictEqual(freq0[i].complete, false);
  }

  // Place digit 5 in three non-conflicting cells (different boxes/rows/cols enough)
  // Use placeValue on cells that won't block each other for counting
  Board.placeValue(board, 0, 0, 5, Board.CELL_TYPE.USER);
  Board.placeValue(board, 1, 3, 5, Board.CELL_TYPE.GIVEN);
  Board.placeValue(board, 2, 6, 5, Board.CELL_TYPE.USER);

  var s5 = Board.digitStats(board, 5);
  assert.strictEqual(s5.placed, 3);
  assert.strictEqual(s5.remaining, 6);
  assert.strictEqual(s5.complete, false);

  // Hidden marks do not count as placed
  Board.hideHint(board, 8, 8, 5);
  assert.strictEqual(Board.digitStats(board, 5).placed, 3);
});

test("nine placements of D mark complete; undo unmarks; reset zeros", function () {
  var board = Board.createBoard();
  var history = Board.createHistory();

  // Place digit 8 in all 9 cells of super-cell 0 (helper allows invalid puzzles).
  for (var i = 0; i < 9; i++) {
    (function (cellIdx) {
      record(history, board, function () {
        return Board.placeValue(
          board,
          0,
          cellIdx,
          8,
          Board.CELL_TYPE.USER
        );
      });
    })(i);
  }

  // All nine cells in super-cell 0 filled with 8
  var complete = Board.digitStats(board, 8);
  assert.strictEqual(complete.placed, 9, "expected 9 placed, got " + complete.placed);
  assert.strictEqual(complete.remaining, 0);
  assert.strictEqual(complete.complete, true);
  assert.strictEqual(Board.isDigitComplete(board, 8), true);

  // Undo one placement → not complete
  assert.strictEqual(Board.undo(history, board), true);
  var afterUndo = Board.digitStats(board, 8);
  assert.strictEqual(afterUndo.placed, 8);
  assert.strictEqual(afterUndo.remaining, 1);
  assert.strictEqual(afterUndo.complete, false);

  // Reset zeros all
  record(history, board, function () {
    Board.resetBoard(board);
    return true;
  });
  var afterReset = Board.digitFrequency(board);
  for (var d = 0; d < 9; d++) {
    assert.strictEqual(afterReset[d].placed, 0);
    assert.strictEqual(afterReset[d].remaining, 9);
    assert.strictEqual(afterReset[d].complete, false);
  }
});

// --- core board still works (regression smoke) ---

test("core LEFT/RIGHT/MIDDLE and peer clear still work", function () {
  var board = Board.createBoard();
  assert.strictEqual(
    Board.handleClick(board, Board.CLICK_TYPE.LEFT, 2, 3, 3),
    true
  );
  assert.strictEqual(Board.hasVisibleHint(board, 3, 3, 2), false);

  assert.strictEqual(
    Board.handleClick(board, Board.CLICK_TYPE.RIGHT, 6, 4, 4),
    true
  );
  assert.strictEqual(Board.getCell(board, 4, 4).type, Board.CELL_TYPE.USER);
  assert.strictEqual(Board.hasVisibleHint(board, 4, 0, 6), false);

  var board2 = Board.createBoard();
  assert.strictEqual(
    Board.handleClick(board2, Board.CLICK_TYPE.MIDDLE, 1, 8, 8),
    true
  );
  assert.strictEqual(Board.getCell(board2, 8, 8).type, Board.CELL_TYPE.GIVEN);
});

// --- summary ---

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed > 0) {
  process.exit(1);
}
