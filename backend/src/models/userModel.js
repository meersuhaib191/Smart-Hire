import db from "../config/db.js";

export const createUser = (name, email, password, role, callback) => {
    const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, email, password, role], callback);
};
export const findUserByEmail = (email, callback) => {
    const sql = "SELECT user_id, name, email, password, role FROM users WHERE email = ?";
    db.query(sql, [email], callback);
};
