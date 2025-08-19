// --- Type Definitions ---
/**
 * Represents a single command that can be executed.
 */
interface Command {
  id: string;
  title: string;
  subtitle?: string;
  run: (win: Window) => void | Promise<any>;
}
/**
 * Configuration options for the Palette.
 */
interface PaletteOptions {
  placeholder?: string;
  maxVisible?: number;
  minQueryLength?: number;
  /** If `true`, enable fuzzy search behavior (default true) */
  fuzzy?: boolean;
  /** If `true`, the `populateFunc` is called automatically when the palette initializes. (default false)*/
  populateOnInit?: boolean;
}
/**
 * Represents a custom <key> or <command> element with an id and doCommand method.
 */
interface XULCommandElement extends Element {
  id: string;
  doCommand: () => void;
}
// --- Global Declarations ---
// These declare the shape of expected global variables to the TypeScript compiler.
declare const commandPaletteSettings: Record<
  string,
  { title: string; enabled: boolean }
>;
declare const UC_API: {
  Hotkeys: {
    define(options: {
      modifiers: string;
      key: string;
      id: string;
      command: () => void;
    }): { attachToWindow(win: Window): void };
  };
};
/**
 * @note Command Palette is not a widget, so we cannot reuse it between windows.
 * @example
 * ```ts
 * new Palette(
 * window,
 * [{ id: 'hello', title: 'Say Hello', run: () => window.alert('Hello!') }]
 * )
 * ```
 */
export class Palette {
  private window: Window;
  private document: Document;
  private dialog: HTMLDialogElement;
  private input: HTMLInputElement;
  private results: HTMLDivElement;
  private populateFunc: Palette.PopulateFunc;
  private emptyState: HTMLDivElement;
  private ranOnce: boolean;
  private commands: Command[];
  private filtered: Command[];
  private selectedIndex: number;
  private options: Required<PaletteOptions>;
  constructor(
    win: Window,
    populateFunc: Palette.PopulateFunc,
    options: PaletteOptions = {},
  ) {
    this.window = win;
    if (!win.document) {
      throw new Error("Invalid window passed to constructor");
    }
    this.document = win.document;
    this.dialog = this.document.createElement("dialog");
    this.input = this.document.createElement("input");
    this.results = this.document.createElement("div");
    this.emptyState = this.document.createElement("div");
    this.commands = [];
    this.filtered = [];
    this.selectedIndex = 0;
    this.ranOnce = false;
    this.populateFunc = populateFunc;
    this.options = {
      placeholder: "Type a command...",
      maxVisible: 8,
      minQueryLength: 0,
      fuzzy: true,
      populateOnInit: false,
      ...options,
    };
    this._buildUI();
    this._bindEvents();
    // this.setCommands(this.commands);
  }
  public show(doc: Document, prefill = ""): void {
    if (!doc.body) return;
    if (!this.ranOnce) {
      this;
      this.ranOnce = true;
    }
    this.dialog.showModal();
    this.input.value = prefill;
    this._onQueryChange();
    this._focusInput();
    doc.body.style.overflow = "hidden";
  }
  public hide(): void {
    if (this.dialog.open) {
      this.dialog.close();
    }
    this.document.body.style.overflow = "";
    this._clearActiveDescendant();
  }
  public add(cmd: Command): void {
    if (!cmd || !cmd.id) throw new Error("Command must have an id");
    const existingCmdIndex = this.commands.findIndex((obj) =>
      obj.id === cmd.id
    );
    if (existingCmdIndex !== -1) {
      this.commands[existingCmdIndex] = cmd; // Replace it
    } else {
      this.commands.push(cmd); // Add it
    }
    this.setCommands(this.commands);
  }
  public setCommands(list: Command[]): void {
    this.commands = Array.isArray(list) ? list.slice() : [];
    this._onQueryChange();
  }
  public destroy(): void {
    this._removeEvents();
    this.dialog?.remove();
  }
  private _buildUI(): void {
    this.dialog.className = "cp-dialog";
    this.dialog.setAttribute("aria-modal", "true");
    this.dialog.setAttribute("role", "dialog");
    Object.assign(this.dialog.style, {
      padding: "0",
      border: "0",
      maxWidth: "720px",
      width: "min(90vw, 720px)",
      borderRadius: "12px",
      background: "transparent",
      boxShadow: "var(--cp-dialog-shadow)",
    });
    const card = this.document.createElement("div");
    card.className = "cp-card";
    card.setAttribute("role", "document");
    const searchWrap = this.document.createElement("div");
    searchWrap.className = "cp-search-wrap";
    this.input.type = "search";
    this.input.placeholder = this.options.placeholder;
    this.input.setAttribute("aria-label", "Command palette search");
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.input.className = "cp-input";
    const hint = this.document.createElement("div");
    hint.className = "cp-hint";
    hint.textContent = "Esc to close • ↑/↓ to navigate • Enter to run";
    searchWrap.append(this.input, hint);
    this.results.className = "cp-results";
    this.results.setAttribute("role", "listbox");
    this.results.tabIndex = -1;
    this.results.style.maxHeight = `${this.options.maxVisible * 54}px`;
    this.emptyState.className = "cp-empty-state";
    this.emptyState.textContent = "No commands found";
    card.append(searchWrap, this.results, this.emptyState);
    this.dialog.appendChild(card);
    this.document.body.appendChild(this.dialog);
    const style = this.document.createElement("style");
    style.textContent = `
            :root {
                --cp-bg-card: #282a36;
                --cp-text-primary: #f8f8f2;
                --cp-text-secondary: #bd93f9;
                --cp-border-light: rgba(255, 255, 255, 0.1);
                --cp-shadow-card: 0 2px 10px rgba(0, 0, 0, 0.5);
                --cp-dialog-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
                --cp-input-bg: #44475a;
                --cp-input-border: #6272a4;
                --cp-item-hover-bg: rgba(255, 255, 255, 0.08);
                --cp-highlight-color: #50fa7b;
            }
            .cp-dialog { box-shadow: var(--cp-dialog-shadow); }
            .cp-card { border-radius: 12px; overflow: hidden; background: var(--cp-bg-card); box-shadow: var(--cp-shadow-card); font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: var(--cp-text-primary); }
            .cp-search-wrap { padding: 12px; border-bottom: 1px solid var(--cp-border-light); display: flex; gap: 8px; align-items: center; }
            .cp-input { flex: 1; font-size: 15px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--cp-input-border); outline: none; background: var(--cp-input-bg); color: var(--cp-text-primary); }
            .cp-input::placeholder { color: var(--cp-text-secondary); opacity: 0.7; }
            .cp-hint { font-size: 12px; opacity: 0.7; white-space: nowrap; user-select: none; color: var(--cp-text-secondary); }
            .cp-results { overflow-y: auto; padding: 6px; display: grid; row-gap: 6px; }
            .cp-empty-state { padding: 16px; text-align: center; opacity: 0.75; font-size: 14px; color: var(--cp-text-secondary); }
            .cp-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 8px; cursor: pointer; }
            .cp-item:hover, .cp-item[aria-selected="true"] { background: var(--cp-item-hover-bg); }
            .cp-title { font-size: 14px; font-weight: 600; line-height: 1; color: var(--cp-text-primary); }
            .cp-sub { font-size: 12px; opacity: 0.7; line-height: 1; color: var(--cp-text-secondary); }
            .cp-highlight { font-weight: 700; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; color: var(--cp-highlight-color); }
        `;
    this.document.head.appendChild(style);
  }
  private _bindEvents(): void {
    this.input.addEventListener("input", this._onInput);
    this.dialog.addEventListener("click", this._onDialogClick);
    this.dialog.addEventListener("close", this._onClose);
    this.dialog.addEventListener("keydown", this._onFocusTrap);
    this.dialog.addEventListener("picker:firstShow", this._onFirstShow);
    this.document.addEventListener("keydown", this._onKeyDown, true);
  }
  private _removeEvents(): void {
    this.input.removeEventListener("input", this._onInput);
    this.dialog.removeEventListener("picker:firstShow", this._onFirstShow);
    this.dialog.removeEventListener("click", this._onDialogClick);
    this.dialog.removeEventListener("close", this._onClose);
    this.dialog.removeEventListener("keydown", this._onFocusTrap);
    this.document.removeEventListener("keydown", this._onKeyDown, true);
  }
  private _onFirstShow = (): void => {
    const commands = this.populateFunc(this);
    this.setCommands(commands);
  };
  private _onClose = (): void => {
    this._clearActiveDescendant();
    this.document.body.style.overflow = "";
  };
  private _onDialogClick = (e: MouseEvent): void => {
    if (e.target === this.dialog) {
      e.preventDefault();
      this.hide();
    }
  };
  private _onInput = (): void => {
    this._onQueryChange();
  };
  private _focusInput(): void {
    try {
      this.input.focus();
      this.input.select();
    } catch (e) {
      console.error(e);
    }
  }
  private _onKeyDown = (e: KeyboardEvent): void => {
    if (!this.dialog.open) return;
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        this.hide();
        break;
      case "ArrowUp":
        e.preventDefault();
        this._moveSelection(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        this._moveSelection(1);
        break;
      case "Tab":
        if (e.shiftKey && this.document.activeElement !== this.input) {
          e.preventDefault();
          this._moveSelection(-1);
        } else if (!e.shiftKey && this.document.activeElement === this.input) {
          e.preventDefault();
          this._moveSelection(1);
        }
        break;
      case "Enter":
        if (this.filtered.length > 0) {
          e.preventDefault();
          const cmd = this.filtered[this.selectedIndex];
          if (cmd) this._runCommand(cmd);
        }
        break;
      case "p":
        if (e.altKey) {
          e.preventDefault();
          this._moveSelection(-1);
        }
        break;
      case "n":
        if (e.altKey) {
          e.preventDefault();
          this._moveSelection(1);
        }
        break;
    }
  };
  private _onFocusTrap = (e: KeyboardEvent): void => {
    if (e.key !== "Tab") return;
    const focusable = this.dialog.querySelectorAll<HTMLElement>(
      'input, button, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && this.document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && this.document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  private _onQueryChange(): void {
    const q = this.input.value.trim();
    const results = q.length >= this.options.minQueryLength
      ? this._filterCommands(q)
      : this.commands.slice();
    this.filtered = results;
    this.selectedIndex = Math.min(
      this.selectedIndex,
      Math.max(0, results.length - 1),
    );
    if (this.selectedIndex < 0) this.selectedIndex = 0;
    this._renderResults(q);
  }
  private _filterCommands(q: string): Command[] {
    if (q === "") return this.commands.slice();
    const query = q.toLowerCase();
    const scored = this.commands
      .map((cmd) => {
        const title = (cmd.title || "").toLowerCase();
        const subtitle = (cmd.subtitle || "").toLowerCase();
        let score = 0;
        if (title === query) score += 100;
        if (title.startsWith(query)) score += 75;
        if (title.includes(query)) score += 50;
        if (subtitle.includes(query)) score += 30;
        if (this.options.fuzzy && this._fuzzyMatch(query, title)) {
          score += 10;
        }
        return { cmd, score };
      })
      .filter((x) => x.score > 0);
    scored.sort(
      (a, b) => b.score - a.score || a.cmd.title.localeCompare(b.cmd.title),
    );
    return scored.map((s) => s.cmd);
  }
  private _fuzzyMatch(query: string, text: string): boolean {
    if (query.length === 0) return true;
    let qi = 0, ti = 0;
    while (qi < query.length && ti < text.length) {
      if (query[qi] === text[ti]) {
        qi++;
      }
      ti++;
    }
    return qi === query.length;
  }
  private _renderResults(query: string): void {
    this.results.innerHTML = "";
    const hasResults = this.filtered.length > 0;
    this.emptyState.style.display = hasResults ? "none" : "";
    this.results.style.display = hasResults ? "grid" : "none";
    if (!hasResults) return;
    this.filtered.forEach((cmd, idx) => {
      const item = this.document.createElement("div");
      item.className = "cp-item";
      item.setAttribute("role", "option");
      item.setAttribute("data-cmd-id", cmd.id || String(idx));
      const title = this.document.createElement("div");
      title.className = "cp-title";
      title.innerHTML = this._highlight(cmd.title || "", query);
      item.appendChild(title);
      if (cmd.subtitle) {
        const sub = this.document.createElement("div");
        sub.className = "cp-sub";
        sub.innerHTML = this._highlight(cmd.subtitle, query);
        item.appendChild(sub);
      }
      item.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.selectedIndex = idx;
        this._runCommand(cmd);
      });
      item.addEventListener("mousemove", () => {
        this._setSelectedIndex(idx);
      });
      if (idx === this.selectedIndex) {
        item.setAttribute("aria-selected", "true");
        item.id = `cp-item-${idx}`;
        this.results.setAttribute("aria-activedescendant", item.id);
      } else {
        item.setAttribute("aria-selected", "false");
      }
      this.results.appendChild(item);
    });
    this._ensureSelectionVisible();
  }
  private _highlight(text: string, query: string): string {
    if (!query) return this._escapeHtml(text);
    const q = query.trim().toLowerCase();
    if (!q) return this._escapeHtml(text);
    const lowerText = text.toLowerCase();
    const pos = lowerText.indexOf(q);
    if (pos !== -1) {
      const before = this._escapeHtml(text.slice(0, pos));
      const match = this._escapeHtml(text.slice(pos, pos + q.length));
      const after = this._escapeHtml(text.slice(pos + q.length));
      return `${before}<span class="cp-highlight">${match}</span>${after}`;
    }
    // Fallback for fuzzy highlighting
    let out = "";
    let qi = 0;
    for (const char of text) {
      if (qi < q.length && char.toLowerCase() === q[qi]) {
        out += `<span class="cp-highlight">${this._escapeHtml(char)}</span>`;
        qi++;
      } else {
        out += this._escapeHtml(char);
      }
    }
    return out;
  }
  private _escapeHtml(s: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return String(s).replace(/[&<>"']/g, (c) => map[c]);
  }
  private _setSelectedIndex(i: number): void {
    this.selectedIndex = Math.max(0, Math.min(i, this.filtered.length - 1));
    Array.from(this.results.children).forEach((node, idx) => {
      if (idx === this.selectedIndex) {
        node.setAttribute("aria-selected", "true");
        node.id = `cp-item-${idx}`;
        this.results.setAttribute("aria-activedescendant", node.id);
      } else {
        node.setAttribute("aria-selected", "false");
        node.removeAttribute("id");
      }
    });
    this._ensureSelectionVisible();
  }
  private _moveSelection(delta: number): void {
    if (this.filtered.length === 0) return;
    const newIndex = (this.selectedIndex + delta + this.filtered.length) %
      this.filtered.length;
    this._setSelectedIndex(newIndex);
  }
  private _ensureSelectionVisible(): void {
    const node = this.results.children[this.selectedIndex] as HTMLElement;
    if (!node) return;
    const containerTop = this.results.scrollTop;
    const containerBottom = containerTop + this.results.clientHeight;
    const nodeTop = node.offsetTop;
    const nodeBottom = nodeTop + node.offsetHeight;
    if (nodeTop < containerTop) {
      this.results.scrollTop = nodeTop - 6;
    } else if (nodeBottom > containerBottom) {
      this.results.scrollTop = nodeBottom - this.results.clientHeight + 6;
    }
  }
  private _clearActiveDescendant(): void {
    this.results.removeAttribute("aria-activedescendant");
  }
  private _runCommand(cmd: Command): void {
    try {
      if (typeof cmd.run === "function") {
        this.hide();
        const res = cmd.run(this.window);
        if (res && typeof (res as Promise<any>).then === "function") {
          (res as Promise<any>).catch((err: Error) =>
            console.error("Command error:", err)
          );
        }
      } else {
        console.warn("Command has no run() function", cmd);
      }
    } catch (err) {
      console.error("Command execution failed", err);
    }
  }
  public init(win: Window): void {
    if (this.options.populateOnInit === true) {
      this.setCommands(this.populateFunc(this));
    }
  }
}
export namespace Palette {
  export type PopulateFunc = (palette: Palette) => Command[];
}
