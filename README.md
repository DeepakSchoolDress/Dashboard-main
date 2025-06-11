# Inventory Management Dashboard

A complete inventory management system with school commission tracking built with React.js and Supabase.

## Features

- 📦 **Product Management**: Add, edit, delete, and track inventory with optional fields (JSONB)
- 🏫 **School Management**: Manage school partnerships with commission tracking
- 🛒 **Sales Processing**: Complete cart functionality with real-time stock management
- 📊 **Dashboard**: Overview with sales statistics, low stock alerts, and recent activity
- ❌ **Bill Cancellation**: Cancel sales with automatic stock restoration and audit trail
- 💰 **Commission Tracking**: Track which sales items are eligible for school commissions
- 🔍 **Advanced Search**: Search across products, customers, and schools
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React.js 18, Redux Toolkit, React Router, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **UI Components**: Lucide React Icons, React Hot Toast
- **Styling**: Tailwind CSS with custom components

## Database Schema

### Tables
- `schools` - School partnerships
- `products` - Product inventory with optional JSONB fields
- `commissions` - School-product commission rates
- `sales` - Sales transactions
- `sale_items` - Individual items in each sale
- `bill_cancellations` - Audit trail for cancelled bills

## Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- Supabase CLI (optional but recommended)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd inventory-dashboard
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set up Supabase

#### Option A: Use Supabase Cloud
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key

#### Option B: Run Supabase Locally
```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# This will provide local URLs and keys
```

### 4. Configure Environment Variables
```bash
# Copy the example environment file
cp env.example .env

# Edit .env with your Supabase credentials
REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Set up Database

#### Run Migrations
```bash
# If using Supabase CLI locally
supabase db reset

# Or manually run the SQL files in your Supabase dashboard:
# 1. Run supabase/migrations/001_initial_schema.sql
# 2. Run supabase/seed.sql (optional - adds sample data)
```

#### Deploy Edge Functions (if using Supabase Cloud)
```bash
supabase functions deploy create-sale
supabase functions deploy cancel-bill
```

### 6. Start the Development Server
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Usage

### 1. Dashboard
- View overall statistics (products, schools, sales, revenue)
- Monitor low stock alerts
- See today's sales and recent activity

### 2. Products Management
- Add new products with cost/selling prices
- Set stock quantities
- Associate products with specific schools
- Add optional attributes using JSON fields

### 3. Schools Management
- Add school partners
- Edit school information
- Delete schools (with proper foreign key handling)

### 4. Sales Processing
- Browse products with search functionality
- Add items to cart with quantity controls
- Select customer and optional school association
- Complete sales with automatic stock deduction
- Commission tracking based on school-product associations

### 5. Sales History
- View all sales with search functionality
- See detailed sale information including items and commissions
- Cancel bills with reason tracking
- Automatic stock restoration on cancellation

## Business Logic

### Sale Creation
1. Validate stock availability for all items
2. Calculate total amount
3. Check commission eligibility based on school-product associations
4. Create sale and sale items records
5. Update product stock quantities
6. Mark sale items as commissioned if applicable

### Bill Cancellation
1. Verify sale exists and hasn't been cancelled
2. Restore stock quantities for all items
3. Create cancellation record with reason
4. Maintain original sale records for audit trail

### Commission System
- Products can be associated with schools via the `commissions` table
- Commission rates are stored as decimals (e.g., 0.05 for 5%)
- Sales items are marked as `is_commissioned` when sold to associated schools
- Full audit trail for commission tracking

## API Endpoints

### Supabase Edge Functions
- `/functions/v1/create-sale` - Create new sale with stock management
- `/functions/v1/cancel-bill` - Cancel sale with stock restoration

### Supabase Auto-Generated REST APIs
- `/rest/v1/products` - Product CRUD operations
- `/rest/v1/schools` - School CRUD operations
- `/rest/v1/sales` - Sales queries
- `/rest/v1/commissions` - Commission management

## Development

### Project Structure
```
src/
├── components/          # Reusable components
│   └── Layout.js       # Main app layout with navigation
├── pages/              # Page components
│   ├── Dashboard.js    # Statistics overview
│   ├── Products.js     # Product management
│   ├── Schools.js      # School management
│   ├── Sales.js        # Sales cart interface
│   └── SalesHistory.js # Sales history and cancellation
├── store/              # Redux state management
│   ├── index.js        # Store configuration
│   └── slices/         # Redux slices
├── lib/                # Utilities
│   └── supabase.js     # Supabase client setup
└── index.css           # Tailwind CSS styles
```

### Key Features Implementation

#### Stock Management
- Real-time stock validation during cart operations
- Automatic stock deduction on sale completion
- Stock restoration on bill cancellation

#### Commission Tracking
- Flexible commission rates per school-product combination
- Automatic commission flagging during sales
- Commission reporting in sales history

#### Audit Trail
- All cancelled bills tracked with timestamps and reasons
- Original sale records preserved
- Stock movement history

## Customization

### Adding New Product Fields
The `optional_fields` JSONB column allows you to store any additional product attributes:

```sql
-- Example: Add color and size to a product
UPDATE products 
SET optional_fields = '{"color": "red", "size": "large", "material": "cotton"}'
WHERE id = 'product-id';
```

### Extending the Commission System
You can add time-based commissions, percentage tiers, or other business rules by extending the `commissions` table and updating the Edge Functions.

## Deployment

### Frontend (React App)
- Build: `npm run build`
- Deploy to Vercel, Netlify, or any static hosting service

### Backend (Supabase)
- Use Supabase Cloud for production
- Deploy Edge Functions: `supabase functions deploy --project-ref your-project-ref`
- Configure environment variables in your hosting platform

## Support

For issues, feature requests, or questions:
1. Check the existing issues in the repository
2. Create a new issue with detailed description
3. Include environment details and error messages

## License

This project is licensed under the MIT License - see the LICENSE file for details. 