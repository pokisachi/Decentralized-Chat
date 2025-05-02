// src/lib/signaling.js
import { io } from 'socket.io-client';

class Signaling {
  constructor() {
    // thay http://localhost:3001 bằng URL server của bạn
    this.socket = io('http://localhost:3001', { transports: ['websocket'] });

    this.socket.on('connect', () => {
      console.log('🟢 Signaling connected:', this.socket.id);
    });

    // Khi server trả về yourId
    this.socket.on('joined', ({ yourId }) => {
      this.myId = yourId;
      console.log('👉 Joined room, myId =', yourId);
    });

    // Nhận offer/answer/ice-candidate
    this.socket.on('offer', data => this._emit('offer', data));
    this.socket.on('answer', data => this._emit('answer', data));
    this.socket.on('ice-candidate', data => this._emit('ice-candidate', data));

    // map event handlers
    this.handlers = {};
  }

  // API từ front-end gọi
  join(roomId) {
    this.socket.emit('join', roomId);
  }

  sendOffer(to, offer) {
    this.socket.emit('offer', { to, offer });
  }

  sendAnswer(to, answer) {
    this.socket.emit('answer', { to, answer });
  }

  sendIceCandidate(to, candidate) {
    this.socket.emit('ice-candidate', { to, candidate });
  }

  // Đăng ký lắng nghe sự kiện
  on(event, fn) {
    this.handlers[event] = fn;
  }

  off(event) {
    delete this.handlers[event];
  }

  _emit(event, data) {
    if (this.handlers[event]) this.handlers[event](data);
  }
}

export default new Signaling();
