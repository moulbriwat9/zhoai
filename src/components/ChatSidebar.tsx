import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Settings, LogOut, Shield, Users, Hash } from 'lucide-react';

interface ChatRoom {
  _id: string;
  name: string;
  description?: string;
  participants: string[];
  isPrivate: boolean;
  createdAt: string;
}

interface ChatSidebarProps {
  chatRooms: ChatRoom[];
  selectedRoom: ChatRoom | null;
  onSelectRoom: (room: ChatRoom) => void;
  onCreateRoom: (name: string, description?: string) => void;
  user: any;
}

export default function ChatSidebar({ 
  chatRooms, 
  selectedRoom, 
  onSelectRoom, 
  onCreateRoom, 
  user 
}: ChatSidebarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const { logout } = useAuth();

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    onCreateRoom(newRoomName.trim(), newRoomDescription.trim() || undefined);
    setNewRoomName('');
    setNewRoomDescription('');
    setShowCreateModal(false);
  };

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-blue-400 mr-2" />
            <h1 className="text-xl font-bold text-white">SecureChat</h1>
          </div>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="flex items-center p-3 bg-gray-700 rounded-lg">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
            {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="ml-3 flex-1">
            <p className="text-white font-medium">{user?.displayName || user?.email}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role} • {user?.membershipType}</p>
          </div>
        </div>
      </div>

      {/* Chat Rooms */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Hash className="h-5 w-5 mr-2" />
              Chat Rooms
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
              title="Create Room"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {chatRooms.map((room) => (
              <button
                key={room._id}
                onClick={() => onSelectRoom(room)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedRoom?._id === room._id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Hash className="h-4 w-4 mr-2 opacity-60" />
                    <span className="font-medium truncate">{room.name}</span>
                  </div>
                  {room.isPrivate && (
                    <Shield className="h-4 w-4 opacity-60" />
                  )}
                </div>
                {room.description && (
                  <p className="text-xs opacity-75 mt-1 truncate">{room.description}</p>
                )}
                <div className="flex items-center mt-2 text-xs opacity-60">
                  <Users className="h-3 w-3 mr-1" />
                  {room.participants.length} members
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-90vw">
            <h3 className="text-xl font-semibold text-white mb-4">Create New Room</h3>
            
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Room Name *
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter room name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="Optional room description"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}