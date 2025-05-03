# Design System: Decentralized Chat

## 1. Color Palette

| Name        | HEX      | Usage                       |
|-------------|----------|-----------------------------|
| Primary     | #1E3A8A  | Header, logo, button        |
| Secondary   | #10B981  | Online, button, highlight   |
| Accent      | #F59E0B  | Badge, send, notification   |
| Bg Light    | #F3F4F6  | Light background            |
| Bg Dark     | #1F2937  | Dark mode background        |
| Text Main   | #111827  | Main text                   |
| Text Muted  | #6B7280  | Subtext, description        |
| Border      | #E5E7EB  | Border, divider             |

## 2. Typography

- **Font:** Inter
- **Header:** Bold, 18–24px
- **Body:** Regular, 14–16px
- **Caption:** Light, 12px

## 3. Spacing & Layout

- **Base spacing:** 8px
- **Container padding:** 24–32px
- **Bubble radius:** 12px
- **Sidebar width:** 20% (min 320px)
- **Chat window:** 80%

## 4. Iconography

- **Style:** Line, bo góc mềm, stroke 1.5px
- **Bộ icon:** Heroicons hoặc Lucide

## 5. Component Example

### Button
```jsx
<button className="bg-primary text-white rounded-lg px-4 py-2 font-bold shadow-chat hover:bg-primary/90 transition">
  Gửi tin nhắn
</button>
```

### Chat Bubble
```jsx
<div className="rounded-lg px-4 py-3 mb-3 max-w-xs shadow-chat bg-secondary text-white">
  Xin chào, đây là tin nhắn!
</div>
```

### Sidebar Item
```jsx
<div className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10 cursor-pointer">
  <img src="avatar.png" className="w-10 h-10 rounded-full" />
  <div>
    <div className="font-bold text-text-main">Tên nhóm</div>
    <div className="text-xs text-text-muted">Online</div>
  </div>
</div>
```

## 6. Dark Mode
- Nền: #1F2937
- Text: #F3F4F6
- Bubble peer: #374151

## 7. Accessibility
- Contrast ≥ 4.5:1 cho mọi thành phần chính.
- Font size tối thiểu 14px.

---

**Luôn tuân thủ style guide này khi phát triển UI mới.** 