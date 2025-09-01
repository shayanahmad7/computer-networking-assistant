'use client'

import React, { useState } from 'react'
import { Eye, EyeOff, Lock, MessageSquare, Calendar, User, Bot, ChevronDown, ChevronRight, Volume2, VolumeX, RefreshCw, Home, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

// KaTeX trust context interface
interface KatexTrustContext {
  command: string;
}

// Enhanced KaTeX configuration for complex mathematical expressions
const katexOptions = {
  throwOnError: false,
  errorColor: '#cc0000',
  displayMode: false,
  fleqn: false,
  macros: {
    "\\RR": "\\mathbb{R}",
    "\\NN": "\\mathbb{N}",
    "\\ZZ": "\\mathbb{Z}",
    "\\QQ": "\\mathbb{Q}",
    "\\CC": "\\mathbb{C}",
    "\\FF": "\\mathbb{F}",
    "\\PP": "\\mathbb{P}",
    "\\EE": "\\mathbb{E}",
    "\\dd": "\\mathrm{d}",
    "\\ee": "\\mathrm{e}",
    "\\ii": "\\mathrm{i}",
    "\\oo": "\\infty",
    "\\eps": "\\varepsilon",
    "\\RRR": "\\mathrm{R}",
    "\\NNN": "\\mathrm{N}",
    "\\ZZZ": "\\mathrm{Z}",
    "\\PPP": "\\mathrm{P}",
    "\\dprop": "d_{\\text{prop}}",
    "\\dtrans": "d_{\\text{trans}}",
    "\\dendtoend": "d_{\\text{end-to-end}}",
  },
  trust: (context: KatexTrustContext) => ['\\htmlId', '\\href'].includes(context.command),
  strict: false,
  output: 'html',
  minRuleThickness: 0.05,
  maxSize: Infinity,
  maxExpand: 1000,
} as const

interface ChatThread {
  id: string;
  sessionId: string;
  userId: string;
  chapter: string;
  chapterName: string;
  assistantType: string;
  collectionName?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  firstMessage: string;
  lastMessage: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    userId?: string;
  }>;
}

const AdminChatsPage: React.FC = () => {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [chats, setChats] = useState<ChatThread[]>([])
  const [selectedChat, setSelectedChat] = useState<ChatThread | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedAssistants, setExpandedAssistants] = useState<Set<string>>(new Set())
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const handleAuthentication = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/chats?password=${encodeURIComponent(password)}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setIsAuthenticated(true)
        setChats(data.chats)

        // Don't auto-expand or select any chats - let user choose
      } else {
        setError('Invalid password')
      }
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Refresh chat history without page reload
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/admin/chats?password=${encodeURIComponent(password)}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setChats(data.chats)
        setSelectedChat(null) // Clear selected chat when refreshing
      } else {
        setError('Failed to refresh chats')
      }
    } catch {
      setError('Connection failed during refresh.')
    } finally {
      setRefreshing(false)
    }
  }

  // Delete individual chat
  const handleDeleteChat = async (chatId: string, collectionName?: string) => {
    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      return
    }

    try {
      const deletePayload = {
        chatId,
        collectionName,
        password // Include password for authentication
      }

      const response = await fetch('/api/admin/chats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deletePayload)
      })

      if (response.ok) {
        // Remove chat from local state
        setChats(prevChats => prevChats.filter(chat => chat.id !== chatId))

        // Clear selected chat if it was the deleted one
        if (selectedChat?.id === chatId) {
          setSelectedChat(null)
        }

        alert('Chat deleted successfully')
      } else {
        const errorData = await response.json()
        alert(`Failed to delete chat: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
      alert('Failed to delete chat. Please try again.')
    }
  }

  // Navigate back to home
  const handleGoHome = () => {
    window.location.href = '/'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getAssistantName = (chat: ChatThread) => {
    if (chat.assistantType === 'Custom RAG') {
      return `Custom RAG: ${chat.chapterName}`
    }
    // For OpenAI assistants, show full chapter name
    return `Chapter ${chat.chapter}: ${chat.chapterName}`
  }

  // Group chats by assistant type and chapter, with Custom RAG at the bottom
  const groupChatsByAssistant = () => {
    const groups: { [key: string]: ChatThread[] } = {}
    chats.forEach(chat => {
      const assistantName = getAssistantName(chat)
      if (!groups[assistantName]) {
        groups[assistantName] = []
      }
      groups[assistantName].push(chat)
    })

    // Sort groups so Custom RAG appears at the bottom
    const sortedGroups: { [key: string]: ChatThread[] } = {}
    const customRAGKey = Object.keys(groups).find(key => key.includes('Custom RAG'))
    const otherKeys = Object.keys(groups).filter(key => !key.includes('Custom RAG')).sort()

    // Add other groups first (sorted alphabetically)
    otherKeys.forEach(key => {
      sortedGroups[key] = groups[key]
    })

    // Add Custom RAG last
    if (customRAGKey) {
      sortedGroups[customRAGKey] = groups[customRAGKey]
    }

    return sortedGroups
  }

  const toggleAssistantExpansion = (assistantName: string) => {
    const newExpanded = new Set(expandedAssistants)
    if (newExpanded.has(assistantName)) {
      newExpanded.delete(assistantName)
    } else {
      newExpanded.add(assistantName)
    }
    setExpandedAssistants(newExpanded)
  }

  // Text-to-speech functionality (copied from original Chat component)
  const speakText = async (text: string, messageId: string) => {
    if (isSpeaking && currentlySpeakingId === messageId) {
      // Stop current speech
      setIsSpeaking(false)
      setCurrentlySpeakingId(null)
      return
    }

    try {
      setIsSpeaking(true)
      setCurrentlySpeakingId(messageId)

      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text, voice: 'nova' })
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)

        audio.onended = () => {
          setIsSpeaking(false)
          setCurrentlySpeakingId(null)
        }

        audio.play()
      }
    } catch (error) {
      console.error('Error with text-to-speech:', error)
      setIsSpeaking(false)
      setCurrentlySpeakingId(null)
    }
  }

  // Function to preprocess LaTeX expressions from AI responses
  const preprocessLatex = (text: string): string => {
    return text
      // Convert (expression) to $expression$ for inline math
      .replace(/\(([^)]*?)\)/g, (match, expr) => {
        // Only convert if it contains LaTeX-like content (contains \, _, ^, or common math symbols)
        if (expr.match(/[\\_\^\+\-\*\/\=\<\>]/) && !expr.includes('$')) {
          return `$${expr}$`;
        }
        return match;
      })
      // Convert [expression] to $$expression$$ for display math
      .replace(/\[([^\]]*?)\]/g, (match, expr) => {
        // Only convert if it contains LaTeX-like content
        if (expr.match(/[\\_\^\+\-\*\/\=\<\>]/) && !expr.includes('$')) {
          return `$$${expr}$$`;
        }
        return match;
      })
      // Convert ((expression)) to $(expression)$ for inline math with double parens
      .replace(/\(\(([^)]*?)\)\)/g, (match, expr) => {
        if (expr.match(/[\\_\^\+\-\*\/\=\<\>]/) && !expr.includes('$')) {
          return `$${expr}$`;
        }
        return match;
      });
  };

  // Render message function (copied from original Chat component)
  const renderMessage = (content: string) => {
    // Preprocess the content to handle AI's LaTeX format
    const processedContent = preprocessLatex(content);

    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, katexOptions]]}
        className="prose prose-sm dark:prose-invert max-w-none"
        components={{
          h1: ({ ...props }) => (
            <h1 className="text-2xl font-bold my-4 text-center" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="text-xl font-bold my-3 text-center" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="text-lg font-bold my-3" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="my-2" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="my-2 space-y-1 list-disc pl-6" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="my-2 space-y-1 list-decimal pl-6" {...props} />
          ),
          li: ({ ...props }) => (
            <li className="leading-normal" {...props} />
          ),
          blockquote: ({ ...props }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 my-2" {...props} />
          ),
          // Enhanced math rendering with error handling
          div: ({ className, ...props }) => {
            if (className && className.includes('math-display')) {
              return (
                <div
                  className={`${className} my-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border overflow-x-auto`}
                  {...props}
                />
              )
            }
            return <div className={className} {...props} />
          },
          span: ({ className, ...props }) => {
            if (className && className.includes('math-inline')) {
              return (
                <span
                  className={`${className} mx-1`}
                  {...props}
                />
              )
            }
            return <span className={className} {...props} />
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-purple-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Lock className="mx-auto h-16 w-16 text-blue-500 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
            <p className="text-gray-600 mt-2">Enter password to view chat history</p>

          </div>

          <form onSubmit={handleAuthentication} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                  placeholder="Enter admin password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? 'Authenticating...' : 'Access Admin Panel'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            This page is for research purposes only
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-purple-100 p-4">
      <div className="w-full max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex h-screen">
          {/* Left Sidebar - Chat List */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Chat History</h2>
                  <p className="text-gray-600 text-sm mt-1">{chats.length} conversations total</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                    title="Refresh chat history"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                  <button
                    onClick={handleGoHome}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    title="Go back to home page"
                  >
                    <Home className="h-4 w-4" />
                    Home
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {Object.entries(groupChatsByAssistant()).map(([assistantName, assistantChats]) => (
                <div key={assistantName} className="border-b border-gray-100">
                  <div
                    onClick={() => toggleAssistantExpansion(assistantName)}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center">
                      {expandedAssistants.has(assistantName) ? (
                        <ChevronDown className="h-4 w-4 mr-2 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mr-2 text-gray-500" />
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm">
                          {assistantName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {assistantChats.length} chats
                        </div>
                      </div>
                      <div className="ml-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          assistantName.includes('Custom RAG')
                            ? 'bg-purple-100 text-purple-800'
                            : assistantName.includes('Legacy')
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {assistantName.includes('Custom RAG') ? 'Custom RAG' :
                           assistantName.includes('Legacy') ? 'Legacy' : 'OpenAI Assistant'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {expandedAssistants.has(assistantName) && (
                    <div className="bg-gray-50">
                      {assistantChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => setSelectedChat(chat)}
                          className={`pl-8 pr-4 py-3 border-l-2 cursor-pointer hover:bg-gray-100 transition-colors ${
                            selectedChat?.id === chat.id
                              ? 'bg-blue-50 border-l-blue-500'
                              : 'border-l-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1">
                              <div className="text-xs text-gray-500 font-mono">
                                Session: {chat.sessionId.substring(0, 12)}...
                              </div>
                              <div className="text-xs text-gray-500 font-mono">
                                User: {chat.userId.substring(0, 12)}...
                              </div>
                              {chat.collectionName && chat.collectionName !== 'messages' && (
                                <div className="text-xs text-gray-400 font-mono">
                                  {chat.collectionName.replace('_messages', '')}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-gray-500">
                                {chat.messageCount} msgs
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteChat(chat.id, chat.collectionName)
                                }}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                title="Delete this chat"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          <p className="text-sm text-gray-700 mb-1 line-clamp-2">
                            {chat.firstMessage}
                          </p>

                          <div className="text-xs text-gray-500">
                            {formatDate(chat.updatedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>


          </div>

          {/* Right Side - Chat View */}
          <div className="flex-1 flex flex-col">
            {selectedChat ? (
              <>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {getAssistantName(selectedChat)}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          selectedChat.assistantType === 'Custom RAG'
                            ? 'bg-purple-100 text-purple-800'
                            : selectedChat.assistantType.includes('Legacy')
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedChat.assistantType}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-1" />
                        Started: {formatDate(selectedChat.createdAt)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 font-mono">
                        Session: {selectedChat.sessionId}
                      </div>
                                                   <div className="text-xs text-gray-500 mt-1 font-mono">
                               User ID: {selectedChat.userId}
                             </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        {selectedChat.messageCount} messages
                      </div>

                    </div>
                  </div>
                </div>

                {/* Chat Messages - Admin view of conversation history */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">



                  {/* Actual chat messages */}
                  {selectedChat.messages && selectedChat.messages.length > 0 ? (
                    selectedChat.messages.map((message, index) => (
                    <div key={index} className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`flex max-w-[80%] items-start rounded-2xl px-4 py-3 ${
                          message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 shadow'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <User className="mr-2 h-5 w-5 shrink-0 mt-1" />
                        ) : (
                          <Bot className="mr-2 h-5 w-5 shrink-0 mt-1" />
                        )}
                        <div
                          className={`${message.role === 'user' ? 'prose-invert' : ''}
                            prose-headings:text-inherit prose-p:text-inherit
                            prose-strong:text-inherit prose-ol:text-inherit prose-ul:text-inherit
                            [&_.katex-display]:my-3 [&_.katex-display]:text-center
                          `}
                        >
                          {message.content && message.content.trim() ? (
                            renderMessage(message.content)
                          ) : (
                            <div className="text-gray-500 italic">
                              [Empty message - {message.role}]
                            </div>
                          )}
                        </div>

                        {/* Text-to-speech button for assistant messages - exact copy from original */}
                        {message.role === 'assistant' && (
                          <button
                            onClick={() => speakText(message.content, `message-${index}`)}
                            className={`ml-2 p-2 rounded-full transition-colors ${
                              currentlySpeakingId === `message-${index}`
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title={currentlySpeakingId === `message-${index}` ? 'Stop speaking' : 'Listen to this message'}
                          >
                            {currentlySpeakingId === `message-${index}` ? (
                              <VolumeX className="h-4 w-4" />
                            ) : (
                              <Volume2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                  ) : (
                    <div className="mb-4 p-4 bg-red-100 text-red-800 text-center">
                      No messages found in this chat. This might be an error.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                  <MessageSquare className="mx-auto h-16 w-16 mb-4" />
                  <p>Select a chat from the sidebar to view</p>
                  <p className="text-sm mt-2">Click on an assistant to expand and see all chats</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminChatsPage
