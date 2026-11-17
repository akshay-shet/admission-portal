# Google Sheet link on Hostinger (service account)

On claude.ai the portal used your own Google sign-in. On your own server it uses a **service account** instead.
The portal's sync itself is unchanged (same tabs, same Backup tab, same "Sync now" / automatic sync, same restore).

1. Google Cloud Console → your project (`student-portal-514604`) → **IAM & Admin › Service accounts** → `ningappa-sheets@…` → **Keys › Add key › Create new key › JSON**. A `.json` file downloads.
2. Copy that file to the server as `connectivity/google-sheets/service-account.json`
   (permissions: `chmod 600`). **Never** put it inside `frontend/` and never commit it to GitHub.
3. Make sure the **Google Sheets API** is enabled: APIs & Services › Library › "Google Sheets API" › Enable.
4. Open the spreadsheet → **Share** → add the service account's email (`ningappa-sheets@student-portal-514604.iam.gserviceaccount.com`) as **Editor**.
5. In `connectivity/config/.env`: `GOOGLE_SERVICE_ACCOUNT_FILE=connectivity/google-sheets/service-account.json` and `GOOGLE_SHEET_ID=<the id from the sheet link>`.
6. Restart the portal (`pm2 restart student-portal`). In the portal: Settings › Google Sheet › **Sync now**.

The OAuth *client* (client ID / client secret) you created is **not** needed — you can delete it in Google Cloud.
