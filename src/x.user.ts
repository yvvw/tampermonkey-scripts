// ==UserScript==
// @name         Better X(Twitter)
// @namespace    https://github.com/yvvw/browser-scripts
// @homepageURL  https://github.com/yvvw/browser-scripts/blob/main/src/x.user.ts
// @version      0.0.20
// @description  自动点翻译，自动屏蔽广告，快捷屏蔽、不感兴趣
// @author       yvvw
// @icon         https://abs.twimg.com/favicons/twitter.3.ico
// @license      MIT
// @updateURL    https://github.com/yvvw/browser-scripts/releases/download/latest/x.meta.js
// @downloadURL  https://github.com/yvvw/browser-scripts/releases/download/latest/x.user.js
// @match        https://x.com/*
// @match        https://twitter.com/*
// @exclude      https://x.com/i/*
// @exclude      https://twitter.com/i/*
// @noframes
// ==/UserScript==

import { HTMLUtils, Logger } from './util'

const logger = Logger.new('Better X')

unsafeWindow.onload = function main() {
  HTMLUtils.observe(
    document.body,
    async () => {
      autoTranslate()

      const sectionEl = document.querySelector<HTMLElement>('section[role="region"]')
      if (sectionEl === null) {
        return
      }
      const itemEls = sectionEl.querySelectorAll<HTMLDivElement>('div[data-testid="cellInnerDiv"]')
      for (const itemEl of itemEls) {
        if (itemEl.querySelector('article[data-testid="tweet"]') === null) {
          continue
        }
        addExtraButtons(itemEl).catch(logger.error.bind(logger))
      }
    },
    { waiting: true, throttle: 300 }
  )
}

function autoTranslate() {
  const contentEl = document.querySelector<HTMLDivElement>('article[data-testid="tweet"]')
  const buttonEls = contentEl?.querySelectorAll('button')
  if (buttonEls !== undefined) {
    for (const buttonEl of buttonEls) {
      if (buttonEl.ariaLabel === '显示翻译') {
        buttonEl.click()
      }
    }
  }
}

async function addExtraButtons(twitterEl: HTMLDivElement) {
  if (twitterEl.querySelector('button[aria-label="Block"]') !== null) return

  await addNotInterestedButton(twitterEl)
  await addBlockButton(twitterEl)
}

async function addBlockButton(twitterEl: HTMLDivElement) {
  // twitter right corner `...` button
  const moreBtn = twitterEl.querySelector<HTMLDivElement>('button[data-testid="caret"]') as HTMLDivElement

  const block = async () => {
    moreBtn.click()

    const btn = await HTMLUtils.query(() => document.querySelector<HTMLDivElement>('div[data-testid="block"]'))
    btn.click()

    const confirmBtn = await HTMLUtils.query(() =>
      document.querySelector<HTMLElement>('button[data-testid="confirmationSheetConfirm"]')
    )
    confirmBtn.click()

    const laterBtn = await HTMLUtils.query(() =>
      HTMLUtils.getFirstElementByXPath<HTMLElement>('//button[contains(., "Maybe later")]')
    )
    laterBtn.click()
  }

  if (twitterEl.innerText.includes('\nAd\n')) {
    await block()
    return
  }

  const blockBtnEl = moreBtn.cloneNode(true) as HTMLDivElement
  delete blockBtnEl.dataset.testid
  blockBtnEl.setAttribute('aria-label', 'Block')
  blockBtnEl.addEventListener('click', block)

  const blockSvgIconEl = blockBtnEl.querySelector('svg')
  if (blockSvgIconEl === null) return
  blockSvgIconEl.setHTMLUnsafe(
    '<g><path d="M12 3.75c-4.55 0-8.25 3.69-8.25 8.25 0 1.92.66 3.68 1.75 5.08L17.09 5.5C15.68 4.4 13.92 3.75 12 3.75zm6.5 3.17L6.92 18.5c1.4 1.1 3.16 1.75 5.08 1.75 4.56 0 8.25-3.69 8.25-8.25 0-1.92-.65-3.68-1.75-5.08zM1.75 12C1.75 6.34 6.34 1.75 12 1.75S22.25 6.34 22.25 12 17.66 22.25 12 22.25 1.75 17.66 1.75 12z"></path></g>'
  )

  const moreEl = moreBtn.parentElement?.parentElement?.parentElement as HTMLDivElement
  const moreParentEl = moreEl.parentElement as HTMLDivElement

  const blockEl = moreEl.cloneNode(true) as HTMLDivElement
  ;(blockEl.firstChild?.firstChild as HTMLDivElement).innerHTML = ''
  blockEl.firstChild?.firstChild?.appendChild(blockBtnEl)

  moreParentEl.insertBefore(blockEl, moreEl)
}

async function addNotInterestedButton(twitterEl: HTMLDivElement) {
  const moreBtn = twitterEl.querySelector<HTMLDivElement>('button[data-testid="caret"]') as HTMLDivElement

  const notInterested = async () => {
    moreBtn.click()

    const btn = await HTMLUtils.query(() => document.querySelector<HTMLDivElement>('div[role="menuitem"]'))

    if (!(btn.innerText.includes('Not interested') || btn.innerText.includes('不感兴趣'))) {
      ;(
        document.querySelector<HTMLElement>('div[role="menu"]')?.parentElement?.firstElementChild as HTMLDivElement
      )?.click()
      return
    }

    btn.click()

    const showFewerBtn = await HTMLUtils.query(() =>
      Array.from(twitterEl.querySelectorAll('button')).find(
        (it) => it.innerText.includes('Show fewer posts') || it.innerText.includes('显示更少')
      )!
    )
    showFewerBtn.click()
  }

  const notInterestBtnEl = moreBtn.cloneNode(true) as HTMLDivElement
  delete notInterestBtnEl.dataset.testid
  notInterestBtnEl.setAttribute('aria-label', 'Not Interested')
  notInterestBtnEl.addEventListener('click', notInterested)

  const notInterestSvgIconEl = notInterestBtnEl.querySelector('svg')
  if (notInterestSvgIconEl === null) return
  notInterestSvgIconEl.setHTMLUnsafe(
    '<g><path d="M9.5 7c.828 0 1.5 1.119 1.5 2.5S10.328 12 9.5 12 8 10.881 8 9.5 8.672 7 9.5 7zm5 0c.828 0 1.5 1.119 1.5 2.5s-.672 2.5-1.5 2.5S13 10.881 13 9.5 13.672 7 14.5 7zM12 22.25C6.348 22.25 1.75 17.652 1.75 12S6.348 1.75 12 1.75 22.25 6.348 22.25 12 17.652 22.25 12 22.25zm0-18.5c-4.549 0-8.25 3.701-8.25 8.25s3.701 8.25 8.25 8.25 8.25-3.701 8.25-8.25S16.549 3.75 12 3.75zM8.947 17.322l-1.896-.638C7.101 16.534 8.322 13 12 13s4.898 3.533 4.949 3.684l-1.897.633c-.031-.09-.828-2.316-3.051-2.316s-3.021 2.227-3.053 2.322z"></path></g>'
  )

  const moreEl = moreBtn.parentElement?.parentElement?.parentElement as HTMLDivElement
  const moreParentEl = moreEl.parentElement as HTMLDivElement

  const notInterestEl = moreEl.cloneNode(true) as HTMLDivElement
  ;(notInterestEl.firstChild?.firstChild as HTMLDivElement).innerHTML = ''
  notInterestEl.firstChild?.firstChild?.appendChild(notInterestBtnEl)

  moreParentEl.insertBefore(notInterestEl, moreEl)
}
