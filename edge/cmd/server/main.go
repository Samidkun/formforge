package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"formforge/edge/internal/db"
	"formforge/edge/internal/handler"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "127.0.0.1"
	}
	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5433"
	}
	dbUser := os.Getenv("DB_USERNAME")
	if dbUser == "" {
		dbUser = "formforge"
	}
	dbPass := os.Getenv("DB_PASSWORD")
	if dbPass == "" {
		dbPass = "devpass"
	}
	dbName := os.Getenv("DB_DATABASE")
	if dbName == "" {
		dbName = "formforge"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	store, err := db.NewPostgresStore(connStr)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	h := handler.NewHandler(store)

	log.Printf("FormForge Edge Service listening on :%s", port)
	if err := http.ListenAndServe(":"+port, h); err != nil {
		log.Fatalf("server terminated: %v", err)
	}
}
