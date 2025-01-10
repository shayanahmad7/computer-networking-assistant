'use client'

import React, { useRef, useEffect } from 'react'
import { Message, useAssistant } from 'ai/react'
import { Send, Loader2, User, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const Chat: React.FC = () => {
  const { status, messages, input, submitMessage, handleInputChange } = useAssistant({ api: '/api/assistant' })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const renderMessage = (content: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        className="prose prose-sm dark:prose-invert max-w-none"
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold my-4 text-center" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-bold my-3 text-center" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-bold my-3" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="my-2" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="my-2 space-y-1 list-disc pl-6" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="my-2 space-y-1 list-decimal pl-6" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-normal" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 my-2" {...props} />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    )
  }

  return (
    <div className="flex h-[600px] flex-col rounded-xl bg-gray-50 shadow-inner">
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
            </div>
          </div>
        ))}
        {status === 'in_progress' && (
          <div className="flex justify-start">
            <div className="flex items-center rounded-full bg-white px-4 py-2 text-gray-800 shadow">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              AI is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitMessage()
        }}
        className="border-t border-gray-200 bg-white p-4"
      >
        <div className="flex rounded-full bg-gray-100 shadow-inner">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about computer networking..."
            disabled={status !== 'awaiting_message'}
            className="flex-1 rounded-l-full bg-transparent px-6 py-3 focus:outline-none"
          />
          <button
            type="submit"
            disabled={status !== 'awaiting_message'}
            className="flex items-center rounded-r-full bg-blue-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 disabled:bg-gray-400"
          >
            <Send className="mr-2 h-5 w-5" />
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

export default Chat;
