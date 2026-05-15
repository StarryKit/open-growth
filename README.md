<h1 align="center">🚀 Open Growth</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat&logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat" alt="License">
</p>

<p align="center"><strong>Social Media Operations & Growth Toolkit</strong> — a data-driven content growth engine.</p>

Open Growth is an open-source toolkit for social media creators and marketers, helping you automate content production, cross-platform analytics, distribution, and growth strategy execution.

---

## 🎯 Features

| Module | Description | Status |
|--------|-------------|--------|
| **Dashboard** | Unified management panel with cross-account overview | 🚧 Planned |
| **Content Engine** | AI-assisted content generation with multi-platform format adaptation | 🚧 Planned |
| **Analytics** | Cross-platform data aggregation and insights | 🚧 Planned |
| **Scheduler** | Smart posting time optimization and scheduling | 🚧 Planned |
| **Growth Hacks** | Growth strategy library and A/B testing tools | 🚧 Planned |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│              Open Growth                 │
├─────────────────┬───────────────────────┤
│   Frontend      │      Backend          │
│   (Next.js)     │   (OpenCLI + Agent)   │
├─────────────────┼───────────────────────┤
│  • Dashboard    │  • Data Fetchers      │
│  • Analytics    │  • Content Pipeline   │
│  • Scheduler    │  • Platform APIs      │
└─────────────────┴───────────────────────┘
```

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS 4
- **Backend**: [OpenCLI](https://github.com/jackwener/opencli) + Hermes Agent
- **Deployment**: Nginx reverse proxy + Let's Encrypt SSL

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

Open [http://localhost:3000](http://localhost:3000) to see the dev interface.

---

## 📦 Project Structure

```
open-growth/
├── src/
│   ├── app/          # Next.js App Router pages
│   ├── components/   # Reusable UI components
│   └── lib/          # Utility functions & API clients
├── public/           # Static assets
├── scripts/          # OpenCLI scripts & automation
└── config/           # Configuration files
```

---

## 🤝 Contributing

Started by [Mine77](https://github.com/Mine77). Issues and PRs welcome.

---

## 📄 License

MIT © 2026 [Mine77](https://github.com/Mine77)
