// src/lib/useLibp2p.js
import { useEffect, useRef } from "react";
import { createLibp2p }          from "libp2p";
import { webSockets }            from "@libp2p/websockets";
import { mplex }                 from "@libp2p/mplex";
import { noise }                 from "@chainsafe/libp2p-noise";
import { gossipsub }             from "@chainsafe/libp2p-gossipsub";
import { fromString, toString as uint8ToString } from "uint8arrays";

export function useLibp2p(topic, onMessage) {
  const nodeRef = useRef(null);

  useEffect(() => {
    let stopped = false;

    (async () => {
      const node = await createLibp2p({
        // **1) Đưa tất cả vào modules**
          modules: {
               transport:     [ webSockets() ],
                streamMuxers:  [ mplex() ],
                connEncryption:[ noise() ],
                pubsub:        [ gossipsub() ]   // ← phải đặt trong mảng
             },
        // **2) Bật pubsub trong config**
        config: {
          pubsub: {
            enabled: true,
            emitSelf: false   // cho cả publisher tự nhận message của chính nó nếu cần
          }
        }
      });

      await node.start();
      if (stopped) return;
      console.log("✅ libp2p node started:", node.peerId.toString());

      // bây giờ pubsub service nằm dưới node.services.pubsub
      const pubsub = node.services.pubsub;
      if (!pubsub) {
        console.error("⚠️ PubSub service not found on node", node);
        return;
      }

      await pubsub.subscribe(topic);
      console.log("✅ Subscribed to", topic);

      pubsub.addEventListener("message", (evt) => {
        const from = evt.detail.from;
        const msg  = uint8ToString(evt.detail.data);
        onMessage({ from, msg });
      });

      nodeRef.current = node;
    })();

    return () => {
      stopped = true;
      nodeRef.current?.stop();
    };
  }, [topic, onMessage]);

  const publish = async (message) => {
    const node = nodeRef.current;
    if (!node || !node.services.pubsub) return;
    await node.services.pubsub.publish(topic, fromString(message));
  };

  return { publish };
}
