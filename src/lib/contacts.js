const STORAGE_KEY = 'dchat_contacts';

export function loadContacts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveContacts(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addContact(address, alias = '') {
  const contacts = loadContacts();
  if (!contacts.find(c => c.address === address)) {
    contacts.push({ address, alias });
    saveContacts(contacts);
  }
  return contacts;
}

export function removeContact(address) {
  const contacts = loadContacts().filter(c => c.address !== address);
  saveContacts(contacts);
  return contacts;
}