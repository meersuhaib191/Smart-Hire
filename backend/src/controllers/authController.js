import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createUser, findUserByEmail } from "../models/userModel.js";

export const register = (req, res) => {
    const { name, email, password, role } = req.body; // ⬅ ROLE RECEIVED

    if (!name || !email || !password)
        return res.status(400).json({ message: "All fields are required" });

    findUserByEmail(email, (err, results) => {
        if (results.length > 0)
            return res.status(409).json({ message: "Email already registered" });

        const hashedPassword = bcrypt.hashSync(password, 10);

        // If no role sent → default to candidate
        const userRole = role || "candidate";

        createUser(name, email, hashedPassword, userRole, () => {
            res.status(201).json({ message: "User registered successfully" });
        });
    });
};
export const login = (req, res) => {
    const { email, password } = req.body;

    findUserByEmail(email, (err, results) => {
        if (results.length === 0)
            return res.status(404).json({ message: "User not found" });

        const user = results[0];
        const isMatch = bcrypt.compareSync(password, user.password);

        if (!isMatch) return res.status(401).json({ message: "Invalid password" });

        const token = jwt.sign(
            {
                id: user.user_id,     // <-- FIXED
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
                id: user.user_id,    // <-- FIXED
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    });
};
