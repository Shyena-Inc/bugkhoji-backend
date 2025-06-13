FROM node:alpine3.21

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD [ "node", 'dist/index.js' ]