# Usamos una imagen que ya incluye las dependencias de Chrome para Puppeteer
FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /usr/src/app

# Copiamos archivos de dependencias
COPY package*.json ./
RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos el puerto que usa Cloud Run
EXPOSE 8080

CMD [ "node", "app.js" ]