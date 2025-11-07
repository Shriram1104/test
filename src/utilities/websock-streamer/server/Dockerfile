FROM node:18

# Create app directory
WORKDIR /schemes-streamer-serverlib

COPY package*.json /schemes-streamer-serverlib/

RUN npm install --unsafe-perm

COPY . /schemes-streamer-serverlib/

EXPOSE 8082

CMD npm start