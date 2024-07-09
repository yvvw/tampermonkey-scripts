// ==UserScript==
// @name         Better pump.fun
// @namespace    https://github.com/yvvw/tampermonkey-scripts
// @version      0.0.13
// @description  增加gmgn、bullx跳转，标记dev，快速交易
// @author       yvvw
// @icon         https://www.pump.fun/icon.png
// @license      MIT
// @updateURL    https://mirror.ghproxy.com/https://github.com/yvvw/tampermonkey-scripts/releases/download/latest/pumpfun.meta.js
// @downloadURL  https://mirror.ghproxy.com/https://github.com/yvvw/tampermonkey-scripts/releases/download/latest/pumpfun.user.js
// @match        https://www.pump.fun/*
// @match        https://pump.fun/*
// @grant        none
// ==/UserScript==

import { delay, HTMLUtils } from './util'

const clearChannel = new Set<Function>()

window.onload = function main() {
  let running = false
  let prevToken = ''

  new MutationObserver(() => {
    const token = location.pathname.slice(1)
    if (running || token.length <= 40 || prevToken === token) {
      return
    }
    running = true
    prevToken = token

    if (clearChannel.size > 0) {
      clearChannel.forEach((fn) => fn())
      clearChannel.clear()
    }

    Promise.allSettled([
      addQuickButton().then(addExternalLinks),
      switchTradePanel(),
      autoTrade(),
    ]).finally(() => (running = false))
  }).observe(document.body, {
    childList: true,
    subtree: true,
  })
}

async function addExternalLinks() {
  const threadEl = await HTMLUtils.waitingElement(
    () => document.evaluate('//div[text()="Thread"]', document).iterateNext() as HTMLDivElement
  )
  ;(threadEl.parentElement as HTMLDivElement).style.setProperty('font-size', '1.5rem')

  const address = location.pathname.replace('/', '')

  const divWrapEl = document.createElement('div')
  divWrapEl.classList.add('flex', 'gap-2', 'text-green-300')

  divWrapEl.appendChild(createExternalLink('GMGN', `https://gmgn.ai/sol/token/${address}`))
  divWrapEl.appendChild(
    createExternalLink('BullX', `https://bullx.io/terminal?chainId=1399811149&address=${address}`)
  )
  threadEl.parentElement?.appendChild(divWrapEl)
}

function createExternalLink(text: string, href: string) {
  const el = document.createElement('a')
  el.setAttribute('href', href)
  el.setAttribute('target', '_blank')
  el.setHTMLUnsafe(text)
  return el
}

async function addQuickButton() {
  const threadEl = await HTMLUtils.waitingElement(
    () => document.evaluate('//div[text()="Thread"]', document).iterateNext() as HTMLDivElement
  )
  const divWrapEl = document.createElement('div')
  divWrapEl.classList.add('flex')
  divWrapEl.style.setProperty('margin-left', 'auto')
  divWrapEl.style.setProperty('margin-right', '20px')
  divWrapEl.appendChild(createQuickButton('0.5', () => quickBuy('0.5'), 'text-green-400'))
  divWrapEl.appendChild(createQuickButton('_1_', () => quickBuy('1'), 'text-green-400'))
  divWrapEl.appendChild(createQuickButton('_2_', () => quickBuy('2'), 'text-green-400'))
  divWrapEl.appendChild(createQuickButton('50', () => quickSell('50%'), 'text-red-400'))
  divWrapEl.appendChild(createQuickButton('100', () => quickSell('100%'), 'text-red-400'))
  threadEl.parentElement?.appendChild(divWrapEl)
}

function createQuickButton(text: string, onClick: EventListener, classNames: string) {
  const el = document.createElement('button')
  el.setHTMLUnsafe(text)
  el.classList.add(
    'px-2',
    'hover:bg-gray-800',
    ...classNames
      .split(' ')
      .map((it) => it.trim())
      .filter((it) => it !== '')
  )
  el.addEventListener('click', onClick)
  return el
}

async function quickBuy(text: string) {
  await switchMode('Buy')
  await delay(100)

  const inputEl = await HTMLUtils.waitingElement(
    () => document.getElementById('amount') as HTMLInputElement
  )
  setNativeValue(inputEl, text)

  const tradeEl = await HTMLUtils.waitingElement(
    () =>
      document
        .evaluate('//button[text()="place trade"]', document)
        .iterateNext() as HTMLButtonElement
  )
  tradeEl.click()
}

async function quickSell(percent: string) {
  await switchMode('Sell')
  await delay(100)

  const percentBtnEl = await HTMLUtils.waitingElement(
    () =>
      document
        .evaluate(`//button[text()="${percent}"]`, document)
        .iterateNext() as HTMLButtonElement
  )
  percentBtnEl.click()
  await delay(100)

  const tradeEl = await HTMLUtils.waitingElement(
    () =>
      document
        .evaluate('//button[text()="place trade"]', document)
        .iterateNext() as HTMLButtonElement
  )
  tradeEl.click()
}

async function switchMode(mode: 'Buy' | 'Sell') {
  const buyEl = await HTMLUtils.waitingElement(
    () => document.evaluate(`//button[text()="${mode}"]`, document).iterateNext() as HTMLDivElement
  )
  buyEl.click()
}

function setNativeValue(el: Element, value: string) {
  const valueDescriptor = Object.getOwnPropertyDescriptor(el, 'value')
  const prototypeValueDescriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(el),
    'value'
  )

  if (valueDescriptor && prototypeValueDescriptor) {
    const valueSetter = valueDescriptor.set!
    const prototypeValueSetter = prototypeValueDescriptor.set!

    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(el, value)
    } else {
      valueSetter.call(el, value)
    }

    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

async function autoTrade() {
  const buttonEl = await HTMLUtils.waitingElement(
    () =>
      document
        .evaluate('//button[text()="place trade"]', document)
        .iterateNext() as HTMLButtonElement
  )

  const click = buttonEl.click
  buttonEl.removeEventListener('click', click)
  buttonEl.addEventListener('click', async function () {
    const cancelEl = await HTMLUtils.waitingElement(
      () =>
        document.evaluate('//div[text()="[cancel]"]', document).iterateNext() as HTMLButtonElement
    )
    ;(cancelEl.previousElementSibling as HTMLButtonElement).click()
    cancelEl.click()
  })
}

async function switchTradePanel() {
  const tradesEl = await HTMLUtils.waitingElement(
    () => document.evaluate('//div[text()="Trades"]', document).iterateNext() as HTMLDivElement
  )

  const click = tradesEl.click
  tradesEl.removeEventListener('click', click)
  tradesEl.addEventListener('click', function () {
    labelDevInTradePanel()
  })
  click.apply(tradesEl)
}

async function labelDevInTradePanel() {
  const labelEl = await HTMLUtils.waitingElement(
    () =>
      document
        .evaluate('//label[text()="Filter by following"]', document)
        .iterateNext() as HTMLLabelElement
  )

  const tableEl = labelEl.parentElement?.parentElement
  if (!tableEl) {
    throw new Error('未发现交易面板')
  }

  const devSibEl = await HTMLUtils.waitingElement(
    () =>
      document.evaluate('//span[text()="created by"]', document).iterateNext() as HTMLSpanElement
  )
  const devEl = devSibEl.nextSibling as HTMLAnchorElement | undefined
  if (!devEl) {
    throw new Error('未发现dev标签')
  }
  const devName = devEl.href.split('/').pop()

  function labelTrade(el: HTMLDivElement, idx: number) {
    const nameEl = el.firstElementChild?.firstElementChild as HTMLAnchorElement | undefined
    if (!nameEl) {
      throw new Error('未发现a标签')
    }
    const operateType = (el.children.item(1) as HTMLDivElement).innerText

    const solEl = el.children.item(3) as HTMLDivElement
    const solAmount = parseFloat(solEl.innerText)
    solEl.classList.remove('text-green-300', 'text-red-300')
    if (solAmount >= 1) {
      if (operateType === 'buy') {
        solEl.classList.add('text-green-300')
      } else if (operateType === 'sell') {
        solEl.classList.add('text-red-300')
      }
    }

    const rowName = nameEl.href.split('/').pop()
    if (rowName === devName) {
      if (operateType === 'buy') {
        el.classList.add('text-white', 'bg-green-500')
      } else if (operateType === 'sell') {
        el.classList.add('text-white', 'bg-red-500')
        if (idx < 4) {
          playSellAudio()
        }
      }
    } else {
      el.classList.remove('text-white', 'bg-green-500', 'bg-red-500')
    }
  }

  // 显示完整时间
  // tableEl.children.item(1)!.querySelector('button')!.click()

  // 跳过前两个表头和最后一个翻页组件
  for (let i = 2; i < tableEl.children.length - 1; i++) {
    labelTrade(tableEl.children.item(i) as HTMLDivElement, i)
  }

  const observer = HTMLUtils.observe(() => {
    // 跳过前两个表头和最后一个翻页组件
    for (let i = 2; i < tableEl.children.length - 1; i++) {
      labelTrade(tableEl.children.item(i) as HTMLDivElement, i)
    }
  }, tableEl)
  clearChannel.add(() => observer.disconnect())
}

let playing = false

function playSellAudio() {
  if (playing) {
    return
  }
  playing = true
  const audio = new Audio('https://downsc.chinaz.net/Files/upload/yinxiao/2023/08/21/5414638.wav')
  audio.play().finally(() => setTimeout(() => (playing = false), 5000))
}
