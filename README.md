This is a Next.js + Supabase project for managing on-site attendance with an existing database.

## Getting Started

### 1) Configure Supabase

- Use your existing Supabase project and tables (`user`, `project`).
- Run the SQL in `supabase/schema.sql` in the Supabase SQL editor to create additional tables.
- Ensure the `user` table contains an admin account (`role = 'admin'`) with a bcrypt password hash.

### 2) Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SESSION_SECRET=YOUR_SESSION_SECRET
```

### 3) Run the app

First, install dependencies and run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Open [http://localhost:3000](http://localhost:3000) with your browser.

This project uses the existing `user` table for authentication. Supabase Auth is not used.

## Notes

To learn more about Next.js, take a look at the following resources:

- Login uses `user.user_id` and bcrypt hashed passwords.
- Regular users can change only their own password (Settings page).

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
