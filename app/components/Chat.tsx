'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Message, useAssistant } from 'ai/react'
import { Send, Loader2, User, Bot, StopCircle, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { MathJax, MathJaxContext } from 'better-react-mathjax'

// MathJax configuration for LaTeX rendering
const mathJaxConfig = {
  tex: {
    inlineMath: [['\\(', '\\)']],
    displayMath: [['\\[', '\\]']],
    processEscapes: true,
    processEnvironments: true,
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
  },
}

interface ChatProps {
  assistantId: string;
  userId?: string; // Optional user ID for tracking
}

const Chat: React.FC<ChatProps> = ({ assistantId, userId }) => {
  const { status, messages: aiMessages, input, submitMessage, handleInputChange, stop } = useAssistant({
    api: '/api/assistant',
    body: {
      assistantId: assistantId,
      userId: userId || 'anonymous' // Default to anonymous if no userId provided
    }
  })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  // Speech-to-text states
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingAudio, setIsProcessingAudio] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Text-to-speech states
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentlySpeakingId, setIsCurrentlySpeakingId] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const initialMessages: Message[] = [
      {
        id: 'initial-1',
        content: "Your conversation with this tutor is being recorded. Data collected will not be published but will be analyzed to enhance the user experience in the future.",
        role: 'assistant'
      },
      {
        id: 'initial-2',
        content: "What's on your mind?",
        role: 'assistant'
      }
    ];

    setMessages([...initialMessages, ...aiMessages]);
  }, [aiMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setIsStreaming(status === 'in_progress')
  }, [status])

  // Speech-to-text functionality
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = async () => {
        setIsProcessingAudio(true)
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          
          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: audioBlob
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.success) {
              // For the AI SDK, we need to manually update the input field
              // and then trigger the change handler that the AI SDK provides
              if (data.text) {
                const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement
                if (inputElement) {
                  // Update the input value
                  inputElement.value = data.text
                  // Trigger the AI SDK's change handler by calling handleInputChange
                  // We need to create a synthetic event that matches what the AI SDK expects
                  const syntheticEvent = {
                    target: { value: data.text }
                  } as React.ChangeEvent<HTMLInputElement>
                  handleInputChange(syntheticEvent)
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing audio:', error)
        } finally {
          setIsProcessingAudio(false)
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Text-to-speech functionality
  const speakText = async (text: string, messageId: string) => {
    if (isSpeaking && currentlySpeakingId === messageId) {
      // Stop current speech
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      setIsSpeaking(false)
      setIsCurrentlySpeakingId(null)
      return
    }

    try {
      setIsSpeaking(true)
      setIsCurrentlySpeakingId(messageId)

      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, voice: 'nova' })
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        
        currentAudioRef.current = audio
        
        audio.onended = () => {
          setIsSpeaking(false)
          setIsCurrentlySpeakingId(null)
          currentAudioRef.current = null
        }
        
        audio.play()
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error)
      setIsSpeaking(false)
      setIsCurrentlySpeakingId(null)
    }
  }



  const renderMessage = (content: string) => {
    // First render LaTeX with MathJax, then process markdown
    return (
      <MathJaxContext config={mathJaxConfig}>
        <MathJax>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ ...props }) => (
                  <h1 className="text-2xl font-bold my-4 text-center" {...props} />
                ),
                h2: ({ ...props }) => (
                  <h2 className="text-xl font-semibold my-3 text-center" {...props} />
                ),
                h3: ({ ...props }) => (
                  <h3 className="text-lg font-medium my-2 text-center" {...props} />
                ),
                p: ({ ...props }) => (
                  <p className="mb-2 leading-relaxed" {...props} />
                ),
                ul: ({ ...props }) => (
                  <ul className="list-disc list-inside mb-2 space-y-1" {...props} />
                ),
                ol: ({ ...props }) => (
                  <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />
                ),
                li: ({ ...props }) => (
                  <li className="ml-2" {...props} />
                ),
                blockquote: ({ ...props }) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic my-2" {...props} />
                ),
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  return match ? (
                    <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto my-2">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm" {...props}>
                      {children}
                    </code>
                  )
                },
                pre: ({ ...props }) => (
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto my-2" {...props} />
                ),
                a: ({ href, children, ...props }) => (
                  <a 
                    href={href} 
                    className="text-blue-600 dark:text-blue-400 hover:underline" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                ),
                strong: ({ ...props }) => (
                  <strong className="font-bold" {...props} />
                ),
                em: ({ ...props }) => (
                  <em className="italic" {...props} />
                ),
                table: ({ ...props }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border-collapse border border-gray-300" {...props} />
                  </div>
                ),
                th: ({ ...props }) => (
                  <th className="border border-gray-300 px-4 py-2 bg-gray-100 dark:bg-gray-700 font-semibold" {...props} />
                ),
                td: ({ ...props }) => (
                  <td className="border border-gray-300 px-4 py-2" {...props} />
                ),
                hr: ({ ...props }) => (
                  <hr className="my-4 border-gray-300" {...props} />
                ),
                span: ({ className, ...props }) => {
                  if (className?.includes('katex-display')) {
                    return (
                      <div className="my-4 text-center">
                        <span className={className} {...props} />
                      </div>
                    )
                  }
                  return <span className={className} {...props} />
                }
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </MathJax>
      </MathJaxContext>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isStreaming) {
      await stop()
      setIsStreaming(false)
    } else if (input.trim()) {
      setIsStreaming(true)
      try {
        await submitMessage()
      } catch (error) {
        console.error('Error submitting message:', error)
        setIsStreaming(false)
      }
    }
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-xl bg-gray-50 shadow-inner">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m: Message) => (
          <div key={m.id} className={`mb-4 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`flex max-w-[80%] items-start rounded-2xl px-4 py-3 ${
                m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 shadow'
              }`}
            >
              {m.role === 'user' ? (
                <User className="mr-2 h-5 w-5 shrink-0 mt-1" />
              ) : (
                <Bot className="mr-2 h-5 w-5 shrink-0 mt-1" />
              )}
              <div 
                className={`${m.role === 'user' ? 'prose-invert' : ''} 
                  prose-headings:text-inherit prose-p:text-inherit
                  prose-strong:text-inherit prose-ol:text-inherit prose-ul:text-inherit
                  [&_.katex-display]:my-3 [&_.katex-display]:text-center
                `}
              >
                {renderMessage(m.content)}
              </div>
              
              {/* Text-to-speech button for assistant messages */}
              {m.role === 'assistant' && (
                <button
                  onClick={() => speakText(m.content, m.id)}
                  className={`ml-2 p-2 rounded-full transition-colors ${
                    currentlySpeakingId === m.id
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={currentlySpeakingId === m.id ? 'Stop speaking' : 'Listen to this message'}
                >
                  {currentlySpeakingId === m.id ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex justify-start items-center mb-4">
            <div className="flex items-center rounded-full bg-white px-4 py-2 text-gray-800 shadow">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              AI is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 bg-white p-4"
      >
        <div className="flex rounded-full bg-gray-100 shadow-inner">
          {/* Mic button for speech-to-text */}
          <button
            type="button"
            onClick={handleRecording}
            title={isRecording ? 'Stop recording' : 'Record your message'}
            className={`p-3 rounded-l-full focus:outline-none transition-colors ${
              isRecording
                ? 'animate-pulse ring-2 ring-red-500 bg-red-100 text-red-600'
                : isProcessingAudio
                ? 'bg-yellow-100 text-yellow-600 cursor-wait'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
            }`}
            disabled={isProcessingAudio || isStreaming}
          >
            {isProcessingAudio ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRecording ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </button>

          {/* Text input field */}
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about computer networking..."
            disabled={isStreaming}
            className="flex-1 bg-transparent px-6 py-3 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() && !isStreaming}
            className={`flex items-center rounded-r-full px-6 py-3 font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 ${
              isStreaming
                ? 'bg-red-500 hover:bg-red-600'
                : input.trim()
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isStreaming ? (
              <>
                <StopCircle className="mr-2 h-5 w-5" />
                <span className="sr-only">Stop generating</span>
                <span aria-hidden="true">Stop</span>
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                <span className="sr-only">Send message</span>
                <span aria-hidden="true">Send</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Chat;

