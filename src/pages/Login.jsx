import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { Magic } from 'magic-sdk';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Initialize Magic SDK
const magic = new Magic('pk_live_459DF667128B1FBD', { network: 'mainnet' });

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password] = useState(''); // không dùng password trong Magic Link
  const [loading, setLoading] = useState(false);

  // Metamask login
  const loginWithMetamask = async () => {
    if (!window.ethereum) {
      alert('Vui lòng cài Metamask extension!');
      return;
    }
    setLoading(true);
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const message = 'Login to Decentralized Chat App';
      const signature = await signer.signMessage(message);
      localStorage.setItem('wallet_address', address);
      localStorage.setItem('wallet_signature', signature);
      navigate('/chats');
    } catch (err) {
      console.error('Metamask login error:', err);
      alert(`Metamask login thất bại: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Magic Link login
  const loginWithMagic = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await magic.auth.loginWithMagicLink({ email });
      const provider = new ethers.BrowserProvider(magic.rpcProvider);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      localStorage.setItem('wallet_address', address);
      localStorage.setItem('auth_type', 'magic');
      navigate('/chats');
    } catch (err) {
      console.error('Magic link login error:', err);
      alert(`Magic link login thất bại: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md">
        {/* Logo */}
        <h1 className="text-center text-3xl font-bold text-blue-800 mb-6">DChat</h1>
        {/* Tiêu đề */}
        <h2 className="text-center text-2xl font-extrabold text-blue-700 mb-2">
          Đăng nhập vào DChat
        </h2>
        {/* Mô tả */}
        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-6">
          Bảo mật, riêng tư, không phụ thuộc máy chủ trung gian.
        </p>
        {/* Form Magic Link */}
        <form onSubmit={loginWithMagic} className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={!email || loading}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            {loading ? 'Đang xử lý...' : 'Magic Link'}
          </button>
        </form>
        {/* Divider */}
        <div className="flex items-center mb-6">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="px-2 text-xs text-gray-500 uppercase">hoặc</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>
        {/* Metamask */}
        <button
          onClick={loginWithMetamask}
          disabled={loading}
          className="w-full py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-100 transition"
        >
          {loading ? 'Đang xử lý...' : 'Metamask'}
        </button>
        {/* Footer */}
        <p className="mt-6 text-xs text-center text-gray-500">
          Bằng việc đăng nhập, bạn đồng ý với{' '}
          <a href="#" className="underline">Điều khoản</a> và{' '}
          <a href="#" className="underline">Chính sách</a>.
        </p>
      </div>
    </div>
  );
}
