import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Shield, Edit, Trash2 } from 'lucide-react';

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

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
}

export default function MessageList({ messages, currentUserId }: MessageListProps) {
  const formatTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isOwnMessage = message.senderId === currentUserId;
        
        return (
          <div
            key={message._id}
            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-start space-x-3 max-w-[70%]`}>
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white ${
                  isOwnMessage 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                    : 'bg-gradient-to-r from-green-500 to-teal-500'
                }`}>
                  
                  {getInitials(message.senderName)}
                </div>
              </div>

              {/* Message Content */}
              <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                {/* Sender Name & Time */}
                <div className={`flex items-center space-x-2 mb-1 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <span className="text-sm font-medium text-gray-300">{message.senderName}</span>
                  <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
                  {message.edited && (
                    <span className="text-xs text-gray-500 flex items-center">
                      <Edit className="h-3 w-3 mr-1" />
                      edited
                    </span>
                  )}
                </div>

                {/* Message Bubble */}
                <div className={`relative px-4 py-2 rounded-2xl ${
                  isOwnMessage
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-gray-700 text-gray-100'
                } ${isOwnMessage ? 'rounded-br-md' : 'rounded-bl-md'}`}>
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  
                  {/* Encryption indicator */}
                  <div className="flex items-center mt-1 opacity-60">
                    <Shield className="h-3 w-3 mr-1" />
                    <span className="text-xs">Encrypted</span>
                  </div>
                </div>

                {/* Message Actions (for own messages) */}
                {isOwnMessage && (
                  <div className="flex items-center space-x-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-gray-400 hover:text-blue-400 p-1 rounded">
                      <Edit className="h-3 w-3" />
                    </button>
                    <button className="text-gray-400 hover:text-red-400 p-1 rounded">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}