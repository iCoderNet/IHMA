from pydantic import BaseModel
from app.models.user import UserRole


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: UserRole
    is_active: bool
    district_id: int | None = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str
    role: UserRole = UserRole.ADMIN
    district_id: int | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = None
    is_active: bool | None = None
    district_id: int | None = None
