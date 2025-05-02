// src/pages/ContactsPage.jsx
import React, { useEffect } from 'react';
import signaling from '../lib/signaling';

export default function ContactsPage({ }) {
  useEffect(() => {
    // Ví dụ: bạn dùng chính Ethereum address làm roomId
    const myAddress = '0x1234…';
    signaling.join(myAddress);

    // Lắng nghe sự kiện offer từ peer khác
    signaling.on('offer', ({ from, offer }) => {
      console.log('Nhận offer từ', from, offer);
    });

    return () => {
      signaling.off('offer');
    };
  }, []);

  // …
}
