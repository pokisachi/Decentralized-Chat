import React, { useEffect, useRef, useState } from 'react';
import { ethers } from 'ethers';
import io from 'socket.io-client';
import { useParams, useNavigate } from 'react-router-dom';
import {
  uploadFile,
  downloadFile,
  getFileType,
  validateFile,
  formatFileSize
} from '../lib/ipfs';

function safeAddress(addr) {
  if (typeof addr === 'string') return addr;
  if (addr && typeof addr.address === 'string') return addr.address;
  return String(addr || '');
}

function makeRoomId(addr1, addr2) {
  return [safeAddress(addr1).toLowerCase(), safeAddress(addr2).toLowerCase()].sort().join('--');
}

const loadHistory = (key) => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return parsed.map((msg) => {
      if (msg.fileData) {
        const { name, cid, fileType } = msg.fileData;
        const url = `https://ipfs.io/ipfs/${cid}`;
        if (fileType.isImage) {
          msg.content = <img src={url} alt={name} className="max-w-full max-h-48 rounded mt-1" />;
        } else if (fileType.isVideo) {
          msg.content = <video src={url} controls className="max-w-full max-h-48 rounded mt-1" />;
        } else if (fileType.isAudio) {
          msg.content = <audio src={url} controls className="w-full mt-1" />;
        } else {
          msg.content = <a href={url} download={name} className="text-blue-500 hover:underline">{fileType.icon} {name}</a>;
        }
      }
      return msg;
    });
  } catch (err) {
    console.error('Error loading chat history:', err);
    return [];
  }
};

const saveHistory = (key, msgs) => {
  try {
    const serializable = msgs.map(msg => {
      const copy = { ...msg };
      if (msg.fileData) {
        copy.content = null;
      } else if (typeof msg.content !== 'string' && msg.id?.startsWith('upload-')) {
        copy.content = null;
        copy.uploading = true;
      } else if (typeof msg.content !== 'string' && msg.id?.startsWith('download-')) {
        copy.content = null;
        copy.downloading = true;
      }
      return copy;
    });
    localStorage.setItem(key, JSON.stringify(serializable));
  } catch (err) {
    console.error('Error saving chat history:', err);
  }
};

const CONTACTS_KEY = 'chat-contacts';

export default function ChatRoom() {
  const [myAddress, setMyAddress] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [fileDownloadProgress, setFileDownloadProgress] = useState({});
  const [uploadingFile, setUploadingFile] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [peerOnline, setPeerOnline] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [toast, setToast] = useState(null);
  const [myAvatar, setMyAvatar] = useState('');
  const [peerAvatar, setPeerAvatar] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  // Get peerId from URL params
  const { peerId } = useParams();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Room ID is now based on both addresses
  const roomId = myAddress && peerId ? makeRoomId(myAddress, peerId) : '';

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('Vui lòng cài đặt MetaMask!');
      return;
    }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      if (typeof address !== 'string') {
        console.warn('[ChatRoom] Địa chỉ ví không phải string:', address);
      }
      setMyAddress(safeAddress(address));
      localStorage.setItem('wallet_address', safeAddress(address));
      // Add to contacts if not already there
      setContacts(prev => prev.includes(safeAddress(address)) ? prev : [...prev, safeAddress(address)]);
    } catch (err) {
      setError('Không thể kết nối ví!');
    }
  };

  // Auto-connect wallet on mount
  useEffect(() => {
    const autoConnectWallet = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setMyAddress(safeAddress(accounts[0]));
            localStorage.setItem('wallet_address', safeAddress(accounts[0]));
          } else {
            connectWallet();
          }
        } catch (err) {
          console.error("Failed to auto-connect wallet:", err);
          setError('Vui lòng kết nối ví để tiếp tục');
        }
      } else {
        setError('Vui lòng cài đặt MetaMask!');
      }
    };
    autoConnectWallet();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(CONTACTS_KEY);
    if (stored) setContacts(JSON.parse(stored));
  }, []);
  
  useEffect(() => {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  }, [contacts]);

  // Load chat history based on room ID
  useEffect(() => {
    if (roomId) {
      const hist = loadHistory(roomId);
      setMessages(hist);
    }
  }, [roomId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    if (roomId) saveHistory(roomId, messages);
  }, [messages, roomId]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);
  
  useEffect(() => {
    if (fileError) {
      const t = setTimeout(() => setFileError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [fileError]);

  // WebRTC connection
  useEffect(() => {
    if (!roomId) return;
    
    socketRef.current = io('http://localhost:3001');
    socketRef.current.on('connect', () => socketRef.current.emit('join', roomId));
    socketRef.current.on('connect_error', () => setError('Không thể kết nối đến máy chủ'));
    socketRef.current.on('peer-online', (peer) => {
      if (peer === peerId) setPeerOnline(true);
    });
    socketRef.current.on('peer-offline', (peer) => {
      if (peer === peerId) setPeerOnline(false);
    });
    socketRef.current.on('offer', async ({ from, offer }) => {
      if (from === socketRef.current.id) return;
      await initPeer(false);
      await pcRef.current.setRemoteDescription(new window.RTCSessionDescription(offer));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socketRef.current.emit('answer', { to: from, answer });
    });
    socketRef.current.on('answer', async ({ from, answer }) => {
      if (from === socketRef.current.id) return;
      await pcRef.current.setRemoteDescription(new window.RTCSessionDescription(answer));
    });
    socketRef.current.on('ice-candidate', async ({ from, candidate }) => {
      if (from === socketRef.current.id || !pcRef.current?.remoteDescription) return;
      await pcRef.current.addIceCandidate(new window.RTCIceCandidate(candidate));
    });
    
    return () => {
      socketRef.current.disconnect();
      pcRef.current?.close();
    };
  }, [roomId, peerId]);

  const initPeer = async (isCaller) => {
    setConnecting(true);
    setError(null);
    if (pcRef.current) pcRef.current.close();
    const pc = new window.RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socketRef.current.emit('ice-candidate', { to: roomId, candidate });
    };
    pc.oniceconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.iceConnectionState)) {
        setConnected(false);
        setError('Kết nối bị ngắt');
      }
    };
    if (isCaller) {
      const dc = pc.createDataChannel('chat');
      setupChannel(dc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('offer', { to: roomId, offer });
    } else {
      pc.ondatachannel = ({ channel }) => setupChannel(channel);
    }
  };

  const setupChannel = (dc) => {
    dcRef.current = dc;
    dc.onopen = () => { setConnected(true); setConnecting(false); };
    dc.onclose = () => setConnected(false);
    dc.onerror = () => setError('Lỗi kênh dữ liệu');
    dc.onmessage = ({ data }) => handleIncoming(data);
  };

  const handleIncoming = async (data) => {
    try {
      const obj = JSON.parse(data);
      if (obj.type === 'file' && obj.cid) {
        const id = `download-${obj.cid}`;
        setFileDownloadProgress((prev) => ({ ...prev, [id]: 0 }));
        const fileData = {
          cid: obj.cid,
          name: obj.name,
          size: obj.size,
          fileType: obj.fileType || getFileType(obj.name)
        };
        const placeholder = {
          from: 'peer',
          id,
          fileData,
          content: (
            <div id={id} className="flex flex-col">
              <div className="font-semibold">{obj.name}</div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{width: '0%'}}></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">Đang tải xuống...</div>
            </div>
          )
        };
        setMessages(prev => [...prev, placeholder]);
        try {
          await downloadFile(obj.cid, (p) => {
            setFileDownloadProgress((prev) => ({ ...prev, [id]: p }));
            const progressBar = document.querySelector(`#${id} .bg-blue-600`);
            if (progressBar) progressBar.style.width = `${p}%`;
          });
          const type = fileData.fileType;
          const url = `https://ipfs.io/ipfs/${obj.cid}`;
          setMessages(prev => prev.map(msg => msg.id === id ? {
            ...msg,
            content: type.isImage ? <img src={url} alt={obj.name} className="max-w-full max-h-48 rounded mt-1" /> :
                    type.isVideo ? <video src={url} controls className="max-w-full max-h-48 rounded mt-1" /> :
                    type.isAudio ? <audio src={url} controls className="w-full mt-1" /> :
                    <a href={url} download={obj.name} className="text-blue-500 hover:underline">{type.icon} {obj.name}</a>
          } : msg));
        } catch (err) {
          setMessages(prev => prev.map(msg => msg.id === id ? {
            ...msg,
            content: <div className="text-red-500">Tải xuống thất bại: {obj.name}</div>
          } : msg));
        }
        return;
      }
    } catch (err) {}
    const msg = { from: 'peer', content: data };
    setMessages(prev => [...prev, msg]);
    // Hiển thị toast nếu tab không focus
    if (document.visibilityState !== 'visible') {
      setToast('Bạn có tin nhắn mới!');
      setTimeout(() => setToast(null), 3000);
      // Gửi push notification nếu được phép
      if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          title: 'Tin nhắn mới',
          options: {
            body: typeof data === 'string' ? data.slice(0, 100) : 'Bạn có tin nhắn mới!',
            icon: '/icon-192.png',
            tag: 'dchat-message',
          }
        });
      }
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    if (!connected) return setError('Kết nối chưa mở');
    dcRef.current.send(text);
    const msg = { from: 'me', content: text };
    setMessages(prev => [...prev, msg]);
    setText('');
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return setFileError('Vui lòng chọn tệp');
    const err = validateFile(f);
    if (err) return setFileError(err);
    setFile(f);
  };

  const handleFileSend = async () => {
    if (!file) return setFileError('Vui lòng chọn tệp trước khi gửi');
    if (!connected) return setError('Kết nối chưa mở');
    setFileError(null);
    setUploadingFile(true);
    setFileUploadProgress(0);
    const type = getFileType(file.name, file.type);
    const id = `upload-${Date.now()}`;
    const placeholder = {
      from: 'me',
      id,
      content: (
        <div id={id} className="flex flex-col">
          <div className="font-semibold">{file.name}</div>
          <div className="text-sm text-gray-500">{type.icon} {formatFileSize(file.size)}</div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{width: '0%'}}></div>
          </div>
          <div className="text-xs text-gray-500 mt-1">Đang tải lên...</div>
        </div>
      )
    };
    setMessages(prev => [...prev, placeholder]);
    try {
      const updateProgressUI = (p) => {
        setFileUploadProgress(p);
        const progressBar = document.querySelector(`#${id} .bg-blue-600`);
        if (progressBar) progressBar.style.width = `${p}%`;
      };
      const { cid } = await uploadFile(file, updateProgressUI);
      const fileData = {
        cid,
        name: file.name,
        size: file.size,
        fileType: type
      };
      dcRef.current.send(JSON.stringify({
        type: 'file',
        cid,
        name: file.name,
        size: file.size,
        fileType: type
      }));
      const url = `https://ipfs.io/ipfs/${cid}`;
      setMessages(prev => prev.map(msg => msg.id === id ? {
        ...msg,
        fileData,
        content: type.isImage ? <img src={url} alt={file.name} className="max-w-full max-h-48 rounded mt-1" /> :
                 type.isVideo ? <video src={url} controls className="max-w-full max-h-48 rounded mt-1" /> :
                 type.isAudio ? <audio src={url} controls className="w-full mt-1" /> :
                 <a href={url} download={file.name} className="text-blue-500 hover:underline">{type.icon} {file.name}</a>
      } : msg));
    } catch (err) {
      setFileError('Không thể tải lên IPFS. Vui lòng kiểm tra cấu hình project ID và mạng.');
      setMessages(prev => prev.map(msg => msg.id === id ? {
        ...msg,
        content: <div className="text-red-500">Tải lên thất bại: {file.name}</div>
      } : msg));
    } finally {
      setFile(null);
      setUploadingFile(false);
      setFileUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startCall = () => {
    if (!myAddress) {
      setError('Vui lòng kết nối ví trước');
      return;
    }
    if (!peerId) {
      setError('Không tìm thấy thông tin peer');
      return;
    }
    initPeer(true);
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    setMyAvatar(localStorage.getItem('avatar') || '');
    if (peerId) {
      setPeerAvatar(localStorage.getItem('avatar_' + peerId) || '');
    }
  }, [peerId]);

  // Tự động kết nối khi đủ điều kiện
  useEffect(() => {
    if (myAddress && peerId && !connected && !connecting) {
      startCall();
    }
  }, [myAddress, peerId, connected, connecting]);

  // Luôn lấy lại wallet_address từ localStorage nếu chưa có
  useEffect(() => {
    if (!myAddress) {
      const addr = localStorage.getItem('wallet_address');
      const safeAddr = safeAddress(addr);
      if (typeof addr !== 'string') {
        console.warn('[ChatRoom][localStorage] wallet_address không phải string:', addr);
      }
      if (safeAddr) setMyAddress(safeAddr);
    }
  }, [myAddress]);

  // Dropdown chọn peer
  const handleChangePeer = (e) => {
    const newPeer = e.target.value;
    if (newPeer && newPeer !== peerId) {
      navigate(`/chat/${newPeer}`);
    }
  };

  // Khi vào ChatRoom, nếu peerId chưa có trong danh bạ thì tự động thêm
  useEffect(() => {
    if (peerId && peerId !== myAddress && !contacts.includes(peerId)) {
      const updated = [...contacts, peerId];
      setContacts(updated);
      localStorage.setItem('chat-contacts', JSON.stringify(updated));
    }
  }, [peerId, myAddress, contacts]);

  // Khi có tin nhắn mới và tab không active, gửi Web Notification
  useEffect(() => {
    if (messages.length > 0 && document.visibilityState !== 'visible') {
      setToast('Bạn có tin nhắn mới!');
      setTimeout(() => setToast(null), 3000);
      // Gửi Web Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const lastMsg = messages[messages.length - 1];
        let body = '';
        if (typeof lastMsg.content === 'string') body = lastMsg.content.slice(0, 100);
        else if (lastMsg.fileData) body = `[File] ${lastMsg.fileData.name}`;
        else body = 'Bạn có tin nhắn mới!';
        console.log('Gửi notification ChatRoom:', lastMsg, peerId, body);
        new Notification(`Chat với: ${peerId ? peerId.slice(0, 8) : 'Peer'}`,
          { body, icon: '/icon-192.png', tag: 'dchat-peer' });
      } else {
        console.log('Không gửi được notification: Notification.permission =', Notification.permission);
      }
    }
  }, [messages, peerId]);

  // Log debug giá trị và kiểu dữ liệu trước khi render
  console.log('[ChatRoom][RENDER] myAddress:', myAddress, myAddress.length, JSON.stringify(myAddress), 'peerId:', peerId, peerId.length, JSON.stringify(peerId));

  // Kiểm tra đầu vào an toàn (nới lỏng, chỉ cần là chuỗi không rỗng)
  function isValidId(id) {
    return typeof id === 'string' && id.trim().length > 0;
  }
  if (!isValidId(myAddress) || !isValidId(peerId)) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Thiếu hoặc sai định danh đăng nhập/peer.<br/>
        myAddress: {String(myAddress)}<br/>
        peerId: {String(peerId)}
      </div>
    );
  }
  if (myAddress === peerId) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        Không thể chat với chính mình! Vui lòng chọn peer khác.<br/>
        myAddress: {myAddress}
      </div>
    );
  }

  // Helper rút gọn định danh
  function shortId(id) {
    if (!id) return '';
    if (id.startsWith('0x') && id.length >= 10) return id.slice(0, 6) + '...' + id.slice(-4);
    if (id.includes('@')) return id.split('@')[0] + '@...';
    if (id.length > 12) return id.slice(0, 6) + '...' + id.slice(-4);
    return id;
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {toast && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-50 animate-bounce">
          {toast}
        </div>
      )}
      {/* Header cho desktop */}
      <div className="hidden md:flex items-center justify-between bg-white border-b px-4 py-2">
        <button onClick={() => navigate('/contacts')} className="text-blue-600 hover:underline mr-4">
          &larr; Danh bạ
        </button>
        <div className="font-bold text-lg">
          {peerId ? `Chat với: ${shortId(peerId)}` : 'Chọn peer để chat'}
        </div>
        <div className="flex items-center gap-2">
          <span className={peerOnline ? 'text-green-600' : 'text-gray-600'}>
            {peerOnline ? '● Online' : '○ Offline'}
          </span>
          {!connected && !connecting && (
            <button
              onClick={startCall}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
            >
              Kết nối
            </button>
          )}
          {connecting && (
            <span className="text-blue-600">Đang kết nối...</span>
          )}
          {/* Nút mở profile */}
          <button className="bg-gray-200 px-2 py-1 rounded text-xs" onClick={() => setShowProfile(true)}>
            Profile
          </button>
        </div>
      </div>
      
      {/* Main chat */}
      <div className="flex-1 flex flex-col">
        {/* Chat list */}
        <div ref={chatContainerRef} className="flex-1 overflow-auto p-4 bg-gray-50">
          {(!roomId || messages.length === 0) ? (
            <div className="text-gray-500 text-center mt-8">
              {myAddress ? 
                'Chưa có tin nhắn, hãy kết nối và bắt đầu trò chuyện' : 
                'Vui lòng kết nối ví MetaMask để bắt đầu'
              }
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`my-2 flex ${m.from === 'me' ? 'flex-row-reverse' : ''} items-start`}>
                <div className="w-8 h-8 mr-2 ml-2">
                  {m.from === 'me' ? (
                    myAvatar ? <img src={myAvatar} alt="avatar" className="w-8 h-8 rounded-full object-cover border" /> : <span className="inline-block w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">👤</span>
                  ) : (
                    peerAvatar ? <img src={peerAvatar} alt="avatar" className="w-8 h-8 rounded-full object-cover border" /> : <span className="inline-block w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">👤</span>
                  )}
                </div>
                <div className={`inline-block max-w-xs px-3 py-2 rounded ${m.from === 'me' ? 'bg-blue-100' : 'bg-gray-200'}`}> 
                  <div className="font-semibold text-xs text-gray-600 mb-1">
                    {m.from === 'me' ? shortId(myAddress) : shortId(peerId)}
                  </div>
                  {m.content}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Input bar */}
        <div className="p-4 border-t flex flex-col gap-2">
          {!myAddress ? (
            <button
              onClick={connectWallet}
              className="bg-blue-600 text-white px-4 py-2 rounded w-full"
            >
              Kết nối ví để chat
            </button>
          ) : (
            <>
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  disabled={uploadingFile || !connected}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className={`cursor-pointer ${!connected ? 'opacity-50' : ''}`}>
                  <span role="img" aria-label="attach">📎</span>
                </label>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder={connected ? "Nhập tin..." : "Đang chờ kết nối..."}
                  className="flex-1 border px-3 py-2 rounded"
                  disabled={!connected}
                />
                <button
                  onClick={handleSend}
                  disabled={!connected || !text.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-blue-300"
                >
                  Gửi
                </button>
              </div>
              {fileError && <div className="bg-red-100 text-red-700 p-2 rounded text-sm">{fileError}</div>}
              {file && (
                <div className="flex justify-between items-center bg-blue-50 p-2 rounded">
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
            </>
          )}
        </div>
      </div>
      {/* Modal Profile */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-red-500" onClick={() => setShowProfile(false)}>✕</button>
            <h2 className="text-lg font-bold mb-2">Thông tin cá nhân</h2>
            <div className="mb-2"><span className="font-semibold">Địa chỉ ví:</span><br/><span className="font-mono text-xs break-all">{myAddress}</span></div>
            <button className="w-full bg-blue-500 text-white py-1 rounded mt-2" onClick={() => {
              if ('Notification' in window && Notification.permission === 'granted') {
                console.log('Test notification: OK');
                new Notification('Test Notification', { body: 'Thông báo hoạt động!', icon: '/icon-192.png', tag: 'dchat-test' });
              } else {
                console.log('Test notification: Không gửi được, permission =', Notification.permission);
                alert('Notification chưa được cấp quyền hoặc không hỗ trợ!');
              }
            }}>Test Notification</button>
            <button className="w-full bg-red-600 text-white py-1 rounded mt-4" onClick={() => { localStorage.clear(); window.location.reload(); }}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}