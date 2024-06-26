// ==UserScript==
// @name         Better DEXTools
// @namespace    https://github.com/yvvw/tampermonkey-scripts
// @version      0.0.2
// @description
// @author       yvvw
// @icon         https://www.dextools.io/app/favicon.ico
// @license      MIT
// @updateURL    https://mirror.ghproxy.com/https://github.com/yvvw/tampermonkey-scripts/releases/download/latest/dextools.meta.js
// @downloadURL  https://mirror.ghproxy.com/https://github.com/yvvw/tampermonkey-scripts/releases/download/latest/dextools.user.js
// @match        https://www.dextools.io/*
// @grant        none
// ==/UserScript==

import { observe } from './util'

window.onload = function main() {
  observe(() => hideAd())
}

function hideAd() {
  Array.from(document.querySelectorAll<HTMLSpanElement>('span'))
    .filter((it) => it.innerText === 'Ad')
    .forEach((el) => {
      if (
        el.nextElementSibling?.tagName === 'BUTTON' &&
        el.nextElementSibling?.ariaLabel === 'Close'
      ) {
        ;(el.nextElementSibling as HTMLButtonElement).click()
      }
    })
}
