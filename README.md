# Ormaro

Karadağ için dört dilli (Karadağca, İngilizce, Türkçe, Rusça) ikinci el pazaryeri.

## Yapı

```
apps/web          Next.js: arayüz ve API (Vercel'de çalışır)
packages/db       Veritabanı şeması, göçler, başlangıç verisi (Drizzle + PostgreSQL)
packages/shared   Diller, kategoriler, şehirler, doğrulama kuralları
```

Arayüz metinleri `apps/web/messages/` altında, her dil için bir JSON dosyası.

## Kendi bilgisayarında çalıştırma

Gerekenler: Node.js 22 ve pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example apps/web/.env.local   # DATABASE_URL'i doldurun
pnpm dev                              # http://localhost:3000
```

Veritabanı olmadan da açılır; `/api/health` o zaman `"db": "not_configured"` döner.

## Veritabanı komutları

`DATABASE_URL` ortam değişkeni tanımlıyken:

```bash
pnpm db:migrate   # göçleri uygular
pnpm db:seed      # 25 belediyeyi ve 6 kategoriyi yükler (tekrar çalıştırmak güvenli)
pnpm db:generate  # şema değişince yeni göç dosyası üretir
```

## Canlıya alma

### 1. Railway: veritabanı

1. railway.com'da GitHub ile giriş yapın, **New Project → Database → PostgreSQL** seçin.
2. Postgres servisinin **Variables** sekmesinden `DATABASE_PUBLIC_URL` değerini kopyalayın. Vercel Railway'in iç ağında olmadığı için iç adres (`DATABASE_URL`) çalışmaz.
3. Tabloları elle kurmanız gerekmez: Vercel her yayında önce göçleri ve başlangıç verisini çalıştırır (`apps/web/vercel.json`). İkisi de tekrar çalıştırmaya karşı güvenlidir.

Not: Ücretsiz katman 30 günlük deneme kredisinden sonra ayda 1 $ kredi veriyor. Sürekli açık bir veritabanının buna sığıp sığmadığını deneme süresinde **Usage** sayfasından izleyin.

### 2. Vercel: web uygulaması

1. vercel.com'da GitHub ile giriş yapın, **Add New → Project** ile bu depoyu içe aktarın.
2. **Root Directory** olarak `apps/web` seçin. Çerçeve otomatik olarak Next.js tanınır.
3. **Environment Variables** altına `DATABASE_URL` = Railway'den kopyaladığınız `DATABASE_PUBLIC_URL`.
4. **Deploy**. Bittiğinde `<proje>.vercel.app/api/health` adresinde `"db": "ok"` ve `"cities": 25` görmelisiniz.

Bundan sonra `main` dalına gelen her değişiklik canlıya, her değişiklik isteği kendi önizleme adresine çıkar.
