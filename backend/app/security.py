from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.config import get_settings
from app.database import get_db
from app.models import User

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

# Valid roles: super_admin, admin, accounts, candidate, employee
# super_admin = platform owner (full access, user management)
# admin = HR (jobs, candidates, interviews, leaves)
# accounts = payroll, attendance, salary (NOT user management)
# candidate = job applicant
# employee = hired, onboarded


def create_access_token(user: User) -> str:
    payload = {
        "sub": user.email,
        "role": user.role,
        "user_id": user.id,
        "exp": datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """HR admin or super_admin."""
    if current_user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Platform owner only."""
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user


async def require_accounts(current_user: User = Depends(get_current_user)) -> User:
    """Accounts team or super_admin."""
    if current_user.role not in ("accounts", "super_admin"):
        raise HTTPException(status_code=403, detail="Accounts access required")
    return current_user


async def require_employee(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Employee access required")
    return current_user


async def require_employee_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("employee", "admin", "super_admin", "accounts"):
        raise HTTPException(status_code=403, detail="Employee or admin access required")
    return current_user
