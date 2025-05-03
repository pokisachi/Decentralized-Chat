import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAddress } from 'ethers';

const CONTACTS_KEY = 'chat-contacts';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [newAddress, setNewAddress] = useState('');
  const [myAddress, setMyAddress] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Sửa logic: luôn lấy toàn bộ danh bạ, chỉ thêm myAddress nếu chưa có, không ghi đè danh bạ cũ
  useEffect(() => {
    const storedContacts = localStorage.getItem(CONTACTS_KEY);
    let contactList = [];
    if (storedContacts) {
      try {
        contactList = JSON.parse(storedContacts);
      } catch {
        contactList = [];
      }
    }
    // Lấy địa chỉ ví từ localStorage (Magic Link hoặc MetaMask)
    const addr = localStorage.getItem('wallet_address');
    setMyAddress(addr || '');
    // Thêm myAddress vào danh bạ nếu chưa có
    if (addr && !contactList.includes(addr)) {
      contactList.push(addr);
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contactList));
    }
    setContacts(contactList);
  }, []);

  useEffect(() => {
    if (contacts.length > 0) {
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    }
  }, [contacts]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('Vui lòng cài đặt MetaMask!');
      return;
    }
    try {
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setMyAddress(address);
      localStorage.setItem('wallet_address', address);
      setContacts(prev => prev.includes(address) ? prev : [...prev, address]);
    } catch (err) {
      setError('Không thể kết nối ví!');
    }
  };

  const addContact = () => {
    if (!newAddress) {
      setError('Vui lòng nhập địa chỉ');
      return;
    }
    if (!isAddress(newAddress)) {
      setError('Địa chỉ Ethereum không hợp lệ');
      return;
    }
    if (contacts.includes(newAddress)) {
      setError('Địa chỉ này đã có trong danh bạ');
      return;
    }
    setContacts(prev => [...prev, newAddress]);
    setNewAddress('');
    setError(null);
  };

  const removeContact = (address) => {
    setContacts(prev => prev.filter(a => a !== address));
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Danh bạ</h1>
      {/* Connect Wallet */}
      <div className="mb-6">
        {myAddress ? (
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded">
            Đã kết nối: {myAddress.slice(0, 6)}...{myAddress.slice(-4)}
          </div>
        ) : (
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={connectWallet}
          >
            Kết nối ví
          </button>
        )}
      </div>
      {/* Add Contact */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nhập địa chỉ Ethereum"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            className="flex-1 border px-3 py-2 rounded"
          />
          <button
            onClick={addContact}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Thêm
          </button>
        </div>
        {error && (
          <div className="mt-2 text-red-600 text-sm">{error}</div>
        )}
      </div>
      {/* Contacts List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="font-bold">Danh sách liên hệ</h2>
        </div>
        {contacts.length === 0 ? (
          <div className="p-4 text-gray-500 text-center">Chưa có liên hệ nào</div>
        ) : (
          <ul>
            {contacts.map(address => (
              <li key={address} className="border-b last:border-0 p-4 flex justify-between items-center">
                <div>
                  {address === myAddress ? (
                    <span className="text-green-600 font-medium">{address.slice(0, 10)}...{address.slice(-8)} (Bạn)</span>
                  ) : (
                    <span>{address.slice(0, 10)}...{address.slice(-8)}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {address !== myAddress && (
                    <button
                      onClick={() => navigate(`/chat/${address}`)}
                      className="bg-blue-600 text-white px-3 py-1 rounded"
                    >
                      Chat
                    </button>
                  )}
                  <button
                    onClick={() => removeContact(address)}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Xóa
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}