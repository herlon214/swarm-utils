FROM node:alpine

COPY ./ /var/app
WORKDIR /var/app

RUN npm i

CMD npm start