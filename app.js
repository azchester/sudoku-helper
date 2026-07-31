/**
 * DOM layer for the Sudoku helper. Binds mouse events to SudokuBoard pure logic.
 * Loaded after board.js; expects global SudokuBoard and a #board mount point.
 * Number status is selected via the left mode panel; primary click applies it.
 */
(function () {
  "use strict";

  var Board = typeof SudokuBoard !== "undefined" ? SudokuBoard : null;
  if (!Board) {
    console.error("SudokuBoard not loaded");
    return;
  }

  var state = Board.createBoard();
  var history = Board.createHistory();
  var selectedMode = Board.ACTION_MODE.HIDE;
  var boardEl = null;
  var statsEl = null;
  var modeSelectEl = null;
  var undoBtn = null;
  var redoBtn = null;
  var hintMessageEl = null;
  /** Tracks hover source so board-digit leave does not clear stats hover. */
  var highlightSource = null; // 'board' | 'stats' | null
  /** Active advanced hint (X-Wing / coloring) for DOM highlight; null when none. */
  var activeHint = null;

  function applyHighlights() {
    if (!boardEl) return;
    var hl = state.highlightValue;
    var marks = boardEl.querySelectorAll(".hint.visible, .cell-value");
    for (var i = 0; i < marks.length; i++) {
      var el = marks[i];
      var v = parseInt(el.getAttribute("data-value"), 10);
      var isMatch = hl != null && v === hl;
      if (el.classList.contains("hint")) {
        el.classList.toggle("highlight-hint", isMatch);
      } else {
        el.classList.toggle("highlight-filled", isMatch);
      }
    }
    applyTechniqueHintHighlights();
  }

  function hintKey(s, c, d) {
    return s + "," + c + "," + d;
  }

  function applyTechniqueHintHighlights() {
    if (!boardEl) return;
    var all = boardEl.querySelectorAll(
      ".hint.technique-hint, .hint.technique-elim, .cell-value.technique-hint"
    );
    var ai;
    for (ai = 0; ai < all.length; ai++) {
      all[ai].classList.remove("technique-hint", "technique-elim");
    }
    if (!activeHint) return;

    var elimSet = Object.create(null);
    var hlSet = Object.create(null);
    var e;
    if (activeHint.eliminate) {
      for (e = 0; e < activeHint.eliminate.length; e++) {
        var el0 = activeHint.eliminate[e];
        elimSet[hintKey(el0.superCell, el0.cell, el0.digit)] = true;
      }
    }
    if (activeHint.highlight) {
      for (e = 0; e < activeHint.highlight.length; e++) {
        var hl0 = activeHint.highlight[e];
        hlSet[hintKey(hl0.superCell, hl0.cell, hl0.digit)] = true;
      }
    }

    var nodes = boardEl.querySelectorAll(".hint.visible, .cell-value");
    for (e = 0; e < nodes.length; e++) {
      var node = nodes[e];
      var sc = node.getAttribute("data-super-cell");
      var cellAttr = node.getAttribute("data-cell");
      var dig = node.getAttribute("data-value");
      if (sc == null || dig == null) {
        // cell-value may only have data-value; parent cell has coords
        var parent = node.parentElement;
        if (parent) {
          sc = parent.getAttribute("data-super-cell");
          cellAttr = parent.getAttribute("data-cell");
        }
      }
      if (sc == null || cellAttr == null || dig == null) continue;
      var k = hintKey(sc, cellAttr, dig);
      if (elimSet[k]) {
        node.classList.add("technique-elim");
      } else if (hlSet[k]) {
        node.classList.add("technique-hint");
      }
    }
  }

  function setActiveHint(hint) {
    activeHint = hint;
    if (hintMessageEl) {
      if (hint && hint.message) {
        hintMessageEl.textContent = hint.message;
        hintMessageEl.classList.add("has-hint");
      } else {
        hintMessageEl.textContent = hint === null ? "" : "No pattern found.";
        hintMessageEl.classList.toggle("has-hint", false);
      }
    }
    applyTechniqueHintHighlights();
  }

  function syncTechniqueTogglesFromBoard() {
    var opts = Board.getTechniqueOptions();
    var root = document.getElementById("technique-toggles");
    if (!root) return;
    var inputs = root.querySelectorAll("input[data-tech]");
    for (var i = 0; i < inputs.length; i++) {
      var key = inputs[i].getAttribute("data-tech");
      if (opts[key] !== undefined) {
        inputs[i].checked = !!opts[key];
      }
    }
  }

  function onTechniqueToggleChange(e) {
    var input = e.target;
    if (!input || !input.getAttribute) return;
    var key = input.getAttribute("data-tech");
    if (!key) return;
    var partial = {};
    partial[key] = !!input.checked;
    Board.setTechniqueOptions(partial);
  }

  function updateHistoryButtons() {
    if (undoBtn) {
      undoBtn.disabled = !Board.canUndo(history);
    }
    if (redoBtn) {
      redoBtn.disabled = !Board.canRedo(history);
    }
  }

  function updateModeButtons() {
    if (!modeSelectEl) return;
    var buttons = modeSelectEl.querySelectorAll(".mode-btn");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var mode = btn.getAttribute("data-mode");
      var active = mode === selectedMode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-checked", active ? "true" : "false");
    }
    if (boardEl) {
      boardEl.setAttribute("data-action-mode", selectedMode);
    }
  }

  function setSelectedMode(mode) {
    if (!Board.isActionMode(mode)) {
      return false;
    }
    selectedMode = mode;
    updateModeButtons();
    return true;
  }

  function setHighlightFrom(source, digit) {
    highlightSource = digit == null ? null : source;
    Board.setHighlight(state, digit);
    applyHighlights();
  }

  function renderStats() {
    if (!statsEl) return;
    var freq = Board.digitFrequency(state);
    statsEl.innerHTML = "";
    statsEl.className = "stats-list";

    for (var i = 0; i < freq.length; i++) {
      var row = freq[i];
      var item = document.createElement("div");
      item.className = "stat-row" + (row.complete ? " complete" : "");
      item.setAttribute("data-digit", String(row.digit));
      item.setAttribute("data-placed", String(row.placed));
      item.setAttribute("data-remaining", String(row.remaining));
      if (row.complete) {
        item.setAttribute("data-complete", "true");
      }

      var digitEl = document.createElement("span");
      digitEl.className = "stat-digit";
      digitEl.textContent = String(row.digit);

      var countsEl = document.createElement("span");
      countsEl.className = "stat-counts";
      countsEl.innerHTML =
        '<span class="stat-placed" data-role="placed">' +
        row.placed +
        "</span>" +
        '<span class="stat-sep">/</span>' +
        '<span class="stat-remaining" data-role="remaining">' +
        row.remaining +
        "</span>" +
        '<span class="stat-labels"> placed · remaining</span>';

      var badge = document.createElement("span");
      badge.className = "stat-badge";
      badge.textContent = row.complete ? "Complete" : "";
      badge.setAttribute("aria-hidden", row.complete ? "false" : "true");

      item.appendChild(digitEl);
      item.appendChild(countsEl);
      item.appendChild(badge);
      statsEl.appendChild(item);
    }
  }

  function buildConflictLookup(conflicts) {
    var cells = Object.create(null);
    var boxes = Object.create(null);
    var rows = Object.create(null);
    var cols = Object.create(null);
    var i;
    if (!conflicts) {
      return { cells: cells, boxes: boxes, rows: rows, cols: cols };
    }
    for (i = 0; i < conflicts.cells.length; i++) {
      var c = conflicts.cells[i];
      cells[c.superCell + "," + c.cell] = true;
    }
    for (i = 0; i < conflicts.boxes.length; i++) {
      boxes[conflicts.boxes[i]] = true;
    }
    for (i = 0; i < conflicts.rows.length; i++) {
      rows[conflicts.rows[i]] = true;
    }
    for (i = 0; i < conflicts.cols.length; i++) {
      cols[conflicts.cols[i]] = true;
    }
    return { cells: cells, boxes: boxes, rows: rows, cols: cols };
  }

  function renderBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = "";
    boardEl.className = "grid";
    boardEl.setAttribute("data-action-mode", selectedMode);

    var conflicts = Board.detectConflicts(state);
    var cl = buildConflictLookup(conflicts);
    if (conflicts.hasConflict) {
      boardEl.classList.add("has-conflict");
    }

    for (var s = 0; s < 9; s++) {
      var box = document.createElement("div");
      box.className = "super-cell";
      box.setAttribute("data-super-cell", String(s));
      if (cl.boxes[s]) {
        box.classList.add("conflict");
        box.setAttribute("data-conflict", "true");
      }

      for (var c = 0; c < 9; c++) {
        var cell = Board.getCell(state, s, c);
        var cellEl = document.createElement("div");
        cellEl.className = "cell";
        cellEl.setAttribute("data-super-cell", String(s));
        cellEl.setAttribute("data-cell", String(c));

        var row = Board.globalRow(s, c);
        var col = Board.globalCol(s, c);
        cellEl.setAttribute("data-row", String(row));
        cellEl.setAttribute("data-col", String(col));
        if (cl.rows[row]) {
          cellEl.classList.add("conflict-row");
        }
        if (cl.cols[col]) {
          cellEl.classList.add("conflict-col");
        }

        if (Board.isFilled(cell)) {
          cellEl.classList.add("filled");
          var valEl = document.createElement("span");
          var isConflict = !!cl.cells[s + "," + c];
          valEl.className =
            "cell-value " +
            (cell.type === Board.CELL_TYPE.GIVEN ? "given" : "user") +
            (isConflict ? " conflict" : "");
          if (isConflict) {
            cellEl.classList.add("conflict");
            valEl.setAttribute("data-conflict", "true");
          }
          valEl.textContent = String(cell.value);
          valEl.setAttribute("data-value", String(cell.value));
          cellEl.appendChild(valEl);
        } else {
          cellEl.classList.add("empty");
          var hintsWrap = document.createElement("div");
          hintsWrap.className = "hints";
          for (var h = 0; h < 9; h++) {
            var hint = cell.hints[h];
            var mark = document.createElement("span");
            mark.className = "hint";
            mark.setAttribute("data-value", String(hint.value));
            mark.setAttribute("data-super-cell", String(s));
            mark.setAttribute("data-cell", String(c));
            if (hint.visible) {
              mark.textContent = String(hint.value);
              mark.classList.add("visible");
            } else {
              mark.classList.add("hidden");
              mark.textContent = "";
            }
            hintsWrap.appendChild(mark);
          }
          cellEl.appendChild(hintsWrap);
        }
        box.appendChild(cellEl);
      }
      boardEl.appendChild(box);
    }
    applyHighlights();
  }

  function render() {
    renderBoard();
    renderStats();
    updateHistoryButtons();
    updateModeButtons();
    applyTechniqueHintHighlights();
  }

  /**
   * Run a board mutation after pushing a pre-change snapshot if it succeeds.
   * @param {function(): boolean} mutator returns true when state changed
   */
  function withHistory(mutator) {
    var before = Board.cloneBoard(state);
    var changed = mutator();
    if (changed) {
      Board.pushHistory(history, before);
      render();
    }
    return changed;
  }

  function onHintMouseDown(e) {
    var target = e.target;
    if (!target || !target.classList || !target.classList.contains("hint")) {
      return;
    }
    if (!target.classList.contains("visible")) {
      return;
    }
    // Primary path: left button only applies selected mode (not right/middle).
    if (e.button !== 0) {
      e.preventDefault();
      return;
    }
    e.preventDefault();

    var digit = parseInt(target.getAttribute("data-value"), 10);
    var superCell = parseInt(target.getAttribute("data-super-cell"), 10);
    var cell = parseInt(target.getAttribute("data-cell"), 10);

    withHistory(function () {
      return Board.applyActionMode(
        state,
        selectedMode,
        digit,
        superCell,
        cell
      );
    });
  }

  function onHintContextMenu(e) {
    var target = e.target;
    if (target && target.classList && target.classList.contains("hint")) {
      e.preventDefault();
    }
  }

  function onDigitEnter(e) {
    var target = e.target;
    if (!target || !target.classList) return;
    var isHint =
      target.classList.contains("hint") && target.classList.contains("visible");
    var isFilled = target.classList.contains("cell-value");
    if (!isHint && !isFilled) return;
    var digit = parseInt(target.getAttribute("data-value"), 10);
    setHighlightFrom("board", digit);
  }

  function onDigitLeave(e) {
    var target = e.target;
    if (!target || !target.classList) return;
    var isHint = target.classList.contains("hint");
    var isFilled = target.classList.contains("cell-value");
    if (!isHint && !isFilled) return;
    var related = e.relatedTarget;
    if (
      related &&
      related.getAttribute &&
      related.getAttribute("data-value") === target.getAttribute("data-value") &&
      (related.classList.contains("hint") ||
        related.classList.contains("cell-value"))
    ) {
      return;
    }
    if (highlightSource === "board") {
      setHighlightFrom(null, null);
    }
  }

  function onStatsEnter(e) {
    var row = e.target.closest ? e.target.closest(".stat-row") : null;
    if (!row || !statsEl.contains(row)) return;
    var digit = parseInt(row.getAttribute("data-digit"), 10);
    if (!(digit >= 1 && digit <= 9)) return;
    setHighlightFrom("stats", digit);
  }

  function onStatsLeave(e) {
    var row = e.target.closest ? e.target.closest(".stat-row") : null;
    if (!row || !statsEl.contains(row)) return;
    var related = e.relatedTarget;
    if (related && statsEl.contains(related)) {
      var nextRow = related.closest ? related.closest(".stat-row") : null;
      if (nextRow && nextRow !== row) {
        // Moving to another stat row — enter will set new digit
        return;
      }
      if (nextRow === row) return;
    }
    if (highlightSource === "stats") {
      setHighlightFrom(null, null);
    }
  }

  function onModeClick(e) {
    var btn = e.target.closest ? e.target.closest(".mode-btn") : null;
    if (!btn && e.target.classList && e.target.classList.contains("mode-btn")) {
      btn = e.target;
    }
    if (!btn) return;
    e.preventDefault();
    setSelectedMode(btn.getAttribute("data-mode"));
  }

  function newGame() {
    withHistory(function () {
      Board.resetBoard(state);
      return true;
    });
  }

  function doUndo() {
    if (!Board.undo(history, state)) {
      return false;
    }
    render();
    return true;
  }

  function doRedo() {
    if (!Board.redo(history, state)) {
      return false;
    }
    render();
    return true;
  }

  function onKeyDown(e) {
    // Ignore when typing in form fields
    var tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) {
      return;
    }

    var mod = e.metaKey || e.ctrlKey;
    var key = e.key ? e.key.toLowerCase() : "";

    if (mod) {
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        doRedo();
      }
      return;
    }

    // Bare h / u / g → mode select
    var mode = Board.modeFromHotkey(key);
    if (mode) {
      e.preventDefault();
      setSelectedMode(mode);
    }
  }

  /* —— Theme (system / light / dark) —— */
  var THEME_KEY = "sudoku-theme";
  var THEME_ORDER = ["system", "light", "dark"];
  var themeMedia = null;

  function normalizeThemePref(pref) {
    if (pref === "light" || pref === "dark" || pref === "system") return pref;
    return "system";
  }

  function getThemePref() {
    try {
      return normalizeThemePref(localStorage.getItem(THEME_KEY) || "system");
    } catch (e) {
      return "system";
    }
  }

  function setThemePref(pref) {
    pref = normalizeThemePref(pref);
    try {
      if (pref === "system") {
        localStorage.removeItem(THEME_KEY);
      } else {
        localStorage.setItem(THEME_KEY, pref);
      }
    } catch (e) {
      /* private mode / blocked storage */
    }
    applyTheme(pref);
    return pref;
  }

  function resolveTheme(pref) {
    pref = normalizeThemePref(pref);
    if (pref === "light" || pref === "dark") return pref;
    if (window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  }

  function themeLabel(pref) {
    if (pref === "light") return "Light";
    if (pref === "dark") return "Dark";
    return "System";
  }

  function updateThemeToggle(pref, resolved) {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    var label = themeLabel(pref);
    var resolvedNote =
      pref === "system" ? " (currently " + resolved + ")" : "";
    btn.setAttribute("aria-label", "Theme: " + label);
    btn.title =
      "Theme: " +
      label +
      resolvedNote +
      ". Click to cycle System → Light → Dark.";
  }

  function applyTheme(pref) {
    pref = normalizeThemePref(pref);
    var resolved = resolveTheme(pref);
    var root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-theme-pref", pref);
    updateThemeToggle(pref, resolved);
  }

  function cycleTheme() {
    var current = getThemePref();
    var idx = THEME_ORDER.indexOf(current);
    if (idx < 0) idx = 0;
    var next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    return setThemePref(next);
  }

  function initTheme() {
    applyTheme(getThemePref());
    if (window.matchMedia) {
      themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (getThemePref() === "system") {
          applyTheme("system");
        }
      };
      if (themeMedia.addEventListener) {
        themeMedia.addEventListener("change", onChange);
      } else if (themeMedia.addListener) {
        themeMedia.addListener(onChange);
      }
    }
    var themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", function (e) {
        e.preventDefault();
        cycleTheme();
      });
    }
  }

  function init() {
    boardEl = document.getElementById("board");
    statsEl = document.getElementById("digit-stats");
    modeSelectEl = document.getElementById("mode-select");
    undoBtn = document.getElementById("undo-btn");
    redoBtn = document.getElementById("redo-btn");
    hintMessageEl = document.getElementById("hint-message");

    initTheme();

    if (!boardEl) {
      console.error("#board mount point missing");
      return;
    }

    boardEl.addEventListener("mousedown", onHintMouseDown);
    boardEl.addEventListener("contextmenu", onHintContextMenu);
    boardEl.addEventListener("mouseover", onDigitEnter);
    boardEl.addEventListener("mouseout", onDigitLeave);

    if (modeSelectEl) {
      modeSelectEl.addEventListener("click", onModeClick);
    }
    if (statsEl) {
      statsEl.addEventListener("mouseover", onStatsEnter);
      statsEl.addEventListener("mouseout", onStatsLeave);
    }

    var techRoot = document.getElementById("technique-toggles");
    if (techRoot) {
      techRoot.addEventListener("change", onTechniqueToggleChange);
      syncTechniqueTogglesFromBoard();
    }

    var xwingBtn = document.getElementById("hint-xwing-btn");
    if (xwingBtn) {
      xwingBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var hint = Board.findXWingHint(state);
        setActiveHint(hint);
        if (!hint && hintMessageEl) {
          hintMessageEl.textContent = "No X-Wing pattern found.";
        }
      });
    }
    var colorBtn = document.getElementById("hint-coloring-btn");
    if (colorBtn) {
      colorBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var hint = Board.findSimpleColoringHint(state);
        setActiveHint(hint);
        if (!hint && hintMessageEl) {
          hintMessageEl.textContent = "No simple coloring chain found.";
        }
      });
    }
    var clearHintBtn = document.getElementById("hint-clear-btn");
    if (clearHintBtn) {
      clearHintBtn.addEventListener("click", function (e) {
        e.preventDefault();
        setActiveHint(null);
      });
    }

    var newBtn = document.getElementById("new-game-btn");
    if (newBtn) {
      newBtn.addEventListener("click", function (e) {
        e.preventDefault();
        newGame();
      });
    }
    if (undoBtn) {
      undoBtn.addEventListener("click", function (e) {
        e.preventDefault();
        doUndo();
      });
    }
    if (redoBtn) {
      redoBtn.addEventListener("click", function (e) {
        e.preventDefault();
        doRedo();
      });
    }
    document.addEventListener("keydown", onKeyDown);

    // Expose for tests / console
    window.SudokuApp = {
      getState: function () {
        return state;
      },
      getHistory: function () {
        return history;
      },
      getSelectedMode: function () {
        return selectedMode;
      },
      getThemePref: getThemePref,
      setThemePref: setThemePref,
      cycleTheme: cycleTheme,
      resolveTheme: resolveTheme,
      setSelectedMode: setSelectedMode,
      setHighlightFrom: setHighlightFrom,
      getConflicts: function () {
        return Board.detectConflicts(state);
      },
      getTechniqueOptions: function () {
        return Board.getTechniqueOptions();
      },
      setTechniqueOptions: function (partial) {
        var o = Board.setTechniqueOptions(partial);
        syncTechniqueTogglesFromBoard();
        return o;
      },
      showXWingHint: function () {
        var h = Board.findXWingHint(state);
        setActiveHint(h);
        return h;
      },
      showColoringHint: function () {
        var h = Board.findSimpleColoringHint(state);
        setActiveHint(h);
        return h;
      },
      clearHint: function () {
        setActiveHint(null);
      },
      getActiveHint: function () {
        return activeHint;
      },
      render: render,
      newGame: newGame,
      undo: doUndo,
      redo: doRedo,
      handleClick: function (clickType, digit, superCell, cell) {
        return withHistory(function () {
          return Board.handleClick(state, clickType, digit, superCell, cell);
        });
      },
      applyActionMode: function (mode, digit, superCell, cell) {
        return withHistory(function () {
          return Board.applyActionMode(state, mode, digit, superCell, cell);
        });
      },
      placeValue: function (superCell, cell, digit, cellType) {
        return withHistory(function () {
          if (!Board.placeValue(state, superCell, cell, digit, cellType)) {
            return false;
          }
          Board.promoteUniquesCascade(state);
          return true;
        });
      },
      digitFrequency: function () {
        return Board.digitFrequency(state);
      },
    };

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
