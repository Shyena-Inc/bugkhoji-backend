FROM node:lts

WORKDIR /app

# RUN apk add --no-cache openssl

COPY package*.json ./

RUN npm i

COPY . .

COPY prisma ./prisma/

RUN npx prisma generate

RUN npm run build

# RUN ls -la ./dist/index.js

EXPOSE 3000

CMD [ "node", "/app/dist/index.js" ]