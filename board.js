/**
 * Pure Sudoku helper board logic ported from the Java Swing app
 * (com.aaron.sudoku.components: Grid, SuperCell, Cell, CellValue).
 *
 * Layout: 9 super-cells (3×3 boxes) × 9 cells each. Empty cells hold
 * pencil marks 1–9. Left-click hides a mark; right-click places USER (black);
 * middle-click places GIVEN (blue). Placing clears that digit from peers in
 * the same box, row, and column. Filled cells reject further edits.
 */
(function (root) {
  "use strict";

  var CELL_TYPE = {
    GIVEN: "GIVEN",
    USER: "USER",
    HINT: "HINT",
  };

  var CLICK_TYPE = {
    LEFT: "LEFT",
    RIGHT: "RIGHT",
    MIDDLE: "MIDDLE",
  };

  /** UI action modes for primary-click on a pencil mark (replaces mouse-button status). */
  var ACTION_MODE = {
    HIDE: "HIDE",
    USER: "USER",
    GIVEN: "GIVEN",
  };

  var ACTION_MODES = [ACTION_MODE.HIDE, ACTION_MODE.USER, ACTION_MODE.GIVEN];

  function isActionMode(mode) {
    return (
      mode === ACTION_MODE.HIDE ||
      mode === ACTION_MODE.USER ||
      mode === ACTION_MODE.GIVEN
    );
  }

  /**
   * Map UI action mode to legacy click type (for handleClick compatibility).
   */
  function modeToClickType(mode) {
    if (mode === ACTION_MODE.HIDE) return CLICK_TYPE.LEFT;
    if (mode === ACTION_MODE.USER) return CLICK_TYPE.RIGHT;
    if (mode === ACTION_MODE.GIVEN) return CLICK_TYPE.MIDDLE;
    return null;
  }

  /**
   * Apply the selected number-status mode to a visible pencil mark (primary path).
   * HIDE → hideHint; USER → place USER; GIVEN → place GIVEN.
   * @returns {boolean} true if board state changed
   */
  function applyActionMode(board, mode, digit, superCell, cell) {
    if (!isActionMode(mode)) {
      return false;
    }
    return handleClick(board, modeToClickType(mode), digit, superCell, cell);
  }

  /**
   * Create a fresh empty board: 9 boxes, each with 9 cells of hints 1–9.
   * @returns {object} board state
   */
  function createBoard() {
    var superCells = [];
    for (var s = 0; s < 9; s++) {
      var cells = [];
      for (var c = 0; c < 9; c++) {
        cells.push(createEmptyCell());
      }
      superCells.push(cells);
    }
    return {
      superCells: superCells,
      highlightValue: null,
    };
  }

  function createEmptyCell() {
    var hints = [];
    for (var i = 1; i <= 9; i++) {
      hints.push({ value: i, visible: true });
    }
    return {
      value: null,
      type: null,
      hints: hints,
    };
  }

  function getCell(board, superCell, cell) {
    return board.superCells[superCell][cell];
  }

  function isFilled(cell) {
    return cell.value !== null && cell.value !== undefined;
  }

  /**
   * Hide a single pencil mark in one empty cell (left-click).
   * No-op if the cell is already filled or the mark is already hidden.
   * @returns {boolean} true if a mark was hidden
   */
  function hideHint(board, superCell, cell, digit) {
    var c = getCell(board, superCell, cell);
    if (isFilled(c)) {
      return false;
    }
    for (var i = 0; i < c.hints.length; i++) {
      if (c.hints[i].value === digit && c.hints[i].visible) {
        c.hints[i].visible = false;
        return true;
      }
    }
    return false;
  }

  /**
   * Hide digit from all empty cells in the same box except the placed cell.
   */
  function clearBoxPeers(board, superCell, cell, digit) {
    var cells = board.superCells[superCell];
    for (var i = 0; i < 9; i++) {
      if (i !== cell) {
        hideHint(board, superCell, i, digit);
      }
    }
  }

  /**
   * Clear digit from cells in the same row across other boxes in the box-row.
   * Java SuperCell.clearRow + Grid row loop.
   */
  function clearRowPeers(board, superCell, cell, digit) {
    var boxRow = Math.floor(superCell / 3);
    var cellRow = Math.floor(cell / 3);
    for (var s = 0; s < 9; s++) {
      if (s === superCell) continue;
      if (Math.floor(s / 3) !== boxRow) continue;
      for (var i = 0; i < 9; i++) {
        if (Math.floor(i / 3) === cellRow) {
          hideHint(board, s, i, digit);
        }
      }
    }
  }

  /**
   * Clear digit from cells in the same column across other boxes in the box-col.
   * Java SuperCell.clearCol + Grid col loop.
   */
  function clearColPeers(board, superCell, cell, digit) {
    var boxCol = superCell % 3;
    var cellCol = cell % 3;
    for (var s = 0; s < 9; s++) {
      if (s === superCell) continue;
      if (s % 3 !== boxCol) continue;
      for (var i = 0; i < 9; i++) {
        if (i % 3 === cellCol) {
          hideHint(board, s, i, digit);
        }
      }
    }
  }

  /**
   * Place a digit as GIVEN or USER and clear peers (right/middle click).
   * No-op if the cell is already filled.
   * @returns {boolean} true if the value was placed
   */
  function placeValue(board, superCell, cell, digit, cellType) {
    var c = getCell(board, superCell, cell);
    if (isFilled(c)) {
      return false;
    }
    if (cellType !== CELL_TYPE.GIVEN && cellType !== CELL_TYPE.USER) {
      return false;
    }
    c.value = digit;
    c.type = cellType;
    // Hints become irrelevant once filled; leave them in place for snapshot
    // but filled cells render value only.
    clearBoxPeers(board, superCell, cell, digit);
    clearRowPeers(board, superCell, cell, digit);
    clearColPeers(board, superCell, cell, digit);
    return true;
  }

  /**
   * Handle a click on a pencil mark (only HINT digits are clickable in Java).
   * After a successful hide/place, auto-promotes unique remaining hints.
   * @param {string} clickType LEFT | RIGHT | MIDDLE
   * @returns {boolean} true if board state changed
   */
  function handleClick(board, clickType, digit, superCell, cell) {
    var c = getCell(board, superCell, cell);
    if (isFilled(c)) {
      return false;
    }
    // Only interact with a currently visible mark of that digit
    var visible = false;
    for (var i = 0; i < c.hints.length; i++) {
      if (c.hints[i].value === digit && c.hints[i].visible) {
        visible = true;
        break;
      }
    }
    if (!visible) {
      return false;
    }

    var changed = false;
    if (clickType === CLICK_TYPE.LEFT) {
      changed = hideHint(board, superCell, cell, digit);
    } else if (clickType === CLICK_TYPE.RIGHT) {
      changed = placeValue(board, superCell, cell, digit, CELL_TYPE.USER);
    } else if (clickType === CLICK_TYPE.MIDDLE) {
      changed = placeValue(board, superCell, cell, digit, CELL_TYPE.GIVEN);
    }
    if (changed) {
      promoteUniquesCascade(board);
    }
    return changed;
  }

  /** Global board row 0–8 from super-cell + cell-in-box indices. */
  function globalRow(superCell, cell) {
    return Math.floor(superCell / 3) * 3 + Math.floor(cell / 3);
  }

  /** Global board column 0–8 from super-cell + cell-in-box indices. */
  function globalCol(superCell, cell) {
    return (superCell % 3) * 3 + (cell % 3);
  }

  function coordsFromGlobal(row, col) {
    var superCell = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    var cell = (row % 3) * 3 + (col % 3);
    return { superCell: superCell, cell: cell };
  }

  /**
   * Find empty cells that still show digit D as a visible pencil mark.
   * @returns {Array<{superCell:number, cell:number}>}
   */
  function locationsWithVisibleDigit(board, digit) {
    var out = [];
    for (var s = 0; s < 9; s++) {
      for (var c = 0; c < 9; c++) {
        if (hasVisibleHint(board, s, c, digit)) {
          out.push({ superCell: s, cell: c });
        }
      }
    }
    return out;
  }

  /**
   * If digit appears as a visible hint in exactly one empty cell among the
   * given list of positions, return that position; otherwise null.
   */
  function uniqueLocationAmong(board, digit, positions) {
    var found = null;
    var count = 0;
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      if (hasVisibleHint(board, p.superCell, p.cell, digit)) {
        count++;
        found = p;
        if (count > 1) return null;
      }
    }
    return count === 1 ? found : null;
  }

  function boxPositions(superCell) {
    var out = [];
    for (var c = 0; c < 9; c++) {
      out.push({ superCell: superCell, cell: c });
    }
    return out;
  }

  function rowPositions(row) {
    var out = [];
    for (var col = 0; col < 9; col++) {
      out.push(coordsFromGlobal(row, col));
    }
    return out;
  }

  function colPositions(col) {
    var out = [];
    for (var row = 0; row < 9; row++) {
      out.push(coordsFromGlobal(row, col));
    }
    return out;
  }

  /**
   * Naked single: empty cell with exactly one visible pencil mark.
   * @returns {{superCell:number, cell:number, digit:number}|null}
   */
  function findNextNakedSingle(board) {
    for (var s = 0; s < 9; s++) {
      for (var c = 0; c < 9; c++) {
        var cell = getCell(board, s, c);
        if (isFilled(cell)) continue;
        var sole = null;
        var count = 0;
        for (var h = 0; h < cell.hints.length; h++) {
          if (cell.hints[h].visible) {
            count++;
            sole = cell.hints[h].value;
            if (count > 1) break;
          }
        }
        if (count === 1) {
          return { superCell: s, cell: c, digit: sole };
        }
      }
    }
    return null;
  }

  /**
   * Scan boxes, rows, and columns for digits with exactly one remaining visible
   * pencil mark in that unit. Returns the first promotion found, or null.
   * @returns {{superCell:number, cell:number, digit:number}|null}
   */
  function findNextUniquePromotion(board) {
    var d;
    var s;
    var r;
    var col;
    var loc;

    // Super-cells (boxes)
    for (s = 0; s < 9; s++) {
      for (d = 1; d <= 9; d++) {
        loc = uniqueLocationAmong(board, d, boxPositions(s));
        if (loc) {
          return { superCell: loc.superCell, cell: loc.cell, digit: d };
        }
      }
    }

    // Full board rows
    for (r = 0; r < 9; r++) {
      for (d = 1; d <= 9; d++) {
        loc = uniqueLocationAmong(board, d, rowPositions(r));
        if (loc) {
          return { superCell: loc.superCell, cell: loc.cell, digit: d };
        }
      }
    }

    // Full board columns
    for (col = 0; col < 9; col++) {
      for (d = 1; d <= 9; d++) {
        loc = uniqueLocationAmong(board, d, colPositions(col));
        if (loc) {
          return { superCell: loc.superCell, cell: loc.cell, digit: d };
        }
      }
    }

    return null;
  }

  /**
   * Next auto-promotion candidate: naked single (one mark in cell) or
   * unique remaining digit in a box/row/col.
   * @returns {{superCell:number, cell:number, digit:number}|null}
   */
  function findNextPromotion(board) {
    var naked = findNextNakedSingle(board);
    if (naked) return naked;
    return findNextUniquePromotion(board);
  }

  /**
   * Promote at most one auto-place candidate to a USER placement.
   * @returns {boolean} true if a promotion was applied
   */
  function promoteNextUnique(board) {
    var next = findNextPromotion(board);
    if (!next) return false;
    return placeValue(
      board,
      next.superCell,
      next.cell,
      next.digit,
      CELL_TYPE.USER
    );
  }

  /**
   * Cascade auto-promotions until no naked singles or unique-in-unit remain
   * (fixed point). Bounded by 81 placements max. Returns number applied.
   */
  function promoteUniquesCascade(board) {
    var count = 0;
    var max = 81;
    while (count < max) {
      if (!promoteNextUnique(board)) break;
      count++;
    }
    return count;
  }

  /**
   * Set or clear board-wide highlight for a digit (hover).
   * @param {number|null} digit 1–9 or null to clear
   */
  function setHighlight(board, digit) {
    board.highlightValue = digit == null ? null : digit;
  }

  /**
   * Positions that should be highlighted for the current (or given) digit.
   * Returns array of { superCell, cell, kind: 'HINT'|'FILLED', value }.
   */
  function getHighlightTargets(board, digit) {
    var d = digit !== undefined ? digit : board.highlightValue;
    var out = [];
    if (d == null) {
      return out;
    }
    for (var s = 0; s < 9; s++) {
      for (var c = 0; c < 9; c++) {
        var cell = board.superCells[s][c];
        if (isFilled(cell)) {
          if (cell.value === d) {
            out.push({
              superCell: s,
              cell: c,
              kind: "FILLED",
              value: d,
              type: cell.type,
            });
          }
        } else {
          for (var h = 0; h < cell.hints.length; h++) {
            if (cell.hints[h].value === d && cell.hints[h].visible) {
              out.push({
                superCell: s,
                cell: c,
                kind: "HINT",
                value: d,
              });
              break;
            }
          }
        }
      }
    }
    return out;
  }

  /**
   * Reset board to initial all-pencil-marks state (New Game).
   */
  function resetBoard(board) {
    var fresh = createBoard();
    board.superCells = fresh.superCells;
    board.highlightValue = null;
    return board;
  }

  /**
   * Count visible pencil marks in an empty cell (0 if filled).
   */
  function visibleHintCount(cell) {
    if (isFilled(cell)) return 0;
    var n = 0;
    for (var i = 0; i < cell.hints.length; i++) {
      if (cell.hints[i].visible) n++;
    }
    return n;
  }

  /**
   * Snapshot of a cell useful for tests/render: filled value+type or list of visible marks.
   */
  function cellSnapshot(cell) {
    if (isFilled(cell)) {
      return { filled: true, value: cell.value, type: cell.type };
    }
    var marks = [];
    for (var i = 0; i < cell.hints.length; i++) {
      if (cell.hints[i].visible) {
        marks.push(cell.hints[i].value);
      }
    }
    return { filled: false, marks: marks };
  }

  /**
   * Whether digit is still a visible pencil mark in the cell.
   */
  function hasVisibleHint(board, superCell, cell, digit) {
    var c = getCell(board, superCell, cell);
    if (isFilled(c)) return false;
    for (var i = 0; i < c.hints.length; i++) {
      if (c.hints[i].value === digit && c.hints[i].visible) return true;
    }
    return false;
  }

  /**
   * Deep-clone board state (superCells + highlight) for undo snapshots.
   */
  function cloneBoard(board) {
    var superCells = [];
    for (var s = 0; s < 9; s++) {
      var cells = [];
      for (var c = 0; c < 9; c++) {
        var src = board.superCells[s][c];
        var hints = [];
        for (var h = 0; h < src.hints.length; h++) {
          hints.push({
            value: src.hints[h].value,
            visible: src.hints[h].visible,
          });
        }
        cells.push({
          value: src.value,
          type: src.type,
          hints: hints,
        });
      }
      superCells.push(cells);
    }
    return {
      superCells: superCells,
      highlightValue: board.highlightValue,
    };
  }

  /**
   * Replace board contents in-place from a snapshot (keeps board object identity).
   */
  function restoreBoard(board, snapshot) {
    var cloned = cloneBoard(snapshot);
    board.superCells = cloned.superCells;
    board.highlightValue = cloned.highlightValue;
    return board;
  }

  /**
   * Create a linear undo/redo history for a board.
   * push(before) must be called with a snapshot taken *before* a successful mutation.
   */
  function createHistory() {
    return {
      undoStack: [],
      redoStack: [],
    };
  }

  function canUndo(history) {
    return history.undoStack.length > 0;
  }

  function canRedo(history) {
    return history.redoStack.length > 0;
  }

  /**
   * Record pre-mutation snapshot. Clears redo branch (new edit after undo).
   */
  function pushHistory(history, beforeSnapshot) {
    history.undoStack.push(beforeSnapshot);
    history.redoStack = [];
  }

  /**
   * Undo last mutation: restore previous board; current state goes to redo.
   * @returns {boolean} true if undo applied
   */
  function undo(history, board) {
    if (!canUndo(history)) {
      return false;
    }
    var previous = history.undoStack.pop();
    history.redoStack.push(cloneBoard(board));
    restoreBoard(board, previous);
    return true;
  }

  /**
   * Redo previously undone mutation.
   * @returns {boolean} true if redo applied
   */
  function redo(history, board) {
    if (!canRedo(history)) {
      return false;
    }
    var next = history.redoStack.pop();
    history.undoStack.push(cloneBoard(board));
    restoreBoard(board, next);
    return true;
  }

  /**
   * Clear history stacks (e.g. after discarding redo-only state if needed).
   * Not required by New Game — New Game is itself a recorded mutation.
   */
  function clearHistory(history) {
    history.undoStack = [];
    history.redoStack = [];
  }

  /**
   * Digit frequency from filled GIVEN/USER cells only.
   * remaining = 9 − placed; complete when placed === 9.
   * @returns {Array<{digit:number, placed:number, remaining:number, complete:boolean}>}
   */
  function digitFrequency(board) {
    var placed = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // index 1–9
    for (var s = 0; s < 9; s++) {
      for (var c = 0; c < 9; c++) {
        var cell = board.superCells[s][c];
        if (isFilled(cell) && cell.value >= 1 && cell.value <= 9) {
          placed[cell.value]++;
        }
      }
    }
    var out = [];
    for (var d = 1; d <= 9; d++) {
      var p = placed[d];
      out.push({
        digit: d,
        placed: p,
        remaining: 9 - p,
        complete: p >= 9,
      });
    }
    return out;
  }

  /**
   * Stats for a single digit (1–9).
   */
  function digitStats(board, digit) {
    var all = digitFrequency(board);
    if (digit < 1 || digit > 9) {
      return { digit: digit, placed: 0, remaining: 9, complete: false };
    }
    return all[digit - 1];
  }

  function isDigitComplete(board, digit) {
    return digitStats(board, digit).complete;
  }

  /**
   * Map bare keyboard key to action mode: h→HIDE, u→USER, g→GIVEN.
   * @returns {string|null} ACTION_MODE value or null
   */
  function modeFromHotkey(key) {
    if (key == null) return null;
    var k = String(key).toLowerCase();
    if (k === "h") return ACTION_MODE.HIDE;
    if (k === "u") return ACTION_MODE.USER;
    if (k === "g") return ACTION_MODE.GIVEN;
    return null;
  }

  function cellKey(superCell, cell) {
    return superCell + "," + cell;
  }

  /**
   * Detect filled-cell digit conflicts in boxes, rows, and columns.
   * A conflict exists when two or more filled cells share the same digit
   * within one unit. Returns conflicting cells and involved units.
   *
   * @returns {{
   *   hasConflict: boolean,
   *   cells: Array<{superCell:number, cell:number, value:number}>,
   *   boxes: number[],
   *   rows: number[],
   *   cols: number[]
   * }}
   */
  function detectConflicts(board) {
    var cellMap = Object.create(null);
    var boxMap = Object.create(null);
    var rowMap = Object.create(null);
    var colMap = Object.create(null);

    function markConflictCells(list) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        cellMap[cellKey(p.superCell, p.cell)] = {
          superCell: p.superCell,
          cell: p.cell,
          value: p.value,
        };
      }
    }

    function checkUnit(positions, unitKind, unitIndex) {
      var byDigit = Object.create(null);
      for (var i = 0; i < positions.length; i++) {
        var p = positions[i];
        var cell = getCell(board, p.superCell, p.cell);
        if (!isFilled(cell)) continue;
        var d = cell.value;
        if (!byDigit[d]) byDigit[d] = [];
        byDigit[d].push({
          superCell: p.superCell,
          cell: p.cell,
          value: d,
        });
      }
      for (var digit in byDigit) {
        if (byDigit[digit].length >= 2) {
          markConflictCells(byDigit[digit]);
          if (unitKind === "box") boxMap[unitIndex] = true;
          else if (unitKind === "row") rowMap[unitIndex] = true;
          else if (unitKind === "col") colMap[unitIndex] = true;
        }
      }
    }

    var s;
    var r;
    var col;
    for (s = 0; s < 9; s++) {
      checkUnit(boxPositions(s), "box", s);
    }
    for (r = 0; r < 9; r++) {
      checkUnit(rowPositions(r), "row", r);
    }
    for (col = 0; col < 9; col++) {
      checkUnit(colPositions(col), "col", col);
    }

    var cells = [];
    for (var k in cellMap) {
      cells.push(cellMap[k]);
    }
    var boxes = [];
    for (s = 0; s < 9; s++) {
      if (boxMap[s]) boxes.push(s);
    }
    var rows = [];
    for (r = 0; r < 9; r++) {
      if (rowMap[r]) rows.push(r);
    }
    var cols = [];
    for (col = 0; col < 9; col++) {
      if (colMap[col]) cols.push(col);
    }

    return {
      hasConflict: cells.length > 0,
      cells: cells,
      boxes: boxes,
      rows: rows,
      cols: cols,
    };
  }

  /**
   * Whether a filled cell position is part of a conflict set.
   */
  function isConflictCell(conflicts, superCell, cell) {
    if (!conflicts || !conflicts.cells) return false;
    for (var i = 0; i < conflicts.cells.length; i++) {
      var c = conflicts.cells[i];
      if (c.superCell === superCell && c.cell === cell) return true;
    }
    return false;
  }

  var api = {
    CELL_TYPE: CELL_TYPE,
    CLICK_TYPE: CLICK_TYPE,
    ACTION_MODE: ACTION_MODE,
    ACTION_MODES: ACTION_MODES,
    isActionMode: isActionMode,
    modeToClickType: modeToClickType,
    modeFromHotkey: modeFromHotkey,
    applyActionMode: applyActionMode,
    detectConflicts: detectConflicts,
    isConflictCell: isConflictCell,
    createBoard: createBoard,
    createEmptyCell: createEmptyCell,
    getCell: getCell,
    isFilled: isFilled,
    hideHint: hideHint,
    placeValue: placeValue,
    handleClick: handleClick,
    setHighlight: setHighlight,
    getHighlightTargets: getHighlightTargets,
    resetBoard: resetBoard,
    visibleHintCount: visibleHintCount,
    cellSnapshot: cellSnapshot,
    hasVisibleHint: hasVisibleHint,
    clearBoxPeers: clearBoxPeers,
    clearRowPeers: clearRowPeers,
    clearColPeers: clearColPeers,
    globalRow: globalRow,
    globalCol: globalCol,
    coordsFromGlobal: coordsFromGlobal,
    findNextNakedSingle: findNextNakedSingle,
    findNextUniquePromotion: findNextUniquePromotion,
    findNextPromotion: findNextPromotion,
    promoteNextUnique: promoteNextUnique,
    promoteUniquesCascade: promoteUniquesCascade,
    cloneBoard: cloneBoard,
    restoreBoard: restoreBoard,
    createHistory: createHistory,
    canUndo: canUndo,
    canRedo: canRedo,
    pushHistory: pushHistory,
    undo: undo,
    redo: redo,
    clearHistory: clearHistory,
    digitFrequency: digitFrequency,
    digitStats: digitStats,
    isDigitComplete: isDigitComplete,
  };

  root.SudokuBoard = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
