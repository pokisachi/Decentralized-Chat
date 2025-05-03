import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';

import { Magic } from 'magic-sdk';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Initialize Magic SDK
const magic = new Magic('pk_live_459DF667128B1FBD', { network: 'mainnet' });

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 1) Metamask login flow
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

  // 2) Magic Link login flow
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
    <div className="display: flex; justify-content: center; align-items: center; height: 100vh; background: #F3F4F6;">
      <div className="w-full max-w-md ">
        <Card className="w-[360px] p-[32px] bg-white rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex flex-col gap-[16px] border-0">
          <CardHeader className="bg-transparent p-0 text-center">

            <div className="flex justify-center mb-4">
              <div className='text-2xl font-extrabold text-blue-700'>DChat</div>
            </div>
            <CardTitle className="text-2xl font-extrabold text-blue-700">
              Đăng nhập vào DChat
              <span className="inline-block bg-blue-100 rounded-full p-3">
                <svg width="32" height="32" fill="none" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#2563eb"/><path d="M10 16.5l4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </div>
            <CardTitle className="text-2xl font-extrabold text-blue-700">
              Chào mừng đến Chat Phi Tập Trung
            </CardTitle>
            <p className="mt-2 text-gray-500 text-sm">Bảo mật, riêng tư, không phụ thuộc máy chủ trung gian.</p>
          </CardHeader>

          <CardContent className="bg-transparent p-0 space-y-6">
            <form onSubmit={loginWithMagic} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="email"
                  aria-label="Email"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="current-password"
                  aria-label="Password"
                />
              </div>
              <Button type="submit" className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition" disabled={loading || !email}>
                {loading ? 'Đang xử lý...' : 'Đăng nhập với Magic Link'}
              </Button>
            </form>


            <div className="relative my-6">
              <span className="absolute inset-0 flex items-center">
                <span className="w-full border-t bg-transparent" />
              </span>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">hoặc</span>
              </div>
            </div>

            <Button

              className="w-full"
              onClick={loginWithMetamask}
              disabled={loading}
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập với Metamask'}
            </Button>
          </CardContent>

          <CardFooter className="bg-transparent p-0 text-center">
            <p className="text-xs text-gray-400">
              Bằng việc đăng nhập, bạn đồng ý với <a href="#" className="underline hover:text-blue-600">Điều khoản</a> và <a href="#" className="underline hover:text-blue-600">Chính sách</a> của chúng tôi.
            </p>       
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
