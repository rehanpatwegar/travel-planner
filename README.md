# GlobeTrotter 🌍

Plan smarter. Travel better.

GlobeTrotter is an AI-powered travel planning platform that helps users create, organize, optimize, and manage personalized multi-city trips. It brings itineraries, budgets, expenses, calendars, and intelligent travel recommendations together in one place.

- 🔗 **Live Demo:** [https://travel-planner-virid-pi.vercel.app/](https://travel-planner-virid-pi.vercel.app/)
- 💻 **GitHub Repository:** [https://github.com/rehanpatwegar/travel-planner](https://github.com/rehanpatwegar/travel-planner)

---

## ✨ Features

### 🧳 Trip Planning
- Create and manage multi-city trips.
- Organize destinations, activities, and day-wise itineraries.
- Add, edit, and reorder itinerary activities.
- View trip details and manage trip schedules.

### 🤖 AI-Powered Travel Assistance
- Generate personalized trip itineraries using AI.
- Get intelligent recommendations based on trip details.
- Optimize existing travel plans.
- Use the Trip Assistant to ask questions and get context-aware travel suggestions.

### 💰 Budget Management
- Set and track trip budgets.
- Monitor expenses and spending.
- View budget breakdowns and financial summaries.
- Explore budget-conscious trip optimization suggestions.

### ❤️ Trip Health Score
A dedicated scoring system that evaluates the overall quality of a travel plan across five dimensions:

| Dimension | Weight |
| --- | :---: |
| Budget Fit | 20 |
| Schedule Conflicts | 25 |
| Daily Workload | 20 |
| Rest Time | 20 |
| Travel Feasibility | 15 |
| **Total** | **100** |

The score helps users identify potential planning issues and improve their itineraries.

### 👥 Group Trip Management
- Manage shared trip expenses.
- Track contributions and spending.
- Split expenses between group members.

### 📅 Calendar & Organization
- View itinerary schedules in a calendar.
- Organize activities across travel dates.
- Manage trip details from a centralized dashboard.

### 🔗 Sharing & Booking
- Share trip information through supported sharing functionality.
- Access booking links associated with travel activities.
- Public sharing availability depends on the database functions and deployment configuration being set up correctly.

---

## 🛠️ Tech Stack

| Category | Technologies |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| AI Integration | Google Gemini API |
| Charts | Recharts |
| Calendar | FullCalendar |
| Drag & Drop | dnd-kit |
| Backend | Next.js API Routes |
| Deployment | Vercel |
| Version Control | Git & GitHub |

---

## 🏗️ Project Architecture

GlobeTrotter uses a modern full-stack architecture:

- **Frontend:** Next.js App Router and React provide the user interface.
- **Backend:** Next.js API routes handle server-side operations and AI requests.
- **Database:** Supabase PostgreSQL stores application data.
- **Authentication:** Supabase Auth manages user authentication.
- **AI:** Google Gemini supports itinerary generation and travel assistance.
- **Deployment:** The application is configured for deployment through Vercel.

---

## 🚀 Getting Started

Follow these steps to run GlobeTrotter locally.

### Prerequisites
- Node.js 20.9 or later
- npm
- Git
- A Supabase project
- A Google Gemini API key

### 1. Clone the Repository
```bash
git clone https://github.com/rehanpatwegar/travel-planner.git
cd travel-planner
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create your local environment file.

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux:**
```bash
cp .env.example .env.local
```

Add the required Supabase and Gemini credentials using the variable names documented in `.env.example`.

Keep `.env.local` private. Never commit API keys, service-role credentials, or other secrets to GitHub.

### 4. Configure the Database
1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Review the database setup scripts in the repository.
4. Apply the base schema and seed data in the documented order.
5. Review and apply applicable migrations in sequence.

> [!IMPORTANT]
> Do not execute archived SQL or proposal-only scripts as ordinary setup migrations. In particular, public-sharing RPC proposals must be reviewed and deployed separately before relying on those database functions.

### 5. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Quality Checks

Run the following checks before submitting changes:

```bash
npm run lint
npm run build
npx tsc --noEmit
```

These checks help identify linting issues, production build errors, and TypeScript errors.

Project verification scripts can also be found in the `scripts/` directory.

Local automated checks do not replace verification against a configured live Supabase database.

---

## 🔐 Security Notes

- Keep environment variables and API credentials out of version control.
- Use server-side handling for sensitive API operations.
- Apply database policies according to the application's ownership and access requirements.
- Review SQL migrations before applying them to a live database.
- Do not assume proposal-only database functions or security changes are deployed.
- Verify production database permissions and policies independently.

---

## 📁 Project Structure

The project follows the Next.js App Router structure. Important areas include:

| Directory / File | Purpose |
| --- | --- |
| `app/` | Application routes and pages |
| `components/` | Reusable UI components |
| `lib/` | Shared utilities, application logic, and scoring |
| `scripts/` | Verification and utility scripts |
| `db/` | Database schema, migrations, and proposals |
| `public/` | Static assets |
| `.env.example` | Environment variable template |
| `package.json` | Dependencies and project scripts |

---

## 🔮 Future Scope

Potential improvements include:
- Real-time weather-aware itinerary recommendations.
- Interactive maps and route visualization.
- More advanced collaborative trip planning.
- Expanded destination and activity catalogs.
- Enhanced AI-powered budget optimization.
- Additional travel insights and analytics.

---

## 🤝 Contributing

Contributions and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run the relevant quality checks.
5. Submit a pull request.

---

## 👨‍💻 Author

Developed by [Rehan Patwegar](https://github.com/rehanpatwegar) <br />
GitHub: [@rehanpatwegar](https://github.com/rehanpatwegar)

---

⭐ If you find GlobeTrotter interesting, consider giving the repository a star!
