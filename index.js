const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIO = require('socket.io');
const bcrypt = require('bcrypt'); // Para encriptar la contraseña

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = 5000;

// Conexión a MongoDB Atlas
mongoose.connect('mongodb+srv://Ricardo:Ricardo.123@proyecto.wue4m.mongodb.net/registroUsuario?retryWrites=true&w=majority&appName=PROYECTO', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
  .then(() => {
      console.log('Conectado a MongoDB Atlas');
  })
  .catch((error) => {
      console.error('Error al conectar a MongoDB:', error);
  });

// Definir el esquema de usuario
const userSchema = new mongoose.Schema({
    username: String,
    password: String
});

// Definir el esquema de mensajes
const messageSchema = new mongoose.Schema({
    usuario: String,
    mensaje: String,
    timestamp: { type: Date, default: Date.now } // Añadir un timestamp
});

// Modelo de Usuario y Mensaje
const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Servir el archivo estático
app.use(express.static('public'));

// Escuchar las conexiones de socket
io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado');

    // Cargar mensajes previos de la base de datos y enviarlos al nuevo usuario
    (async () => {
        try {
            const mensajes = await Message.find().sort({ timestamp: 1 }).limit(50).exec(); // Actualizado
            socket.emit('mensajesAnteriores', mensajes); // Enviar mensajes previos al nuevo usuario
        } catch (err) {
            console.error('Error al recuperar mensajes:', err);
        }
    })();

    // Escuchar el evento de login
    socket.on('login', async (data) => {
        try {
            // Buscar al usuario en la base de datos
            const user = await User.findOne({ username: data.usuario });

            if (!user) {
                // Usuario no encontrado
                socket.emit('loginResponse', { success: false, error: 'userNotFound' });
            } else {
                // Comparar la contraseña
                const validPassword = data.password === user.password;

                if (validPassword) {
                    // Contraseña correcta
                    socket.emit('loginResponse', { success: true });
                } else {
                    // Contraseña incorrecta
                    socket.emit('loginResponse', { success: false, error: 'wrongPassword' });
                }
            }
        } catch (error) {
            console.error('Error durante el login:', error);
        }
    });

    // Manejar los mensajes de chat
    socket.on('chat', async (data) => {
        // Crear un nuevo mensaje y guardarlo en la base de datos
        const nuevoMensaje = new Message({
            usuario: data.usuario,
            mensaje: data.mensaje
        });

        try {
            await nuevoMensaje.save(); // Guardar mensaje en la base de datos
            io.emit('chat', { usuario: data.usuario, mensaje: data.mensaje }); // Emitir el mensaje a todos los usuarios
        } catch (error) {
            console.error('Error al guardar el mensaje:', error);
        }
    });

    // Notificar cuando el usuario está escribiendo un mensaje
    socket.on('typing', (data) => {
        socket.broadcast.emit('typing', data);
    });
});

// Iniciar el servidor en todas las interfaces
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
