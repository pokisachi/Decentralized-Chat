import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

// Constants for localStorage keys
const PRIVATE_KEY = 'my-chat-room'
const GROUP_KEY = 'decentralized-group'

// Helper to load chat history
const loadHistory = key => JSON.parse(localStorage.getItem(key) || '[]')
// Get last message preview
const getPreview = history => {
  if (!history.length) return { text: 'Chưa có tin nhắn', timestamp: null }
  const last = history[history.length - 1]
  return {
    text: last.content || last.text || '',
    timestamp: last.timestamp || ''
  }
}

export default function ChatList() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [activeTab, setActiveTab] = useState('private')

  useEffect(() => {
    const privHist = loadHistory(PRIVATE_KEY)
    const grpHist = loadHistory(GROUP_KEY)

    const updatedItems = [
        {
          id: 'private',
          name: 'Chat cá nhân',
          key: PRIVATE_KEY,
          preview: getPreview(privHist),
          path: '/contacts',
          avatar: <img src="/vite.svg" alt="avatar" className="w-10 h-10 rounded-full" />,
          time: '10:00'
        },
        {
          id: 'group',
          name: 'Group Chat',
          key: GROUP_KEY,
          preview: getPreview(grpHist),
          path: '/group',
          avatar: <img src="/vite.svg" alt="avatar" className="w-10 h-10 rounded-full" />,
          time: '11:00'
        }
      ]
    
    setItems(updatedItems)
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen bg-white">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
        <div className="text-2xl font-bold text-blue-600">DCTL Chat</div>
        <div className="cursor-pointer">⚙️</div>
      </div>

      {/* Search & New Chat */}
      <div className="p-4 flex gap-2">
        <input
          type="text"
          placeholder="Tìm kiếm cuộc trò chuyện..."
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button className="px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">
          + New Chat
        </Button>
      </div>

      {/* Chat Type Tabs */}
      <div className="flex border-b border-gray-200">
        <div
          className={`flex-1 text-center py-2 cursor-pointer ${
            activeTab === 'private' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('private')}
        >
          Cá nhân
        </div>
        <div
          className={`flex-1 text-center py-2 cursor-pointer ${
            activeTab === 'group' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('group')}
        >
          Nhóm
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-6">
        {items.map((item) => {
          if(activeTab === 'private' && item.id === 'group') return null
          if(activeTab === 'group' && item.id === 'private') return null
          return (
            <div
              key={item.id}
              onClick={() => navigate(item.path)}
              className="flex items-center py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50"
            >
              {item.avatar}
              <div className="ml-3 flex-1">
                <div className="font-semibold text-gray-900">{item.name}</div>
                <div className="text-sm text-gray-500 truncate">
                  {item.preview.text}
                </div>
              </div>
              <div className="text-xs text-gray-400">{item.time}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

