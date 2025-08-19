import * as UC_API from 'chrome://userchromejs/content/uc_api.sys.mjs'
const createElement = UC_API.Utils.createElement
const UC_COMMAND_SET = 'ucCommandSet'

// TYPES
/**
 * A callback that fetches items for the command palette. It can return an array
 * of `PaletteItem` objects synchronously or a `Promise` that resolves to the array.
 * @typedef {() => PaletteItem[] | Promise<PaletteItem[]>} GetItems
 */

/** @typedef {Object} CommandDetails
j* @prop {string} id
 * @prop {function} command
 */
/**
 * @typedef {Record<string,XULElement[]>} commandSet
 */

/**
 * @param {Document} doc - The Document object where the commandset is/ will be
 * @param {string} id - Id of the commandset
 * @description gets the <commandset> or creates it if it doesn't exist
 * */

/**
 * `run` is a function which is called when the command is selected
 * @typedef {Object} Command
 * @property {string} id
 * @property {string} title
 * @property {(window: ChromeWindow) => void} run
 */

/**
 * @typedef {Object} CommandPaletteSettingsEntry
 * @property {string} title
 * @property {boolean} enabled
 */

/**
 * @typedef {object} PaletteOptions
 * @property {string} [placeholder] The placeholder text for the autocomplete input.
 * @property {number} [maxVisible] The maximum number of suggestions to display at once.
 * @property {number} [minQueryLength] The minimum number of characters required to trigger suggestions.
 * @property {boolean} [fuzzy] Whether to enable fuzzy matching for suggestions.
 */

// test

/** @description test
 * @param {Document} doc
 * @param {string} [id='ucCommandSet']
 **/
function getCommandSet(doc, id = 'ucCommandSet') {
    if (!doc.body) throw 'invalid document'

    let commandSet = doc.getElementById(id)
    if (!commandSet) {
        commandSet = createElement(doc, 'commandset', { id: id }, false)
        doc.body.insertBefore(commandSet, doc.body.firstChild)
    }
    return commandSet
}

// Array.from(Services.wm.getMostRecentWindow('navigator:browser').gBrowser.tabs).map(t => ({ title: t.label, url: t.linkedBrowser.currentURI.spec }))

/**
 * id: {Settings}
 * @type {Object.<string, CommandPaletteSettingsEntry>}
 * */
const commandPaletteSettings = (function () {
    try {
        const fsResult = UC_API.FileSystem.readFileSync('commandPaletteConfig.json')
        if (fsResult?.isContent?.()) {
            return JSON.parse(fsResult.content(false))
        } else {
            throw new Error('could not read file at <resources>/commandPaletteConfig.json')
        }
    } catch (e) {
        console.error('Failed to load or parse launch.json', e)
    }
})()

/** @type {Document} */
let document

/**
 * @note Command Palette is not a widget, so we cannot reuse it between windows.
 * @example
 * ```js
 *  new Palette(
 *    window,
 *    [{ id: 'hello', title: 'Say Hello', run: () => window.alert('Hello!') }]
 *  )
 * ```
 */
export class Palette {
    /**
     * @param {Window} win
     * @param {Command[]} initialCommands
     * @param {PaletteOptions} options
     **/
    constructor(win, initialCommands = [], options = {}) {
        this.window = win
        if (!win.document) throw 'Invalid window passed to constructor'
        document = win.document

        /** @type {HTMLDialogElement} */
        this.dialog = document.createElement('dialog')

        /** @type {HTMLInputElement} */
        this.input = document.createElement('input')

        /** @type {Command[]} */
        this.commands = Array.isArray(initialCommands) ? initialCommands.slice() : []
        /** @type {Command[]} */
        this.filtered = []
        /** @type {number} */
        this.selectedIndex = 0

        /** @type {PaletteOptions} */
        this.options = Object.assign(
            {
                placeholder: 'Type a command...',
                maxVisible: 8,
                minQueryLength: 0,
                fuzzy: true,
            },
            options,
        )
        /** @type {HTMLDivElement} */
        this.results = document.createElement('div')
        /** @type {HTMLDivElement} */
        this.emptyState = document.createElement('div')

        this._buildUI()
        this._bindEvents()
        this.setCommands(this.commands)
        /** @type {boolean} */
        this.ranOnce = false
    }

    /**
     * @param {Document} doc
     * @param {string} [prefill='']
     */
    show(doc, prefill = '') {
        if (!doc.body) return

        // register <key> elements if this is the first display.
        // if (!this.ranOnce) this.registerKeyElements(doc)
        if (!this.ranOnce) this.registerCommandElements(doc)
        if (!this.ranOnce) {
            this.registerKeyElements(doc)
        }
        this.ranOnce = true

        this.dialog.showModal()
        this.input.value = prefill || ''
        this._onQueryChange()
        this._focusInput()
        doc.body.style.overflow = 'hidden'
    }

    hide() {
        if (this.dialog.open) {
            this.dialog.close()
        }
        document.body.style.overflow = ''
        this._clearActiveDescendant()
    }

    /** @param {Command} cmd */
    add(cmd) {
        if (!cmd || !cmd.id) throw new Error('Command must have an id')
        const existingCmdIndex = this.commands.findIndex((obj) => obj.id === cmd.id)
        if (existingCmdIndex !== -1) {
            this.commands[existingCmdIndex] = cmd // replace it
        } else {
            // existingCmdIndex === 1 (does not exist)
            this.commands.push(cmd) // add it
        }
        this.setCommands(this.commands)
    }

    /** @param {Command[]} list */
    setCommands(list) {
        this.commands = Array.isArray(list) ? list.slice() : []
        this._onQueryChange()
    }

    destroy() {
        this._removeEvents()
        if (this.dialog && this.dialog.parentNode) this.dialog.remove()
    }

    _buildUI() {
        this.dialog.className = 'cp-dialog'
        this.dialog.setAttribute('aria-modal', 'true')
        this.dialog.setAttribute('role', 'dialog')
        this.dialog.style.padding = '0'
        this.dialog.style.border = '0'
        this.dialog.style.maxWidth = '720px'
        this.dialog.style.width = 'min(90vw,720px)'
        this.dialog.style.borderRadius = '12px'
        this.dialog.style.background = 'transparent'
        this.dialog.style.boxShadow = 'var(--cp-dialog-shadow)'

        const card = document.createElement('div')
        card.className = 'cp-card'
        card.setAttribute('role', 'document')

        const searchWrap = document.createElement('div')
        searchWrap.className = 'cp-search-wrap'

        this.input.type = 'search'
        this.input.placeholder = this.options.placeholder
        this.input.setAttribute('aria-label', 'Command palette search')
        this.input.autocomplete = 'off'
        this.input.spellcheck = false
        this.input.className = 'cp-input'

        const hint = document.createElement('div')
        hint.className = 'cp-hint'
        hint.textContent = 'Esc to close • ↑/↓ to navigate • Enter to run'

        searchWrap.appendChild(this.input)
        searchWrap.appendChild(hint)

        this.results.className = 'cp-results'
        this.results.setAttribute('role', 'listbox')
        this.results.setAttribute('tabindex', '-1')
        this.results.style.maxHeight = `${this.options.maxVisible * 54}px`

        this.emptyState.className = 'cp-empty-state'
        this.emptyState.textContent = 'No commands found'

        card.appendChild(searchWrap)
        card.appendChild(this.results)
        card.appendChild(this.emptyState)
        this.dialog.appendChild(card)
        document.body.appendChild(this.dialog)

        const style = document.createElement('style')
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

      .cp-dialog {
        box-shadow: var(--cp-dialog-shadow);
      }

      .cp-card {
        border-radius: 12px;
        overflow: hidden;
        background: var(--cp-bg-card);
        box-shadow: var(--cp-shadow-card);
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        color: var(--cp-text-primary);
      }

      .cp-search-wrap {
        padding: 12px;
        border-bottom: var(--cp-border-light);
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .cp-input {
        flex: 1;
        font-size: 15px;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid var(--cp-input-border);
        outline: none;
        background: var(--cp-input-bg);
        color: var(--cp-text-primary);
      }
      .cp-input::placeholder {
        color: var(--cp-text-secondary);
        opacity: 0.7;
      }

      .cp-hint {
        font-size: 12px;
        opacity: 0.7;
        white-space: nowrap;
        user-select: none;
        color: var(--cp-text-secondary);
      }

      .cp-results {
        overflow-y: auto;
        padding: 6px;
        display: grid;
        row-gap: 6px;
      }

      .cp-empty-state {
        padding: 16px;
        text-align: center;
        opacity: 0.75;
        font-size: 14px;
        color: var(--cp-text-secondary);
      }

      .cp-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        border-radius: 8px;
        cursor: pointer;
      }
      .cp-item:hover,
      .cp-item[aria-selected="true"] {
        background: var(--cp-item-hover-bg);
      }
      .cp-title {
        font-size: 14px;
        font-weight: 600;
        line-height: 1;
        color: var(--cp-text-primary);
      }
      .cp-sub {
        font-size: 12px;
        opacity: 0.7;
        line-height: 1;
        color: var(--cp-text-secondary);
      }
      .cp-highlight {
        font-weight: 700;
        text-decoration: underline;
        text-decoration-thickness: 2px;
        text-underline-offset: 3px;
        color: var(--cp-highlight-color);
      }
    `
        document.head.appendChild(style)
    }

    _bindEvents() {
        this._onKeyDown = this._onKeyDown.bind(this)
        this._onDialogClick = this._onDialogClick.bind(this)
        this._onInput = this._onInput.bind(this)
        this._onFocusTrap = this._onFocusTrap.bind(this)
        this._onClose = this._onClose.bind(this)
        this.input.addEventListener('input', this._onInput)
        this.dialog.addEventListener('click', this._onDialogClick)
        this.dialog.addEventListener('close', this._onClose)
        document.addEventListener('keydown', this._onKeyDown, true)
        this.dialog.addEventListener('keydown', this._onFocusTrap)
    }

    _removeEvents() {
        this.input.removeEventListener('input', this._onInput)
        this.dialog.removeEventListener('click', this._onDialogClick)
        this.dialog.removeEventListener('close', this._onClose)
        document.removeEventListener('keydown', this._onKeyDown, true)
        this.dialog.removeEventListener('keydown', this._onFocusTrap)
    }

    _onClose() {
        this._clearActiveDescendant()
        document.body.style.overflow = ''
    }

    /** @param {MouseEvent} e */
    _onDialogClick(e) {
        if (e.target === this.dialog) {
            e.preventDefault()
            this.hide()
        }
    }

    _onInput() {
        this._onQueryChange()
    }

    _focusInput() {
        try {
            this.input.focus()
            this.input.select()
        } catch (e) {
            console.error(e)
        }
    }

    /** @param {KeyboardEvent} e */
    _onKeyDown(e) {
        if (!this.dialog.open) return
        const key = e.key
        // if (e.ctrlKey && e.shiftKey && key === 'p') {
        if (e.altKey && key === 'p') {
            e.preventDefault()
            this._moveSelection(-1)
            // } else if (e.ctrlKey && e.shiftKey && key === 'n') {
        } else if (e.altKey && key === 'n') {
            e.preventDefault()
            this._moveSelection(1)
        }
        if (key === 'Escape') {
            e.preventDefault()
            this.hide()
        } else if (key === 'ArrowDown' || (key === 'Tab' && !e.shiftKey && document.activeElement === this.input)) {
            e.preventDefault()
            this._moveSelection(1)
        } else if (key === 'ArrowUp' || (key === 'Tab' && e.shiftKey && document.activeElement !== this.input)) {
            e.preventDefault()
            this._moveSelection(-1)
        } else if (key === 'Enter') {
            if (this.filtered.length === 0) return
            e.preventDefault()
            const cmd = this.filtered[this.selectedIndex]
            if (cmd) this._runCommand(cmd)
        }
    }

    /** @param {KeyboardEvent} e */
    _onFocusTrap(e) {
        if (e.key !== 'Tab') return
        /** @type {NodeListOf<HTMLElement>} */
        const focusable = this.dialog.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])')
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
        }
    }

    _onQueryChange() {
        const q = this.input.value.trim()
        let results = []
        if (q.length >= (this.options.minQueryLength || 0)) {
            results = this._filterCommands(q)
        } else {
            results = this.commands.slice()
        }
        this.filtered = results
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, results.length - 1))
        if (this.selectedIndex < 0) this.selectedIndex = 0
        this._renderResults(q)
    }

    /** @param {string} q */
    _filterCommands(q) {
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
            .filter((x) => x.score > 0 || q === '')
        if (q === '') return this.commands.slice()
        scored.sort((a, b) => b.score - a.score || a.cmd.title.localeCompare(b.cmd.title))
        return scored.map((s) => s.cmd)
    }

    /**
     * @param {string} query
     * @param {string} text
     * @returns {boolean}
     */
    _fuzzyMatch(query, text) {
        let qi = 0,
            ti = 0
        if (query.length === 0) return true
        while (qi < query.length && ti < text.length) {
            if (query[qi] === text[ti]) qi++
            ti++
        }
        return qi === query.length
    }

    /** @param {string} query */
    _renderResults(query) {
        if (!this.results) return
        this.results.innerHTML = ''
        if (!this.filtered.length) {
            this.emptyState.style.display = ''
            this.results.style.display = 'none'
            return
        } else {
            this.emptyState.style.display = 'none'
            this.results.style.display = 'grid'
        }
        this.filtered.forEach((cmd, idx) => {
            const item = document.createElement('div')
            item.className = 'cp-item'
            item.setAttribute('role', 'option')
            item.setAttribute('data-cmd-id', cmd.id || String(idx))
            const title = document.createElement('div')
            title.className = 'cp-title'
            title.innerHTML = this._highlight(cmd.title || '', query)
            const sub = document.createElement('div')
            sub.className = 'cp-sub'
            sub.innerHTML = this._highlight(cmd.subtitle || '', query)
            item.appendChild(title)
            if (cmd.subtitle) item.appendChild(sub)
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
                item.removeAttribute('id')
            }
            this.results.appendChild(item)
        })
        this._ensureSelectionVisible()
    }

    /**
     * @param {string} text
     * @param {string} query
     * @returns {string}
     */
    _highlight(text, query) {
        if (!query) return this._escapeHtml(text)
        const q = query.trim()
        if (!q) return this._escapeHtml(text)
        const lower = text.toLowerCase()
        const pos = lower.indexOf(q.toLowerCase())
        if (pos >= 0) {
            const before = this._escapeHtml(text.slice(0, pos))
            const match = this._escapeHtml(text.slice(pos, pos + q.length))
            const after = this._escapeHtml(text.slice(pos + q.length))
            return `${before}<span class="cp-highlight">${match}</span>${after}`
        } else {
            let out = ''
            let qi = 0
            const ql = q.length
            for (let i = 0; i < text.length; i++) {
                const ch = text[i]
                if (qi < ql && ch.toLowerCase() === q[qi].toLowerCase()) {
                    out += `<span class="cp-highlight">${this._escapeHtml(ch)}</span>`
                    qi++
                } else {
                    out += this._escapeHtml(ch)
                }
            }
            return out
        }
    }

    /** @param {string} s */
    _escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            }[c]
        })
    }

    /** @param {number} i */
    _setSelectedIndex(i) {
        if (!this.results) return
        this.selectedIndex = Math.max(0, Math.min(i, this.filtered.length - 1))
        const nodes = Array.from(this.results.children)
        nodes.forEach((node, idx) => {
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

    /** @param {number} delta positive or negative int */
    _moveSelection(delta) {
        if (!this.filtered.length) return
        this._setSelectedIndex((this.selectedIndex + delta + this.filtered.length) % this.filtered.length)
    }

    _ensureSelectionVisible() {
        if (!this.results) return
        const node = this.results.children[this.selectedIndex]
        if (!node) return
        const containerTop = this.results.scrollTop
        const containerBottom = containerTop + this.results.clientHeight
        const nodeTop = node.offsetTop
        const nodeBottom = nodeTop + node.offsetHeight
        if (nodeTop < containerTop) this.results.scrollTop = nodeTop - 6
        else if (nodeBottom > containerBottom) {
            this.results.scrollTop = nodeBottom - this.results.clientHeight + 6
        }
    }

    _clearActiveDescendant() {
        if (!this.results) return
        this.results.removeAttribute('aria-activedescendant')
    }

    /** @param {Command} cmd */
    _runCommand(cmd) {
        try {
            if (typeof cmd.run === 'function') {
                this.hide()
                const res = cmd.run(this.window)
                if (res && typeof res.then === 'function') {
                    res.catch((/** @type Error */ err) => console.error('Command error:', err))
                }
            } else {
                console.warn('Command has no run() function', cmd)
            }
        } catch (err) {
            console.error('Command execution failed', err)
        }
    }

    /** @param {Window} win mandatory */
    init(win) {
        const hk = UC_API.Hotkeys.define({
            modifiers: 'alt shift',
            key: 'p',
            id: 'key_modalToggle',
            command: () => {
                if (!win.document) return
                this.show(win.document)
            },
        })
        hk.attachToWindow(win)
    }

    /**
     * @param {Document} doc The document to search for <key> elements.
     * @param {Object} options
     * @param {boolean} [options.replace=true]
     */
    registerKeyElements(doc, options = {}) {
        const defaults = {
            replace: true,
        }
        const opts = { ...defaults, ...options }

        console.log('commandPaletteSettings', commandPaletteSettings)
        console.log(
            '<key> elems.',
            Array.from(doc.querySelectorAll('key')).map((e) => e.id),
        )
        Array.from(doc.querySelectorAll('key'))
            .filter((elem) => elem.id && elem.id.startsWith('key_'))
            .forEach((/** @type Element & { id: string, doCommand: () => void } */ thisCommand) => {
                if (!commandPaletteSettings) return
                const contains = Object.prototype.hasOwnProperty.call(commandPaletteSettings, thisCommand.id) //  BUG: can't use HasOwn for some reason?
                if (!contains) {
                    const title = thisCommand.id.slice(4)

                    if (!opts.replace) {
                        // don't replace
                        if (this.commands.find((command) => command.id === thisCommand.id)) {
                            return
                        }
                    }

                    this.add({
                        id: thisCommand.id,
                        title: title,
                        run: () => {
                            thisCommand.doCommand()
                        },
                    })
                } else {
                    console.warn(thisCommand.id, thisCommand)
                    const { title, enabled } = commandPaletteSettings[thisCommand.id]
                    if (!enabled) return

                    if (!opts.replace) {
                        if (this.commands.find((command) => command.id === thisCommand.id)) {
                            return
                        }
                    }

                    this.add({
                        id: thisCommand.id,
                        title: title,
                        run: () => {
                            thisCommand.doCommand()
                        },
                    })
                }
                // end
            })
    }
    /**
     * @param {Document} doc The document to search for <key> elements.
     * @param {Object} options
     * @param {boolean} [options.replace=true]
     */
    registerCommandElements(doc, options = {}) {
        // console.log('commandPaletteSettings', commandPaletteSettings)
        console.log(
            '<command> elems.',
            Array.from(doc.querySelectorAll('command')).map((e) => e.id),
        )
        Array.from(doc.querySelectorAll('command')).forEach((/** @type Element & { id: string, doCommand: () => void } */ thisCommand) => {
            if (options.replace === false) {
                if (this.commands.find((command) => command.id === thisCommand.id)) {
                    // Command already exists and we are not replacing, so skip
                    return
                }
            }

            const contains = Object.prototype.hasOwnProperty.call(commandPaletteSettings, thisCommand.id)

            if (contains) {
                // we have override settings
                const { title, enabled } = commandPaletteSettings[thisCommand.id]
                if (!enabled) return

                this.add({
                    id: thisCommand.id,
                    title: title,
                    run: () => {
                        thisCommand.doCommand()
                    },
                })
            } else {
                const title = thisCommand.id.slice(4) // cmd_

                this.add({
                    id: thisCommand.id,
                    title: title,
                    run: () => {
                        thisCommand.doCommand()
                    },
                })
            }
        })
    }
}

UC_API.Windows.onCreated((win) => {
    if (!win.document || !win.document.location || !(win.document.location.href === 'chrome://browser/content/browser.xhtml')) {
        return
    }
    UC_API.Windows.waitWindowLoading(win).then(() => {
        if (!win.document) return
        if (win.document.querySelector('dialog.cp-dialog')) {
            return
        }
        win.CommandPalette = new Palette(win)
        win.CommandPalette.init(win)
    })
})
