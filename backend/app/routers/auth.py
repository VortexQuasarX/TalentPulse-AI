from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserResponse, TokenResponse
from app.security import create_access_token, get_current_user, require_super_admin

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse)
async def signup(data: UserCreate, db: Session = Depends(get_db)):
    """Public signup — candidates only. Admin/accounts created by super admin."""
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email.lower().strip(),
        name=data.name.strip(),
        password_hash=User.hash_password(data.password),
        role="candidate",  # Public signup = always candidate
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/token", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username.lower().strip()).first()
    if not user or not user.verify_password(form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(user)
    return TokenResponse(access_token=token, role=user.role, user_name=user.name, user_id=user.id)


# ── Super Admin: User Management ──

@router.post("/create-user", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """Super admin creates admin/accounts/employee users."""
    if data.role not in ("admin", "super_admin", "accounts", "candidate", "employee"):
        raise HTTPException(status_code=400, detail="Invalid role")

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email.lower().strip(),
        name=data.name.strip(),
        password_hash=User.hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users")
async def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_super_admin)):
    """Super admin lists all users."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [{"id": u.id, "email": u.email, "name": u.name, "role": u.role, "created_at": u.created_at.isoformat()} for u in users]


@router.put("/users/{user_id}/role")
async def change_role(
    user_id: int, role: str = Query(...),
    db: Session = Depends(get_db), current_user: User = Depends(require_super_admin),
):
    """Super admin changes a user's role."""
    if role not in ("candidate", "admin", "super_admin", "accounts", "employee"):
        raise HTTPException(status_code=400, detail="Invalid role")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    db.commit()
    return {"message": f"Role changed to {role}"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_super_admin)):
    """Super admin deletes a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}
