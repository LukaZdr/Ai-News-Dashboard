# AI News Dashboard Management Makefile

# Variables
PID_FILE = .vite.pid
LOG_FILE = dev.log
PORT = 5173

.PHONY: help start stop restart status install build test lint fetch send-discord clean

# Default target
help:
	@echo "AI News Dashboard Management Commands:"
	@echo "  make start     - Start the development server in the background"
	@echo "  make stop      - Stop the development server"
	@echo "  make restart   - Restart the development server"
	@echo "  make status    - Check the status of the development server"
	@echo "  make install   - Install project dependencies"
	@echo "  make build     - Build the production bundle"
	@echo "  make test      - Run tests"
	@echo "  make lint      - Lint the codebase"
	@echo "  make fetch     - Fetch all papers, news, YouTube, and GitHub data"
	@echo "  make send-discord - Test sending the daily digest summary to Discord"
	@echo "  make clean     - Clean build artifacts, logs, and pid files"

# Start the dev server in the background
start:
	@if [ -f $(PID_FILE) ] && ps -p $$(cat $(PID_FILE)) > /dev/null; then \
		echo "Application is already running (PID: $$(cat $(PID_FILE)))"; \
	else \
		echo "Starting application dev server..."; \
		npm run dev > $(LOG_FILE) 2>&1 & echo $$! > $(PID_FILE); \
		sleep 1.5; \
		if [ -f $(PID_FILE) ] && ps -p $$(cat $(PID_FILE)) > /dev/null; then \
			echo "Application started successfully."; \
			echo "- PID: $$(cat $(PID_FILE))"; \
			echo "- Logs: $(LOG_FILE)"; \
			echo "- URL: http://localhost:$(PORT)"; \
		else \
			echo "Failed to start application. Check $(LOG_FILE) for details."; \
			rm -f $(PID_FILE); \
		fi \
	fi

# Stop the dev server
stop:
	@if [ -f $(PID_FILE) ]; then \
		PID=$$(cat $(PID_FILE)); \
		echo "Stopping application (PID: $$PID)..."; \
		# Kill children of the npm process (vite) first, then npm itself \
		pkill -P $$PID 2>/dev/null || true; \
		kill $$PID 2>/dev/null || true; \
		rm -f $(PID_FILE); \
		echo "Application stopped."; \
	else \
		echo "No PID file found. Checking for orphaned vite processes..."; \
		if pkill -f "vite" 2>/dev/null; then \
			echo "Stopped orphaned vite processes."; \
		else \
			echo "Application is not running."; \
		fi \
	fi

# Restart the dev server
restart: stop start

# Check status of the dev server
status:
	@if [ -f $(PID_FILE) ] && ps -p $$(cat $(PID_FILE)) > /dev/null; then \
		echo "Application is running:"; \
		echo "- PID: $$(cat $(PID_FILE))"; \
		echo "- URL: http://localhost:$(PORT)"; \
		echo "- Log file: $(LOG_FILE)"; \
	else \
		echo "Application is stopped."; \
		if [ -f $(PID_FILE) ]; then \
			rm -f $(PID_FILE); \
		fi \
	fi

# Install dependencies
install:
	npm install

# Build the project
build:
	npm run build

# Run unit tests
test:
	npm run test

# Lint the project
lint:
	npm run lint

# Fetch all external data
fetch:
	npm run fetch:all

# Clean up temporary files and build artifacts
clean:
	@echo "Cleaning project..."
	rm -rf dist
	rm -f $(PID_FILE)
	rm -f $(LOG_FILE)
	@echo "Clean complete."

# Test sending the daily digest summary to Discord
send-discord:
	npm run send:discord

