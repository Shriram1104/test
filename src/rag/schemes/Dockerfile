FROM node:24

WORKDIR /rag-schemeslib

COPY package*.json /rag-schemeslib/

RUN npm install --unsafe-perm

COPY . /rag-schemeslib/

EXPOSE 12001

CMD npm start