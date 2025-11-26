# FitStore - Supplement Business Management System

A full-stack web application for managing your supplement business, built with Django and React.

## Features

- **Dashboard** - Overview of your business metrics, low stock alerts, recent activity
- **Product Management** - Track inventory, SKUs, stock levels, and categories
- **Supplier Management** - Maintain supplier information and contacts
- **Purchase Orders** - Record and track purchases from suppliers
- **Sales Tracking** - Record sales and automatically update inventory
- **Inventory Transactions** - Complete audit trail of all stock movements
- **Profit Calculation** - Automatic calculation of costs, revenue, and profits

## Tech Stack

### Backend
- Django 5.2
- Django REST Framework
- PostgreSQL (SQLite for development)
- Python 3.13

### Frontend
- React 18 with TypeScript
- Vite
- Tailwind CSS
- Axios for API calls
- React Router for navigation
- TanStack Query for data fetching

## Getting Started

### Prerequisites
- Python 3.13+
- Node.js 18+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Activate the virtual environment:
   ```bash
   # Windows
   .\venv\Scripts\activate

   # Mac/Linux
   source venv/bin/activate
   ```

3. Install dependencies (already installed):
   ```bash
   pip install -r requirements.txt
   ```

4. Run migrations (already done):
   ```bash
   python manage.py migrate
   ```

5. Start the Django development server:
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://localhost:8000/api/`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies (already installed):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:5173/`

## Admin Panel

Access the Django admin panel at `http://localhost:8000/admin/`

**Default credentials:**
- Username: `admin`
- Password: `admin123`

**Note:** Change these credentials in production!

## API Endpoints

- `/api/suppliers/` - Supplier CRUD operations
- `/api/products/` - Product CRUD operations
- `/api/products/low_stock/` - Get low stock products
- `/api/purchases/` - Purchase order CRUD operations
- `/api/purchases/{id}/receive/` - Mark purchase as received and update inventory
- `/api/purchase-items/` - Purchase line items
- `/api/sales/` - Sales CRUD operations
- `/api/sale-items/` - Sale line items
- `/api/inventory-transactions/` - View inventory transaction history

## Database Models

- **Supplier** - Supplier information and contacts
- **Product** - Product details, SKU, stock levels
- **Purchase** - Purchase orders from suppliers
- **PurchaseItem** - Line items for purchases
- **Sale** - Customer sales transactions
- **SaleItem** - Line items for sales
- **InventoryTransaction** - Audit trail for all inventory movements

## Development

### Running Both Servers

You'll need two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
.\venv\Scripts\activate  # Windows
python manage.py runserver
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Deployment

### Free Hosting Options

**Frontend (React):**
- Vercel (recommended) - Free tier, automatic deployments
- Netlify - Free tier available

**Backend (Django):**
- Railway.app - $5/month credit (free)
- Render.com - Free tier available
- PythonAnywhere - Free tier available

**Database:**
- Supabase - Free PostgreSQL (500MB)
- Railway - PostgreSQL included in free tier

## Future Enhancements

- User authentication and multi-user support
- Advanced reporting and analytics
- Email notifications for low stock
- Barcode scanning for products
- Invoice generation
- Customer management
- Payment tracking
- Expiration date tracking for products

## License

MIT

## Support

For issues or questions, please create an issue in the repository.
