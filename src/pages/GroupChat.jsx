import React, { useState, useEffect, useRef } from 'react'
import { subscribeTopic, publishMessage } from '@/lib/ipfsPubsub'
import { create } from 'ipfs-http-client'
import { useNavigate } from 'react-router-dom'
import { createGroup, joinGroup, getGroupInfo, addMember, removeMember, transferAdmin, leaveGroup } from '@/lib/groupGunDB'
import { loadContacts } from '@/lib/contacts'

// IPFS client for file upload
const ipfs = create({ url: 'http://127.0.0.1:5001/api/v0' })

export default function GroupChat() {
  // State cho sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [groupList, setGroupList] = useState([]); // Danh sách nhóm đã join
  const [searchGroup, setSearchGroup] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [createForm, setCreateForm] = useState({ name: '', description: '', avatar: '' });
  // State cho main content
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupInfo, setGroupInfo] = useState(null);
  const [myAddress, setMyAddress] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [toast, setToast] = useState(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const msgCount = useRef(0);
  const processedMessages = useRef(new Set());
  const subscribed = useRef(false);
  const navigate = useNavigate();
  const myAvatar = localStorage.getItem('avatar') || '';
  // Lấy danh sách thành viên nhóm: ưu tiên lấy từ localStorage group_members, nếu không có thì lấy từ messages
  const [members, setMembers] = useState(() => {
    const stored = localStorage.getItem('group_members');
    if (stored) {
      try {
        const arr = JSON.parse(stored);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    }
    // Fallback: lấy từ messages
    const memberSet = new Set(messages.filter(m => m.senderAddress && m.senderAddress !== 'Unknown').map(m => m.senderAddress));
    if (localStorage.getItem('wallet_address')) memberSet.add(localStorage.getItem('wallet_address'));
    return Array.from(memberSet);
  });
  // Luôn đồng bộ members với localStorage khi messages thay đổi (nếu chưa có group_members)
  useEffect(() => {
    const stored = localStorage.getItem('group_members');
    if (!stored) {
      const memberSet = new Set(messages.filter(m => m.senderAddress && m.senderAddress !== 'Unknown').map(m => m.senderAddress));
      if (localStorage.getItem('wallet_address')) memberSet.add(localStorage.getItem('wallet_address'));
      setMembers(Array.from(memberSet));
    }
  }, [messages]);
  // Quản lý dropdown thành viên
  const [showMembers, setShowMembers] = useState(false);
  // Quản lý quyền admin (demo: bạn là admin nếu là người đầu tiên gửi tin nhắn)
  const [admins, setAdmins] = useState(() => {
    const stored = localStorage.getItem('group_admins');
    return stored ? JSON.parse(stored) : [];
  });
  // Thêm thành viên mới (demo, local)
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState('');
  // Thêm state cho file gửi kèm
  const [fileToSend, setFileToSend] = useState(null);
  // State cho modal tạo nhóm Telegram
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [manualMember, setManualMember] = useState('');
  const [contacts, setContacts] = useState([]);
  const [canSend, setCanSend] = useState(true); // Thêm state để disable nút gửi khi chưa subscribe
  // Thêm state cho profile modal
  const [showProfile, setShowProfile] = useState(false);
  // Thêm state quản lý modal xem hồ sơ thành viên
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [myAlias, setMyAlias] = useState('');

  // Lấy địa chỉ ví
  useEffect(() => {
    setMyAddress(localStorage.getItem('wallet_address') || '');
  }, []);

  // Lấy danh sách nhóm đã join (GunDB)
  useEffect(() => {
    // Lắng nghe realtime tất cả group mà user là thành viên
    const handler = data => {
      if (!data) return;
      const arr = [];
      Object.keys(data).forEach(gid => {
        let membersArr = [];
        if (data[gid] && data[gid].members) {
          if (Array.isArray(data[gid].members)) {
            membersArr = data[gid].members;
          } else if (typeof data[gid].members === 'object' && data[gid].members !== null) {
            membersArr = Object.keys(data[gid].members).filter(addr => data[gid].members[addr]);
          }
        }
        if (membersArr.includes(myAddress)) {
          arr.push({ ...data[gid] });
        }
      });
      setGroupList(arr);
    };
    if (myAddress) {
      // Lắng nghe tất cả group
      getGroupInfo(null, handler); // null = all group
    }
    return () => {};
  }, [myAddress]);

  // Khi chọn nhóm, load groupInfo
  useEffect(() => {
    if (!selectedGroupId) return;
    getGroupInfo(selectedGroupId, info => {
      if (info && info.members && typeof info.members === 'object' && !Array.isArray(info.members)) {
        info.members = Object.keys(info.members).filter(addr => info.members[addr]);
      }
      setGroupInfo(info);
    });
  }, [selectedGroupId]);

  // Khi chọn nhóm, load chat history (localStorage)
  useEffect(() => {
    if (!selectedGroupId) return;
    try {
      const hist = JSON.parse(localStorage.getItem(selectedGroupId) || '[]');
      hist.forEach(msg => processedMessages.current.add(msg.id));
      setMessages(hist);
    } catch {}
  }, [selectedGroupId]);

  // Save history khi messages thay đổi
  useEffect(() => {
    if (!selectedGroupId) return;
    try {
      localStorage.setItem(selectedGroupId, JSON.stringify(messages));
    } catch {}
  }, [messages, selectedGroupId]);

  // Subscribe PubSub khi chọn nhóm
  useEffect(() => {
    if (!selectedGroupId) return;
    setCanSend(false); // Disable gửi khi mới chọn nhóm
    let unsub = null;
    const handleIncomingMessage = msg => {
      if (processedMessages.current.has(msg.id)) return;
      processedMessages.current.add(msg.id);
      setMessages(prev => [...prev, msg]);
    };
    console.log('Subscribe PubSub topic:', selectedGroupId);
    unsub = subscribeTopic(selectedGroupId, handleIncomingMessage);
    // Cho phép gửi sau 500ms
    const timer = setTimeout(() => setCanSend(true), 500);
    return () => { if (unsub) unsub(); clearTimeout(timer); };
  }, [selectedGroupId]);

  // Hàm xử lý chọn file
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileToSend(file);
  };

  // Hàm gửi tin nhắn (có thể kèm file)
  const sendText = async () => {
    if ((!text.trim() && !fileToSend) || !selectedGroupId || !canSend) return;
    let fileMsg = null;
    if (fileToSend) {
      // Upload file lên IPFS
      try {
        const added = await ipfs.add(fileToSend);
        const cid = added.cid.toString();
        const type = fileToSend.type.startsWith('image/') ? 'image' : 'file';
        fileMsg = {
          cid,
          name: fileToSend.name,
          type,
          mimeType: fileToSend.type
        };
      } catch (err) {
        setToast('Lỗi upload file: ' + err.message);
        setFileToSend(null);
        return;
      }
    }
    const id = `${Date.now()}-${msgCount.current++}`;
    const metadata = { senderAddress: myAddress };
    let msgText = text;
    if (fileMsg) msgText = JSON.stringify(fileMsg) + (text ? ('\n' + text) : '');
    console.log('Gửi tin nhắn PubSub:', selectedGroupId, msgText, id, metadata);
    const messageData = await publishMessage(selectedGroupId, msgText, id, metadata);
    processedMessages.current.add(id);
    setText('');
    setFileToSend(null);
  };

  // Load contacts khi mở modal
  useEffect(() => {
    if (showCreateModal) setContacts(loadContacts());
  }, [showCreateModal]);

  // Thêm/xóa thành viên chọn
  const toggleMember = addr => {
    setSelectedMembers(members => members.includes(addr) ? members.filter(a => a !== addr) : [...members, addr]);
  };
  // Thêm thủ công
  const addManualMember = () => {
    const addr = manualMember.trim();
    if (addr && !selectedMembers.includes(addr)) setSelectedMembers(m => [...m, addr]);
    setManualMember('');
  };

  // Hàm tạo nhóm Telegram
  const handleCreateGroupTelegram = async e => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    const { groupId } = await createGroup({ ...createForm, admin: myAddress, members: selectedMembers });
    setShowCreateModal(false);
    setCreateForm({ name: '', description: '', avatar: '' });
    setSelectedMembers([]);
    setManualMember('');
    setToast(`Tạo nhóm thành công! ID: ${groupId}`);
    setSelectedGroupId(groupId);
  };

  // Sửa hàm tìm kiếm nhóm theo tên
  const handleSearchGroup = async () => {
    const keyword = searchGroup.trim().toLowerCase();
    if (!keyword) return;
    try {
      // Lấy toàn bộ nhóm từ GunDB
      const allGroups = await getGroupInfo(null);
      // Lọc nhóm theo tên (không phân biệt hoa thường)
      const results = Object.values(allGroups).filter(g =>
        typeof g.name === 'string' && g.name.toLowerCase().includes(keyword)
      );
      setSearchResults(results);
      if (results.length === 0) setToast('Không tìm thấy nhóm nào phù hợp!');
    } catch {
      setSearchResults([]);
      setToast('Không tìm thấy nhóm!');
    }
  };

  // Join nhóm từ search
  const handleJoinGroup = async gid => {
    try {
      await joinGroup(gid, myAddress);
      setSelectedGroupId(gid);
      setToast('Tham gia nhóm thành công!');
    } catch (e) {
      if (e.message === 'Bạn không phải thành viên nhóm này') {
        // Public group: tự động thêm mình vào nhóm
        try {
          // Lấy thông tin nhóm để lấy admin
          const group = await getGroupInfo(gid);
          await addMember(gid, group.admin, myAddress);
          // Thử join lại tối đa 3 lần, mỗi lần chờ 1 giây
          let joined = false;
          let lastErr = null;
          for (let i = 0; i < 3; i++) {
            await new Promise(res => setTimeout(res, 1000));
            try {
              await joinGroup(gid, myAddress);
              joined = true;
              break;
            } catch (err) {
              lastErr = err;
            }
          }
          if (joined) {
            setSelectedGroupId(gid);
            setToast('Đã tự động thêm bạn vào nhóm!');
          } else {
            setToast(lastErr ? lastErr.message : 'Không join được nhóm, thử lại sau!');
          }
    } catch (err) {
          setToast(err.message);
        }
      } else {
        setToast(e.message);
      }
    }
  };

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
      if (processedMessages.current.has(msg.id)) return
      processedMessages.current.add(msg.id)
      const isFromMe = msg.senderAddress === myAddress
      let sender = isFromMe ? 'You' : msg.senderAddress
      setMessages(prev => {
        const newMsg = { ...msg, sender, senderAddress: msg.senderAddress }
        return [...prev, newMsg]
      })
    }
    
    const unsubscribe = subscribeTopic(selectedGroupId, handleIncomingMessage)
    
    return () => unsubscribe()
  }, [myAddress])

  // Check if file is an image
  const isImageFile = fileName => {
    const exts = ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg']
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
    return exts.includes(ext)
  }

  // Helper: rút gọn địa chỉ ví
  const shortAddr = addr => addr && addr !== 'You' ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
  // Helper: lấy avatar từ localStorage
  const getAvatar = addr => localStorage.getItem('avatar_' + addr) || '';

  // Hàm render message (text hoặc file) nâng cấp UI
  const renderMessage = (msg) => {
    // Nếu là file dạng JSON
    try {
      const obj = JSON.parse(msg.text);
      if (obj.cid && obj.name) {
        const url = `https://ipfs.io/ipfs/${obj.cid}`;
        if (obj.type === 'image') {
          return <img src={url} alt={obj.name} className="max-w-xs max-h-48 rounded shadow border" />;
        }
        return <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">📎 {obj.name}</a>;
      }
    } catch {}
    // Nếu là text bình thường
    return <span>{msg.text}</span>;
  };

  // Focus input khi gửi xong
  useEffect(() => {
    if (fileInputRef.current) fileInputRef.current.blur();
    const input = document.querySelector('#groupchat-input');
    if (input) input.focus();
  }, [messages]);

  // Khi có tin nhắn mới và tab không focus, gửi Web Notification
  useEffect(() => {
    if (messages.length > 0 && document.visibilityState !== 'visible') {
      setToast('Bạn có tin nhắn mới trong nhóm!');
      setTimeout(() => setToast(null), 3000);
      // Gửi Web Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const lastMsg = messages[messages.length - 1];
        let body = '';
        try {
          const obj = JSON.parse(lastMsg.text);
          if (obj.cid && obj.name) body = `[File] ${obj.name}`;
          else body = lastMsg.text?.slice(0, 100) || 'Bạn có tin nhắn mới!';
        } catch {
          body = lastMsg.text?.slice(0, 100) || 'Bạn có tin nhắn mới!';
        }
        const groupTitle = groupInfo?.name || groupInfo?.groupId || selectedGroupId || 'Group';
        new Notification(`Nhóm: ${groupTitle}`,
          { body, icon: '/icon-192.png', tag: 'dchat-group' });
      } else {
        // Nếu chưa xin quyền, tự động xin
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    }
  }, [messages, groupInfo, selectedGroupId]);

  // Lọc trùng tin nhắn theo id
  const uniqueMessages = [];
  const seenIds = new Set();
  for (const m of messages) {
    if (!seenIds.has(m.id)) {
      uniqueMessages.push(m);
      seenIds.add(m.id);
    }
  }

  // Thêm/xóa/cấp quyền admin (demo, chỉ local)
  const isAdmin = myAddress && admins.includes(myAddress);
  const handleMakeAdmin = addr => {
    if (!admins.includes(addr)) {
      const updated = [...admins, addr];
      setAdmins(updated);
      localStorage.setItem('group_admins', JSON.stringify(updated));
    }
  };
  const handleRemove = addr => {
    if (addr === myAddress) return;
    const updated = members.filter(a => a !== addr);
    // Xóa khỏi localStorage (chỉ local demo)
    localStorage.setItem('group_members', JSON.stringify(updated));
    // Xóa khỏi state (chỉ local demo)
    // (Thực tế cần đồng bộ qua pubsub hoặc backend)
    window.location.reload();
  };

  // Thêm thành viên mới (demo, local)
  const handleAddMember = () => {
    const val = newMember.trim();
    if (val && !members.includes(val)) {
      const updated = [...members, val];
      localStorage.setItem('group_members', JSON.stringify(updated));
      setMembers(updated);
      setNewMember('');
      setShowAddMember(false);
    }
  };

  // Xin quyền notification khi vào GroupChat
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    setMyAlias(localStorage.getItem('alias') || '');
  }, []);

  return (
    <div className="flex h-screen font-inter bg-background-light dark:bg-background-dark text-text-main dark:text-white">
      {/* Sidebar */}
      <aside className="w-1/5 min-w-[320px] max-w-sm bg-background-light dark:bg-background-dark border-r border-border flex flex-col p-6">
        <header className="h-16 flex items-center mb-6">
          <span className="text-2xl font-bold text-primary">DChat</span>
        </header>
        <h2 className="text-lg font-bold mb-4">Nhóm của bạn</h2>
        <button className="w-full bg-primary text-white py-2 rounded-lg font-bold mb-4 shadow-chat hover:bg-primary/90 transition" type="button" onClick={() => setShowCreateModal(true)}>Tạo nhóm mới</button>
        <div className="mb-4">
          <input className="w-full border border-border px-3 py-2 rounded-lg mb-2" placeholder="Tìm nhóm theo tên" value={searchGroup} onChange={e => setSearchGroup(e.target.value)} />
          <button className="w-full bg-secondary text-white py-2 rounded-lg font-bold hover:bg-secondary/90 transition" onClick={handleSearchGroup}>Tìm nhóm</button>
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-2">
              {searchResults.map(group => {
                const membersArr = group.members && typeof group.members === 'object' && !Array.isArray(group.members)
                  ? Object.keys(group.members).filter(addr => group.members[addr])
                  : group.members || [];
                return (
                  <div key={group.groupId} className="p-3 border rounded-lg bg-white dark:bg-gray-800 flex flex-col items-center">
                    {group.avatar && (
                      <img src={group.avatar} alt="avatar" className="w-12 h-12 rounded-full object-cover mb-2" />
                    )}
                    <div className="font-bold text-lg text-center break-words">{group.name || '(Không có tên nhóm)'}</div>
                    <div className="text-xs text-gray-500 text-center mb-1">ID: {group.groupId}</div>
                    <div className="text-xs text-gray-700 mb-2 text-center">{group.description}</div>
                    <div className="text-xs text-gray-600 mb-1">Admin: <span className="font-mono">{group.admin}</span></div>
                    <div className="text-xs text-gray-600 mb-1">Thành viên ({membersArr.length}):
                      <span className="ml-1">{membersArr.slice(0, 3).map(m => <span key={m} className="mr-1 font-mono">{m.slice(0, 6)}... </span>)}</span>
                      {membersArr.length > 3 && <span className="text-gray-400">...và {membersArr.length - 3} khác</span>}
                    </div>
                    {membersArr.includes(myAddress) ? (
                      <div className="text-green-600 text-xs font-semibold text-center mt-2">Bạn đã tham gia nhóm này</div>
                    ) : (
                      <button className="bg-primary text-white px-3 py-1 rounded-lg mt-2 w-full font-bold hover:bg-primary/90 transition" onClick={() => handleJoinGroup(group.groupId)}>Tham gia nhóm</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-4">
          {groupList.length === 0 ? <div className="text-gray-400 text-sm">Bạn chưa tham gia nhóm nào</div> : (
            <ul className="space-y-2">
              {groupList.map(g => (
                <li key={g.groupId} className={`flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10 cursor-pointer transition ${selectedGroupId === g.groupId ? 'bg-primary/10' : ''}`} onClick={() => setSelectedGroupId(g.groupId)}>
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-primary">
                    {g.name ? g.name[0] : 'G'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-text-main dark:text-white">{g.name}</div>
                    <div className="text-xs text-text-muted">{g.groupId.slice(0, 8)}...</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
      {/* Main chat window */}
      <main className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-primary text-white shadow-chat">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold">{groupInfo?.name || 'Nhóm'}</span>
            <span className="text-xs bg-secondary text-white px-2 py-1 rounded-lg ml-2">{groupInfo?.groupId?.slice(0, 10)}...</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Nút thêm thành viên, dark mode toggle, profile... */}
            <button className="bg-accent text-white px-3 py-1 rounded-lg font-bold hover:bg-accent/90 transition" onClick={() => setShowAddMember(true)}>+ Thêm thành viên</button>
            <button className="bg-white text-primary px-3 py-1 rounded-lg font-bold border border-primary hover:bg-primary/10 transition" onClick={() => setShowProfile(true)}>Profile</button>
          </div>
        </header>
        {/* Chat list */}
        <div ref={chatContainerRef} className="flex-1 overflow-auto p-8 bg-background-light dark:bg-background-dark">
          {messages.length === 0 ? (
            <div className="text-gray-500 text-center my-8">Chưa có tin nhắn</div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.senderAddress === myAddress;
              const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              return (
                <div key={msg.id || i} className={`my-3 flex ${isMe ? 'flex-row-reverse' : ''} items-end`}>
                  <div className="w-10 h-10 mx-2 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-primary">
                    {isMe ? (myAvatar ? <img src={myAvatar} alt="avatar" className="w-10 h-10 rounded-full object-cover border" /> : 'T') : 'G'}
                  </div>
                  <div className={`max-w-xs px-4 py-3 rounded-lg shadow-chat ${isMe ? 'bg-secondary text-white ml-2' : 'bg-white dark:bg-gray-700 border border-border mr-2 text-text-main dark:text-white'}`}> 
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs text-gray-600 dark:text-gray-300">{isMe ? 'Bạn' : (msg.senderAddress ? msg.senderAddress.slice(0, 6) + '...' : 'Ẩn danh')}</span>
                      {time && <span className="text-xs text-gray-400">{time}</span>}
                    </div>
                    {renderMessage(msg)}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* Input bar */}
        <div className="h-14 flex items-center border-t border-border px-4 bg-white dark:bg-gray-800">
          <label className="cursor-pointer bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded-full flex items-center mr-2">
            <span role="img" aria-label="attach">📎</span>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
          </label>
          <input
            className="flex-1 border border-border px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mr-2 bg-background-light dark:bg-gray-700 text-text-main dark:text-white"
            placeholder="Nhập tin nhắn..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendText()}
            id="groupchat-input"
          />
          <button 
            onClick={sendText} 
            className={`bg-accent text-white px-4 py-2 rounded-lg font-bold shadow-chat hover:bg-accent/90 transition disabled:bg-accent/50 ${(!text.trim() && !fileToSend) || !canSend ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={(!text.trim() && !fileToSend) || !canSend}
          >
            <span role="img" aria-label="send">📤</span>
          </button>
        </div>
        {/* Toast notification */}
        {toast && (
          <div className="fixed top-4 right-4 bg-accent text-white px-4 py-2 rounded shadow-lg z-50 animate-bounce">
            {toast}
          </div>
        )}
      </main>
      {/* Modal tạo nhóm, profile, member ... giữ nguyên */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-red-500" onClick={() => setShowCreateModal(false)}>✕</button>
            <h2 className="text-lg font-bold mb-2">Tạo nhóm mới</h2>
            <form onSubmit={handleCreateGroupTelegram} className="space-y-2">
              <input className="w-full border px-2 py-1 rounded" placeholder="Tên nhóm" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
              <input className="w-full border px-2 py-1 rounded" placeholder="Mô tả" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
              <input className="w-full border px-2 py-1 rounded" placeholder="Link avatar (tùy chọn)" value={createForm.avatar} onChange={e => setCreateForm(f => ({ ...f, avatar: e.target.value }))} />
              <div className="border rounded p-2 max-h-40 overflow-y-auto">
                <div className="font-semibold text-sm mb-1">Chọn thành viên từ danh bạ:</div>
                {contacts.length === 0 ? <div className="text-xs text-gray-400">Chưa có liên hệ</div> : contacts.map(c => (
                  <label key={c.address} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={selectedMembers.includes(c.address)} onChange={() => toggleMember(c.address)} />
                    <span>{c.alias || c.address}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                <input className="flex-1 border px-2 py-1 rounded text-xs" placeholder="Thêm địa chỉ ví/email thủ công" value={manualMember} onChange={e => setManualMember(e.target.value)} />
                <button type="button" className="bg-green-600 text-white px-2 py-1 rounded text-xs" onClick={addManualMember}>Thêm</button>
              </div>
              {selectedMembers.length > 0 && (
                <div className="text-xs text-gray-600 mt-1">Đã chọn: {selectedMembers.map(a => <span key={a} className="mr-1">{a}</span>)}</div>
              )}
              <button className="w-full bg-blue-600 text-white py-1 rounded mt-2" type="submit">Tạo nhóm</button>
            </form>
          </div>
        </div>
      )}
      {/* Modal Profile */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-red-500" onClick={() => setShowProfile(false)}>✕</button>
            <h2 className="text-lg font-bold mb-2">Hồ sơ của bạn</h2>
            <div className="flex flex-col items-center mb-2">
              {myAvatar ? <img src={myAvatar} alt="avatar" className="w-16 h-16 rounded-full object-cover border mb-2" /> : <span className="inline-block w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center mb-2">👤</span>}
              <div className="font-semibold">{myAlias || 'Chưa đặt tên'}</div>
              <div className="font-mono text-xs break-all">{myAddress}</div>
            </div>
            <button className="w-full bg-red-600 text-white py-1 rounded mt-4" onClick={() => { localStorage.clear(); window.location.reload(); }}>Sign out</button>
          </div>
        </div>
      )}
      {/* Modal Member Profile */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-red-500" onClick={() => setSelectedProfile(null)}>✕</button>
            <h2 className="text-lg font-bold mb-2">Hồ sơ thành viên</h2>
            <div className="flex flex-col items-center mb-2">
              {localStorage.getItem('avatar_' + selectedProfile) ? <img src={localStorage.getItem('avatar_' + selectedProfile)} alt="avatar" className="w-16 h-16 rounded-full object-cover border mb-2" /> : <span className="inline-block w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center mb-2">👤</span>}
              <div className="font-semibold">{localStorage.getItem('alias_' + selectedProfile) || selectedProfile.slice(0, 8) + '...'}</div>
              <div className="font-mono text-xs break-all">{selectedProfile}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}