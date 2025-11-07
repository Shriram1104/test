FROM node:24

# Create app directory
WORKDIR /schemes-search-agent

COPY package*.json /schemes-search-agent/

RUN npm install --unsafe-perm

COPY . /schemes-search-agent/

EXPOSE 12001

CMD npm start