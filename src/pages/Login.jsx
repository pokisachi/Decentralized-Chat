import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { Magic } from 'magic-sdk'

// Magic SDK: replace with your publishable key
const magic = new Magic('pk_live_459DF667128B1FBD', { 
  network: 'mainnet' 
})

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  
  // 1) Metamask login: request account + sign message
  const loginWithMetamask = async () => {
    if (!window.ethereum) {
      alert('Vui lòng cài Metamask extension!')
      return
    }
    setLoading(true)
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      // Handle both ethers v5 and v6
      let provider
      let signer
      
      if (ethers.BrowserProvider) {
        // ethers v6
        provider = new ethers.BrowserProvider(window.ethereum)
        signer = await provider.getSigner()
      } else {
        // ethers v5
        provider = new ethers.providers.Web3Provider(window.ethereum)
        signer = provider.getSigner()
      }
      
      const address = await signer.getAddress()
      const message = 'Login to Decentralized Chat App'
      const signature = await signer.signMessage(message)
      
      localStorage.setItem('wallet_address', address)
      localStorage.setItem('wallet_signature', signature)
      navigate('/chats')
    } catch (err) {
      console.error('Metamask login error:', err)
      alert(`Metamask login thất bại: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }
  
  // 2) Magic Link login: send link, then get hidden wallet
  const loginWithMagic = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Send magic link to user's email
      await magic.auth.loginWithMagicLink({ email })
      
      // Get provider and signer
      let provider
      let signer
      
      if (ethers.BrowserProvider) {
        // ethers v6
        provider = new ethers.BrowserProvider(magic.rpcProvider)
        signer = await provider.getSigner()
      } else {
        // ethers v5
        provider = new ethers.providers.Web3Provider(magic.rpcProvider)
        signer = provider.getSigner()
      }
      
      const address = await signer.getAddress()
      
      // Store wallet address and navigate to chat
      localStorage.setItem('wallet_address', address)
      localStorage.setItem('auth_type', 'magic')
      
      navigate('/chats')
    } catch (err) {
      console.error('Magic link login error:', err)
      alert(`Magic link login thất bại: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }
  
  // Render login UI
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-6">
          <h1 className="text-2xl font-bold text-center mb-6">Đăng nhập</h1>
          
          {/* Magic Link login form */}
          <form onSubmit={loginWithMagic} className="space-y-4 mb-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !email}
            >
              {loading ? "Đang xử lý..." : "Đăng nhập với Magic Link"}
            </Button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">hoặc</span>
            </div>
          </div>
          
          {/* Metamask login button */}
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={loginWithMetamask}
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : "Đăng nhập với Metamask"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}