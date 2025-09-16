import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { messageApi } from '../services/api';
import { Send, Plus, Settings, Shield, Users, MessageCircle } from 'lucide-react';
import ChatSidebar from '../components/ChatSidebar';
import MessageList from '../components/MessageList';
import TypingIndicator from '../components/TypingIndicator';

interface ChatRoom {
  _id: string;
  name: string;
  description?: string;
  participants: string[];
  isPrivate: boolean;
  createdAt: string;
}

interface Message {
  _id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'file' | 'image' | 'system';
  timestamp: string;
  edited?: boolean;
  editedAt?: string;
  replyTo?: string;
}

export default function ChatPage() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    loadChatRooms();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('new-message', handleNewMessage);
      socket.on('user-typing', handleUserTyping);
      socket.on('user-stopped-typing', handleUserStoppedTyping);
      socket.on('message-edited', handleMessageEdited);
      socket.on('message-deleted', handleMessageDeleted);

      return () => {
        socket.off('new-message');
        socket.off('user-typing');
        socket.off('user-stopped-typing');
        socket.off('message-edited');
        socket.off('message-deleted');
      };
    }
  }, [socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedRoom && socket) {
      loadMessages(selectedRoom._id);
      socket.emit('join-rooms', [selectedRoom._id]);
    }
  }, [selectedRoom, socket]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatRooms = async () => {
    try {
      const rooms = await messageApi.getChatRooms();
      setChatRooms(rooms);
      if (rooms.length > 0 && !selectedRoom) {
        setSelectedRoom(rooms[0]);
      }
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (roomId: string) => {
    try {
      const messagesData = await messageApi.getMessages(roomId);
      setMessages(messagesData);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleNewMessage = (message: Message) => {
    if (message.chatId === selectedRoom?._id) {
      setMessages(prev => [...prev, message]);
    }
  };

  const handleUserTyping = (data: { userId: string; userName: string }) => {
    if (data.userId !== user?.id) {
      setTypingUsers(prev => [...prev.filter(id => id !== data.userId), data.userName]);
    }
  };

  const handleUserStoppedTyping = (data: { userId: string }) => {
    if (data.userId !== user?.id) {
      setTypingUsers(prev => prev.filter(name => name !== data.userId));
    }
  };

  const handleMessageEdited = (editedMessage: any) => {
    setMessages(prev => 
      prev.map(msg => 
        msg._id === editedMessage.id 
          ? { ...msg, content: editedMessage.content, edited: true, editedAt: editedMessage.editedAt }
          : msg
      )
    );
  };

  const handleMessageDeleted = (data: { messageId: string }) => {
    setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRoom || !socket) return;

    const messageData = {
      chatId: selectedRoom._id,
      content: newMessage.trim(),
      messageType: 'text' as const
    };

    socket.emit('send-message', messageData);
    setNewMessage('');
    
    // Stop typing indicator
    socket.emit('typing-stop', { chatId: selectedRoom._id });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleTyping = () => {
    if (!selectedRoom || !socket) return;

    socket.emit('typing-start', { chatId: selectedRoom._id });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing-stop', { chatId: selectedRoom._id });
    }, 1000);
  };

  const createChatRoom = async (name: string, description?: string) => {
    try {
      const newRoom = await messageApi.createChatRoom(name, description);
      setChatRooms(prev => [newRoom, ...prev]);
      setSelectedRoom(newRoom);
    } catch (error) {
      console.error('Failed to create chat room:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <ChatSidebar
        chatRooms={chatRooms}
        selectedRoom={selectedRoom}
        onSelectRoom={setSelectedRoom}
        onCreateRoom={createChatRoom}
        user={user}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="bg-gray-800 px-6 py-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MessageCircle className="h-6 w-6 text-blue-400 mr-3" />
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedRoom.name}</h2>
                    {selectedRoom.description && (
                      <p className="text-sm text-gray-400">{selectedRoom.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center text-sm text-gray-400">
                    <Shield className="h-4 w-4 mr-1" />
                    Encrypted
                  </div>
                  <div className="flex items-center text-sm text-gray-400">
                    <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <MessageList messages={messages} currentUserId={user?.id || ''} />
              <TypingIndicator users={typingUsers} />
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-gray-800 px-6 py-4 border-t border-gray-700">
              <form onSubmit={sendMessage} className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Type your message..."
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">Select a chat room</h3>
              <p className="text-gray-500">Choose a room from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}