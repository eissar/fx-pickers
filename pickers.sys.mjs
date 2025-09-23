import * as UC_API from 'chrome://userchromejs/content/uc_api.sys.mjs'

import { Palette } from './pickers/lib.sys.mjs'

/**
 * @typedef {Object} OverrideSettingsEntry
 * @property {string} title
 * @property {boolean} enabled
 */

// remap names and disable certain built in commands
/** @type {Object.<string, OverrideSettingsEntry>} */
const overrideSettings = (function () {
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

/** @type {Palette.PopulateFunc} */
function commandPalettePopulateFunc(p) {
    const commandElements = getCommands(p.window)

    const cmds = commandElements.map((c) => {
        const hasOverride = Object.prototype.hasOwnProperty.call(overrideSettings, c.id)
        if (hasOverride) {
            const { title, enabled } = overrideSettings[c.id]
            // console.log(c.id, title, enabled)
            if (!enabled) {
                return false // Return an empty array to exclude this command
            }
            return {
                // Return an array containing the command object
                id: c.id,
                title: title,
                run: () => {
                    c.doCommand()
                },
            }
        } else {
            const getTitle = (/** @type {string} */ d) => {
                if (d.substring(0, 4) === 'cmd_') {
                    return d.slice(4)
                }
                return d
            }

            // const title = c.id.slice(4)
            const title = getTitle(c.id)
            return {
                // Return an array containing the command object
                id: c.id,
                title: title,
                run: () => {
                    c.doCommand()
                },
            }
        }
    })

    return cmds.filter((arr) => arr !== false)
}
/**
 * @param {Window} win
 * @returns {XULElement[]}
 **/
function getCommands(win) {
    if (!win.document) return []
    /** @type {XULElement[]} */
    const sets = Array.from(win.document.querySelectorAll('commandset'))
    return sets
        .map((set) => {
            return Array.from(set.querySelectorAll('command'))
        })
        .flat()
}

/** @type {Palette.PopulateFunc} */
function aboutPagesPopulateFunc(p) {
    // get all `about:` pages
    const prefix = '@mozilla.org/network/protocol/about;1?what='
    const about_pages = Object.keys(Cc)
        .filter((a) => a.startsWith(prefix))
        .map((a) => a.slice(prefix.length))

    return about_pages.map((name) => {
        const aboutPage = `about:${name}`
        return {
            id: name,
            title: aboutPage,
            run: (win) => {
                win.URILoadingHelper.openTrustedLinkIn(win, 'about:preferences', 'tab')
            },
        }
    })
}

/** @type {Palette.PopulateFunc} */
function pickerPickerPopulateFunc(p) {
    if (!p.window.document) return []
    return Array.from(p.window.document.querySelectorAll('dialog.cp-dialog')).map((/** @type HTMLDialogElement */ elem) => {
        /** @type Palette.Entry */
        const cmd = {
            id: elem.getAttribute('data-cp-id') || 'ERR',
            title: elem.getAttribute('data-cp-id') || 'ERR',
            run: () => {
                elem.dispatchEvent(new CustomEvent('picker:open'))
                console.log(elem)
                // elem.show() // does not work
            },
        }
        return cmd
    })
}

// /** @typedef {Palette.Entry & {count: number}} DomainPickerCommand */ // intersection type

// define and initialize pickers.
;(async () => {
    // ChromeUtils.importESModule ?
    const { EveryWindow } = await import('resource:///modules/EveryWindow.sys.mjs')
    const initCallback = (/** @type {Window} */ win) => {
        const defineHotkey = UC_API.Hotkeys.define

        {
            const thisPickerId = 'toggleCommandPalette' // <---
            const palette = new Palette(win, thisPickerId, commandPalettePopulateFunc, {
                populateBehavior: ['OnShow'],
                fuzzy: false, // we want to find commands by their names exactly.
            })
            palette.init(win)

            defineHotkey({
                modifiers: 'alt shift',
                key: 'p',
                id: `key_${thisPickerId}`,
                command: () => {
                    if (!win.document) return
                    palette.show(win.document)
                },
            }).attachToWindow(win)
        }

        {
            const thisPickerId = 'togglePickerPicker'
            const palette = new Palette(win, thisPickerId, pickerPickerPopulateFunc, {
                populateBehavior: ['OnShow'], // which pickers are 'enabled' is dynamic
            })
            palette.init(win)

            defineHotkey({
                modifiers: 'alt shift',
                key: 'q',
                id: `key_${thisPickerId}`,
                command: () => {
                    if (!win.document) return
                    palette.show(win.document)
                },
            }).attachToWindow(win, { suppressOriginal: true })

            // TODO:
            // add cp-data-host to filter hotkey; hostFilter to opts
            // pseudo:
            // host = p.window.gBrowser.selectedTab.linkedBrowser.currentURI.host
            // if p.dialog.hasAttribute('data-cp-hosts') filterHosts = getAttribute'data-cp-hosts'
            // /** @type []string */
            // filterHosts.includes(host)
            //
        }
        {
            const thisPickerId = 'aboutPages'
            const palette = new Palette(win, thisPickerId, aboutPagesPopulateFunc, {
                populateBehavior: ['OnShow'],
            })
            palette.init(win)
        }
        // {
        //     /* modules can also export an array of palettes we can use to
        //      * quickly register many palettes at once.
        //      *
        //      * ```js
        //      * // returns { Palette.Registration }
        //      * await import('./eagle.sys.mjs').then( ({RegisterPalettes}) => {
        //      *     RegisterPalettes.forEach((p) => {
        //      *         ...
        //      *     }
        //      * })
        //      * ```
        //      */
        //     import { BrowserWindowTracker } from 'resource:///modules/BrowserWindowTracker.sys.mjs'
        //
        //     import { Eagle } from './eagle.sys.mjs'
        //     Eagle.RegisterPalettes.forEach((p) => {
        //         const thisPickerid = p.id
        //         const palette = new Palette(win, thisPickerid, p.populateFunc, p.opts)
        //         palette.init(win)
        //     })
        // }
        // {
        //     import { Raindrop } from './raindrop.sys.mjs'
        //     Raindrop.RegisterPalettes.forEach((p) => {
        //         const thisPickerid = p.id
        //         const palette = new Palette(win, thisPickerid, p.populateFunc, p.opts)
        //         palette.init(win)
        //     })
        // }
        // {
        //     import { DomainPickers } from './DomainPickers.sys.mjs'
        //     DomainPickers.RegisterPalettes.forEach((p) => {
        //         const thisPickerid = p.id
        //         const palette = new Palette(win, thisPickerid, p.populateFunc, p.opts)
        //         palette.init(win)
        //     })
        // }
        // win.CommandPalette = palette
    }
    EveryWindow.registerCallback('picker.sys.mjs', initCallback, () => {})
})()
