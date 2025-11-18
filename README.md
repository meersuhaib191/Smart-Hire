# 🚀 SmartHire – Recruitment Automation System

SmartHire is a full-stack recruitment automation platform designed to simplify hiring workflows for **Admins**, **Recruiters**, and **Candidates**.

This project includes:
- 🌐 **Frontend** (React + Vite)
- 🖥 **Backend** (Node.js + Express + MySQL)
- 🔐 Secure authentication using JWT
- 📄 Resume upload handling using Multer
- 👤 Role-based access for Admin, Recruiter, Candidate

---

## 📂 Project Structure
SmartHire/
├─ backend/
│ ├─ src/
│ │ ├─ config/
│ │ ├─ controllers/
│ │ ├─ middleware/
│ │ ├─ models/
│ │ ├─ routes/
│ │ └─ server.js
│ ├─ uploads/
│ ├─ .env
│ ├─ package.json
│ └─ package-lock.json
│
├─ frontend/
│ ├─ src/
│ ├─ public/
│ ├─ index.html
│ ├─ package.json
│ └─ vite.config.js
│
└─ README.md


---

# 🛠 Tech Stack

### **Frontend**
- React (Vite)
- React Router
- Axios
- JavaScript

### **Backend**
- Node.js
- Express.js
- MySQL (mysql2)
- JWT Authentication
- Multer (Resume uploads)

---

# 🔐 Roles & Permissions

| Role        | Permissions |
|-------------|-------------|
| **Admin**     | Manage users, view all jobs & applications |
| **Recruiter** | Create/edit jobs, view applicants |
| **Candidate** | View jobs, apply to jobs |

---

# 🚀 Backend Setup

### 1️⃣ Go to backend folder
```bash
cd backend
2️⃣ Install dependencies
bash
Copy code
npm install
3️⃣ Create .env file
ini
Copy code
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=smart_hire
JWT_SECRET=your_secret_key
4️⃣ Start backend
bash
Copy code
npm start
Backend runs at:

👉 http://localhost:5000

🌐 Frontend Setup
1️⃣ Go to frontend folder
bash
Copy code
cd frontend
2️⃣ Install dependencies
bash
Copy code
npm install
3️⃣ Run development server
bash
Copy code
npm run dev
Frontend runs at:

👉 http://localhost:5173

📦 API Endpoints (Summary)
Auth
MethodEndpointDescriptionPOST/api/auth/registerRegister userPOST/api/auth/loginLogin user

Jobs
MethodEndpointDescriptionPOST/api/jobs/postCreate job (Recruiter/Admin)GET/api/jobsGet all jobsPUT/api/jobs/:idEdit jobDELETE/api/jobs/:idDelete job

Applications
MethodEndpointDescriptionPOST/api/applications/applyApply to jobGET/api/applications/mineCandidate's applicationsGET/api/applications/job/:jobIdApplicants for a job (Recruiter/Admin)PUT/api/applications/status/:idChange app status

📝 Features Completed
✔ User Authentication (JWT)
✔ Role-based Access
✔ Job Posting
✔ Job Application
✔ Resume Upload
✔ Admin Controls
✔ Recruiter Controls
✔ Candidate Dashboard

🚧 Upcoming Features


Email notifications


Interview scheduling


Analytics dashboard


Profile pages



🤝 Contributing
Feel free to open issues or pull requests.

📜 License
This project is licensed under the MIT License.

⭐ Support
If you like this project, hit the ⭐ button on GitHub!

---
