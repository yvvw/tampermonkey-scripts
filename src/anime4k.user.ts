// ==UserScript==
// @name         Anime4K
// @namespace    https://github.com/yvvw/browser-scripts
// @homepageURL  https://github.com/yvvw/browser-scripts/blob/main/src/anime4k.user.ts
// @version      0.0.12
// @description  Anime4K画质增强
// @credit       https://github.com/bloc97/Anime4K
// @credit       https://github.com/Anime4KWebBoost/Anime4K-WebGPU
// @author       yvvw
// @license      MIT
// @updateURL    https://github.com/yvvw/browser-scripts/releases/download/latest/anime4k.meta.js
// @downloadURL  https://github.com/yvvw/browser-scripts/releases/download/latest/anime4k.user.js
// @match        *://*/*
// ==/UserScript==

import type { Anime4KPipeline, Anime4KPresetPipelineDescriptor } from 'anime4k-webgpu'
import { ModeA, ModeAA, ModeB, ModeBB, ModeC, ModeCA } from 'anime4k-webgpu'
import debounce from 'debounce'

import { Logger } from './util'

const logger = Logger.new('Anime4K')

function main() {
  new Anime4K().watch()
}

type IAnime4KPipelinePreset =
  'Anime4K: A' | 'Anime4K: B' | 'Anime4K: C' | 'Anime4K: A+A' | 'Anime4K: B+B' | 'Anime4K: C+A'

class Anime4K {
  #presetKeyMap: { [key: string]: IAnime4KPipelinePreset | 'Clear' } = {
    '`': 'Clear',
    '1': 'Anime4K: A',
    '2': 'Anime4K: A+A',
    '3': 'Anime4K: B',
    '4': 'Anime4K: B+B',
    '5': 'Anime4K: C',
    '6': 'Anime4K: C+A',
  }

  #getPipelines(preset: IAnime4KPipelinePreset, descriptor: Anime4KPresetPipelineDescriptor): Anime4KPipeline[] {
    switch (preset) {
      case 'Anime4K: A':
        return [new ModeA(descriptor)]
      case 'Anime4K: B':
        return [new ModeB(descriptor)]
      case 'Anime4K: C':
        return [new ModeC(descriptor)]
      case 'Anime4K: A+A':
        return [new ModeAA(descriptor)]
      case 'Anime4K: B+B':
        return [new ModeBB(descriptor)]
      case 'Anime4K: C+A':
        return [new ModeCA(descriptor)]
      default:
        throw new Error(`unknown preset ${preset}`)
    }
  }

  #keyboardListener: ((ev: KeyboardEvent) => void) | undefined

  watch() {
    let lastPreset: string | undefined
    this.#keyboardListener = (ev: WindowEventMap['keydown']) => {
      const preset = this.#presetKeyMap[ev.key]
      if (preset === undefined) return
      if (preset === lastPreset) return this.#notice(preset)
      lastPreset = preset
      if (preset === 'Clear') {
        this.#clear().catch(logger.error.bind(logger))
      } else {
        this.#start({ preset }).catch(this.destroy.bind(this))
      }
    }
    window.addEventListener('keydown', this.#keyboardListener!)
  }

  #resizeObserver?: ResizeObserver

  #stop?: () => Promise<void>

  async #start({ preset }: { preset: IAnime4KPipelinePreset }) {
    const video = this.#video()
    const canvas = this.#canvas()

    const { videoWidth, videoHeight } = video
    const videoAspectRatio = videoWidth / videoHeight

    const render = debounce(
      async (video: HTMLVideoElement) => {
        const { clientWidth: rectWidth, clientHeight: rectHeight } = video.parentElement!
        const rectAspectRatio = rectWidth / rectHeight
        const canvasWidth = Math.ceil(rectAspectRatio < videoAspectRatio ? rectWidth : rectHeight * videoAspectRatio)
        const canvasHeight = Math.ceil(videoAspectRatio < rectAspectRatio ? rectHeight : rectWidth / videoAspectRatio)
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        canvas.style.setProperty('left', `${(rectWidth - canvasWidth) / 2}px`)
        canvas.style.setProperty('top', `${(rectHeight - canvasHeight) / 2}px`)

        if (this.#stop) await this.#stop()
        this.#stop = await this.#render({ preset, canvas, video })
      },
      100,
      { immediate: false }
    )

    this.#resizeObserver?.disconnect()
    this.#resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0) return
      const entry = entries[0]
      if (!(entry.target instanceof HTMLVideoElement)) return this.#clear()
      render(entry.target)
    })
    this.#resizeObserver?.observe(video)

    render(video)

    this.#notice(preset)
  }

  async #render({
    preset,
    canvas,
    video,
  }: {
    preset: IAnime4KPipelinePreset
    canvas: HTMLCanvasElement
    video: HTMLVideoElement
  }) {
    if (video.readyState < video.HAVE_FUTURE_DATA) {
      await new Promise((resolve) => {
        video.onloadeddata = resolve
      })
    }

    const { videoWidth, videoHeight } = video
    const { width: canvasWidth, height: canvasHeight } = canvas

    const device = await this.#gpuDevice()
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({ device, format, alphaMode: 'premultiplied' })

    const inputTexture = device.createTexture({
      size: [videoWidth, videoHeight, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    })

    const pipelines = this.#getPipelines(preset, {
      nativeDimensions: { width: videoWidth, height: videoHeight },
      targetDimensions: { width: canvasWidth, height: canvasHeight },
      device,
      inputTexture,
    })

    const bindGroupLayout = device.createBindGroupLayout({
      label: 'Bind Group Layout',
      entries: [
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      ],
    })

    const renderPipeline = device.createRenderPipeline({
      vertex: {
        entryPoint: 'vert_main',
        module: device.createShaderModule({ code: FullscreenTexturedQuadWGSL }),
      },
      primitive: { topology: 'triangle-list' },
      fragment: {
        entryPoint: 'main',
        targets: [{ format }],
        module: device.createShaderModule({ code: SampleExternalTextureWGSL }),
      },
      layout: device.createPipelineLayout({
        label: 'Pipeline Layout',
        bindGroupLayouts: [bindGroupLayout],
      }),
    })

    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 1,
          resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
        },
        {
          binding: 2,
          resource: pipelines.at(-1)?.getOutputTexture().createView() as GPUBindingResource,
        },
      ],
    })

    let stop = false
    let requestId: ReturnType<(typeof video)['requestVideoFrameCallback']>

    const renderFrame = () => {
      if (stop) return

      // update texture
      device.queue.copyExternalImageToTexture({ source: video }, { texture: inputTexture }, [videoWidth, videoHeight])

      const commandEncoder = device.createCommandEncoder()
      for (const pipeline of pipelines) {
        pipeline.pass(commandEncoder)
      }

      const renderPassEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      })
      renderPassEncoder.setPipeline(renderPipeline)
      renderPassEncoder.setBindGroup(0, bindGroup)
      renderPassEncoder.draw(6)
      renderPassEncoder.end()

      device.queue.submit([commandEncoder.finish()])

      requestId = video.requestVideoFrameCallback(renderFrame)
    }
    renderFrame()

    return async () => {
      stop = true
      video.cancelVideoFrameCallback(requestId)
      await device.queue.onSubmittedWorkDone()
      context.unconfigure()
      device.destroy()
    }
  }

  async #clear() {
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect()
      this.#resizeObserver = undefined
    }
    if (this.#stop) await this.#stop()

    this.#notice('Clear')
  }

  #video() {
    const videos = document.querySelectorAll('video')
    if (videos.length === 0) {
      throw new Error('video not found')
    }
    for (const video of videos) {
      if (video.clientWidth * video.clientHeight * 6 > window.innerWidth * window.innerHeight) {
        this.#createElements(video)
        return video
      }
    }
    throw new Error('valid video not found')
  }

  #mutationObserver?: MutationObserver

  #createElements(video: HTMLVideoElement) {
    if (document.getElementById(this.#CANVAS_ID)) return

    const container = video.parentElement! as HTMLElement

    const videoZIndex = video.style.getPropertyValue('z-index')

    const canvas = document.createElement('canvas')
    canvas.id = this.#CANVAS_ID
    canvas.style.setProperty('position', 'absolute')
    canvas.style.setProperty('z-index', videoZIndex)

    const notice = document.createElement('div')
    notice.id = this.#NOTICE_ID
    notice.style.setProperty('position', 'absolute')
    notice.style.setProperty('z-index', videoZIndex)
    notice.style.setProperty('top', '12px')
    notice.style.setProperty('left', '12px')
    notice.style.setProperty('padding', '6px 12px')
    notice.style.setProperty('background', '#4b4b4be6')
    notice.style.setProperty('border-radius', '5px')
    notice.style.setProperty('font-size', '2rem')
    notice.style.setProperty('color', 'white')
    notice.style.setProperty('transition', 'opacity 0.3s')

    video.after(canvas, notice)

    const handleVideoElAdded = debounce((video: HTMLVideoElement) => {
      const videoZIndex = video.style.getPropertyValue('z-index')
      canvas.style.setProperty('z-index', videoZIndex)
      notice.style.setProperty('z-index', videoZIndex)

      video.after(container.removeChild(canvas), container.removeChild(notice))
    }, 100)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes.values()) {
          if (addedNode instanceof HTMLVideoElement) handleVideoElAdded(video)
        }
      }
    })
    observer.observe(container, { childList: true })

    this.#mutationObserver = observer
  }

  readonly #CANVAS_ID = '__anime4k-canvas__'

  #canvas(): HTMLCanvasElement {
    return document.getElementById(this.#CANVAS_ID) as HTMLCanvasElement
  }

  async #gpuDevice() {
    const adapter = await navigator.gpu.requestAdapter()
    if (adapter === null) throw new Error('WebGPU not supported')
    return adapter.requestDevice()
  }

  readonly #NOTICE_ID = '__anime4k-notice__'
  #noticeTimer?: ReturnType<typeof setTimeout>

  #notice(text: string) {
    const noticeEl = document.getElementById(this.#NOTICE_ID) as HTMLDivElement
    if (noticeEl === null) return
    noticeEl.innerText = text
    noticeEl.style.setProperty('opacity', '1')

    clearTimeout(this.#noticeTimer)
    this.#noticeTimer = setTimeout(() => noticeEl.style.setProperty('opacity', '0'), 1500)
  }

  async destroy() {
    await this.#clear()

    if (this.#keyboardListener) {
      window.removeEventListener('keydown', this.#keyboardListener)
      this.#keyboardListener = undefined
    }

    if (this.#mutationObserver) {
      this.#mutationObserver.disconnect()
      this.#mutationObserver = undefined
    }

    this.#destroyById(this.#CANVAS_ID)
    this.#destroyById(this.#NOTICE_ID)
  }

  #destroyById(id: string) {
    const el = document.getElementById(id)
    if (el !== null) el.parentElement?.removeChild(el)
  }
}

const FullscreenTexturedQuadWGSL = `
struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) fragUV : vec2<f32>,
}

@vertex
fn vert_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  const pos = array(
    vec2( 1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0, -1.0),
    vec2( 1.0,  1.0),
    vec2(-1.0, -1.0),
    vec2(-1.0,  1.0),
  );

  const uv = array(
    vec2(1.0, 0.0),
    vec2(1.0, 1.0),
    vec2(0.0, 1.0),
    vec2(1.0, 0.0),
    vec2(0.0, 1.0),
    vec2(0.0, 0.0),
  );

  var output : VertexOutput;
  output.Position = vec4(pos[VertexIndex], 0.0, 1.0);
  output.fragUV = uv[VertexIndex];
  return output;
}
`

const SampleExternalTextureWGSL = `
@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_2d<f32>;

@fragment
fn main(@location(0) fragUV : vec2f) -> @location(0) vec4f {
  return textureSampleBaseClampToEdge(myTexture, mySampler, fragUV);
}
`

main()
