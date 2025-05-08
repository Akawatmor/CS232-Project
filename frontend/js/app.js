/**
 * Main application initialization
 */
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is authenticated
  if (!Auth.isAuthenticated() && window.location.pathname !== '/login.html') {
    window.location.href = 'login.html';
    return;
  }
  
  // Initialize navigation
  Navigation.init();
  
  // Initialize Dashboard
  Dashboard.init();
  
  // Initialize QuickSight Dashboard
  QuickSightDashboard.init();
  
  // Initialize Products
  Products.init();
  
  // Initialize Customers
  Customers.init();
  
  // Initialize Sales
  Sales.init();
  
  // Display user name
  const userNameElement = document.getElementById('user-name');
  if (userNameElement) {
    const user = Auth.getUser();
    if (user && user.name) {
      userNameElement.textContent = user.name;
    }
  }
  
  // Setup logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      Auth.logout();
      window.location.href = 'login.html';
    });
  }
});
