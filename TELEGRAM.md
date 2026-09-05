# İyi Yatırım Telegram botu

Bot, `/start` ve `/terminal` komutlarına müşteriyi İyi Yatırım Mini App'ine
götüren **Terminali Aç** düğmesiyle yanıt verir.

## Yayına alma

1. Bu sürümü HTTPS üzerinden erişilen sunucuya yayınlayın.
2. Sunucunun `.env.local` dosyasına `TELEGRAM_BOT_TOKEN` ile
   `TELEGRAM_WEBHOOK_SECRET` değerlerini ekleyin. Jeton bir parola gibi
   saklanır; hiçbir zaman kaynak koda veya takip edilen dosyalara yazılmaz.
3. Uygulamayı yeniden başlatın.
4. Sunucuda `npm run telegram` komutunu çalıştırın.

Komut, mevcut `NEXT_PUBLIC_SITE_URL` değerini kullanarak aşağıdaki yeni
Telegram adreslerini tanımlar; mevcut site veya terminal adreslerini
değiştirmez:

- Mini App: `/telegram`
- Güvenli webhook: `/api/telegram/webhook`

Ardından Telegram'da botu açıp `/start` gönderin ve **Terminali Aç**
düğmesini deneyin.

> Alan adı değişirse `npm run telegram` tekrar çalıştırılmalıdır.
