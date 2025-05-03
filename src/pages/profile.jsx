import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const [address, setAddress] = useState('');
  const [avatar, setAvatar] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Lấy địa chỉ ví từ localStorage (ưu tiên Magic, fallback Metamask)
    const addr = localStorage.getItem('wallet_address');
    setAddress(addr || '');
    const av = localStorage.getItem('avatar');
    setAvatar(av || '');
  }, []);

  const handleSignOut = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      setAvatar(base64);
      localStorage.setItem('avatar', base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatar('');
    localStorage.removeItem('avatar');
  };

  return (
    <div className="max-w-md mx-auto p-6 mt-10 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Thông tin cá nhân</h1>
      <div className="mb-6 flex flex-col items-center">
        {avatar ? (
          <>
            <img src={avatar} alt="avatar" className="w-24 h-24 rounded-full object-cover border mb-2" />
            <button onClick={handleRemoveAvatar} className="text-red-600 text-xs mb-2">Xóa ảnh đại diện</button>
          </>
        ) : (
          <label className="cursor-pointer bg-gray-200 px-3 py-1 rounded mb-2 hover:bg-gray-300">
            Tải ảnh đại diện
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        )}
        <div className="text-gray-600 mb-2">Địa chỉ ví hiện tại:</div>
        <div className="font-mono text-blue-700 break-all bg-gray-100 p-2 rounded">
          {address ? address : 'Chưa đăng nhập'}
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="bg-red-600 text-white px-4 py-2 rounded w-full"
      >
        Đăng xuất
      </button>
    </div>
  );
}
