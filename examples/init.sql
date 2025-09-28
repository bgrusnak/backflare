-- Example init.sql
-- This script will be executed during deployment to initialize the database.

-- Drop the table if it already exists to ensure a clean slate
DROP TABLE IF EXISTS Users;

-- Create a simple 'Users' table
CREATE TABLE Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some sample data
INSERT INTO Users (name, email) VALUES ('Alice', 'alice@example.com');
INSERT INTO Users (name, email) VALUES ('Bob', 'bob@example.com');