# IHMA — Ijtimoiy Himoya Menejment Axborot Tizimi

**FastAPI + MySQL** | **React + Tailwind + DaisyUI** | **Telegram Bot** | **Light/Dark Mode**

---

## 🚀 Tez ishga tushirish

### 1. Talablar
- Python 3.11+
- Node.js 20+
- MySQL 8.0+
- (Ixtiyoriy) Docker & Docker Compose

### 2. Backend

```bash
cd backend
cp .env.example .env
# .env faylini to'ldiring

pip install -r requirements.txt

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Birinchi ishga tushirilganda:**
- Jadvallar avtomatik yaratiladi
- Superadmin yaratiladi: `superadmin` / `Admin@123456`
- 13 ta Andijon viloyati tumani yuklanadi

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173
API Docs: http://localhost:8000/api/docs

### 4. Docker bilan

```bash
cp backend/.env.example backend/.env
docker-compose up -d
```

---

## 🔐 Loginlar

| Rol | Username | Parol |
|-----|----------|-------|
| Superadmin | superadmin | Admin@123456 |

---

## 📁 Loyiha tuzilmasi

```
social-platform/
├── backend/
│   ├── app/
│   │   ├── core/           # config, database, security, dependencies
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── routers/        # FastAPI routers
│   │   └── services/       # Excel, Telegram services
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/     # Layout, UI components
│       ├── pages/          # Superadmin, Admin, Auth pages
│       ├── store/          # Zustand stores
│       └── services/       # API service
└── docker-compose.yml
```

---

## 🤖 Telegram Bot

1. @BotFather dan token oling
2. Superadmin → Bot sozlamalari → Token kiriting
3. HTTPS domeningizni kiriting
4. "Webhook o'rnatish" tugmasini bosing
5. Botni faollashtiring

**Bot oqimi:**
- `/start` → Til tanlash (UZ/RU)
- FIO kiritish
- Tuman tanlash
- Telefon tasdiqlash (faqat o'z raqami)
- Qo'shimcha raqam (ixtiyoriy)
- Asosiy menyu: Murojaat | Murojaatlarim | Profilim

---

## 📊 Dinamik bo'limlar

Superadmin panelidan:
1. **Bo'limlar** → "Yangi bo'lim" yarating (NBSH, Sanatoriya, va h.k.)
2. Bo'limga kirish → **Ustun qo'shish** (MFY nomi, Soni, va h.k.)
3. **Import** → Excel fayl yuklash, ustunlarni moslashtirish
4. **Template** → Import uchun shablon yuklab olish
5. **Export** → Ma'lumotlarni Excel ga yuklab olish

---

## 🛠 Muhim API endpointlar

| Method | URL | Tavsif |
|--------|-----|--------|
| POST | `/api/auth/login` | Login |
| GET | `/api/sections` | Bo'limlar ro'yxati |
| POST | `/api/sections` | Bo'lim yaratish |
| GET | `/api/sections/{id}/rows` | Bo'lim ma'lumotlari |
| POST | `/api/sections/{id}/excel/import` | Excel import |
| GET | `/api/sections/{id}/excel/export` | Excel export |
| GET | `/api/appeals` | Murojaatlar |
| PUT | `/api/appeals/{id}/status` | Holat o'zgartirish |
| POST | `/api/bot/webhook` | Telegram webhook |
| GET | `/api/dashboard/stats` | Dashboard statistika |
