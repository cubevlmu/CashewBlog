package main

import (
	"CashewBlog/internal/app/server"
	"log"
)

func main() {
	if err := server.Run(); err != nil {
		log.Fatalf("server run failed: %v", err)
	}
}
