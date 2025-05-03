import AppRoutes from "./routes";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { isAddress } from 'ethers';

function Navbar() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };
  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDark(document.documentElement.classList.contains('dark'));
  };
  return (
    <nav className="bg-gray-800 text-white px-4 py-2 flex items-center gap-4">
      <Link to="/chats" className="font-bold hover:underline">Chat</Link>
      <Link to="/contacts" className="hover:underline">Danh bạ</Link>
      <Link to="/profile" className="hover:underline">Cá nhân</Link>
      <button onClick={toggleDark} className="ml-auto bg-gray-700 px-3 py-1 rounded hover:bg-gray-600">
        {dark ? '🌙 Tối' : '☀️ Sáng'}
      </button>
      <button onClick={handleLogout} className="bg-red-600 px-3 py-1 rounded hover:bg-red-700">Đăng xuất</button>
    </nav>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppRoutes />
    </div>
  );
}

export default App;
