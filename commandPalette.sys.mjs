/**
 * @namespace Palette
 * userchrome meant to be used by other scripts
 */

/**
 * A function used to populate commands for the palette.
 * Called on `show` and optionally on `init` to retrieve an array of commands.
 *
 * @typedef {function(Palette): Palette.Command[]} Palette.PopulateFunc
 * @param {Palette} palette The palette instance for which commands are being populated.
 * @returns {Palette.Command[]} An array of Command objects to be displayed in the palette.
 *
 */

/**
 * Function type for executing a command.
 * @callback Palette.RunFunc
 * @param {Window} win
 * @returns {void|Promise<void>}
 */

/**
 * Configuration options for the Palette.
 * @typedef {Object} Palette.Options
 * @property {string} [placeholder]
 * @property {number} [maxVisible]
 * @property {number} [minQueryLength]
 * @property {boolean} [fuzzy=true] If `true`, enable fuzzy search behavior.
 * @property {boolean} [populateOnInit=false] If `true`, populateFunc is called automatically on init.
 */

/**
 * Represents a single command that can be executed.
 * @typedef {Object} Palette.Command
 * @property {string} id
 * @property {string} title
 * @property {Palette.RunFunc} run
 * @property {string} [subtitle]
 */

/**
 *
 * @example
 * ```js
 * const p = new Palette(w, () => {}, {fuzzy: false})
 * p.init(window)
 * ```
 *
 * @example
 * ```js
 * // Example of a PopulateFunc that returns a static list of commands:
 * (palette) => {
 *   return [
 *     {
 *       id: 'show-info',
 *       title: 'Show Info',
 *       run: (w) => { console.log('current URI:', w.gBrowser.selectedTab.linkedBrowser.documentURI.spec); }
 *     }
 *   ];
 * };
 * ```
 *
 * @example
 * ```js
 * // Example of a PopulateFunc that dynamically generates commands:
 * (palette) => {
 *   const dynamicCommands = [];
 *   if (palette.bufferName === 'scratch') {
 *     dynamicCommands.push({
 *       name: 'clear-scratch',
 *       execute: () => { console.log('Clearing scratch buffer...'); }
 *     });
 *   }
 *   return dynamicCommands;
 * };
 * ```
 * @note Command Palette is not a widget, so we cannot reuse it between windows.
 */
export class Palette {
    /**
     * @param {Window} win
     * @param {Palette.PopulateFunc} populateFunc
     * @param {Palette.Options} [options={}]
     */
    constructor(win, populateFunc, options = {}) {
        this.window = win
        if (!win.document) {
            throw new Error('Invalid window passed to constructor')
        }
        this.document = win.document
        this.dialog = this.document.createElement('dialog')
        this.input = this.document.createElement('input')
        this.results = this.document.createElement('div')
        this.emptyState = this.document.createElement('div')
        this.commands = []
        this.filtered = []
        this.selectedIndex = 0
        this.ranOnce = false
        this.populateFunc = populateFunc
        this.options = {
            placeholder: 'Type a command...',
            maxVisible: 8,
            minQueryLength: 0,
            fuzzy: true,
            populateOnInit: false,
            ...options,
        }
        this._buildUI()
        this._bindEvents()
    }

    /**
     * Show the palette.
     * @param {Document} doc
     * @param {string} [prefill=""]
     */
    show(doc, prefill = '') {
        if (!doc.body) return
        if (!this.ranOnce) {
            this.ranOnce = true
        }
        this.dialog.showModal()
        this.input.value = prefill
        this._onQueryChange()
        this._focusInput()
        doc.body.style.overflow = 'hidden'
    }

    /** Hide the palette. */
    hide() {
        if (this.dialog.open) {
            this.dialog.close()
        }
        this.document.body.style.overflow = ''
        this._clearActiveDescendant()
    }

    /**
     * Add a new command.
     * @param {Palette.Command} cmd
     */
    add(cmd) {
        if (!cmd || !cmd.id) throw new Error('Command must have an id')
        const existingCmdIndex = this.commands.findIndex((obj) => obj.id === cmd.id)
        if (existingCmdIndex !== -1) {
            this.commands[existingCmdIndex] = cmd
        } else {
            this.commands.push(cmd)
        }
        this.setCommands(this.commands)
    }

    /**
     * Replace the command list.
     * @param {Palette.Command[]} list
     */
    setCommands(list) {
        this.commands = Array.isArray(list) ? list.slice() : []
        this._onQueryChange()
    }

    /** Destroy the palette instance. */
    destroy() {
        this._removeEvents()
        this.dialog?.remove()
    }

    /** @private */
    _buildUI() {
        this.dialog.className = 'cp-dialog'
        this.dialog.setAttribute('aria-modal', 'true')
        this.dialog.setAttribute('role', 'dialog')
        Object.assign(this.dialog.style, {
            padding: '0',
            border: '0',
            maxWidth: '720px',
            width: 'min(90vw, 720px)',
            borderRadius: '12px',
            background: 'transparent',
            boxShadow: 'var(--cp-dialog-shadow)',
        })
        const card = this.document.createElement('div')
        card.className = 'cp-card'
        card.setAttribute('role', 'document')
        const searchWrap = this.document.createElement('div')
        searchWrap.className = 'cp-search-wrap'
        this.input.type = 'search'
        this.input.placeholder = this.options.placeholder
        this.input.setAttribute('aria-label', 'Command palette search')
        this.input.autocomplete = 'off'
        this.input.spellcheck = false
        this.input.className = 'cp-input'
        const hint = this.document.createElement('div')
        hint.className = 'cp-hint'
        hint.textContent = 'Esc to close • ↑/↓ to navigate • Enter to run'
        searchWrap.append(this.input, hint)
        this.results.className = 'cp-results'
        this.results.setAttribute('role', 'listbox')
        this.results.tabIndex = -1
        this.results.style.maxHeight = `${this.options.maxVisible * 54}px`
        this.emptyState.className = 'cp-empty-state'
        this.emptyState.textContent = 'No commands found'
        card.append(searchWrap, this.results, this.emptyState)
        this.dialog.appendChild(card)
        this.document.body.appendChild(this.dialog)
        const style = this.document.createElement('style')
        style.textContent = `/* css omitted for brevity, same as TS */`
        this.document.head.appendChild(style)
    }

    /** @private */
    _bindEvents() {
        this.input.addEventListener('input', this._onInput)
        this.dialog.addEventListener('click', this._onDialogClick)
        this.dialog.addEventListener('close', this._onClose)
        this.dialog.addEventListener('keydown', this._onFocusTrap)
        this.dialog.addEventListener('picker:firstShow', this._onFirstShow)
        this.document.addEventListener('keydown', this._onKeyDown, true)
    }

    /** @private */
    _removeEvents() {
        this.input.removeEventListener('input', this._onInput)
        this.dialog.removeEventListener('picker:firstShow', this._onFirstShow)
        this.dialog.removeEventListener('click', this._onDialogClick)
        this.dialog.removeEventListener('close', this._onClose)
        this.dialog.removeEventListener('keydown', this._onFocusTrap)
        this.document.removeEventListener('keydown', this._onKeyDown, true)
    }

    /** @private */
    _onFirstShow = () => {
        const commands = this.populateFunc(this)
        this.setCommands(commands)
    }

    /** @private */
    _onClose = () => {
        this._clearActiveDescendant()
        this.document.body.style.overflow = ''
    }

    /** @private */
    _onDialogClick = (e) => {
        if (e.target === this.dialog) {
            e.preventDefault()
            this.hide()
        }
    }

    /** @private */
    _onInput = () => {
        this._onQueryChange()
    }

    /** @private */
    _focusInput() {
        try {
            this.input.focus()
            this.input.select()
        } catch (e) {
            console.error(e)
        }
    }

    /** @private */
    _onKeyDown = (e) => {
        if (!this.dialog.open) return
        switch (e.key) {
            case 'Escape':
                e.preventDefault()
                this.hide()
                break
            case 'ArrowUp':
                e.preventDefault()
                this._moveSelection(-1)
                break
            case 'ArrowDown':
                e.preventDefault()
                this._moveSelection(1)
                break
            case 'Tab':
                if (e.shiftKey && this.document.activeElement !== this.input) {
                    e.preventDefault()
                    this._moveSelection(-1)
                } else if (!e.shiftKey && this.document.activeElement === this.input) {
                    e.preventDefault()
                    this._moveSelection(1)
                }
                break
            case 'Enter':
                if (this.filtered.length > 0) {
                    e.preventDefault()
                    const cmd = this.filtered[this.selectedIndex]
                    if (cmd) this._runCommand(cmd)
                }
                break
            case 'p':
                if (e.altKey) {
                    e.preventDefault()
                    this._moveSelection(-1)
                }
                break
            case 'n':
                if (e.altKey) {
                    e.preventDefault()
                    this._moveSelection(1)
                }
                break
        }
    }

    /** @private */
    _onFocusTrap = (e) => {
        if (e.key !== 'Tab') return
        const focusable = this.dialog.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])')
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && this.document.activeElement === first) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && this.document.activeElement === last) {
            e.preventDefault()
            first.focus()
        }
    }

    /** @private */
    _onQueryChange() {
        const q = this.input.value.trim()
        const results = q.length >= this.options.minQueryLength ? this._filterCommands(q) : this.commands.slice()
        this.filtered = results
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, results.length - 1))
        if (this.selectedIndex < 0) this.selectedIndex = 0
        this._renderResults(q)
    }

    /**
     * @private
     * @param {string} q
     * @returns {Palette.Command[]}
     */
    _filterCommands(q) {
        if (q === '') return this.commands.slice()
        const query = q.toLowerCase()
        const scored = this.commands
            .map((cmd) => {
                const title = (cmd.title || '').toLowerCase()
                const subtitle = (cmd.subtitle || '').toLowerCase()
                let score = 0
                if (title === query) score += 100
                if (title.startsWith(query)) score += 75
                if (title.includes(query)) score += 50
                if (subtitle.includes(query)) score += 30
                if (this.options.fuzzy && this._fuzzyMatch(query, title)) score += 10
                return { cmd, score }
            })
            .filter((x) => x.score > 0)
        scored.sort((a, b) => b.score - a.score || a.cmd.title.localeCompare(b.cmd.title))
        return scored.map((s) => s.cmd)
    }

    /**
     * @private
     * @param {string} query
     * @param {string} text
     * @returns {boolean}
     */
    _fuzzyMatch(query, text) {
        if (query.length === 0) return true
        let qi = 0,
            ti = 0
        while (qi < query.length && ti < text.length) {
            if (query[qi] === text[ti]) qi++
            ti++
        }
        return qi === query.length
    }

    /**
     * @private
     * @param {string} query
     */
    _renderResults(query) {
        this.results.innerHTML = ''
        const hasResults = this.filtered.length > 0
        this.emptyState.style.display = hasResults ? 'none' : ''
        this.results.style.display = hasResults ? 'grid' : 'none'
        if (!hasResults) return
        this.filtered.forEach((cmd, idx) => {
            const item = this.document.createElement('div')
            item.className = 'cp-item'
            item.setAttribute('role', 'option')
            item.setAttribute('data-cmd-id', cmd.id || String(idx))
            const title = this.document.createElement('div')
            title.className = 'cp-title'
            title.innerHTML = this._highlight(cmd.title || '', query)
            item.appendChild(title)
            if (cmd.subtitle) {
                const sub = this.document.createElement('div')
                sub.className = 'cp-sub'
                sub.innerHTML = this._highlight(cmd.subtitle, query)
                item.appendChild(sub)
            }
            item.addEventListener('click', (ev) => {
                ev.stopPropagation()
                this.selectedIndex = idx
                this._runCommand(cmd)
            })
            item.addEventListener('mousemove', () => {
                this._setSelectedIndex(idx)
            })
            if (idx === this.selectedIndex) {
                item.setAttribute('aria-selected', 'true')
                item.id = `cp-item-${idx}`
                this.results.setAttribute('aria-activedescendant', item.id)
            } else {
                item.setAttribute('aria-selected', 'false')
            }
            this.results.appendChild(item)
        })
        this._ensureSelectionVisible()
    }

    /**
     * @private
     * @param {string} text
     * @param {string} query
     * @returns {string}
     */
    _highlight(text, query) {
        if (!query) return this._escapeHtml(text)
        const q = query.trim().toLowerCase()
        if (!q) return this._escapeHtml(text)
        const lowerText = text.toLowerCase()
        const pos = lowerText.indexOf(q)
        if (pos !== -1) {
            const before = this._escapeHtml(text.slice(0, pos))
            const match = this._escapeHtml(text.slice(pos, pos + q.length))
            const after = this._escapeHtml(text.slice(pos + q.length))
            return `${before}<span class="cp-highlight">${match}</span>${after}`
        }
        // fallback fuzzy
        let out = ''
        let qi = 0
        for (const char of text) {
            if (qi < q.length && char.toLowerCase() === q[qi]) {
                out += `<span class="cp-highlight">${this._escapeHtml(char)}</span>`
                qi++
            } else {
                out += this._escapeHtml(char)
            }
        }
        return out
    }

    /**
     * @private
     * @param {string} s
     * @returns {string}
     */
    _escapeHtml(s) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
        return String(s).replace(/[&<>"']/g, (c) => map[c])
    }

    /**
     * @private
     * @param {number} i
     */
    _setSelectedIndex(i) {
        this.selectedIndex = Math.max(0, Math.min(i, this.filtered.length - 1))
        Array.from(this.results.children).forEach((node, idx) => {
            if (idx === this.selectedIndex) {
                node.setAttribute('aria-selected', 'true')
                node.id = `cp-item-${idx}`
                this.results.setAttribute('aria-activedescendant', node.id)
            } else {
                node.setAttribute('aria-selected', 'false')
                node.removeAttribute('id')
            }
        })
        this._ensureSelectionVisible()
    }

    /**
     * @private
     * @param {number} delta
     */
    _moveSelection(delta) {
        if (this.filtered.length === 0) return
        const newIndex = (this.selectedIndex + delta + this.filtered.length) % this.filtered.length
        this._setSelectedIndex(newIndex)
    }

    /** @private */
    _ensureSelectionVisible() {
        const node = this.results.children[this.selectedIndex]
        if (!node) return
        const containerTop = this.results.scrollTop
        const containerBottom = containerTop + this.results.clientHeight
        const nodeTop = node.offsetTop
        const nodeBottom = nodeTop + node.offsetHeight
        if (nodeTop < containerTop) {
            this.results.scrollTop = nodeTop - 6
        } else if (nodeBottom > containerBottom) {
            this.results.scrollTop = nodeBottom - this.results.clientHeight + 6
        }
    }

    /** @private */
    _clearActiveDescendant() {
        this.results.removeAttribute('aria-activedescendant')
    }

    /**
     * @private
     * @param {Palette.Command} cmd
     */
    _runCommand(cmd) {
        try {
            if (typeof cmd.run === 'function') {
                this.hide()
                const res = cmd.run(this.window)
                if (res && typeof res.then === 'function') {
                    res.catch((err) => console.error('Command error:', err))
                }
            } else {
                console.warn('Command has no run() function', cmd)
            }
        } catch (err) {
            console.error('Command execution failed', err)
        }
    }

    /**
     * Initialize the palette.
     * @param {Window} _win
     */
    init(_win) {
        if (this.options.populateOnInit === true) {
            this.setCommands(this.populateFunc(this))
        }
    }
}
