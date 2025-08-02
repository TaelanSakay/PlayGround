# Vercel Environment Variables Setup

## How to Set Environment Variables in Vercel

### Step 1: Access Your Project Settings
1. Go to your Vercel dashboard
2. Click on your project
3. Go to "Settings" tab
4. Click on "Environment Variables" in the left sidebar

### Step 2: Add Environment Variables
For each environment variable, click "Add New" and fill in:

**Variable 1:**
- **Name**: `VITE_API_URL`
- **Value**: `https://your-backend-url.onrender.com/api`
- **Environment**: Production (check this box)
- **Environment**: Preview (optional, check if you want it in preview deployments)

**Variable 2:**
- **Name**: `VITE_SOCKET_URL`
- **Value**: `https://your-backend-url.onrender.com`
- **Environment**: Production (check this box)
- **Environment**: Preview (optional, check if you want it in preview deployments)

### Step 3: Save and Redeploy
1. Click "Save" for each variable
2. Go to "Deployments" tab
3. Click "Redeploy" on your latest deployment

## Important Notes

- **Variable Names**: Must start with `VITE_` to be accessible in your React app
- **No Quotes**: Don't add quotes around the values
- **HTTPS Required**: Make sure your backend URLs use `https://`
- **Redeploy Required**: After adding environment variables, you must redeploy

## Troubleshooting

### Environment Variables Not Working?
1. Check that variable names start with `VITE_`
2. Verify the values are correct (no typos)
3. Make sure you redeployed after adding variables
4. Check deployment logs for any errors

### How to Verify Variables Are Set
1. Go to your project settings
2. Click "Environment Variables"
3. You should see your variables listed there
4. The values will be hidden for security

### Testing Locally
You can test with local environment variables by creating a `.env.local` file in your `frontend` directory:
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
``` 