.PHONY: build run

NAME=mojaloop-connector

default: build

build:
	docker build -t $(NAME) .
run:
	docker-compose up 
