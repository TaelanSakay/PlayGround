import React from 'react';
import { User } from '../types/whiteboard';

interface UserListProps {
  users: User[];
  currentUser: string;
}

const UserList: React.FC<UserListProps> = ({ users, currentUser }) => {
  const getRandomColor = (name: string) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Connected Users</h3>
      
      {users.length === 0 ? (
        <p className="text-gray-500 text-sm">No other users connected</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center space-x-3 p-2 rounded-md bg-gray-50"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: getRandomColor(user.name) }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {user.name}
                  {user.name === currentUser && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      You
                    </span>
                  )}
                </p>
                {user.cursor && (
                  <p className="text-xs text-gray-500">
                    Cursor: ({Math.round(user.cursor.x)}, {Math.round(user.cursor.y)})
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-6 p-3 bg-blue-50 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> You can see other users' cursors in real-time as they move around the canvas.
        </p>
      </div>
    </div>
  );
};

export default UserList; 