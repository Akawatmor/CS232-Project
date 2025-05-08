// Add this line to your existing imports
const dashboardRoutes = require('./routes/dashboard');

// Add this line where you register your routes
app.use('/api/dashboard', dashboardRoutes);
