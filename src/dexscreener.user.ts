// ==UserScript==
// @name         Better DEX Screener
// @namespace    https://github.com/yvvw/browser-scripts
// @version      0.0.15
// @description  展开关注列表、添加外部跳转、关闭广告
// @author       yvvw
// @icon         https://dexscreener.com/favicon.ico
// @license      MIT
// @updateURL    https://mirror.ghproxy.com/https://github.com/yvvw/browser-scripts/releases/download/latest/dexscreener.meta.js
// @downloadURL  https://mirror.ghproxy.com/https://github.com/yvvw/browser-scripts/releases/download/latest/dexscreener.user.js
// @match        https://dexscreener.com/*
// ==/UserScript==

import { HTMLUtils } from './util'

window.onload = function main() {
  HTMLUtils.observe(
    document.body,
    async () => {
      if (!document.getElementById('tv-chart-container')) return
      expandWatchList()
      await addExternalLink().catch(console.error)
      closeAd()
    },
    { waiting: true, throttle: 500 }
  )
}

function closeAd() {
  const btnEls = HTMLUtils.getElementsByXPath<HTMLButtonElement>('//button[text()="Hide ad"]')
  for (const btnEl of btnEls) btnEl.click()
}

function expandWatchList() {
  const el = document.querySelector<HTMLButtonElement>('button[title="Expand watchlist"]')
  if (el === null) return
  el.click()
}

async function addExternalLink() {
  // already added
  if (document.querySelector('a[data-external]') !== null) {
    return
  }

  const chain = getChainFromPath()
  const aEl = await HTMLUtils.query(() =>
    HTMLUtils.getFirstElementByXPath<HTMLSpanElement>('//span[text()="Pair"]')
  )
  const bEl = aEl.parentElement!.parentElement!.parentElement as HTMLDivElement
  const links = getExternalLinks(bEl, chain)
  if (links === null) return

  const containerEl = createExternalContainerEl()
  if (links.gmgn) {
    containerEl.appendChild(createExternalLinkEl('GMGN', links.gmgn))
  }
  if (links.bullx) {
    containerEl.appendChild(createExternalLinkEl('BullX', links.bullx))
  }
  bEl.insertBefore(containerEl, bEl.firstChild)

  await HTMLUtils.query(() => document.querySelector('a[data-external]'))
}

function createExternalContainerEl() {
  const el = document.createElement('div')
  el.style.setProperty('display', 'flex')
  el.style.setProperty('gap', '10px')
  el.style.setProperty('line-height', '36px')
  el.style.setProperty('border-color', 'var(--chakra-colors-blue-900)')
  el.style.setProperty('border-bottom-width', '1px')
  el.style.setProperty('font-size', 'var(--chakra-fontSizes-sm)')
  el.style.setProperty('color', 'var(--chakra-colors-green-300)')
  return el
}

function createExternalLinkEl(text: string, href: string) {
  const el = document.createElement('a')
  el.setAttribute('href', href)
  el.setAttribute('target', '_blank')
  el.setAttribute('rel', 'noopener noreferrer nofollow')
  el.setHTMLUnsafe(text)
  el.dataset['external'] = text
  el.classList.add('chakra-link', 'chakra-button')
  return el
}

const SUPPORT_CHAIN_NAME = ['ethereum', 'base', 'solana']

function getChainFromPath() {
  const parts = document.location.pathname.split('/')
  if (parts.length !== 3) {
    throw new Error('location path not valid')
  }

  const chain = parts[1]
  if (!SUPPORT_CHAIN_NAME.includes(chain)) {
    throw new Error(`${chain} is not supported`)
  }

  return chain
}

function getExternalLinks(el: HTMLDivElement, chain: string) {
  const aEls = el.querySelectorAll('a[title="Open in block explorer"]')
  if (aEls.length !== 3) {
    throw new Error('token address not found')
  }
  const aEl = aEls.item(1) as HTMLAnchorElement
  const address = aEl.href.split('/').pop()!

  return {
    gmgn: getGmGnLink(chain, address),
    bullx: getBullxLink(chain, address),
  }
}

function getGmGnLink(chain: string, token: string) {
  let _chain: string
  if (chain === 'ethereum') {
    _chain = 'eth'
  } else if (chain === 'base') {
    _chain = 'base'
  } else if (chain === 'solana') {
    _chain = 'sol'
  } else {
    console.warn(`${chain} unsupported`)
    return null
  }
  return `https://gmgn.ai/${_chain}/token/${token}`
}

function getBullxLink(chain: string, token: string) {
  let chainId: number
  if (chain === 'ethereum') {
    chainId = 1
  } else if (chain === 'base') {
    chainId = 8453
  } else if (chain === 'solana') {
    chainId = 1399811149
  } else {
    console.warn(`${chain} unsupported`)
    return null
  }
  return `https://bullx.io/terminal?chainId=${chainId}&address=${token}`
}
