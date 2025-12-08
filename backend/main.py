from collections import defaultdict
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

import networkx as nx
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import jwt
import bcrypt

import os
import json
from dotenv import load_dotenv
from sqlalchemy.orm import Session

load_dotenv()

from database import get_db, init_db, User as DBUser, UserGraph

class NodeIn(BaseModel):
    id: str
    data: Dict[str, Any] = {}


class EdgeIn(BaseModel):
    id: str
    source: str
    target: str


class LayoutRequest(BaseModel):
    nodes: List[NodeIn]
    edges: List[EdgeIn]

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class GraphSaveRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    graph_name: str = "My Grade"


class GraphLoadResponse(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    graph_name: str
    updated_at: str

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

security = HTTPBearer()

app = FastAPI()

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
origins = [o.strip() for o in allowed_origins.split(",") if o.strip()]

print(f"CORS origins configured: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()
    print("Application started successfully!")

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> int:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        return int(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

@app.post("/auth/signup", response_model=TokenResponse)
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    existing_user = db.query(DBUser).filter(DBUser.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    hashed_password = hash_password(request.password)
    db_user = DBUser(
        email=request.email,
        name=request.name,
        hashed_password=hashed_password
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    access_token = create_access_token({"sub": request.email, "user_id": str(db_user.id)})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=str(db_user.id),
            email=db_user.email,
            name=db_user.name
        )
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token({"sub": user.email, "user_id": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name
        )
    )


@app.get("/auth/me", response_model=UserResponse)
def get_current_user(user_id: int = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name
    )

@app.post("/graph/save")
def save_graph(
    graph_data: GraphSaveRequest,
    user_id: int = Depends(verify_token),
    db: Session = Depends(get_db)
):
    existing_graph = db.query(UserGraph).filter(UserGraph.user_id == user_id).first()

    nodes_json = json.dumps(graph_data.nodes)
    edges_json = json.dumps(graph_data.edges)

    if existing_graph:
        existing_graph.nodes_json = nodes_json
        existing_graph.edges_json = edges_json
        existing_graph.graph_name = graph_data.graph_name
        existing_graph.updated_at = datetime.utcnow()
    else:
        new_graph = UserGraph(
            user_id=user_id,
            graph_name=graph_data.graph_name,
            nodes_json=nodes_json,
            edges_json=edges_json
        )
        db.add(new_graph)

    db.commit()

    return {"message": "Graph saved successfully", "graph_name": graph_data.graph_name}


@app.get("/graph/load", response_model=GraphLoadResponse)
def load_graph(
    user_id: int = Depends(verify_token),
    db: Session = Depends(get_db)
):
    user_graph = db.query(UserGraph).filter(UserGraph.user_id == user_id).first()

    if not user_graph:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No graph found for this user"
        )

    nodes = json.loads(user_graph.nodes_json)
    edges = json.loads(user_graph.edges_json)

    return GraphLoadResponse(
        nodes=nodes,
        edges=edges,
        graph_name=user_graph.graph_name,
        updated_at=user_graph.updated_at.isoformat()
    )


@app.post("/layout/planar")
def compute_planar_layout(payload: LayoutRequest):
    G = nx.Graph()
    for node in payload.nodes:
        G.add_node(node.id)
    for edge in payload.edges:
        G.add_edge(edge.source, edge.target)

    is_planar, _ = nx.check_planarity(G)

    if is_planar:
        pos = nx.planar_layout(G)
    else:
        pos = nx.spring_layout(G)

    SCALE = 500.0
    positions = {
        nid: {"x": float(x) * SCALE, "y": float(y) * SCALE}
        for nid, (x, y) in pos.items()
    }

    return {"is_planar": is_planar, "positions": positions}

@app.post("/layout/layered")
def layered_layout(payload: LayoutRequest):
    G = nx.DiGraph()
    for node in payload.nodes:
        G.add_node(node.id)
    for edge in payload.edges:
        G.add_edge(edge.source, edge.target)

    if not nx.is_directed_acyclic_graph(G):
        raise HTTPException(status_code=400, detail="Graph contains cycles")

    # Use user's period assignments instead of calculating new layers
    node_layer: Dict[str, int] = {}
    for node in payload.nodes:
        periodo = node.data.get("periodo", 0)
        if periodo > 0:
            node_layer[node.id] = periodo

    # Group nodes by their assigned period (user's column placement)
    layers: Dict[int, List[str]] = defaultdict(list)
    for node_id, layer in node_layer.items():
        layers[layer].append(node_id)

    ordered_layers = sorted(layers.keys())

    # Initialize order with current nodes in each layer
    order: Dict[int, List[str]] = {layer: sorted(nodes) for layer, nodes in layers.items()}

    # Sweep algorithm to minimize edge crossings within each column
    def sweep_left_to_right():
        for i in range(1, len(ordered_layers)):
            prev_layer = ordered_layers[i - 1]
            curr_layer = ordered_layers[i]

            prev_idx = {nid: idx for idx, nid in enumerate(order[prev_layer])}

            def key(node_id: str) -> float:
                preds = [n for n in G.predecessors(node_id) if node_layer.get(n) == prev_layer]
                if not preds:
                    return 0
                return sum(prev_idx[n] for n in preds) / len(preds)

            order[curr_layer] = sorted(order[curr_layer], key=key)

    def sweep_right_to_left():
        for i in range(len(ordered_layers) - 2, -1, -1):
            next_layer = ordered_layers[i + 1]
            curr_layer = ordered_layers[i]

            next_idx = {nid: idx for idx, nid in enumerate(order[next_layer])}

            def key(node_id: str) -> float:
                succs = [n for n in G.successors(node_id) if node_layer.get(n) == next_layer]
                if not succs:
                    return 0
                return sum(next_idx[n] for n in succs) / len(succs)

            order[curr_layer] = sorted(order[curr_layer], key=key)

    # Run multiple sweeps to converge on optimal ordering
    for _ in range(4):
        sweep_left_to_right()
        sweep_right_to_left()

    positions: Dict[str, Dict[str, float]] = {}

    column_width = 250.0
    node_height = 80.0
    row_gap = 20.0

    # Assign positions based on optimized order
    # Keep X position based on user's period assignment
    for layer in ordered_layers:
        x = (layer - 1) * column_width  # Use layer directly as it's the user's period
        for row_index, node_id in enumerate(order[layer]):
            y = row_index * (node_height + row_gap)
            positions[node_id] = {"x": x, "y": y}

    G_undirected = G.to_undirected()
    is_planar, _ = nx.check_planarity(G_undirected)

    return {"is_planar": is_planar, "positions": positions}
