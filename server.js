const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

app.use(express.static('public'));

// Хранилище комнат и пользователей
const rooms = new Map(); // roomId -> Set(socketId)

io.on('connection', (socket) => {
  console.log(`✅ Пользователь подключился: ${socket.id}`);

  // Создание или подключение к комнате
  socket.on('join-room', (roomId, callback) => {
    // Покидаем предыдущие комнаты
    const prevRoom = [...socket.rooms].find(r => r !== socket.id);
    if (prevRoom) {
      socket.leave(prevRoom);
      if (rooms.has(prevRoom)) {
        rooms.get(prevRoom).delete(socket.id);
        if (rooms.get(prevRoom).size === 0) rooms.delete(prevRoom);
      }
    }

    socket.join(roomId);
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(socket.id);
    
    console.log(`📡 ${socket.id} присоединился к комнате ${roomId}, участников: ${rooms.get(roomId).size}`);
    
    // Сообщаем, что пользователь вошёл в комнату
    socket.to(roomId).emit('user-connected', socket.id);
    
    // Отправляем обратно список всех участников в этой комнате (кроме себя)
    const otherUsers = [...rooms.get(roomId)].filter(id => id !== socket.id);
    callback({ myId: socket.id, others: otherUsers });
  });

  // Пересылка сигналов WebRTC (offer, answer, ice-candidate)
  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log(`❌ Пользователь отключился: ${socket.id}`);
    // Удаляем из всех комнат
    for (let [roomId, users] of rooms.entries()) {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        if (users.size === 0) rooms.delete(roomId);
        else {
          socket.to(roomId).emit('user-disconnected', socket.id);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
});