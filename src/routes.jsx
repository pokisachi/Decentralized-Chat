// src/routes.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Login";
import ChatList from "@/pages/ChatList";
import ChatRoom from "@/pages/ChatRoom";
import Profile from "@/pages/Profile";
import GroupChat from "@/pages/GroupChat";
import Contacts from './pages/Contacts';


export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Chat list under /chats */}
        <Route path="/chats" element={<ChatList />} />
        {/* Personal chat under /chat */}
        <Route path="/chat/:peerId" element={<ChatRoom />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/group" element={<GroupChat />} />
        <Route path="/contacts" element={<Contacts />} />
    
        {/* Fallback to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
