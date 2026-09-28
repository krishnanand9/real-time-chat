export type User = {
  id: string;
  username: string;
  online: boolean;
  lastSeen?: string;
};

export type Message = {
  _id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  deliveredTo: string[];
  readBy: string[];
  createdAt: string;
  updatedAt?: string;
};
