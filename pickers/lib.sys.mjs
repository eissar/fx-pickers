/**
 * @namespace Palette
 * userchrome meant to be used by other scripts
 */

// TODO: set cursor pos on init

// TODO: Add 'onQuery' to populate behavior somehow / don't populate anything when resultText.len < 2

// TODO: Add 'Anchor' to anchor to docShell or something else

// TODO:  @param {Palette.SorterFunc} populateFunc

/**
 * A function used to populate commands for the palette.
 * Called on `show` and optionally on `init` to retrieve an array of commands.
 * behavior of when this is called is modulated by the palette instances' opts.
 *
 * @typedef {function(Palette): (Palette.Entry[] | Promise<Palette.Entry[]>)} Palette.PopulateFunc
 * @param {Palette} palette The palette instance for which commands are being populated.
 * @returns {Palette.Entry[]} An array of Command objects to be displayed in the palette.
 *
 */

/**
 * @callback Palette.CustomBindingHandler
 * @param {KeyboardEvent} e
 * @this {Palette} - we bind in `Palette._wrapCustomBindings` later.
 */

/**
 * example:
 *
 * ```js
 *  RegisterPalettes: [
 *      {
 *          id: 'switchLibraries:eagle',
 *          populateFunc: getEagleLibrariesPopulateFunc,
 *          opts: { populateBehavior: ['OnShow'] },
 *      },
 *  ]
 * ```
 *
 * @typedef {Object} Palette.Registration
 * @property {string}                id          - Unique identifier for the registration.
 * @property {Palette.PopulateFunc}  populateFunc - Function used to populate the palette.
 * @property {Palette.Options}      [opts]       - Optional configuration options.
 */

/**
 * Function type for executing a command.
 * @callback Palette.RunFunc
 * @param {Window} win
 * @param {Palette.Entry & any} entry   - Accepts anything that includes `Palette.Entry`.
 * * @returns {void|Promise<void>}
 */

/**
 * Configuration options for the Palette.
 * @typedef {Object} Palette.Options
 * @property {string} [placeholder]
 * @property {number} [maxVisible]
 * @property {number|string} [width='min(90vw, 720px)'] - Sets the width.
 * If a number, treated as a percentage of the viewport (e.g., 50 → '50%').
 * If a string, used directly as a CSS width value (e.g., '500px', 'min(90vw, 720px)').
 * @property {number} [minQueryLength=0]
 * @property {boolean} [fuzzy=true] If `true`, enable fuzzy search behavior.
 * @property {("OnInit"|"OnFirstShow"|"OnShow")[]} [populateBehavior=["onFirstShow"]] - An array of one or more strings defining when the element's content should be populated.
 * Possible values are "OnInit", "OnFirstShow", or "OnShow". Defaults to `["onFirstShow"]`.
 * @property {string} [title] - The display text for the title.
 * If empty defaults to the Palette instance's `id`.
 * @property {string[]} [hostAllowList] A list of hostnames (e.g., google.com, gemini.google.com) that restrict when the picker UI is enabled. If the current webpage's hostname is not in this list, the picker will not be displayed. This enables context-sensitive display of pickers. cannot be []
 * @property {boolean} [highlight=true] if `true`, enable highlighting of entries as you type.
 * @property {function(Palette.Entry & any, Palette.Entry & any): number} [initialSortFunc] - compareFn as passed to array.sort.
 * when this get called depends on the setting of populateBehavior
 * @property {Parameters<HTMLInputElement['addEventListener']>[]} [customBindings] - Custom event bindings for the input element.
 * WARNING: do not use arrow functions if you need to access Palette's `this` object!
 *
 * @property {(p: Palette) => void} [OnAfterInitCallback] - Custom event bindings for the input element.
 */

/**
 * Represents a single command that can be executed.
 *
 * You can extend this type to include any extra information you need for display.
 *
 * example:
 * ```js
 * // Extend Palette.Entry with an extra `description` field.
 * // `populateFunc` returns an array of command objects:
 * // typedef {(Palette.Entry & { description: string })[]} DescriptiveCommand // intersection type
 *
 * function populateFunc(palette) {
 *   // type {DescriptiveCommand[]}
 *   return [
 *     {
 *       id: 'show-info',
 *       title: 'Show Info',
 *       // The `run` function receives a window object.
 *       run: (w) => {
 *         console.log('current URI:', w.gBrowser.selectedTab.linkedBrowser.documentURI.spec);
 *       },
 *       description: 'proc_ID: 2048; start_time: 12:08'
 *     }
 *   ];
 * }
 *
 * // Use the extra `description` in the entry maker to customize the display text.
 * const entryMaker = (entry) => ({
 *   displayText: entry.description
 * });
 * ```
 *
 * // The picker will show `displayText` but selection and filtering
 * // remain based on the original command properties.
 *
 * @typedef {Object} Palette.Entry
 * @property {string|false} [id=false] - Unique identifier for the command; set to `false` when the command has no identifier.
 * @property {string} title - Human‑readable title of the command (used for filtering).
 * @property {string} [displayTitle] - Optional title that overrides the displayed text; does not influence filtering.
 * @property {string} [subtitle] - Optional subtitle shown below the title (also used for filtering).
 * @property {string} [displaySubtitle] - Optional subtitle that overrides the displayed text; does not influence filtering.
 * @property {Palette.RunFunc} run - Callback executed when the command is selected.
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
 *
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
 *
 * ```js
 * // Example of a PopulateFunc that dynamically generates commands:
 * (palette) => {
 *   const dynamicCommands = [];
 *   h
 *   if (palette.bufferName === 'scratch') {
 *     dynamicCommands.push({
 *       name: 'clear-scratch',
 *       execute: () => { console.log('Clearing scratch buffer...'); }
 *     });
 *   }
 *   return dynamicCommands;
 * };
 * ```
 * @note The Command Palette cannot be reused across multiple windows, as it is not a widget.
 */
export class Palette {
    /**
     * @param {Window} win
     * @param {string} id
     * @param {Palette.PopulateFunc} populateFunc
     * @param {Palette.Options} [opts={}]
     */
    constructor(win, id, populateFunc, opts = {}) {
        this.id = id
        this.title = opts.title || id
        this.window = win
        if (!win.document) {
            throw new Error('Invalid window passed to constructor')
        }
        this.document = win.document
        this.dialog = this.document.createElement('dialog')
        this.input = this.document.createElement('input')
        this.results = this.document.createElement('div')
        this.emptyState = this.document.createElement('div')

        /** @type {Palette.Entry[]} */
        this.commands = []
        /** @type {Palette.Entry[]} */
        this.filtered = []

        this.selectedIndex = 0
        this.ranOnce = false

        this.populateFunc = async (/** @type {Parameters<Palette.PopulateFunc>} */ ...rest) => {
            // HACK: Ensure the original populateFunc's result is always wrapped in a Promise
            // This makes `this.populateFunc` an async function that can be awaited,
            // regardless of whether the original `populateFunc` was synchronous or already async.
            return await Promise.resolve(populateFunc(...rest))
        }

        /** @type {Palette.Options} */
        this.options = {
            // default options
            placeholder: 'Type a command...',
            maxVisible: 8,
            minQueryLength: 0,
            fuzzy: true,
            populateBehavior: ['OnFirstShow'],
            /** If a number, sets the width of the palette to a percentage of the viewport. */
            width: 'min(90vw, 720px)',
            highlight: true,
            ...opts,
        }
        if (this.options.hostAllowList && this.options.hostAllowList.length === 0) {
            throw 'hostAllowList cannot be defined as []'
        }
        if (!this.options.populateBehavior) {
            this.options.populateBehavior = ['OnFirstShow']
        }
        this._buildUI()

        if (opts.customBindings) this._bindEvents(this._wrapCustomBindings(opts.customBindings))
        else this._bindEvents(false)

        if (opts.OnAfterInitCallback) this.OnAfterInitCallback = opts.OnAfterInitCallback
        else this.OnAfterInitCallback = false

        // capture initial mouse position for threshold
        this.mouseState = this._waitForMouseDelta(this._getMousePos())
    }

    _getMousePos() {
        return { x: this.window.MousePosTracker._x, y: this.window.MousePosTracker._y }
    }

    /**
     * Show the palette.
     * @param {Document} doc
     * @param {string} [prefill=""]
     */
    async show(doc, prefill = '') {
        if (this.options.populateBehavior === undefined) throw 'populate behavior is somehow undefined'
        if (!doc.body) return

        this.mouseState = this._waitForMouseDelta(this._getMousePos())

        if (this.options.hostAllowList) {
            const currentHostname = this.window.gBrowser.selectedTab.linkedBrowser.currentURI.host
            if (!this.options.hostAllowList.includes(currentHostname)) {
                return // Prevent showing the dialog
            }
        }

        if (!this.ranOnce) {
            this.ranOnce = true
            if (this.options.populateBehavior.includes('OnFirstShow')) {
                this.setCommands(await this.populateFunc(this))
            }
        }

        if (this.options.populateBehavior.includes('OnShow')) {
            this.setCommands(await this.populateFunc(this))
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
    }

    /**
     * Add a new command to this.commands
     * @param {Palette.Entry} cmd
     */
    add(cmd) {
        // if (!cmd || !cmd.id) throw new Error('Command must have an id')
        let existingCmdIndex = -1
        if (cmd.id) {
            // cmd.id is false by default
            existingCmdIndex = this.commands.findIndex((obj) => obj.id === cmd.id)
        }
        if (existingCmdIndex !== -1) {
            this.commands[existingCmdIndex] = cmd
        } else {
            this.commands.push(cmd)
        }
        this.setCommands(this.commands)
    }
    /**
     * Remove a command from this.commands by identifier or index
     * @param {string|Palette.Entry|number} identifier - command id, command object with an id, or index
     */
    remove(identifier) {
        // If a number is provided, treat it as an index
        if (typeof identifier === 'number') {
            const idx = identifier
            if (idx < 0 || idx >= this.commands.length) return
            this.commands.splice(idx, 1)
            this.setCommands(this.commands)
            return
        }
        const id = typeof identifier === 'string' ? identifier : identifier?.id
        if (!id) return
        const index = this.commands.findIndex((obj) => obj.id === id)
        if (index !== -1) {
            this.commands.splice(index, 1)
            this.setCommands(this.commands)
        }
    }

    /**
     * Replace the command list.
     * @param {Palette.Entry[]} list
     */
    setCommands(list) {
        this.commands = Array.isArray(list) ? list.slice() : []
        if (this.options.initialSortFunc && typeof this.options.initialSortFunc === 'function') {
            this.filtered = this.commands = this.commands.sort(this.options.initialSortFunc)

            this._renderResults('')
        }
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

        // metadata
        this.dialog.setAttribute('data-cp-id', this.id)
        if (Array.isArray(this.options.hostAllowList)) {
            this.dialog.setAttribute('data-hostAllowList', this.options.hostAllowList.join(' '))
        }
        this.dialog.setAttribute('title', this.title)

        //  'min(90vw, 720px)',
        let calculatedWidth
        if (typeof this.options.width === 'number') {
            calculatedWidth = `${this.options.width}%`
        } else if (typeof this.options.width === 'string') {
            calculatedWidth = this.options.width
        }
        // styling
        Object.assign(this.dialog.style, {
            padding: '0',
            border: '0',
            // maxWidth: '720px',
            borderRadius: '12px',
            background: 'transparent',
            boxShadow: 'var(--cp-dialog-shadow)',
            width: calculatedWidth,
        })
        const card = this.document.createElement('div')
        card.className = 'cp-card'
        const searchWrap = this.document.createElement('div')
        searchWrap.className = 'cp-search-wrap'
        this.input.type = 'search'
        this.input.placeholder = this.options.placeholder
        this.input.autocomplete = 'off'
        this.input.spellcheck = false
        this.input.className = 'cp-input'
        const hint = this.document.createElement('div')
        hint.className = 'cp-hint'
        hint.textContent = this.title
        searchWrap.append(this.input, hint)
        this.results.className = 'cp-results'
        this.results.style.maxHeight = `${this.options.maxVisible * 54}px`
        this.emptyState.className = 'cp-empty-state'
        this.emptyState.textContent = 'No commands found'
        card.append(searchWrap, this.results, this.emptyState)
        this.dialog.appendChild(card)
        this.document.body.appendChild(this.dialog)
        const style = this.document.createElement('style')
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
      .cp-item.cp-selected {
        background: var(--cp-item-hover-bg);
      }
      /* Disable hover styling when cp-mouse-locked is present,
        but NOT for items that are also cp-selected.
      */
      .cp-results.cp-mouse-locked .cp-item:not(.cp-selected):hover {
        background: var(--cp-bg-card); /* Reverts to the default background of the card */
      }
      /* Disable hover pointer cursor on hover */
      .cp-results.cp-mouse-locked {
        cursor: default;
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
        this.document.head.appendChild(style)
    }

    /**
     * Wrap custom event listener bindings by binding each listener function to the current class instance.
     *
     * @param {Parameters<HTMLInputElement['addEventListener']>[]} binds
     *        An array of listener tuples as accepted by `addEventListener`.
     * @returns {Parameters<HTMLInputElement['addEventListener']>[]}
     *          A new array with the same structure where each function listener
     *          is bound to `this`. Non‑function listeners (e.g., arrow functions) are left unchanged.
     */
    _wrapCustomBindings(binds) {
        return binds.map((binding) => {
            try {
                // binding can be [type, listener] or [type, listener, options]
                const [type, listener, ...rest] = binding
                // Only functions need binding; arrow functions already capture `this`
                const boundListener = typeof listener === 'function' ? listener.bind(this) : listener
                // Re‑assemble the tuple preserving any extra options
                return [type, boundListener, ...rest]
            } catch (err) {
                console.error('Error binding listener for event', binding, err)
                // Return the original binding unchanged to avoid breaking the array
                return binding
            }
        })
    }

    /**
     *  @private
     *  @param {Parameters<HTMLInputElement['addEventListener']>[] | false} customBindings
     */
    _bindEvents(customBindings) {
        if (customBindings) {
            customBindings.forEach((binding) => {
                this.dialog.addEventListener(...binding)
            })
        }

        this.input.addEventListener('input', this._onInput)
        this.dialog.addEventListener('click', this._onDialogClick)
        this.dialog.addEventListener('close', this._onClose)
        // this.dialog.addEventListener('picker:firstShow', this._onFirstShow)
        this.dialog.addEventListener('picker:open', () => {
            if (!this.window.document) return
            this.show(this.window.document)
        })
        this.document.addEventListener('keydown', this._onKeyDown, true)
    }

    /** @private */
    _removeEvents() {
        this.input.removeEventListener('input', this._onInput)
        // this.dialog.removeEventListener('picker:firstShow', this._onFirstShow)
        this.dialog.removeEventListener('click', this._onDialogClick)
        this.dialog.removeEventListener('close', this._onClose)
        this.document.removeEventListener('keydown', this._onKeyDown, true)
    }

    /** @private */
    _onClose = () => {
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
                    e.stopImmediatePropagation()
                    const cmd = this.filtered[this.selectedIndex]
                    if (cmd) this._runCommand(cmd)
                }
                break
            case 'p':
                if (e.ctrlKey) {
                    e.preventDefault()
                    this._moveSelection(-1)
                }
                break
            case 'n':
                if (e.ctrlKey) {
                    e.preventDefault()
                    this._moveSelection(1)
                }
                break
        }
    }

    /** @private */
    _onQueryChange() {
        const q = this.input.value.trim()
        let results
        if (q.length >= this.options.minQueryLength) {
            results = this._filterCommands(q)
        } else {
            results = this.commands.slice()
        }
        this.filtered = results
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, results.length - 1))
        if (this.selectedIndex < 0) this.selectedIndex = 0
        this._renderResults(q)
    }

    /**
     * @private
     * @param {string} q
     * @returns {Palette.Entry[]}
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

    // * @param {EventTarget} element - The element to listen for mouse moves on.
    /**
     * @private
     * Returns a promise that resolves when the mouse moves more than a given
     * threshold from a specified starting point.
     * @param {{x: number, y: number}} initialPosition - The starting coordinates.
     * @param {number} threshold - The distance in pixels to wait for.
     * @returns {Promise<MouseEvent>}
     */
    _waitForMouseDelta(initialPosition, threshold = 25) {
        return new Promise((resolve) => {
            const { x: initialX, y: initialY } = initialPosition

            const moveListener = (/** @type {MouseEvent} */ event) => {
                event.preventDefault()

                const dx = event.clientX - initialX
                const dy = event.clientY - initialY
                const distance = Math.sqrt(dx * dx + dy * dy)

                if (distance > threshold) {
                    this.dialog.removeEventListener('mousemove', moveListener)
                    resolve(event)
                }
            }
            this.dialog.addEventListener('mousemove', moveListener)
        })
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

        this.results.classList.add('cp-mouse-locked') // block :hover styling until mouseMovePromise resolves.

        const mouseMovePromise = this.mouseState

        mouseMovePromise.then(() => {
            this.results.classList.remove('cp-mouse-locked') // block :hover styling until mouseMovePromise resolves.
        })

        this.filtered.forEach((cmd, idx) => {
            const item = this._createResultItem(cmd, idx, query, mouseMovePromise)
            this.results.appendChild(item)
        })
        this._ensureSelectionVisible()
    }

    /**
     * Creates and returns a single command result item element.
     * @private
     * @param {Palette.Entry} entry - The entry object.
     * @param {number} idx - The index of the command in the filtered list.
     * @param {string} query - The search query for highlighting.
     * @param {Promise<any>} mouseThrottleExceeded
     * @returns {HTMLElement} The created item element.
     */
    _createResultItem(entry, idx, query, mouseThrottleExceeded) {
        const item = this.document.createElement('div')
        item.className = 'cp-item'
        item.setAttribute('data-cmd-id', entry.id || String(idx))

        const titleDiv = this.document.createElement('div')
        titleDiv.className = 'cp-title'
        // Prefer entry.displayTitle; fall back to entry.title
        const titleText = entry.displayTitle ?? entry.title ?? ''
        titleDiv.innerHTML = this._highlight(titleText, query)
        item.appendChild(titleDiv)

        // Prefer entry.displaySubtitle; fall back to entry.subtitle
        const subtitleText = entry.displaySubtitle ?? entry.subtitle
        if (subtitleText) {
            const sub = this.document.createElement('div')
            sub.className = 'cp-sub'
            sub.innerHTML = this._highlight(subtitleText, query)
            item.appendChild(sub)
        }

        item.addEventListener('click', (ev) => {
            ev.stopPropagation()
            this.selectedIndex = idx
            this._runCommand(entry)
        })

        // once we have moved more than a certain amount,
        // resume accepting mouse hover events
        mouseThrottleExceeded.then(() => {
            item.addEventListener('mousemove', () => {
                this._setSelectedIndex(idx)
            })
        })

        if (idx === this.selectedIndex) {
            item.classList.add('cp-selected')
            item.id = `cp-item-${idx}`
        }

        return item
    }

    /**
     * @private
     * @param {string} text
     * @param {string} query
     * @returns {string}
     */
    _highlight(text, query) {
        if (!this.options.highlight) return this._escapeHtml(text) // highlighting is disabled
        // TODO: make this work with display text

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
            node.classList.remove('cp-selected')
            node.removeAttribute('id')
            if (idx === this.selectedIndex) {
                node.classList.add('cp-selected')
                node.id = `cp-item-${idx}`
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
        if (node) {
            node.scrollIntoView({ block: 'nearest' })
        }
    }

    /**
     * @private
     * @param {Palette.Entry} entry
     */
    _runCommand(entry) {
        try {
            if (typeof entry.run === 'function') {
                this.hide()
                const res = entry.run(this.window, entry)
                if (res && typeof res.then === 'function') {
                    res.catch((err) => console.error('Command error:', err))
                }
            } else {
                console.warn('Command has no run() function', entry)
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
        if (this.options.populateBehavior === undefined) throw 'populate behavior is undefined'
        if (this.options.populateBehavior.includes('OnInit')) {
            ;(async () => {
                this.setCommands(await this.populateFunc(this))
            })()
        }
        if (typeof this.OnAfterInitCallback === 'function') {
            this.OnAfterInitCallback(this)
        }
    }
}
