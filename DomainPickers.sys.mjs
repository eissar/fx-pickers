/** @import { Palette } from './lib/commandPalette.sys.mjs' */
import * as UC_API from 'chrome://userchromejs/content/uc_api.sys.mjs'
import { BrowserWindowTracker } from 'resource:///modules/BrowserWindowTracker.sys.mjs'

/**
 * @param {(win: Window) => void} onWindowReady - Callback function executed with new window when ready
 */
function withNewWindow(onWindowReady) {
    BrowserWindowTracker.promiseOpenWindow().then((/** @type {Window} */ newWin) => {
        onWindowReady(newWin)
        newWin.focus()
    })
}

// * @typedef {function(Palette): (Palette.Entry[] | Promise<Palette.Entry[]>)} Palette.PopulateFunc
/** @typedef {Palette.Entry & {count: number}} DomainPickerEntry */ // intersection type

/**
 * @param {DomainPickerEntry} a
 * @param {DomainPickerEntry} b
 */
const DomainPickerSortFunc = (a, b) => {
    const countA = a?.count ?? 0
    const countB = b?.count ?? 0
    return countB - countA
}

/**
 * @type {Palette.PopulateFunc}
 * @returns {DomainPickerEntry[]}
 */
function closeAllByDomainPickerPopulateFunc(p) {
    if (!p.window.document) return []

    const allTabs = UC_API.Windows.getAll(true).flatMap((win) => {
        return Array.from(win.gBrowser.tabs).map((tab) => tab.linkedBrowser)
    })

    /** @type {Object<string, Mocked.BrowserTab[]>} */
    const tabsByHost = {}

    allTabs.forEach((tab) => {
        const host = tab.currentURI.asciiHost
        if (host !== '') {
            if (!tabsByHost[host]) {
                tabsByHost[host] = []
            }
            tabsByHost[host].push(tab)
        }
    })

    return Object.keys(tabsByHost).map((host) => {
        const matchingTabs = tabsByHost[host]

        return {
            title: host,
            run: (win, entry) => {
                if (Services.prompt.confirm(win, `Close all tabs matching '${host}' ?`, `close ${entry.count} tabs?`)) {
                    matchingTabs.forEach((tab) => {
                        tab.linkedBrowser.closeBrowser()
                    })
                }
            },
            displaySubtitle: `${matchingTabs.length} tabs`,
            count: matchingTabs.length,
        }
    })
}
/**
 * @type {Palette.PopulateFunc}
 * @returns {DomainPickerEntry[]}
 */
function moveAllByDomainToNewWindowPickerPopulateFunc(p) {
    if (!p.window.document) return []

    const allTabs = UC_API.Windows.getAll(true).flatMap((win) => {
        return Array.from(win.gBrowser.tabs)
    })

    /** @type {Object<string, Mocked.BrowserTab[]>} */
    const tabsByHost = {}

    allTabs.forEach((tab) => {
        const host = tab.linkedBrowser.currentURI.asciiHost
        if (host !== '') {
            if (!tabsByHost[host]) {
                tabsByHost[host] = []
            }
            tabsByHost[host].push(tab)
        }
    })

    return Object.keys(tabsByHost).map((host) => {
        const matchingTabs = tabsByHost[host]
        /** @type {Palette.Entry} */
        return {
            title: host,
            displaySubtitle: `${matchingTabs.length} tabs`,
            run: (win, entry) => {
                if (!Services.prompt.confirm(win, `Move all tabs matching '${host}' ?`, `move ${entry.count} tabs?`)) {
                    return
                }
                /** @param {Window} win */
                function removeDefaultTab(win) {
                    const tab = win.gBrowser.tabs[0]
                    if (tab?.linkedBrowser.currentURI.spec === 'about:blank') {
                        win.gBrowser.removeTab(tab)
                    }
                }
                /**
                 * @param {Window} win
                 * @param {Mocked.BrowserTab[]} tabs
                 **/
                function fixWindowTabs(win, tabs) {
                    tabs.forEach((tab, index) => {
                        win.gBrowser.adoptTab(tab, true)
                        if (index === 0) removeDefaultTab(win)
                    })
                }
                withNewWindow((newWin) => fixWindowTabs(newWin, matchingTabs))
            },
            count: matchingTabs.length,
        }
    })
}
// we will need to register custom event handlers to populate the picker on
/** @typedef {Palette.Entry & {tab: Mocked.BrowserTab}} OpenTabsEntry */ // intersection type
/**
 * @type {Palette.PopulateFunc}
 * @returns {OpenTabsEntry[]}
 */
function openTabsPickerPopulateFunc(p) {
    if (!p.window.document || !p.window.gBrowser?.tabs) {
        return []
    }

    const allTabCommands = UC_API.Windows.getAll(true).flatMap((win) => {
        const tabsArray = Array.from(win.gBrowser.tabs)
        return tabsArray.map((tab) => {
            // /** @type { nsIURI } */

            /** @type string */
            const uri = tab.linkedBrowser.currentURI.asciiSpec

            return {
                title: tab.label,
                run: () => {
                    win.gBrowser.selectedTab = tab
                    win.focus()
                },
                subtitle: uri,
                tab: tab,
                // displaySubtitle: uri, // use for information but can't filter based on this.
                // displayTitle: `${tab.label} ${Math.random()}`,
            }
        })
    })
    return allTabCommands
}
/**
 * @typedef {Palette.Entry & {domain?: string,matchingTabs: Mocked.BrowserTab[]}} domainTabsEntry
 */

/**
 * @type {Palette.PopulateFunc}
 * @returns {domainTabsEntry[]}
 */
function populateDomainTabsPicker(p) {
    if (!p.window.document) return []

    const allTabs = UC_API.Windows.getAll(true).flatMap((win) => {
        return Array.from(win.gBrowser.tabs)
    })

    /** @type {Object<string, Mocked.BrowserTab[]>} */
    const tabsByHost = {}

    allTabs.forEach((tab) => {
        const host = tab.linkedBrowser.currentURI.asciiHost
        if (host !== '') {
            if (!tabsByHost[host]) {
                tabsByHost[host] = []
            }
            tabsByHost[host].push(tab)
        }
    })

    return Object.keys(tabsByHost).map((host) => {
        const matchingTabs = tabsByHost[host]

        return {
            title: host,
            run: (win, entry) => {
                console.log(matchingTabs)
            },
            displaySubtitle: `${matchingTabs.length} tabs`,
            count: matchingTabs.length,
            domain: host,
            matchingTabs: matchingTabs,
        }
    })
}

/**
 * @type {Parameters<HTMLInputElement['addEventListener']>}
 * Use only in openTabsPicker
 */
const closeSelectedTabBinding = (() => {
    /** @type {Palette.CustomBindingHandler} */
    function closeSelectedTab(e) {
        if (e.ctrlKey && e.key === 'c') {
            const selected = /** @type {OpenTabsEntry} */ (this.filtered[this.selectedIndex])
            const index = this.commands.indexOf(selected)

            // HACK: do this for now until we've implemented dynamic filtering
            // could we also just do populateBehavior OnAfterRun ?
            this.remove(index)
            selected.tab.linkedBrowser.closeBrowser()
        }
    }

    return ['keyup', closeSelectedTab]
})()
/**
 * @type {Parameters<HTMLInputElement['addEventListener']>[]}
 */
const domainTabsCustomBindings = (() => {
    /** @type {Palette.CustomBindingHandler} */
    function closeDomainTabs(e) {
        if (e.ctrlKey && e.key === 'c') {
            e.preventDefault()
            this.hide() // hide the picker
            const selected = /** @type {domainTabsEntry} */ (this.filtered[this.selectedIndex])
            const index = this.commands.indexOf(selected)
            if (Services.prompt.confirm(this.window, `Close all tabs matching '${selected.title}' ?`, `close ${selected.matchingTabs.length} tabs?`)) {
                selected.matchingTabs.forEach((tab) => {
                    tab.linkedBrowser.closeBrowser()
                })
            }
            this.remove(index) // remove from picker
        }
    }
    /** @type {Palette.CustomBindingHandler} */
    function moveDomainTabs(e) {
        if (e.ctrlKey && e.key === 'm') {
            e.preventDefault()
            this.hide() // hide the picker
            const selected = /** @type {domainTabsEntry} */ (this.filtered[this.selectedIndex])
            // const index = this.commands.indexOf(selected)
            if (!Services.prompt.confirm(this.window, `Move all tabs matching '${selected.domain}' ?`, `move ${selected.matchingTabs.length} tabs?`)) {
                return
            }
            /** @param {Window} win */
            const removeDefaultTab = (win) => {
                const tab = win.gBrowser.tabs[0]
                if (tab?.linkedBrowser.currentURI.spec === 'about:blank') {
                    win.gBrowser.removeTab(tab)
                }
            }
            /**
             * @param {Window} win
             * @param {Mocked.BrowserTab[]} tabs
             **/
            const fixWindowTabs = (win, tabs) => {
                tabs.forEach((tab, index) => {
                    win.gBrowser.adoptTab(tab, true)
                    if (index === 0) removeDefaultTab(win)
                })
            }
            withNewWindow((newWin) => {
                console.log(newWin)
                console.log(selected)
                fixWindowTabs(newWin, selected.matchingTabs)
            })
        }
    }
    return [
        ['keyup', closeDomainTabs], //
        ['keyup', moveDomainTabs],
    ]
})()

export const DomainPickers = {
    /** @type {Palette.Registration[]} */
    RegisterPalettes: [
        {
            id: 'moveAllByDomainToNewWindow',
            populateFunc: moveAllByDomainToNewWindowPickerPopulateFunc,
            opts: {
                populateBehavior: ['OnShow'],
                initialSortFunc: DomainPickerSortFunc,
            },
        },
        {
            id: 'closeAllByDomainPicker',
            populateFunc: closeAllByDomainPickerPopulateFunc,
            opts: {
                populateBehavior: ['OnShow'],
                initialSortFunc: DomainPickerSortFunc,
            },
        },
        {
            // generalized picker over
            // domain -> urls
            id: 'domainTabsPicker',
            populateFunc: populateDomainTabsPicker,
            opts: {
                populateBehavior: ['OnShow'],
                initialSortFunc: DomainPickerSortFunc,
                customBindings: domainTabsCustomBindings,
                OnAfterInitCallback: (palette) => {
                    UC_API.Hotkeys.define({
                        modifiers: 'alt shift',
                        key: 'd',
                        id: `key_domainTabsPicker`,
                        command: () => {
                            if (!palette.window.document) return
                            palette.show(palette.window.document)
                        },
                    }).attachToWindow(palette.window, { suppressOriginal: true })
                },
            },
        },
        {
            id: 'openTabsPicker',
            populateFunc: openTabsPickerPopulateFunc,
            opts: {
                customBindings: [
                    closeSelectedTabBinding, // close this tab
                ],
                populateBehavior: ['OnShow'],
                width: 90,
                OnAfterInitCallback: (palette) => {
                    UC_API.Hotkeys.define({
                        modifiers: 'alt shift',
                        key: 'l',
                        id: `key_openTabsPicker`, // <- TODO: UGLY
                        command: () => {
                            if (!palette.window.document) return
                            palette.show(palette.window.document)
                        },
                    }).attachToWindow(palette.window, { suppressOriginal: true })
                },
            },
        },
    ],
}
