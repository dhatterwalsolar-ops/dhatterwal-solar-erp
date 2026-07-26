# Dhatterwal Solar ERP Web

React + Vite frontend for the Dhatterwal Solar marketing website and upcoming ERP modules.

## Run locally

```bash
npm install
npm run dev
```

Do **not** run `npm create vite@latest .` in this folder — the project is already scaffolded.

## Routes

| Path | Screen |
|------|--------|
| `/` | Marketing homepage |
| `/login` | ERP login (demo redirect) |
| `/dashboard` | ERP dashboard shell |
| `/customers` | Customers module placeholder |
| `/quotations` | Quotations module placeholder |
| `/invoices` | Invoices module placeholder |
| `/stock` | Stock module placeholder |
| `/reports` | Reports module placeholder |

## Architecture

```
src/
  app/           App shell & router
  constants/     Route paths & ERP navigation
  layouts/       Auth & dashboard layouts
  pages/         Route-level pages
  components/
    common/      Shared UI (Reveal, ModuleScaffold)
    home/        Homepage sections (CSS Modules)
  hooks/         Shared hooks (optional)
  styles/        Global tokens & utilities
  assets/        Static media
```

Homepage sections use **CSS Modules**; shared design tokens live in `src/styles/variables.css`.
