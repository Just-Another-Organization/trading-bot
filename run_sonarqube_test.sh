#! /bin/bash

sudo docker build -f Dockerfile_sonarqube --network=host --no-cache .
