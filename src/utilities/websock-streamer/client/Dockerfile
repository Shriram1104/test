FROM node:18

# Create app directory
WORKDIR /streamer-clientlib

COPY package*.json /streamer-clientlib/

RUN npm install --unsafe-perm

COPY . /streamer-clientlib/

EXPOSE 8083

CMD npm start