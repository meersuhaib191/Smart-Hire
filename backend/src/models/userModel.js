import db from "../config/db.js";

// Find user by email
export const findUserByEmail = (email, callback) => {
    db.query(
        "SELECT id, name, email, password, role FROM users WHERE email = ?",
        [email],
        callback
    );
};

// Create new user
export const createUser = (name, email, password, role, callback) => {
    db.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        [name, email, password, role],
        callback
    );
};
