import { ethers } from 'ethers';

let provider;
export function getProvider() {
  if (!provider) {
    if (window.ethereum) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
    } else {
      throw new Error('Metamask không được cài đặt');
    }
  }
  return provider;
}

export async function connectWallet() {
  const prov = getProvider();
  await prov.send('eth_requestAccounts', []);
  const signer = prov.getSigner();
  const address = await signer.getAddress();
  return address;
}
