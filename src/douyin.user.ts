// ==UserScript==
// @name         Better Douyin
// @namespace    https://github.com/yvvw/browser-scripts
// @homepageURL  https://github.com/yvvw/browser-scripts/blob/main/src/douyin.user.ts
// @version      0.0.8
// @description  切换画质、网页全屏、隐藏特效
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
  hideElements()
  switchHighestQuality()
  hideChatPanel()
  blockGift()
  blockGiftEffect()
  blockLuckyBag()
}

function hideElements() {
  const style = document.createElement('style')
  style.textContent = `
    #BottomLayout, #ShortTouchLayout, #room_info_bar { display: none !important; }
    .__livingPlayer__ { padding-top: 0 !important; }
  `
  document.head.appendChild(style)
}

function switchHighestQuality() {
  HTMLUtils.query(
    () => (document.querySelector('[data-e2e="quality-selector"]')?.firstElementChild as HTMLElement) ?? null
  )
    .then((el) => el.click())
    .catch((err) => logger.error('switchHighestQuality', err))
}

function hideChatPanel() {
  HTMLUtils.query(() => document.querySelector<HTMLElement>('#chatroom > div > div > div > div') ?? null)
    .then((el) => el.click())
    .catch((err) => logger.error('switchWebFullscreen', err))
}

function disableFeature(panel: string, label: string, classCount: number) {
  HTMLUtils.query(() => document.querySelector<HTMLElement>(`[data-e2e="${panel}"]`) ?? null)
    .then((panel) => {
      panel.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      return HTMLUtils.query(
        () =>
          HTMLUtils.getFirstElementByXPath<HTMLElement>(`//span[text()="${label}"]/following-sibling::div/div`) ?? null
      ).then((el) => ({ panel, el }))
    })
    .then(({ panel, el }) => {
      if (el.className.trim().split(/\s+/).length !== classCount) {
        el.click()
      }
      panel.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    })
    .catch((err) => logger.error(err))
}

function blockGift() {
  disableFeature('danmaku-setting-icon', '送礼信息', 2)
}

function blockGiftEffect() {
  disableFeature('gift-setting', '屏蔽礼物特效', 3)
}

function blockLuckyBag() {
  disableFeature('danmaku-setting-icon', '福袋口令', 2)
}
