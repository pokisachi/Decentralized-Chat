import { create } from 'ipfs-http-client'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

// Khởi tạo IPFS client
const ipfs = create({ url: 'http://127.0.0.1:5001/api/v0' })

// Lưu trữ các listeners đã đăng ký
const listeners = new Map()

// Đã subscribe PubSub chưa
let _subscribed = false

// Dedupe store: lưu các key đã xử lý
const processedMessages = new Map()
const MESSAGE_EXPIRY_TIME = 5 * 60 * 1000 // 5 phút

function cleanupExpiredMessages() {
  const now = Date.now()
  for (const [key, ts] of processedMessages.entries()) {
    if (now - ts > MESSAGE_EXPIRY_TIME) processedMessages.delete(key)
  }
}
setInterval(cleanupExpiredMessages, 60000)

let myPeerId = null
export async function getOrCreatePeerId() {
  if (!myPeerId) {
    try {
      const { id } = await ipfs.id()
      myPeerId = id
    } catch {
      myPeerId = `user-${Math.random().toString(36).slice(2,8)}`
    }
  }
  return myPeerId
}

async function _ensureSubscribed(topic) {
  if (_subscribed) return
  _subscribed = true
  const peerId = await getOrCreatePeerId()

  await ipfs.pubsub.subscribe(topic, async msg => {
    const from = msg.from.toString()
    // skip self
    if (from === peerId) return

    // dedupe by seqno if available
    let dedupeKey
    if (msg.seqno) {
      // chuyển Uint8Array seqno sang hex string
      const seq = uint8ArrayToString(msg.seqno, 'base16')
      dedupeKey = `${from}-${seq}`
    }

    const content = new TextDecoder().decode(msg.data)
    let messageData
    try { messageData = JSON.parse(content) } catch { messageData = { text: content } }

    // fallback to messageData.id
    dedupeKey = dedupeKey || messageData.id || `${from}-${Date.now()}`
    if (processedMessages.has(dedupeKey)) return
    processedMessages.set(dedupeKey, Date.now())

    const message = {
      id: messageData.id || dedupeKey,
      from,
      text: messageData.text,
      timestamp: messageData.timestamp
    }
    for (const cb of listeners.values()) cb(message)
  })
}

export function subscribeTopic(topic, onMessage) {
  let unsub = () => {}
  ;(async () => {
    await _ensureSubscribed(topic)
    const key = Symbol()
    listeners.set(key, onMessage)
    unsub = () => listeners.delete(key)
  })()
  return () => unsub()
}

export async function publishMessage(topic, text, messageId = null) {
  const id = messageId || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`
  const messageData = { id, text, timestamp: Date.now() }
  const data = new TextEncoder().encode(JSON.stringify(messageData))
  await ipfs.pubsub.publish(topic, data)
  // Mark to prevent echo-self
  processedMessages.set(id, Date.now())
  return messageData
}
