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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="rounded-2xl shadow-xl overflow-hidden border-0">
          <CardHeader className="bg-white p-6 text-center">
            {/* Logo hoặc icon app */}
            <div className="flex justify-center mb-2">
              <span className="inline-block bg-blue-100 rounded-full p-3">
                <svg width="32" height="32" fill="none" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#2563eb"/><path d="M10 16.5l4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </div>
            <CardTitle className="text-2xl font-extrabold text-blue-700">
              Chào mừng đến Chat Phi Tập Trung
            </CardTitle>
            <p className="mt-2 text-gray-500 text-sm">Bảo mật, riêng tư, không phụ thuộc máy chủ trung gian.</p>
          </CardHeader>

          <CardContent className="bg-white p-6 space-y-6">
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
                  className="mt-1"
                  autoComplete="email"
                  aria-label="Email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email}>
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
              variant="outline"
              className="w-full"
              onClick={loginWithMetamask}
              disabled={loading}
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập với Metamask'}
            </Button>
          </CardContent>

          <CardFooter className="bg-gray-50 p-6 text-center">
            <p className="text-xs text-gray-400">
              Bằng việc đăng nhập, bạn đồng ý với <a href="#" className="underline hover:text-blue-600">Điều khoản</a> và <a href="#" className="underline hover:text-blue-600">Chính sách</a> của chúng tôi.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
