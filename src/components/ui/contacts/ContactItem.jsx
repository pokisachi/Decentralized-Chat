import React from 'react';
import { Button } from '../ui/button';

export default function ContactItem({ contact, onDelete, onChat, status }) {
  return (
    <div className="flex items-center justify-between p-2 border-b">
      <div className="flex items-center space-x-2">
        <span className={`h-2 w-2 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
        <div>
          <div className="font-medium">{contact.alias || contact.address}</div>
          <div className="text-xs text-gray-500">{contact.address}</div>
        </div>
      </div>
      <div className="space-x-2">
        <Button size="sm" onClick={() => onChat(contact.address)}>Chat</Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(contact.address)}>Xóa</Button>
      </div>
    </div>
  );
}