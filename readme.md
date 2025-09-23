
scriptable command palettes
in *fox browsers

inspired by telescope.nvim

## research
https://github.com/zen-browser/desktop/discussions/820
https://github.com/BibekBhusal0/zen-custom-js/blob/main/command-palette/command-palette.uc.js
--> see if they have a better implementation
--> try to use their action configuration


## Other cool userchrome UI mods
github.com/aminought/firefox-second-sidebar

## installation

### Command Line installation (recommended)

1. open <profile>/chrome/JS directory
    if using fx-autoconfig: menu > tools > userscripts > open userscript dir
2. run this command in that directory
    ```bash
    curl -L https://github.com/eissar/fx-pickers/archive/master.tar.gz | tar -x --strip-components=1 fx-pickers-master/pickers.sys.mjs fx-pickers-master/pickers
    ```

### Manual Installation

copy ./pickers.sys.mjs and the ./pickers/ directory into your profile/chrome/JS folder.


