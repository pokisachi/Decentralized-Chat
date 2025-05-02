import React, { useEffect, useState } from 'react';
import ContactItem from './ContactItem';
import { loadContacts, removeContact } from '../../lib/contacts';
import { useNavigate } from 'react-router-dom';

export default function ContactList({ signaling }) {
  const [contacts, setContacts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    setContacts(loadContacts());
  }, []);

  const handleDelete = addr => {
    setContacts(removeContact(addr));
  };

  const handleChat = addr => {
    navigate(`/chat/${addr}`);
  };

  return (
    <div className="border rounded">
      {contacts.map(c => (
        <ContactItem
          key={c.address}
          contact={c}
          status={signaling.isOnline(c.address) ? 'online' : 'offline'}
          onDelete={handleDelete}
          onChat={handleChat}
        />
      ))}
    </div>
  );
}