from typing import Optional, List
import os

from fastapi import FastAPI, HTTPException
from sqlmodel import Field, SQLModel, create_engine, Session, select

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
engine = create_engine(DATABASE_URL, echo=False)


class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    repo_url: Optional[str] = None
    status: Optional[str] = "active"
    owner: Optional[str] = None
    tags: Optional[str] = None  # comma-separated tags
    metadata: Optional[str] = None  # optional JSON string for extra data


app = FastAPI(title="Projects API")


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)


@app.post("/projects", response_model=Project)
def create_project(project: Project):
    with Session(engine) as session:
        session.add(project)
        session.commit()
        session.refresh(project)
        return project


@app.get("/projects", response_model=List[Project])
def list_projects():
    with Session(engine) as session:
        statement = select(Project)
        results = session.exec(statement).all()
        return results


@app.get("/projects/{project_id}", response_model=Project)
def get_project(project_id: int):
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project


@app.put("/projects/{project_id}", response_model=Project)
def update_project(project_id: int, proj: Project):
    with Session(engine) as session:
        existing = session.get(Project, project_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Project not found")
        proj.id = project_id
        session.merge(proj)
        session.commit()
        session.refresh(proj)
        return proj


@app.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int):
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        session.delete(project)
        session.commit()
        return None
