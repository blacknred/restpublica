#!/bin/bash

#docker-compose run users-service knex migrate:latest --env development --knexfile app/knexfile.js
#docker-compose run users-service knex seed:run --env development --knexfile app/knexfile.js
docker-compose run posts-service knex migrate:latest --env development --knexfile app/knexfile.js
docker-compose run posts-service knex seed:run --env development --knexfile app/knexfile.js
