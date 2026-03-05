# Usar imagen oficial de Node.js 18 (versión LTS estable)
FROM node:18-slim

# Instalar dependencias necesarias para Puppeteer (generación de imágenes)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Crear directorio de la aplicación
WORKDIR /usr/src/app

# Copiar archivos de dependencias primero (para aprovechar caché de Docker)
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el código fuente
COPY . .

# Crear directorio para archivos temporales (si es necesario)
RUN mkdir -p /usr/src/app/temp

# Configurar Puppeteer para usar Chrome instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Exponer el puerto que usa la aplicación (8080 según tu .env)
EXPOSE 8080

# Comando para iniciar la aplicación
CMD ["node", "app.js"]