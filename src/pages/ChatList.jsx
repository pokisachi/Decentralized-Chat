import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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

  useEffect(() => {
    const privHist = loadHistory(PRIVATE_KEY)
    const grpHist = loadHistory(GROUP_KEY)

    setItems([
      {
        id: 'private',
        name: 'Chat cá nhân',
        key: PRIVATE_KEY,
        preview: getPreview(privHist),
        path: '/contacts'
      },
      {
        id: 'group',
        name: 'Group Chat',
        key: GROUP_KEY,
        preview: getPreview(grpHist),
        path: '/group'
      }
    ])
  }, [])

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl mb-4">Danh sách cuộc trò chuyện</h1>
      <ul>
        {items.map(item => (
          <li
            key={item.id}
            onClick={() => navigate(item.path)}
            className="p-3 mb-2 border rounded cursor-pointer hover:bg-gray-100"
          >
            <div className="font-semibold mb-1">{item.name}</div>
            <div className="text-gray-600 text-sm truncate">{item.preview.text}</div>
            
          </li>
        ))}
      </ul>
    </div>
  )
}
