// ==UserScript==
// @name         Better DEX Screener
// @namespace    https://github.com/yvvw/browser-scripts
// @homepageURL  https://github.com/yvvw/browser-scripts/blob/main/src/dexscreener.user.ts
// @version      0.0.37
// @description  展开关注列表、添加外部跳转、关闭广告
// @author       yvvw
// @icon         https://dexscreener.com/favicon.ico
// @license      MIT
// @updateURL    https://github.com/yvvw/browser-scripts/releases/download/latest/dexscreener.meta.js
// @downloadURL  https://github.com/yvvw/browser-scripts/releases/download/latest/dexscreener.user.js
// @match        https://dexscreener.com/*
// @noframes
// ==/UserScript==

import { HTMLUtils, Logger } from './util'

const logger = Logger.new('Better DEX Screener')

function main() {
  HTMLUtils.observe(
    document.body,
    async () => {
      if (!document.querySelector('[id^="tradingview_"]')) return
      expandWatchList()
      await addExternalLink().catch(logger.error.bind(logger))
      closeAd()
      return
    },
    { waiting: true, throttle: 500 }
  )
}

function closeAd() {
  const btnEls = document.querySelectorAll<HTMLButtonElement>('button[aria-label="Hide"]')
  for (const btnEl of btnEls) btnEl.click()

  const adBtnEls = HTMLUtils.getElementsByXPath<HTMLButtonElement>('//button[text()="Hide ad"]')
  for (const btnEl of adBtnEls) btnEl.click()
}

function expandWatchList() {
  const el = document.querySelector<HTMLButtonElement>('button[title="Expand watchlist"]')
  if (el === null) return
  el.click()
}

async function addExternalLink() {
  // already added
  if (document.querySelector('div[data-external]') !== null) {
    return
  }

  const chain = getChainFromPath()
  const aEl = await HTMLUtils.query(() => HTMLUtils.getFirstElementByXPath<HTMLSpanElement>('//span[text()="Pair"]'))
  const bEl = aEl.parentElement?.parentElement?.parentElement as HTMLDivElement
  const links = getExternalLinks(bEl, chain)
  if (links === null) return

  const containerEl = createExternalContainerEl()
  if (links.swap) {
    containerEl.appendChild(createExternalLinkEl('swap', links.swap))
  }
  if (links.meme) {
    containerEl.appendChild(createExternalLinkEl('meme', links.meme))
  }
  if (links.gmgn) {
    containerEl.appendChild(createExternalLinkEl('gmgn', links.gmgn))
  }
  bEl.insertBefore(containerEl, bEl.firstChild)

  await HTMLUtils.query(() => document.querySelector('div[data-external]'))
}

function createExternalContainerEl() {
  const el = document.createElement('div')
  el.dataset.external = 'container'
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
  el.dataset.external = text
  el.classList.add('chakra-link', 'chakra-button')
  return el
}

const SUPPORT_CHAINS = ['ethereum', 'base', 'solana', 'tron', 'bsc', 'robinhood']

function getChainFromPath() {
  const parts = document.location.pathname.split('/')
  if (parts.length !== 3) {
    throw new Error('location path not valid')
  }

  const chain = parts[1]
  if (!SUPPORT_CHAINS.includes(chain)) {
    throw new Error(`${chain} is not supported`)
  }

  return chain
}

function getExternalLinks(el: HTMLDivElement, chain: string) {
  const aEls = el.querySelectorAll('a[title="Open in block explorer"]')
  const aEl = aEls.item(1) as HTMLAnchorElement
  const address = aEl.href.split('/').pop()!

  return {
    swap: getSwapLink(chain, address),
    meme: getMemeLink(chain, address),
    gmgn: getGmGnLink(chain, address),
  }
}

function getSwapLink(chain: string, token: string) {
  if (chain === 'ethereum') {
    // https://app.uniswap.org/swap?chain=ethereum&inputCurrency=ETH&outputCurrency=${token}
    const chain = 1
    return `https://matcha.xyz/trade?buyChain=${chain}&sellChain=${chain}&buyAddress=${token}&sellAddress=0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`
  }
  if (chain === 'base') {
    const chain = 8453
    return `https://matcha.xyz/trade?buyChain=${chain}&sellChain=${chain}&buyAddress=${token}&sellAddress=0x4200000000000000000000000000000000000006`
  }
  if (chain === 'solana') {
    // https://jup.ag/?sell=So11111111111111111111111111111111111111112&buy=${token}
    return `https://jup.ag/tokens/${token}`
  }
  if (chain === 'bsc') {
    // `https://pancakeswap.finance/swap?inputCurrency=BNB&outputCurrency=${token}`
    const chain = 56
    return `https://matcha.xyz/trade?buyChain=${chain}&sellChain=${chain}&buyAddress=${token}&sellAddress=0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c`
  }
  if (chain === 'robinhood') {
    const chain = 4663
    return `https://matcha.xyz/trade?buyChain=${chain}&sellChain=${chain}&buyAddress=${token}&sellAddress=0x0bd7d308f8e1639fab988df18a8011f41eacad73`
  }
  logger.warn(`${chain} swap unsupported`)
  return null
}

function getMemeLink(chain: string, token: string) {
  if (chain === 'solana' && token.endsWith('pump')) {
    return `https://pump.fun/coin/${token}`
  }
  if (chain === 'tron') {
    return `https://sunpump.meme/token/${token}`
  }
  if (chain === 'bsc') {
    return `https://four.meme/token/${token}`
  }
  logger.warn(`${chain} pump unsupported`)
  return null
}

function getGmGnLink(chain: string, token: string) {
  if (chain === 'ethereum') {
    return `https://gmgn.ai/eth/token/${token}`
  }
  if (chain === 'base') {
    return `https://gmgn.ai/base/token/${token}`
  }
  if (chain === 'solana') {
    return `https://gmgn.ai/sol/token/${token}`
  }
  if (chain === 'tron') {
    return `https://gmgn.ai/tron/token/${token}`
  }
  if (chain === 'bsc') {
    return `https://gmgn.ai/bsc/token/${token}`
  }
  if (chain === 'robinhood') {
    return `https://gmgn.ai/robinhood/token/${token}`
  }
  logger.warn(`${chain} gmgn unsupported`)
  return null
}

function getBinanceLink(chain: string, token: string) {
  if (chain === 'base') {
    return `https://web3.binance.com/zh-CN/token/base/${token}`
  }
  if (chain === 'solana') {
    return `https://web3.binance.com/zh-CN/token/sol/${token}`
  }
  if (chain === 'bsc') {
    return `https://web3.binance.com/zh-CN/token/bsc/${token}`
  }
  logger.warn(`${chain} binance unsupported`)
  return null
}

function getPadreLink(chain: string, token: string) {
  if (chain === 'solana') {
    return `https://trade.padre.gg/trade/solana/${token}`
  }
  if (chain === 'base') {
    return `https://trade.padre.gg/trade/base/${token}`
  }
  logger.warn(`${chain} padre unsupported`)
  return null
}

function getAxiomLink(chain: string, token: string) {
  if (chain === 'solana') {
    return `https://axiom.trade/t/${token}`
  }
  logger.warn(`${chain} axiom unsupported`)
  return null
}

function getPhotonLink(chain: string, token: string) {
  if (chain === 'ethereum') {
    return `https://photon.tinyastro.io/en/lp/${token}`
  }
  if (chain === 'base') {
    return `https://photon-base.tinyastro.io/en/lp/${token}`
  }
  if (chain === 'solana') {
    return `https://photon-sol.tinyastro.io/en/lp/${token}`
  }
  if (chain === 'tron') {
    return `https://photon-tron.tinyastro.io/en/lp/${token}`
  }
  logger.warn(`${chain} photon unsupported`)
  return null
}

main()
