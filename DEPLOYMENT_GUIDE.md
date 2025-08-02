# Deployment Guide

This guide will help you deploy your whiteboard application with Vercel (frontend) and Render (backend).

## Prerequisites

1. **MongoDB Atlas Account**: You'll need a MongoDB Atlas cluster for the database
2. **GitHub Account**: Your code should be in a GitHub repository
3. **Vercel Account**: For frontend deployment
4. **Render Account**: For backend deployment

## Step 1: Set up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Create a database user
4. Get your connection string
5. Add your IP address to the IP whitelist (or use 0.0.0.0/0 for all IPs)

## Step 2: Deploy Backend to Render

1. **Push your code to GitHub** (if not already done)

2. **Go to Render Dashboard**:
   - Visit [render.com](https://render.com)
   - Sign up/Login
   - Click "New +" → "Web Service"

3. **Connect your GitHub repository**:
   - Select your repository
   - Choose the `backend` directory as the root directory

4. **Configure the service**:
   - **Name**: `whiteboard-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

5. **Set Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render will set this automatically)
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `FRONTEND_URL`: Your Vercel frontend URL (you'll set this after frontend deployment)

6. **Deploy**: Click "Create Web Service"

7. **Note the URL**: Render will give you a URL like `https://your-app-name.onrender.com`

## Step 3: Deploy Frontend to Vercel

1. **Go to Vercel Dashboard**:
   - Visit [vercel.com](https://vercel.com)
   - Sign up/Login with GitHub
   - Click "New Project"

2. **Import your repository**:
   - Select your repository
   - Set the root directory to `frontend`
   - Click "Deploy"

3. **Configure Environment Variables**:
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add the following:
     - `VITE_API_URL`: `https://your-backend-url.onrender.com/api`
     - `VITE_SOCKET_URL`: `https://your-backend-url.onrender.com`

4. **Redeploy**: After setting environment variables, redeploy your project

## Step 4: Update Backend CORS

After getting your Vercel frontend URL, update the `FRONTEND_URL` environment variable in your Render backend service to match your Vercel domain.

## Step 5: Test Your Deployment

1. Test the backend health endpoint: `https://your-backend-url.onrender.com/health`
2. Test the frontend: Visit your Vercel URL
3. Test the whiteboard functionality

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure `FRONTEND_URL` in backend matches your Vercel domain exactly
2. **Socket Connection Issues**: Ensure `VITE_SOCKET_URL` points to your Render backend
3. **MongoDB Connection**: Verify your MongoDB Atlas connection string and IP whitelist
4. **Build Errors**: Check that all dependencies are in `package.json`

### Environment Variables Summary:

**Backend (Render)**:
- `NODE_ENV`: production
- `PORT`: 10000 (auto-set by Render)
- `MONGODB_URI`: Your MongoDB Atlas connection string
- `FRONTEND_URL`: Your Vercel frontend URL

**Frontend (Vercel)**:
- `VITE_API_URL`: https://your-backend-url.onrender.com/api
- `VITE_SOCKET_URL`: https://your-backend-url.onrender.com

## Security Notes

1. **MongoDB Atlas**: Use a strong password and consider using IP restrictions
2. **Environment Variables**: Never commit sensitive data to your repository
3. **CORS**: Only allow your specific frontend domain in production

## Cost Considerations

- **Vercel**: Free tier includes 100GB bandwidth/month
- **Render**: Free tier includes 750 hours/month
- **MongoDB Atlas**: Free tier includes 512MB storage

All services offer paid plans for higher usage. 