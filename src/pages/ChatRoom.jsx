import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import io from 'socket.io-client'
import {
  uploadFile,
  downloadFile,
  getFileType,
  validateFile,
  formatFileSize
} from '@/lib/ipfs'

// Improved chat history storage
const loadHistory = (key) => {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return []
    
    const parsed = JSON.parse(stored)
    
    // Reconstruct file components from stored data
    return parsed.map(msg => {
      // If message has fileData, reconstruct the appropriate component
      if (msg.fileData) {
        const { name, cid, fileType } = msg.fileData
        const url = `https://ipfs.io/ipfs/${cid}`
        
        // Rebuild the content component based on file type
        if (fileType.isImage) {
          msg.content = <img src={url} alt={name} className="max-w-full max-h-48 rounded mt-1" />
        } else if (fileType.isVideo) {
          msg.content = <video src={url} controls className="max-w-full max-h-48 rounded mt-1" />
        } else if (fileType.isAudio) {
          msg.content = <audio src={url} controls className="w-full mt-1" />
        } else {
          msg.content = <a href={url} download={name} className="text-blue-500 hover:underline">{fileType.icon} {name}</a>
        }
      }
      return msg
    })
  } catch (err) {
    console.error('Error loading chat history:', err)
    return []
  }
}

const saveHistory = (key, msgs) => {
  try {
    // Convert React elements to serializable data before saving
    const serializable = msgs.map(msg => {
      // Make a copy to avoid modifying the original
      const copy = { ...msg }
      
      // For file content messages, store metadata separately
      if (msg.fileData) {
        // fileData already contains the necessary info
        copy.content = null // Clear React element that can't be stringified
      } else if (typeof msg.content !== 'string' && msg.id?.startsWith('upload-')) {
        // For messages still uploading, just mark them
        copy.content = null
        copy.uploading = true
      } else if (typeof msg.content !== 'string' && msg.id?.startsWith('download-')) {
        // For messages still downloading, just mark them
        copy.content = null
        copy.downloading = true
      }
      
      return copy
    })
    
    localStorage.setItem(key, JSON.stringify(serializable))
  } catch (err) {
    console.error('Error saving chat history:', err)
  }
}

export default function ChatRoom() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [fileUploadProgress, setFileUploadProgress] = useState(0)
  const [fileDownloadProgress, setFileDownloadProgress] = useState({})
  const [uploadingFile, setUploadingFile] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [fileError, setFileError] = useState(null)

  const socketRef = useRef(null)
  const pcRef = useRef(null)
  const dcRef = useRef(null)
  const fileInputRef = useRef(null)
  const chatContainerRef = useRef(null)
  const roomId = 'my-chat-room'

  // Load history on mount
  useEffect(() => {
    const hist = loadHistory(roomId)
    if (hist.length) setMessages(hist)
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
    
    // Save messages to storage whenever they change
    saveHistory(roomId, messages)
  }, [messages])

  // Clear errors timeout
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(t)
    }
  }, [error])
  
  useEffect(() => {
    if (fileError) {
      const t = setTimeout(() => setFileError(null), 5000)
      return () => clearTimeout(t)
    }
  }, [fileError])

  // Signaling server setup
  useEffect(() => {
    socketRef.current = io('http://localhost:3001')
    socketRef.current.on('connect', () => socketRef.current.emit('join', roomId))
    socketRef.current.on('connect_error', () => setError('Không thể kết nối đến máy chủ'))

    socketRef.current.on('offer', async ({ from, offer }) => {
      if (from === socketRef.current.id) return
      await initPeer(false)
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pcRef.current.createAnswer()
      await pcRef.current.setLocalDescription(answer)
      socketRef.current.emit('answer', { to: from, answer })
    })

    socketRef.current.on('answer', async ({ from, answer }) => {
      if (from === socketRef.current.id) return
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
    })

    socketRef.current.on('ice-candidate', async ({ from, candidate }) => {
      if (from === socketRef.current.id || !pcRef.current?.remoteDescription) return
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
    })

    return () => {
      socketRef.current.disconnect()
      pcRef.current?.close()
    }
  }, [])

  // Initialize WebRTC peer
  const initPeer = async isCaller => {
    setConnecting(true)
    setError(null)
    pcRef.current?.close()

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pcRef.current = pc
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socketRef.current.emit('ice-candidate', { to: roomId, candidate })
    }
    pc.oniceconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
        setConnected(false)
        setError('Kết nối bị ngắt')
      }
    }

    if (isCaller) {
      const dc = pc.createDataChannel('chat')
      setupChannel(dc)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socketRef.current.emit('offer', { to: roomId, offer })
    } else {
      pc.ondatachannel = ({ channel }) => setupChannel(channel)
    }
  }

  // Setup DataChannel events
  const setupChannel = dc => {
    dcRef.current = dc
    dc.onopen = () => { setConnected(true); setConnecting(false) }
    dc.onclose = () => setConnected(false)
    dc.onerror = () => setError('Lỗi kênh dữ liệu')
    dc.onmessage = ({ data }) => handleIncoming(data)
  }

  // Handle incoming messages and files
  const handleIncoming = async data => {
    try {
      const obj = JSON.parse(data)
      if (obj.type === 'file' && obj.cid) {
        const id = `download-${obj.cid}`
        setFileDownloadProgress(prev => ({ ...prev, [id]: 0 }))
        
        // Create file metadata for storage
        const fileData = {
          cid: obj.cid,
          name: obj.name,
          size: obj.size,
          fileType: obj.fileType || getFileType(obj.name)
        }
        
        const placeholder = { 
          from: 'peer', 
          id, 
          fileData, // Store file metadata
          content: (
            <div id={id} className="flex flex-col">
              <div className="font-semibold">{obj.name}</div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{width: '0%'}}></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">Đang tải xuống...</div>
            </div>
          )
        }
        
        setMessages(prev => [...prev, placeholder])

        try {
          await downloadFile(obj.cid, p => {
            setFileDownloadProgress(prev => ({ ...prev, [id]: p }))
            // Update progress bar in DOM directly since React won't update during async operation
            const progressBar = document.querySelector(`#${id} .bg-blue-600`)
            if (progressBar) progressBar.style.width = `${p}%`
          })
          
          const type = fileData.fileType
          const url = `https://ipfs.io/ipfs/${obj.cid}`
          
          setMessages(prev => prev.map(msg => msg.id === id ? {
            ...msg,
            content: type.isImage ? <img src={url} alt={obj.name} className="max-w-full max-h-48 rounded mt-1" /> :
                    type.isVideo ? <video src={url} controls className="max-w-full max-h-48 rounded mt-1" /> :
                    type.isAudio ? <audio src={url} controls className="w-full mt-1" /> :
                    <a href={url} download={obj.name} className="text-blue-500 hover:underline">{type.icon} {obj.name}</a>
          } : msg))
        } catch (err) {
          console.error('Download error:', err)
          setMessages(prev => prev.map(msg => msg.id === id ? {
            ...msg, 
            content: <div className="text-red-500">Tải xuống thất bại: {obj.name}</div> 
          } : msg))
        }
        return
      }
    } catch (err) {
      // Not a JSON message, treat as text
    }
    
    const msg = { from: 'peer', content: data }
    setMessages(prev => [...prev, msg])
  }

  // Send text message
  const handleSend = () => {
    if (!text.trim()) return
    if (!connected) return setError('Kết nối chưa mở')
    
    dcRef.current.send(text)
    const msg = { from: 'me', content: text }
    setMessages(prev => [...prev, msg])
    setText('')
  }

  // Handle file selection
  const handleFileChange = e => {
    const f = e.target.files?.[0]
    if (!f) return setFileError('Vui lòng chọn tệp')
    const err = validateFile(f)
    if (err) return setFileError(err)
    setFile(f)
  }

  // Send file via IPFS
  const handleFileSend = async () => {
    if (!file) return setFileError('Vui lòng chọn tệp trước khi gửi')
    if (!connected) return setError('Kết nối chưa mở')
    
    setFileError(null)
    setUploadingFile(true)
    setFileUploadProgress(0)

    const type = getFileType(file.name, file.type)
    const id = `upload-${Date.now()}`
    
    const placeholder = { 
      from: 'me', 
      id, 
      content: (
        <div className="flex flex-col">
          <div className="font-semibold">{file.name}</div>
          <div className="text-sm text-gray-500">{type.icon} {formatFileSize(file.size)}</div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{width: '0%'}}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1">Đang tải lên...</div>
        </div>
      )
    }
    
    setMessages(prev => [...prev, placeholder])

    try {
      // Update progress bar directly during upload
      const updateProgressUI = p => {
        setFileUploadProgress(p)
        const progressBar = document.querySelector(`#${id} .bg-blue-600`)
        if (progressBar) progressBar.style.width = `${p}%`
      }
      
      const { cid } = await uploadFile(file, updateProgressUI)
      
      // Create file metadata for storage
      const fileData = {
        cid,
        name: file.name,
        size: file.size,
        fileType: type
      }
      
      // Send file info to peer
      dcRef.current.send(JSON.stringify({ 
        type: 'file', 
        cid, 
        name: file.name, 
        size: file.size, 
        fileType: type 
      }))
      
      const url = `https://ipfs.io/ipfs/${cid}`
      
      // Update message with completed file
      setMessages(prev => prev.map(msg => msg.id === id ? {
        ...msg,
        fileData, // Store file metadata
        content: type.isImage ? <img src={url} alt={file.name} className="max-w-full max-h-48 rounded mt-1" /> :
                 type.isVideo ? <video src={url} controls className="max-w-full max-h-48 rounded mt-1" /> :
                 type.isAudio ? <audio src={url} controls className="w-full mt-1" /> :
                 <a href={url} download={file.name} className="text-blue-500 hover:underline">{type.icon} {file.name}</a>
      } : msg))
    } catch (err) {
      console.error('IPFS upload error', err)
      setFileError('Không thể tải lên IPFS. Vui lòng kiểm tra cấu hình project ID và mạng.')
      
      // Update message with error
      setMessages(prev => prev.map(msg => msg.id === id ? {
        ...msg,
        content: <div className="text-red-500">Tải lên thất bại: {file.name}</div>
      } : msg))
    } finally {
      setFile(null)
      setUploadingFile(false)
      setFileUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto flex flex-col">
      <h2 className="text-xl font-bold mb-4">WebRTC P2P Chat</h2>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => initPeer(true)} disabled={connecting}
          className={`px-4 py-2 text-white rounded ${connected ? 'bg-green-600' : 'bg-blue-600'}`}>
          {connected ? 'Đã kết nối' : 'Bắt đầu'}
        </button>
        <span className={connected ? 'text-green-600' : 'text-gray-600'}>
          {connected ? '● Trực tuyến' : '○ Ngoại tuyến'}
        </span>
      </div>
      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}
      <div ref={chatContainerRef} className="border p-3 h-80 overflow-auto mb-4 bg-gray-50 rounded">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center mt-8">Chưa có tin nhắn</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`my-2 ${m.from === 'me' ? 'text-right' : 'text-left'}`}> 
              <div className={`inline-block max-w-xs px-3 py-2 rounded ${m.from === 'me' ? 'bg-blue-100' : 'bg-gray-200'}`}> 
                <div className="font-semibold text-xs text-gray-600 mb-1">{m.from === 'me' ? 'Bạn' : 'Người khác'}</div>
                {m.content}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mb-4 flex flex-col">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          disabled={uploadingFile}
          className="mb-2"
        />
        {fileError && <div className="bg-red-100 text-red-700 p-2 rounded mb-2 text-sm">{fileError}</div>}
        {file && (
          <div className="flex justify-between items-center bg-blue-50 p-2 rounded mb-2">
            <div>
              <div className="font-semibold">{file.name}</div>
              <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
            </div>
            <button onClick={handleFileSend} disabled={!connected || uploadingFile}
              className="bg-indigo-600 text-white px-3 py-1 rounded disabled:bg-indigo-300">
              {uploadingFile ? 'Đang tải...' : 'Gửi File'}
            </button>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Nhập tin..."
          className="flex-1 border px-3 py-2 rounded"
        />
        <button
          onClick={handleSend}
          disabled={!connected || !text.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-blue-300"
        >Gửi</button>
      </div>
    </div>
  )
}