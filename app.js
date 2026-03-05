const express = require('express');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();
const { Storage } = require('@google-cloud/storage');
const db = require('./db');
const path = require('path');
const app = express();
const port = 8080;

app.use(express.json());
app.use(express.static('public'));
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
  methods: ['GET', 'POST'],
  credentials: true
}));


const storage = new Storage(); // Se autenticará vía Cloud SDK en tu PC o rol en Cloud Run
const bucket = storage.bucket('logyser-recursos-corporativos');
const upload = multer({ storage: multer.memoryStorage() });

// 1. Buscar empleado por Identificación
app.get('/api/empleado/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM Maestro_firma_corporativa WHERE Identificacion = ?', [req.params.id]);
    if (rows.length === 0) {
      res.json({ exists: true, data: rows[0] });
    } if (rows.length > 0) {
      res.json({ exists: true, data: rows[0] });
    } else {
      res.json({ exists: false });
    }

  } catch (error) {
    res.status(500).send(error.message);
  }
});

// 2. Crear o Actualizar registro + Subida de Foto
app.post('/api/guardar', upload.single('foto'), async (req, res) => {
  const data = req.body;
  let fotoUrl = data.foto_url || "https://storage.googleapis.com/logyser-recursos-corporativos/firmas-corporativas/fotos-empleados/usuario.png";

  // Si hay una nueva foto, subirla al Bucket
  if (req.file) {
    const blob = bucket.file(`firmas-corporativas/fotos-empleados/${data.Identificacion}_${Date.now()}.png`);
    const blobStream = blob.createWriteStream({ resumable: false });

    blobStream.on('error', err => res.status(500).send(err));
    blobStream.on('finish', async () => {
      fotoUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      await upsertEmpleado(data, fotoUrl, res);
    });
    blobStream.end(req.file.buffer);
  } else {
    await upsertEmpleado(data, fotoUrl, res);
  }
});

async function upsertEmpleado(data, fotoUrl, res) {
  const area = data.area || 'auxiliares';
  const operacion = data.operacion || 'Administracion';

  // Si Trabajador es "Nuevo Registro" o viene de un formulario vacío, 
  // lo enviamos como null o un string vacío dependiendo de tu preferencia.
  // Pero como tu tabla dice NOT NULL, vamos a ponerle el nombre por defecto si es nuevo.
  const trabajadorNombre = (data.Trabajador && data.Trabajador !== "Nuevo Registro")
    ? data.Trabajador
    : data.nombre;

  const query = `
        INSERT INTO Maestro_firma_corporativa 
        (Identificacion, Trabajador, nombre, cargo, operacion, direccion, email, celular, area, foto_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        nombre=VALUES(nombre), 
        cargo=VALUES(cargo), 
        operacion=VALUES(operacion), 
        direccion=VALUES(direccion), 
        email=VALUES(email), 
        celular=VALUES(celular), 
        foto_url=VALUES(foto_url)`;

  try {
    await db.query(query, [
      data.Identificacion,
      trabajadorNombre,
      data.nombre,
      data.cargo,
      data.operacion,
      data.direccion,
      data.email,
      data.celular,
      area,
      fotoUrl
    ]);
    console.log("MySQL: Registro actualizado/creado con éxito");
    res.json({ success: true, fotoUrl });
  } catch (error) {
    console.error("Error en MySQL:", error.message);
    // Enviamos el error como JSON para que el frontend no se rompa
    res.status(500).json({ success: false, error: error.message });
  }
}

const nodeHtmlToImage = require('node-html-to-image');

// Nueva ruta para generar el PNG de la firma
app.post('/api/generar-png', async (req, res) => {
  const d = req.body;
  const fondoUrl = `https://storage.googleapis.com/logyser-recursos-corporativos/firmas-corporativas/areas/fondo-${d.area}.png`;

  try {
    const image = await nodeHtmlToImage({
      transparent: true,
      puppeteerArgs: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      },
      html: `
            <html>
              <head>
                <style>
                  body { 
                    margin: 0; padding: 0; width: 1444px; height: 519px; 
                    background-color: transparent !important; 
                  }
                  .main-table {
                    background-image: url('${fondoUrl}');
                    background-size: cover;
                    background-repeat: no-repeat;
                    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    table-layout: fixed;
                    /* Quitamos el fondo blanco sólido para evitar el bloque en modo oscuro */
                    background-color: transparent; 
                  }
                  .nombre { 
                    margin: 0; font-size: 45px; font-weight: 800; color: #1F2E3A; 
                    text-shadow: 1px 1px 0 #ffffff, -1px -1px 0 #ffffff;
                  }
                  .cargo { 
                    margin: 10px 0; font-size: 30px; font-weight: 600; color: #C7743A; 
                    text-shadow: 1px 1px 0 #ffffff;
                  }
                  .email-link { 
                    font-size: 35px; font-weight: 700; color: #1F2E3A; 
                    text-shadow: 1px 1px 0 #ffffff;
                  }
                  .datos-texto {
                    color: #2F3B45; font-size: 24px; line-height: 1.4;
                    text-shadow: 1px 1px 0 #ffffff;
                  }
                  .nombre { 
                  margin: 0; font-size: 45px; font-weight: 800; color: #1F2E3A; 
                  text-transform: line-height: 1.1;
                  /* SOLUCIÓN AL DESBORDE: Fuerza el salto de línea */
                  word-break: break-word; 
                  max-width: 400px; /* Limitamos el ancho para obligar al salto */
                  /* SOLUCIÓN AL CONTORNO: Duplicamos el grosor del halo blanco */
                  text-shadow: 2px 2px 0 #ffffff, -2px -2px 0 #ffffff, 2px -2px 0 #ffffff, -2px 2px 0 #ffffff, 0 0 5px #ffffff;
                }

                .cargo { 
                  margin: 10px 0; font-size: 30px; font-weight: 600; color: #C7743A; 
                  /* Aumentamos resalte para el cargo */
                  text-shadow: 2px 2px 0 #ffffff, 0 0 3px #ffffff;
                }

                .email-link { 
                  font-size: 35px; font-weight: 700; color: #1F2E3A; 
                  /* Aumentamos resalte para el email */
                  text-shadow: 2px 2px 0 #ffffff, 0 0 3px #ffffff;
                }

                .datos-texto {
                  color: #2F3B45; font-size: 24px; line-height: 1.4;
                  /* También le damos un toque de resalte a los datos de sede y tel */
                  text-shadow: 1px 1px 0 #ffffff;
                }
      
                </style>
              </head>
              <body>
                <table class="main-table" cellpadding="0" cellspacing="0" border="0" style="width: 1444px; height: 519px;">
                  <tr style="height: 410px;">
                    <td style="width: 410px; vertical-align: middle; text-align: center; padding-left: 20px;">
                      <div style="display: inline-block; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0px 10px 20px rgba(0,0,0,0.3); margin-top: 5px;">
                        <img src="${d.fotoUrl}" style="width: 295px; height: 295px; border-radius: 50%; object-fit: cover; display: block;">
                      </div>
                    </td>
                    <td style="vertical-align: middle; padding-left: 20px; width: 600px;">
                      <h1 class="nombre">${d.nombre}</h1>
                      <p class="cargo">${d.cargo}</p>
                      <div style="width: 140px; height: 5px; background-color: #C7743A; margin: 22px 0;"></div>
                      <table cellpadding="0" cellspacing="0" border="0" class="datos-texto">
                        <tr><td style="padding-bottom: 8px;"><span style="color: #A45A2A; font-weight: 600;">Sede:</span> <span style="font-weight: 600;">${d.operacion}</span><br><span style="font-weight: 400; font-size: 20px;">${d.direccion}</span></td></tr>
                        <tr><td><span style="color: #A45A2A; font-weight: 600;">Tel:</span> <span style="font-weight: 600;">(+57) ${d.celular}</span></td></tr>
                      </table>
                    </td>
                    <td style="width: 434px;"></td>
                  </tr>
                  <tr style="height: 109px;">
                    <td colspan="3" style="vertical-align: top; text-align: left; padding-left: 50px; padding-top: 5px;">
                      <span class="email-link">${d.email}</span>
                    </td>
                  </tr>
                </table>
              </body>
            </html>`
    });

    const fileName = `firmas-corporativas/generadas/${d.identificacion}.png`;
    const file = bucket.file(fileName);
    await file.save(image, { contentType: 'image/png' });

    res.json({ success: true, finalUrl: `https://storage.googleapis.com/${bucket.name}/${fileName}` });
  } catch (error) {
    console.error("Error PNG:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => console.log(`Servidor corriendo en puerto ${port}`));