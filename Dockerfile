FROM keymetrics/pm2:latest-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package*.json ./

RUN npm install && npm audit fix

COPY . .

EXPOSE 8081
CMD [ "pm2-runtime", "start", "ecosystem.config.js"]
