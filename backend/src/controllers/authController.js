import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createUser, findUserByEmail } from "../models/userModel.js";

export const register = (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password)
        return res.status(400).json({ message: "All fields are required" });

    findUserByEmail(email, (err, results) => {
        if (err) {
            console.error("SQL ERROR:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (results.length > 0)
            return res.status(409).json({ message: "Email already registered" });

        const hashedPassword = bcrypt.hashSync(password, 10);
        const userRole = role || "candidate";

        createUser(name, email, hashedPassword, userRole, (err2) => {
            if (err2) {
                console.error("SQL ERROR:", err2);
                return res.status(500).json({ message: "Database error" });
            }

            res.status(201).json({ message: "User registered successfully" });
        });
    });
};

export const login = (req, res) => {
    const { email, password } = req.body;

    findUserByEmail(email, (err, results) => {
        if (err) {
            console.error("SQL ERROR:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (results.length === 0)
            return res.status(404).json({ message: "User not found" });

        const user = results[0];

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch)
            return res.status(401).json({ message: "Invalid password" });

        const token = jwt.sign(
            {
                id: user.id,     // ✔ FIXED
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,     // ✔ FIXED
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    });
};
