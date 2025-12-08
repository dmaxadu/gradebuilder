# GradeBuilder

**GradeBuilder** is a full-stack curriculum planning web application that allows students to visualize and organize their academic course schedule using an interactive drag-and-drop interface. The application validates prerequisites, manages credit limits, and persists user data across sessions.

![Technology Stack](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/react-20232a?style=for-the-badge&logo=react&logoColor=61DAFB)
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![SQLite](https://img.shields.io/badge/sqlite-07405e?style=for-the-badge&logo=sqlite&logoColor=white)

---

## Features

- **Interactive Drag-and-Drop Interface**: Organize courses across 8 academic periods with visual feedback
- **Prerequisite Validation**: Automatic validation ensuring prerequisites are met before dependent courses
- **Credit Management**: Real-time credit calculation with enforcement of 32-credit limit per period
- **Graph Visualization**: Visual dependency chains with animated edges showing course relationships
- **Elective Course Management**: Support for conditional and restricted choice electives
- **Auto-Save**: Automatic graph persistence with 2-second debounce
- **Layout Optimization**: Multiple graph layout algorithms to minimize edge crossings
- **User Authentication**: Secure JWT-based authentication with bcrypt password hashing
- **Responsive Design**: Clean, modern UI with period-based color coding

---

## Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Server**: Uvicorn ASGI
- **Database**: SQLite with SQLAlchemy ORM
- **Authentication**: JWT (JSON Web Tokens) + bcrypt
- **Graph Processing**: NetworkX

### Frontend
- **Framework**: React 19
- **Routing**: React Router v7
- **Graph Visualization**: ReactFlow 11.11.4
- **Layout Engine**: Dagre 0.8.5
- **State Management**: React Context API + localStorage

---

## Project Structure

```
gradebuilder/
├── backend/                 # Python/FastAPI backend
│   ├── main.py             # API endpoints and business logic
│   ├── database.py         # SQLAlchemy ORM models
│   ├── gradebuilder.db     # SQLite database
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables
├── front/                  # React frontend
│   ├── src/
│   │   ├── App.js         # Main app routing
│   │   ├── GradeBuilder.js # Main grade builder component
│   │   ├── AuthContext.js # Authentication context
│   │   ├── Login.js       # Login page
│   │   ├── Signup.js      # Signup page
│   │   ├── api.js         # API client functions
│   │   ├── curriculo.json # Curriculum data
│   │   └── *.css          # Styling
│   ├── package.json       # Node dependencies
│   └── public/            # Static assets
├── .venv/                 # Python virtual environment
├── start.bat              # Windows startup script
├── start.ps1              # PowerShell startup script
└── package.json           # Root npm scripts
```

---

## Quick Start

### Prerequisites

- **Python 3.8+** (virtual environment already configured in `.venv`)
- **Node.js 14+** and npm 6+
- Windows OS (for batch/PowerShell scripts)

### Installation

All dependencies are already installed. If you need to reinstall:

**Backend dependencies:**
```bash
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

**Frontend dependencies:**
```bash
cd front
npm install
```

### Running the Application

**Option 1: Batch Script (Easiest)**
```bash
start.bat
```

**Option 2: PowerShell Script**
```bash
.\start.ps1
```

**Option 3: NPM Script**
```bash
# First install concurrently
npm install

# Then start
npm start
```

**Option 4: Manual (Two Terminals)**

Terminal 1 - Backend:
```bash
.venv\Scripts\activate
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2 - Frontend:
```bash
cd front
npm start
```

### Accessing the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs (Swagger UI)

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/signup` | Register new user | No |
| POST | `/auth/login` | Login and get JWT token | No |
| GET | `/auth/me` | Get current user info | Yes |

### Graph Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/graph/save` | Save grade graph | Yes |
| GET | `/graph/load` | Load saved grade graph | Yes |

### Layout Optimization

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/layout/planar` | Compute planar graph layout | No |
| POST | `/layout/layered` | Compute layered DAG layout | No |

---

## Database Schema

### Users Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | Primary Key |
| email | String | Unique, Not Null, Indexed |
| name | String | Not Null |
| hashed_password | String | Not Null |
| created_at | DateTime | Default: UTC now |

### User Graphs Table
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | Primary Key |
| user_id | Integer | Foreign Key → users.id |
| graph_name | String | Default: "My Grade" |
| nodes_json | Text | JSON serialized |
| edges_json | Text | JSON serialized |
| created_at | DateTime | Default: UTC now |
| updated_at | DateTime | Auto-update |

---

## Application Workflow

### User Journey

1. **First Visit**
   - Navigate to http://localhost:3000
   - Redirected to `/login` page
   - Click "Sign Up" to create account

2. **Registration**
   - Enter email, password, and name
   - Backend creates user with hashed password
   - Receive JWT token, redirected to GradeBuilder

3. **Grade Planning**
   - Curriculum loads with default course layout
   - Drag courses from suggested periods into schedule
   - System validates prerequisites and credit limits
   - Click elective courses to assign them
   - Graph auto-saves every 2 seconds

4. **Layout Optimization**
   - Click "Optimize Layout" to minimize edge crossings
   - Backend computes optimal positions using graph algorithms

5. **Returning User**
   - Login with credentials
   - Saved graph loads automatically

---

## Key Features Explained

### Prerequisite Validation
The application validates that prerequisite courses are placed in earlier periods before allowing dependent courses. This is enforced during drag-and-drop operations.

### Credit Limit Enforcement
Each period has a maximum of 32 credits. The application displays current credit totals and highlights periods exceeding the limit in red.

### Elective Course System
- **Conditional Electives** (orange background, dashed border): Courses from Period 9
- **Restricted Choice Electives** (purple background, dashed border): Courses from Period 10
- Click on elective courses to assign them to your schedule

### Graph Optimization Algorithms
- **Planar Layout**: Uses NetworkX to check if the graph can be drawn without edge crossings
- **Layered Layout**: Implements Sugiyama's algorithm for hierarchical DAG layouts with minimal crossings

### Auto-Save Feature
The application automatically saves your progress to the backend every 2 seconds after changes are detected, with debouncing to prevent excessive API calls.

---

## Environment Configuration

### Backend Environment Variables

Create or edit `backend/.env`:

```env
# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# JWT Secret (change in production!)
JWT_SECRET_KEY=your-secret-key-change-in-production

# Database URL
DATABASE_URL=sqlite:///./gradebuilder.db
```

### Frontend API Configuration

The frontend API base URL is configured in [front/src/api.js](front/src/api.js):

```javascript
const API_BASE_URL = 'http://localhost:8000';
```

Change this if your backend runs on a different port or host.

---

## Troubleshooting

### Backend fails to start

**Error**: `ModuleNotFoundError: No module named 'fastapi'`

**Solution**: Ensure virtual environment is activated and dependencies installed:
```bash
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

### Frontend fails to start

**Error**: `'react-scripts' is not recognized`

**Solution**: Install node modules:
```bash
cd front
npm install
```

### CORS errors in browser console

**Error**: `Access to fetch blocked by CORS policy`

**Solution**: Verify `ALLOWED_ORIGINS` in `backend/.env` includes `http://localhost:3000`

### Database errors

**Error**: `sqlite3.OperationalError: table users does not exist`

**Solution**: Database auto-initializes on first backend startup. Delete `backend/gradebuilder.db` and restart backend.

### Port already in use

**Error**: `OSError: [Errno 48] Address already in use`

**Solution**:
- Backend: Change port in uvicorn command (`--port 8001`)
- Frontend: Set `PORT=3001` environment variable before `npm start`

---

## Security Features

- **Password Hashing**: bcrypt with salt for secure password storage
- **JWT Authentication**: 24-hour token expiration
- **CORS Protection**: Restricts API access to allowed origins
- **SQL Injection Protection**: SQLAlchemy ORM parameterized queries
- **Bearer Token Authentication**: Required for protected endpoints

**Important**: Change `JWT_SECRET_KEY` in production!

---

## Development

### Backend Development

The backend uses FastAPI with hot-reload enabled. Changes to Python files will automatically restart the server.

**Run backend only:**
```bash
.venv\Scripts\activate
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**View API documentation:**
Visit http://localhost:8000/docs for interactive Swagger UI documentation.

### Frontend Development

The frontend uses React Scripts with hot module replacement. Changes to React components will update in the browser without refresh.

**Run frontend only:**
```bash
cd front
npm start
```

**Build for production:**
```bash
cd front
npm run build
```

This creates an optimized production build in `front/build/`.

---

## Testing Checklist

After starting the application:

- [ ] Visit http://localhost:8000/docs to verify backend is running
- [ ] Visit http://localhost:3000 to access the frontend
- [ ] Create a test account via Sign Up
- [ ] Verify curriculum loads with courses visible
- [ ] Drag a course to Period 1 and verify it updates
- [ ] Check that credit total is displayed correctly
- [ ] Try to violate prerequisites and verify validation works
- [ ] Click an elective course to assign it
- [ ] Check browser console for auto-save messages
- [ ] Logout and login again to verify graph persistence

---

## Architecture Highlights

### Backend Architecture
- **FastAPI**: Modern, fast Python web framework with automatic API documentation
- **SQLAlchemy ORM**: Database abstraction layer for clean, maintainable code
- **NetworkX**: Graph algorithms for layout optimization and planarity testing
- **JWT + bcrypt**: Industry-standard authentication and password security

### Frontend Architecture
- **React 19**: Latest React with improved performance and features
- **ReactFlow**: Powerful graph visualization library with built-in interactions
- **Dagre**: Directed graph layout engine for automatic node positioning
- **Context API**: Clean global state management without Redux complexity

### Data Flow
```
User (Browser)
    ↓
React App (GradeBuilder)
    ├── Local Storage (auth token)
    ├── API Client (api.js)
    ↓
FastAPI Backend
    ├── JWT Validation
    ├── Database (SQLAlchemy)
    │   ├── Users table
    │   └── UserGraphs table
    └── Graph Processing (NetworkX)
        ├── Planarity checking
        └── Layout algorithms
```

---

## Contributing

This is an educational project. Feel free to fork and modify for your own use.

---

## License

ISC License

---

## Contact

For questions or issues, please open an issue on the repository.

---

## Acknowledgments

- **FastAPI**: For the excellent Python web framework
- **React**: For the powerful UI library
- **ReactFlow**: For the graph visualization capabilities
- **NetworkX**: For graph algorithm implementations
- **Dagre**: For the layout engine

---

**Happy Grade Planning!**
