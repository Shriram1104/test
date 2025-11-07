FROM node:24

WORKDIR /rag-datastoreslib

COPY package*.json /rag-datastoreslib/

RUN npm install --unsafe-perm

COPY . /rag-datastoreslib/

EXPOSE 12001

CMD npm start