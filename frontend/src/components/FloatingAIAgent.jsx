import { useState, useRef, useEffect, useCallback } from 'react'
import api from '../services/api'
import {
  Bot, X, Send, Minimize2, Maximize2, Trash2, Loader2,
  Mic, MicOff, Volume2, VolumeX, Square,
} from 'lucide-react'
import { clsx } from 'clsx'

// ─── Inline Markdown Renderer ────────────────────────────────────────────────

function MarkdownMessage({ content }) {
  const processInline = (text) => {
    const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      if (part.startsWith('*') && part.endsWith('*'))
        return <em key={i}>{part.slice(1, -1)}</em>
      return part
    })
  }

  const lines = content.split('\n')
  const elements = []
  let listItems = []
  let listType = null

  const flushList = () => {
    if (!listItems.length) return
    const Tag = listType === 'ordered' ? 'ol' : 'ul'
    elements.push(
      <Tag key={`list-${elements.length}`}
        className={clsx('my-1 space-y-0.5 pl-4', listType === 'ordered' ? 'list-decimal' : 'list-disc')}>
        {listItems.map((item, i) => <li key={i}>{item}</li>)}
      </Tag>
    )
    listItems = []
    listType = null
  }

  lines.forEach((line, i) => {
    const orderedMatch = line.match(/^(\d+)[.)]\s+(.+)/)
    const bulletMatch = line.match(/^[-•]\s+(.+)/)
    if (orderedMatch) {
      if (listType !== 'ordered') { flushList(); listType = 'ordered' }
      listItems.push(processInline(orderedMatch[2]))
    } else if (bulletMatch) {
      if (listType !== 'unordered') { flushList(); listType = 'unordered' }
      listItems.push(processInline(bulletMatch[1]))
    } else {
      flushList()
      if (line.trim() === '') {
        if (elements.length > 0) elements.push(<br key={`br-${i}`} />)
      } else {
        elements.push(<span key={`ln-${i}`} className="block">{processInline(line)}</span>)
      }
    }
  })
  flushList()

  return <div className="text-sm leading-relaxed">{elements}</div>
}

// ─── Audio helpers ───────────────────────────────────────────────────────────

/**
 * Convert any browser-decodable audio Blob to a 16-bit mono PCM WAV Blob.
 * Muxlisa STT works most reliably with WAV format.
 */
async function blobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext()
  let audioBuffer
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  } finally {
    await audioCtx.close()
  }

  // Mix down to mono by averaging all channels
  const numFrames = audioBuffer.length
  const sampleRate = audioBuffer.sampleRate
  const numChannels = audioBuffer.numberOfChannels
  const monoData = new Float32Array(numFrames)
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch)
    for (let i = 0; i < numFrames; i++) {
      monoData[i] += channelData[i] / numChannels
    }
  }

  // Encode as 16-bit PCM WAV
  const pcmData = new Int16Array(numFrames)
  for (let i = 0; i < numFrames; i++) {
    const s = Math.max(-1, Math.min(1, monoData[i]))
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  const wavBuffer = new ArrayBuffer(44 + pcmData.byteLength)
  const view = new DataView(wavBuffer)
  const write = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)) }

  write(0, 'RIFF')
  view.setUint32(4, 36 + pcmData.byteLength, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)       // chunk size
  view.setUint16(20, 1, true)        // PCM format
  view.setUint16(22, 1, true)        // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)  // byte rate
  view.setUint16(32, 2, true)        // block align
  view.setUint16(34, 16, true)       // bits per sample
  write(36, 'data')
  view.setUint32(40, pcmData.byteLength, true)
  new Int16Array(wavBuffer, 44).set(pcmData)

  return new Blob([wavBuffer], { type: 'audio/wav' })
}

// ─── TTS helpers ─────────────────────────────────────────────────────────────

/** Split long speech text into ≤480-char chunks at sentence boundaries. */
function splitForTTS(text, maxLen = 480) {
  if (!text) return []
  text = text.trim()
  if (text.length <= maxLen) return [text]

  const chunks = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break }
    const slice = remaining.slice(0, maxLen)
    const last = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '))
    const cut = last > maxLen / 3 ? last + 2 : maxLen
    chunks.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trim()
  }
  return chunks.filter(Boolean)
}

/** Fetch TTS audio for one chunk, return an HTMLAudioElement. */
async function fetchTTSChunk(text) {
  const resp = await api.post('/voice/tts', { text, speaker: 0 }, { responseType: 'blob' })
  const url = URL.createObjectURL(resp.data)
  return { audio: new Audio(url), url }
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Qancha murojaat bor?",
  "Bot foydalanuvchilar soni?",
  "Yangi murojaatlar?",
  "Faol bo'limlar ro'yxati?",
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FloatingAIAgent() {
  const [open, setOpen]           = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [input, setInput]         = useState('')
  const [messages, setMessages]   = useState([{
    role: 'assistant',
    content: "Salom! Men IHMA tizimining AI yordamchisiman.\nTizim ma'lumotlari haqida savol bering — murojaatlar, bo'limlar, statistika va h.k. 💬",
    speechText: null,
  }])
  const [loading, setLoading]       = useState(false)
  const [autoSpeak, setAutoSpeak]   = useState(false)

  // STT state: 'idle' | 'recording' | 'transcribing'
  const [sttState, setSttState]     = useState('idle')
  const [sttError, setSttError]     = useState(null)

  // TTS: which message index is currently playing, and the stop callback
  const [playingIdx, setPlayingIdx] = useState(null)
  const stopPlayRef = useRef(null)   // call this to stop current playback

  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef   = useRef([])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [messages, open, minimized])

  // Stop playback when chat closes
  useEffect(() => {
    if (!open) stopPlayRef.current?.()
  }, [open])

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const userMsg = { role: 'user', content: msg, speechText: null }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setSttError(null)

    try {
      const history = newMessages.slice(1)
      const { data } = await api.post('/ai/chat', {
        message: msg,
        history: history.slice(-8),
      })
      const assistantMsg = {
        role: 'assistant',
        content: data.reply,
        speechText: data.speech_text || null,
      }
      setMessages(prev => {
        const updated = [...prev, assistantMsg]
        if (autoSpeak && data.speech_text) {
          // slight delay so component renders first
          setTimeout(() => playTTS(updated.length - 1, data.speech_text), 100)
        }
        return updated
      })
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "⚠️ Xato yuz berdi. Qaytadan urinib ko'ring.",
        speechText: null,
      }])
    } finally {
      setLoading(false)
    }
  }

  // ── TTS playback ────────────────────────────────────────────────────────────
  const playTTS = useCallback(async (msgIdx, speechText) => {
    // Stop any current playback
    stopPlayRef.current?.()

    if (!speechText) return

    let cancelled = false
    const audioObjects = []

    stopPlayRef.current = () => {
      cancelled = true
      audioObjects.forEach(({ audio, url }) => {
        audio.pause()
        URL.revokeObjectURL(url)
      })
      setPlayingIdx(null)
      stopPlayRef.current = null
    }

    setPlayingIdx(msgIdx)

    try {
      const chunks = splitForTTS(speechText)
      for (const chunk of chunks) {
        if (cancelled) break
        const { audio, url } = await fetchTTSChunk(chunk)
        if (cancelled) { URL.revokeObjectURL(url); break }
        audioObjects.push({ audio, url })
        await new Promise((resolve) => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve() }
          audio.onerror = () => { URL.revokeObjectURL(url); resolve() }
          audio.play().catch(resolve)
        })
      }
    } catch {
      // TTS failed silently — not critical
    } finally {
      if (!cancelled) {
        setPlayingIdx(null)
        stopPlayRef.current = null
      }
    }
  }, [])

  const stopTTS = useCallback(() => {
    stopPlayRef.current?.()
  }, [])

  // ── STT recording ───────────────────────────────────────────────────────────
  const startRecording = async () => {
    setSttError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setSttError("Mikrofon qo'llab-quvvatlanmaydi")
      return
    }

    const mimeType =
      ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) || ''

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const usedType = recorder.mimeType || mimeType || 'audio/webm'
        const rawBlob = new Blob(chunksRef.current, { type: usedType })
        if (rawBlob.size === 0) {
          setSttState('idle')
          setSttError("Ovoz yozilmadi")
          return
        }

        setSttState('transcribing')
        try {
          // Convert to 16-bit mono WAV — Muxlisa STT most reliable with WAV
          let audioBlob
          try {
            audioBlob = await blobToWav(rawBlob)
          } catch {
            // If Web Audio decoding fails (very unlikely), fall back to raw blob
            audioBlob = rawBlob
          }

          const formData = new FormData()
          formData.append('audio', audioBlob, 'voice.wav')
          const { data } = await api.post('/voice/stt', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          if (data.success && data.text) {
            setInput(data.text)
            setTimeout(() => inputRef.current?.focus(), 50)
          } else {
            setSttError("Ovoz tanilmadi — qayta urinib ko'ring")
          }
        } catch (err) {
          const msg = err.response?.data?.detail || "STT xatosi"
          setSttError(msg)
        } finally {
          setSttState('idle')
        }
      }

      recorder.start()
      recorderRef.current = recorder
      setSttState('recording')
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setSttError("Mikrofon ruxsati berilmagan")
      } else {
        setSttError("Mikrofon xatosi: " + err.message)
      }
    }
  }

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  const handleMicClick = () => {
    if (sttState === 'recording') stopRecording()
    else if (sttState === 'idle') startRecording()
  }

  // ── Clear chat ───────────────────────────────────────────────────────────────
  const clearChat = () => {
    stopTTS()
    setMessages([{
      role: 'assistant',
      content: "Salom! Men IHMA tizimining AI yordamchisiman.\nTizim ma'lumotlari haqida savol bering — murojaatlar, bo'limlar, statistika va h.k. 💬",
      speechText: null,
    }])
    setSttError(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-primary shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center text-primary-content"
          title="AI Yordamchi"
        >
          <Bot size={24} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-base-100" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className={clsx(
          'fixed bottom-6 right-6 z-[9999] bg-base-100 rounded-2xl shadow-2xl border border-base-300 flex flex-col transition-all duration-300',
          minimized ? 'w-72 h-14' : 'w-80 sm:w-96 h-[580px]',
        )}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary rounded-t-2xl flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary-content/20 flex items-center justify-center">
              <Bot size={16} className="text-primary-content" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary-content leading-tight">IHMA AI Yordamchi</p>
              {!minimized && (
                <p className="text-xs text-primary-content/70">Ovoz bilan ham muloqot qilishingiz mumkin</p>
              )}
            </div>

            {/* Auto-speak toggle */}
            {!minimized && (
              <button
                onClick={() => { setAutoSpeak(v => !v); if (autoSpeak) stopTTS() }}
                className={clsx(
                  'btn btn-xs btn-circle transition-colors',
                  autoSpeak
                    ? 'bg-primary-content/30 text-primary-content hover:bg-primary-content/40'
                    : 'btn-ghost text-primary-content/50 hover:text-primary-content hover:bg-primary-content/20',
                )}
                title={autoSpeak ? "Ovozni o'chirish" : "Javoblarni ovozda o'qish"}
              >
                {autoSpeak ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
            )}

            <button
              onClick={() => setMinimized(m => !m)}
              className="btn btn-ghost btn-xs btn-circle text-primary-content/70 hover:text-primary-content hover:bg-primary-content/20"
            >
              {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            </button>
            <button
              onClick={() => { setOpen(false); setMinimized(false) }}
              className="btn btn-ghost btn-xs btn-circle text-primary-content/70 hover:text-primary-content hover:bg-primary-content/20"
            >
              <X size={13} />
            </button>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.map((m, idx) => (
                  <div key={idx} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>

                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                        <Bot size={13} className="text-primary" />
                      </div>
                    )}

                    <div className="flex flex-col items-start max-w-[75%] gap-1">
                      <div className={clsx(
                        'px-3 py-2 rounded-2xl leading-relaxed w-full',
                        m.role === 'user'
                          ? 'bg-primary text-primary-content rounded-br-sm text-sm whitespace-pre-wrap'
                          : 'bg-base-200 text-base-content rounded-bl-sm',
                      )}>
                        {m.role === 'user'
                          ? m.content
                          : <MarkdownMessage content={m.content} />
                        }
                      </div>

                      {/* TTS play button for assistant messages */}
                      {m.role === 'assistant' && m.speechText && (
                        <button
                          onClick={() => {
                            if (playingIdx === idx) stopTTS()
                            else playTTS(idx, m.speechText)
                          }}
                          className={clsx(
                            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-colors',
                            playingIdx === idx
                              ? 'bg-primary/15 text-primary'
                              : 'text-base-content/30 hover:text-primary hover:bg-primary/10',
                          )}
                          title={playingIdx === idx ? "To'xtatish" : "Ovozda o'qish"}
                        >
                          {playingIdx === idx
                            ? <><Square size={9} className="fill-current" /> To'xtatish</>
                            : <><Volume2 size={9} /> Ovozda eshit</>
                          }
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot size={13} className="text-primary" />
                    </div>
                    <div className="bg-base-200 px-4 py-3 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1">
                        {[0, 150, 300].map(d => (
                          <span key={d} className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"
                            style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick suggestions (only at start) */}
              {messages.length === 1 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                      className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* STT error banner */}
              {sttError && (
                <div className="mx-3 mb-1 px-3 py-1.5 rounded-lg bg-error/10 text-error text-xs flex items-center justify-between flex-shrink-0">
                  <span>{sttError}</span>
                  <button onClick={() => setSttError(null)} className="ml-2 hover:opacity-70">✕</button>
                </div>
              )}

              {/* Input row */}
              <div className="p-3 border-t border-base-300 flex gap-2 items-end flex-shrink-0">

                {/* Clear chat */}
                <button onClick={clearChat}
                  className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-error flex-shrink-0"
                  title="Tozalash">
                  <Trash2 size={13} />
                </button>

                {/* Text input */}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                  }}
                  placeholder={sttState === 'transcribing' ? 'Ovoz tanilmoqda...' : 'Savol yozing...'}
                  rows={1}
                  disabled={sttState === 'transcribing'}
                  className="flex-1 resize-none bg-base-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 max-h-24 overflow-y-auto disabled:opacity-60"
                  style={{ minHeight: '36px' }}
                />

                {/* Mic button */}
                <button
                  onClick={handleMicClick}
                  disabled={sttState === 'transcribing' || loading}
                  className={clsx(
                    'btn btn-sm btn-circle flex-shrink-0 transition-all',
                    sttState === 'recording'
                      ? 'bg-error text-white border-error hover:bg-error/80 animate-pulse'
                      : sttState === 'transcribing'
                        ? 'btn-disabled opacity-50'
                        : 'btn-ghost text-base-content/50 hover:text-primary hover:bg-primary/10',
                  )}
                  title={sttState === 'recording' ? 'Yozishni to\'xtatish' : 'Ovoz orqali so\'rash'}
                >
                  {sttState === 'transcribing'
                    ? <Loader2 size={14} className="animate-spin" />
                    : sttState === 'recording'
                      ? <MicOff size={14} />
                      : <Mic size={14} />
                  }
                </button>

                {/* Send button */}
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading || sttState !== 'idle'}
                  className="btn btn-primary btn-sm btn-circle flex-shrink-0"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
