# ✈ Sky Ace 3D — Havo jangi

3D brauzer o'yini: 8 xarita, 124 samolyot, Arena (26 AI), Baza himoyasi, suv osti kemalari, multiplayer xonalar, PWA (telefonga o'rnatish).

Next.js 16 + Three.js + PostgreSQL (Drizzle ORM).

---

## 🚀 Render + GitHub orqali doimiy saytga chiqarish

### 1-qadam — GitHub'ga yuklash

1. <https://github.com/new> da yangi repo yarating (masalan `sky-ace-3d`). README qo'shmang.
2. Loyiha papkasida terminal oching va yozing:

```bash
git init
git add .
git commit -m "Sky Ace 3D"
git branch -M main
git remote add origin https://github.com/SIZNING_LOGIN/sky-ace-3d.git
git push -u origin main
```

> Bu yerdagi "Download" tugmasi orqali loyihani ZIP qilib yuklab olib, ochib, yuqoridagi buyruqlarni bajaring.
> Terminal ishlatmasangiz: GitHub repo sahifasida **"uploading an existing file"** ni bosib, barcha fayllarni (node_modules va .next dan tashqari) sudrab tashlang.

### 2-qadam — Render'da ishga tushirish (Blueprint)

1. <https://dashboard.render.com> ga GitHub akkaunt bilan kiring.
2. **New +** → **Blueprint** → repo'ni tanlang.
3. **Blueprint Name** ga istalgan nom yozing (masalan `sky-ace`).
4. Pastga tushib **Deploy Blueprint / Apply** ni bosing.
5. 3–6 daqiqadan so'ng sayt manzili chiqadi: `https://sky-ace-3d.onrender.com`

Blueprint faqat **1 ta web xizmat** yaratadi — baza shart emas. Baza bo'lmasa global rekordlar va
multiplayer xonalari server xotirasida saqlanadi (shaxsiy rekordlar, tangalar va samolyotlar baribir
brauzerda doimiy saqlanadi).

> ⚠ **"Additional services & databases will exceed limit of 25"** xatosi chiqsa:
> Render Dashboard → eski/keraksiz xizmat va bazalarni oching → **Settings → Delete**. So'ng qayta urinib ko'ring.

### 3-qadam — Yangilash

Kodni o'zgartirib `git push` qilsangiz (yoki GitHub'da fayllarni qayta yuklasangiz), Render saytni avtomatik qayta build qiladi.

---

## 💡 Doimiy ishlashi uchun

- Free web xizmat 15 daqiqa harakatsizlikdan keyin "uxlaydi" — birinchi ochilishda ~50 soniya kutadi.
  Doim uyg'oq bo'lishi uchun `render.yaml` da `plan: starter`.
- Global rekordlar qayta ishga tushganda saqlanib qolishi uchun bepul Neon bazasini ulang (pastda).

### Bepul doimiy baza: Neon

1. <https://neon.tech> da bepul loyiha yarating, **Connection string** ni nusxalang (`postgresql://...sslmode=require`).
2. Render → `sky-ace-3d` xizmati → **Environment** → **Add Environment Variable**: `DATABASE_URL` = shu qiymat → **Save**. Jadvallar avtomatik yaratiladi.

### O'z domeningiz

Render → xizmat → **Settings → Custom Domains** → domeningizni qo'shing va DNS'da ko'rsatilgan CNAME yozuvini qo'shing. HTTPS avtomatik beriladi (PWA o'rnatish uchun HTTPS shart).

---

## 🖥 Lokal ishga tushirish

```bash
npm install
echo "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db" > .env
npm run dev
```

## 🎮 Boshqaruv

W gaz • S tormoz • Shift forsaj • ←/→ burilish • ↑/↓ burun • Q/E rul • Space o'q • F raketa • X issiqlik nishonlari • P pauza • R qayta boshlash.
Telefonda — ekrandagi joystik va tugmalar.
