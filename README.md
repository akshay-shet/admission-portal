# Admission Portal (Student Portal)

Modern React + Vite admission management portal deployed live on Vercel:
👉 **[https://react-app-sepia-xi.vercel.app](https://react-app-sepia-xi.vercel.app)**

## Features
- **Student Admissions**: Complete CRUD with age calculation, photo & marks-card attachments for SSLC, PUC, Degree, and PG levels.
- **Fee Installment Tracker**: Real-time balance calculations, split payment modes (Cash / Online / UPI / Split), receipt printing, and date filters.
- **Academy OS**: Modules for Enquiries, Documents, Exams, Fee Schedules, Approvals, Expenses, and Cash/Bank accounts.
- **Google Sheets Sync**: Automated live synchronization to Google Sheets (`Admission portal`) via Vercel serverless function (`/api/sheets`).
- **Export & Reports**: Excel tracker generation with frozen headers and formulas, PDF export, and receipt statements.
- **Document Scanning**: Integrated scan button supporting Windows WIA scanners and camera capture.

## Run Locally
1. Navigate to the `react-app` directory:
   ```bash
   cd react-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```
   Production build outputs to `react-app/dist/index.html`.

## Deployment
Configured for automated build and deployment on **Vercel** (`vercel.json`).
