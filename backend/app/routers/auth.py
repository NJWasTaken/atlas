from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from app.models import User
from app.schemas import AuthInput, TokenOutput, UserOutput
from app.security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenOutput, status_code=201)
def register(data: AuthInput, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(email=email, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOutput(access_token=create_access_token(user.id))

@router.post("/login", response_model=TokenOutput)
def login(data: AuthInput, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return TokenOutput(access_token=create_access_token(user.id))

@router.get("/me", response_model=UserOutput)
def me(user: User = Depends(get_current_user)):
    return user
