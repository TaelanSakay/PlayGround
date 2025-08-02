const express = require('express');

console.log('=== TESTING ROUTE MOUNTING ===');

const app = express();

// Test 1: Simple route
console.log('Test 1: Simple route');
app.get('/test', (req, res) => {
  res.json({ message: 'Test working' });
});

// Test 2: Route with parameter
console.log('Test 2: Route with parameter');
app.get('/test/:id', (req, res) => {
  res.json({ message: 'Test with param working', id: req.params.id });
});

// Test 3: Try to mount a router
console.log('Test 3: Mounting router');
try {
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({ message: 'Router working' });
  });
  
  app.use('/api', router);
  console.log('Router mounted successfully');
} catch (error) {
  console.error('Error mounting router:', error);
}

// Test 4: Check environment variables
console.log('Test 4: Environment variables');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);

// Test 5: Check if any env var contains a URL
console.log('Test 5: Checking for URL environment variables');
Object.keys(process.env).forEach(key => {
  const value = process.env[key];
  if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
    console.log(`WARNING: Environment variable ${key} contains a URL:`, value);
  }
});

console.log('=== ALL TESTS COMPLETED ==='); 