// ==UserScript==
// @name         Better Douyin
// @namespace    https://github.com/yvvw/browser-scripts
// @homepageURL  https://github.com/yvvw/browser-scripts/blob/main/src/douyin.user.ts
// @version      0.0.6
// @description  网页全屏、隐藏礼物、切换画质
// @author       yvvw
// @icon         https://www.douyin.com/favicon.ico
// @license      MIT
// @updateURL    https://github.com/yvvw/browser-scripts/releases/download/latest/douyin.meta.js
// @downloadURL  https://github.com/yvvw/browser-scripts/releases/download/latest/douyin.user.js
// @match        https://live.douyin.com/*
// @noframes
// ==/UserScript==

import { HTMLUtils, Logger } from './util'

const logger = Logger.new('Better Douyin')

window.onload = function main() {
  blockGift()
  switchWebFullscreen()
  switchHighestQuality()
  hideElements()
}

function hideElements() {
  const style = document.createElement('style')
  style.textContent = `
    #BottomLayout, #ShortTouchLayout, #room_info_bar { display: none !important; }
    .__livingPlayer__ { padding-top: 0 !important; }
  `
  document.head.appendChild(style)
}

function blockGift() {
  HTMLUtils.query(() => document.querySelector<HTMLElement>('[data-e2e="gift-setting"]') ?? null)
    .then((giftSetting) => {
      giftSetting.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      return HTMLUtils.query(
        () =>
          HTMLUtils.getFirstElementByXPath<HTMLElement>(
            '//span[text()="屏蔽礼物特效"]/following-sibling::*[@data-e2e="effect-switch"]'
          ) ?? null
      ).then((el) => ({ giftSetting, el }))
    })
    .then(({ giftSetting, el }) => {
      ;(el.firstElementChild as HTMLElement).click()
      giftSetting.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    })
    .catch((err) => logger.error('hideGift', err))
}

function switchWebFullscreen() {
  HTMLUtils.query(() => document.querySelector<HTMLElement>('.chatroom_close') ?? null)
    .then((el) => el.click())
    .catch((err) => logger.error('switchWebFullscreen', err))
}

function switchHighestQuality() {
  HTMLUtils.query(
    () => (document.querySelector('[data-e2e="quality-selector"]')?.firstElementChild as HTMLElement) ?? null
  )
    .then((el) => el.click())
    .catch((err) => logger.error('switchHighestQuality', err))
}
