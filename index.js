const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = 5000;

// Conexión a MongoDB Atlas
mongoose.connect('mongodb+srv://alexanderruiz1605:5hOupdrgDslkWG6d@alex701.4kyi2.mongodb.net/chatAppDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
  .then(() => {
      console.log('Conectado a MongoDB Atlas');
  })
  .catch((error) => {
      console.error('Error al conectar a MongoDB:', error);
  });

// Definir el esquema de usuario y mensajes
const userSchema = new mongoose.Schema({
    username: String,
    password: String
});

const messageSchema = new mongoose.Schema({
    usuario: String,
    mensaje: String,
    timestamp: { type: Date, default: Date.now }
});

// Modelos
const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Servir archivos estáticos
app.use(express.static('public'));

// Escuchar las conexiones de socket
io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado');

    // Cargar mensajes previos de la base de datos y enviarlos al nuevo usuario
    (async () => {
        try {
            const mensajes = await Message.find().sort({ timestamp: 1 }).limit(50).exec();
            socket.emit('mensajesAnteriores', mensajes);
        } catch (err) {
            console.error('Error al recuperar mensajes:', err);
        }
    })();

    // Manejar el evento de login
    socket.on('login', async (data) => {
        try {
            const user = await User.findOne({ username: data.usuario });
            if (!user) {
                socket.emit('loginResponse', { success: false, error: 'userNotFound' });
            } else {
                const validPassword = data.password === user.password;
                if (validPassword) {
                    socket.emit('loginResponse', { success: true });
                } else {
                    socket.emit('loginResponse', { success: false, error: 'wrongPassword' });
                }
            }
        } catch (error) {
            console.error('Error durante el login:', error);
        }
    });

    // Manejar mensajes de chat
    socket.on('chat', async (data) => {
        const nuevoMensaje = new Message({
            usuario: data.usuario,
            mensaje: data.mensaje
        });

        try {
            await nuevoMensaje.save();
            io.emit('chat', { usuario: data.usuario, mensaje: data.mensaje });
        } catch (error) {
            console.error('Error al guardar el mensaje:', error);
        }
    });

    // Notificar cuando el usuario está escribiendo un mensaje
    socket.on('typing', (data) => {
        socket.broadcast.emit('typing', data);
    });
});

// Iniciar el servidor
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
