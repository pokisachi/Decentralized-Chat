import Gun from 'gun/gun';
import 'gun/sea';
import detectEthereumProvider from '@metamask/detect-provider';
import { ethers } from 'ethers';

const gun = Gun({ peers: ['https://gun-manhattan.herokuapp.com/gun'] });

// Định nghĩa schema nhóm
function defaultGroupSchema({ groupId, name, description, avatar, admin }) {
  return {
    groupId,
    name,
    description,
    avatar,
    admin, // address
    members: [admin],
    history: [] // {action, by, target, timestamp, sig}
  };
}

// Ký dữ liệu bằng MetaMask hoặc Magic Link
async function signAction(actionObj) {
  const authType = localStorage.getItem('auth_type');
  if (authType === 'magic') {
    // Nếu là magic, không ký (hoặc có thể dùng magic để ký nếu cần)
    return { ...actionObj, sig: 'magic' };
  }
  // Mặc định: MetaMask
  const provider = await detectEthereumProvider();
  if (!provider) throw new Error('MetaMask chưa được cài đặt');
  await provider.request({ method: 'eth_requestAccounts' });
  const ethersProvider = new ethers.BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();
  const msg = JSON.stringify(actionObj);
  const sig = await signer.signMessage(msg);
  return { ...actionObj, sig };
}

// Tạo nhóm mới (kiểu Telegram: thêm nhiều thành viên ngay khi tạo)
export async function createGroup({ name, description, avatar, admin, members = [] }) {
  const groupId = ethers.id(name + Date.now());
  // Loại bỏ trùng lặp, luôn có admin trong members
  const allMembers = Array.from(new Set([admin, ...members]));
  // Chuyển members thành object {address: true}
  const membersObj = {};
  allMembers.forEach(addr => { membersObj[addr] = true; });
  // Chuẩn bị history object {timestamp: actionObj}
  const historyObj = {};
  const action = await signAction({ action: 'create', by: admin, target: groupId, timestamp: Date.now() });
  historyObj[action.timestamp] = action;
  for (const m of allMembers) {
    if (m !== admin) {
      const addAction = await signAction({ action: 'add', by: admin, target: m, timestamp: Date.now() });
      historyObj[addAction.timestamp] = addAction;
    }
  }
  const group = {
    groupId,
    name,
    description,
    avatar,
    admin,
    members: membersObj,
    history: historyObj
  };
  return new Promise((resolve, reject) => {
    gun.get('groups').get(groupId).put(group, ack => {
      if (ack && ack.err) {
        console.error('Lỗi lưu nhóm GunDB:', ack.err);
        reject(new Error('Lỗi lưu nhóm GunDB: ' + ack.err));
      } else {
        console.log('Đã tạo nhóm:', groupId, group);
        resolve({ groupId });
      }
    });
  });
}

// Join nhóm (chỉ khi là thành viên)
export async function joinGroup(groupId, address) {
  return new Promise((resolve, reject) => {
    gun.get('groups').get(groupId).once(data => {
      if (!data) return reject(new Error('Nhóm không tồn tại'));
      // Public: ai cũng join được, không kiểm tra thành viên
      resolve({ group: data });
    });
  });
}

// Thêm thành viên (chỉ admin)
export async function addMember(groupId, admin, newMember) {
  return new Promise(async (resolve, reject) => {
    gun.get('groups').get(groupId).once(async data => {
      if (!data) return reject(new Error('Nhóm không tồn tại'));
      // Bỏ kiểm tra admin để public group ai cũng tự thêm mình được
      // if (data.admin !== admin) return reject(new Error('Chỉ admin mới thêm thành viên'));
      let isMember = false;
      if (Array.isArray(data.members)) {
        isMember = data.members.includes(newMember);
      } else if (typeof data.members === 'object' && data.members !== null) {
        isMember = !!data.members[newMember];
      }
      if (isMember) return reject(new Error('Đã là thành viên'));
      const action = await signAction({ action: 'add', by: admin, target: newMember, timestamp: Date.now() });
      const updated = { ...data, members: { ...data.members, [newMember]: true }, history: { ...data.history, [action.timestamp]: action } };
      gun.get('groups').get(groupId).put(updated, () => resolve());
    });
  });
}

// Xóa thành viên (chỉ admin)
export async function removeMember(groupId, admin, member) {
  return new Promise(async (resolve, reject) => {
    gun.get('groups').get(groupId).once(async data => {
      if (!data) return reject(new Error('Nhóm không tồn tại'));
      if (data.admin !== admin) return reject(new Error('Chỉ admin mới xóa thành viên'));
      if (!data.members.includes(member)) return reject(new Error('Không phải thành viên'));
      const action = await signAction({ action: 'remove', by: admin, target: member, timestamp: Date.now() });
      const updated = { ...data, members: { ...data.members, [member]: false }, history: { ...data.history, [action.timestamp]: action } };
      gun.get('groups').get(groupId).put(updated, () => resolve());
    });
  });
}

// Chuyển quyền admin
export async function transferAdmin(groupId, admin, newAdmin) {
  return new Promise(async (resolve, reject) => {
    gun.get('groups').get(groupId).once(async data => {
      if (!data) return reject(new Error('Nhóm không tồn tại'));
      if (data.admin !== admin) return reject(new Error('Chỉ admin mới chuyển quyền'));
      if (!data.members.includes(newAdmin)) return reject(new Error('Người nhận phải là thành viên'));
      const action = await signAction({ action: 'transferAdmin', by: admin, target: newAdmin, timestamp: Date.now() });
      const updated = { ...data, admin: newAdmin, history: { ...data.history, [action.timestamp]: action } };
      gun.get('groups').get(groupId).put(updated, () => resolve());
    });
  });
}

// Thành viên rời nhóm
export async function leaveGroup(groupId, member) {
  return new Promise(async (resolve, reject) => {
    gun.get('groups').get(groupId).once(async data => {
      if (!data) return reject(new Error('Nhóm không tồn tại'));
      if (!data.members.includes(member)) return reject(new Error('Bạn không phải thành viên'));
      const action = await signAction({ action: 'leave', by: member, target: groupId, timestamp: Date.now() });
      const updated = { ...data, members: { ...data.members, [member]: false }, history: { ...data.history, [action.timestamp]: action } };
      gun.get('groups').get(groupId).put(updated, () => resolve());
    });
  });
}

// Lấy thông tin nhóm hoặc tất cả nhóm của user
export async function getGroupInfo(groupId, cb) {
  if (groupId === null) {
    // Lấy tất cả nhóm (dùng cho sidebar, realtime)
    if (cb) {
      gun.get('groups').map().on((data, key) => {
        // Chỉ nhận object hợp lệ
        if (data && typeof data === 'object' && !Array.isArray(data) && data.groupId && data.name) {
          cb({ [key]: data });
        }
      });
      return;
    }
    return new Promise((resolve) => {
      const allGroups = {};
      gun.get('groups').map().once((data, key) => {
        if (data && typeof data === 'object' && !Array.isArray(data) && data.groupId && data.name) {
          allGroups[key] = data;
        }
      });
      setTimeout(() => resolve(allGroups), 1000); // Đợi 1s để collect
    });
  }
  // Nếu truyền cb thì realtime, không thì trả promise
  if (cb) {
    gun.get('groups').get(groupId).on(cb);
    return;
  }
  return new Promise((resolve, reject) => {
    gun.get('groups').get(groupId).once(data => {
      if (!data || typeof data !== 'object' || Array.isArray(data) || !data.groupId || !data.name) return reject(new Error('Nhóm không tồn tại hoặc dữ liệu lỗi'));
      resolve(data);
    });
  });
} 