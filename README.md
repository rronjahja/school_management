# ISPE — Sistemi i Menaxhimit të Shkollës së Mesme

Web-aplikacion i plotë me **React (Vite)**, **Express** dhe **MySQL** për
menaxhimin e studentëve dhe financave të shkollës ISPE.

## Çfarë përfshin

- **Regjistrimi i studentëve** (në shqip): emri, mbiemri, datëlindja, qyteti,
  adresa, emri i nënës, emri i babait, telefoni, drejtimi, gjenerata, klasa.
- **5 drejtimet**: Teknik Dentar, Farmaci, Fizioterapi, Infermieri, Informatikë
  (secili me ngjyrën e vet në tërë aplikacionin).
- **Financat**: kuota vjetore për student, zbritje (në % ose shumë fikse),
  plan pagese **Mujore / 6-Mujore / Vjetore** — këstet gjenerohen automatikisht.
- **Pagesat**: kesh ose përmes 4 bankave (emrat ndryshohen te `banks` në DB).
- **Alarmet**: 🔴 e kuqe kur kalon afati i këstit, 🟡 e verdhë kur afati është
  brenda 7 ditësh (ndryshohet te `backend/src/config/finance.js`).
- **Dokumenti Word**: gjenerohet nga shablloni juaj (shiko `backend/templates/README.md`).

## Nisja hap pas hapi

### 1. Baza e të dhënave

```bash
mysql -u root -p < backend/database/schema.sql
```

### 2. Backend (porta 5000)

```bash
cd backend
cp .env.example .env      # vendosni fjalëkalimin e MySQL në .env
npm install
npm run dev               # ose: npm start
```

### 3. Frontend (porta 5173)

```bash
cd frontend
npm install
npm run dev
```

Hapni **http://localhost:5173** — kërkesat `/api` kalojnë automatikisht te
backend-i përmes proxy-t të Vite.

## Struktura e projektit

```
backend/
├── server.js                  # pika e nisjes
├── database/schema.sql        # skema + drejtimet + bankat
├── templates/                 # vendosni ketu "regjistrimi.docx"
└── src/
    ├── config/                # db.js, finance.js (rregullat e kesteve)
    ├── routes/                # definimi i API-ve
    ├── controllers/           # trajtimi i kerkesave HTTP
    ├── services/              # logjika e biznesit + SQL
    ├── utils/                 # llogaritjet financiare, validimi
    └── middleware/            # trajtimi i gabimeve

frontend/src/
├── api/                       # thirrjet HTTP (axios)
├── components/
│   ├── layout/                # sidebar, shell
│   ├── ui/                    # badge, chip, modal, karta, fusha
│   ├── students/              # formulari i studentit
│   └── finance/               # kestet, pagesat, modali i pageses
├── pages/                     # Paneli, Studentet, Regjistrimi, Detajet, Financat
├── utils/                     # formatimi (para, data, etiketa shqip)
└── styles/                    # tokens, base, layout, components, pages
```

## Si funksionojnë financat

1. **Kuota neto** = kuota vjetore − zbritja (`percent` ose `amount`).
2. Këstet gjenerohen sipas planit: **Mujore = 10 këste**, **6-Mujore = 2**,
   **Vjetore = 1**. Kësti i parë bie në datën e regjistrimit.
3. Pagesat shpërndahen automatikisht te kësti më i vjetër i papaguar (FIFO).
4. Statusi i secilit kest: *E paguar*, *Vonesë* (🔴), *Afër afatit* (🟡), *Në pritje*.
5. Nëse ndryshoni kuotën/zbritjen/planin te "Ndrysho", këstet rigjenerohen —
   pagesat ekzistuese ruhen dhe rishpërndahen.

Numri i kësteve dhe ditët e paralajmërimit ndryshohen në një vend të vetëm:
`backend/src/config/finance.js`.

## API në shkurtësi

| Metoda | Rruga                                | Përshkrimi                        |
|--------|--------------------------------------|-----------------------------------|
| GET    | /api/dashboard                       | statistikat + alarmet             |
| GET    | /api/students                        | lista me përmbledhje financiare   |
| POST   | /api/students                        | regjistrim (gjeneron këstet)      |
| GET    | /api/students/:id                    | detajet + këstet + pagesat        |
| PUT    | /api/students/:id                    | përditësim                        |
| DELETE | /api/students/:id                    | fshirje                           |
| GET    | /api/students/:id/registration-doc   | dokumenti Word                    |
| POST   | /api/payments                        | pagesë e re (kesh/bankë)          |
| DELETE | /api/payments/:id                    | fshirje pagese                    |
| GET    | /api/categories · /api/banks         | drejtimet · bankat                |
