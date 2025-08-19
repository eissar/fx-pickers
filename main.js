import { Palette } from './commandPalette.sys.mjs'
// function register
UC_API.Windows.onCreated((win) => {
    if (!win.document || !win.document.location || !(win.document.location.href === 'chrome://browser/content/browser.xhtml')) {
        return
    }
    UC_API.Windows.waitWindowLoading(win).then(() => {
        if (!win.document) return
        if (win.document.querySelector('dialog.cp-dialog')) {
            return
        }
        const palette = new Palette(win)
        palette.init(win)
        const hk = UC_API.Hotkeys.define({
            modifiers: 'alt shift',
            key: 'p',
            id: 'key_modalToggle',
            command: () => {
                if (!win.document) return
                palette.show(win.document)
            },
        })
        hk.attachToWindow(win)
        win.CommandPalette = palette
    })
})
;(async () => {
    const { EveryWindow } = await import('resource:///modules/EveryWindow.sys.mjs')
    const initCallback = (win) => {
        /** @type {Palette.PopulateFunc} */
        const populateFn = (a) => {
            return []
        }

        const p = new Palette(win, populateFn)
        p.init()
    }
    EveryWindow.registerCallback('every.sys.mjs', initCallback, () => {})
})()
