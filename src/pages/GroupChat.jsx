import React, { useState, useEffect, useRef } from 'react'
import { subscribeTopic, publishMessage } from '@/lib/ipfsPubsub'
import { create } from 'ipfs-http-client'

// IPFS client for file upload
const ipfs = create({ url: 'http://127.0.0.1:5001/api/v0' })

export default function GroupChat() {
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])
  const [username, setUsername] = useState(() => {
    // Generate a random username if not set
    const saved = localStorage.getItem('username')
    return saved || `User-${Math.floor(Math.random() * 10000)}`
  })
  const fileInputRef = useRef(null)
  const subscribed = useRef(false)
  const msgCount = useRef(0)
  const chatContainerRef = useRef(null)
  const room = 'decentralized-group'
  const processedMessages = useRef(new Set()) // Track already processed message IDs

  // Save username when it changes
  useEffect(() => {
    localStorage.setItem('username', username)
  }, [username])

  // Load history on mount
  useEffect(() => {
    try {
      const hist = JSON.parse(localStorage.getItem(room) || '[]')
      if (hist.length) {
        // Add all existing message IDs to processed set
        hist.forEach(msg => processedMessages.current.add(msg.id))
        setMessages(hist)
      }
    } catch (err) {
      console.error('Error loading chat history:', err)
    }
  }, [])

  // Save history when messages change
  useEffect(() => {
    try {
      localStorage.setItem(room, JSON.stringify(messages))
    } catch (err) {
      console.error('Error saving chat history:', err)
    }
  }, [messages])

  // Auto scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // Subscribe to topic once
  useEffect(() => {
    if (subscribed.current) return
    
    subscribed.current = true
    
    const handleIncomingMessage = msg => {
      // Skip if we've already processed this message
      if (processedMessages.current.has(msg.id)) return
      
      // Add to processed set
      processedMessages.current.add(msg.id)
      
      // Check if message is from current user
      const isFromMe = msg.senderName === username
      
      // Set sender display name
      const sender = isFromMe ? 'You' : (msg.senderName || 'Unknown')
      
      setMessages(prev => {
        // Create new message with proper sender name
        const newMsg = { ...msg, sender }
        return [...prev, newMsg]
      })
    }
    
    const unsubscribe = subscribeTopic(room, handleIncomingMessage)
    
    return () => unsubscribe()
  }, [username])

  // Send text message
  const sendText = async () => {
    if (!text.trim()) return
    
    try {
      const id = `${Date.now()}-${msgCount.current++}`
      
      // Add sender name to message metadata
      const metadata = { senderName: username }
      const messageData = await publishMessage(room, text, id, metadata)
      
      // Add to processed set to prevent duplication
      processedMessages.current.add(id)
      
      // Add to local messages
      const msg = { ...messageData, sender: 'You' }
      setText('')
      setMessages(prev => [...prev, msg])
    } catch (err) {
      console.error('Error sending message:', err)
      alert('Không thể gửi tin nhắn. Vui lòng thử lại.')
    }
  }

  // Check if file is an image
  const isImageFile = fileName => {
    const exts = ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg']
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
    return exts.includes(ext)
  }

  // Handle file selection and upload
  const handleFileChange = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const added = await ipfs.add(file)
      const cid = added.cid.toString()
      const type = isImageFile(file.name) ? 'image' : 'file'
      const payload = JSON.stringify({ 
        cid, 
        name: file.name, 
        type, 
        mimeType: file.type 
      })
      
      const id = `${Date.now()}-${msgCount.current++}`
      
      // Add sender name to message metadata
      const metadata = { senderName: username }
      const messageData = await publishMessage(room, payload, id, metadata)
      
      // Add to processed set to prevent duplication
      processedMessages.current.add(id)
      
      // Add to local messages
      const msg = {
        ...messageData,
        sender: 'You',
        fileUrl: `https://ipfs.io/ipfs/${cid}`,
        fileName: file.name,
        fileType: type
      }
      
      setMessages(prev => [...prev, msg])
      fileInputRef.current.value = null
    } catch (err) {
      console.error('Lỗi khi tải lên file:', err)
      alert('Không thể tải lên file. Vui lòng thử lại.')
    }
  }

  // Render message (text or file)
  const renderMessage = msg => {
    if (msg.fileUrl && msg.fileName) {
      if (msg.fileType === 'image') {
        return <img src={msg.fileUrl} alt={msg.fileName} className="max-w-full max-h-48 rounded" />
      } else {
        return <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">📎 {msg.fileName}</a>
      }
    }
    
    try {
      const obj = JSON.parse(msg.text)
      if (obj.cid && obj.name) {
        const url = `https://ipfs.io/ipfs/${obj.cid}`
        if (obj.type === 'image') {
          return <img src={url} alt={obj.name} className="max-w-full max-h-48 rounded" />
        }
        return <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">📎 {obj.name}</a>
      }
    } catch {}
    
    return msg.text
  }

  // Change username
  const changeUsername = () => {
    const newName = prompt('Nhập tên hiển thị của bạn:', username)
    if (newName && newName.trim() !== '') {
      setUsername(newName.trim())
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl">Group Chat (IPFS PubSub)</h1>
        <div className="flex items-center">
          <span className="mr-2 text-sm">Tên hiển thị: <strong>{username}</strong></span>
          <button 
            onClick={changeUsername}
            className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
          >
            Đổi tên
          </button>
        </div>
      </div>
      
      <div ref={chatContainerRef} className="border p-2 h-64 overflow-auto mb-4">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center my-8">Chưa có tin nhắn</div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || i} className={msg.sender === 'You' ? 'text-right' : 'text-left'}>
              <div className={`inline-block px-3 py-1 rounded my-1 ${msg.sender === 'You' ? 'bg-blue-100' : 'bg-gray-200'}`}>
                <strong>{msg.sender}</strong>
                <div className="mt-1">{renderMessage(msg)}</div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <input
          className="flex-1 border px-2 py-1 rounded"
          placeholder="Nhập tin nhắn..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendText()}
        />
        <button 
          onClick={sendText} 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Gửi
        </button>
        <label className="cursor-pointer bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded">
          📎
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        </label>
      </div>
    </div>
  )
}